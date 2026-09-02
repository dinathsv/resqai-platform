"""
ResQAI — Situational Summary Generator
POST /generate-summary

Accepts a batch of active help requests and uses the LLM to
produce a narrative briefing for government administrators.
"""

import logging
import json
from fastapi import APIRouter

from models.schemas import (
    GenerateSummaryRequest,
    GenerateSummaryResponse,
)
from services import llm_service

logger = logging.getLogger("resqai.situational")
router = APIRouter(tags=["Situational"])

SYSTEM_PROMPT = (
    "You are an emergency operations analyst for ResQAI Sri Lanka. "
    "The user will provide a JSON array of active help requests. "
    "Produce your response as valid JSON with exactly these fields:\n"
    "{\n"
    '  "narrative": "<3-paragraph briefing for a government administrator. '
    "Include: total count, critical zones, emergency types by frequency, "
    'and recommended priority actions.>",\n'
    '  "total_incidents": <integer>,\n'
    '  "critical_count": <integer — count of requests with urgency_level >= 4>,\n'
    '  "zones": [<list of unique location/zone strings mentioned>]\n'
    "}\n"
    "Rules:\n"
    "- The narrative must be professional, concise, and actionable.\n"
    "- If locations are missing, note that in the narrative.\n"
    "- Return ONLY the JSON object."
)

# ── Fallback ─────────────────────────────────────────────────

def _build_fallback(requests: list[dict]) -> GenerateSummaryResponse:
    """Generate a basic summary without the LLM."""
    total = len(requests)
    critical = sum(1 for r in requests if r.get("urgency_level", 0) >= 4)

    # Gather unique zones
    zones = list({
        r.get("location", "Unknown")
        for r in requests
        if r.get("location")
    })

    narrative = (
        f"Automated summary (LLM unavailable): {total} active incidents, "
        f"{critical} critical. Zones affected: {', '.join(zones) or 'Unknown'}. "
        "Manual review recommended."
    )

    return GenerateSummaryResponse(
        narrative=narrative,
        total_incidents=total,
        critical_count=critical,
        zones=zones,
    )


# ── Endpoint ─────────────────────────────────────────────────

@router.post("/generate-summary", response_model=GenerateSummaryResponse)
async def generate_summary(req: GenerateSummaryRequest):
    """
    Summarise a batch of help requests into an administrator briefing.
    """
    # Serialize requests for the LLM prompt
    requests_data = [item.model_dump() for item in req.requests]
    user_message = json.dumps(requests_data, indent=2)

    try:
        data = await llm_service.chat_json(
            system_prompt=SYSTEM_PROMPT,
            user_message=user_message,
            max_tokens=1024,
            temperature=0.3,
        )
    except (ValueError, Exception) as exc:
        logger.error("LLM failed for generate-summary: %s", exc)
        return _build_fallback(requests_data)

    # Ensure zones is a list
    zones = data.get("zones", [])
    if isinstance(zones, str):
        zones = [zones]

    return GenerateSummaryResponse(
        narrative=data.get("narrative", "Summary unavailable."),
        total_incidents=data.get("total_incidents", len(requests_data)),
        critical_count=data.get("critical_count", 0),
        zones=zones,
    )
