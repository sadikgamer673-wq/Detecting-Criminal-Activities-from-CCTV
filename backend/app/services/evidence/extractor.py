import os
import uuid
import logging
from pathlib import Path
from typing import Optional, Tuple
import cv2
from app.core.config import settings

logger = logging.getLogger("cctv_system.evidence")

class EvidenceExtractor:
    """
    Extracts video evidence clips and keyframe thumbnails around potential security events.
    """
    def __init__(self, incident_dir: Optional[Path] = None):
        self.incident_dir = incident_dir or settings.resolved_incident_dir

    def extract_clip(
        self,
        source_video_path: Path,
        start_time_sec: float,
        end_time_sec: float,
        pre_roll_sec: float = 3.0,
        post_roll_sec: float = 3.0,
        incident_id: Optional[str] = None
    ) -> Tuple[Optional[Path], Optional[Path], float, int]:
        """
        Extracts a sub-clip from source_video_path with pre-roll and post-roll margins.
        Returns: (clip_path, thumbnail_path, duration_seconds, file_size_bytes)
        """
        if not source_video_path.exists():
            logger.error(f"Source video {source_video_path} does not exist for clip extraction.")
            return None, None, 0.0, 0

        inc_id = incident_id or str(uuid.uuid4())
        clip_filename = f"evidence_{inc_id}.mp4"
        thumb_filename = f"thumb_{inc_id}.jpg"
        clip_path = self.incident_dir / clip_filename
        thumb_path = self.incident_dir / thumb_filename

        cap = cv2.VideoCapture(str(source_video_path))
        if not cap.isOpened():
            logger.error(f"Could not open source video {source_video_path} for evidence extraction.")
            return None, None, 0.0, 0

        writer = None
        try:
            fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            total_duration = total_frames / fps if fps > 0 else 0.0

            # Target resolution: clamp to 1280 max dimension for fast extraction & browser compatibility
            out_w, out_h = width, height
            if width > 1280:
                scale = 1280.0 / width
                out_w = 1280
                out_h = int(height * scale)

            # Calculate extraction bounds with padding
            clip_start_sec = max(0.0, start_time_sec - pre_roll_sec)
            clip_end_sec = min(total_duration, end_time_sec + post_roll_sec) if total_duration > 0 else end_time_sec + post_roll_sec
            if clip_end_sec <= clip_start_sec:
                clip_end_sec = clip_start_sec + 2.0

            start_frame = int(clip_start_sec * fps)
            end_frame = int(clip_end_sec * fps)

            cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

            # Setup VideoWriter - Prefer H.264 (avc1) for native HTML5 browser playback
            fourcc = cv2.VideoWriter_fourcc(*'avc1')
            writer = cv2.VideoWriter(str(clip_path), fourcc, fps, (out_w, out_h))
            if not writer.isOpened():
                logger.warning("Could not open avc1 VideoWriter, falling back to mp4v")
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                writer = cv2.VideoWriter(str(clip_path), fourcc, fps, (out_w, out_h))

            current_frame_idx = start_frame
            thumbnail_saved = False

            while current_frame_idx <= end_frame:
                ret, frame = cap.read()
                if not ret or frame is None:
                    break

                write_frame = frame
                if (out_w, out_h) != (width, height):
                    write_frame = cv2.resize(frame, (out_w, out_h))

                writer.write(write_frame)

                # Save thumbnail at the incident trigger point
                if not thumbnail_saved and (current_frame_idx >= int(start_time_sec * fps)):
                    thumb_frame = cv2.resize(frame, (640, int(height * (640.0 / width)))) if width > 640 else frame
                    cv2.imwrite(str(thumb_path), thumb_frame)
                    thumbnail_saved = True

                current_frame_idx += 1

            writer.release()
            writer = None

            # Fallback thumbnail if not saved
            if not thumbnail_saved and clip_path.exists():
                cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
                ret, frame = cap.read()
                if ret and frame is not None:
                    thumb_frame = cv2.resize(frame, (640, int(height * (640.0 / width)))) if width > 640 else frame
                    cv2.imwrite(str(thumb_path), thumb_frame)

            duration = (current_frame_idx - start_frame) / fps if fps > 0 else 0.0
            file_size = clip_path.stat().st_size if clip_path.exists() else 0

            logger.info(f"Extracted evidence clip: {clip_path} (Duration: {round(duration, 2)}s, Size: {file_size} bytes)")
            return clip_path, thumb_path, duration, file_size

        except Exception as e:
            logger.error(f"Failed during evidence extraction: {e}")
            return None, None, 0.0, 0
        finally:
            if writer is not None:
                try:
                    writer.release()
                except Exception:
                    pass
            cap.release()

    def extract_clip_from_frames(
        self,
        frames: list,
        incident_id: Optional[str] = None,
        fps: float = 10.0
    ) -> Tuple[Optional[Path], Optional[Path], float, int]:
        """
        Extracts an evidence clip and thumbnail directly from an in-memory frame buffer.
        Used for live camera feeds where frames are collected in a rolling buffer.
        """
        if not frames:
            logger.warning("No frames provided to extract_clip_from_frames")
            return None, None, 0.0, 0

        inc_id = incident_id or str(uuid.uuid4())
        clip_filename = f"evidence_{inc_id}.mp4"
        thumb_filename = f"thumb_{inc_id}.jpg"
        clip_path = self.incident_dir / clip_filename
        thumb_path = self.incident_dir / thumb_filename

        writer = None
        try:
            first_item = frames[0]
            first_frame = first_item[1] if isinstance(first_item, tuple) else first_item
            height, width = first_frame.shape[:2]

            out_w, out_h = width, height
            if width > 1280:
                scale = 1280.0 / width
                out_w = 1280
                out_h = int(height * scale)

            # Setup VideoWriter - Prefer H.264 (avc1) for native HTML5 browser playback
            fourcc = cv2.VideoWriter_fourcc(*'avc1')
            writer = cv2.VideoWriter(str(clip_path), fourcc, fps, (out_w, out_h))
            if not writer.isOpened():
                logger.warning("Could not open avc1 VideoWriter, falling back to mp4v")
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                writer = cv2.VideoWriter(str(clip_path), fourcc, fps, (out_w, out_h))

            mid_idx = len(frames) // 2
            for idx, item in enumerate(frames):
                frame = item[1] if isinstance(item, tuple) else item
                write_frame = frame
                if (out_w, out_h) != (width, height):
                    write_frame = cv2.resize(frame, (out_w, out_h))
                writer.write(write_frame)

                if idx == mid_idx:
                    thumb_frame = cv2.resize(frame, (640, int(height * (640.0 / width)))) if width > 640 else frame
                    cv2.imwrite(str(thumb_path), thumb_frame)

            writer.release()
            writer = None

            duration = len(frames) / fps if fps > 0 else 0.0
            file_size = clip_path.stat().st_size if clip_path.exists() else 0
            logger.info(f"Extracted live camera evidence clip: {clip_path} ({len(frames)} frames, {duration:.1f}s, {file_size} bytes)")
            return clip_path, thumb_path, duration, file_size
        except Exception as e:
            logger.error(f"Error extracting clip from frames: {e}")
            return None, None, 0.0, 0
        finally:
            if writer is not None:
                try:
                    writer.release()
                except Exception:
                    pass

evidence_extractor = EvidenceExtractor()
