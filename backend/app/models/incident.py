from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base

class PotentialIncident(Base):
    __tablename__ = "potential_incidents"

    id = Column(String(36), primary_key=True, index=True)
    source_type = Column(String(20), nullable=False, index=True) # "camera" or "uploaded_video"
    source_id = Column(String(36), nullable=False, index=True)   # camera_id or job_id
    category = Column(String(100), nullable=False, index=True)   # e.g., "fighting", "weapon", "restricted_area"
    confidence = Column(Float, nullable=False)                   # 0.0 to 1.0
    timestamp_start = Column(Float, nullable=False)              # video second or unix timestamp
    timestamp_end = Column(Float, nullable=False)
    frame_index = Column(Integer, nullable=True)
    
    # Review statuses: potential, acknowledged, reviewed, dismissed, resolved
    review_status = Column(String(50), default="potential", nullable=False, index=True)
    reviewer_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    evidence_items = relationship("IncidentEvidence", back_populates="incident", cascade="all, delete-orphan")
