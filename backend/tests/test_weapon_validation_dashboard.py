import os
import sys
import uuid
import pytest
from pathlib import Path
from httpx import AsyncClient

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.models.incident import PotentialIncident
from app.models.evidence import IncidentEvidence
from app.models.camera import Camera


@pytest.mark.asyncio
async def test_dashboard_stats_empty_database(client):
    """When no incidents exist, dashboard stats return valid zero counts without error."""
    res = await client.get("/api/v1/incidents/weapon-validation/stats")
    assert res.status_code == 200
    data = res.json()
    assert data["total_weapon_events"] == 0
    assert data["awaiting_review"] == 0
    assert data["reviewed_count"] == 0
    assert data["false_positive_count"] == 0
    assert data["class_breakdown"]["gun"] == 0
    assert data["class_breakdown"]["knife"] == 0
    assert data["confidence_statistics"]["average"] == 0.0
    assert data["evidence_verification"]["total_incidents_audited"] == 0
    assert data["model_telemetry"]["accuracy_evaluated"] is False
    assert "accuracy" in data["model_telemetry"]["accuracy_disclaimer"].lower()


@pytest.mark.asyncio
async def test_dashboard_stats_computed_from_actual_db(client, async_db):
    """Statistics must be derived from actual database records, not hardcoded."""
    # 1. Gun incident, pending
    inc_1 = PotentialIncident(
        id=str(uuid.uuid4()),
        source_type="camera",
        source_id="cam_main_gate",
        category="potential_weapon_gun",
        confidence=0.88,
        timestamp_start=12.0,
        timestamp_end=14.0,
        review_status="potential"
    )
    # 2. Knife incident, reviewed
    inc_2 = PotentialIncident(
        id=str(uuid.uuid4()),
        source_type="camera",
        source_id="cam_main_gate",
        category="potential_weapon_knife",
        confidence=0.64,
        timestamp_start=20.0,
        timestamp_end=22.0,
        review_status="reviewed",
        reviewer_notes="Confirmed kitchen knife in open area",
        reviewed_by="Security Supervisor"
    )
    # 3. False positive incident
    inc_3 = PotentialIncident(
        id=str(uuid.uuid4()),
        source_type="camera",
        source_id="cam_lobby",
        category="potential_weapon_gun",
        confidence=0.42,
        timestamp_start=45.0,
        timestamp_end=46.5,
        review_status="false_positive",
        reviewer_notes="Smartphone mistaken for firearm due to angle",
        reviewed_by="Operator"
    )

    async_db.add_all([inc_1, inc_2, inc_3])
    await async_db.commit()

    res = await client.get("/api/v1/incidents/weapon-validation/stats")
    assert res.status_code == 200
    stats = res.json()

    assert stats["total_weapon_events"] == 3
    assert stats["awaiting_review"] == 1
    assert stats["reviewed_count"] == 1
    assert stats["false_positive_count"] == 1
    assert stats["class_breakdown"]["gun"] == 2
    assert stats["class_breakdown"]["knife"] == 1

    # Confidence distribution: 1 in 35-49% (0.42), 1 in 50-69% (0.64), 1 in 85-100% (0.88)
    dist = stats["confidence_statistics"]["distribution"]
    assert dist["bucket_35_49"] == 1
    assert dist["bucket_50_69"] == 1
    assert dist["bucket_70_84"] == 0
    assert dist["bucket_85_100"] == 1
    assert stats["confidence_statistics"]["min"] == pytest.approx(0.42, 0.01)
    assert stats["confidence_statistics"]["max"] == pytest.approx(0.88, 0.01)


