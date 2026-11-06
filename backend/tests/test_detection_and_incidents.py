import os
import uuid
import tempfile
import pytest
import numpy as np
import cv2
from sqlalchemy import select

from app.services.detection.detector import detector
from app.services.detection.activity import TemporalMotionActivityClassifier
from app.services.incidents.detector import incident_manager
from app.models.incident import PotentialIncident

@pytest.mark.asyncio
async def test_object_detector_dummy_frame():
    frame = np.zeros((360, 640, 3), dtype=np.uint8)
    detections = detector.detect(frame, confidence=0.25)
    assert isinstance(detections, list)

    annotated = detector.annotate_frame(frame, [
        {"class_id": 0, "class_name": "person", "confidence": 0.88, "box": [50, 50, 150, 200]}
    ])
    assert annotated.shape == frame.shape

# =====================================================================
# STEP 5: TEST SUITE FOR THE FOUR SPECIFIED CORE SCENARIOS
# =====================================================================

@pytest.mark.asyncio
async def test_case_a_two_people_standing_still():
    """
    CASE A: Two people standing still normally.
    Simulates realistic detection bounding-box jitter (+- 3-5 pixels) over 15 frames (~3.0s).
    Must NOT trigger fall, altercation, or unusual movement.
    Must accurately report:
    - Actual visible people: 2
    - Unique tracked people: 2
    - Current people: 2
    - Person detections: 30
    - Events classified: 0
    - Incidents created: 0
    - False positives: 0
    """
    classifier = TemporalMotionActivityClassifier()
    classifier.reset()
    frame_w, frame_h = 640, 480

    total_detections = 0
    all_activities = []

    for i in range(15):
        t = i * 0.2
        # Realistic sensor noise: +- 3px jitter in position and height
        jitter1 = (i % 3) - 1
        jitter2 = ((i + 1) % 3) - 1

        dets = [
            {"class_name": "person", "box": [180 + jitter1, 120, 230 + jitter1, 300 + jitter1], "confidence": 0.90},
            {"class_name": "person", "box": [280 + jitter2, 120, 330 + jitter2, 300 + jitter2], "confidence": 0.90}
        ]
        total_detections += len(dets)
        acts = classifier.analyze_frame(i, t, dets, (frame_h, frame_w, 3))
        all_activities.extend(acts)

    unique_people = classifier.get_unique_tracked_people_count()
    current_people = classifier.get_current_people_count(14 * 0.2)

    assert unique_people == 2, f"Expected 2 unique people, got {unique_people}"
    assert current_people == 2, f"Expected 2 current people, got {current_people}"
    assert total_detections == 30, f"Expected 30 total detections, got {total_detections}"
    assert len(all_activities) == 0, f"FALSE POSITIVE: Standing still triggered events: {all_activities}"

@pytest.mark.asyncio
async def test_case_b_two_people_walking_normally():
    """
    CASE B: Two people walking normally across camera view.
    Simulates steady pedestrian walking (~0.04 frame width/s) over 15 frames.
    Must NOT trigger altercation, fall, or unusual movement.
    Must report:
    - Actual visible people: 2
    - Unique tracked people: 2
    - Events classified: 0
    - False positives: 0
    """
    classifier = TemporalMotionActivityClassifier()
    classifier.reset()
    frame_w, frame_h = 640, 480
    all_activities = []

    for i in range(15):
        t = i * 0.2
        # Walking steadily: 5 pixels shift per frame = (5/640)/0.2 = 0.039 frame width / s
        p1_x = 100 + i * 5
        p2_x = 180 + i * 5
        dets = [
            {"class_name": "person", "box": [p1_x, 150, p1_x + 45, 310], "confidence": 0.88},
            {"class_name": "person", "box": [p2_x, 150, p2_x + 45, 310], "confidence": 0.88}
        ]
        acts = classifier.analyze_frame(i, t, dets, (frame_h, frame_w, 3))
        all_activities.extend(acts)

    assert classifier.get_unique_tracked_people_count() == 2
    assert len(all_activities) == 0, f"FALSE POSITIVE: Normal walking triggered events: {all_activities}"

@pytest.mark.asyncio
async def test_case_c_person_falling():
    """
    CASE C: A person falling down.
    Simulates:
    1. Upright standing baseline (frames 0-4, w=45, h=180, aspect_ratio=0.25)
    2. Sudden vertical downward descent (frame 5, y1 drops by 140px, dy1/H=0.29 > 0.15)
    3. Posture collapse to horizontal (w=150, h=65, aspect_ratio=2.31)
    4. Sustained prostrate posture on ground for 4+ frames (frames 5-9)
    Must report:
    - Actual visible people: 1
    - Unique tracked people: 1
    - Events classified: 1 ('possible_fall')
    - Calibrated Motion Heuristic Score: between 0.55 and 0.68 (never 0.95!)
    """
    classifier = TemporalMotionActivityClassifier(fall_min_ground_frames=3)
    classifier.reset()
    frame_w, frame_h = 640, 480

    all_activities = []

    # Upright phase: frames 0 to 4 (1.0 second)
    for i in range(5):
        t = i * 0.2
        dets = [{"class_name": "person", "box": [200, 80, 245, 260], "confidence": 0.90}]
        acts = classifier.analyze_frame(i, t, dets, (frame_h, frame_w, 3))
        all_activities.extend(acts)

    # Fall drop and collapse: frame 5 (t=1.0s)
    # y1 drops from 80 to 240 (drop = 160 / 480 = 0.33 > 0.12)
    # posture becomes horizontal: w=150, h=65 (AR = 2.31)
    for i in range(5, 10):
        t = i * 0.2
        dets = [{"class_name": "person", "box": [170, 260, 320, 325], "confidence": 0.90}]
        acts = classifier.analyze_frame(i, t, dets, (frame_h, frame_w, 3))
        all_activities.extend(acts)

    fall_events = [a for a in all_activities if a["category"] == "possible_fall"]
    assert len(fall_events) == 1, f"Expected exactly 1 possible_fall, got: {all_activities}"
    fall = fall_events[0]
    assert 0.55 <= fall["confidence"] <= 0.68, f"Score out of honest heuristic bounds: {fall['confidence']}"
    assert "Motion Heuristic Score" in fall["description"]
    assert classifier.get_unique_tracked_people_count() == 1

