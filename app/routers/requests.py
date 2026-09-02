"""
ResQAI — Requests Router.
Handles help requests creation, listing, locating resources, and status updates.
"""

from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.help_request import HelpRequest
from pydantic import BaseModel
import os

router = APIRouter(tags=["Requests"])

class SubmitRequest(BaseModel):
    message: str
    lat: float
    lng: float

class StatusUpdateRequest(BaseModel):
    status: str

async def notify_critical_request(request_id: str, emergency_type: str):

    print(f"⚠ CRITICAL: {emergency_type} — Request #{request_id}")

@router.post("")
async def create_request(
    req: SubmitRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new help request (user or guest)."""
    user_id = current_user.get("sub")
    role = current_user.get("role")

    port = os.getenv("PORT", "8000")
    ai_url = f"http://localhost:{port}/api/ai/translate-report"

    emergency_type = "other"
    urgency_level = 3
    ai_summary = None

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(ai_url, json={"message": req.message}, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                emergency_type = data.get("emergency_type", "other")
                urgency_level = data.get("urgency_level", 3)
                ai_summary = data.get("summary_english")
    except Exception as e:
        print(f"AI translation failed: {e}")

    new_req = HelpRequest(
        original_message=req.message,
        emergency_type=emergency_type,
        urgency_level=urgency_level,
        ai_summary=ai_summary,
        status="submitted"
    )

    if role == "guest":
        new_req.guest_session_id = user_id
        new_req.is_guest_request = True
    else:
        new_req.user_id = user_id
        new_req.is_guest_request = False

    new_req.gps_location = f"SRID=4326;POINT({req.lng} {req.lat})"

    db.add(new_req)
    await db.commit()
    await db.refresh(new_req)

    req_id_str = str(new_req.request_id)
    if urgency_level >= 4:
        await notify_critical_request(req_id_str, emergency_type)

    return {
        "request_id": req_id_str,
        "status": new_req.status,
        "urgency_level": urgency_level,
        "ai_summary": ai_summary,
        "emergency_type": emergency_type
    }

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
               ST_Distance(
                 gps_location::geography,
                 ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
               ) AS distance_meters
        FROM hospitals WHERE is_active=true
        ORDER BY distance_meters ASC LIMIT 5
    """)

    result = await db.execute(sql, {"lat": lat, "lng": lng})
    rows = result.mappings().all()

    hospitals = []
    for row in rows:
        hospitals.append({
            "hospital_id": str(row["hospital_id"]),
            "name": row["name"],
            "phone": row["phone"],
            "specialization": row["specialization"],
            "has_cardiac_icu": row["has_cardiac_icu"],
            "has_trauma_unit": row["has_trauma_unit"],
            "distance_meters": float(row["distance_meters"])
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

@router.get("/{request_id}")
async def get_request(
    request_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single request details. User/Guest can only see their own."""
    result = await db.execute(select(HelpRequest).where(HelpRequest.request_id == request_id))
    req = result.scalars().first()

    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    role = current_user.get("role")
    sub = current_user.get("sub")

    if role != "admin":

        if role == "guest" and str(req.guest_session_id) != sub:
            raise HTTPException(status_code=403, detail="Not authorized")
        if role == "people" and str(req.user_id) != sub:
            raise HTTPException(status_code=403, detail="Not authorized")

    return {
        "request_id": str(req.request_id),
        "message": req.original_message,
        "emergency_type": req.emergency_type,
        "urgency_level": req.urgency_level,
        "status": req.status,
        "ai_summary": req.ai_summary,
    }

@router.patch("/{request_id}/status")
async def update_status(
    request_id: str,
    body: StatusUpdateRequest,
    current_user: dict[str, Any] = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update request status (Admin only)."""
    valid_statuses = ["submitted", "assigned", "in_progress", "resolved", "closed", "flagged"]
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

    result = await db.execute(select(HelpRequest).where(HelpRequest.request_id == request_id))
    req = result.scalars().first()

    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = body.status
    if body.status == "resolved":
        from datetime import datetime, timezone
        req.resolved_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(req)

    return {"message": "Status updated", "status": req.status, "request_id": str(req.request_id)}
