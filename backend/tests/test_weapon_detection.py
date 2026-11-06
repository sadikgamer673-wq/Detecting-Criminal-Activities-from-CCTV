import os
import sys
import time
import pytest
import numpy as np
import cv2
from pathlib import Path
from httpx import AsyncClient

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.services.detection.detector import (
    WeaponDetector,
    ObjectDetector,
    DualSurveillanceDetector,
    weapon_detector,
    detector
)
from app.services.detection.weapon_tracker import (
    TemporalWeaponTracker,
    TrackedWeaponObject,
    compute_box_iou
)
from app.services.incidents.detector import IncidentManager
from app.services.cameras.manager import LiveCameraWorker, camera_stream_manager
from app.models.incident import PotentialIncident


def test_box_iou_computation():
    """Verify IoU calculation for bounding boxes."""
    b1 = [10.0, 10.0, 50.0, 50.0]
    b2 = [10.0, 10.0, 50.0, 50.0]
    assert compute_box_iou(b1, b2) == pytest.approx(1.0, 0.01)

    # Disjoint boxes
    b3 = [100.0, 100.0, 150.0, 150.0]
    assert compute_box_iou(b1, b3) == 0.0

    # Half overlap
    b4 = [10.0, 10.0, 50.0, 90.0]
    iou = compute_box_iou(b1, b4)
    assert 0.4 < iou < 0.6


def test_weapon_detector_model_loaded_and_classes():
    """Verify real fine-tuned YOLOv8n weapon detection model loads on CPU."""
    wd = WeaponDetector()
    model = wd.load_model()
    assert model is not None
    classes = wd.get_supported_classes()
    assert len(classes) >= 2
    # Verify Gun and knife classes are supported
    class_names_lower = [name.lower() for name in classes.values()]
    assert any("gun" in c or "pistol" in c for c in class_names_lower)
    assert any("knife" in c for c in class_names_lower)


def test_weapon_detector_blank_frame_no_hallucination():
    """A blank frame must not produce fake weapon detections."""
    wd = WeaponDetector()
    blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    detections = wd.detect(blank_frame, confidence=0.35)
    assert isinstance(detections, list)
    assert len(detections) == 0


def test_temporal_weapon_tracker_rejects_single_frame_glitch():
    """A single frame detection must NOT trigger an incident immediately."""
    tracker = TemporalWeaponTracker(min_confirmation_frames=2, min_confidence=0.35)
    
    frame_1_dets = [{
        "class_id": 0,
        "class_name": "Gun",
        "display_name": "GUN",
        "weapon_category": "firearm",
        "confidence": 0.85,
        "box": [100.0, 100.0, 200.0, 200.0],
        "is_weapon": True
    }]
    
    confirmed, active = tracker.process_frame(
        weapon_detections=frame_1_dets,
        timestamp_sec=1.0,
        frame_idx=1
    )
    # 1 frame only: must be in active tracks but NOT confirmed
    assert len(confirmed) == 0
    assert len(active) == 1
    assert active[0]["is_confirmed"] is False
    assert active[0]["consecutive_frames"] == 1


def test_temporal_weapon_tracker_confirms_after_consecutive_frames():
    """Detection across 2 consecutive frames confirms the weapon event."""
    tracker = TemporalWeaponTracker(min_confirmation_frames=2, min_confidence=0.35)
    
    det = {
        "class_id": 0,
        "class_name": "Gun",
        "display_name": "GUN",
        "weapon_category": "firearm",
        "confidence": 0.85,
        "box": [100.0, 100.0, 200.0, 200.0],
        "is_weapon": True
    }
    
    # Frame 1
    tracker.process_frame([det], timestamp_sec=1.0, frame_idx=1)
    
    # Frame 2 (persisted/moved slightly)
    det_2 = dict(det)
    det_2["box"] = [102.0, 101.0, 201.0, 202.0]
    confirmed, active = tracker.process_frame([det_2], timestamp_sec=1.2, frame_idx=2)
    
    assert len(confirmed) == 1
    assert confirmed[0]["weapon_class"] == "Gun"
    assert confirmed[0]["weapon_category"] == "firearm"
    assert confirmed[0]["consecutive_frames"] == 2
    assert confirmed[0]["category"] == "potential_weapon_gun"
    assert len(active) == 1
    assert active[0]["is_confirmed"] is True


