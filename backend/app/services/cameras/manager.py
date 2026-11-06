import re
import time
import logging
import asyncio
import threading
from collections import deque
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple, List
from pathlib import Path
import cv2
import numpy as np

from app.core.config import settings

logger = logging.getLogger("cctv_system.cameras")


def mask_rtsp_url(url: str) -> str:
    """Masks credentials in RTSP/HTTP URLs like rtsp://user:password@ip:port to prevent leakage."""
    if not url:
        return ""
    return re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", str(url))


def validate_and_classify_source(source: str) -> Tuple[bool, str, str, Any]:
    """
    Validates camera source string.
    Returns: (is_valid: bool, source_type: str, error_message: str, parsed_target: Any)
    source_type is one of: 'webcam', 'ip_cctv', 'dvr_nvr', 'android_phone'
    """
    cleaned = str(source).strip()
    if not cleaned:
        return False, "unknown", "Camera source endpoint cannot be empty", None

    # Check for dangerous characters or command injections
    if any(ch in cleaned for ch in [";", "|", "&", "`", "$", "\n", "\r"]):
        return False, "unknown", "Dangerous characters detected in camera source parameter", None

    # Check if integer webcam device index (e.g. 0, 1, 2)
    if cleaned.isdigit():
        idx = int(cleaned)
        if idx < 0 or idx > 99:
            return False, "webcam", "Webcam device index out of reasonable range (0-99)", None
        return True, "webcam", "", idx

    lower = cleaned.lower()
    # Validate protocol scheme
    if not (lower.startswith("rtsp://") or lower.startswith("rtsps://") or lower.startswith("http://") or lower.startswith("https://")):
        return False, "unknown", (
            "Invalid camera stream protocol. Must be an integer device index (e.g. 0) or start with "
            "rtsp://, rtsps://, http://, or https://"
        ), None

    # Classify source type based on URL structure
    if lower.startswith("http://") or lower.startswith("https://"):
        source_type = "android_phone"
    elif any(k in lower for k in ["/streaming/channels/", "/cam/realmonitor", "/ch0", "/channel=", "/trackid="]):
        source_type = "dvr_nvr"
    else:
        source_type = "ip_cctv"

    return True, source_type, "", cleaned


