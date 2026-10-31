"""
ResQAI — Requests Router.
Handles help requests creation, listing, locating resources, and status updates.
"""

import logging
import os
import uuid
import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import desc, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.middleware.auth import get_current_user, get_optional_user, require_role
from app.models.help_request import HelpRequest
from app.models.request_history import RequestVerification, RequestStatusHistory
from app.services.request_triage import similar_report, triage_request
from app.routers.auth import get_redis

logger = logging.getLogger("resqai.requests")
router = APIRouter(tags=["Requests"])

class RequestedItem(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    item_name: str = Field(..., min_length=2, max_length=120)
    quantity: int = Field(..., ge=1, le=100000)
    unit: str = Field(..., min_length=1, max_length=30)


class SubmitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    message: str = Field(..., min_length=5, max_length=5000)
    lat: float | None = Field(None, ge=-90, le=90)
    lng: float | None = Field(None, ge=-180, le=180)
    request_type: Literal["donation", "help_rescue"] = "help_rescue"
    location_source: Literal["gps", "manual", "unknown"] = "unknown"
    location_label: str | None = Field(None, max_length=255)
    affected_people: int = Field(1, ge=1, le=100000)
    requested_items: list[RequestedItem] = Field(default_factory=list, max_length=30)
    evidence_note: str | None = Field(None, max_length=2000)
    urgency_level: int | None = Field(None, ge=1, le=5)
    client_request_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def valid_location_and_needs(self):
        if (self.lat is None) != (self.lng is None):
            raise ValueError("Provide both coordinates or leave both unknown")
        if self.location_source == "gps" and self.lat is None:
            raise ValueError("GPS location requires coordinates")
        if self.request_type == "donation" and not self.requested_items:
            raise ValueError("Goods requests require item names, quantities and units")
        return self


def request_response(record: HelpRequest, private: bool = False) -> dict:
    data = {
        "request_id": str(record.request_id), "emergency_type": record.emergency_type,
        "request_type": record.emergency_type, "urgency_level": record.urgency_level,
        "status": record.status, "admin_status": record.admin_status,
        "verification_status": record.verification_status,
        "location_source": record.location_source,
        "affected_people": record.affected_people, "requested_items": record.requested_items,
        "triage_source": record.triage_source, "incident_type": record.incident_type,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "message": "Verified goods assistance request" if record.emergency_type == "donation" else "Verified help request",
    }
    if private:
        data.update(message=record.original_message, ai_summary=record.ai_summary, location_label=record.location_label,
                    verification_notes=record.verification_notes, evidence_note=record.evidence_note)
    return data


class StatusUpdateRequest(BaseModel):
    status: str


class RequestInformationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    message: str | None = Field(None, min_length=5, max_length=5000)
    evidence_note: str | None = Field(None, max_length=2000)
    affected_people: int | None = Field(None, ge=1, le=100000)
    requested_items: list[RequestedItem] | None = Field(None, min_length=1, max_length=30)
    location_label: str | None = Field(None, max_length=255)

async def notify_new_request(
    request_id: str,
    emergency_type: str,
    urgency_level: int,
    message: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    ai_summary: str | None = None,
):
    """
    Alert admins and community users about new help and donation requests.
    Sends a real-time WebSocket event to the Node.js backend.
    """
    node_backend_url = (getattr(settings, "NODE_BACKEND_URL", None) or os.getenv("NODE_BACKEND_URL") or "http://localhost:5000").rstrip("/")
    payload = {
        "request_id": request_id,
        "emergency_type": emergency_type,
        "urgency_level": urgency_level,
        "message": message,
        "lat": lat,
        "lng": lng,
        "ai_summary": ai_summary,
    }
    logger.info(
        "NEW REQUEST ALERT: type=%s urgency=%d request=%s target=%s",
        emergency_type, urgency_level, request_id, node_backend_url,
    )
    headers = {}
    if settings.INTERNAL_API_KEY:
        headers["X-Internal-API-Key"] = settings.INTERNAL_API_KEY

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{node_backend_url}/api/requests/new",
                json=payload,
                headers=headers,
                timeout=5.0,
            )
            if resp.status_code == 200:
                logger.info("New request alert delivered to Node backend at %s", node_backend_url)
            else:
                logger.error("New request alert delivery failed (%d): %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.error("Failed to send new request alert to Node backend at %s: %s", node_backend_url, exc)

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_request(
    req: SubmitRequest,
    http_request: Request,
    current_user: dict[str, Any] | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
    redis_client=Depends(get_redis),
):
    """Save an unverified incident; notify coordinators without publicly exposing a claim."""
    role = current_user.get("role") if current_user else "guest"
    subject = current_user.get("sub") if current_user else None
    if req.request_type == "donation" and role != "people":
        raise HTTPException(status_code=403, detail="A verified registered account is required to request emergency goods.")
    fingerprint = hashlib.sha256(json.dumps({
        "owner": subject, "role": role, "payload": req.model_dump(mode="json", exclude={"client_request_id"})
    }, sort_keys=True).encode()).hexdigest()
    if req.client_request_id:
        existing = (await db.execute(select(HelpRequest).where(HelpRequest.client_request_id == req.client_request_id))).scalar_one_or_none()
        if existing:
            if existing.submission_fingerprint != fingerprint:
                raise HTTPException(status_code=409, detail="This submission ID already belongs to different request data.")
            return request_response(existing, private=True)

    rate_subject = subject or (http_request.client.host if http_request.client else "anonymous")
    rate_key = "request_rate:" + hashlib.sha256(rate_subject.encode()).hexdigest()
    try:
        count = await redis_client.incr(rate_key)
        if count == 1:
            await redis_client.expire(rate_key, 60)
        if count > 30:
            raise HTTPException(status_code=429, detail="Too many requests. Your emergency draft can be retried in a minute.")
    except HTTPException:
        raise
    except Exception:
        # A cache outage must not discard a life-threatening SOS.
        logger.warning("Request rate limiter temporarily unavailable")

    triage = await triage_request(req.message, req.request_type, req.urgency_level)
    flags = []
    if req.lat is None:
        flags.append("location_not_confirmed")
    if not subject:
        flags.append("anonymous_report")
    elif role == "guest" and current_user.get("identity_status") != "approved":
        flags.append("identity_review_pending")
    recent = (await db.execute(select(HelpRequest).where(
        HelpRequest.created_at >= datetime.now(timezone.utc) - timedelta(hours=24),
        HelpRequest.emergency_type == req.request_type,
    ).order_by(HelpRequest.created_at.desc()).limit(100))).scalars().all()
    if any(similar_report(req.message, other.original_message) for other in recent):
        flags.append("similar_recent_report_review_required")

    record = HelpRequest(
        request_id=uuid.uuid4(), user_id=uuid.UUID(subject) if subject and role == "people" else None,
        guest_session_id=uuid.UUID(subject) if subject and role == "guest" else None,
        is_guest_request=role == "guest", original_message=req.message,
        emergency_type=req.request_type, status="pending", admin_status="pending",
        verification_status="unverified", affected_people=req.affected_people,
        location_source=req.location_source, location_label=req.location_label,
        requested_items=[item.model_dump() for item in req.requested_items], evidence_note=req.evidence_note,
        risk_flags=flags, client_request_id=req.client_request_id, submission_fingerprint=fingerprint,
        **triage,
    )
    if req.lat is not None:
        record.gps_location = f"SRID=4326;POINT({req.lng} {req.lat})"
    db.add(record)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        if req.client_request_id:
            existing = (await db.execute(select(HelpRequest).where(HelpRequest.client_request_id == req.client_request_id))).scalar_one_or_none()
            if existing and existing.submission_fingerprint == fingerprint:
                return request_response(existing, private=True)
        raise HTTPException(status_code=409, detail="Submission conflicts with an existing request") from None
    await db.refresh(record)
    await notify_new_request(str(record.request_id), record.emergency_type, record.urgency_level,
                             req.message, req.lat, req.lng, record.ai_summary)
    return request_response(record, private=True)

@router.get("/locate")
async def locate_resources(
    lat: float,
    lng: float,
    emergency_type: str,
    db: AsyncSession = Depends(get_db),
):
    """Find nearest hospitals and get AI recommendation (public endpoint)."""

    sql = text("""
        SELECT hospital_id, name, phone, specialization,
               has_cardiac_icu, has_trauma_unit,
               ST_Y(gps_location::geometry) AS latitude,
               ST_X(gps_location::geometry) AS longitude,
               ST_Distance(
                 gps_location::geography,
                 ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
               ) AS distance_meters
        FROM hospitals WHERE is_active=true
        ORDER BY distance_meters ASC LIMIT 15
    """)

    result = await db.execute(sql, {"lat": lat, "lng": lng})
    rows = result.mappings().all()

    hospitals = []
    for row in rows:
        lat_val = float(row["latitude"]) if row["latitude"] is not None else 0.0
        lng_val = float(row["longitude"]) if row["longitude"] is not None else 0.0
        dist_val = float(row["distance_meters"]) if row["distance_meters"] is not None else 0.0
        hospitals.append({
            "hospital_id": str(row["hospital_id"]),
            "name": row["name"],
            "phone": row["phone"],
            "specialization": row["specialization"],
            "has_cardiac_icu": bool(row["has_cardiac_icu"]),
            "has_trauma_unit": bool(row["has_trauma_unit"]),
            "latitude": lat_val,
            "longitude": lng_val,
            "distance_meters": dist_val,
            "distance_metres": dist_val,
        })

    port = os.getenv("PORT", "8000")
    ai_url = f"http://localhost:{port}/api/ai/locate-resources"

    payload = {
        "lat": lat,
        "lng": lng,
        "emergency_type": emergency_type,
        "hospitals": hospitals
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(ai_url, json=payload, timeout=10.0)
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        print(f"AI locate resources failed: {e}")

    return {
        "hospitals": hospitals,
        "recommendation": hospitals[0] if hospitals else None,
        "should_call_1990": emergency_type.lower() in ["medical", "accident"]
    }

@router.get("")
async def list_requests(
    status: str | None = None,
    emergency_type: str | None = None,
    page: int = 1,
    limit: int = 50,
    current_user: dict[str, Any] = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List all requests (Admin only)."""
    query = select(HelpRequest).order_by(desc(HelpRequest.created_at))

    if status:
        query = query.where(HelpRequest.status == status)
    if emergency_type:
        query = query.where(HelpRequest.emergency_type == emergency_type)

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    requests = result.scalars().all()

    return [
        {
            "request_id": str(r.request_id),
            "emergency_type": r.emergency_type,
            "urgency_level": r.urgency_level,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in requests
    ]

@router.get("/public")
@router.get("/community")
async def list_public_requests(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Approved community cases only; identity, private evidence and exact GPS are never public."""
    records = (await db.execute(select(HelpRequest).where(
        HelpRequest.verification_status == "verified",
        HelpRequest.status.notin_(["resolved", "cancelled"]),
        HelpRequest.admin_status != "finished",
    ).order_by(desc(HelpRequest.created_at)).limit(limit))).scalars().all()
    return [request_response(record) for record in records]


@router.get("/my")
async def list_my_requests(
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    subject = uuid.UUID(current_user["sub"])
    field = HelpRequest.guest_session_id if current_user["role"] == "guest" else HelpRequest.user_id
    records = (await db.execute(select(HelpRequest).where(field == subject)
                               .order_by(desc(HelpRequest.created_at)).limit(100))).scalars().all()
    return [request_response(record, private=True) for record in records]


async def owned_request(request_id: uuid.UUID, user: dict, db: AsyncSession, lock: bool = False) -> HelpRequest:
    query = select(HelpRequest).where(HelpRequest.request_id == request_id)
    record = (await db.execute(query.with_for_update() if lock else query)).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Request not found")
    owner = record.guest_session_id if user["role"] == "guest" else record.user_id
    if user["role"] != "admin" and str(owner) != user["sub"]:
        raise HTTPException(status_code=403, detail="This request belongs to another person")
    return record


@router.get("/{request_id}")
async def get_request(
    request_id: uuid.UUID,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = request_response(await owned_request(request_id, current_user, db), private=True)
    reviews = (await db.scalars(select(RequestVerification).where(RequestVerification.request_id == request_id))).all()
    changes = (await db.scalars(select(RequestStatusHistory).where(RequestStatusHistory.request_id == request_id))).all()
    history = [{"status": item.decision, "note": item.notes, "method": item.method, "changed_at": item.created_at.isoformat()} for item in reviews]
    history.extend({"status": item.new_status, "note": item.notes, "changed_at": item.changed_at.isoformat()} for item in changes)
    result["history"] = sorted(history, key=lambda item: item["changed_at"], reverse=True)
    return result


@router.patch("/{request_id}/information")
async def update_request_information(
    request_id: uuid.UUID, body: RequestInformationUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await owned_request(request_id, current_user, db, lock=True)
    if record.verification_status not in {"unverified", "needs_information"} or record.admin_status != "pending":
        raise HTTPException(status_code=409, detail="This case is already being handled. Contact its coordinator for changes.")
    if not body.model_fields_set:
        raise HTTPException(status_code=422, detail="Provide additional information for review")
    if body.message is not None:
        record.original_message = body.message
    if body.requested_items is not None:
        record.requested_items = [item.model_dump() for item in body.requested_items]
    if "evidence_note" in body.model_fields_set:
        record.evidence_note = body.evidence_note
    if body.affected_people is not None:
        record.affected_people = body.affected_people
    if "location_label" in body.model_fields_set:
        record.location_label = body.location_label
    record.verification_status = "unverified"
    record.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(record)
    await notify_new_request(str(record.request_id), record.emergency_type, record.urgency_level,
                             record.original_message, ai_summary=record.ai_summary)
    return request_response(record, private=True)


@router.patch("/{request_id}/status")
async def update_status(request_id: uuid.UUID, body: StatusUpdateRequest,
                        current_user: dict[str, Any] = Depends(require_role("admin"))):
    # A parallel legacy endpoint must not bypass the audited admin workflow.
    raise HTTPException(status_code=409, detail="Use the administrator review workflow with a recorded decision and reason.")
