"""Optional private identity evidence, separate from immediate public reports."""

import asyncio
import hashlib
import json
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from cryptography.exceptions import InvalidTag
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.middleware.auth import get_current_user, require_role
from app.models.audit_log import AuditLog
from app.models.guest_session import GuestSession
from app.models.request_evidence import RequestEvidence
from app.routers.auth import get_redis
from app.routers.requests import owned_request
from app.services.evidence_security import (
    MAX_BODY_BYTES, MAX_IMAGE_STRING, PRIVATE_HEADERS, decrypt_image,
    encrypt_image, evidence_configured, evidence_key, normalize_image,
)

router = APIRouter(tags=["Private request verification"])
logger = logging.getLogger("resqai.evidence")
UPLOAD_TIMEOUT_SECONDS = 20
REVIEW_NOTE = "Private images support human review. Uploads do not verify identity, liveness or the reported incident. Images expire after seven days."


class EvidenceUpload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    challenge_id: uuid.UUID
    nic_image: str = Field(..., max_length=MAX_IMAGE_STRING)
    selfie_image: str = Field(..., max_length=MAX_IMAGE_STRING)
    captured_at: AwareDatetime
    consent: bool = Field(..., strict=True)


def audit(db, user, action, entity_id):
    db.add(AuditLog(
        admin_id=uuid.UUID(user["sub"]) if user["role"] == "admin" else None,
        user_id=uuid.UUID(user["sub"]) if user["role"] == "people" else None,
        action=action, entity_type="request_evidence", entity_id=entity_id,
    ))


async def upload_owner(request_id, user, db, lock=False):
    if user["role"] not in {"people", "guest"}:
        raise HTTPException(403, "Only the requester can submit identity evidence.")
    record = await owned_request(request_id, user, db, lock=lock)
    if user["role"] == "guest":
        guest = await db.get(GuestSession, uuid.UUID(user["sub"]))
        if not guest or not guest.phone_verified:
            raise HTTPException(403, "Verify your mobile number before submitting private evidence.")
    if (record.verification_status not in {"unverified", "needs_information"}
            or record.admin_status != "pending" or record.status in {"resolved", "cancelled"}):
        raise HTTPException(409, "This request is already being handled. Contact its coordinator for verification changes.")
    return record


async def rate_limit(redis, user, purpose, limit):
    subject = hashlib.sha256(f'{user["role"]}:{user["sub"]}'.encode()).hexdigest()
    try:
        key = f"evidence-rate:{purpose}:{subject}"
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 3600)
        if count > limit:
            raise HTTPException(429, "Too many verification attempts. Try again later; your request remains saved.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Private verification is temporarily unavailable. Your request remains saved.") from None


