import os
import uuid
import shutil
import asyncio
import logging
from pathlib import Path
from typing import List, Optional
import cv2
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.database.session import get_db
from app.models.job import VideoAnalysisJob
from app.models.incident import PotentialIncident
from app.services.video.processor import video_processor

logger = logging.getLogger("cctv_system.videos_api")

router = APIRouter()

ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv"}

def sanitize_filename(filename: str) -> str:
    """Removes path separators and dangerous characters."""
    return Path(filename).name

@router.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Accepts video files, validates format and decode capability,
    saves securely, creates VideoAnalysisJob, and triggers background processing.
    """
    original_name = sanitize_filename(file.filename or "uploaded_video.mp4")
    ext = Path(original_name).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Generate secure unique filename
    job_id = str(uuid.uuid4())
    secure_filename = f"{job_id}{ext}"
    dest_path = settings.resolved_upload_dir / secure_filename

    # Stream file to disk while enforcing max file size
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    bytes_written = 0

    try:
        with open(dest_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024): # 1MB chunks
                bytes_written += len(chunk)
                if bytes_written > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB"
                    )
                buffer.write(chunk)
    except HTTPException:
        if dest_path.exists():
            dest_path.unlink()
        raise
    except Exception as e:
        if dest_path.exists():
            dest_path.unlink()
        logger.error(f"Failed to save uploaded file: {e}")
        raise HTTPException(status_code=500, detail="Failed to write uploaded file to storage")

    # Validate that OpenCV can decode the video
    cap = cv2.VideoCapture(str(dest_path))
    if not cap.isOpened():
        if dest_path.exists():
            dest_path.unlink()
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is corrupted or could not be decoded as a valid video stream."
        )

    ret, first_frame = cap.read()
    if not ret or first_frame is None:
        cap.release()
        if dest_path.exists():
            dest_path.unlink()
        raise HTTPException(
            status_code=400,
            detail="Video decoding check failed: Unable to extract initial frame from file."
        )

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    duration_sec = total_frames / fps if fps > 0 else 0.0
    cap.release()

    # Create persistent job in database
    job = VideoAnalysisJob(
        id=job_id,
        filename=original_name,
        file_path=str(dest_path),
        file_size_bytes=bytes_written,
        status="queued",
        progress=0.0,
        fps=fps,
        total_frames=total_frames,
        duration_seconds=round(duration_sec, 2)
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Spawn background processing task asynchronously
    asyncio.create_task(video_processor.process_video_job(job_id=job_id, video_path=dest_path))

    return {
        "job_id": job.id,
        "filename": job.filename,
        "status": job.status,
        "file_size_bytes": job.file_size_bytes,
        "duration_seconds": job.duration_seconds,
        "fps": job.fps,
        "total_frames": job.total_frames,
        "created_at": job.created_at.isoformat()
    }

@router.get("/jobs")
async def list_jobs(
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Lists video analysis jobs with optional status filter."""
    query = select(VideoAnalysisJob).order_by(desc(VideoAnalysisJob.created_at)).limit(limit)
    if status:
        query = query.where(VideoAnalysisJob.status == status)

    result = await db.execute(query)
    jobs = result.scalars().all()

    return [
        {
            "id": j.id,
            "filename": j.filename,
            "status": j.status,
            "activity_verdict": (
                "suspicious" if j.status == "completed" and (j.events_classified > 0)
                else "normal" if j.status == "completed"
                else "analyzing" if j.status in ["queued", "processing"]
                else j.status
            ),
            "progress": j.progress,
            "duration_seconds": j.duration_seconds,
            "fps": j.fps,
            "total_frames": j.total_frames,
            "processed_frames": j.processed_frames,
            "people_detected": j.people_detected,
            "unique_people": getattr(j, "unique_people", 0) or 0,
            "current_people": getattr(j, "current_people", 0) or 0,
            "events_classified": j.events_classified,
            "error_message": j.error_message,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "started_at": j.started_at.isoformat() if j.started_at else None,
            "completed_at": j.completed_at.isoformat() if j.completed_at else None
        }
        for j in jobs
    ]

