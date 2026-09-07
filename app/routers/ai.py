"""
ResQAI — AI Router.
4 AI endpoints: first-aid-chat, translate-report, generate-summary, locate-resources.
"""

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends
import langdetect
from pydantic import BaseModel

from app.services.ai_service import call_llm
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger("resqai.ai_router")
router = APIRouter(tags=["AI"])


def detect_language(text: str) -> str:
    """
    Detect language of text. Supports Sinhala by checking Unicode ranges.
    Falls back to langdetect for other languages.
    """
    # Check for Sinhala characters (Unicode range 0D80-0DFF)
    has_sinhala = any('඀' <= char <= '෿' for char in text)
    if has_sinhala:
        return "si"

    # Check for Tamil characters (Unicode range 0B80-0BFF)
    has_tamil = any('஀' <= char <= '௿' for char in text)
    if has_tamil:
        return "ta"

    # Use langdetect for other languages, default to English
    try:
        langdetect.DetectorFactory.seed = 0
        detected = langdetect.detect(text)
        if detected in ["si", "ta"]:
            return detected
        return "en"
    except langdetect.LangDetectException:
        return "en"

class FirstAidRequest(BaseModel):
    message: str
    language: str = "auto"

class TranslateReportRequest(BaseModel):
    message: str

class HelpRequestItem(BaseModel):
    request_id: str | None = None
    emergency_type: str | None = None
    urgency_level: int | None = None
    location: str | None = None
    message: str | None = None

class GenerateSummaryRequest(BaseModel):
    requests: list[HelpRequestItem]

class HospitalInfo(BaseModel):
    hospital_id: str
    name: str
    phone: str | None = None
    specialization: str | None = None
    has_cardiac_icu: bool
    has_trauma_unit: bool
    distance_meters: float

class LocateResourcesRequest(BaseModel):
    lat: float
    lng: float
    emergency_type: str
    hospitals: list[HospitalInfo]

@router.post("/first-aid-chat")
async def first_aid_chat(req: FirstAidRequest):
    lang = req.language
    if lang == "auto":
        lang = detect_language(req.message)

    system_prompt = (
        "You are a certified emergency first-aid assistant for ResQAI Sri Lanka.\n"
        "Detect the language of the user message (Sinhala, Tamil, or English) and ALWAYS respond in that exact same language.\n"
        "- If the user writes in English (even with typos or slang like 'im darwning'), respond in English.\n"
        "- If the user writes in Sinhala (Sinhala script or Singlish phrases like 'mata una', 'watura'), respond in Sinhala.\n"
        "- If the user writes in Tamil (Tamil script or Tanglish phrases), respond in Tamil.\n"
        "Rules:\n"
        "- If the user sends a greeting (e.g. 'hi', 'hello'), respond with a warm, brief greeting and ask how you can help with their emergency or first aid.\n"
        "- For emergencies or first-aid queries, give clear, numbered action steps only — no long paragraphs.\n"
        "- Keep response concise (under 150 words).\n"
        "- For life-threatening emergencies (e.g. cardiac arrest, drowning, unconsciousness, severe bleeding, trapped/buried in sand or debris, breathing difficulty): "
        "always prioritize calling 1990 Suwa Seriya immediately, followed by critical life-saving first-aid steps.\n"
        "- Never diagnose medical conditions.\n"
        "- If message is completely unrelated to health or emergencies, politely remind them that this service is dedicated to first-aid emergencies."
    )

    reply = await call_llm(system_prompt, req.message, max_tokens=1024)

    fallback_replies = {
        "en": "Please call 1990 Suwa Seriya immediately for emergency assistance.",
        "si": "හදිසි අවස්ථාවක් සඳහා කරුණාකර වහාම 1990 සුව සැරිය අමතන්න.",
        "ta": "அவசர உதவிக்கு உடனடியாக 1990 சுவ செரியாவை அழைக்கவும்."
    }

    if not reply:
        return {
            "reply": fallback_replies.get(lang, fallback_replies["en"]),
            "language_detected": lang,
            "show_1990": True,
            "is_critical": True
        }

    reply_lower = reply.lower()
    msg_lower = req.message.lower()
    combined = reply_lower + " " + msg_lower

    critical_kws = [
        "1990", "cardiac", "unconscious", "not breathing", "severe bleeding",
        "call immediately", "drowning", "darwning", "buried", "trapped",
        "සුව සැරිය", "සුවසැරිය", "හුස්ම", "அவசர"
    ]
    is_critical = any(kw in combined for kw in critical_kws)
    show_1990 = "1990" in reply or is_critical

    return {
        "reply": reply,
        "language_detected": lang,
        "show_1990": show_1990,
        "is_critical": is_critical
    }

