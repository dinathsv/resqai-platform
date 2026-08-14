"""ResQAI — Guest Session model."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geometry

from app.database import Base


class GuestSession(Base):
    __tablename__ = "guest_sessions"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nic_number: Mapped[str] = mapped_column(String(12), nullable=False)
    nic_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    nic_format_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    temp_token: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    gps_location = mapped_column(Geometry("POINT", srid=4326), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
