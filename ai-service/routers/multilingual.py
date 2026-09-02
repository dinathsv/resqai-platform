"""
ResQAI — Multilingual Report Translator & Extractor
POST /translate-report

Takes a disaster report in Sinhala, Tamil, or English and uses the
LLM to extract structured emergency metadata as JSON.
"""

import logging
from fastapi import APIRouter

from langdetect import detect, LangDetectException

from models.schemas import TranslateReportRequest, TranslateReportResponse
from services import llm_service

logger = logging.getLogger("resqai.multilingual")
router = APIRouter(tags=["Multilingual"])

SYSTEM_PROMPT = (
    "You are a multilingual emergency report parser for ResQAI Sri Lanka. "
    "The user will send a disaster or emergency report written in Sinhala, Tamil, or English. "
    "Extract the following fields and return ONLY valid JSON — no explanation, no markdown:\n"
    "{\n"
    '  "emergency_type": "<one of: flood, landslide, tsunami, earthquake, fire, '
    'medical, search_and_rescue, infrastructure_damage, hazardous_material, other>",\n'
    '  "urgency_level": <integer 1-5, where 5 is most urgent>,\n'
    '  "location_mentioned": "<location name or null if not mentioned>",\n'
    '  "people_count": <integer or null if unknown>,\n'
    '  "summary_english": "<one-sentence English summary of the report>"\n'
    "}\n"
    "Rules:\n"
    "- If the report mentions injuries or trapped people, urgency must be >= 4.\n"
    "- If children or elderly are mentioned, increase urgency by 1 (max 5).\n"
    "- Always provide a summary_english even if the original is already in English.\n"
    "- Return ONLY the JSON object, nothing else."
)

FALLBACK_RESPONSE = TranslateReportResponse(
    emergency_type="other",
    urgency_level=3,
    location_mentioned=None,
    people_count=None,
    summary_english="Unable to process report — please try again or contact an operator.",
    original_language="unknown",
)

def _detect_language(text: str) -> str:
    try:
        lang = detect(text)
        if lang.startswith("si"):
            return "si"
        if lang.startswith("ta"):
            return "ta"
        return lang
    except LangDetectException:
        return "unknown"

@router.post("/translate-report", response_model=TranslateReportResponse)
async def translate_report(req: TranslateReportRequest):
    """
    Parse a disaster report in any language and return structured
    emergency metadata as JSON.
    """
    detected_lang = _detect_language(req.message)

    try:
        data = await llm_service.chat_json(
            system_prompt=SYSTEM_PROMPT,
            user_message=req.message,
            max_tokens=512,
            temperature=0.1,
        )
    except ValueError as ve:
        logger.error("JSON parse failed for translate-report: %s", ve)
        fallback = FALLBACK_RESPONSE.model_copy()
        fallback.original_language = detected_lang
        return fallback
    except Exception as exc:
        logger.error("LLM failed for translate-report: %s", exc)
        fallback = FALLBACK_RESPONSE.model_copy()
        fallback.original_language = detected_lang
        return fallback

    urgency = data.get("urgency_level", 3)
    urgency = max(1, min(5, int(urgency)))

    return TranslateReportResponse(
        emergency_type=data.get("emergency_type", "other"),
        urgency_level=urgency,
        location_mentioned=data.get("location_mentioned"),
        people_count=data.get("people_count"),
        summary_english=data.get("summary_english", "No summary available."),
        original_language=detected_lang,
    )
