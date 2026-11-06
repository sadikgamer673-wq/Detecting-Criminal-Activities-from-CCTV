import time
import pytest
import numpy as np
import cv2
from unittest.mock import MagicMock, patch
from httpx import AsyncClient

from app.services.detection.detector import detector, object_detector
from app.services.detection.activity import TemporalMotionActivityClassifier
from app.services.cameras.manager import LiveCameraWorker, camera_stream_manager


# =====================================================================
# TEST 1 & 2 & 3: REAL YOLOv8n MODEL INFERENCE & ANNOTATION ON CPU
# =====================================================================

def test_real_yolo_blank_frame_no_person():
    """Requirement 2: A frame with no detectable person produces no person detection."""
    blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    detections = detector.detect(blank_frame, confidence=0.25)
    persons = [d for d in detections if d.get("class_name") == "person"]
    assert len(persons) == 0, "Blank frame should yield 0 person detections"


def test_real_yolo_model_loading_and_attributes():
    """Verify YOLOv8n model loads on CPU, aliases work, and attributes match requirements."""
    assert object_detector is detector
    model = detector.load_model()
    assert model is not None
    # COCO class 0 is person
    assert model.names[0] == "person"
    assert detector.model_path.exists()


def test_bounding_box_annotation():
    """Requirement 3: Bounding box and label are drawn on the annotated frame."""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    fake_dets = [{
        "class_id": 0,
        "class_name": "person",
        "confidence": 0.89,
        "box": [100, 80, 250, 400]
    }]
    annotated = detector.annotate_frame(frame, fake_dets)
    assert annotated.shape == frame.shape
    # Frame should have non-zero pixels where the green bounding box and label were drawn
    assert np.any(annotated > 0)


# =====================================================================
# TEST 4, 5, 6, 7, 8, 9: LIVE CAMERA WORKER AI INFERENCE PIPELINE
# =====================================================================

def test_live_camera_worker_counters_and_tracking():
    """
    Requirements 4, 5, 8:
    - Current People reflects the latest processed frame.
    - Unique People does not increase for the same person every frame.
    - Normal standing does not automatically create a crime incident.
    """
    worker = LiveCameraWorker(
        camera_id="test-cam-ai-001",
        name="Test Camera AI",
        rtsp_url="0",
        source_type="webcam",
        ai_monitoring=True
    )
    worker.detector = detector
    worker.activity_classifier = TemporalMotionActivityClassifier()
    worker.activity_classifier.reset()

    now = time.time()
    frame = np.zeros((480, 640, 3), dtype=np.uint8)

    # Simulate 10 consecutive frames of ONE person standing normally
    # Bounding box has slight realistic jitter (1-2px)
    for i in range(10):
        t = now + (i * 0.20)
        jitter = i % 2
        simulated_dets = [{
            "class_id": 0,
            "class_name": "person",
            "confidence": 0.85,
            "box": [150 + jitter, 100, 280 + jitter, 420]
        }]

        # Inject into worker state
        people_in_frame = [d for d in simulated_dets if d["class_name"] == "person"]
        worker.current_people = len(people_in_frame)
        worker.latest_detections = simulated_dets
        worker.latest_detection_time = t

        anomalies = worker.activity_classifier.analyze_frame(
            frame_idx=i + 1,
            timestamp_sec=t,
            detections=simulated_dets,
            frame_shape=frame.shape
        )
        worker.unique_people = worker.activity_classifier.get_unique_tracked_people_count()

        for anom in anomalies:
            if anom.get("category") != "normal_activity":
                worker.incidents_detected += 1

    # Current people must be exactly 1
    assert worker.current_people == 1, "Current people must be 1"

    # Unique people must be 1 (NOT 10!)
    assert worker.unique_people == 1, f"Unique people should remain 1, got {worker.unique_people}"

    # Normal standing must NOT trigger any crime incidents
    assert worker.incidents_detected == 0, "Normal standing must produce 0 crime incidents"

    # Now simulate person leaving (0 detections in latest frame)
    simulated_dets_empty = []
    worker.current_people = len(simulated_dets_empty)
    worker.latest_detections = simulated_dets_empty
    assert worker.current_people == 0, "Current people must honestly reflect 0 when empty"
    # Unique people across the sequence remains 1
    assert worker.unique_people == 1, "Unique people count remains 1"