def test_temporal_weapon_tracker_suppresses_duplicate_subsequent_alerts():
    """Once confirmed, subsequent consecutive frames for the same track must NOT re-emit alerts."""
    tracker = TemporalWeaponTracker(min_confirmation_frames=2, min_confidence=0.35)
    
    det = {
        "class_id": 3,
        "class_name": "knife",
        "display_name": "KNIFE",
        "weapon_category": "knife",
        "confidence": 0.78,
        "box": [50.0, 50.0, 120.0, 120.0],
        "is_weapon": True
    }
    
    tracker.process_frame([det], timestamp_sec=1.0, frame_idx=1)
    c2, _ = tracker.process_frame([det], timestamp_sec=1.2, frame_idx=2)
    assert len(c2) == 1  # Triggered once

    # Frame 3: same weapon still visible
    c3, a3 = tracker.process_frame([det], timestamp_sec=1.4, frame_idx=3)
    assert len(c3) == 0  # Deduplicated!
    assert len(a3) == 1  # Still active


def test_temporal_weapon_tracker_expires_stale_tracks():
    """Tracks not seen for > track_timeout_sec must be pruned."""
    tracker = TemporalWeaponTracker(min_confirmation_frames=2, min_confidence=0.35, track_timeout_sec=1.5)
    
    det = {
        "class_id": 0,
        "class_name": "Gun",
        "weapon_category": "firearm",
        "confidence": 0.80,
        "box": [10.0, 10.0, 60.0, 60.0],
        "is_weapon": True
    }
    tracker.process_frame([det], timestamp_sec=1.0, frame_idx=1)
    assert len(tracker.tracks) == 1

    # Jump forward 3 seconds without detections
    tracker.process_frame([], timestamp_sec=4.0, frame_idx=15)
    assert len(tracker.tracks) == 0


def test_dual_surveillance_detector_simultaneous_inference():
    """Dual detector coordinates both person and weapon inference without mutual interference."""
    dual = DualSurveillanceDetector(detector, weapon_detector)
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    results = dual.detect_all(frame, person_conf=0.25, weapon_conf=0.35)
    assert "people" in results
    assert "weapons" in results
    assert "all_detections" in results
    assert results["has_weapons"] is False


def test_annotate_frame_weapon_styling():
    """Weapon bounding boxes must be annotated with distinctive red-orange (0, 69, 255) and 'WEAPON:' prefix."""
    det_engine = ObjectDetector()
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    weapon_det = [{
        "class_name": "gun",
        "confidence": 0.92,
        "box": [50, 50, 150, 150],
        "is_weapon": True
    }]
    
    annotated = det_engine.annotate_frame(frame, weapon_det)
    # The bounding box rectangle top-left pixel should have the red-orange BGR channel (0, 69, 255)
    # BGR format: Red channel index is 2
    cropped = annotated[48:52, 48:52]
    assert np.any(cropped[:, :, 2] > 200)  # High red component


@pytest.mark.asyncio
async def test_incident_manager_weapon_incident_persistence(async_db):
    """Weapon detections register as PotentialIncident with review_status='potential'."""
    im = IncidentManager(cooldown_seconds=10)
    
    inc = await im.register_event(
        db=async_db,
        source_type="camera",
        source_id="test_cam_001",
        category="potential_weapon_gun",
        confidence=0.88,
        timestamp_sec=5.0,
        frame_idx=25
    )
    
    assert inc is not None
    assert inc.category == "potential_weapon_gun"
    assert inc.confidence == 0.88
    assert inc.review_status == "potential"
    assert inc.source_id == "test_cam_001"


def test_live_camera_worker_weapon_telemetry():
    """LiveCameraWorker exposes weapons_detected, active_weapons, and latest_weapon_alert in telemetry."""
    worker = LiveCameraWorker(
        camera_id="cam_telemetry_test",
        name="Test Weapon Cam",
        rtsp_url="0",
        source_type="webcam",
        ai_monitoring=False
    )
    
    worker.weapons_detected = 2
    worker.active_weapons = [{
        "track_id": 1,
        "class_name": "Gun",
        "confidence": 0.91,
        "is_confirmed": True,
        "consecutive_frames": 3,
        "box": [10, 10, 50, 50]
    }]
    worker.latest_weapon_alert = "Active: Gun (91%)"
    
    telemetry = worker.get_telemetry()
    assert telemetry["weapons_detected"] == 2
    assert len(telemetry["active_weapons"]) == 1
    assert telemetry["active_weapons"][0]["class_name"] == "Gun"
    assert telemetry["latest_weapon_alert"] == "Active: Gun (91%)"