@router.post("/{request_id}/verification-evidence/challenge")
async def create_challenge(
    request_id: uuid.UUID, response: Response,
    user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    response.headers.update(PRIVATE_HEADERS)
    evidence_key()  # Fail closed if a dedicated encryption key is missing.
    await upload_owner(request_id, user, db)
    await rate_limit(redis, user, "challenge", 10)
    challenge_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    challenge_code = str(secrets.randbelow(900000) + 100000)
    prompt = f"Write code {challenge_code} on paper and hold it beside your face for the camera selfie."
    value = {"request_id": str(request_id), "subject": user["sub"], "role": user["role"],
             "issued_at": now.isoformat(), "prompt": prompt}
    try:
        await redis.set(f"evidence-challenge:{challenge_id}", json.dumps(value), ex=300)
    except Exception:
        raise HTTPException(503, "The capture challenge is unavailable. Your request remains saved.") from None
    return {"challenge_id": str(challenge_id), "challenge_code": challenge_code, "prompt": prompt, "expires_at": (now + timedelta(minutes=5)).isoformat()}


async def bounded_upload(request: Request) -> EvidenceUpload:
    # Read before Pydantic parsing so oversized JSON and invalid image fields are
    # rejected without echoing private image strings in a validation response.
    if request.headers.get("content-type", "").split(";")[0].strip() != "application/json":
        raise HTTPException(415, "Send verification images as JSON.")
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_BODY_BYTES:
            raise HTTPException(413, "Verification images exceed the upload limit.")
        body.extend(chunk)
    try:
        return EvidenceUpload.model_validate_json(body)
    except ValidationError:
        raise HTTPException(422, "Provide an NIC image, a new camera selfie, capture time, challenge and explicit consent.") from None


@router.post("/{request_id}/verification-evidence", status_code=201)
async def upload_evidence(
    request_id: uuid.UUID, request: Request, response: Response,
    user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    response.headers.update(PRIVATE_HEADERS)
    evidence_key()
    await upload_owner(request_id, user, db)
    await rate_limit(redis, user, "upload", 10)
    try:
        body = await asyncio.wait_for(bounded_upload(request), timeout=UPLOAD_TIMEOUT_SECONDS)
    except TimeoutError:
        raise HTTPException(408, "The image upload took too long. Your help request remains saved.") from None
    if not body.consent:
        raise HTTPException(422, "Consent to private reviewer access is required before uploading images.")
    key = f"evidence-challenge:{body.challenge_id}"
    try:
        raw = await redis.get(key)
        challenge = json.loads(raw) if raw else None
    except Exception:
        raise HTTPException(503, "Private verification is temporarily unavailable.") from None
    if (not challenge or challenge["request_id"] != str(request_id)
            or challenge["subject"] != user["sub"] or challenge["role"] != user["role"]):
        raise HTTPException(409, "Start a new capture challenge for this request.")
    now = datetime.now(timezone.utc)
    issued = datetime.fromisoformat(challenge["issued_at"])
    if (now - issued > timedelta(minutes=5) or body.captured_at < issued
            or body.captured_at > now + timedelta(seconds=30)):
        raise HTTPException(409, "The capture challenge expired or the selfie predates it. Capture a new selfie.")
    nic = await asyncio.to_thread(normalize_image, body.nic_image)
    selfie = await asyncio.to_thread(normalize_image, body.selfie_image)
    # Do not hold the incident row lock while a client streams images or image
    # decoders run. Recheck its current status under lock just before writing.
    await upload_owner(request_id, user, db, lock=True)
    # Consume atomically only after validation. Parallel/replayed uploads cannot
    # share a capture authorization, including from another request or account.
    try:
        consumed = await redis.getdel(key)
    except Exception:
        raise HTTPException(503, "Private verification is temporarily unavailable.") from None
    if consumed != raw:
        raise HTTPException(409, "This capture challenge was already used. Start a new challenge.")
    await db.execute(delete(RequestEvidence).where(RequestEvidence.request_id == request_id))
    for kind, image in (("nic", nic), ("selfie", selfie)):
        evidence_id = uuid.uuid4()
        db.add(RequestEvidence(
            evidence_id=evidence_id, request_id=request_id, kind=kind,
            encrypted_image=encrypt_image(image, request_id, evidence_id, kind),
            challenge_prompt=challenge["prompt"], captured_at=body.captured_at,
            created_at=now, expires_at=now + timedelta(days=7),
        ))
    audit(db, user, "request_evidence_uploaded", request_id)
    await db.commit()
    return {"status": "pending_review", "expires_at": (now + timedelta(days=7)).isoformat(), "review_note": REVIEW_NOTE}


@router.get("/{request_id}/verification-evidence")
async def list_evidence(
    request_id: uuid.UUID, response: Response,
    user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    response.headers.update(PRIVATE_HEADERS)
    await owned_request(request_id, user, db)
    now = datetime.now(timezone.utc)
    await db.execute(delete(RequestEvidence).where(RequestEvidence.request_id == request_id, RequestEvidence.expires_at <= now))
    rows = (await db.execute(select(
        RequestEvidence.evidence_id, RequestEvidence.kind, RequestEvidence.created_at,
        RequestEvidence.expires_at, RequestEvidence.challenge_prompt, RequestEvidence.captured_at,
    ).where(RequestEvidence.request_id == request_id).order_by(RequestEvidence.kind))).mappings().all()
    if user["role"] == "admin":
        audit(db, user, "request_evidence_listed", request_id)
    await db.commit()
    return {"configured": evidence_configured(), "items": [
        {key: str(value) if isinstance(value, uuid.UUID) else value.isoformat() if isinstance(value, datetime) else value
         for key, value in row.items()} for row in rows
    ], "review_note": REVIEW_NOTE}


@router.get("/{request_id}/verification-evidence/{evidence_id}/image")
async def view_evidence(
    request_id: uuid.UUID, evidence_id: uuid.UUID,
    user: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db),
):
    await owned_request(request_id, user, db)
    row = (await db.execute(select(RequestEvidence).where(
        RequestEvidence.evidence_id == evidence_id, RequestEvidence.request_id == request_id,
        RequestEvidence.expires_at > datetime.now(timezone.utc),
    ))).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Verification image is unavailable or has expired.")
    try:
        image = decrypt_image(row.encrypted_image, request_id, evidence_id, row.kind)
    except (InvalidTag, ValueError):
        raise HTTPException(503, "The verification image could not be opened.") from None
    audit(db, user, "request_evidence_viewed", evidence_id)
    await db.commit()  # Audit must succeed before returning sensitive bytes.
    return Response(image, media_type="image/jpeg", headers={**PRIVATE_HEADERS, "Content-Disposition": 'inline; filename="verification.jpg"'})


@router.delete("/{request_id}/verification-evidence")
async def delete_evidence(
    request_id: uuid.UUID, response: Response,
    user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    response.headers.update(PRIVATE_HEADERS)
    await owned_request(request_id, user, db, lock=True)
    await db.execute(delete(RequestEvidence).where(RequestEvidence.request_id == request_id))
    audit(db, user, "request_evidence_deleted", request_id)
    await db.commit()
    return {"deleted": True}


async def purge_expired_evidence():
    """Remove expired ciphertext hourly, including when nobody opens the request."""
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await db.execute(delete(RequestEvidence).where(RequestEvidence.expires_at <= datetime.now(timezone.utc)))
                await db.commit()
        except Exception:
            logger.warning("Expired private evidence cleanup failed; access still enforces expiry")
        await asyncio.sleep(3600)
