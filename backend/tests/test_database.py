import pytest
import uuid
from sqlalchemy import select
from app.models.camera import Camera
from app.models.job import VideoAnalysisJob
from app.models.incident import PotentialIncident
from app.models.evidence import IncidentEvidence
from app.models.settings import SystemSetting

@pytest.mark.asyncio
async def test_database_models_crud(async_db):
    # 1. Camera model
    cam_id = str(uuid.uuid4())
    camera = Camera(
        id=cam_id,
        name="Main Entrance Gate 1",
        rtsp_url="rtsp://192.168.1.100:554/live/stream1",
        location="Building A Main Gate",
        is_active=True,
        status="disconnected"
    )
    async_db.add(camera)
    await async_db.commit()

    result = await async_db.execute(select(Camera).where(Camera.id == cam_id))
    fetched_cam = result.scalar_one_or_none()
    assert fetched_cam is not None
    assert fetched_cam.name == "Main Entrance Gate 1"

    # 2. Video Analysis Job model
    job_id = str(uuid.uuid4())
    job = VideoAnalysisJob(
        id=job_id,
        filename="parking_lot_sample.mp4",
        file_path="/storage/uploads/parking_lot_sample.mp4",
        file_size_bytes=1024 * 1024 * 15,
        status="queued",
        progress=0.0
    )
    async_db.add(job)
    await async_db.commit()

    job_res = await async_db.execute(select(VideoAnalysisJob).where(VideoAnalysisJob.id == job_id))
    fetched_job = job_res.scalar_one_or_none()
    assert fetched_job is not None
    assert fetched_job.status == "queued"

    # 3. Incident and Evidence relationship
    inc_id = str(uuid.uuid4())
    incident = PotentialIncident(
        id=inc_id,
        source_type="camera",
        source_id=cam_id,
        category="unusual_movement",
        confidence=0.87,
        timestamp_start=12.5,
        timestamp_end=18.0,
        review_status="potential"
    )
    async_db.add(incident)
    await async_db.commit()

    ev_id = str(uuid.uuid4())
    evidence = IncidentEvidence(
        id=ev_id,
        incident_id=inc_id,
        clip_path="/storage/incidents/ev_123.mp4",
        duration_seconds=5.5,
        file_size_bytes=2048000
    )
    async_db.add(evidence)
    await async_db.commit()

    inc_res = await async_db.execute(select(PotentialIncident).where(PotentialIncident.id == inc_id))
    fetched_inc = inc_res.scalar_one_or_none()
    assert fetched_inc is not None
    assert fetched_inc.review_status == "potential"

    # 4. System Settings
    setting = SystemSetting(
        key="confidence_threshold",
        value="0.55",
        description="Default confidence threshold"
    )
    async_db.add(setting)
    await async_db.commit()

    set_res = await async_db.execute(select(SystemSetting).where(SystemSetting.key == "confidence_threshold"))
    fetched_setting = set_res.scalar_one_or_none()
    assert fetched_setting is not None
    assert fetched_setting.value == "0.55"
