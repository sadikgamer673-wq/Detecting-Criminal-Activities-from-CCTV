from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text
from app.database.base import Base

class Camera(Base):
    __tablename__ = "cameras"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    rtsp_url = Column(String(500), nullable=False)
    location = Column(String(150), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    status = Column(String(50), default="disconnected", nullable=False) # disconnected, connecting, connected, error, monitoring
    source_type = Column(String(50), default="ip_cctv", nullable=False) # webcam, ip_cctv, dvr_nvr, android_phone
    monitoring_active = Column(Boolean, default=False, nullable=False)
    last_error = Column(Text, nullable=True)
    resolution = Column(String(20), nullable=True)
    fps = Column(String(10), nullable=True)
    last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
