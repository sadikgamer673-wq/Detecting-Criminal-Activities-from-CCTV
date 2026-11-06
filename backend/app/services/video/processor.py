import time
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Set
import cv2
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, select

from app.core.config import settings
from app.models.job import VideoAnalysisJob
from app.services.detection.detector import detector, weapon_detector, WeaponDetector
from app.services.detection.weapon_tracker import TemporalWeaponTracker
from app.services.detection.activity import activity_classifier
from app.services.incidents.detector import incident_manager
from app.database.session import AsyncSessionLocal

logger = logging.getLogger("cctv_system.processor")

class VideoProcessor:
    """
    Core video ingestion and inference pipeline.
    Processes video files on CPU using frame subsampling, object detection,
    and temporal activity classification.
    """
    def __init__(self):
        self.cancelled_jobs: Set[str] = set()

    def cancel_job(self, job_id: str):
        self.cancelled_jobs.add(job_id)
        logger.info(f"Cancellation requested for job {job_id}")

    async def process_video_job(self, job_id: str, video_path: Path, session_factory=None):
        """
        Executes background analysis for the specified job.
        Tracks genuine progress and telemetry in SQLite.
        """
        session_maker = session_factory or AsyncSessionLocal
        logger.info(f"Starting video processing for job {job_id} at {video_path}")
        start_wall_time = time.time()

        async with session_maker() as db:
            # Mark job as processing
            await db.execute(
                update(VideoAnalysisJob)
                .where(VideoAnalysisJob.id == job_id)
                .values(
                    status="processing",
                    started_at=datetime.now(timezone.utc),
                    progress=0.0
                )
            )
            await db.commit()

        if not video_path.exists():
            await self._fail_job(job_id, f"Video file not found at {video_path}", session_maker=session_maker)
            return

        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            await self._fail_job(job_id, "Failed to decode video file with OpenCV", session_maker=session_maker)
            return

        try:
            fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            duration_sec = total_frames / fps if fps > 0 else 0.0

            target_fps = settings.SAMPLING_RATE_FPS
            frame_step = max(1, int(round(fps / target_fps))) if fps > target_fps else 1

            logger.info(f"Job {job_id} Video Specs: {width}x{height}, {fps:.1f} FPS, {total_frames} total frames, sampling every {frame_step} frames ({target_fps} target FPS)")

            async with session_maker() as db:
                await db.execute(
                    update(VideoAnalysisJob)
                    .where(VideoAnalysisJob.id == job_id)
                    .values(
                        fps=fps,
                        total_frames=total_frames,
                        duration_seconds=round(duration_sec, 2)
                    )
                )
                await db.commit()

            frame_idx = 0
            processed_count = 0
            cumulative_people = 0
            cumulative_events = 0
            last_db_update_time = time.time()
            
            activity_classifier.reset()
            incident_manager.reset_source(job_id)
            weapon_tracker = TemporalWeaponTracker(
                min_confirmation_frames=settings.WEAPON_CONSECUTIVE_FRAMES,
                min_confidence=settings.WEAPON_CONFIDENCE_THRESHOLD
            )

            while True:
                # Check cancellation
                if job_id in self.cancelled_jobs:
                    self.cancelled_jobs.discard(job_id)
                    logger.info(f"Job {job_id} was cancelled by user.")
                    async with session_maker() as db:
                        await db.execute(
                            update(VideoAnalysisJob)
                            .where(VideoAnalysisJob.id == job_id)
                            .values(
                                status="cancelled",
                                completed_at=datetime.now(timezone.utc),
                                error_message="Cancelled by user"
                            )
                        )
                        await db.commit()
                    return

                ret, frame = cap.read()
                if not ret or frame is None:
                    break

                # Process sampled frames only
                if frame_idx % frame_step == 0:
                    processed_count += 1
                    timestamp_sec = frame_idx / fps if fps > 0 else 0.0

                    # CPU optimization: resize for detection if large
                    det_frame = frame
                    scale = 1.0
                    if width > 640:
                        scale = 640.0 / width
                        det_frame = cv2.resize(frame, (640, int(height * scale)))

                    # 1. Object Detection on CPU using configured threshold (default 0.25)
                    detections = detector.detect(det_frame, confidence=settings.CONFIDENCE_THRESHOLD)
                    people_in_frame = [d for d in detections if d.get("class_name") == "person"]
                    person_boxes = [p["box"] for p in people_in_frame]

                    # 1b. Dedicated Weapon Detection on CPU with geometric validation & person context
                    weapon_dets = []
                    try:
                        weapon_dets = weapon_detector.detect(
                            det_frame,
                            confidence=settings.WEAPON_CONFIDENCE_THRESHOLD,
                            person_boxes=person_boxes
                        )
                    except Exception as wep_err:
                        logger.warning(f"Job {job_id} weapon detection error on frame {frame_idx}: {wep_err}")

                    # Filter standard detector weapon items (knife, scissors, baseball bat) with geometric validation
                    filtered_detections = []
                    coco_weapon_alerts = []
                    for det in detections:
                        cls_name = det.get("class_name", "")
                        if cls_name in ["knife", "scissors", "baseball bat"]:
                            is_valid, reason = WeaponDetector.is_plausible_weapon_geometry(
                                box=det["box"],
                                frame_shape=det_frame.shape,
                                class_name=cls_name,
                                person_boxes=person_boxes
                            )
                            if not is_valid:
                                logger.debug(f"Job {job_id} filtered COCO {cls_name} false positive: {reason}")
                                continue
                            if det.get("confidence", 0.0) < settings.WEAPON_CONFIDENCE_THRESHOLD:
                                continue
                            coco_weapon_alerts.append(det)
                        filtered_detections.append(det)

                    # Rescale bounding boxes back to original video dimensions
                    if scale != 1.0:
                        inv_scale = 1.0 / scale
                        for det in filtered_detections:
                            det["box"] = [
                                round(det["box"][0] * inv_scale, 1),
                                round(det["box"][1] * inv_scale, 1),
                                round(det["box"][2] * inv_scale, 1),
                                round(det["box"][3] * inv_scale, 1),
                            ]
                        for w_det in weapon_dets:
                            w_det["box"] = [
                                round(w_det["box"][0] * inv_scale, 1),
                                round(w_det["box"][1] * inv_scale, 1),
                                round(w_det["box"][2] * inv_scale, 1),
                                round(w_det["box"][3] * inv_scale, 1),
                            ]

                    if people_in_frame:
                        cumulative_people += len(people_in_frame)
                        logger.debug(
                            f"Job {job_id} Frame {frame_idx} (ts {timestamp_sec:.2f}s): "
                            f"{len(people_in_frame)} people detected. Confidences: {[p['confidence'] for p in people_in_frame]}"
                        )

                    # Check for verified flagged objects from standard detector (knife, scissors, baseball bat)
                    for det in coco_weapon_alerts:
                        cls_name = det["class_name"]
                        cumulative_events += 1
                        safe_name = cls_name.replace(" ", "_")
                        logger.info(f"Job {job_id} Frame {frame_idx} (ts {timestamp_sec:.2f}s): Object alert for {cls_name} (conf={det['confidence']})")
                        async with session_maker() as db:
                            await incident_manager.register_event(
                                db=db,
                                source_type="uploaded_video",
                                source_id=job_id,
                                category=f"potential_weapon_{safe_name}",
                                confidence=det["confidence"],
                                timestamp_sec=timestamp_sec,
                                frame_idx=frame_idx,
                                source_video_path=video_path
                            )

                    # Multi-frame temporal confirmation for dedicated weapon detector
                    if weapon_tracker and weapon_dets:
                        confirmed_weps, _ = weapon_tracker.process_frame(
                            weapon_detections=weapon_dets,
                            timestamp_sec=timestamp_sec,
                            frame_idx=frame_idx
                        )
                        for wep_event in confirmed_weps:
                            cumulative_events += 1
                            w_cat = wep_event.get("category", "potential_weapon")
                            w_conf = wep_event.get("confidence", 0.70)
                            logger.info(
                                f"Job {job_id} Frame {frame_idx} (ts {timestamp_sec:.2f}s): "
                                f"Confirmed weapon detection: {w_cat} (conf={w_conf:.2f})"
                            )
                            async with session_maker() as db:
                                await incident_manager.register_event(
                                    db=db,
                                    source_type="uploaded_video",
                                    source_id=job_id,
                                    category=w_cat,
                                    confidence=w_conf,
                                    timestamp_sec=timestamp_sec,
                                    frame_idx=frame_idx,
                                    source_video_path=video_path
                                )

                    # 2. Activity Recognition with original video resolution
                    activities = activity_classifier.analyze_frame(
                        frame_idx=frame_idx,
                        timestamp_sec=timestamp_sec,
                        detections=detections,
                        frame_shape=(height, width, 3)
                    )

                    for act in activities:
                        cumulative_events += 1
                        logger.info(
                            f"Job {job_id} Frame {frame_idx} (ts {timestamp_sec:.2f}s): "
                            f"Activity detected: {act['category']} (conf={act['confidence']:.2f}) - {act.get('description', '')}"
                        )
                        async with session_maker() as db:
                            await incident_manager.register_event(
                                db=db,
                                source_type="uploaded_video",
                                source_id=job_id,
                                category=act["category"],
                                confidence=act["confidence"],
                                timestamp_sec=timestamp_sec,
                                frame_idx=frame_idx,
                                source_video_path=video_path
                            )

                    # Update database progress periodically (every 1 second or every 15 frames)
                    now = time.time()
                    if (now - last_db_update_time >= 1.0) or (processed_count % 15 == 0):
                        progress_pct = min(round((frame_idx / max(total_frames, 1)) * 100.0, 1), 99.0)
                        unique_count = activity_classifier.get_unique_tracked_people_count()
                        current_count = len(people_in_frame)
                        async with session_maker() as db:
                            await db.execute(
                                update(VideoAnalysisJob)
                                .where(VideoAnalysisJob.id == job_id)
                                .values(
                                    progress=progress_pct,
                                    processed_frames=frame_idx,
                                    people_detected=cumulative_people,
                                    unique_people=unique_count,
                                    current_people=current_count,
                                    events_classified=cumulative_events
                                )
                            )
                            await db.commit()
                        last_db_update_time = now

                    # Yield control to prevent event loop starvation
                    await asyncio.sleep(0.001)

                frame_idx += 1

            # Processing finished
            elapsed_time = time.time() - start_wall_time
            proc_fps = round(frame_idx / elapsed_time, 2) if elapsed_time > 0 else 0.0
            logger.info(
                f"Job {job_id} Completed: {frame_idx} frames processed in {elapsed_time:.2f}s "
                f"({proc_fps} FPS equivalent). People Detections: {cumulative_people}, "
                f"Events Classified: {cumulative_events}"
            )

            final_unique = activity_classifier.get_unique_tracked_people_count()
            async with session_maker() as db:
                await db.execute(
                    update(VideoAnalysisJob)
                    .where(VideoAnalysisJob.id == job_id)
                    .values(
                        status="completed",
                        progress=100.0,
                        processed_frames=total_frames,
                        people_detected=cumulative_people,
                        unique_people=final_unique,
                        current_people=0,
                        events_classified=cumulative_events,
                        completed_at=datetime.now(timezone.utc)
                    )
                )
                await db.commit()

        except Exception as e:
            logger.exception(f"Unhandled exception during video processing for job {job_id}: {e}")
            await self._fail_job(job_id, str(e), session_maker=session_maker)
        finally:
            cap.release()

    async def _fail_job(self, job_id: str, error_msg: str, session_maker=None):
        sm = session_maker or AsyncSessionLocal
        logger.error(f"Job {job_id} failed: {error_msg}")
        async with sm() as db:
            await db.execute(
                update(VideoAnalysisJob)
                .where(VideoAnalysisJob.id == job_id)
                .values(
                    status="failed",
                    error_message=error_msg,
                    completed_at=datetime.now(timezone.utc)
                )
            )
            await db.commit()

video_processor = VideoProcessor()
