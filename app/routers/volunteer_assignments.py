"""Volunteer acceptance and participation assignments."""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import require_role
from app.models.relief_mission import ReliefMission
from app.models.volunteer_assignment import VolunteerAssignment

router = APIRouter(tags=["Volunteer Assignments"])


class JoinMissionRequest(BaseModel):
    mission_id: str


@router.get("")
async def list_my_assignments(
    current_user: dict[str, Any] = Depends(require_role("people")),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.get("sub")
    result = await db.execute(
        select(VolunteerAssignment)
        .join(ReliefMission, ReliefMission.mission_id == VolunteerAssignment.mission_id)
        .where(VolunteerAssignment.user_id == user_id)
        .order_by(VolunteerAssignment.assigned_at.desc())
    )
    assignments = result.scalars().all()
    response = []
    for assignment in assignments:
        mission_result = await db.execute(
            select(ReliefMission).where(ReliefMission.mission_id == assignment.mission_id)
        )
        mission = mission_result.scalars().first()
        response.append({
            "assignment_id": str(assignment.assignment_id),
            "mission_id": str(assignment.mission_id),
            "mission_title": mission.title if mission else None,
            "status": assignment.status,
            "hours_logged": assignment.hours_logged,
            "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
            "completed_at": assignment.completed_at.isoformat() if assignment.completed_at else None,
        })
    return response


@router.post("", status_code=status.HTTP_201_CREATED)
async def join_mission(
    req: JoinMissionRequest,
    current_user: dict[str, Any] = Depends(require_role("people")),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.get("sub")
    mission_result = await db.execute(select(ReliefMission).where(ReliefMission.mission_id == req.mission_id))
    mission = mission_result.scalars().first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    if mission.status not in ("planning", "active"):
        raise HTTPException(status_code=400, detail="Mission is not accepting helpers")

    existing_result = await db.execute(
        select(VolunteerAssignment).where(
            VolunteerAssignment.user_id == user_id,
            VolunteerAssignment.mission_id == mission.mission_id,
            VolunteerAssignment.status != "cancelled",
        )
    )
    if existing_result.scalars().first():
        raise HTTPException(status_code=409, detail="User has already joined this mission")

    assignment = VolunteerAssignment(
        user_id=user_id,
        mission_id=mission.mission_id,
        status="accepted",
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return {
        "assignment_id": str(assignment.assignment_id),
        "mission_id": str(assignment.mission_id),
        "status": assignment.status,
        "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
    }


@router.patch("/{assignment_id}/complete")
async def complete_assignment(
    assignment_id: str,
    current_user: dict[str, Any] = Depends(require_role("people")),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.get("sub")
    result = await db.execute(
        select(VolunteerAssignment).where(
            VolunteerAssignment.assignment_id == assignment_id,
            VolunteerAssignment.user_id == user_id,
        )
    )
    assignment = result.scalars().first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    assignment.status = "completed"
    assignment.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(assignment)
    return {"assignment_id": str(assignment.assignment_id), "status": assignment.status}