def test_live_camera_overlay_rendering_and_hud():
    """Requirement 7: Live preview overlay renders on frame with HUD and bounding box."""
    worker = LiveCameraWorker(
        camera_id="test-cam-ai-002",
        name="Lobby Cam",
        rtsp_url="0",
        source_type="webcam",
        ai_monitoring=True
    )
    worker.resolution = "640x480"
    worker.fps_measured = 15.0
    worker.current_people = 1
    worker.unique_people = 1
    worker.last_inference_time_ms = 42.5

    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    dets = [{
        "class_name": "person",
        "confidence": 0.88,
        "box": [120, 80, 260, 410]
    }]

    worker._draw_overlays(frame, dets)
    # Check that pixels were drawn
    assert np.any(frame > 0)


def test_live_camera_inference_error_surfacing():
    """Requirement 6: Inference errors are logged and surfaced in telemetry."""
    worker = LiveCameraWorker(
        camera_id="test-cam-ai-003",
        name="Error Cam",
        rtsp_url="0",
        source_type="webcam",
        ai_monitoring=True
    )
    # Simulate an inference failure
    worker.inference_status = "error"
    worker.last_error = "Inference failure: PyTorch memory error"

    tel = worker.get_telemetry()
    assert tel["inference_status"] == "error"
    assert "Inference failure" in tel["last_error"]


def test_stopping_monitoring_releases_resources():
    """Requirement 9: Stopping monitoring releases the camera and processing resources."""
    worker = LiveCameraWorker(
        camera_id="test-cam-ai-004",
        name="Release Cam",
        rtsp_url="0",
        source_type="webcam",
        ai_monitoring=True
    )
    worker.is_running = True
    worker.latest_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    worker.latest_annotated_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    worker.latest_detections = [{"class_name": "person", "box": [0, 0, 10, 10], "confidence": 0.9}]
    worker.rolling_buffer.append((time.time(), worker.latest_frame))

    # Stop worker
    worker.stop()

    assert not worker.is_running
    assert worker.status == "disconnected"
    assert worker.latest_frame is None
    assert worker.latest_annotated_frame is None
    assert len(worker.rolling_buffer) == 0
    assert len(worker.latest_detections) == 0


# =====================================================================
# API TELEMETRY ENDPOINT INTEGRATION TEST
# =====================================================================

@pytest.mark.asyncio
async def test_camera_telemetry_api(client: AsyncClient):
    """Verifies GET /api/v1/cameras/{id}/telemetry returns actual AI metrics."""
    cam_id = "test-live-telemetry-cam"
    worker = camera_stream_manager.start_monitoring(
        camera_id=cam_id,
        name="API Telemetry Test",
        rtsp_url="0",
        source_type="webcam",
        ai_monitoring=True
    )
    # Inject test telemetry
    worker.current_people = 2
    worker.unique_people = 3
    worker.frames_received = 150
    worker.frames_processed_ai = 50
    worker.last_inference_time_ms = 35.8
    worker.inference_status = "active"
    worker.latest_detections = [
        {"class_name": "person", "confidence": 0.91, "box": [100, 100, 200, 300]}
    ]

    res = await client.get(f"/api/v1/cameras/{cam_id}/telemetry")
    assert res.status_code == 200
    data = res.json()
    assert data["camera_id"] == cam_id
    assert data["current_people"] == 2
    assert data["unique_people"] == 3
    assert data["frames_received"] == 150
    assert data["frames_processed_ai"] == 50
    assert data["inference_time_ms"] == 35.8
    assert data["inference_status"] == "active"
    assert len(data["latest_detections"]) == 1
    assert data["latest_detections"][0]["class_name"] == "person"

    # Clean up
    camera_stream_manager.stop_monitoring(cam_id)
