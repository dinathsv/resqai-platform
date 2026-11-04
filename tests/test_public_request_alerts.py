"""Open requests appear promptly with honest review labels and no private fields."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.database import get_db
from app.main import app
from app.models.help_request import HelpRequest
from app.routers.alerts import acknowledge_request_alert


@pytest.mark.asyncio
async def test_public_alert_feed_labels_open_claims_and_excludes_rejected_or_closed(client):
    cases = [
        ("unverified", "pending", "pending", "help_rescue", True),
        ("needs_information", "pending", "pending", "donation", True),
        ("verified", "in_progress", "in_progress", "help_rescue", True),
        ("rejected", "pending", "pending", "help_rescue", False),
        ("unverified", "cancelled", "pending", "help_rescue", False),
        ("needs_information", "resolved", "finished", "donation", False),
        ("verified", "pending", "finished", "help_rescue", False),
    ]
    expected = {}
    async for db in app.dependency_overrides[get_db]():
        for verification, status, admin_status, kind, visible in cases:
            record = HelpRequest(
                request_id=uuid.uuid4(), emergency_type=kind, status=status, admin_status=admin_status,
                verification_status=verification, original_message="Private household details",
                ai_summary="Private AI summary", evidence_note="Private identity evidence notes",
                location_label="Private exact address", gps_location="SRID=4326;POINT(80 7)",
                requested_items=[{"item_name": "Private need details", "quantity": 2, "unit": "packs"}],
            )
            db.add(record)
            if visible:
                expected[str(record.request_id)] = verification
        await db.commit()

    for path in ("/api/requests/public", "/api/requests/community"):
        response = await client.get(path)
        assert response.status_code == 200, response.text
        assert {item["request_id"]: item["verification_status"] for item in response.json()} == expected
        assert "Private" not in response.text

    for path in ("/api/alerts", "/api/alerts?status=active", "/api/alerts?status=all"):
        response = await client.get(path)
        assert response.status_code == 200, response.text
        feed = response.json()["alerts"]
        assert {item["alert_id"]: item["verification_status"] for item in feed} == expected
        assert "Private" not in response.text
        assert all(item["status"] == "active" for item in feed)
        assert {item["work_plan"] for item in feed} == {
            "Unverified help request", "Needs information: goods assistance request", "Verified help request",
        }
        for item in feed:
            assert not {"original_message", "ai_summary", "evidence_note", "gps_location", "lat", "lng",
                        "location_label", "requested_items", "user_id", "identity_evidence"}.intersection(item)


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["help_rescue", "donation"])
@pytest.mark.parametrize("verification", ["unverified", "needs_information"])
async def test_visible_pending_claims_cannot_be_accepted_or_start_fulfillment(kind, verification):
    user = MagicMock()
    user.first.return_value = {"user_id": uuid.uuid4()}
    claim = MagicMock()
    claim.mappings.return_value.first.return_value = {
        "user_id": uuid.uuid4(), "status": "pending", "admin_status": "pending",
        "emergency_type": kind, "verification_status": verification,
    }
    db = AsyncMock()
    db.execute.side_effect = [user, claim]
    with pytest.raises(HTTPException) as error:
        await acknowledge_request_alert(uuid.uuid4(), {"sub": str(uuid.uuid4())}, db)
    assert error.value.status_code == 409
    assert "verify" in error.value.detail
    assert db.execute.await_count == 2
    db.commit.assert_not_awaited()
