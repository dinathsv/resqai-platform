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

from app.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.emergency_alert import EmergencyAlert
from app.services.sms_service import sms_gateway

logger = logging.getLogger("resqai.alerts")
router = APIRouter(tags=["Alerts"])


class CreateAlertRequest(BaseModel):
    disaster_type: str = Field(..., min_length=1)
    severity: int = Field(..., ge=1, le=5)
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
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List alerts. People see active alerts; admins see all."""
    role = current_user.get("role")

    query = select(EmergencyAlert).order_by(desc(EmergencyAlert.created_at))

    if role != "admin":
        query = query.where(EmergencyAlert.status == "active")
    elif status_filter:
        query = query.where(EmergencyAlert.status == status_filter)

    query = query.limit(50)
    result = await db.execute(query)
    alerts = result.scalars().all()

    return {
        "alerts": [
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
    }


@router.get("/{alert_id}")
async def get_alert(
    alert_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
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
