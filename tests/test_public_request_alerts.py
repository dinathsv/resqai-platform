"""Only administrator-verified requests can appear in public feeds."""

import uuid
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.database import get_db
from app.main import app
from app.models.help_request import HelpRequest
from app.models.administrator import Administrator
from app.models.emergency_alert import EmergencyAlert
from app.models.user import User
from app.routers.alerts import acknowledge_request_alert
from app.routers.auth import create_access_token


@pytest.mark.asyncio
async def test_public_feeds_publish_only_verified_open_requests(client):
    cases = [
        ("unverified", "pending", "pending", "help_rescue", False),
        ("unverified", "pending", "pending", "donation", False),
        ("needs_information", "pending", "pending", "help_rescue", False),
        ("needs_information", "pending", "pending", "donation", False),
        ("verified", "pending", "pending", "help_rescue", True),
        ("verified", "pending", "pending", "donation", True),
        ("verified", "in_progress", "in_progress", "help_rescue", True),
        ("rejected", "pending", "pending", "help_rescue", False),
        ("unverified", "cancelled", "pending", "help_rescue", False),
        ("needs_information", "resolved", "finished", "donation", False),
        ("verified", "pending", "finished", "help_rescue", False),
        ("verified", "resolved", "finished", "help_rescue", False),
        ("verified", "cancelled", "pending", "donation", False),
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
            "Verified goods assistance request", "Verified help request",
        }
        assert all(item["source"] == "community_request" for item in feed)
        for item in feed:
            assert not {"original_message", "ai_summary", "evidence_note", "gps_location", "lat", "lng",
                        "location_label", "requested_items", "user_id", "identity_evidence"}.intersection(item)


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["help_rescue", "donation"])
async def test_request_stays_with_owner_and_admin_until_verified_and_hides_after_withdrawal(client, monkeypatch, kind):
    monkeypatch.setattr("app.routers.requests.notify_new_request", AsyncMock())
    owner, other, admin = [uuid.uuid4() for _ in range(3)]
    async for db in app.dependency_overrides[get_db]():
        for subject in (owner, other):
            db.add(User(user_id=subject, full_name="Test citizen", email=f"{subject}@example.test",
                        phone_number="+94771234567", password_hash="test-only", is_verified=True, is_active=True))
        db.add(Administrator(admin_id=admin, full_name="Test coordinator", email=f"{admin}@example.test",
                             password_hash="test-only", is_active=True))
        await db.commit()

    def headers(subject, role="people"):
        return {"Authorization": "Bearer " + create_access_token({"sub": str(subject), "role": role}, timedelta(minutes=20))}

    submitted = await client.post("/api/requests", headers=headers(owner), json={
        "message": "Private household details for coordinator review", "request_type": kind,
        "requested_items": [{"item_name": "Drinking water", "quantity": 4, "unit": "bottles"}] if kind == "donation" else [],
    })
    assert submitted.status_code == 201, submitted.text
    request_id = submitted.json()["request_id"]
    assert submitted.json()["verification_status"] == "unverified"
    assert (await client.get("/api/requests/my", headers=headers(owner))).json()[0]["request_id"] == request_id
    assert (await client.get(f"/api/requests/{request_id}", headers=headers(admin, "admin"))).status_code == 200
    assert (await client.get("/api/requests", headers=headers(admin, "admin"))).json()[0]["request_id"] == request_id
    unauthorized = await client.get(f"/api/requests/{request_id}", headers=headers(other))
    missing = await client.get(f"/api/requests/{uuid.uuid4()}", headers=headers(other))
    assert unauthorized.status_code == missing.status_code == 404
    assert unauthorized.json() == missing.json()
    assert (await client.get("/api/requests", headers=headers(other))).status_code == 403
    assert (await client.patch(f"/api/requests/{request_id}/status", headers=headers(owner), json={"status": "verified"})).status_code == 403

    paths = ("/api/requests/public", "/api/requests/community", "/api/alerts", "/api/alerts?status=all")
    async def visible_ids(path):
        response = await client.get(path, headers=headers(other))
        assert response.status_code == 200, response.text
        data = response.json()
        items = data["alerts"] if isinstance(data, dict) else data
        assert "Private" not in response.text
        return [item.get("alert_id", item.get("request_id")) for item in items]

    for path in paths:
        assert await visible_ids(path) == []

    # The Node administrator review commits this same verification field. Neither
    # creation, phone verification nor a requester-controlled status enables it.
    async for db in app.dependency_overrides[get_db]():
        record = await db.get(HelpRequest, uuid.UUID(request_id))
        record.verification_status = "verified"
        await db.commit()
    for path in paths:
        assert await visible_ids(path) == [request_id]
    assert (await client.get(f"/api/requests/{request_id}", headers=headers(other))).status_code == 404

    for decision in ("needs_information", "rejected", "unverified"):
        async for db in app.dependency_overrides[get_db]():
            record = await db.get(HelpRequest, uuid.UUID(request_id))
            record.verification_status = decision
            await db.commit()
        for path in paths:
            assert await visible_ids(path) == []


@pytest.mark.asyncio
async def test_admin_broadcast_remains_public_while_unverified_requests_are_hidden(client):
    admin_id, alert_id = uuid.uuid4(), uuid.uuid4()
    async for db in app.dependency_overrides[get_db]():
        db.add(Administrator(admin_id=admin_id, full_name="Test coordinator", email="coordinator@example.test",
                             password_hash="test-only", is_active=True))
        db.add(EmergencyAlert(alert_id=alert_id, admin_id=admin_id, disaster_type="flood", work_plan="Official instructions", status="active"))
        db.add(HelpRequest(original_message="Private pending request", emergency_type="help_rescue", verification_status="unverified"))
        await db.commit()
    response = await client.get("/api/alerts")
    assert response.status_code == 200, response.text
    feed = response.json()["alerts"]
    assert len(feed) == 1
    assert feed[0]["alert_id"] == str(alert_id)
    assert feed[0]["source"] == "admin_alert"
    assert feed[0]["work_plan"] == "Official instructions"


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["help_rescue", "donation"])
@pytest.mark.parametrize("verification", ["unverified", "needs_information", "rejected"])
async def test_pending_claims_cannot_be_accepted_or_start_fulfillment(kind, verification):
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
    assert error.value.status_code == 404
    assert error.value.detail == "Community request not found"
    assert db.execute.await_count == 2
    db.commit.assert_not_awaited()
