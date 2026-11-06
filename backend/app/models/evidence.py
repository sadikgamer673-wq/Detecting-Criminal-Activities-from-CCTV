from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base

class IncidentEvidence(Base):
    __tablename__ = "incident_evidence"

    id = Column(String(36), primary_key=True, index=True)
    incident_id = Column(String(36), ForeignKey("potential_incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    clip_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=True)
    duration_seconds = Column(Float, nullable=False, default=0.0)
    file_size_bytes = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    incident = relationship("PotentialIncident", back_populates="evidence_items")