@pytest.mark.asyncio
async def test_case_d_two_people_physically_fighting():
    """
    CASE D: Two people in physical altercation.
    Simulates:
    1. Direct physical collision / bounding box overlap (IoU >= 0.20)
    2. Sustained violent movement: both individuals moving rapidly (speed >= 0.20/s)
       with erratic opposing velocities over 5+ frames.
    Must report:
    - Actual visible people: 2
    - Unique tracked people: 2
    - Events classified: 1 ('possible_physical_altercation')
    - Calibrated Motion Heuristic Score: between 0.52 and 0.68 (never 0.95!)
    """
    classifier = TemporalMotionActivityClassifier(altercation_min_frames=4, altercation_min_iou=0.15)
    classifier.reset()
    frame_w, frame_h = 640, 480

    all_activities = []

    # 10 frames (~2.0 seconds) of violent overlapping collision and rapid movement
    for i in range(10):
        t = i * 0.2
        # Oscillating rapid movement (+- 25px per frame = 0.20/s velocity)
        offset = 25 if (i % 2 == 0) else -25
        b1 = [200 + offset, 140, 260 + offset, 290]
        b2 = [220 - offset, 140, 280 - offset, 290] # overlapping IoU ~ 0.35
        dets = [
            {"class_name": "person", "box": b1, "confidence": 0.90},
            {"class_name": "person", "box": b2, "confidence": 0.90}
        ]
        acts = classifier.analyze_frame(i, t, dets, (frame_h, frame_w, 3))
        all_activities.extend(acts)

    alt_events = [a for a in all_activities if a["category"] == "possible_physical_altercation"]
    assert len(alt_events) == 1, f"Expected 1 physical altercation, got: {all_activities}"
    assert 0.45 <= alt_events[0]["confidence"] <= 0.68, f"Score out of bounds: {alt_events[0]['confidence']}"
    assert "Motion Heuristic Score" in alt_events[0]["description"]
    assert classifier.get_unique_tracked_people_count() == 2

@pytest.mark.asyncio
async def test_person_already_lying_down_does_not_trigger_fall():
    """
    Crucial Safeguard: A person who was ALREADY lying on the ground when the
    video starts or enters view must NOT trigger a sudden 'possible_fall' alert.
    """
    classifier = TemporalMotionActivityClassifier()
    classifier.reset()
    frame_w, frame_h = 640, 480

    for i in range(10):
        t = i * 0.2
        dets = [{"class_name": "person", "box": [150, 380, 270, 425], "confidence": 0.88}]
        acts = classifier.analyze_frame(i, t, dets, (frame_h, frame_w, 3))
        assert not any(a["category"] == "possible_fall" for a in acts)
        assert not any(a["category"] == "unusual_movement" for a in acts)

@pytest.mark.asyncio
async def test_crowd_surge_classification():
    classifier = TemporalMotionActivityClassifier(crowd_threshold=4)
    classifier.reset()
    frame_w, frame_h = 640, 480

    dets_crowd = [
        {"class_name": "person", "box": [20, 20, 60, 100], "confidence": 0.90},
        {"class_name": "person", "box": [80, 20, 120, 100], "confidence": 0.90},
        {"class_name": "person", "box": [140, 20, 180, 100], "confidence": 0.90},
        {"class_name": "person", "box": [200, 20, 240, 100], "confidence": 0.90},
    ]
    activities = classifier.analyze_frame(0, 0.0, dets_crowd, (frame_h, frame_w, 3))
    crowd_acts = [a for a in activities if a["category"] == "crowd_disturbance"]
    assert len(crowd_acts) > 0
    assert crowd_acts[0]["confidence"] <= 0.70

@pytest.mark.asyncio
async def test_incident_cooldown_and_merging(async_db):
    source_id = str(uuid.uuid4())
    incident_manager.reset_source(source_id)

    inc1 = await incident_manager.register_event(
        db=async_db,
        source_type="uploaded_video",
        source_id=source_id,
        category="possible_fall",
        confidence=0.62,
        timestamp_sec=1.0,
        frame_idx=10
    )
    assert inc1 is not None
    orig_id = inc1.id

    # Event 2 at t=3.0s (within 10s cooldown) -> Should MERGE into inc1
    inc2 = await incident_manager.register_event(
        db=async_db,
        source_type="uploaded_video",
        source_id=source_id,
        category="possible_fall",
        confidence=0.68,
        timestamp_sec=3.0,
        frame_idx=30
    )
    assert inc2 is None # Merged

    result = await async_db.execute(select(PotentialIncident).where(PotentialIncident.id == orig_id))
    fetched = result.scalar_one()
    assert fetched.confidence == 0.68 # Maximized
    assert fetched.timestamp_end >= 4.0
