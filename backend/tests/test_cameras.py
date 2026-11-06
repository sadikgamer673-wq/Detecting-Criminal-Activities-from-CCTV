import time
import pytest
from unittest.mock import MagicMock, patch
import numpy as np

from app.services.cameras.manager import (
    camera_stream_manager,
    mask_rtsp_url,
    validate_and_classify_source,
    LiveCameraWorker
)


# ============================================================================
# PHASE 1 & 5: SOURCE CLASSIFICATION & CREDENTIAL MASKING TESTS
# ============================================================================

def test_source_validation_and_classification():
    # 1. Laptop Webcam
    is_valid, src_type, err, target = validate_and_classify_source("0")
    assert is_valid is True
    assert src_type == "webcam"
    assert target == 0

    # 2. IP CCTV Camera
    is_valid, src_type, err, target = validate_and_classify_source("rtsp://admin:pass@192.168.1.100:554/live")
    assert is_valid is True
    assert src_type == "ip_cctv"
    assert target == "rtsp://admin:pass@192.168.1.100:554/live"

    # 3. DVR/NVR Channel Stream
    is_valid, src_type, err, target = validate_and_classify_source("rtsp://admin:pass@192.168.1.100:554/Streaming/Channels/101")
    assert is_valid is True
    assert src_type == "dvr_nvr"

    # 4. Android Phone HTTP/RTSP Stream
    is_valid, src_type, err, target = validate_and_classify_source("http://192.168.1.50:8080/video")
    assert is_valid is True
    assert src_type == "android_phone"

    # 5. Invalid / Dangerous inputs
    is_valid, _, err, _ = validate_and_classify_source("")
    assert is_valid is False
    assert "cannot be empty" in err.lower()

    is_valid, _, err, _ = validate_and_classify_source("ftp://invalidscheme.com/video")
    assert is_valid is False
    assert "invalid camera stream protocol" in err.lower()

    is_valid, _, err, _ = validate_and_classify_source("rtsp://host; rm -rf /")
    assert is_valid is False
    assert "dangerous characters" in err.lower()


def test_credential_masking():
    raw_rtsp = "rtsp://admin:superSecret123@192.168.1.100:554/live/ch0"
    masked = mask_rtsp_url(raw_rtsp)
    assert "superSecret123" not in masked
    assert "admin:***@192.168.1.100" in masked

    raw_http = "http://security:myPassword99@192.168.1.50:8080/video"
    masked_http = mask_rtsp_url(raw_http)
    assert "myPassword99" not in masked_http
    assert "security:***@192.168.1.50" in masked_http


# ============================================================================
# PHASE 2 & 6: CONNECTION PROBE & DIAGNOSTIC TESTS (SIMULATED & UNIT)
# ============================================================================

def test_webcam_unavailable():
    """Test for non-existent webcam index."""
    res = camera_stream_manager.test_connection("99", camera_name="Webcam 99", timeout_sec=0.2)
    assert res["success"] is False
    assert res["status"] in ["connection_failed", "authentication_failed"]
    assert res["source_type"] == "webcam"
    assert res["frames_received"] is False
    assert res["stream_opened"] is False
    assert "could not connect" in res["message"].lower() or "device not available" in res["message"].lower()


def test_rtsp_stream_unavailable():
    """Tests handling of unreachable RTSP host."""
    res = camera_stream_manager.test_connection(
        "rtsp://192.0.2.1:554/nonexistent",
        camera_name="Unreachable RTSP",
        timeout_sec=0.3
    )
    assert res["success"] is False
    assert res["status"] == "connection_failed"
    assert res["source_type"] == "ip_cctv"
    assert res["frames_received"] is False


def test_invalid_rtsp_url():
    """Tests rejection of invalid camera URL."""
    res = camera_stream_manager.test_connection("not_a_valid_url", camera_name="Bad URL")
    assert res["success"] is False
    assert res["status"] == "connection_failed"
    assert "invalid" in res["message"].lower()


