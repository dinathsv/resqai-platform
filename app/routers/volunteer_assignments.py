"""Volunteer participation and recipient-confirmed completion."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth import require_role
from app.models.relief_mission import ReliefMission
from app.models.volunteer_assignment import VolunteerAssignment
from app.models.help_request import HelpRequest
from app.models.user import User
from app.models.audit_log import AuditLog
from app.routers.donations import active_citizen

router = APIRouter(tags=["Volunteer Assignments"])


class JoinMissionRequest(BaseModel):
    mission_id: uuid.UUID


class CompletionRequest(BaseModel):
    note: str = Field(default="Requested recipient confirmation of completed assistance", min_length=5, max_length=1500)


@router.get("")
async def list_my_assignments(current_user: dict = Depends(require_role("people")), db: AsyncSession = Depends(get_db)):
    user_id = await active_citizen(db, current_user)
    rows = (await db.execute(select(VolunteerAssignment, ReliefMission)
        .join(ReliefMission, ReliefMission.mission_id == VolunteerAssignment.mission_id)
        .where(VolunteerAssignment.user_id == user_id).order_by(VolunteerAssignment.assigned_at.desc()))).all()
    return [{"assignment_id": str(a.assignment_id), "mission_id": str(a.mission_id), "mission_title": m.title,
             "status": a.status, "hours_logged": a.hours_logged,
             "completion_pending": a.completion_requested_at is not None and a.status != "completed",
             "completion_requested_at": a.completion_requested_at.isoformat() if a.completion_requested_at else None,
             "assigned_at": a.assigned_at.isoformat(), "completed_at": a.completed_at.isoformat() if a.completed_at else None}
            for a, m in rows]


@router.get("/confirmations")
async def list_confirmations(current_user: dict = Depends(require_role("people")), db: AsyncSession = Depends(get_db)):
    user_id = await active_citizen(db, current_user)
    rows = (await db.execute(select(VolunteerAssignment, ReliefMission, User)
        .join(ReliefMission, ReliefMission.mission_id == VolunteerAssignment.mission_id)
        .join(HelpRequest, HelpRequest.request_id == ReliefMission.origin_request_id)
        .join(User, User.user_id == VolunteerAssignment.user_id)
        .where(HelpRequest.user_id == user_id, VolunteerAssignment.user_id != user_id,
               VolunteerAssignment.completion_requested_at.is_not(None), VolunteerAssignment.status.in_(["accepted", "active"])))).all()
    return [{"assignment_id": str(a.assignment_id), "mission_title": m.title, "volunteer_name": u.full_name,
             "completion_note": a.completion_note, "completion_requested_at": a.completion_requested_at.isoformat()}
            for a, m, u in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def join_mission(body: JoinMissionRequest, current_user: dict = Depends(require_role("people")), db: AsyncSession = Depends(get_db)):
    user_id = await active_citizen(db, current_user)
    mission = await db.scalar(select(ReliefMission).where(ReliefMission.mission_id == body.mission_id))
    if not mission:
        raise HTTPException(404, "Mission not found")
    request = await db.scalar(select(HelpRequest).where(HelpRequest.request_id == mission.origin_request_id).with_for_update())
    mission = await db.scalar(select(ReliefMission).where(ReliefMission.mission_id == body.mission_id).with_for_update().execution_options(populate_existing=True))
    if mission.status != "active" or not request or request.status in ("resolved", "cancelled") or request.admin_status == "finished" or request.verification_status != "verified":
        raise HTTPException(409, "Mission is not accepting helpers")
    if request.user_id == user_id:
        raise HTTPException(400, "You cannot join your own request as a helper")
    existing = await db.scalar(select(VolunteerAssignment).where(VolunteerAssignment.user_id == user_id,
                               VolunteerAssignment.mission_id == mission.mission_id, VolunteerAssignment.status != "withdrawn"))
    if existing:
        return {"assignment_id": str(existing.assignment_id), "mission_id": str(mission.mission_id), "status": existing.status}
    assignment = VolunteerAssignment(user_id=user_id, mission_id=mission.mission_id, status="accepted")
    db.add(assignment)
    await db.flush()
    db.add(AuditLog(user_id=user_id, action="volunteer_joined", entity_type="volunteer_assignment", entity_id=assignment.assignment_id))
    await db.commit()
    return {"assignment_id": str(assignment.assignment_id), "mission_id": str(mission.mission_id), "status": assignment.status}


@router.patch("/{assignment_id}/complete")
async def complete_assignment(assignment_id: uuid.UUID, body: CompletionRequest | None = None,
                              current_user: dict = Depends(require_role("people")), db: AsyncSession = Depends(get_db)):
    user_id = await active_citizen(db, current_user)
    assignment = await db.scalar(select(VolunteerAssignment).where(VolunteerAssignment.assignment_id == assignment_id,
                                  VolunteerAssignment.user_id == user_id).with_for_update())
    if not assignment:
        raise HTTPException(404, "Assignment not found")
    if assignment.status == "completed":
        return {"assignment_id": str(assignment_id), "status": "completed", "completion_pending": False}
    if assignment.status not in ("accepted", "active"):
        raise HTTPException(409, "Assignment is not active")
    note = (body.note if body else CompletionRequest().note).strip()
    if len(note) < 5:
        raise HTTPException(422, "Describe assistance provided")
    if not assignment.completion_requested_at:
        assignment.completion_requested_at = datetime.now(timezone.utc)
        assignment.completion_note = note
        db.add(AuditLog(user_id=user_id, action="volunteer_completion_requested", entity_type="volunteer_assignment", entity_id=assignment_id))
        await db.commit()
    return {"assignment_id": str(assignment_id), "status": assignment.status, "completion_pending": True}


@router.patch("/{assignment_id}/confirm")
async def confirm_assignment(assignment_id: uuid.UUID, current_user: dict = Depends(require_role("people")), db: AsyncSession = Depends(get_db)):
    user_id = await active_citizen(db, current_user)
    assignment = await db.scalar(select(VolunteerAssignment).where(VolunteerAssignment.assignment_id == assignment_id).with_for_update())
    if not assignment:
        raise HTTPException(404, "Assignment not found")
    mission = await db.get(ReliefMission, assignment.mission_id)
    request = await db.get(HelpRequest, mission.origin_request_id) if mission.origin_request_id else None
    if not request or request.user_id != user_id or assignment.user_id == user_id:
        raise HTTPException(403, "Only the recipient may confirm this assistance")
    if assignment.status == "completed":
        return {"assignment_id": str(assignment_id), "status": "completed"}
    if assignment.status not in ("accepted", "active") or not assignment.completion_requested_at:
        raise HTTPException(409, "The volunteer has not requested completion")
    assignment.status = "completed"
    assignment.completed_at = assignment.recipient_confirmed_at = datetime.now(timezone.utc)
    db.add(AuditLog(user_id=user_id, action="volunteer_recipient_confirmed", entity_type="volunteer_assignment", entity_id=assignment_id))
    await db.commit()
    return {"assignment_id": str(assignment_id), "status": "completed"}
