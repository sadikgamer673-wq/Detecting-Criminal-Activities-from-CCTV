import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class SettingsResponse(BaseModel):
    sampling_rate_fps: int
    confidence_threshold: float
    weapon_confidence_threshold: float
    weapon_consecutive_frames: int
    event_cooldown_seconds: int
    max_upload_size_mb: int
    app_name: str
    app_env: str
    inference_device: str
    model_name: str
    weapon_model_name: str
    database_engine: str
    upload_dir: str
    incident_dir: str
    model_dir: str


class SettingsUpdateRequest(BaseModel):
    sampling_rate_fps: Optional[int] = Field(None, ge=1, le=30, description="CPU frame subsampling rate (1-30 FPS)")
    confidence_threshold: Optional[float] = Field(None, ge=0.05, le=0.95, description="Person detection confidence threshold")
    weapon_confidence_threshold: Optional[float] = Field(None, ge=0.05, le=0.95, description="Weapon detection confidence threshold")
    weapon_consecutive_frames: Optional[int] = Field(None, ge=1, le=10, description="Consecutive frames required to verify weapon")
    event_cooldown_seconds: Optional[int] = Field(None, ge=1, le=120, description="Incident alert cooldown window in seconds")


def _get_current_settings_dict() -> dict:
    return {
        "sampling_rate_fps": settings.SAMPLING_RATE_FPS,
        "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
        "weapon_confidence_threshold": settings.WEAPON_CONFIDENCE_THRESHOLD,
        "weapon_consecutive_frames": settings.WEAPON_CONSECUTIVE_FRAMES,
        "event_cooldown_seconds": settings.EVENT_COOLDOWN_SECONDS,
        "max_upload_size_mb": settings.MAX_UPLOAD_SIZE_MB,
        "app_name": settings.APP_NAME,
        "app_env": settings.APP_ENV,
        "inference_device": "CPU (Intel / AMD x86_64)",
        "model_name": "yolov8n.pt (COCO 80 Classes)",
        "weapon_model_name": settings.WEAPON_MODEL_NAME,
        "database_engine": "SQLite 3 (WAL mode)",
        "upload_dir": str(settings.resolved_upload_dir),
        "incident_dir": str(settings.resolved_incident_dir),
        "model_dir": str(settings.resolved_model_dir),
    }


@router.get("", response_model=SettingsResponse)
@router.get("/", response_model=SettingsResponse)
async def get_system_settings():
    """Retrieve the current active runtime system configuration and model parameters."""
    return _get_current_settings_dict()


@router.put("", response_model=SettingsResponse)
@router.put("/", response_model=SettingsResponse)
async def update_system_settings(payload: SettingsUpdateRequest):
    """
    Dynamically update runtime settings for sampling rate, confidence thresholds,
    and alert deduplication cooldown windows.
    """
    try:
        if payload.sampling_rate_fps is not None:
            settings.SAMPLING_RATE_FPS = payload.sampling_rate_fps
        if payload.confidence_threshold is not None:
            settings.CONFIDENCE_THRESHOLD = round(payload.confidence_threshold, 2)
        if payload.weapon_confidence_threshold is not None:
            settings.WEAPON_CONFIDENCE_THRESHOLD = round(payload.weapon_confidence_threshold, 2)
        if payload.weapon_consecutive_frames is not None:
            settings.WEAPON_CONSECUTIVE_FRAMES = payload.weapon_consecutive_frames
        if payload.event_cooldown_seconds is not None:
            settings.EVENT_COOLDOWN_SECONDS = payload.event_cooldown_seconds

        logger.info(
            f"System settings updated: sampling_fps={settings.SAMPLING_RATE_FPS}, "
            f"conf={settings.CONFIDENCE_THRESHOLD}, weapon_conf={settings.WEAPON_CONFIDENCE_THRESHOLD}, "
            f"weapon_frames={settings.WEAPON_CONSECUTIVE_FRAMES}, cooldown={settings.EVENT_COOLDOWN_SECONDS}"
        )
        return _get_current_settings_dict()
    except Exception as e:
        logger.error(f"Error updating system settings: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update settings: {str(e)}"
        )


@router.post("/reset", response_model=SettingsResponse)
async def reset_system_settings():
    """Reset dynamic parameters to factory defaults."""
    settings.SAMPLING_RATE_FPS = 5
    settings.CONFIDENCE_THRESHOLD = 0.25
    settings.WEAPON_CONFIDENCE_THRESHOLD = 0.35
    settings.WEAPON_CONSECUTIVE_FRAMES = 2
    settings.EVENT_COOLDOWN_SECONDS = 10
    logger.info("System settings reset to factory defaults.")
    return _get_current_settings_dict()
