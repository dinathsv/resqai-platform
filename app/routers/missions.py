"""
ResQAI — Missions Router.
Handles listing and managing relief missions.
"""

import logging
from typing import Any, Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.relief_mission import ReliefMission

logger = logging.getLogger("resqai.missions")
router = APIRouter(tags=["Missions"])


@router.get("")
async def list_missions(
    status: Optional[str] = Query(None, description="Filter by status (e.g. 'active')"),
    db: AsyncSession = Depends(get_db),
):
    """List relief missions, optionally filtered by status."""
    query = select(ReliefMission).order_by(ReliefMission.created_at.desc())

    if status:
        query = query.where(ReliefMission.status == status)

    result = await db.execute(query)
    missions = result.scalars().all()

    return [
        {
            "mission_id": str(m.mission_id),
            "title": m.title,
            "description": m.description or "",
            "district": m.district or "General",
            "target": float(m.target) if m.target else 0,
            "funds_collected": float(m.funds_collected) if m.funds_collected else 0,
            "status": m.status,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in missions
    ]
