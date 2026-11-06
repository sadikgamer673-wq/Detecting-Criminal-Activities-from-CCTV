from pydantic import BaseModel
from typing import Dict, Any, Optional

class StorageStatus(BaseModel):
    uploads_dir: str
    uploads_writable: bool
    incidents_dir: str
    incidents_writable: bool
    models_dir: str
    models_writable: bool

class SystemMetrics(BaseModel):
    cpu_percent: float
    cpu_cores_physical: int
    cpu_cores_logical: int
    memory_total_mb: float
    memory_used_mb: float
    memory_percent: float
    disk_free_gb: float

class HealthResponse(BaseModel):
    status: str
    app_name: str
    environment: str
    database_connected: bool
    database_type: str
    uptime_seconds: float
    system: SystemMetrics
    storage: StorageStatus
    active_cameras_count: int
    active_jobs_count: int
    unreviewed_incidents_count: int
    version: str = "1.0.0"