@router.post("/translate-report")
async def translate_report(req: TranslateReportRequest):
    lang = detect_language(req.message)
    if not lang:
        lang = "unknown"

    system_prompt = (
        "Extract and return ONLY JSON:\n"
        "{\n"
        '  "emergency_type": "flood|medical|fire|accident|landslide|other",\n'
        '  "urgency_level": <1-5>,\n'
        '  "location_mentioned": "string or null",\n'
        '  "people_count": "number or unknown",\n'
        '  "summary_english": "one clear sentence"\n'
        "}"
    )

    fallback = {
        "emergency_type": "other",
        "urgency_level": 3,
        "location_mentioned": None,
        "people_count": "unknown",
        "summary_english": "Help request received — details unclear",
        "language_detected": lang
    }

    reply = await call_llm(system_prompt, req.message, max_tokens=1024)
    if not reply:
        return fallback

    cleaned = reply.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("\n", 1)[0]
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)

        urgency = data.get("urgency_level")
        if not urgency or not isinstance(urgency, int):
            distress_kws = ["help", "die", "save", "urgent", "emergency"]
            if any(kw in req.message.lower() for kw in distress_kws):
                urgency = 4
            else:
                urgency = 3

        data["urgency_level"] = urgency
        data["language_detected"] = lang
        return data
    except json.JSONDecodeError:
        logger.error(f"Failed to parse JSON from LLM: {reply}")
        return fallback

@router.post("/generate-summary")
async def generate_summary(req: GenerateSummaryRequest):
    requests_json = json.dumps([r.model_dump() for r in req.requests])

    system_prompt = (
        "You are an emergency operations analyst for ResQAI Sri Lanka. "
        "The following are active help requests. Write a 3-paragraph situational report "
        "for a government administrator. Include: total incidents, most critical zones, "
        "predominant emergency types, top 3 priority actions."
    )

    user_msg = f"Data: {requests_json}"

    reply = await call_llm(system_prompt, user_msg, max_tokens=1024)

    critical_count = sum(1 for r in req.requests if r.urgency_level and r.urgency_level >= 4)

    return {
        "narrative": reply or "Summary generation failed.",
        "total_incidents": len(req.requests),
        "critical_count": critical_count,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

from datetime import datetime, timezone

@router.post("/locate-resources")
async def locate_resources(req: LocateResourcesRequest):
    hospitals_json = json.dumps([h.model_dump() for h in req.hospitals])

    system_prompt = (
        "Return ONLY JSON:\n"
        "{\n"
        '  "recommended_hospital_id": "uuid-string",\n'
        '  "reason": "one sentence explanation",\n'
        '  "should_call_1990": true/false\n'
        "}"
    )

    user_msg = (
        f"A user has reported a {req.emergency_type} emergency. "
        f"Their location: {req.lat},{req.lng}. "
        f"Nearest hospitals: {hospitals_json}. "
        "Recommend the single most appropriate hospital for this emergency type "
        "and explain in one sentence why. Also state: should_call_1990: true or false."
    )

    fallback_should_call = req.emergency_type.lower() in ["medical", "accident", "fire"]
    fallback = {
        "hospitals": [h.model_dump() for h in req.hospitals],
        "recommendation": req.hospitals[0].model_dump() if req.hospitals else None,
        "should_call_1990": fallback_should_call
    }

    if not req.hospitals:
        return fallback

    reply = await call_llm(system_prompt, user_msg, max_tokens=1024)
    if not reply:
        return fallback

    cleaned = reply.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("\n", 1)[0]
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
        rec_id = data.get("recommended_hospital_id")

        recommended = next((h.model_dump() for h in req.hospitals if str(h.hospital_id) == str(rec_id)), None)
        if not recommended:
            recommended = req.hospitals[0].model_dump()

        return {
            "hospitals": [h.model_dump() for h in req.hospitals],
            "recommendation": recommended,
            "recommendation_reason": data.get("reason", ""),
            "should_call_1990": data.get("should_call_1990", fallback_should_call)
        }
    except json.JSONDecodeError:
        return fallback
