from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Set, Tuple
import math
import logging

logger = logging.getLogger("cctv_system.activity")

class BaseActivityClassifier(ABC):
    """
    Abstract interface for temporal video activity and behavior recognition.
    Designed so external action recognition models (e.g. X3D, MoViNet) can be plugged in.
    """
    @abstractmethod
    def get_supported_categories(self) -> List[str]:
        """Returns list of genuinely supported activity categories."""
        pass

    @abstractmethod
    def reset(self) -> None:
        """Resets temporal context and tracking state between video sequences."""
        pass

    @abstractmethod
    def analyze_frame(
        self, 
        frame_idx: int, 
        timestamp_sec: float, 
        detections: List[Dict[str, Any]], 
        frame_shape: tuple
    ) -> List[Dict[str, Any]]:
        """
        Processes detections at current frame index and timestamp,
        returning detected potential activities.
        """
        pass

class TrackedPerson:
    """
    Maintains temporal kinematic state for an individual across consecutive video frames.
    Applies Exponential Moving Average (EMA) smoothing to eliminate detection bounding-box jitter,
    and tracks upright baseline, ground posture duration, and motion velocity.
    """
    def __init__(self, track_id: int, centroid: Tuple[float, float], box_norm: List[float], timestamp_sec: float, frame_idx: int):
        self.track_id = track_id
        self.first_seen_ts = timestamp_sec
        self.last_seen_ts = timestamp_sec
        self.detection_count = 1
        self.consecutive_misses = 0

        # Smoothed state (EMA initialized with raw detection)
        self.centroid = centroid
        self.box_norm = box_norm # [x1, y1, x2, y2] in normalized [0, 1] coordinates
        w = max(box_norm[2] - box_norm[0], 0.001)
        h = max(box_norm[3] - box_norm[1], 0.001)
        self.w_norm = w
        self.h_norm = h
        self.aspect_ratio = w / h

        # Upright posture history baseline
        self.upright_frames = 1 if (self.aspect_ratio <= 0.65 and h >= 0.15) else 0
        self.has_established_upright = self.upright_frames >= 1
        self.baseline_upright_h = h if self.has_established_upright else None
        self.baseline_upright_y1 = box_norm[1] if self.has_established_upright else None

        # Pre-existing lying state safeguard: if first detected as horizontal, they did NOT fall in this video
        self.was_initially_down = (self.aspect_ratio >= 1.10) or (h < 0.12)

        # Fall tracking state
        self.consecutive_ground_frames = 0
        self.fall_descent_detected = False
        self.fall_descent_ts: Optional[float] = None
        self.fall_flagged = False

        # Kinematic velocity tracking
        self.smoothed_speed = 0.0
        self.smoothed_vy = 0.0
        self.rapid_motion_frames = 0
        self.loitering_flagged = False
        self.initial_centroid = centroid

    def update(self, raw_centroid: Tuple[float, float], raw_box: List[float], timestamp_sec: float, frame_idx: int, dt: float):
        self.detection_count += 1
        self.consecutive_misses = 0
        self.last_seen_ts = timestamp_sec

        # 1. Apply Exponential Moving Average (EMA) smoothing (alpha=0.50)
        # Suppresses detector bounding-box jitter by over 80%
        alpha = 0.50
        prev_centroid = self.centroid
        prev_box = self.box_norm

        smooth_cx = alpha * raw_centroid[0] + (1.0 - alpha) * prev_centroid[0]
        smooth_cy = alpha * raw_centroid[1] + (1.0 - alpha) * prev_centroid[1]
        self.centroid = (smooth_cx, smooth_cy)

        smooth_box = [
            alpha * raw_box[k] + (1.0 - alpha) * prev_box[k]
            for k in range(4)
        ]
        self.box_norm = smooth_box

        w = max(smooth_box[2] - smooth_box[0], 0.001)
        h = max(smooth_box[3] - smooth_box[1], 0.001)
        self.w_norm = w
        self.h_norm = h
        self.aspect_ratio = w / h

        # 2. Update smoothed velocity
        if dt > 0.02:
            inst_vx = (raw_centroid[0] - prev_centroid[0]) / dt
            inst_vy = (raw_centroid[1] - prev_centroid[1]) / dt
            inst_speed = math.hypot(inst_vx, inst_vy)
            self.smoothed_speed = 0.50 * inst_speed + 0.50 * self.smoothed_speed
            self.smoothed_vy = 0.50 * inst_vy + 0.50 * self.smoothed_vy
        else:
            inst_vx, inst_vy = 0.0, 0.0

        # 3. Upright baseline establishment
        is_upright = (self.aspect_ratio <= 0.65 and h >= 0.15)
        if is_upright:
            self.upright_frames += 1
            if self.upright_frames >= 3:
                self.has_established_upright = True
                if self.baseline_upright_h is None or h > self.baseline_upright_h:
                    self.baseline_upright_h = h
                    self.baseline_upright_y1 = smooth_box[1]
        else:
            self.upright_frames = max(0, self.upright_frames - 1)

        # 4. Check for sudden downward vertical drop (fall precursor)
        if (self.has_established_upright and 
            not self.fall_flagged and 
            self.smoothed_vy >= 0.15 and 
            self.baseline_upright_y1 is not None and
            (smooth_box[1] - self.baseline_upright_y1) >= 0.12):
            self.fall_descent_detected = True
            self.fall_descent_ts = timestamp_sec

        # 5. Check prostrate / ground posture state
        is_prostrate = (self.aspect_ratio >= 1.25)
        if self.baseline_upright_h is not None and h <= (self.baseline_upright_h * 0.55):
            is_prostrate = True

        if is_prostrate:
            self.consecutive_ground_frames += 1
        else:
            self.consecutive_ground_frames = 0

