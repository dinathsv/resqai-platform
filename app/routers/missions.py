"""Public relief missions. Goods collection requires a verified originating request."""
from typing import Literal
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.relief_mission import ReliefMission
from app.models.help_request import HelpRequest
from app.models.goods import MissionNeed
from app.models.donation import Donation

router = APIRouter(tags=["Missions"])


@router.get("")
async def list_missions(status: Literal["planning", "active", "paused", "completed", "cancelled"] | None = Query(None), db: AsyncSession = Depends(get_db)):
    query = select(ReliefMission).join(HelpRequest, HelpRequest.request_id == ReliefMission.origin_request_id).where(
        HelpRequest.verification_status == "verified",
        HelpRequest.status.notin_(["resolved", "cancelled"]), HelpRequest.admin_status != "finished",
        or_(ReliefMission.mission_type == "help",
            and_(ReliefMission.mission_type == "donation", HelpRequest.emergency_type == "donation", HelpRequest.user_id.is_not(None))))
    if status:
        query = query.where(ReliefMission.status == status)
    else:
        query = query.where(ReliefMission.status == "active")
    missions = (await db.scalars(query.order_by(ReliefMission.created_at.desc()))).all()
    result = []
    for mission in missions:
        needs = (await db.scalars(select(MissionNeed).where(MissionNeed.mission_id == mission.mission_id))).all()
        payload_needs = []
        for need in needs:
            totals = (await db.execute(select(*[func.coalesce(func.sum(col), 0) for col in
                [Donation.quantity, Donation.received_quantity, Donation.dispatched_quantity, Donation.delivered_quantity]])
                .where(Donation.need_id == need.need_id, Donation.goods_status != "cancelled"))).one()
            pledged, received, dispatched, delivered = map(float, totals)
            payload_needs.append({"need_id": str(need.need_id), "item_name": need.item_name, "unit": need.unit,
                "required_quantity": float(need.required_quantity), "pledged_quantity": pledged,
                "received_quantity": received, "dispatched_quantity": dispatched, "delivered_quantity": delivered,
                "remaining_quantity": max(0, float(need.required_quantity) - pledged)})
        if mission.mission_type == "donation" and not payload_needs:
            continue
        result.append({"mission_id": str(mission.mission_id), "title": mission.title,
            "description": "Verified emergency goods collection" if mission.mission_type == "donation" else "Verified community assistance",
            "district": mission.district or "General",
            "status": mission.status, "mission_type": mission.mission_type,
            "origin_request_id": str(mission.origin_request_id) if mission.origin_request_id else None,
            "needs": payload_needs, "created_at": mission.created_at.isoformat() if mission.created_at else None})
    return result
