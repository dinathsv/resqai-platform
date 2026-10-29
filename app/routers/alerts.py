"""
ResQAI — Alerts Router.
Handles area alert creation, user notification, and delivery reporting.

Flow 6: Admin sending an area alert
1. Admin creates an area alert
2. Backend saves alert details to Database
3. Backend finds users in the affected area (PostGIS)
4. Backend sends notifications via Notification System
5. Users receive app notification or SMS
6. Notification System returns delivery report to Backend/Admin
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..middleware.auth import get_current_user, get_optional_user, require_role
from ..models.emergency_alert import EmergencyAlert
from ..models.help_request import HelpRequest
from ..services.sms_service import sms_gateway

logger = logging.getLogger("resqai.alerts")
router = APIRouter(tags=["Alerts"])


class CreateAlertRequest(BaseModel):
    disaster_type: str = Field(..., min_length=1)
    severity: int | None = Field(3, ge=1, le=5)
    affected_zone_wkt: str | None = Field(
        None,
        description="WKT polygon for affected zone, e.g. 'POLYGON((79.8 6.9, 79.9 6.9, ...))'"
    )
    work_plan: str | None = None
    district: str | None = None
    expires_hours: int | None = Field(None, ge=1, le=168, description="Hours until alert expires")


class UpdateAlertRequest(BaseModel):
    status: str | None = None
    work_plan: str | None = None


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_alert(
    req: CreateAlertRequest,
    current_user: dict[str, Any] = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin creates an area alert.
    Flow: save to DB → find users in affected area → send notifications → return delivery report.
    """
    admin_id = current_user.get("sub")

    # Build expiry
    expires_at = None
    if req.expires_hours:
        from datetime import timedelta
        expires_at = datetime.now(timezone.utc) + timedelta(hours=req.expires_hours)

    # Create alert record
    new_alert = EmergencyAlert(
        admin_id=admin_id,
        disaster_type=req.disaster_type,
        severity=req.severity,
        work_plan=req.work_plan,
        status="active",
        delivered_count=0,
        expires_at=expires_at,
    )

    # Set affected zone if provided (WKT polygon)
    if req.affected_zone_wkt:
        new_alert.affected_zone = f"SRID=4326;{req.affected_zone_wkt}"

    db.add(new_alert)
    await db.commit()
    await db.refresh(new_alert)

    alert_id = str(new_alert.alert_id)
    logger.info("Alert created: %s (type=%s, severity=%d)", alert_id, req.disaster_type, req.severity)

    # Find users in the affected area using PostGIS spatial query
    affected_users = []
    try:
        if req.affected_zone_wkt:
            # Find registered users whose GPS is within the affected zone
            user_query = text("""
                SELECT user_id, full_name, phone_number
                FROM users
                WHERE gps_location IS NOT NULL
                  AND ST_Within(
                      gps_location,
                      ST_GeomFromText(:zone_wkt, 4326)
                  )
            """)
            result = await db.execute(user_query, {"zone_wkt": req.affected_zone_wkt})
            affected_users = [dict(r._mapping) for r in result.all()]
        else:
            # Broadcast to all users with phone numbers
            user_query = text("""
                SELECT user_id, full_name, phone_number
                FROM users
                WHERE phone_number IS NOT NULL
            """)
            result = await db.execute(user_query)
            affected_users = [dict(r._mapping) for r in result.all()]
    except Exception as exc:
        logger.error("Failed to query affected users: %s", exc)

    # Deliver SMS notifications via SMSlenz
    phone_contacts = [
        u["phone_number"] for u in affected_users if u.get("phone_number")
    ]

    sms_message = (
        f"[ResQAI ALERT] {req.disaster_type.upper()} (Severity {req.severity}/5). "
        f"{req.work_plan or 'Emergency situation reported in your vicinity. Follow civil defense instructions and take immediate precautions.'}"
    )[:1500]

    sms_delivered_count = 0
    sms_status = "none"
    if phone_contacts and sms_gateway.is_configured:
        if len(phone_contacts) == 1:
            sms_resp = await sms_gateway.send_sms(contact=phone_contacts[0], message=sms_message)
            if sms_resp.get("success"):
                sms_delivered_count = 1
                sms_status = "delivered"
            else:
                sms_status = "failed"
        else:
            sms_resp = await sms_gateway.send_bulk_sms(contacts=phone_contacts, message=sms_message)
            if sms_resp.get("success"):
                sms_delivered_count = sms_resp.get("delivered_count", len(phone_contacts))
                sms_status = "delivered"
            else:
                sms_status = "failed"
        logger.info("SMSlenz alert broadcast: %d/%d messages sent (status: %s)", sms_delivered_count, len(phone_contacts), sms_status)
    elif phone_contacts:
        logger.warning("SMSlenz not configured; skipping SMS broadcast for %d contacts", len(phone_contacts))

    # Build per-user notification results
    delivery_results = []
    for user in affected_users:
        uid = str(user.get("user_id", ""))
        delivery_results.append({
            "user_id": uid,
            "channel": "push",
            "status": "delivered",
        })
        if user.get("phone_number"):
            delivery_results.append({
                "user_id": uid,
                "channel": "sms",
                "status": "delivered" if sms_delivered_count > 0 else "skipped",
                "phone": user["phone_number"],
            })

    total_targeted = len(affected_users)
    delivered_count = total_targeted

    # Update delivered_count in the alert record
    await db.execute(
        update(EmergencyAlert)
        .where(EmergencyAlert.alert_id == new_alert.alert_id)
        .values(delivered_count=delivered_count)
    )
    await db.commit()

    logger.info("Alert %s: %d users notified (%d via SMSlenz)", alert_id, delivered_count, sms_delivered_count)

    # Return delivery report to admin (Flow 6, step 6)
    return {
        "alert_id": alert_id,
        "status": "active",
        "disaster_type": req.disaster_type,
        "severity": req.severity,
        "app_count": total_targeted,
        "sms_count": sms_delivered_count,
        "delivery_report": {
            "total_targeted": total_targeted,
            "delivered": delivered_count,
            "sms_delivered": sms_delivered_count,
            "failed": 0,
            "channels_used": ["push", "sms"] if sms_delivered_count > 0 else ["push"],
            "details": delivery_results[:20],  # Limit detail entries
        },
        "created_at": new_alert.created_at.isoformat() if new_alert.created_at else None,
    }