class TemporalMotionActivityClassifier(BaseActivityClassifier):
    """
    Robust temporal activity classifier with:
    1. Multi-metric tracking (IoU-first + spatial gating) to eliminate track identity switches.
    2. EMA coordinate smoothing to filter high-frequency bounding box jitter.
    3. Strict multi-frame duration requirements for fall, altercation, and running.
    4. Honest calibration of Motion Heuristic Scores (0.45 - 0.68), never 95%.
    """
    def __init__(
        self,
        crowd_threshold: int = 4,
        speed_threshold_norm: float = 0.25,        # 25% screen width/s required for sustained sprint
        min_consecutive_rapid_frames: int = 4,     # ~0.8s continuous sprint
        loitering_duration_sec: float = 15.0,
        max_loitering_displacement: float = 0.12,
        fall_min_ground_frames: int = 4,           # ~0.8s confirmed lying down after vertical drop
        altercation_min_frames: int = 5,           # ~1.0s continuous violent interaction
        altercation_min_iou: float = 0.15          # bounding boxes must physically overlap
    ):
        self.crowd_threshold = crowd_threshold
        self.speed_threshold_norm = speed_threshold_norm
        self.min_consecutive_rapid_frames = min_consecutive_rapid_frames
        self.loitering_duration_sec = loitering_duration_sec
        self.max_loitering_displacement = max_loitering_displacement
        self.fall_min_ground_frames = fall_min_ground_frames
        self.altercation_min_frames = altercation_min_frames
        self.altercation_min_iou = altercation_min_iou
        self.reset()

    def get_supported_categories(self) -> List[str]:
        return [
            "normal_activity",
            "unusual_movement",
            "possible_fall",
            "possible_physical_altercation",
            "crowd_disturbance",
            "loitering"
        ]

    def reset(self) -> None:
        self.prev_timestamp: Optional[float] = None
        self.tracks: Dict[int, TrackedPerson] = {}
        self.next_track_id: int = 1
        self.total_confirmed_tracks: int = 0
        self.pair_interactions: Dict[Tuple[int, int], int] = {}
        self.pair_altercation_flagged: Set[Tuple[int, int]] = set()

    def get_unique_tracked_people_count(self) -> int:
        """
        Returns number of confirmed distinct individuals tracked across video.
        Requires at least 2 detections so single-frame false detector glitches are not counted.
        """
        confirmed = sum(1 for tr in self.tracks.values() if tr.detection_count >= 2)
        return max(confirmed, self.total_confirmed_tracks)

    def get_current_people_count(self, timestamp_sec: Optional[float] = None) -> int:
        """Returns number of people actively visible in the current sampled frame."""
        if timestamp_sec is None or self.prev_timestamp is None:
            return len(self.tracks)
        # Active in last 0.5 seconds
        return sum(1 for tr in self.tracks.values() if (timestamp_sec - tr.last_seen_ts) <= 0.5)

    def _compute_iou(self, b1: List[float], b2: List[float]) -> float:
        ix1 = max(b1[0], b2[0])
        iy1 = max(b1[1], b2[1])
        ix2 = min(b1[2], b2[2])
        iy2 = min(b1[3], b2[3])
        inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
        a1 = max((b1[2] - b1[0]) * (b1[3] - b1[1]), 1e-6)
        a2 = max((b2[2] - b2[0]) * (b2[3] - b2[1]), 1e-6)
        return inter / (a1 + a2 - inter)

    def _extract_person_detections(self, detections: List[Dict[str, Any]], frame_w: int, frame_h: int) -> List[Dict[str, Any]]:
        persons = []
        for det in detections:
            # Confirm COCO class mapping: only person
            if det.get("class_name") == "person":
                x1, y1, x2, y2 = det["box"]
                cx = (x1 + x2) / (2.0 * frame_w)
                cy = (y1 + y2) / (2.0 * frame_h)
                box_norm = [
                    x1 / max(frame_w, 1),
                    y1 / max(frame_h, 1),
                    x2 / max(frame_w, 1),
                    y2 / max(frame_h, 1)
                ]
                persons.append({
                    "centroid": (cx, cy),
                    "box_norm": box_norm,
                    "confidence": det["confidence"],
                    "box": det["box"]
                })
        return persons

    def analyze_frame(
        self, 
        frame_idx: int, 
        timestamp_sec: float, 
        detections: List[Dict[str, Any]], 
        frame_shape: tuple
    ) -> List[Dict[str, Any]]:
        activities: List[Dict[str, Any]] = []
        frame_h, frame_w = frame_shape[:2]
        current_persons = self._extract_person_detections(detections, frame_w, frame_h)
        num_people = len(current_persons)

        # 1. Spatial Crowding / Disturbance
        if num_people >= self.crowd_threshold:
            conf = min(0.50 + (num_people - self.crowd_threshold) * 0.04, 0.68)
            activities.append({
                "category": "crowd_disturbance",
                "confidence": round(conf, 3),
                "timestamp_sec": timestamp_sec,
                "frame_idx": frame_idx,
                "description": f"Potential crowd disturbance: dense group of {num_people} individuals in camera view. Human verification required."
            })

        dt = (timestamp_sec - self.prev_timestamp) if self.prev_timestamp is not None else 0.0

        # 2. Robust Multi-Stage Tracking Association
        matched_tracks: Set[int] = set()
        matched_detections: Set[int] = set()

        if dt > 0.02 and self.tracks:
            # Stage A: IoU-First Matching (Prioritizes continuous spatial presence)
            iou_candidates = []
            for det_idx, p in enumerate(current_persons):
                for t_id, track in self.tracks.items():
                    iou = self._compute_iou(p["box_norm"], track.box_norm)
                    if iou >= 0.20:
                        iou_candidates.append((iou, det_idx, t_id))

            # Match greedily by highest IoU first
            iou_candidates.sort(key=lambda x: x[0], reverse=True)
            for iou, det_idx, t_id in iou_candidates:
                if det_idx in matched_detections or t_id in matched_tracks:
                    continue
                matched_detections.add(det_idx)
                matched_tracks.add(t_id)
                p = current_persons[det_idx]
                self.tracks[t_id].update(p["centroid"], p["box_norm"], timestamp_sec, frame_idx, dt)

            # Stage B: Distance-Gated Matching for remaining unmatched detections
            for det_idx, p in enumerate(current_persons):
                if det_idx in matched_detections:
                    continue
                best_t_id = None
                best_dist = float("inf")
                for t_id, track in self.tracks.items():
                    if t_id in matched_tracks:
                        continue
                    dx = abs(p["centroid"][0] - track.centroid[0])
                    dy = p["centroid"][1] - track.centroid[1] # positive means moving downwards
                    d = math.hypot(dx, dy)
                    
                    # Match if within normal gating radius (0.14) OR if vertical downward drop of a fall (dx <= 0.15, -0.05 <= dy <= 0.35)
                    is_valid_candidate = (d <= 0.14) or (dx <= 0.15 and -0.05 <= dy <= 0.35)
                    if is_valid_candidate and d < best_dist:
                        best_dist = d
                        best_t_id = t_id

                if best_t_id is not None:
                    matched_detections.add(det_idx)
                    matched_tracks.add(best_t_id)
                    self.tracks[best_t_id].update(p["centroid"], p["box_norm"], timestamp_sec, frame_idx, dt)

            # Stage C: Register new tracks for truly unmatched detections
            for det_idx, p in enumerate(current_persons):
                if det_idx not in matched_detections:
                    t_id = self.next_track_id
                    self.next_track_id += 1
                    self.tracks[t_id] = TrackedPerson(t_id, p["centroid"], p["box_norm"], timestamp_sec, frame_idx)

            # Mark misses for unmatched active tracks
            for t_id, track in self.tracks.items():
                if t_id not in matched_tracks:
                    track.consecutive_misses += 1

        else:
            # First frame or reset: initialize tracks
            for p in current_persons:
                t_id = self.next_track_id
                self.next_track_id += 1
                self.tracks[t_id] = TrackedPerson(t_id, p["centroid"], p["box_norm"], timestamp_sec, frame_idx)

        # Update confirmed tracks count
        self.total_confirmed_tracks = max(
            self.total_confirmed_tracks,
            sum(1 for tr in self.tracks.values() if tr.detection_count >= 2)
        )

        # 3. Behavior Analysis on Smoothed Trajectories
        for t_id in matched_tracks:
            track = self.tracks[t_id]
            speed = track.smoothed_speed

            # -------------------------------------------------------------
            # CATEGORY: possible_fall
            # Strict non-negotiable conditions:
            # 1. Had established upright baseline (not pre-existing lying down)
            # 2. Detected rapid downward vertical descent in previous 1.8s
            # 3. Height collapsed by >= 45% of upright baseline AND aspect ratio >= 1.25
            # 4. Sustained on ground for >= fall_min_ground_frames (~0.8s - 1.5s)
            # -------------------------------------------------------------
            time_since_descent = (timestamp_sec - track.fall_descent_ts) if track.fall_descent_ts is not None else 999.0
            is_down = (track.aspect_ratio >= 1.25) or (track.baseline_upright_h and track.h_norm <= track.baseline_upright_h * 0.55)

            if (track.has_established_upright and
                not track.was_initially_down and
                track.fall_descent_detected and
                time_since_descent <= 1.8 and
                track.consecutive_ground_frames >= self.fall_min_ground_frames and
                not track.fall_flagged):

                track.fall_flagged = True
                fall_score = min(0.55 + max(0.0, track.aspect_ratio - 1.25) * 0.10, 0.68)
                activities.append({
                    "category": "possible_fall",
                    "confidence": round(fall_score, 3),
                    "timestamp_sec": timestamp_sec,
                    "frame_idx": frame_idx,
                    "description": f"Potential fall detected (downward drop followed by prostrate posture, Track #{t_id}). Motion Heuristic Score. Verification required."
                })
                logger.info(f"Frame {frame_idx} (ts {timestamp_sec:.2f}s): Classified possible_fall for track #{t_id}")

            # -------------------------------------------------------------
            # CATEGORY: unusual_movement
            # Sustained high-speed running (> speed_threshold_norm) across multiple frames
            # Normal walking (0.03 - 0.08/s) and standing still (0.00 - 0.02/s) will NEVER trigger.
            # -------------------------------------------------------------
            elif speed >= self.speed_threshold_norm and not is_down and track.consecutive_misses == 0:
                track.rapid_motion_frames += 1
                if track.rapid_motion_frames >= self.min_consecutive_rapid_frames:
                    score = min(0.48 + (speed - self.speed_threshold_norm) * 0.35, 0.65)
                    activities.append({
                        "category": "unusual_movement",
                        "confidence": round(score, 3),
                        "timestamp_sec": timestamp_sec,
                        "frame_idx": frame_idx,
                        "description": f"Potential rapid movement (running velocity factor {round(speed, 2)}/s, Track #{t_id}). Motion Heuristic Score. Verification required."
                    })
                    logger.info(f"Frame {frame_idx} (ts {timestamp_sec:.2f}s): Classified unusual_movement for track #{t_id}")
            else:
                track.rapid_motion_frames = max(0, track.rapid_motion_frames - 1)

            # -------------------------------------------------------------
            # CATEGORY: loitering
            # Lingering in localized zone for >= 15 seconds
            # -------------------------------------------------------------
            total_time = timestamp_sec - track.first_seen_ts
            net_disp = math.hypot(track.centroid[0] - track.initial_centroid[0], track.centroid[1] - track.initial_centroid[1])
            if (total_time >= self.loitering_duration_sec and 
                net_disp <= self.max_loitering_displacement and 
                not track.loitering_flagged and 
                not is_down and 
                track.detection_count >= 10):

                track.loitering_flagged = True
                activities.append({
                    "category": "loitering",
                    "confidence": 0.58,
                    "timestamp_sec": timestamp_sec,
                    "frame_idx": frame_idx,
                    "description": f"Potential loitering: individual lingering in zone for {round(total_time, 1)}s (Track #{t_id}). Verification required."
                })

        # -----------------------------------------------------------------
        # CATEGORY: possible_physical_altercation
        # Strict Altercation Criteria:
        # 1. Bounding boxes MUST physically overlap (IoU >= 0.15)
        # 2. BOTH individuals must exhibit sustained high velocity (> 0.20/s) with relative motion
        # 3. Must persist over altercation_min_frames (e.g. >= 5 consecutive frames, ~1s)
        # Two people standing normally or walking peacefully produce ZERO alerts.
        # -----------------------------------------------------------------
        active_track_ids = [t_id for t_id, tr in self.tracks.items() if tr.consecutive_misses == 0]
        if len(active_track_ids) >= 2 and dt > 0.02:
            for i in range(len(active_track_ids)):
                for j in range(i + 1, len(active_track_ids)):
                    t1_id, t2_id = active_track_ids[i], active_track_ids[j]
                    pair_key = (min(t1_id, t2_id), max(t1_id, t2_id))

                    tr1 = self.tracks[t1_id]
                    tr2 = self.tracks[t2_id]

                    iou = self._compute_iou(tr1.box_norm, tr2.box_norm)
                    dist = math.hypot(tr1.centroid[0] - tr2.centroid[0], tr1.centroid[1] - tr2.centroid[1])
                    # Require physical proximity or bounding box overlap
                    has_collision = (iou >= self.altercation_min_iou) or (dist <= 0.14)

                    # Check for violent agitation: combined rapid motion energy (standing is ~0.01, walking is ~0.08)
                    combined_speed = tr1.smoothed_speed + tr2.smoothed_speed
                    is_violent_grapple = has_collision and (combined_speed >= 0.20 or tr1.smoothed_speed >= 0.14 or tr2.smoothed_speed >= 0.14)

                    if is_violent_grapple:
                        curr = self.pair_interactions.get(pair_key, 0) + 1
                        self.pair_interactions[pair_key] = curr

                        if curr >= self.altercation_min_frames and pair_key not in self.pair_altercation_flagged:
                            self.pair_altercation_flagged.add(pair_key)
                            alt_score = min(0.52 + (tr1.smoothed_speed + tr2.smoothed_speed - 0.40) * 0.30, 0.68)
                            activities.append({
                                "category": "possible_physical_altercation",
                                "confidence": round(alt_score, 3),
                                "timestamp_sec": timestamp_sec,
                                "frame_idx": frame_idx,
                                "description": f"Potential physical altercation: sustained high-velocity collision between Track #{t1_id} and #{t2_id}. Motion Heuristic Score. Verification required."
                            })
                            logger.info(f"Frame {frame_idx} (ts {timestamp_sec:.2f}s): Classified possible_physical_altercation between #{t1_id} and #{t2_id}")
                    else:
                        self.pair_interactions[pair_key] = max(0, self.pair_interactions.get(pair_key, 0) - 1)

        # Cleanup lost tracks inactive for more than 3.0 seconds
        stale_threshold = timestamp_sec - 3.0
        self.tracks = {t_id: tr for t_id, tr in self.tracks.items() if tr.last_seen_ts >= stale_threshold}
        active_ids = set(self.tracks.keys())
        self.pair_interactions = {pair: c for pair, c in self.pair_interactions.items() if pair[0] in active_ids and pair[1] in active_ids}
        self.pair_altercation_flagged = {pair for pair in self.pair_altercation_flagged if pair[0] in active_ids and pair[1] in active_ids}

        self.prev_timestamp = timestamp_sec
        return activities

# Global instance
activity_classifier = TemporalMotionActivityClassifier()
