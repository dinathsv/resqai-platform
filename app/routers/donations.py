"""
ResQAI — Donations Router.
Handles relief goods donation pledges, admin notification, and drop-off details.

Flow 5: Donating relief goods (Donor)
1. Donor pledges relief goods
2. App submits donation pledge to Backend
3. Backend saves donation record to Database
4. Backend notifies Admin about the donation
5. Backend sends drop-off details back to the donor's app
"""

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.donation import Donation
from app.models.relief_mission import ReliefMission

logger = logging.getLogger("resqai.donations")
router = APIRouter(tags=["Donations"])

# Drop-off locations by district (could be moved to DB later)
DROP_OFF_LOCATIONS = {
    "Colombo": {
        "address": "ResQAI Relief Center, 45 Bauddhaloka Mawatha, Colombo 07",
        "phone": "+94 11 269 4000",
        "hours": "8:00 AM - 6:00 PM daily",
    },
    "Galle": {
        "address": "Southern Province Disaster Center, Wakwella Road, Galle",
        "phone": "+94 91 223 4567",
        "hours": "8:00 AM - 5:00 PM weekdays",
    },
    "Kandy": {
        "address": "Central Province Relief Hub, Peradeniya Road, Kandy",
        "phone": "+94 81 220 1234",
        "hours": "8:00 AM - 5:00 PM weekdays",
    },
    "default": {
        "address": "Nearest Divisional Secretariat Office — contact 1919 for directions",
        "phone": "1919",
        "hours": "8:30 AM - 4:30 PM weekdays",
    },
}


class DonationPledgeRequest(BaseModel):
    mission_id: uuid.UUID
    amount: Decimal = Field(..., gt=Decimal("0"), description="Donation amount in LKR")


class DonationResponse(BaseModel):
    donation_id: str
    status: str
    amount: float
    mission_title: str
    drop_off: dict


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_donation(
    req: DonationPledgeRequest,
    current_user: dict[str, Any] = Depends(require_role("people")),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a donation pledge.
    Flow: save to DB → notify admin → return drop-off details to donor.
    """
    donor_id = current_user.get("sub")

    # Verify mission exists and is active
    result = await db.execute(
        select(ReliefMission).where(ReliefMission.mission_id == req.mission_id)
    )
    mission = result.scalars().first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    if mission.status not in ("planning", "active"):
        raise HTTPException(status_code=400, detail="Mission is not accepting donations")

    # Save donation record to database
    new_donation = Donation(
        donor_id=donor_id,
        mission_id=req.mission_id,
        amount=req.amount,
        status="pending",
        transaction_ref=f"PLEDGE-{uuid.uuid4().hex[:8].upper()}",
    )
    db.add(new_donation)

    # Update mission funds
    mission.funds_collected = (mission.funds_collected or Decimal(0)) + req.amount
    await db.commit()
    await db.refresh(new_donation)

    # Notify admin about the donation (log for now, could be WebSocket/push)
    logger.info(
        "DONATION: %s LKR from user %s for mission '%s' (donation_id=%s)",
        req.amount, donor_id, mission.title, new_donation.donation_id,
    )

    # Determine drop-off location based on mission's admin district or default
    district = getattr(mission, "district", None)
    if isinstance(district, str) and district in DROP_OFF_LOCATIONS:
        drop_off = DROP_OFF_LOCATIONS[district]
    else:
        drop_off = DROP_OFF_LOCATIONS["default"]

    return {
        "donation_id": str(new_donation.donation_id),
        "status": new_donation.status,
        "amount": float(req.amount),
        "mission_title": mission.title,
        "drop_off": drop_off,
    }


@router.get("")
async def list_my_donations(
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the current user's donations."""
    user_id = current_user.get("sub")
    role = current_user.get("role")

    if role == "admin":
        # Admin sees all donations
        result = await db.execute(
            select(Donation).order_by(desc(Donation.created_at)).limit(100)
        )
    else:
        result = await db.execute(
            select(Donation)
            .where(Donation.donor_id == user_id)
            .order_by(desc(Donation.created_at))
        )

    donations = result.scalars().all()
    return [
        {
            "donation_id": str(d.donation_id),
            "amount": float(d.amount),
            "status": d.status,
            "mission_id": str(d.mission_id) if d.mission_id else None,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in donations
    ]
