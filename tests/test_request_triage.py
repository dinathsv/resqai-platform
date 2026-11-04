"""Affected-person counts inform priority without lowering critical danger signals."""

from unittest.mock import AsyncMock

import pytest

from app.services.request_triage import initial_triage, triage_request


@pytest.mark.parametrize("request_type, affected_people, legacy_urgency, expected", [
    ("help_rescue", 0, None, 2),
    ("help_rescue", 1, None, 3),
    ("help_rescue", None, None, 3),
    ("donation", 12, None, 2),
    ("help_rescue", 2, 1, 3),
    ("help_rescue", 0, 4, 4),
])
def test_rules_use_count_and_legacy_urgency_can_only_raise_priority(
    request_type, affected_people, legacy_urgency, expected,
):
    result = initial_triage("Please check the road after rainfall", request_type,
                            legacy_urgency, affected_people)
    assert result["urgency_level"] == expected
    assert result["triage_source"] == "rules"


@pytest.mark.parametrize("message", [
    "Someone is trapped by flood water",
    "සිහිසුන් පුද්ගලයෙකුට උදව් අවශ්‍යයි",
    "ஒருவர் சிக்கிய நிலையில் உள்ளார்",
])
def test_explicit_zero_never_suppresses_critical_description(message):
    assert initial_triage(message, "help_rescue", affected_people=0)["urgency_level"] == 5


@pytest.mark.asyncio
async def test_ai_receives_count_and_cannot_lower_rule_priority(monkeypatch):
    monkeypatch.setattr("app.services.request_triage.settings.AI_API_KEY", "test-key")
    translate = AsyncMock(return_value={
        "urgency_level": 1, "summary_english": "Flood water reported nearby", "emergency_type": "flood",
    })
    monkeypatch.setattr("app.routers.ai.translate_report", translate)
    message = "Please check flood water near the road"
    result = await triage_request(message, "help_rescue", affected_people=12)
    sent_message = translate.await_args.args[0].message
    assert message in sent_message
    assert "12" in sent_message
    assert result["urgency_level"] == 3
    assert result["triage_source"] == "ai_assisted"


@pytest.mark.asyncio
async def test_ai_failure_keeps_zero_count_fallback(monkeypatch):
    monkeypatch.setattr("app.services.request_triage.settings.AI_API_KEY", "test-key")
    translate = AsyncMock(side_effect=RuntimeError("AI unavailable"))
    monkeypatch.setattr("app.routers.ai.translate_report", translate)
    result = await triage_request("Please check the road after rainfall", "help_rescue", affected_people=0)
    assert "0" in translate.await_args.args[0].message
    assert result["urgency_level"] == 2
    assert result["triage_source"] == "rules"


@pytest.mark.asyncio
async def test_ai_can_raise_priority_above_zero_count_baseline(monkeypatch):
    monkeypatch.setattr("app.services.request_triage.settings.AI_API_KEY", "test-key")
    monkeypatch.setattr("app.routers.ai.translate_report", AsyncMock(return_value={
        "urgency_level": 4, "summary_english": "Rapidly rising water near homes", "emergency_type": "flood",
    }))
    result = await triage_request("Water is rising near homes", "help_rescue", affected_people=0)
    assert result["urgency_level"] == 4
    assert result["incident_type"] == "flood"
