"""ResQAI — Relief Mission model."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geometry

from app.database import Base

class ReliefMission(Base):
    __tablename__ = "relief_missions"

    mission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    admin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("administrators.admin_id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    target_zone = mapped_column(Geometry(srid=4326), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="planning")
    funds_collected: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
