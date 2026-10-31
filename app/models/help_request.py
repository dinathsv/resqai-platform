"""ResQAI — Help Request model."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geometry

from app.database import Base

class HelpRequest(Base):
    __tablename__ = "help_requests"

    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE")
    )
    guest_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guest_sessions.session_id", ondelete="CASCADE")
    )
    original_message: Mapped[str] = mapped_column(Text, nullable=False)
    emergency_type: Mapped[str] = mapped_column(
        ENUM("flood", "landslide", "tsunami", "earthquake", "fire", "medical", "search_and_rescue", "infrastructure_damage", "hazardous_material", "other", "donation", "help_rescue", name="emergency_type", create_type=False),
        nullable=False
    )
    urgency_level: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    gps_location = mapped_column(Geometry("POINT", srid=4326), nullable=True)
    status: Mapped[str] = mapped_column(
        ENUM("pending", "ai_processing", "verified", "dispatched", "in_progress", "resolved", "cancelled", name="request_status", create_type=False),
        nullable=False,
        default="pending"
    )
    ai_summary: Mapped[str | None] = mapped_column(Text)
    admin_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    verification_status: Mapped[str] = mapped_column(String(30), nullable=False, default="unverified")
    verification_method: Mapped[str | None] = mapped_column(String(40))
    verification_notes: Mapped[str | None] = mapped_column(Text)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("administrators.admin_id", ondelete="SET NULL"))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    affected_people: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    location_source: Mapped[str] = mapped_column(String(20), nullable=False, default="unknown")
    location_label: Mapped[str | None] = mapped_column(String(255))
    requested_items: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    evidence_note: Mapped[str | None] = mapped_column(Text)
    risk_flags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    client_request_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), unique=True)
    submission_fingerprint: Mapped[str | None] = mapped_column(String(64))
    triage_source: Mapped[str] = mapped_column(String(30), nullable=False, default="rules")
    incident_type: Mapped[str | None] = mapped_column(String(40))
    is_guest_request: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