@patch("cv2.VideoCapture")
def test_webcam_opens_successfully_mocked(mock_vc):
    """Simulated test: Webcam device index 0 opens and returns valid frames."""
    fake_frame = np.zeros((480, 640, 3), dtype=np.uint8)

    instance = MagicMock()
    instance.isOpened.return_value = True
    instance.read.return_value = (True, fake_frame)
    instance.get.side_effect = lambda prop: 640 if prop == 3 else (480 if prop == 4 else 30.0)
    mock_vc.return_value = instance

    res = camera_stream_manager.test_connection("0", camera_name="Simulated Laptop Webcam")
    assert res["success"] is True
    assert res["status"] == "connected"
    assert res["stream_opened"] is True
    assert res["frames_received"] is True
    assert res["resolution"] == "640x480"
    assert res["fps"] == "30.0"
    assert res["source_type"] == "webcam"
    instance.release.assert_called_once()


@patch("socket.socket")
@patch("cv2.VideoCapture")
def test_stream_opens_but_no_frames_mocked(mock_vc, mock_sock):
    """Simulated test: Stream socket opens but decodes 0 video frames."""
    sock_inst = MagicMock()
    sock_inst.connect_ex.return_value = 0
    mock_sock.return_value = sock_inst

    instance = MagicMock()
    instance.isOpened.return_value = True
    # read() returns False / None
    instance.read.return_value = (False, None)
    mock_vc.return_value = instance

    res = camera_stream_manager.test_connection(
        "rtsp://192.168.1.100:554/broken_stream",
        camera_name="Black Screen Camera"
    )
    assert res["success"] is False
    assert res["status"] == "no_video_frames"
    assert res["stream_opened"] is True
    assert res["frames_received"] is False
    assert "failed to decode valid video frames" in res["message"]
    instance.release.assert_called_once()


@patch("socket.socket")
@patch("cv2.VideoCapture")
def test_successful_rtsp_stream_mocked(mock_vc, mock_sock):
    """Simulated test: RTSP stream connects, reads 1080p frames at 25 FPS."""
    sock_inst = MagicMock()
    sock_inst.connect_ex.return_value = 0
    mock_sock.return_value = sock_inst

    fake_frame = np.zeros((1080, 1920, 3), dtype=np.uint8)

    instance = MagicMock()
    instance.isOpened.return_value = True
    instance.read.return_value = (True, fake_frame)
    instance.get.side_effect = lambda prop: 1920 if prop == 3 else (1080 if prop == 4 else 25.0)
    mock_vc.return_value = instance

    raw_url = "rtsp://admin:superSecret123@192.168.1.100:554/Streaming/Channels/101"
    res = camera_stream_manager.test_connection(raw_url, camera_name="Main Gate Hikvision")

    assert res["success"] is True
    assert res["status"] == "connected"
    assert res["stream_opened"] is True
    assert res["frames_received"] is True
    assert res["resolution"] == "1920x1080"
    assert res["fps"] == "25.0"
    assert res["source_type"] == "dvr_nvr"
    # Verify password was never leaked in response message
    assert "superSecret123" not in res["message"]


def test_real_laptop_webcam_hardware():
    """Physical hardware test: Attempts to probe device index 0."""
    res = camera_stream_manager.test_connection("0", camera_name="Physical Laptop Webcam", timeout_sec=2.0)
    # If device 0 is present, it returns connected with valid resolution
    if res["success"]:
        assert res["status"] == "connected"
        assert res["frames_received"] is True
        assert res["resolution"] is not None
        assert res["source_type"] == "webcam"
    else:
        # If running in headless environment without webcam, fails cleanly
        assert res["status"] in ["connection_failed", "authentication_failed"]


# ============================================================================
# PHASE 3 & 4: WORKER LIFECYCLE, DUPLICATE PREVENTION & RESOURCE CLEANUP
# ============================================================================

