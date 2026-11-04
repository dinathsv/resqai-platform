"""Coordinator notification failures must not discard a saved emergency report."""

import uuid

import httpx
import pytest

from app.config import settings
from app.routers import requests


def notification_transport(monkeypatch, handler):
    client_type = httpx.AsyncClient
    monkeypatch.setattr(
        requests.httpx, "AsyncClient",
        lambda: client_type(transport=httpx.MockTransport(handler)),
    )


@pytest.mark.asyncio
async def test_coordinator_notification_uses_configured_url_and_internal_key(monkeypatch):
    seen = []

    def handler(request):
        seen.append(request)
        return httpx.Response(200, json={"success": True})

    monkeypatch.setattr(settings, "NODE_BACKEND_URL", "https://node.example.test/")
    monkeypatch.setattr(settings, "INTERNAL_API_KEY", "isolated-test-internal-key-at-least-32-characters")
    notification_transport(monkeypatch, handler)
    await requests.notify_new_request(str(uuid.uuid4()), "help_rescue", 3, "Need assistance")
    assert len(seen) == 1
    assert str(seen[0].url) == "https://node.example.test/api/requests/new"
    assert seen[0].headers["X-Internal-API-Key"] == settings.INTERNAL_API_KEY


@pytest.mark.asyncio
async def test_failed_coordinator_transport_keeps_request_saved(client, monkeypatch, caplog):
    def unavailable(request):
        raise httpx.ConnectError("All connection attempts failed", request=request)

    monkeypatch.setattr(settings, "NODE_BACKEND_URL", "http://localhost:5000")
    notification_transport(monkeypatch, unavailable)
    response = await client.post("/api/requests", json={
        "message": "Family trapped by flood water", "affected_people": 4,
        "client_request_id": str(uuid.uuid4()),
    })
    assert response.status_code == 201, response.text
    assert response.json()["verification_status"] == "unverified"
    assert "Set NODE_BACKEND_URL" in caplog.text
    assert "remains saved for review" in caplog.text
    # The database-backed, redacted listing still works when sockets are unavailable.
    public = (await client.get("/api/requests/public")).json()
    assert public[0]["verification_status"] == "unverified"
    assert "Family" not in str(public)
    from app.database import get_db
    from app.main import app
    from app.models.help_request import HelpRequest

    async for db in app.dependency_overrides[get_db]():
        record = await db.get(HelpRequest, uuid.UUID(response.json()["request_id"]))
        assert record is not None and record.affected_people == 4


@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", [401, 503])
async def test_internal_auth_failure_has_actionable_log_without_response_body(monkeypatch, caplog, status_code):
    notification_transport(monkeypatch, lambda request: httpx.Response(status_code, text="private response data"))
    await requests.notify_new_request(str(uuid.uuid4()), "help_rescue", 3)
    assert "matching INTERNAL_API_KEY" in caplog.text
    assert "private response data" not in caplog.text
