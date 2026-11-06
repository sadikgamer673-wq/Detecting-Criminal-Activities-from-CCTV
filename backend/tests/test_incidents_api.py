import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.incident import PotentialIncident
from app.models.evidence import IncidentEvidence
from datetime import datetime

@pytest.mark.asyncio
async def test_incidents_api_workflow(client: AsyncClient, async_db: AsyncSession):
    # 1. Summary on empty database
    res = await client.get("/api/v1/incidents/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["total_incidents"] == 0
    assert data["unreviewed_count"] == 0

    # 2. Insert test incident and evidence
    import uuid
    inc_id = str(uuid.uuid4())
    incident = PotentialIncident(
        id=inc_id,
        source_type="upload",
        source_id="test_video_123",
        category="possible_fall",
        confidence=0.88,
        timestamp_start=1.5,
        timestamp_end=5.0,
        frame_index=15,
        review_status="potential",
        created_at=datetime.utcnow()
    )
    async_db.add(incident)
    await async_db.commit()
    await async_db.refresh(incident)

    ev_id = str(uuid.uuid4())
    evidence = IncidentEvidence(
        id=ev_id,
        incident_id=incident.id,
        clip_path="/tmp/fake_clip.mp4",
        thumbnail_path="/tmp/fake_thumb.jpg",
        duration_seconds=3.5,
        file_size_bytes=1048576,
        created_at=datetime.utcnow()
    )
    async_db.add(evidence)
    await async_db.commit()

    # 3. Test GET /api/v1/incidents
    res = await client.get("/api/v1/incidents")
    assert res.status_code == 200
    incidents = res.json()
    assert len(incidents) == 1
    item = incidents[0]
    assert item["id"] == incident.id
    assert item["category"] == "possible_fall"
    assert item["review_status"] == "potential"
    assert len(item["evidence_items"]) == 1

    # 4. Test GET /api/v1/incidents/summary
    res = await client.get("/api/v1/incidents/summary")
    assert res.status_code == 200
    summary = res.json()
    assert summary["total_incidents"] == 1
    assert summary["unreviewed_count"] == 1
    assert summary["reviewed_count"] == 0

    # 5. Test PATCH /api/v1/incidents/{id}/review to acknowledge
    res = await client.patch(
        f"/api/v1/incidents/{incident.id}/review",
        json={"review_status": "acknowledged", "reviewer_notes": "Operator verifying fall event"}
    )
    assert res.status_code == 200
    updated = res.json()
    assert updated["review_status"] == "acknowledged"
    assert updated["reviewer_notes"] == "Operator verifying fall event"

    # Verify updated summary
    res = await client.get("/api/v1/incidents/summary")
    assert res.status_code == 200
    summary = res.json()
    assert summary["unreviewed_count"] == 0
    assert summary["acknowledged_count"] == 1

    # 6. Test GET /api/v1/incidents/evidence
    res = await client.get("/api/v1/incidents/evidence")
    assert res.status_code == 200
    ev_list = res.json()
    assert len(ev_list) == 1
    assert ev_list[0]["incident_id"] == incident.id
    assert ev_list[0]["incident_category"] == "possible_fall"