@pytest.mark.asyncio
async def test_api_filter_all_weapons(client, async_db):
    """GET /api/v1/incidents?category=weapon matches all potential_weapon categories."""
    im = IncidentManager(cooldown_seconds=10)
    
    # Create a gun incident and a knife incident
    await im.register_event(
        db=async_db,
        source_type="camera",
        source_id="cam_api_test",
        category="potential_weapon_gun",
        confidence=0.85,
        timestamp_sec=2.0,
        frame_idx=10
    )
    
    await im.register_event(
        db=async_db,
        source_type="camera",
        source_id="cam_api_test",
        category="potential_weapon_knife",
        confidence=0.75,
        timestamp_sec=3.0,
        frame_idx=15
    )
    
    # Query with category=weapon
    res = await client.get("/api/v1/incidents?category=weapon")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 2
    cats = [item["category"] for item in data]
    assert "potential_weapon_gun" in cats
    assert "potential_weapon_knife" in cats


def test_geometric_sanity_rejects_full_body_knife_silhouette():
    """Verify oversized vertical silhouette mistargeted as knife is rejected."""
    frame_shape = (360, 640)  # height, width
    # Box spanning 72% of frame height (resembles full body silhouette)
    silhouette_knife_box = [450.0, 50.0, 515.0, 310.0]  # height = 260px (72.2%)
    is_valid, reason = WeaponDetector.is_plausible_weapon_geometry(
        box=silhouette_knife_box,
        frame_shape=frame_shape,
        class_name="knife"
    )
    assert is_valid is False
    assert "exceeds" in reason or "aspect ratio" in reason


def test_geometric_sanity_rejects_oversized_gun_box():
    """Verify oversized gun box covering half the screen is rejected."""
    frame_shape = (360, 640)
    oversized_gun_box = [150.0, 60.0, 350.0, 310.0]  # height = 250px (69.4%)
    is_valid, reason = WeaponDetector.is_plausible_weapon_geometry(
        box=oversized_gun_box,
        frame_shape=frame_shape,
        class_name="Gun"
    )
    assert is_valid is False
    assert "exceeds" in reason


def test_geometric_sanity_rejects_weapon_encompassing_person():
    """Verify weapon box spanning >50% of an entire detected person is rejected."""
    frame_shape = (720, 1280)
    person_box = [400.0, 100.0, 550.0, 600.0]  # width 150, height 500
    # False weapon box that is essentially the person's torso and lower body
    weapon_box = [410.0, 120.0, 540.0, 580.0]
    is_valid, reason = WeaponDetector.is_plausible_weapon_geometry(
        box=weapon_box,
        frame_shape=frame_shape,
        class_name="knife",
        person_boxes=[person_box]
    )
    assert is_valid is False
    assert "person silhouette" in reason or "person body" in reason or "exceeds" in reason


def test_geometric_sanity_accepts_plausible_handheld_weapon():
    """Verify realistically sized handheld weapons pass validation."""
    frame_shape = (720, 1280)
    person_box = [400.0, 100.0, 550.0, 600.0]
    # Small handgun near the hand/torso (width 45px, height 35px)
    handgun_box = [520.0, 350.0, 565.0, 385.0]
    is_valid, reason = WeaponDetector.is_plausible_weapon_geometry(
        box=handgun_box,
        frame_shape=frame_shape,
        class_name="Gun",
        person_boxes=[person_box]
    )
    assert is_valid is True
    assert reason == "valid"

    # Small knife (width 25px, height 70px, rel_h = 70/720 = 9.7%)
    knife_box = [530.0, 340.0, 555.0, 410.0]
    is_valid, reason = WeaponDetector.is_plausible_weapon_geometry(
        box=knife_box,
        frame_shape=frame_shape,
        class_name="knife",
        person_boxes=[person_box]
    )
    assert is_valid is True
    assert reason == "valid"
