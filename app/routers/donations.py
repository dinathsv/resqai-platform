"""Verified goods pledges and recipient-confirmed handovers; no payment processing."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import require_role
from app.models.donation import Donation
from app.models.goods import MissionNeed, GoodsDelivery, GoodsEvent
from app.models.help_request import HelpRequest
from app.models.relief_mission import ReliefMission
from app.models.user import User

router = APIRouter(tags=["Goods Donations"])


class DonationPledgeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    need_id: uuid.UUID
    quantity: Decimal = Field(gt=0, le=1000000, max_digits=9, decimal_places=2)
    condition: Literal["new", "good"] = "new"
    availability_note: str = Field(min_length=3, max_length=1000)
    client_pledge_id: uuid.UUID


class ReasonRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=1500)


async def active_citizen(db: AsyncSession, current_user: dict[str, Any]) -> uuid.UUID:
    try:
        user_id = uuid.UUID(str(current_user.get("sub")))
    except (TypeError, ValueError):
        raise HTTPException(401, "Invalid account") from None
    user = await db.scalar(select(User).where(User.user_id == user_id))
    if not user or not user.is_active or not user.is_verified:
        raise HTTPException(403, "An active registered account is required")
    return user_id


def pledge_status(donation: Donation) -> str:
    if donation.goods_status == "cancelled":
        return "cancelled"
    if donation.delivered_quantity >= donation.quantity:
        return "delivered"
    if donation.delivered_quantity > 0:
        return "partially_delivered"
    if donation.dispatched_quantity > 0:
        return "dispatched"
    if donation.received_quantity > 0:
        return "received"
    return "pledged"


async def pledge_response(db: AsyncSession, donation: Donation) -> dict:
    need = await db.get(MissionNeed, donation.need_id)
    mission = await db.get(ReliefMission, donation.mission_id)
    return {
        "donation_id": str(donation.donation_id), "mission_id": str(donation.mission_id),
        "mission_title": mission.title, "need_id": str(donation.need_id),
        "item_name": need.item_name, "unit": need.unit, "quantity": float(donation.quantity),
        "received_quantity": float(donation.received_quantity),
        "dispatched_quantity": float(donation.dispatched_quantity),
        "delivered_quantity": float(donation.delivered_quantity),
        "condition": donation.item_condition, "availability_note": donation.availability_note,
        "status": donation.goods_status, "created_at": donation.created_at.isoformat(),
    }


def same_pledge(donation: Donation, body: DonationPledgeRequest, user_id: uuid.UUID) -> bool:
    return (donation.donor_id == user_id and donation.need_id == body.need_id
            and donation.quantity == body.quantity and donation.item_condition == body.condition
            and donation.availability_note == body.availability_note.strip())


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_donation(body: DonationPledgeRequest,
                          current_user: dict = Depends(require_role("people")),
                          db: AsyncSession = Depends(get_db)):
    user_id = await active_citizen(db, current_user)
    if len(body.availability_note.strip()) < 3:
        raise HTTPException(422, "Provide collection or delivery availability")
    existing = await db.scalar(select(Donation).where(Donation.client_pledge_id == body.client_pledge_id))
    if existing:
        if not same_pledge(existing, body, user_id):
            raise HTTPException(409, "This submission identifier was already used")
        return await pledge_response(db, existing)
    need = await db.get(MissionNeed, body.need_id)
    if not need:
        raise HTTPException(404, "Goods need not found")
    mission = await db.get(ReliefMission, need.mission_id)
    request = await db.scalar(select(HelpRequest).where(HelpRequest.request_id == mission.origin_request_id).with_for_update())
    mission = await db.scalar(select(ReliefMission).where(ReliefMission.mission_id == mission.mission_id).with_for_update().execution_options(populate_existing=True))
    if (not request or request.verification_status != "verified" or request.emergency_type != "donation"
            or request.status in ("resolved", "cancelled") or request.admin_status == "finished"
            or mission.status != "active"):
        raise HTTPException(409, "This need is not open for goods pledges")
    if request.user_id == user_id:
        raise HTTPException(400, "You cannot pledge to your own request")
    need = await db.scalar(select(MissionNeed).where(MissionNeed.need_id == body.need_id).with_for_update().execution_options(populate_existing=True))
    existing = await db.scalar(select(Donation).where(Donation.client_pledge_id == body.client_pledge_id))
    if existing:
        if not same_pledge(existing, body, user_id):
            raise HTTPException(409, "This submission identifier was already used")
        return await pledge_response(db, existing)
    reserved = await db.scalar(select(func.coalesce(func.sum(Donation.quantity), 0)).where(Donation.need_id == need.need_id, Donation.goods_status != "cancelled"))
    if body.quantity > need.required_quantity - reserved:
        raise HTTPException(409, "Quantity exceeds the remaining unpledged need; refresh available needs")
    donation = Donation(donor_id=user_id, mission_id=need.mission_id, need_id=need.need_id,
                        amount=0, quantity=body.quantity, received_quantity=0, dispatched_quantity=0,
                        delivered_quantity=0, item_condition=body.condition,
                        availability_note=body.availability_note.strip(), client_pledge_id=body.client_pledge_id,
                        goods_status="pledged", status="pending")
    db.add(donation)
    try:
        await db.flush()
        db.add(GoodsEvent(event_type="pledged", need_id=need.need_id, donation_id=donation.donation_id,
                          actor_user_id=user_id, quantity=body.quantity, reason=body.availability_note.strip(),
                          operation_id=body.client_pledge_id))
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await db.scalar(select(Donation).where(Donation.client_pledge_id == body.client_pledge_id))
        if existing and same_pledge(existing, body, user_id):
            return await pledge_response(db, existing)
        raise HTTPException(409, "Pledge conflicts with another submission; refresh and retry") from None
    await db.refresh(donation)
    return await pledge_response(db, donation)


@router.get("")
async def list_my_donations(current_user: dict = Depends(require_role("people")), db: AsyncSession = Depends(get_db)):
    user_id = await active_citizen(db, current_user)
    donations = (await db.scalars(select(Donation).where(Donation.donor_id == user_id, Donation.need_id.is_not(None)).order_by(Donation.created_at.desc()))).all()
    return [await pledge_response(db, donation) for donation in donations]


@router.get("/deliveries")
async def list_deliveries(current_user: dict = Depends(require_role("people")), db: AsyncSession = Depends(get_db)):
    user_id = await active_citizen(db, current_user)
    rows = (await db.execute(select(GoodsDelivery, MissionNeed, ReliefMission)
             .join(Donation, GoodsDelivery.donation_id == Donation.donation_id)
             .join(MissionNeed, Donation.need_id == MissionNeed.need_id)
             .join(ReliefMission, Donation.mission_id == ReliefMission.mission_id)
             .where(GoodsDelivery.recipient_id == user_id).order_by(GoodsDelivery.created_at.desc()))).all()
    return [{"delivery_id": str(d.delivery_id), "mission_title": mission.title,
             "item_name": need.item_name, "unit": need.unit, "quantity": float(d.quantity),
             "status": d.status, "dispatch_note": d.dispatch_note, "dispute_reason": d.dispute_reason,
             "review_reason": d.review_reason, "created_at": d.created_at.isoformat(),
             "confirmed_at": d.confirmed_at.isoformat() if d.confirmed_at else None}
            for d, need, mission in rows]


async def locked_delivery(db: AsyncSession, delivery_id: uuid.UUID, user_id: uuid.UUID):
    delivery = await db.get(GoodsDelivery, delivery_id)
    if not delivery or delivery.recipient_id != user_id:
        raise HTTPException(404, "Delivery not found")
    donation = await db.get(Donation, delivery.donation_id)
    await db.scalar(select(MissionNeed).where(MissionNeed.need_id == donation.need_id).with_for_update())
    donation = await db.scalar(select(Donation).where(Donation.donation_id == donation.donation_id).with_for_update().execution_options(populate_existing=True))
    delivery = await db.scalar(select(GoodsDelivery).where(GoodsDelivery.delivery_id == delivery_id).with_for_update().execution_options(populate_existing=True))
    if donation.donor_id == user_id:
        raise HTTPException(403, "A donor cannot confirm their own goods delivery")
    return delivery, donation


@router.patch("/deliveries/{delivery_id}/confirm")
async def confirm_delivery(delivery_id: uuid.UUID, current_user: dict = Depends(require_role("people")), db: AsyncSession = Depends(get_db)):
    user_id = await active_citizen(db, current_user)
    delivery, donation = await locked_delivery(db, delivery_id, user_id)
    if delivery.status == "delivered":
        return {"delivery_id": str(delivery_id), "status": "delivered"}
    if delivery.status != "dispatched":
        raise HTTPException(409, "Only an undisputed dispatched delivery can be confirmed")
    delivery.status = "delivered"
    delivery.confirmed_at = datetime.now(timezone.utc)
    donation.delivered_quantity += delivery.quantity
    donation.goods_status = pledge_status(donation)
    if donation.goods_status == "delivered":
        donation.status = "completed"
    db.add(GoodsEvent(event_type="recipient_confirmed", need_id=donation.need_id, donation_id=donation.donation_id,
                      delivery_id=delivery_id, actor_user_id=user_id, quantity=delivery.quantity,
                      reason="Recipient confirmed receipt from their authenticated account"))
    await db.commit()
    return {"delivery_id": str(delivery_id), "status": "delivered"}


@router.patch("/deliveries/{delivery_id}/dispute")
async def dispute_delivery(delivery_id: uuid.UUID, body: ReasonRequest, current_user: dict = Depends(require_role("people")), db: AsyncSession = Depends(get_db)):
    user_id = await active_citizen(db, current_user)
    delivery, donation = await locked_delivery(db, delivery_id, user_id)
    reason = body.reason.strip()
    if len(reason) < 5:
        raise HTTPException(422, "Explain the delivery issue")
    if delivery.status == "disputed" and delivery.dispute_reason == reason:
        return {"delivery_id": str(delivery_id), "status": "disputed"}
    if delivery.status != "dispatched":
        raise HTTPException(409, "Only a dispatched delivery can be disputed")
    delivery.status = "disputed"
    delivery.dispute_reason = reason
    db.add(GoodsEvent(event_type="recipient_disputed", need_id=donation.need_id, donation_id=donation.donation_id,
                      delivery_id=delivery_id, actor_user_id=user_id, quantity=delivery.quantity, reason=reason))
    await db.commit()
    return {"delivery_id": str(delivery_id), "status": "disputed"}


@router.patch("/{donation_id}/cancel")
async def cancel_pledge(donation_id: uuid.UUID, body: ReasonRequest, current_user: dict = Depends(require_role("people")), db: AsyncSession = Depends(get_db)):
    user_id = await active_citizen(db, current_user)
    donation = await db.get(Donation, donation_id)
    if not donation or not donation.need_id or donation.donor_id != user_id:
        raise HTTPException(404, "Pledge not found")
    await db.scalar(select(MissionNeed).where(MissionNeed.need_id == donation.need_id).with_for_update())
    donation = await db.scalar(select(Donation).where(Donation.donation_id == donation_id).with_for_update().execution_options(populate_existing=True))
    if donation.goods_status == "cancelled":
        return await pledge_response(db, donation)
    if donation.received_quantity > 0:
        raise HTTPException(409, "Received goods require coordinator review")
    if len(body.reason.strip()) < 5:
        raise HTTPException(422, "Explain why the pledge is cancelled")
    donation.goods_status = "cancelled"
    db.add(GoodsEvent(event_type="pledge_cancelled", need_id=donation.need_id, donation_id=donation_id,
                      actor_user_id=user_id, quantity=donation.quantity, reason=body.reason.strip()))
    await db.commit()
    return await pledge_response(db, donation)
