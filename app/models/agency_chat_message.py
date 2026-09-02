"""ResQAI — Agency Chat Message model."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

class AgencyChatMessage(Base):
    __tablename__ = "agency_chat_messages"

    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("administrators.admin_id", ondelete="CASCADE"),
        nullable=False,
    )
    channel_id: Mapped[int | None] = mapped_column(Integer)
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    alert_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("emergency_alerts.alert_id", ondelete="SET NULL")
    )
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
