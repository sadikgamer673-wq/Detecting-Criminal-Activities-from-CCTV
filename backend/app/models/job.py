from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, Text
from app.database.base import Base

class VideoAnalysisJob(Base):
    __tablename__ = "video_analysis_jobs"

    id = Column(String(36), primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, nullable=False, default=0)
    status = Column(String(50), default="queued", nullable=False, index=True) # queued, processing, completed, failed, cancelled
    progress = Column(Float, default=0.0, nullable=False) # 0.0 to 100.0
    duration_seconds = Column(Float, nullable=True)
    fps = Column(Float, nullable=True)
    total_frames = Column(Integer, default=0, nullable=False)
    processed_frames = Column(Integer, default=0, nullable=False)
    people_detected = Column(Integer, default=0, nullable=False) # Total bounding-box detections
    unique_people = Column(Integer, default=0, nullable=False)   # Distinct tracked individuals
    current_people = Column(Integer, default=0, nullable=False)  # People in latest sampled frame
    events_classified = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