class LiveCameraWorker:
    """
    Background worker that ingests video frames from a live RTSP stream, webcam,
    or phone feed. Manages rolling buffer, non-blocking capture, automatic reconnection,
    MJPEG preview encoding, and real-time AI object detection + activity classification.
    """
    def __init__(
        self,
        camera_id: str,
        name: str,
        rtsp_url: str,
        source_type: str = "ip_cctv",
        ai_monitoring: bool = True,
        event_loop: Optional[asyncio.AbstractEventLoop] = None
    ):
        self.camera_id = camera_id
        self.name = name
        self.rtsp_url = rtsp_url
        self.source_type = source_type
        self.ai_monitoring = ai_monitoring
        self.event_loop = event_loop

        # Lifecycle & State
        self.is_running = False
        self.status = "connecting"  # connecting, connected, monitoring, reconnecting, disconnected, error
        self.last_error: Optional[str] = None
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

        # Frame buffers
        # Holds (timestamp_sec, frame) for ~10 seconds at 15 FPS
        self.rolling_buffer: deque = deque(maxlen=150)
        self.latest_frame: Optional[np.ndarray] = None
        self.latest_annotated_frame: Optional[np.ndarray] = None
        self.latest_jpeg: Optional[bytes] = None
        self.latest_frame_time: Optional[float] = None
        self.lock = threading.Lock()

        # Telemetry & Diagnostics
        self.frames_received = 0
        self.frames_processed_ai = 0
        self.fps_measured = 0.0
        self.resolution = "Unknown"
        self.unique_people = 0
        self.current_people = 0
        self.incidents_detected = 0
        self.started_at: Optional[float] = None
        self.last_inference_time_ms: float = 0.0
        self.inference_status: str = "disabled" if not ai_monitoring else "idle"
        self.latest_detections: List[Dict[str, Any]] = []
        self.latest_detection_time: float = 0.0
        self.weapons_detected: int = 0
        self.active_weapons: List[Dict[str, Any]] = []
        self.latest_weapon_alert: Optional[str] = None

        # Lazy AI components (initialized if ai_monitoring is active)
        self.detector = None
        self.weapon_detector = None
        self.activity_classifier = None
        self.weapon_tracker = None

    def start(self):
        """Starts background capture loop in a daemon thread."""
        if self.is_running:
            logger.warning(f"Worker for camera {self.camera_id} is already running.")
            return

        self._stop_event.clear()
        self.is_running = True
        self.started_at = time.time()
        self.status = "monitoring" if self.ai_monitoring else "connected"

        if self.ai_monitoring:
            try:
                from app.services.detection.detector import detector, weapon_detector
                from app.services.detection.weapon_tracker import TemporalWeaponTracker
                from app.services.detection.activity import TemporalMotionActivityClassifier
                self.detector = detector
                self.weapon_detector = weapon_detector
                # Pre-warm/load model weights on CPU
                self.detector.load_model()
                self.weapon_detector.load_model()
                self.activity_classifier = TemporalMotionActivityClassifier()
                self.weapon_tracker = TemporalWeaponTracker(
                    min_confirmation_frames=settings.WEAPON_CONSECUTIVE_FRAMES,
                    min_confidence=settings.WEAPON_CONFIDENCE_THRESHOLD
                )
                self.inference_status = "active"
                logger.info(f"AI monitoring pipeline initialized for camera {self.camera_id} (Dual YOLOv8n CPU: People + Weapons)")
            except Exception as e:
                self.inference_status = "error"
                self.last_error = f"Failed to initialize AI detector: {e}"
                logger.error(f"Failed to initialize AI detector for camera {self.camera_id}: {e}")

        self._thread = threading.Thread(target=self._capture_loop, name=f"CamWorker-{self.camera_id[:8]}", daemon=True)
        self._thread.start()
        logger.info(f"Started live capture worker thread for camera {self.camera_id} ({self.name})")

    def stop(self):
        """Signals worker to stop, waits for thread exit, and releases resources."""
        self._stop_event.set()
        self.is_running = False
        self.status = "disconnected"

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)
            self._thread = None

        with self.lock:
            self.rolling_buffer.clear()
            self.latest_frame = None
            self.latest_annotated_frame = None
            self.latest_detections.clear()

        logger.info(f"Stopped live capture worker for camera {self.camera_id}")

    def _open_capture(self) -> Optional[cv2.VideoCapture]:
        """Opens cv2.VideoCapture with appropriate timeouts and backends."""
        _, _, _, target = validate_and_classify_source(self.rtsp_url)
        if target is None:
            return None

        if isinstance(target, int):
            cap = cv2.VideoCapture(target, cv2.CAP_DSHOW)
        else:
            cap = cv2.VideoCapture(target)

        try:
            cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 3000)
            cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 3000)
        except Exception:
            pass

        if not cap.isOpened():
            cap.release()
            return None
        return cap

    def _capture_loop(self):
        """Continuous non-blocking frame ingestion, reconnection, and AI monitoring."""
        cap: Optional[cv2.VideoCapture] = None
        consecutive_errors = 0
        reconnect_delay = 2.0
        frame_idx = 0
        last_ai_time = 0.0
        ai_interval = 1.0 / max(1, settings.SAMPLING_RATE_FPS)  # e.g., ~0.20s for 5 FPS

        fps_timer = time.time()
        fps_counter = 0

        while not self._stop_event.is_set():
            # 1. Ensure camera stream is opened
            if cap is None or not cap.isOpened():
                self.status = "reconnecting" if consecutive_errors > 0 else "connecting"
                cap = self._open_capture()
                if cap is None or not cap.isOpened():
                    consecutive_errors += 1
                    self.last_error = f"Failed to connect to camera source. Retrying in {reconnect_delay:.1f}s..."
                    time.sleep(reconnect_delay)
                    reconnect_delay = min(10.0, reconnect_delay * 1.5)
                    continue

                # Successfully opened
                consecutive_errors = 0
                reconnect_delay = 2.0
                self.status = "monitoring" if self.ai_monitoring else "connected"
                self.last_error = None
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                self.resolution = f"{width}x{height}" if width > 0 else "Unknown"
                logger.info(f"Camera {self.camera_id} connected ({self.resolution})")

            # 2. Read frame
            ret, frame = cap.read()
            if not ret or frame is None:
                consecutive_errors += 1
                logger.warning(f"Frame read failure on camera {self.camera_id} (failure #{consecutive_errors})")
                if consecutive_errors >= 5:
                    self.status = "reconnecting"
                    self.last_error = "Connection lost. Video frames stopped arriving. Attempting reconnection..."
                    if cap is not None:
                        cap.release()
                        cap = None
                    time.sleep(1.0)
                else:
                    time.sleep(0.05)
                continue

            # Frame read succeeded
            consecutive_errors = 0
            now = time.time()
            self.latest_frame_time = now
            self.frames_received += 1
            frame_idx += 1
            fps_counter += 1

            # Measure frame rate every 1 second
            if now - fps_timer >= 1.0:
                self.fps_measured = round(fps_counter / (now - fps_timer), 1)
                fps_counter = 0
                fps_timer = now

            # Store in rolling buffer
            with self.lock:
                self.rolling_buffer.append((now, frame.copy()))
                self.latest_frame = frame

            # 3. AI Inference (Sampled at settings.SAMPLING_RATE_FPS to keep CPU utilization optimal)
            ai_interval = 1.0 / max(1, settings.SAMPLING_RATE_FPS)
            if self.ai_monitoring and self.detector and (now - last_ai_time >= ai_interval):
                last_ai_time = now
                self.frames_processed_ai += 1
                t0 = time.perf_counter()

                try:
                    # Run lightweight YOLOv8n object detection on CPU
                    detections = self.detector.detect(
                        frame,
                        confidence=settings.CONFIDENCE_THRESHOLD
                    )

                    people_in_frame = [
                        d for d in detections 
                        if (d.get("class_name") if isinstance(d, dict) else getattr(d, "class_name", "")).lower() == "person"
                    ]
                    person_boxes = [
                        (p.get("box") if isinstance(p, dict) else getattr(p, "box", []))
                        for p in people_in_frame
                    ]
                    self.current_people = len(people_in_frame)

                    # Run specialized AI weapon detection on CPU with geometric sanity & person context
                    weapon_dets = []
                    if self.weapon_detector:
                        try:
                            weapon_dets = self.weapon_detector.detect(
                                frame,
                                confidence=settings.WEAPON_CONFIDENCE_THRESHOLD,
                                person_boxes=person_boxes
                            )
                        except Exception as w_err:
                            logger.warning(f"Live weapon detection error on camera {self.camera_id}: {w_err}")

                    self.last_inference_time_ms = round((time.perf_counter() - t0) * 1000, 1)
                    self.inference_status = "active"

                    # Combine for visualization
                    all_detections = detections + weapon_dets

                    with self.lock:
                        self.latest_detections = all_detections
                        self.latest_detection_time = now

                    # Update temporal motion activity classifier for people
                    if self.activity_classifier:
                        anomalies = self.activity_classifier.analyze_frame(
                            frame_idx=frame_idx,
                            timestamp_sec=now,
                            detections=detections,
                            frame_shape=frame.shape
                        )
                        self.unique_people = self.activity_classifier.get_unique_tracked_people_count()

                        # Check for weapon detections from COCO detector (knife, baseball bat, scissors)
                        from app.services.detection.detector import WeaponDetector
                        coco_weapon_dets = [
                            d for d in detections 
                            if (d.get("class_name") if isinstance(d, dict) else getattr(d, "class_name", "")).lower() in ["knife", "scissors", "baseball bat"]
                        ]
                        for wd in coco_weapon_dets:
                            wd_box = wd.get("box") if isinstance(wd, dict) else getattr(wd, "box", [])
                            wd_name = wd.get("class_name") if isinstance(wd, dict) else getattr(wd, "class_name", "weapon")
                            wd_conf = wd.get("confidence", 0.5) if isinstance(wd, dict) else getattr(wd, "confidence", 0.5)

                            is_valid, reason = WeaponDetector.is_plausible_weapon_geometry(
                                box=wd_box,
                                frame_shape=frame.shape,
                                class_name=wd_name,
                                person_boxes=person_boxes
                            )
                            if not is_valid:
                                logger.debug(f"Live camera {self.camera_id} filtered COCO {wd_name} false positive: {reason}")
                                continue
                            if wd_conf < settings.WEAPON_CONFIDENCE_THRESHOLD:
                                continue

                            anomalies.append({
                                "category": f"potential_weapon_{wd_name.lower().replace(' ', '_')}",
                                "confidence": round(min(0.68, wd_conf), 4),
                                "notes": f"Potential {wd_name} object detected (Model confidence: {wd_conf:.2f}). Requires visual verification.",
                                "frame_idx": frame_idx
                            })

                        # Handle triggered activity incidents
                        for anom in anomalies:
                            cat = anom.get("category", "")
                            if cat == "normal_activity":
                                continue
                            self.incidents_detected += 1
                            conf = anom.get("confidence", 0.5)
                            logger.info(f"Live camera {self.camera_id} triggered activity incident: {cat} (conf={conf:.2f})")

                            # Capture snapshot of rolling buffer for evidence extraction
                            with self.lock:
                                buffer_snapshot = list(self.rolling_buffer)

                            # Dispatch incident creation to async database loop
                            self._dispatch_incident_save(
                                category=cat,
                                confidence=conf,
                                timestamp_sec=now,
                                buffered_frames=buffer_snapshot
                            )

                    # Process dedicated weapon tracker with multi-frame confirmation
                    if self.weapon_tracker:
                        confirmed_weps, active_summary = self.weapon_tracker.process_frame(
                            weapon_detections=weapon_dets,
                            timestamp_sec=now,
                            frame_idx=frame_idx
                        )
                        self.active_weapons = active_summary
                        if active_summary:
                            self.latest_weapon_alert = f"Active: {active_summary[0]['class_name']} ({int(active_summary[0]['confidence']*100)}%)"
                        elif now - self.latest_detection_time > 3.0:
                            self.latest_weapon_alert = None

                        for wep_event in confirmed_weps:
                            self.weapons_detected += 1
                            self.incidents_detected += 1
                            w_cat = wep_event.get("category", "potential_weapon")
                            w_conf = wep_event.get("confidence", 0.70)
                            logger.info(f"Live camera {self.camera_id} confirmed weapon incident: {w_cat} (conf={w_conf:.2f})")

                            with self.lock:
                                buffer_snapshot = list(self.rolling_buffer)

                            self._dispatch_incident_save(
                                category=w_cat,
                                confidence=w_conf,
                                timestamp_sec=now,
                                buffered_frames=buffer_snapshot
                            )

                    logger.debug(
                        f"Camera {self.camera_id} AI: {len(detections)} dets, {len(weapon_dets)} weapons, "
                        f"{self.current_people} current, {self.unique_people} unique, {self.last_inference_time_ms}ms"
                    )

                except Exception as e:
                    self.inference_status = "error"
                    self.last_error = f"AI inference error: {e}"
                    logger.error(f"Error during live AI inference on camera {self.camera_id}: {e}")

            # 4. Draw overlays on every displayed frame for smooth, non-flickering preview
            annotated_frame = frame.copy()
            if self.ai_monitoring:
                with self.lock:
                    # Persist detections between sampling intervals (within 1.0 second)
                    active_dets = list(self.latest_detections) if (now - self.latest_detection_time <= 1.0) else []
                self._draw_overlays(annotated_frame, active_dets)

            # 5. Encode JPEG for live preview stream
            with self.lock:
                self.latest_annotated_frame = annotated_frame
                try:
                    # Encode preview frame (resize if large to preserve browser bandwidth)
                    prev_w, prev_h = annotated_frame.shape[1], annotated_frame.shape[0]
                    if prev_w > 960:
                        prev_display = cv2.resize(annotated_frame, (960, int(prev_h * (960.0 / prev_w))))
                    else:
                        prev_display = annotated_frame

                    ret_enc, jpeg_buf = cv2.imencode(".jpg", prev_display, [cv2.IMWRITE_JPEG_QUALITY, 70])
                    if ret_enc:
                        self.latest_jpeg = jpeg_buf.tobytes()
                except Exception as e:
                    logger.debug(f"Preview encode error: {e}")

            # Throttle capture loop slightly if needed (prevent 100% core spin on fast webcams)
            time.sleep(0.01)

        # Cleanup when stop_event is set
        if cap is not None:
            cap.release()
            logger.info(f"Released video capture for camera {self.camera_id}")

    def _draw_overlays(self, frame: np.ndarray, detections: list):
        """Draws bounding boxes, labels, and system status on the preview frame."""
        h, w = frame.shape[:2]

        # Draw detections
        for det in detections:
            box = det.get("box", [0, 0, 0, 0]) if isinstance(det, dict) else getattr(det, "box", [0, 0, 0, 0])
            if max(box) <= 1.05:
                x1 = int(box[0] * w)
                y1 = int(box[1] * h)
                x2 = int(box[2] * w)
                y2 = int(box[3] * h)
            else:
                x1, y1, x2, y2 = [int(v) for v in box]

            x1 = max(0, min(w - 1, x1))
            y1 = max(0, min(h - 1, y1))
            x2 = max(0, min(w - 1, x2))
            y2 = max(0, min(h - 1, y2))

            cls_name = det.get("class_name", "") if isinstance(det, dict) else getattr(det, "class_name", "")
            conf = det.get("confidence", 0.0) if isinstance(det, dict) else getattr(det, "confidence", 0.0)
            is_weapon = det.get("is_weapon", False) if isinstance(det, dict) else getattr(det, "is_weapon", False)

            is_person = cls_name.lower() == "person"
            if not is_weapon:
                is_weapon = cls_name.lower() in ["knife", "scissors", "baseball bat", "gun", "pistol", "rifle", "grenade", "explosion"]

            if is_weapon:
                color = (0, 69, 255)  # Vivid Red-Orange for weapon threats
                label = f"WEAPON: {cls_name.upper()} {int(conf * 100)}%"
            elif is_person:
                color = (0, 255, 127)  # Emerald Green for person
                label = f"Person {int(conf * 100)}%"
            else:
                color = (200, 200, 200)
                label = f"{cls_name.capitalize()} {int(conf * 100)}%"

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            t_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)[0]
            label_y = max(y1, t_size[1] + 4)
            cv2.rectangle(frame, (x1, label_y - t_size[1] - 4), (x1 + t_size[0] + 6, label_y), color, -1)
            cv2.putText(frame, label, (x1 + 3, label_y - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)

        # Draw active weapon banner alert on top-right if a weapon is active
        if self.active_weapons:
            top_wep = self.active_weapons[0]
            wep_banner = f" [!] WEAPON DETECTED: {top_wep['class_name'].upper()} ({int(top_wep['confidence']*100)}%) - VERIFY "
            b_size = cv2.getTextSize(wep_banner, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)[0]
            bx2 = w - 10
            bx1 = max(10, bx2 - b_size[0] - 12)
            cv2.rectangle(frame, (bx1, 8), (bx2, 28), (0, 40, 200), -1)
            cv2.rectangle(frame, (bx1, 8), (bx2, 28), (0, 69, 255), 1)
            cv2.putText(frame, wep_banner, (bx1 + 6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)

        # Draw HUD status banner in top-left
        hud_text = f"CAM: {self.name[:16]} | {self.resolution} @ {self.fps_measured} FPS | CURRENT: {self.current_people} | UNIQUE: {self.unique_people} | WEAPONS: {self.weapons_detected}"
        if self.last_inference_time_ms > 0:
            hud_text += f" | AI: {self.last_inference_time_ms}ms"
        t_w = len(hud_text) * 7 + 16
        cv2.rectangle(frame, (8, 8), (8 + t_w, 28), (20, 24, 33), -1)
        cv2.rectangle(frame, (8, 8), (8 + t_w, 28), (50, 60, 75), 1)
        cv2.putText(frame, hud_text, (14, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 255, 127), 1, cv2.LINE_AA)

    def _dispatch_incident_save(
        self,
        category: str,
        confidence: float,
        timestamp_sec: float,
        buffered_frames: list
    ):
        """Dispatches asynchronous incident persistence and clip extraction."""
        async def _save():
            try:
                from app.database.session import AsyncSessionLocal
                from app.services.incidents.detector import incident_manager
                from app.main import ws_manager

                async with AsyncSessionLocal() as session:
                    incident = await incident_manager.register_event(
                        db=session,
                        source_type="camera",
                        source_id=self.camera_id,
                        category=category,
                        confidence=confidence,
                        timestamp_sec=timestamp_sec,
                        frame_idx=0,
                        buffered_frames=buffered_frames
                    )
                    if incident:
                        await ws_manager.broadcast({
                            "type": "new_incident",
                            "incident": {
                                "id": incident.id,
                                "source_type": "camera",
                                "source_id": self.camera_id,
                                "camera_name": self.name,
                                "category": incident.category,
                                "confidence": incident.confidence,
                                "timestamp_start": incident.timestamp_start,
                                "timestamp_end": incident.timestamp_end,
                                "review_status": incident.review_status
                            }
                        })
            except Exception as ex:
                logger.error(f"Failed to persist live incident for camera {self.camera_id}: {ex}")

        # Execute on main event loop or background thread
        if self.event_loop and self.event_loop.is_running():
            asyncio.run_coroutine_threadsafe(_save(), self.event_loop)
        else:
            threading.Thread(target=lambda: asyncio.run(_save()), daemon=True).start()

    def gen_mjpeg(self):
        """Generator yielding MJPEG multipart chunks for live browser streaming."""
        while not self._stop_event.is_set():
            with self.lock:
                jpeg = self.latest_jpeg

            if jpeg is not None:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
                )
            # ~15 FPS transmission rate
            time.sleep(0.066)

    def get_snapshot(self) -> Optional[bytes]:
        """Returns latest JPEG snapshot bytes."""
        with self.lock:
            return self.latest_jpeg

    def get_telemetry(self) -> Dict[str, Any]:
        """Returns live diagnostic telemetry for API endpoints."""
        with self.lock:
            latest_dets_copy = [
                {
                    "class_name": d.get("class_name") if isinstance(d, dict) else getattr(d, "class_name", ""),
                    "confidence": d.get("confidence") if isinstance(d, dict) else getattr(d, "confidence", 0.0),
                    "box": d.get("box") if isinstance(d, dict) else getattr(d, "box", [])
                }
                for d in self.latest_detections[:10]
            ]

        return {
            "camera_id": self.camera_id,
            "name": self.name,
            "source_type": self.source_type,
            "status": self.status,
            "is_running": self.is_running,
            "ai_monitoring": self.ai_monitoring,
            "resolution": self.resolution,
            "fps": str(self.fps_measured),
            "frames_received": self.frames_received,
            "frames_processed_ai": self.frames_processed_ai,
            "unique_people": self.unique_people,
            "current_people": self.current_people,
            "incidents_detected": self.incidents_detected,
            "weapons_detected": self.weapons_detected,
            "active_weapons": self.active_weapons,
            "latest_weapon_alert": self.latest_weapon_alert,
            "last_frame_time": datetime.fromtimestamp(self.latest_frame_time, timezone.utc).isoformat() if self.latest_frame_time else None,
            "last_error": self.last_error,
            "uptime_seconds": int(time.time() - self.started_at) if self.started_at else 0,
            "inference_status": self.inference_status,
            "inference_time_ms": self.last_inference_time_ms,
            "latest_detections": latest_dets_copy
        }


class CameraStreamManager:
    """
    Manages camera lifecycle, connection verification, duplicate processing loop prevention,
    and background capture workers across all supported camera sources.
    """
    def __init__(self):
        self.active_monitors: Dict[str, LiveCameraWorker] = {}
        self.event_loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop):
        self.event_loop = loop

    def test_connection(
        self,
        source: str,
        camera_name: str = "Test Source",
        timeout_sec: float = 5.0
    ) -> Dict[str, Any]:
        """
        Tests connection to an RTSP camera stream, webcam device index, or HTTP phone feed.
        Verifies that actual video frames can be decoded, measures resolution & FPS.
        Always returns credentials masked. Never leaks passwords in error strings.
        """
        start_time = time.time()
        is_valid, source_type, val_err, parsed_target = validate_and_classify_source(source)

        if not is_valid or parsed_target is None:
            return {
                "camera_name": camera_name,
                "source_type": source_type,
                "status": "connection_failed",
                "stream_opened": False,
                "frames_received": False,
                "resolution": None,
                "fps": None,
                "last_frame_time": None,
                "latency_ms": 0,
                "error_message": mask_rtsp_url(val_err),
                "success": False,
                "message": val_err,
                "stream_info": None
            }

        masked_source = mask_rtsp_url(source)

        # For network streams (RTSP / HTTP), execute a fast socket preflight probe
        # to fail immediately if host is unreachable or port is closed, rather than hanging.
        if isinstance(parsed_target, str):
            try:
                import urllib.parse
                import socket
                parsed = urllib.parse.urlsplit(parsed_target)
                host = parsed.hostname
                port = parsed.port or (554 if "rtsp" in parsed.scheme else (443 if "https" in parsed.scheme else 80))
                if host:
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(min(1.5, timeout_sec))
                    conn_res = sock.connect_ex((host, port))
                    sock.close()
                    if conn_res != 0:
                        elapsed_ms = int((time.time() - start_time) * 1000)
                        is_auth_suspected = "@" in str(source) and (":" in str(source).split("@")[0])
                        status_code = "authentication_failed" if is_auth_suspected else "connection_failed"
                        error_msg = (
                            f"Could not connect to {source_type} at {masked_source} (network port {port} unreachable or timed out after {round(elapsed_ms / 1000, 1)}s). "
                            "Verify network connectivity, IP address, and credentials."
                        )
                        return {
                            "camera_name": camera_name,
                            "source_type": source_type,
                            "status": status_code,
                            "stream_opened": False,
                            "frames_received": False,
                            "resolution": None,
                            "fps": None,
                            "last_frame_time": None,
                            "latency_ms": elapsed_ms,
                            "error_message": error_msg,
                            "success": False,
                            "message": error_msg,
                            "stream_info": None
                        }
            except Exception:
                pass

        if isinstance(parsed_target, int):
            cap = cv2.VideoCapture(parsed_target, cv2.CAP_DSHOW)
        else:
            cap = cv2.VideoCapture(parsed_target)

        try:
            cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, int(timeout_sec * 1000))
            cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, int(timeout_sec * 1000))
        except Exception:
            pass

        if not cap.isOpened():
            elapsed_ms = int((time.time() - start_time) * 1000)
            is_auth_suspected = "@" in str(source) and (":" in str(source).split("@")[0])
            status_code = "authentication_failed" if is_auth_suspected else "connection_failed"
            error_msg = (
                f"Could not connect to {source_type} at {masked_source} (connection failed or device not available). "
                f"Verify camera device index or network stream endpoint."
            )
            return {
                "camera_name": camera_name,
                "source_type": source_type,
                "status": status_code,
                "stream_opened": False,
                "frames_received": False,
                "resolution": None,
                "fps": None,
                "last_frame_time": None,
                "latency_ms": elapsed_ms,
                "error_message": error_msg,
                "success": False,
                "message": error_msg,
                "stream_info": None
            }

        # Stream opened - now verify that actual video frames can be read and decoded!
        try:
            frames_read = 0
            for _ in range(3):
                ret, frame = cap.read()
                if ret and frame is not None and frame.size > 0:
                    frames_read += 1
                time.sleep(0.02)

            elapsed_ms = int((time.time() - start_time) * 1000)

            if frames_read == 0:
                error_msg = (
                    f"Stream opened at {masked_source}, but failed to decode valid video frames. "
                    "Verify camera video encoding format (H.264/MJPEG recommended) and sub-stream configuration."
                )
                return {
                    "camera_name": camera_name,
                    "source_type": source_type,
                    "status": "no_video_frames",
                    "stream_opened": True,
                    "frames_received": False,
                    "resolution": None,
                    "fps": None,
                    "last_frame_time": None,
                    "latency_ms": elapsed_ms,
                    "error_message": error_msg,
                    "success": False,
                    "message": error_msg,
                    "stream_info": None
                }

            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            resolution = f"{width}x{height}"
            fps_str = str(round(fps, 1))
            now_iso = datetime.now(timezone.utc).isoformat()

            info = {
                "resolution": resolution,
                "fps": fps_str,
                "latency_ms": elapsed_ms,
                "last_frame_time": now_iso
            }

            return {
                "camera_name": camera_name,
                "source_type": source_type,
                "status": "connected",
                "stream_opened": True,
                "frames_received": True,
                "resolution": resolution,
                "fps": fps_str,
                "last_frame_time": now_iso,
                "latency_ms": elapsed_ms,
                "error_message": None,
                "success": True,
                "message": f"Successfully connected to {source_type} feed ({resolution} @ {fps_str} FPS)",
                "stream_info": info
            }

        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            clean_err = mask_rtsp_url(str(e))
            return {
                "camera_name": camera_name,
                "source_type": source_type,
                "status": "connection_failed",
                "stream_opened": True,
                "frames_received": False,
                "resolution": None,
                "fps": None,
                "last_frame_time": None,
                "latency_ms": elapsed_ms,
                "error_message": f"Decode error: {clean_err}",
                "success": False,
                "message": f"Decode error: {clean_err}",
                "stream_info": None
            }
        finally:
            cap.release()

    def start_monitoring(
        self,
        camera_id: str,
        name: str,
        rtsp_url: str,
        source_type: str = "ip_cctv",
        ai_monitoring: bool = True
    ) -> LiveCameraWorker:
        """
        Starts live monitoring for a camera. Prevents duplicate background capture loops
        for the same camera ID by returning the existing worker if already running.
        """
        if camera_id in self.active_monitors:
            existing = self.active_monitors[camera_id]
            if existing.is_running:
                logger.info(f"Duplicate monitoring prevented: Camera {camera_id} already has an active capture worker.")
                return existing

        # Create and start new worker
        worker = LiveCameraWorker(
            camera_id=camera_id,
            name=name,
            rtsp_url=rtsp_url,
            source_type=source_type,
            ai_monitoring=ai_monitoring,
            event_loop=self.event_loop
        )
        self.active_monitors[camera_id] = worker
        worker.start()
        return worker

    def stop_monitoring(self, camera_id: str) -> bool:
        """Stops background capture worker and releases camera resources."""
        if camera_id in self.active_monitors:
            worker = self.active_monitors.pop(camera_id)
            worker.stop()
            logger.info(f"Monitoring stopped and worker removed for camera {camera_id}")
            return True
        return False

    def get_worker(self, camera_id: str) -> Optional[LiveCameraWorker]:
        """Retrieves active worker for camera_id if present."""
        return self.active_monitors.get(camera_id)

    def stop_all(self):
        """Stops all active camera workers during application shutdown."""
        logger.info(f"Shutting down all active camera workers ({len(self.active_monitors)} active)")
        for cam_id in list(self.active_monitors.keys()):
            self.stop_monitoring(cam_id)


camera_stream_manager = CameraStreamManager()
