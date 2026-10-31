"""Explainable triage assistance. These signals do not establish whether a claim is true."""

import asyncio
from difflib import SequenceMatcher

from app.config import settings


def initial_triage(message: str, request_type: str, urgency: int | None = None) -> dict:
    text = message.casefold()
    critical = ("not breathing", "unconscious", "trapped", "drowning", "severe bleeding",
                "හුස්ම ගන්න බැ", "සිහිසුන්", "சுவாசிக்க முடிய", "மயக்கம்", "சிக்கிய")
    incident = next((kind for kind, words in {
        "flood": ("flood", "ගංවතුර", "வெள்ள"),
        "fire": ("fire", "ගින්න", "தீ"),
        "medical": ("injur", "bleeding", "තුවාල", "காயம்"),
        "landslide": ("landslide", "නාය", "மண்சரிவு"),
    }.items() if any(word in text for word in words)), "other")
    priority = max(urgency or (2 if request_type == "donation" else 3),
                   5 if any(word in text for word in critical) else 1)
    return {"urgency_level": priority, "incident_type": incident,
            "triage_source": "rules", "ai_summary": None}


async def triage_request(message: str, request_type: str, urgency: int | None = None) -> dict:
    result = initial_triage(message, request_type, urgency)
    # Saving a report must never wait indefinitely for an external AI service.
    if not settings.AI_API_KEY:
        return result
    try:
        from app.routers.ai import TranslateReportRequest, translate_report
        parsed = await asyncio.wait_for(translate_report(TranslateReportRequest(message=message)), timeout=3)
        score = parsed.get("urgency_level")
        summary = parsed.get("summary_english")
        if (isinstance(score, int) and not isinstance(score, bool) and 1 <= score <= 5
                and isinstance(summary, str) and summary.strip()
                and summary != "Help request received — details unclear"):
            result.update(urgency_level=max(result["urgency_level"], score),
                          ai_summary=summary[:1000], triage_source="ai_assisted")
            if parsed.get("emergency_type") in {"flood", "medical", "fire", "accident", "landslide", "other"}:
                result["incident_type"] = parsed["emergency_type"]
    except Exception:
        pass
    return result


def similar_report(message: str, previous: str) -> bool:
    first, second = " ".join(message.casefold().split()), " ".join(previous.casefold().split())
    return len(first) >= 20 and SequenceMatcher(None, first, second).ratio() >= 0.88
