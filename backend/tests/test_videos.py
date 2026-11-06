import io
import os
import uuid
import tempfile
from pathlib import Path
import pytest
import cv2
import numpy as np
from sqlalchemy import select

def create_synthetic_video_bytes(num_frames=15, width=320, height=240, fps=10.0) -> bytes:
    """Generates a small valid MP4 video in memory using OpenCV."""
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = tmp.name

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(tmp_path, fourcc, fps, (width, height))
    for i in range(num_frames):
        # Frame with moving gradient
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        cv2.circle(frame, (20 + i * 10, 50), 15, (255, 255, 255), -1)
        writer.write(frame)
    writer.release()

    with open(tmp_path, "rb") as f:
        video_bytes = f.read()

    os.remove(tmp_path)
    return video_bytes

@pytest.mark.asyncio
async def test_upload_invalid_extension(client):
    response = await client.post(
        "/api/v1/videos/upload",
        files={"file": ("test.txt", io.BytesIO(b"fake text content"), "text/plain")}
    )
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]

@pytest.mark.asyncio
async def test_upload_corrupted_video(client):
    corrupted_bytes = b"This is not a valid MP4 video stream data"
    response = await client.post(
        "/api/v1/videos/upload",
        files={"file": ("corrupt.mp4", io.BytesIO(corrupted_bytes), "video/mp4")}
    )
    assert response.status_code == 400
    assert "corrupted" in response.json()["detail"].lower() or "decoding" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_upload_valid_video_and_get_job(client):
    valid_bytes = create_synthetic_video_bytes(num_frames=10, fps=10.0)
    response = await client.post(
        "/api/v1/videos/upload",
        files={"file": ("sample.mp4", io.BytesIO(valid_bytes), "video/mp4")}
    )
    assert response.status_code == 200
    data = response.json()
    assert "job_id" in data
    assert data["filename"] == "sample.mp4"
    assert data["status"] in ["queued", "processing", "completed"]
    assert data["total_frames"] == 10
    assert data["duration_seconds"] > 0

    job_id = data["job_id"]

    # Retrieve job detail
    detail_res = await client.get(f"/api/v1/videos/jobs/{job_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["job"]["id"] == job_id
    assert "incidents" in detail

    # Retrieve jobs list
    list_res = await client.get("/api/v1/videos/jobs")
    assert list_res.status_code == 200
    job_list = list_res.json()
    assert any(j["id"] == job_id for j in job_list)

    # Test streaming
    stream_res = await client.get(f"/api/v1/videos/{job_id}/stream")
    assert stream_res.status_code in [200, 206]

@pytest.mark.asyncio
async def test_video_processing_completion(async_db):
    """
    Tests that video_processor runs to the final frame,
    updates telemetry metrics, and completes successfully.
    """
    from app.services.video.processor import video_processor
    from app.models.job import VideoAnalysisJob
    from app.core.config import settings

    valid_bytes = create_synthetic_video_bytes(num_frames=12, fps=6.0)
    job_id = str(uuid.uuid4())
    video_file = settings.resolved_upload_dir / f"test_{job_id}.mp4"
    with open(video_file, "wb") as f:
        f.write(valid_bytes)

    job = VideoAnalysisJob(
        id=job_id,
        filename="test.mp4",
        file_path=str(video_file),
        file_size_bytes=len(valid_bytes),
        status="queued",
        progress=0.0
    )
    async_db.add(job)
    await async_db.commit()

    from tests.conftest import TestSessionLocal

    # Process the job
    await video_processor.process_video_job(job_id=job_id, video_path=video_file, session_factory=TestSessionLocal)

    # Expire identity map cache so fresh committed state is read
    async_db.expire_all()

    # Verify job state in DB
    result = await async_db.execute(select(VideoAnalysisJob).where(VideoAnalysisJob.id == job_id))
    finished_job = result.scalar_one()
    assert finished_job.status == "completed"
    assert finished_job.progress == 100.0
    assert finished_job.processed_frames == 12
    assert finished_job.completed_at is not None

    if video_file.exists():
        video_file.unlink()