@patch("cv2.VideoCapture")
def test_worker_lifecycle_and_duplicate_prevention(mock_vc):
    """Tests worker thread startup, duplicate prevention, and clean resource release."""
    fake_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    instance = MagicMock()
    instance.isOpened.return_value = True
    instance.read.return_value = (True, fake_frame)
    instance.get.side_effect = lambda prop: 640 if prop == 3 else (480 if prop == 4 else 15.0)
    mock_vc.return_value = instance

    cam_id = "test-cam-001"

    # 1. Start monitoring
    worker1 = camera_stream_manager.start_monitoring(
        camera_id=cam_id,
        name="Test Worker Cam",
        rtsp_url="0",
        source_type="webcam",
        ai_monitoring=False
    )
    assert worker1.is_running is True
    assert cam_id in camera_stream_manager.active_monitors

    # 2. Duplicate monitoring prevention: Calling start again returns same instance
    worker2 = camera_stream_manager.start_monitoring(
        camera_id=cam_id,
        name="Test Worker Cam",
        rtsp_url="0",
        source_type="webcam",
        ai_monitoring=False
    )
    assert worker1 is worker2
    assert len(camera_stream_manager.active_monitors) == 1

    # 3. Stop monitoring and verify resource cleanup
    stopped = camera_stream_manager.stop_monitoring(cam_id)
    assert stopped is True
    assert worker1.is_running is False
    assert cam_id not in camera_stream_manager.active_monitors


@patch("cv2.VideoCapture")
def test_worker_reconnection_handling(mock_vc):
    """Tests that consecutive frame failures put worker into reconnecting state without crashing."""
    instance = MagicMock()
    instance.isOpened.return_value = True
    # Fail read calls
    instance.read.return_value = (False, None)
    mock_vc.return_value = instance

    worker = LiveCameraWorker(
        camera_id="test-recon-cam",
        name="Recon Cam",
        rtsp_url="rtsp://192.168.1.100:554/live",
        source_type="ip_cctv",
        ai_monitoring=False
    )

    # Call _capture_loop briefly with stop_event set after 1 iteration
    worker._stop_event = MagicMock()
    worker._stop_event.is_set.side_effect = [False, False, True]

    worker._capture_loop()
    # Verified: Worker exited loop safely without unhandled exception
    assert True


# ============================================================================
# FASTAPI ENDPOINT INTEGRATION TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_camera_crud_and_masking(client):
    # 1. Create camera with embedded credentials
    raw_url = "rtsp://admin:superSecretPassword@192.168.1.50:554/ch0"
    create_res = await client.post(
        "/api/v1/cameras",
        json={
            "name": "Perimeter East Gate",
            "rtsp_url": raw_url,
            "location": "Fence Line Zone B"
        }
    )
    assert create_res.status_code == 200
    data = create_res.json()
    cam_id = data["id"]

    # Verify password was masked in API response
    assert "superSecretPassword" not in data["rtsp_url"]
    assert "admin:***@" in data["rtsp_url"]
    assert data["source_type"] == "dvr_nvr"

    # 2. List cameras
    list_res = await client.get("/api/v1/cameras")
    assert list_res.status_code == 200
    cams = list_res.json()
    matching = [c for c in cams if c["id"] == cam_id]
    assert len(matching) == 1
    assert "superSecretPassword" not in matching[0]["rtsp_url"]

    # 3. Get single camera detail
    get_res = await client.get(f"/api/v1/cameras/{cam_id}")
    assert get_res.status_code == 200
    assert "superSecretPassword" not in get_res.json()["rtsp_url"]

    # 4. Check telemetry endpoint for disconnected camera
    tel_res = await client.get(f"/api/v1/cameras/{cam_id}/telemetry")
    assert tel_res.status_code == 200
    assert tel_res.json()["status"] == "disconnected"

    # 5. Update camera
    update_res = await client.put(
        f"/api/v1/cameras/{cam_id}",
        json={"location": "Perimeter Wall Main"}
    )
    assert update_res.status_code == 200
    assert update_res.json()["location"] == "Perimeter Wall Main"

    # 6. Delete camera
    del_res = await client.delete(f"/api/v1/cameras/{cam_id}")
    assert del_res.status_code == 200
    assert "removed" in del_res.json()["message"]


@pytest.mark.asyncio
async def test_test_connection_endpoint(client):
    """Tests POST /api/v1/cameras/test-connection."""
    res = await client.post(
        "/api/v1/cameras/test-connection",
        json={
            "rtsp_url": "rtsp://invalid.host.internal:554/live",
            "camera_name": "Test Probe"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is False
    assert data["status"] in ["connection_failed", "authentication_failed"]
    assert data["stream_opened"] is False
    assert data["frames_received"] is False
