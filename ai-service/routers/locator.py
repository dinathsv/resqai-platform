"""
ResQAI — Resource Locator Router
POST /locate-resources

Queries PostGIS for the 3 nearest hospitals, then asks the LLM
to recommend the best match based on emergency type.
"""

import logging
import json
from fastapi import APIRouter

from models.schemas import (
    LocateResourcesRequest,
    LocateResourcesResponse,
    HospitalInfo,
)
from services import llm_service, db_service

logger = logging.getLogger("resqai.locator")
router = APIRouter(tags=["Locator"])

SYSTEM_PROMPT = (
    "You are a hospital recommendation engine for ResQAI Sri Lanka. "
    "The user will provide a JSON object with:\n"
    "- emergency_type: the kind of emergency\n"
    "- hospitals: a list of nearby hospitals with their capabilities\n\n"
    "Return ONLY valid JSON with:\n"
    "{\n"
    '  "recommended_index": <0-based index of the best hospital>,\n'
    '  "reason": "<one-sentence explanation>",\n'
    '  "contact_1990": <true if this emergency warrants calling 1990 Suwa Seriya>\n'
    "}\n"
    "Rules:\n"
    "- For cardiac emergencies, prefer hospitals with cardiac ICU.\n"
    "- For trauma (accidents, wounds, falls), prefer hospitals with a trauma unit.\n"
    "- If all hospitals are far (> 20 km), set contact_1990 to true.\n"
    "- Always set contact_1990 to true for: cardiac, drowning, unconscious, "
    "severe bleeding, poisoning.\n"
    "- Return ONLY the JSON object."
)

# Emergency types that always need 1990
ALWAYS_1990 = {
    "medical", "fire", "search_and_rescue",
    "hazardous_material", "tsunami", "earthquake",
}

# ── Endpoint ─────────────────────────────────────────────────

@router.post("/locate-resources", response_model=LocateResourcesResponse)
async def locate_resources(req: LocateResourcesRequest):
    """
    Find the 3 nearest hospitals via PostGIS and get an LLM
    recommendation for which is best for this emergency type.
    """
    # 1. Query PostGIS
    rows = await db_service.get_nearest_hospitals(req.lat, req.lng, limit=3)

    if not rows:
        # No hospitals in DB
        return LocateResourcesResponse(
            hospitals=[],
            recommended=None,
            recommendation_reason="No hospitals found in the database.",
            contact_1990=True,
        )

    # 2. Build hospital list
    hospitals = [
        HospitalInfo(
            hospital_id=str(row["hospital_id"]),
            name=row["name"],
            phone=row.get("phone"),
            specialization=row.get("specialization"),
            has_cardiac_icu=row.get("has_cardiac_icu", False),
            has_trauma_unit=row.get("has_trauma_unit", False),
            latitude=row["latitude"],
            longitude=row["longitude"],
            distance_metres=round(row["distance_metres"], 1),
        )
        for row in rows
    ]

    # 3. Ask LLM for recommendation
    try:
        llm_input = json.dumps({
            "emergency_type": req.emergency_type,
            "hospitals": [h.model_dump() for h in hospitals],
        }, indent=2)

        data = await llm_service.chat_json(
            system_prompt=SYSTEM_PROMPT,
            user_message=llm_input,
            max_tokens=256,
            temperature=0.1,
        )

        rec_index = data.get("recommended_index", 0)
        rec_index = max(0, min(rec_index, len(hospitals) - 1))
        reason = data.get("reason", "Nearest available hospital.")
        contact_1990 = data.get("contact_1990", False)

    except Exception as exc:
        logger.error("LLM failed for locate-resources: %s", exc)
        # Fallback: recommend closest hospital
        rec_index = 0
        reason = "Nearest hospital (LLM unavailable for detailed recommendation)."
        contact_1990 = req.emergency_type.lower() in ALWAYS_1990

    # Override contact_1990 for always-critical types
    if req.emergency_type.lower() in ALWAYS_1990:
        contact_1990 = True

    # If nearest hospital > 20 km, always recommend 1990
    if hospitals[0].distance_metres > 20_000:
        contact_1990 = True

    return LocateResourcesResponse(
        hospitals=hospitals,
        recommended=hospitals[rec_index],
        recommendation_reason=reason,
        contact_1990=contact_1990,
    )
