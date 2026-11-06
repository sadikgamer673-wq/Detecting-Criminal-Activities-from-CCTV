import logging
from typing import List, Dict, Any, Optional, Tuple
from app.core.config import settings

logger = logging.getLogger("cctv_system.weapon_tracker")


def compute_box_iou(b1: List[float], b2: List[float]) -> float:
    """Computes Intersection-over-Union (IoU) between two bounding boxes [x1, y1, x2, y2]."""
    ix1 = max(b1[0], b2[0])
    iy1 = max(b1[1], b2[1])
    ix2 = min(b1[2], b2[2])
    iy2 = min(b1[3], b2[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    a1 = max((b1[2] - b1[0]) * (b1[3] - b1[1]), 1e-6)
    a2 = max((b2[2] - b2[0]) * (b2[3] - b2[1]), 1e-6)
    denom = a1 + a2 - inter
    return inter / denom if denom > 0 else 0.0


class TrackedWeaponObject:
    """
    Maintains temporal state and track consistency for an identified potential weapon.
    Differentiates between a single-frame glitch and a sustained, confirmed detection.
    """
    def __init__(
        self,
        track_id: int,
        weapon_class: str,
        weapon_category: str,
        confidence: float,
        box: List[float],
        timestamp_sec: float,
        frame_idx: int
    ):
        self.track_id = track_id
        self.weapon_class = weapon_class
        self.weapon_category = weapon_category
        self.confidence = confidence
        self.peak_confidence = confidence
        self.box = box
        self.first_seen_ts = timestamp_sec
        self.last_seen_ts = timestamp_sec
        self.first_frame_idx = frame_idx
        self.last_frame_idx = frame_idx
        self.detection_count = 1
        self.consecutive_frames = 1
        self.incident_triggered = False
        self.is_confirmed = False

    def update(self, box: List[float], confidence: float, timestamp_sec: float, frame_idx: int):
        self.box = box
        self.confidence = confidence
        self.peak_confidence = max(self.peak_confidence, confidence)
        self.last_seen_ts = timestamp_sec
        self.last_frame_idx = frame_idx
        self.detection_count += 1
        self.consecutive_frames += 1


class TemporalWeaponTracker:
    """
    Temporal multi-frame confirmation engine for weapon detection.
    
    Protects against false positives:
    1. Rejects single-frame detections (requires consecutive appearance across >= min_confirmation_frames).
    2. Rejects low-confidence detections below configured threshold.
    3. Suppresses duplicate incidents for the same tracked object across consecutive frames.
    4. Tracks persistent object identities and expires stale tracks.
    """
    def __init__(
        self,
        min_confirmation_frames: Optional[int] = None,
        min_confidence: Optional[float] = None,
        track_timeout_sec: float = 2.0,
        iou_threshold: float = 0.20
    ):
        self.min_confirmation_frames = min_confirmation_frames or settings.WEAPON_CONSECUTIVE_FRAMES
        self.min_confidence = min_confidence or settings.WEAPON_CONFIDENCE_THRESHOLD
        self.track_timeout_sec = track_timeout_sec
        self.iou_threshold = iou_threshold
        self.tracks: Dict[int, TrackedWeaponObject] = {}
        self.next_track_id: int = 1
        self.total_confirmed_weapons: int = 0

    def reset(self):
        """Clears all tracking history (used between video jobs or camera resets)."""
        self.tracks.clear()
        self.next_track_id = 1
        self.total_confirmed_weapons = 0

    def process_frame(
        self,
        weapon_detections: List[Dict[str, Any]],
        timestamp_sec: float,
        frame_idx: int
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Processes detections in the current frame.
        
        Returns:
            confirmed_events: List of qualifying weapon events that just became confirmed in this frame.
            active_tracks_summary: List of dicts representing all currently active tracks for HUD/diagnostics.
        """
        # 1. Filter out low-confidence detections below threshold
        valid_dets = [
            d for d in weapon_detections 
            if d.get("confidence", 0.0) >= self.min_confidence
        ]

        matched_track_ids = set()
        matched_det_indices = set()

        # 2. Associate detections with existing tracks via IoU
        if self.tracks and valid_dets:
            candidates = []
            for det_idx, det in enumerate(valid_dets):
                det_box = det.get("box", [0, 0, 0, 0])
                for t_id, track in self.tracks.items():
                    # Category matching preferred (e.g. gun matches gun)
                    iou = compute_box_iou(det_box, track.box)
                    if iou >= self.iou_threshold:
                        candidates.append((iou, det_idx, t_id))

            candidates.sort(key=lambda x: x[0], reverse=True)
            for iou, det_idx, t_id in candidates:
                if det_idx in matched_det_indices or t_id in matched_track_ids:
                    continue
                matched_det_indices.add(det_idx)
                matched_track_ids.add(t_id)
                det = valid_dets[det_idx]
                self.tracks[t_id].update(
                    box=det.get("box", [0, 0, 0, 0]),
                    confidence=det.get("confidence", 0.0),
                    timestamp_sec=timestamp_sec,
                    frame_idx=frame_idx
                )

        # 3. Create new tracks for unmatched detections
        for det_idx, det in enumerate(valid_dets):
            if det_idx not in matched_det_indices:
                t_id = self.next_track_id
                self.next_track_id += 1
                new_track = TrackedWeaponObject(
                    track_id=t_id,
                    weapon_class=det.get("class_name", "weapon"),
                    weapon_category=det.get("weapon_category", "weapon"),
                    confidence=det.get("confidence", 0.0),
                    box=det.get("box", [0, 0, 0, 0]),
                    timestamp_sec=timestamp_sec,
                    frame_idx=frame_idx
                )
                self.tracks[t_id] = new_track
                matched_track_ids.add(t_id)

        # 4. Expire stale tracks not seen within track_timeout_sec
        stale_ids = [
            t_id for t_id, tr in self.tracks.items()
            if (timestamp_sec - tr.last_seen_ts) > self.track_timeout_sec
        ]
        for t_id in stale_ids:
            del self.tracks[t_id]

        # 5. Check confirmation criteria and emit events
        confirmed_events = []
        for t_id, track in self.tracks.items():
            if track.consecutive_frames >= self.min_confirmation_frames:
                track.is_confirmed = True
                if not track.incident_triggered:
                    track.incident_triggered = True
                    self.total_confirmed_weapons += 1
                    safe_class = track.weapon_class.lower().replace(" ", "_")
                    confirmed_events.append({
                        "category": f"potential_weapon_{safe_class}",
                        "weapon_class": track.weapon_class,
                        "weapon_category": track.weapon_category,
                        "confidence": round(track.peak_confidence, 4),
                        "timestamp_sec": timestamp_sec,
                        "frame_idx": frame_idx,
                        "box": track.box,
                        "track_id": track.track_id,
                        "consecutive_frames": track.consecutive_frames,
                        "description": (
                            f"Potential {track.weapon_class.upper()} detected and confirmed across "
                            f"{track.consecutive_frames} frames (Confidence: {track.peak_confidence:.2f}). "
                            "Requires human verification."
                        )
                    })
                    logger.info(
                        f"Weapon confirmed: track #{track.track_id} ({track.weapon_class}) "
                        f"at ts {timestamp_sec:.2f}s, frame {frame_idx}"
                    )

        # 6. Build active tracks summary for live display / telemetry
        active_tracks_summary = [
            {
                "track_id": tr.track_id,
                "class_name": tr.weapon_class,
                "confidence": round(tr.confidence, 4),
                "is_confirmed": tr.is_confirmed,
                "consecutive_frames": tr.consecutive_frames,
                "box": tr.box
            }
            for tr in self.tracks.values()
            if (timestamp_sec - tr.last_seen_ts) <= 1.0
        ]

        return confirmed_events, active_tracks_summary
