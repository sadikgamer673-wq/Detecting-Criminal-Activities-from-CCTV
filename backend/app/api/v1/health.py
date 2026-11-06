import time
import os
import psutil
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func

from app.core.config import settings
from app.database.session import get_db
from app.schemas.health import HealthResponse, SystemMetrics, StorageStatus
from app.models.camera import Camera
from app.models.job import VideoAnalysisJob
from app.models.incident import PotentialIncident

router = APIRouter()
START_TIME = time.time()

def check_dir_writable(path) -> bool:
    try:
        test_file = path / ".write_test"
        test_file.touch()
        test_file.unlink()
        return True
    except Exception:
        return False

@router.get("", response_model=HealthResponse)
async def get_health(db: AsyncSession = Depends(get_db)):
    db_connected = False
    cameras_count = 0
    jobs_count = 0
    incidents_count = 0

    try:
        res = await db.execute(text("SELECT 1"))
        if res.scalar() == 1:
            db_connected = True
            
        # Get real counts
        cam_res = await db.execute(select(func.count(Camera.id)).where(Camera.is_active.is_(True)))
        cameras_count = cam_res.scalar() or 0

        job_res = await db.execute(select(func.count(VideoAnalysisJob.id)).where(VideoAnalysisJob.status.in_(["queued", "processing"])))
        jobs_count = job_res.scalar() or 0

        inc_res = await db.execute(select(func.count(PotentialIncident.id)).where(PotentialIncident.review_status == "potential"))
        incidents_count = inc_res.scalar() or 0
    except Exception:
        db_connected = False

    # Check directories
    upload_dir = settings.resolved_upload_dir
    incident_dir = settings.resolved_incident_dir
    model_dir = settings.resolved_model_dir

    storage = StorageStatus(
        uploads_dir=str(upload_dir),
        uploads_writable=check_dir_writable(upload_dir),
        incidents_dir=str(incident_dir),
        incidents_writable=check_dir_writable(incident_dir),
        models_dir=str(model_dir),
        models_writable=check_dir_writable(model_dir)
    )

    # System metrics via psutil
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage(str(upload_dir.anchor))

    system = SystemMetrics(
        cpu_percent=psutil.cpu_percent(interval=None),
        cpu_cores_physical=psutil.cpu_count(logical=False) or 1,
        cpu_cores_logical=psutil.cpu_count(logical=True) or 1,
        memory_total_mb=round(vm.total / (1024 * 1024), 2),
        memory_used_mb=round(vm.used / (1024 * 1024), 2),
        memory_percent=vm.percent,
        disk_free_gb=round(disk.free / (1024 * 1024 * 1024), 2)
    )

    overall_status = "healthy" if db_connected and storage.uploads_writable else "degraded"

    return HealthResponse(
        status=overall_status,
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
        database_connected=db_connected,
        database_type="SQLite (WAL)",
        uptime_seconds=round(time.time() - START_TIME, 2),
        system=system,
        storage=storage,
        active_cameras_count=cameras_count,
        active_jobs_count=jobs_count,
        unreviewed_incidents_count=incidents_count,
        version="1.0.0"
    )