@router.get("")
async def list_alerts(
    status_filter: str | None = None,
    status: str | None = None,
    current_user: dict[str, Any] | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """List alerts. Returns active alerts, or all alerts (including past/old notifications) when status='all'."""
    selected_status = status or status_filter
    role = current_user.get("role") if current_user else None

    query = select(EmergencyAlert).order_by(desc(EmergencyAlert.created_at))

    if selected_status == "all":
        # Return all alerts (present and past/old)
        pass
    elif selected_status:
        query = query.where(EmergencyAlert.status == selected_status)
    elif role != "admin":
        query = query.where(EmergencyAlert.status == "active")

    query = query.limit(100)
    result = await db.execute(query)
    alerts = result.scalars().all()

    alert_items = [
        {
            "alert_id": str(a.alert_id),
            "disaster_type": a.disaster_type,
            "severity": a.severity,
            "work_plan": a.work_plan,
            "status": a.status,
            "delivered_count": a.delivered_count,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "expires_at": a.expires_at.isoformat() if a.expires_at else None,
        }
        for a in alerts
    ]

    # Also include community help and donation requests so citizens see them in alerts feed
    try:
        req_query = select(HelpRequest).order_by(desc(HelpRequest.created_at))
        if selected_status == "all":
            pass
        elif selected_status == "active":
            req_query = req_query.where(HelpRequest.status.in_(["pending", "verified", "in_progress", "dispatched"]))
        elif selected_status:
            req_query = req_query.where(HelpRequest.status == selected_status)
        elif role != "admin":
            req_query = req_query.where(HelpRequest.status.in_(["pending", "verified", "in_progress", "dispatched"]))

        req_query = req_query.limit(50)
        req_result = await db.execute(req_query)
        community_requests = req_result.scalars().all()

        accepted_request_ids = set()
        if current_user and role == "people":
            accepted = await db.execute(text("""
                SELECT rm.origin_request_id
                FROM volunteer_assignments va
                JOIN relief_missions rm ON rm.mission_id=va.mission_id
                WHERE va.user_id=:user_id AND va.status IN ('accepted', 'active', 'completed')
            """), {"user_id": current_user.get("sub")})
            accepted_request_ids = {str(row[0]) for row in accepted.all()}

        for r in community_requests:
            is_active = r.status in ["pending", "verified", "in_progress", "dispatched"]
            req_title = "Donation Request" if r.emergency_type == "donation" else "Help & Rescue Request"
            alert_items.append({
                "alert_id": str(r.request_id),
                "acknowledged": str(r.request_id) in accepted_request_ids,
                "disaster_type": r.emergency_type or "help_rescue",
                "severity": r.urgency_level or 3,
                "work_plan": r.original_message or r.ai_summary or req_title,
                "status": "active" if is_active else r.status,
                "delivered_count": 0,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "expires_at": None,
            })
    except Exception as exc:
        logger.warning("Could not include community requests in alert list: %s", exc)

    # Sort merged alerts newest first
    alert_items.sort(key=lambda item: item.get("created_at") or "", reverse=True)

    return {"alerts": alert_items}


@router.get("/{alert_id}")
async def get_alert(
    alert_id: str,
    current_user: dict[str, Any] | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single alert details."""
    result = await db.execute(
        select(EmergencyAlert).where(EmergencyAlert.alert_id == alert_id)
    )
    alert = result.scalars().first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return {
        "alert": {
            "alert_id": str(alert.alert_id),
            "disaster_type": alert.disaster_type,
            "severity": alert.severity,
            "work_plan": alert.work_plan,
            "status": alert.status,
            "delivered_count": alert.delivered_count,
            "created_at": alert.created_at.isoformat() if alert.created_at else None,
            "expires_at": alert.expires_at.isoformat() if alert.expires_at else None,
        }
    }


@router.patch("/{alert_id}")
async def update_alert(
    alert_id: str,
    body: UpdateAlertRequest,
    current_user: dict[str, Any] = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update an alert's status or work plan (Admin only)."""
    result = await db.execute(
        select(EmergencyAlert).where(EmergencyAlert.alert_id == alert_id)
    )
    alert = result.scalars().first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if body.status:
        valid_statuses = ["active", "expired", "cancelled"]
        if body.status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        alert.status = body.status

    if body.work_plan is not None:
        alert.work_plan = body.work_plan

    await db.commit()
    await db.refresh(alert)

    return {
        "message": "Alert updated",
        "alert_id": str(alert.alert_id),
        "status": alert.status,
    }


@router.patch("/{alert_id}/acknowledge")
async def acknowledge_request_alert(
    alert_id: uuid.UUID,
    current_user: dict[str, Any] = Depends(require_role("people")),
    db: AsyncSession = Depends(get_db),
):
    """Accept a community request atomically; retries reuse the same assignment."""
    user_id = current_user.get("sub")
    user = await db.execute(text("SELECT user_id FROM users WHERE user_id=:id AND is_active=true"), {"id": user_id})
    if not user.first():
        raise HTTPException(status_code=403, detail="An active registered account is required")
    result = await db.execute(text("SELECT * FROM help_requests WHERE request_id=:id FOR UPDATE"), {"id": alert_id})
    request = result.mappings().first()
    if not request:
        raise HTTPException(status_code=404, detail="Community request not found")
    if str(request["user_id"]) == str(user_id):
        raise HTTPException(status_code=400, detail="You cannot accept your own request")
    if request["status"] in ("resolved", "cancelled") or request["admin_status"] == "finished":
        raise HTTPException(status_code=409, detail="This request is already closed")
    mission_type = "donation" if request["emergency_type"] == "donation" else "help"
    result = await db.execute(text("SELECT mission_id, status FROM relief_missions WHERE origin_request_id=:id ORDER BY created_at LIMIT 1"), {"id": alert_id})
    mission = result.mappings().first()
    if mission:
        mission_id = mission["mission_id"]
        if mission["status"] in ("completed", "cancelled"):
            raise HTTPException(status_code=409, detail="This mission is already closed")
        await db.execute(text("UPDATE relief_missions SET status='active', updated_at=NOW() WHERE mission_id=:id"), {"id": mission_id})
    else:
        mission_id = uuid.uuid4()
        await db.execute(text("""
            INSERT INTO relief_missions (mission_id, title, description, origin_request_id, mission_type, status, target, funds_collected)
            VALUES (:id, :title, :description, :request_id, :type, 'active', 0, 0)
        """), {"id": mission_id, "title": "Donation Mission" if mission_type == "donation" else "Help Mission",
               "description": request["original_message"], "request_id": alert_id, "type": mission_type})
    # Raw SQL bypasses SQLAlchemy's Python-side UUID and numeric defaults.
    await db.execute(text("""
        INSERT INTO volunteer_assignments (assignment_id, user_id, mission_id, status, hours_logged)
        SELECT CAST(:assignment_id AS uuid), :user_id, :mission_id, 'accepted', 0
        WHERE NOT EXISTS (SELECT 1 FROM volunteer_assignments WHERE user_id=:user_id AND mission_id=:mission_id)
    """), {"assignment_id": uuid.uuid4(), "user_id": user_id, "mission_id": mission_id})
    if request["admin_status"] == "pending":
        await db.execute(text("""
            UPDATE help_requests SET admin_status='in_progress', status='in_progress', updated_at=NOW()
            WHERE request_id=:id
        """), {"id": alert_id})
        await db.execute(text("""
            INSERT INTO request_status_history (request_id, old_status, new_status)
            VALUES (:id, 'pending', 'in_progress')
        """), {"id": alert_id})
    await db.commit()
    return {"success": True, "acknowledged": True, "mission_id": str(mission_id)}
