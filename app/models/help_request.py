"""ResQAI — Help Request model."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
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
    emergency_type: Mapped[str] = mapped_column(String(50), nullable=False)
    urgency_level: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    gps_location = mapped_column(Geometry("POINT", srid=4326), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="submitted")
    ai_summary: Mapped[str | None] = mapped_column(Text)
    is_guest_request: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
