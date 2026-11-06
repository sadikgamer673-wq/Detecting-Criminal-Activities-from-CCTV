import uuid
import logging
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.incident import PotentialIncident
from app.models.evidence import IncidentEvidence
from app.core.config import settings
from app.services.evidence.extractor import evidence_extractor

logger = logging.getLogger("cctv_system.incidents")

class IncidentManager:
    """
    Manages potential incident deduplication, cooldown intervals,
    database persistence, and evidence linkage.
    """
    def __init__(self, cooldown_seconds: Optional[int] = None):
        self.cooldown_seconds = cooldown_seconds or settings.EVENT_COOLDOWN_SECONDS
        # In-memory tracking of active ongoing incidents: (source_id, category) -> incident_id, last_seen_time
        self.active_incidents: Dict[tuple, Dict[str, Any]] = {}

    def reset_source(self, source_id: str):
        """Clears active incident tracker for a source when starting fresh analysis."""
        keys_to_remove = [k for k in self.active_incidents if k[0] == source_id]
        for k in keys_to_remove:
            del self.active_incidents[k]

    async def register_event(
        self,
        db: AsyncSession,
        source_type: str,
        source_id: str,
        category: str,
        confidence: float,
        timestamp_sec: float,
        frame_idx: int,
        source_video_path: Optional[Path] = None,
        buffered_frames: Optional[list] = None
    ) -> Optional[PotentialIncident]:
        """
        Processes an anomalous detection event. Either merges into an ongoing incident
        or creates a new PotentialIncident with extracted video evidence.
        """
        key = (source_id, category)
        now_ts = timestamp_sec

        # Check if active within cooldown
        if key in self.active_incidents:
            active_info = self.active_incidents[key]
            if (now_ts - active_info["last_seen_ts"]) <= self.cooldown_seconds:
                # Merge into existing incident
                inc_id = active_info["incident_id"]
                active_info["last_seen_ts"] = now_ts
                active_info["end_ts"] = max(active_info["end_ts"], now_ts + 1.0)
                # Maximize confidence if higher
                if confidence > active_info["confidence"]:
                    active_info["confidence"] = confidence

                await db.execute(
                    update(PotentialIncident)
                    .where(PotentialIncident.id == inc_id)
                    .values(
                        timestamp_end=round(active_info["end_ts"], 2),
                        confidence=round(active_info["confidence"], 4)
                    )
                )
                await db.commit()
                logger.info(f"Merged event into existing incident {inc_id} ({category}) -> End TS: {active_info['end_ts']:.2f}s")
                return None

        # Create new potential incident
        inc_id = str(uuid.uuid4())
        new_incident = PotentialIncident(
            id=inc_id,
            source_type=source_type,
            source_id=source_id,
            category=category,
            confidence=round(confidence, 4),
            timestamp_start=round(now_ts, 2),
            timestamp_end=round(now_ts + 1.0, 2),
            frame_index=frame_idx,
            review_status="potential",
            reviewer_notes=None
        )

        db.add(new_incident)
        await db.commit()
        await db.refresh(new_incident)

        self.active_incidents[key] = {
            "incident_id": inc_id,
            "last_seen_ts": now_ts,
            "end_ts": now_ts + 1.0,
            "confidence": confidence
        }

        logger.info(f"Created new PotentialIncident: id={inc_id}, category={category}, conf={confidence:.2f}, ts={now_ts:.2f}s, frame={frame_idx}")

        # Extract evidence clip if source video path is supplied
        if source_video_path and source_video_path.exists():
            try:
                # Run clip extraction in worker thread so async loop is not blocked
                clip_path, thumb_path, duration, file_size = await asyncio.to_thread(
                    evidence_extractor.extract_clip,
                    source_video_path=source_video_path,
                    start_time_sec=now_ts,
                    end_time_sec=now_ts + 2.0,
                    incident_id=inc_id
                )

                if clip_path and clip_path.exists():
                    evidence = IncidentEvidence(
                        id=str(uuid.uuid4()),
                        incident_id=inc_id,
                        clip_path=str(clip_path),
                        thumbnail_path=str(thumb_path) if thumb_path else None,
                        duration_seconds=round(duration, 2),
                        file_size_bytes=file_size
                    )
                    db.add(evidence)
                    await db.commit()
                    logger.info(f"Saved evidence clip for incident {inc_id} ({duration:.1f}s, {file_size} bytes)")
            except Exception as e:
                logger.error(f"Error during evidence clip extraction for incident {inc_id}: {e}")
        elif buffered_frames:
            try:
                clip_path, thumb_path, duration, file_size = await asyncio.to_thread(
                    evidence_extractor.extract_clip_from_frames,
                    frames=list(buffered_frames),
                    incident_id=inc_id,
                    fps=10.0
                )
                if clip_path and clip_path.exists():
                    evidence = IncidentEvidence(
                        id=str(uuid.uuid4()),
                        incident_id=inc_id,
                        clip_path=str(clip_path),
                        thumbnail_path=str(thumb_path) if thumb_path else None,
                        duration_seconds=round(duration, 2),
                        file_size_bytes=file_size
                    )
                    db.add(evidence)
                    await db.commit()
                    logger.info(f"Saved live evidence clip for incident {inc_id} ({duration:.1f}s, {file_size} bytes)")
            except Exception as e:
                logger.error(f"Error during live evidence clip extraction for incident {inc_id}: {e}")

        return new_incident

incident_manager = IncidentManager()
