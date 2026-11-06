import uuid
import re
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone

from app.database.session import get_db
from app.models.camera import Camera
from app.services.cameras.manager import (
    camera_stream_manager,
    mask_rtsp_url,
    validate_and_classify_source
)

router = APIRouter()


class TestConnectionRequest(BaseModel):
    rtsp_url: str
    camera_name: Optional[str] = "Test Feed"


class CameraCreate(BaseModel):
    name: str
    rtsp_url: str
    source_type: Optional[str] = None
    location: Optional[str] = None


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    rtsp_url: Optional[str] = None
    source_type: Optional[str] = None
    location: Optional[str] = None
    is_active: Optional[bool] = None


class MonitoringRequest(BaseModel):
    ai_monitoring: bool = True


@router.post("/test-connection")
async def test_camera_connection(req: TestConnectionRequest):
    """
    Tests connection to an RTSP camera stream, webcam device index, or phone feed.
    Verifies frame receipt, calculates FPS/resolution, and masks all credentials.
    """
    result = camera_stream_manager.test_connection(
        source=req.rtsp_url,
        camera_name=req.camera_name or "Test Feed"
    )
    return result


@router.get("")
async def list_cameras(
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    """Lists configured cameras with masked credentials and live worker status."""
    query = select(Camera).order_by(desc(Camera.created_at))
    if is_active is not None:
        query = query.where(Camera.is_active == is_active)

    result = await db.execute(query)
    cameras = result.scalars().all()

    response = []
    for cam in cameras:
        worker = camera_stream_manager.get_worker(cam.id)
        is_monitored = worker.is_running if worker else cam.monitoring_active
        live_status = worker.status if worker else cam.status
        live_res = worker.resolution if (worker and worker.resolution != "Unknown") else cam.resolution
        live_fps = str(worker.fps_measured) if (worker and worker.fps_measured > 0) else cam.fps

        response.append({
            "id": cam.id,
            "name": cam.name,
            "rtsp_url": mask_rtsp_url(cam.rtsp_url),
            "source_type": cam.source_type or "ip_cctv",
            "location": cam.location,
            "is_active": cam.is_active,
            "status": live_status,
            "monitoring_active": is_monitored,
            "resolution": live_res,
            "fps": live_fps,
            "last_error": worker.last_error if worker else cam.last_error,
            "last_seen_at": cam.last_seen_at.isoformat() if cam.last_seen_at else None,
            "created_at": cam.created_at.isoformat()
        })

    return response


@router.post("")
async def create_camera(
    req: CameraCreate,
    db: AsyncSession = Depends(get_db)
):
    """Adds a new camera endpoint with validation and credential masking."""
    is_valid, inferred_type, val_err, _ = validate_and_classify_source(req.rtsp_url)
    if not is_valid:
        raise HTTPException(status_code=400, detail=mask_rtsp_url(val_err))

    source_type = req.source_type or inferred_type

    cam_id = str(uuid.uuid4())
    camera = Camera(
        id=cam_id,
        name=req.name.strip(),
        rtsp_url=req.rtsp_url.strip(),
        source_type=source_type,
        location=req.location.strip() if req.location else None,
        is_active=True,
        monitoring_active=False,
        status="disconnected"
    )

    db.add(camera)
    await db.commit()
    await db.refresh(camera)

    return {
        "id": camera.id,
        "name": camera.name,
        "rtsp_url": mask_rtsp_url(camera.rtsp_url),
        "source_type": camera.source_type,
        "location": camera.location,
        "is_active": camera.is_active,
        "monitoring_active": camera.monitoring_active,
        "status": camera.status,
        "created_at": camera.created_at.isoformat()
    }


@router.get("/{camera_id}")
async def get_camera(
    camera_id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    worker = camera_stream_manager.get_worker(cam.id)
    is_monitored = worker.is_running if worker else cam.monitoring_active
    live_status = worker.status if worker else cam.status

    return {
        "id": cam.id,
        "name": cam.name,
        "rtsp_url": mask_rtsp_url(cam.rtsp_url),
        "source_type": cam.source_type or "ip_cctv",
        "location": cam.location,
        "is_active": cam.is_active,
        "monitoring_active": is_monitored,
        "status": live_status,
        "resolution": worker.resolution if worker else cam.resolution,
        "fps": str(worker.fps_measured) if worker else cam.fps,
        "last_error": worker.last_error if worker else cam.last_error,
        "last_seen_at": cam.last_seen_at.isoformat() if cam.last_seen_at else None,
        "created_at": cam.created_at.isoformat()
    }


@router.put("/{camera_id}")
async def update_camera(
    camera_id: str,
    req: CameraUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    if req.name is not None:
        cam.name = req.name.strip()
    if req.rtsp_url is not None:
        is_valid, inferred_type, val_err, _ = validate_and_classify_source(req.rtsp_url)
        if not is_valid:
            raise HTTPException(status_code=400, detail=mask_rtsp_url(val_err))
        cam.rtsp_url = req.rtsp_url.strip()
        if req.source_type is None:
            cam.source_type = inferred_type
    if req.source_type is not None:
        cam.source_type = req.source_type
    if req.location is not None:
        cam.location = req.location.strip()
    if req.is_active is not None:
        cam.is_active = req.is_active

    cam.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(cam)

    return {
        "id": cam.id,
        "name": cam.name,
        "rtsp_url": mask_rtsp_url(cam.rtsp_url),
        "source_type": cam.source_type,
        "location": cam.location,
        "is_active": cam.is_active,
        "monitoring_active": cam.monitoring_active,
        "status": cam.status,
        "updated_at": cam.updated_at.isoformat()
    }


@router.delete("/{camera_id}")
async def delete_camera(
    camera_id: str,
    db: AsyncSession = Depends(get_db)
):
    # Stop monitoring if active
    camera_stream_manager.stop_monitoring(camera_id)

    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    await db.delete(cam)
    await db.commit()
    return {"message": "Camera removed successfully"}


@router.post("/{camera_id}/test")
async def test_saved_camera(
    camera_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Runs a connection probe on an already registered camera endpoint."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    test_res = camera_stream_manager.test_connection(
        source=cam.rtsp_url,
        camera_name=cam.name
    )

    if test_res.get("success"):
        cam.status = "connected"
        if test_res.get("stream_info"):
            cam.resolution = test_res["stream_info"].get("resolution")
            cam.fps = test_res["stream_info"].get("fps")
        cam.last_seen_at = datetime.now(timezone.utc)
        cam.last_error = None
    else:
        cam.status = test_res.get("status") or "connection_failed"
        cam.last_error = test_res.get("error_message")

    cam.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return test_res


@router.post("/{camera_id}/start-monitoring")
async def start_camera_monitoring(
    camera_id: str,
    req: MonitoringRequest = MonitoringRequest(),
    db: AsyncSession = Depends(get_db)
):
    """
    Starts background capture and AI monitoring for a camera.
    Prevents duplicate capture threads by returning existing worker if already active.
    """
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    worker = camera_stream_manager.start_monitoring(
        camera_id=cam.id,
        name=cam.name,
        rtsp_url=cam.rtsp_url,
        source_type=cam.source_type or "ip_cctv",
        ai_monitoring=req.ai_monitoring
    )

    cam.monitoring_active = True
    cam.status = "monitoring" if req.ai_monitoring else "connected"
    cam.last_seen_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "message": f"Monitoring started for camera '{cam.name}'",
        "camera_id": cam.id,
        "status": worker.status,
        "ai_monitoring": worker.ai_monitoring
    }


@router.post("/{camera_id}/stop-monitoring")
async def stop_camera_monitoring(
    camera_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Stops background capture and releases camera resources."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    camera_stream_manager.stop_monitoring(camera_id)

    cam.monitoring_active = False
    cam.status = "disconnected"
    cam.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "message": f"Monitoring stopped for camera '{cam.name}'",
        "camera_id": cam.id,
        "status": "disconnected"
    }


@router.get("/{camera_id}/stream")
async def get_camera_stream(
    camera_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    MJPEG live stream for low-latency browser video display.
    Connects to the active background capture worker.
    """
    worker = camera_stream_manager.get_worker(camera_id)
    if not worker or not worker.is_running:
        # Auto-start worker if camera exists in DB
        result = await db.execute(select(Camera).where(Camera.id == camera_id))
        cam = result.scalar_one_or_none()
        if not cam:
            raise HTTPException(status_code=404, detail="Camera not found")

        worker = camera_stream_manager.start_monitoring(
            camera_id=cam.id,
            name=cam.name,
            rtsp_url=cam.rtsp_url,
            source_type=cam.source_type or "ip_cctv",
            ai_monitoring=True
        )

    return StreamingResponse(
        worker.gen_mjpeg(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@router.get("/{camera_id}/snapshot")
async def get_camera_snapshot(
    camera_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Returns the latest JPEG frame snapshot from the camera worker."""
    worker = camera_stream_manager.get_worker(camera_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Camera stream is not currently active")

    snapshot = worker.get_snapshot()
    if snapshot is None:
        raise HTTPException(status_code=503, detail="Camera frame not yet available")

    return Response(content=snapshot, media_type="image/jpeg")


@router.get("/{camera_id}/telemetry")
async def get_camera_telemetry(
    camera_id: str
):
    """Returns real-time telemetry metrics (FPS, frames, tracked people, incidents)."""
    worker = camera_stream_manager.get_worker(camera_id)
    if not worker:
        return {
            "camera_id": camera_id,
            "status": "disconnected",
            "is_running": False,
            "ai_monitoring": False,
            "fps": "0.0",
            "frames_received": 0,
            "unique_people": 0,
            "current_people": 0,
            "incidents_detected": 0,
            "weapons_detected": 0,
            "active_weapons": [],
            "latest_weapon_alert": None
        }

    return worker.get_telemetry()