@router.get("/jobs/{job_id}")
async def get_job_detail(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieves full job status and associated potential incidents."""
    result = await db.execute(select(VideoAnalysisJob).where(VideoAnalysisJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Video analysis job not found")

    # Fetch potential incidents generated for this job
    inc_res = await db.execute(
        select(PotentialIncident)
        .options(selectinload(PotentialIncident.evidence_items))
        .where(PotentialIncident.source_id == job_id)
        .order_by(PotentialIncident.timestamp_start)
    )
    incidents = inc_res.scalars().all()

    verdict = "analyzing"
    if job.status == "completed":
        verdict = "suspicious" if len(incidents) > 0 else "normal"
    elif job.status == "failed":
        verdict = "failed"
    elif job.status == "cancelled":
        verdict = "cancelled"

    return {
        "job": {
            "id": job.id,
            "filename": job.filename,
            "status": job.status,
            "activity_verdict": verdict,
            "progress": job.progress,
            "duration_seconds": job.duration_seconds,
            "fps": job.fps,
            "total_frames": job.total_frames,
            "processed_frames": job.processed_frames,
            "people_detected": job.people_detected,
            "unique_people": getattr(job, "unique_people", 0) or 0,
            "current_people": getattr(job, "current_people", 0) or 0,
            "events_classified": job.events_classified,
            "error_message": job.error_message,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None
        },
        "incidents": [
            {
                "id": inc.id,
                "category": inc.category,
                "confidence": inc.confidence,
                "timestamp_start": inc.timestamp_start,
                "timestamp_end": inc.timestamp_end,
                "review_status": inc.review_status,
                "reviewer_notes": inc.reviewer_notes,
                "evidence_clips": [
                    {
                        "id": ev.id,
                        "duration_seconds": ev.duration_seconds,
                        "file_size_bytes": ev.file_size_bytes,
                        "has_thumbnail": bool(ev.thumbnail_path)
                    }
                    for ev in inc.evidence_items
                ]
            }
            for inc in incidents
        ]
    }

@router.delete("/jobs/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Cancels a queued or processing job safely."""
    result = await db.execute(select(VideoAnalysisJob).where(VideoAnalysisJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status in ["completed", "failed", "cancelled"]:
        return {"status": job.status, "message": f"Job is already {job.status}"}

    video_processor.cancel_job(job_id)
    job.status = "cancelled"
    job.error_message = "Cancelled by user"
    await db.commit()
    return {"status": "cancelled", "message": "Job cancellation initiated"}

@router.get("/{job_id}/stream")
async def stream_video(
    job_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Streams video with HTTP 206 Partial Content range requests for seamless HTML5 playback.
    """
    result = await db.execute(select(VideoAnalysisJob).where(VideoAnalysisJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Video not found")

    video_path = Path(job.file_path)
    if not video_path.exists():
        fallback = settings.resolved_upload_dir / video_path.name
        if fallback.exists():
            video_path = fallback
        else:
            raise HTTPException(status_code=404, detail="Video file does not exist on storage")

    file_size = video_path.stat().st_size
    range_header = request.headers.get("range")

    if not range_header:
        # Full content
        def iterfile():
            with open(video_path, mode="rb") as f:
                yield from f
        return StreamingResponse(
            iterfile(),
            media_type="video/mp4",
            headers={"Content-Length": str(file_size)}
        )

    # Range request parsing
    byte1, byte2 = 0, None
    parts = range_header.replace("bytes=", "").split("-")
    if parts[0]:
        byte1 = int(parts[0])
    if len(parts) > 1 and parts[1]:
        byte2 = int(parts[1])

    length = (file_size - byte1) if byte2 is None else (byte2 - byte1 + 1)
    if byte2 is None:
        byte2 = file_size - 1

    def iter_chunk():
        with open(video_path, "rb") as f:
            f.seek(byte1)
            remaining = length
            while remaining > 0:
                chunk_size = min(remaining, 1024 * 512) # 512 KB
                data = f.read(chunk_size)
                if not data:
                    break
                remaining -= len(data)
                yield data

    return StreamingResponse(
        iter_chunk(),
        status_code=206,
        media_type="video/mp4",
        headers={
            "Content-Range": f"bytes {byte1}-{byte2}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
        }
    )
