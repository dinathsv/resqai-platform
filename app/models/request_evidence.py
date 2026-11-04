"""Private, short-lived evidence. Ciphertext is never included in request feeds."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RequestEvidence(Base):
    __tablename__ = "request_evidence"
    __table_args__ = (UniqueConstraint("request_id", "kind", name="request_evidence_request_kind_key"),)

    evidence_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("help_requests.request_id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    encrypted_image: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    challenge_prompt: Mapped[str] = mapped_column(String(150), nullable=False)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
