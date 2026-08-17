"""
ResQAI — First-Aid Chatbot Router
POST /first-aid-chat

Detects language, queries the LLM with a first-aid system prompt,
and flags critical emergencies that need Suwa Seriya (1990).
"""

import logging
from fastapi import APIRouter, HTTPException

from langdetect import detect, LangDetectException

from models.schemas import FirstAidRequest, FirstAidResponse
from services import llm_service

logger = logging.getLogger("resqai.chatbot")
router = APIRouter(tags=["Chatbot"])

CRITICAL_KEYWORDS = [
    "cardiac", "heart attack",
    "unconscious", "unresponsive",
    "not breathing", "stopped breathing", "no pulse",
    "severe bleeding", "heavy bleeding",
    "choking", "drowning",
    "stroke", "seizure",
    "anaphylaxis", "allergic shock",
]

SYSTEM_PROMPT = (
    "You are a certified first-aid assistant for ResQAI Sri Lanka. "
    "Always respond in the same language the user writes in. "
    "Give numbered steps only. "
    "For critical or life-threatening cases always say to call 1990 "
    "(Suwa Seriya ambulance service). "
    "Never diagnose medical conditions. "
    "Keep your response under 150 words."
)

FALLBACK_REPLIES = {
    "en": (
        "I'm temporarily unable to provide detailed guidance. "
        "If this is a life-threatening emergency, please call "
        "1990 (Suwa Seriya) immediately. Stay calm, keep the "
        "patient still, and wait for help."
    ),
    "si": (
        "මට තාවකාලිකව සවිස්තරාත්මක මාර්ගෝපදේශ ලබා දිය නොහැක. "
        "මෙය ජීවිතයට තර්ජනයක් වන හදිසි අවස්ථාවක් නම්, කරුණාකර "
        "වහාම 1990 (සුව සැරිය) අමතන්න."
    ),
    "ta": (
        "விரிவான வழிகாட்டுதலை வழங்க தற்போது இயலவில்லை. "
        "இது உயிருக்கு ஆபத்தான அவசரநிலை என்றால், உடனடியாக "
        "1990 (சுவ சரிய) அழைக்கவும்."
    ),
}

def _detect_language(text: str, fallback: str = "en") -> str:
    """Detect language with langdetect, return ISO 639-1 code."""
    try:
        lang = detect(text)

        if lang.startswith("si"):
            return "si"
        if lang.startswith("ta"):
            return "ta"
        return lang
    except LangDetectException:
        return fallback

def _is_critical(text: str) -> bool:
    """Check if the LLM response mentions critical conditions."""
    lower = text.lower()
    return any(kw in lower for kw in CRITICAL_KEYWORDS)

@router.post("/first-aid-chat", response_model=FirstAidResponse)
async def first_aid_chat(req: FirstAidRequest):
    """
    Accept a first-aid question in any language, detect the language,
    get an LLM-generated response, and flag critical emergencies.
    """

    if req.language == "auto":
        detected = _detect_language(req.message)
    else:
        detected = req.language

    try:
        reply = await llm_service.chat(
            system_prompt=SYSTEM_PROMPT,
            user_message=req.message,
            max_tokens=512,
            temperature=0.3,
        )
    except Exception as exc:
        logger.error("LLM failed for first-aid-chat: %s", exc)

        fallback = FALLBACK_REPLIES.get(detected, FALLBACK_REPLIES["en"])
        return FirstAidResponse(
            reply=fallback,
            language_detected=detected,
            show_1990=True,
            is_critical=True,
        )

    combined_text = f"{req.message} {reply}".lower()
    is_critical = _is_critical(combined_text)
    show_1990 = is_critical or "1990" in reply

    return FirstAidResponse(
        reply=reply,
        language_detected=detected,
        show_1990=show_1990,
        is_critical=is_critical,
    )