@pytest.mark.asyncio
async def test_incident_review_updates_and_preserves_record(client, async_db):
    """Marking an incident as Reviewed preserves all original telemetry and updates review status."""
    inc_id = str(uuid.uuid4())
    inc = PotentialIncident(
        id=inc_id,
        source_type="camera",
        source_id="cam_gate_01",
        category="potential_weapon_gun",
        confidence=0.91,
        timestamp_start=5.0,
        timestamp_end=7.0,
        review_status="potential"
    )
    async_db.add(inc)
    await async_db.commit()

    update_payload = {
        "review_status": "reviewed",
        "reviewer_notes": "Operator verified firearm present at 05.2s",
        "reviewed_by": "Shift Lead"
    }

    res = await client.patch(f"/api/v1/incidents/{inc_id}/review", json=update_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["review_status"] == "reviewed"
    assert data["reviewer_notes"] == "Operator verified firearm present at 05.2s"
    assert data["reviewed_by"] == "Shift Lead"
    assert data["reviewed_at"] is not None

    # Fetch again to verify persistence
    get_res = await client.get(f"/api/v1/incidents/{inc_id}")
    assert get_res.status_code == 200
    persisted = get_res.json()
    assert persisted["review_status"] == "reviewed"
    assert persisted["confidence"] == 0.91
    assert persisted["timestamp_start"] == 5.0


@pytest.mark.asyncio
async def test_false_positive_review_persistence(client, async_db):
    """Marking as False Positive must NOT delete the incident, but record false_positive status."""
    inc_id = str(uuid.uuid4())
    inc = PotentialIncident(
        id=inc_id,
        source_type="camera",
        source_id="cam_entrance",
        category="potential_weapon_knife",
        confidence=0.48,
        timestamp_start=18.0,
        timestamp_end=19.5,
        review_status="potential"
    )
    async_db.add(inc)
    await async_db.commit()

    # Mark as false positive
    res = await client.patch(
        f"/api/v1/incidents/{inc_id}/review",
        json={
            "review_status": "false_positive",
            "reviewer_notes": "Umbrella handle false alarm",
            "reviewed_by": "Operator"
        }
    )
    assert res.status_code == 200

    # Ensure record is still present in database
    get_res = await client.get(f"/api/v1/incidents/{inc_id}")
    assert get_res.status_code == 200
    assert get_res.json()["review_status"] == "false_positive"

    # Verify dashboard reflects false positive count
    stats_res = await client.get("/api/v1/incidents/weapon-validation/stats")
    assert stats_res.status_code == 200
    assert stats_res.json()["false_positive_count"] == 1


@pytest.mark.asyncio
async def test_camera_specific_filtering(client, async_db):
    """Filters dashboard statistics and incident list by camera_id."""
    cam_a_id = "cam_terminal_a"
    cam_b_id = "cam_terminal_b"

    inc_a = PotentialIncident(
        id=str(uuid.uuid4()),
        source_type="camera",
        source_id=cam_a_id,
        category="potential_weapon_gun",
        confidence=0.82,
        timestamp_start=1.0,
        timestamp_end=2.0,
        review_status="potential"
    )
    inc_b = PotentialIncident(
        id=str(uuid.uuid4()),
        source_type="camera",
        source_id=cam_b_id,
        category="potential_weapon_knife",
        confidence=0.74,
        timestamp_start=3.0,
        timestamp_end=4.0,
        review_status="potential"
    )
    async_db.add_all([inc_a, inc_b])
    await async_db.commit()

    # Query stats for camera A
    res_a = await client.get(f"/api/v1/incidents/weapon-validation/stats?camera_id={cam_a_id}")
    assert res_a.status_code == 200
    stats_a = res_a.json()
    assert stats_a["total_weapon_events"] == 1
    assert stats_a["class_breakdown"]["gun"] == 1
    assert stats_a["class_breakdown"]["knife"] == 0

    # Query incident list for camera A
    inc_res = await client.get(f"/api/v1/incidents/weapon-validation/incidents?camera_id={cam_a_id}")
    assert inc_res.status_code == 200
    inc_list = inc_res.json()["incidents"]
    assert len(inc_list) == 1
    assert inc_list[0]["source_id"] == cam_a_id


@pytest.mark.asyncio
async def test_evidence_verification_and_missing_evidence_handling(client, async_db, tmp_path):
    """Verifies that evidence file existence is audited on disk without generating fake files."""
    # 1. Incident with real, existing clip on disk
    real_clip_file = tmp_path / "valid_test_clip.mp4"
    real_clip_file.write_bytes(b"TEST_VIDEO_BYTES_12345678")

    inc_1_id = str(uuid.uuid4())
    inc_1 = PotentialIncident(
        id=inc_1_id,
        source_type="camera",
        source_id="cam_dock",
        category="potential_weapon_gun",
        confidence=0.85,
        timestamp_start=10.0,
        timestamp_end=12.0,
        review_status="potential"
    )
    ev_1 = IncidentEvidence(
        id=str(uuid.uuid4()),
        incident_id=inc_1_id,
        clip_path=str(real_clip_file),
        duration_seconds=2.0,
        file_size_bytes=len(real_clip_file.read_bytes())
    )

    # 2. Incident pointing to a missing file on disk
    inc_2_id = str(uuid.uuid4())
    inc_2 = PotentialIncident(
        id=inc_2_id,
        source_type="camera",
        source_id="cam_dock",
        category="potential_weapon_knife",
        confidence=0.65,
        timestamp_start=15.0,
        timestamp_end=17.0,
        review_status="potential"
    )
    ev_2 = IncidentEvidence(
        id=str(uuid.uuid4()),
        incident_id=inc_2_id,
        clip_path=str(tmp_path / "non_existent_file_999.mp4"),
        duration_seconds=2.0,
        file_size_bytes=50000
    )

    # 3. Incident with no evidence generated
    inc_3_id = str(uuid.uuid4())
    inc_3 = PotentialIncident(
        id=inc_3_id,
        source_type="camera",
        source_id="cam_dock",
        category="potential_weapon_gun",
        confidence=0.77,
        timestamp_start=25.0,
        timestamp_end=27.0,
        review_status="potential"
    )

    async_db.add_all([inc_1, ev_1, inc_2, ev_2, inc_3])
    await async_db.commit()

    # Query stats
    stats_res = await client.get("/api/v1/incidents/weapon-validation/stats")
    assert stats_res.status_code == 200
    ev_stats = stats_res.json()["evidence_verification"]
    assert ev_stats["evidence_available"] == 1
    assert ev_stats["evidence_missing"] == 1
    assert ev_stats["evidence_not_generated"] == 1

    # Filter by evidence_status=missing
    missing_res = await client.get("/api/v1/incidents/weapon-validation/incidents?evidence_status=missing")
    assert missing_res.status_code == 200
    missing_items = missing_res.json()["incidents"]
    assert len(missing_items) == 1
    assert missing_items[0]["id"] == inc_2_id
    assert missing_items[0]["evidence"]["status"] == "missing"
    assert missing_items[0]["evidence"]["clip_exists"] is False

    # Filter by evidence_status=available
    avail_res = await client.get("/api/v1/incidents/weapon-validation/incidents?evidence_status=available")
    assert avail_res.status_code == 200
    avail_items = avail_res.json()["incidents"]
    assert len(avail_items) == 1
    assert avail_items[0]["id"] == inc_1_id
    assert avail_items[0]["evidence"]["status"] == "available"
    assert avail_items[0]["evidence"]["clip_exists"] is True


@pytest.mark.asyncio
async def test_corrupted_zero_byte_evidence_handling(client, async_db, tmp_path):
    """Evidence file that exists but has 0 bytes must be flagged as playback_error."""
    zero_clip_file = tmp_path / "zero_byte_clip.mp4"
    zero_clip_file.write_bytes(b"")  # 0 bytes

    inc_id = str(uuid.uuid4())
    inc = PotentialIncident(
        id=inc_id,
        source_type="camera",
        source_id="cam_corrupt_test",
        category="potential_weapon_knife",
        confidence=0.70,
        timestamp_start=5.0,
        timestamp_end=7.0,
        review_status="potential"
    )
    ev = IncidentEvidence(
        id=str(uuid.uuid4()),
        incident_id=inc_id,
        clip_path=str(zero_clip_file),
        duration_seconds=2.0,
        file_size_bytes=0
    )
    async_db.add_all([inc, ev])
    await async_db.commit()

    stats_res = await client.get("/api/v1/incidents/weapon-validation/stats")
    assert stats_res.status_code == 200
    ev_stats = stats_res.json()["evidence_verification"]
    assert ev_stats["evidence_playback_errors"] == 1

    inc_res = await client.get(f"/api/v1/incidents/weapon-validation/incidents?evidence_status=playback_error")
    assert inc_res.status_code == 200
    items = inc_res.json()["incidents"]
    assert len(items) == 1
    assert items[0]["evidence"]["status"] == "playback_error"
