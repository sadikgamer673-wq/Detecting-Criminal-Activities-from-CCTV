from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.videos import router as videos_router
from app.api.v1.incidents import router as incidents_router
from app.api.v1.cameras import router as cameras_router
from app.api.v1.settings import router as settings_router

api_router = APIRouter()
api_router.include_router(health_router, prefix="/health", tags=["Health & System"])
api_router.include_router(videos_router, prefix="/videos", tags=["Video Processing & Upload"])
api_router.include_router(incidents_router, prefix="/incidents", tags=["Incidents & Evidence"])
api_router.include_router(cameras_router, prefix="/cameras", tags=["Camera Management"])
api_router.include_router(settings_router, prefix="/settings", tags=["System Settings"])
