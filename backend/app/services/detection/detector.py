import os
import logging
import threading
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import cv2
from app.core.config import settings

logger = logging.getLogger("cctv_system.detector")


class ObjectDetector:
    """
    Lightweight YOLO-family object detector optimized for CPU inference on Windows 11.
    Uses YOLOv8n (nano) with lazy initialization.
    Primary focus: Person detection, crowd metrics, and general COCO context.
    """
    def __init__(self, model_name: str = "yolov8n.pt", confidence_threshold: Optional[float] = None):
        self.model_name = model_name
        self.confidence_threshold = confidence_threshold or settings.CONFIDENCE_THRESHOLD
        self._model = None
        self._is_loaded = False
        self.model_dir = settings.resolved_model_dir
        self._lock = threading.Lock()

    @property
    def model_path(self) -> Path:
        return self.model_dir / self.model_name

    def load_model(self):
        if self._is_loaded and self._model is not None:
            return self._model

        with self._lock:
            if self._is_loaded and self._model is not None:
                return self._model

            logger.info(f"Initializing YOLO model '{self.model_name}' on CPU...")
            try:
                from ultralytics import YOLO
                target_path = str(self.model_path)
                self._model = YOLO(target_path if self.model_path.exists() else self.model_name)
                self._is_loaded = True
                logger.info(f"Model '{self.model_name}' loaded successfully for CPU inference.")
                return self._model
            except Exception as e:
                logger.error(f"Failed to load YOLO model: {e}")
                self._is_loaded = False
                self._model = None
                raise RuntimeError(f"Could not initialize object detector: {e}")

    def detect(self, frame: np.ndarray, confidence: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Runs object detection on a single BGR frame.
        Returns a list of detections:
        [
          {
            "class_id": int,
            "class_name": str,
            "confidence": float,
            "box": [x1, y1, x2, y2],
            "is_weapon": bool
          }
        ]
        """
        model = self.load_model()
        conf = confidence if confidence is not None else self.confidence_threshold

        try:
            with self._lock:
                results = model.predict(
                    source=frame,
                    conf=conf,
                    device="cpu",
                    verbose=False
                )

            detections = []
            if results and len(results) > 0:
                result = results[0]
                boxes = result.boxes
                if boxes is not None:
                    for i in range(len(boxes)):
                        xyxy = boxes.xyxy[i].cpu().numpy().tolist()
                        cls_id = int(boxes.cls[i].cpu().numpy().item())
                        cls_name = model.names.get(cls_id, str(cls_id))
                        score = float(boxes.conf[i].cpu().numpy().item())

                        is_weapon_tool = cls_name.lower() in ["knife", "scissors", "baseball bat"]

                        detections.append({
                            "class_id": cls_id,
                            "class_name": cls_name,
                            "confidence": round(score, 4),
                            "box": [round(c, 1) for c in xyxy],
                            "is_weapon": is_weapon_tool
                        })

            return detections
        except Exception as e:
            logger.error(f"Inference error during frame detection: {e}")
            return []

    def detect_objects(self, frame: np.ndarray, confidence_threshold: Optional[float] = None) -> List[Dict[str, Any]]:
        """Compatibility alias for detect()."""
        return self.detect(frame, confidence=confidence_threshold)

    def annotate_frame(self, frame: np.ndarray, detections: List[Dict[str, Any]]) -> np.ndarray:
        """
        Draws bounding boxes and labels onto a copy of the frame.
        Handles pixel or normalized coordinates, and both dict and object structures.
        """
        annotated = frame.copy()
        h, w = frame.shape[:2]
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
                is_weapon = cls_name.lower() in ["knife", "scissors", "baseball bat", "gun", "pistol", "rifle"]

            if is_weapon:
                color = (0, 69, 255)  # Vivid Red-Orange for weapon threats
                label = f"WEAPON: {cls_name.upper()} {int(conf * 100)}%"
            elif is_person:
                color = (0, 255, 127)  # Emerald green for person
                label = f"Person {int(conf * 100)}%"
            else:
                color = (200, 200, 200)
                label = f"{cls_name.capitalize()} {int(conf * 100)}%"

            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            t_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)[0]
            label_y = max(y1, t_size[1] + 4)
            cv2.rectangle(annotated, (x1, label_y - t_size[1] - 4), (x1 + t_size[0] + 6, label_y), color, -1)
            cv2.putText(
                annotated,
                label,
                (x1 + 3, label_y - 2),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (0, 0, 0),
                1,
                cv2.LINE_AA
            )
        return annotated


class WeaponDetector:
    """
    Dedicated object detector fine-tuned for weapon detection (firearms/guns, knives, explosives).
    Uses a genuine fine-tuned YOLOv8 Nano model on CPU with lazy initialization.
    Official Source: Subh775/Threat-Detection-YOLOv8n (Hugging Face)
    License: MIT License
    Classes: Gun, knife, grenade, explosion (and compatibility with pistol, rifle weights).
    """
    def __init__(self, model_name: Optional[str] = None, confidence_threshold: Optional[float] = None):
        self.model_name = model_name or settings.WEAPON_MODEL_NAME
        self.confidence_threshold = confidence_threshold or settings.WEAPON_CONFIDENCE_THRESHOLD
        self._model = None
        self._is_loaded = False
        self.model_dir = settings.resolved_model_dir
        self._lock = threading.Lock()

    @property
    def model_path(self) -> Path:
        return self.model_dir / self.model_name

    def load_model(self):
        if self._is_loaded and self._model is not None:
            return self._model

        with self._lock:
            if self._is_loaded and self._model is not None:
                return self._model

            logger.info(f"Initializing Weapon Detection model '{self.model_name}' on CPU...")
            try:
                from ultralytics import YOLO
                target_path = str(self.model_path)

                # Auto-download from trusted Hugging Face repository if not present locally
                if not self.model_path.exists():
                    logger.info(f"Weapon model weights not found at {target_path}. Downloading from Hugging Face...")
                    import urllib.request
                    hf_url = "https://huggingface.co/Subh775/Threat-Detection-YOLOv8n/resolve/main/weights/best.pt"
                    self.model_dir.mkdir(parents=True, exist_ok=True)
                    urllib.request.urlretrieve(hf_url, target_path)
                    logger.info(f"Weapon model downloaded successfully to {target_path} ({self.model_path.stat().st_size} bytes)")

                self._model = YOLO(target_path)
                self._is_loaded = True
                logger.info(f"Weapon model '{self.model_name}' loaded successfully on CPU. Classes: {self._model.names}")
                return self._model
            except Exception as e:
                logger.error(f"Failed to load weapon detection model: {e}")
                self._is_loaded = False
                self._model = None
                raise RuntimeError(f"Could not initialize weapon detector: {e}")

    def get_supported_classes(self) -> Dict[int, str]:
        """Returns dict of class_id -> class_name supported by the model."""
        model = self.load_model()
        return dict(model.names) if model else {}

    @staticmethod
    def is_plausible_weapon_geometry(
        box: List[float],
        frame_shape: tuple,
        class_name: str,
        person_boxes: Optional[List[List[float]]] = None
    ) -> Tuple[bool, str]:
        """
        Validates whether a bounding box represents a physically plausible weapon in a surveillance view.
        Eliminates false alarms from:
        1. Full human silhouettes mistargeted as knives or guns (e.g. box covering 60-80% of frame height).
        2. Massive room-sized or wall-sized bounding boxes.
        3. Giant weapons that cover the entire human torso/body.
        """
        fh, fw = frame_shape[:2]
        if fh <= 0 or fw <= 0:
            return True, "valid"

        x1, y1, x2, y2 = box
        bw = max(1.0, x2 - x1)
        bh = max(1.0, y2 - y1)
        area = bw * bh
        frame_area = float(fw * fh)

        rel_h = bh / float(fh)
        rel_w = bw / float(fw)
        rel_area = area / frame_area
        cls_lower = class_name.lower()
        aspect_ratio = bh / bw  # height / width

        # 1. Knife validation:
        # Handheld knives (15-30 cm) cannot exceed 28% of surveillance frame height,
        # nor exceed 6% of the frame area.
        # Tall, thin vertical pillars (rel_h > 0.22 and aspect_ratio > 2.8) are human limbs or bodies.
        if any(k in cls_lower for k in ["knife", "blade", "dagger", "sword"]):
            if rel_h > 0.28:
                return False, f"Knife height {rel_h:.1%} exceeds surveillance threshold (max 28%)"
            if rel_area > 0.06:
                return False, f"Knife area {rel_area:.1%} exceeds surveillance threshold (max 6%)"
            if rel_h > 0.22 and aspect_ratio > 2.8:
                return False, f"Knife aspect ratio {aspect_ratio:.1f} resembles vertical human silhouette"

        # 2. Handgun / Pistol validation:
        # Handguns cannot exceed 32% of frame height or 8% of frame area.
        elif any(k in cls_lower for k in ["gun", "pistol", "handgun"]):
            if rel_h > 0.32:
                return False, f"Handgun height {rel_h:.1%} exceeds surveillance threshold (max 32%)"
            if rel_area > 0.08:
                return False, f"Handgun area {rel_area:.1%} exceeds surveillance threshold (max 8%)"

        # 3. General weapon limits (rifles, explosives, etc.):
        # In surveillance frames, no handheld threat occupies > 50% frame height or > 15% frame area.
        else:
            if rel_h > 0.50:
                return False, f"Weapon height {rel_h:.1%} exceeds surveillance threshold (max 50%)"
            if rel_area > 0.15:
                return False, f"Weapon area {rel_area:.1%} exceeds surveillance threshold (max 15%)"

        # 4. Human silhouette co-occurrence guardrail:
        # When person bounding boxes are present, a weapon must NOT encompass the entire person.
        if person_boxes:
            for pbox in person_boxes:
                px1, py1, px2, py2 = pbox
                pw = max(1.0, px2 - px1)
                ph = max(1.0, py2 - py1)
                p_area = pw * ph

                # Intersection
                ix1 = max(x1, px1)
                iy1 = max(y1, py1)
                ix2 = min(x2, px2)
                iy2 = min(y2, py2)
                inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)

                # If weapon box covers more than 50% of the entire person, it's mistaking the person for a weapon
                if p_area > 0 and (inter / p_area) > 0.50:
                    return False, f"Weapon box overlaps {inter/p_area:.1%} of person silhouette"

                # If weapon box is almost as large as the person and overlaps heavily
                if area > 0 and (inter / area) > 0.75 and (area / p_area) > 0.45:
                    return False, f"Weapon box covers {area/p_area:.1%} of person body"

        return True, "valid"

    def detect(
        self,
        frame: np.ndarray,
        confidence: Optional[float] = None,
        person_boxes: Optional[List[List[float]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Runs weapon detection inference on a BGR frame with geometric sanity filtering.
        Returns normalized detection objects:
        [
            {
                "class_id": int,
                "class_name": str,       # Raw model class name (e.g. "Gun", "knife", "pistol")
                "display_name": str,     # Formatted label (e.g. "GUN", "KNIFE", "PISTOL")
                "weapon_category": str, # "firearm", "knife", "explosive"
                "confidence": float,
                "box": [x1, y1, x2, y2],
                "is_weapon": True
            }
        ]
        """
        model = self.load_model()
        conf = confidence if confidence is not None else self.confidence_threshold

        try:
            with self._lock:
                results = model.predict(
                    source=frame,
                    conf=conf,
                    device="cpu",
                    verbose=False
                )

            detections = []
            if results and len(results) > 0:
                result = results[0]
                boxes = result.boxes
                if boxes is not None:
                    h, w = frame.shape[:2]
                    for i in range(len(boxes)):
                        xyxy = boxes.xyxy[i].cpu().numpy().tolist()
                        cls_id = int(boxes.cls[i].cpu().numpy().item())
                        raw_name = model.names.get(cls_id, str(cls_id))
                        score = float(boxes.conf[i].cpu().numpy().item())

                        # Geometric and contextual sanity filter
                        is_valid, reason = self.is_plausible_weapon_geometry(
                            box=xyxy,
                            frame_shape=(h, w),
                            class_name=raw_name,
                            person_boxes=person_boxes
                        )
                        if not is_valid:
                            logger.debug(f"Filtered weapon false positive ({raw_name}, conf={score:.2f}): {reason}")
                            continue

                        lower_name = raw_name.lower()
                        # Categorize weapon
                        if any(k in lower_name for k in ["gun", "pistol", "handgun", "rifle", "firearm", "shotgun"]):
                            weapon_cat = "firearm"
                            display_name = raw_name.upper()
                        elif any(k in lower_name for k in ["knife", "blade", "dagger", "sword"]):
                            weapon_cat = "knife"
                            display_name = "KNIFE"
                        elif any(k in lower_name for k in ["grenade", "explosive", "bomb", "explosion"]):
                            weapon_cat = "explosive"
                            display_name = raw_name.upper()
                        else:
                            weapon_cat = "weapon"
                            display_name = raw_name.upper()

                        detections.append({
                            "class_id": cls_id,
                            "class_name": raw_name,
                            "display_name": display_name,
                            "weapon_category": weapon_cat,
                            "confidence": round(score, 4),
                            "box": [round(c, 1) for c in xyxy],
                            "is_weapon": True
                        })

            return detections
        except Exception as e:
            logger.error(f"Inference error during weapon detection: {e}")
            return []


class DualSurveillanceDetector:
    """
    Unified dual-model detection pipeline running both primary person detection
    and specialized weapon threat detection on CPU.
    """
    def __init__(self, person_detector: ObjectDetector, weapon_detector: WeaponDetector):
        self.person_detector = person_detector
        self.weapon_detector = weapon_detector

    def detect_all(
        self,
        frame: np.ndarray,
        person_conf: Optional[float] = None,
        weapon_conf: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Runs person detection and weapon detection.
        Returns:
        {
            "people": [...],
            "weapons": [...],
            "all_detections": [...],
            "has_weapons": bool
        }
        """
        # 1. Primary person detection
        general_dets = self.person_detector.detect(frame, confidence=person_conf)
        people = [d for d in general_dets if d.get("class_name", "").lower() == "person"]
        person_boxes = [p.get("box", [0, 0, 0, 0]) for p in people]

        # 2. Weapon detection with person spatial context
        weapons = self.weapon_detector.detect(frame, confidence=weapon_conf, person_boxes=person_boxes)

        return {
            "people": people,
            "weapons": weapons,
            "all_detections": people + weapons,
            "has_weapons": len(weapons) > 0
        }


# Global singleton instances for reuse across backend
detector = ObjectDetector()
object_detector = detector
weapon_detector = WeaponDetector()
dual_detector = DualSurveillanceDetector(detector, weapon_detector)
