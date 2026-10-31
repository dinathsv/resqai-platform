"""ResQAI — Donation model."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, CheckConstraint, func
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

class Donation(Base):
    __tablename__ = "donations"
    __table_args__ = (
        CheckConstraint("need_id IS NULL OR (quantity IS NOT NULL AND quantity > 0 AND received_quantity >= 0 AND dispatched_quantity >= 0 AND delivered_quantity >= 0 AND delivered_quantity <= dispatched_quantity AND dispatched_quantity <= received_quantity AND received_quantity <= quantity)", name="ck_goods_quantities"),
    )

    donation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    donor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    mission_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("relief_missions.mission_id", ondelete="SET NULL")
    )
    need_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("mission_needs.need_id"), nullable=True)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    received_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    dispatched_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    delivered_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    item_condition: Mapped[str | None] = mapped_column(String(20), nullable=True)
    availability_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_pledge_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), unique=True, nullable=True)
    goods_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(ENUM('pending', 'completed', 'failed', 'refunded', name="donation_status", create_type=False), nullable=False, default="pending")
    transaction_ref: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
