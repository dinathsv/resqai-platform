"""ResQAI — Emergency Alert model."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geometry

from app.database import Base

class EmergencyAlert(Base):
    __tablename__ = "emergency_alerts"

    alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    admin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("administrators.admin_id", ondelete="CASCADE"),
        nullable=False,
    )
    disaster_type: Mapped[str] = mapped_column(
        ENUM("flood", "landslide", "tsunami", "earthquake", "fire", "medical", "search_and_rescue", "infrastructure_damage", "hazardous_material", "other", "donation", "help_rescue", name="emergency_type", create_type=False),
        nullable=False
    )
    severity: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    affected_zone = mapped_column(Geometry("POLYGON", srid=4326), nullable=True)
    work_plan: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        ENUM("active", "expired", "cancelled", name="alert_status", create_type=False),
        nullable=False,
        default="active"
    )
    delivered_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
