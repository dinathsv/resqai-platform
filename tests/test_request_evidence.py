"""Private evidence access, encryption, replay resistance and expiry boundaries."""

import base64
import asyncio
import io
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from cryptography.exceptions import InvalidTag
from fastapi import HTTPException
from PIL import Image
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.main import app
from app.models.administrator import Administrator
from app.models.audit_log import AuditLog
from app.models.help_request import HelpRequest
from app.models.request_evidence import RequestEvidence
from app.models.user import User
from app.routers import auth
from app.services.evidence_security import MAX_BODY_BYTES, decrypt_image, encrypt_image, normalize_image


def image_url(metadata=False):
    image = Image.new("RGB", (160, 120), (12, 70, 110))
    stream = io.BytesIO()
    exif = Image.Exif()
    if metadata:
        exif[270] = "Private original GPS and identity metadata"
    image.save(stream, format="JPEG", exif=exif)
    return "data:image/jpeg;base64," + base64.b64encode(stream.getvalue()).decode()


@pytest.fixture(autouse=True)
def evidence_configuration(monkeypatch):
    monkeypatch.setattr(settings, "EVIDENCE_ENCRYPTION_KEY", base64.urlsafe_b64encode(b"0123456789abcdef0123456789abcdef").decode())


async def seed_case():
    owner, other, admin, request_id = [uuid.uuid4() for _ in range(4)]
    async for db in app.dependency_overrides[get_db]():
        for subject in (owner, other):
            db.add(User(user_id=subject, full_name="Test requester", email=f"{subject}@example.test",
                        phone_number="+94771234567", password_hash="test-only", is_verified=True, is_active=True))
        db.add(Administrator(admin_id=admin, full_name="Test reviewer", email=f"{admin}@example.test",
                             password_hash="test-only", is_active=True))
        db.add(HelpRequest(request_id=request_id, user_id=owner, emergency_type="help_rescue",
                           original_message="Private household details", status="pending", admin_status="pending",
                           verification_status="unverified"))
        await db.commit()

    def headers(subject, role="people"):
        return {"Authorization": "Bearer " + auth.create_access_token({"sub": str(subject), "role": role}, timedelta(minutes=30))}
    return request_id, headers(owner), headers(other), headers(admin, "admin"), admin


async def capture_payload(client, request_id, owner):
    response = await client.post(f"/api/requests/{request_id}/verification-evidence/challenge", headers=owner)
    assert response.status_code == 200, response.text
    assert "no-store" in response.headers["cache-control"]
    return {"challenge_id": response.json()["challenge_id"], "nic_image": image_url(True),
            "selfie_image": image_url(), "captured_at": datetime.now(timezone.utc).isoformat(), "consent": True}


@pytest.mark.asyncio
async def test_private_pair_encrypted_redacted_audited_and_revocable(client):
    request_id, owner, other, reviewer, reviewer_id = await seed_case()
    path = f"/api/requests/{request_id}/verification-evidence"
    payload = await capture_payload(client, request_id, owner)
    uploaded = await client.post(path, headers=owner, json=payload)
    assert uploaded.status_code == 201, uploaded.text
    assert uploaded.json()["status"] == "pending_review"
    metadata = await client.get(path, headers=reviewer)
    assert metadata.status_code == 200, metadata.text
    items = metadata.json()["items"]
    assert {item["kind"] for item in items} == {"nic", "selfie"}
    assert "encrypted_image" not in metadata.text and "base64" not in metadata.text
    async for db in app.dependency_overrides[get_db]():
        records = (await db.scalars(select(RequestEvidence))).all()
        assert len(records) == 2
        for record in records:
            assert not record.encrypted_image.startswith(b"\xff\xd8")
            clear = decrypt_image(record.encrypted_image, request_id, record.evidence_id, record.kind)
            with Image.open(io.BytesIO(clear)) as image:
                assert image.format == "JPEG" and not image.getexif()
        request = await db.get(HelpRequest, request_id)
        assert request.verification_status == "unverified"

    image_path = f'{path}/{items[0]["evidence_id"]}/image'
    assert (await client.get(path)).status_code == 401
    assert (await client.get(path, headers=other)).status_code == 403
    assert (await client.get(image_path, headers=owner)).status_code == 403
    assert (await client.get(image_path, headers=other)).status_code == 403
    opened = await client.get(image_path, headers=reviewer)
    assert opened.status_code == 200 and opened.headers["content-type"] == "image/jpeg"
    assert "no-store" in opened.headers["cache-control"] and opened.headers["x-content-type-options"] == "nosniff"
    async for db in app.dependency_overrides[get_db]():
        log = (await db.scalars(select(AuditLog).where(AuditLog.action == "request_evidence_viewed"))).one()
        assert log.admin_id == reviewer_id and str(log.entity_id) == items[0]["evidence_id"]
    for public_path in ("/api/requests/community", "/api/alerts"):
        public = await client.get(public_path)
        assert "Private" not in public.text and "base64" not in public.text and "challenge" not in public.text
        assert all(item["evidence_id"] not in public.text for item in items)
    assert (await client.delete(path, headers=other)).status_code == 403
    assert (await client.delete(path, headers=owner)).json() == {"deleted": True}
    assert (await client.get(image_path, headers=reviewer)).status_code == 404


@pytest.mark.asyncio
async def test_challenge_is_one_use_and_bound_to_owner_and_request(client):
    request_id, owner, other, _, _ = await seed_case()
    path = f"/api/requests/{request_id}/verification-evidence"
    payload = await capture_payload(client, request_id, owner)
    assert (await client.post(path, headers=other, json=payload)).status_code == 403
    second = uuid.uuid4()
    async for db in app.dependency_overrides[get_db]():
        record = await db.get(HelpRequest, request_id)
        db.add(HelpRequest(request_id=second, user_id=record.user_id, original_message="Another private incident",
                           emergency_type="help_rescue", status="pending", admin_status="pending", verification_status="unverified"))
        await db.commit()
    assert (await client.post(f"/api/requests/{second}/verification-evidence", headers=owner, json=payload)).status_code == 409
    assert (await client.post(path, headers=owner, json=payload)).status_code == 201
    assert (await client.post(path, headers=owner, json=payload)).status_code == 409


@pytest.mark.asyncio
async def test_old_capture_missing_consent_and_invalid_image_do_not_consume_challenge(client):
    request_id, owner, _, _, _ = await seed_case()
    path = f"/api/requests/{request_id}/verification-evidence"
    payload = await capture_payload(client, request_id, owner)
    old = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    assert (await client.post(path, headers=owner, json={**payload, "captured_at": old})).status_code == 409
    assert (await client.post(path, headers=owner, json={**payload, "consent": False})).status_code == 422
    invalid = await client.post(path, headers=owner, json={**payload, "nic_image": "data:image/png;base64,PRIVATE_INVALID_IMAGE"})
    assert invalid.status_code == 422 and "PRIVATE_INVALID_IMAGE" not in invalid.text
    assert (await client.post(path, headers=owner, json=payload)).status_code == 201


@pytest.mark.asyncio
async def test_expired_challenge_cannot_upload(client):
    request_id, owner, _, _, _ = await seed_case()
    payload = await capture_payload(client, request_id, owner)
    redis = await anext(app.dependency_overrides[auth.get_redis]())
    await redis.delete(f'evidence-challenge:{payload["challenge_id"]}')
    assert (await client.post(f"/api/requests/{request_id}/verification-evidence", headers=owner, json=payload)).status_code == 409


@pytest.mark.asyncio
async def test_expired_images_cannot_be_served_and_are_removed(client):
    request_id, owner, _, reviewer, _ = await seed_case()
    path = f"/api/requests/{request_id}/verification-evidence"
    payload = await capture_payload(client, request_id, owner)
    assert (await client.post(path, headers=owner, json=payload)).status_code == 201
    async for db in app.dependency_overrides[get_db]():
        rows = (await db.scalars(select(RequestEvidence))).all()
        evidence_id = rows[0].evidence_id
        for row in rows:
            row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db.commit()
    assert (await client.get(f"{path}/{evidence_id}/image", headers=reviewer)).status_code == 404
    assert (await client.get(path, headers=owner)).json()["items"] == []
    async for db in app.dependency_overrides[get_db]():
        assert (await db.scalars(select(RequestEvidence))).all() == []


@pytest.mark.asyncio
async def test_unconfigured_or_cache_outage_fails_closed_without_hiding_report(client, monkeypatch):
    request_id, owner, _, _, _ = await seed_case()
    path = f"/api/requests/{request_id}/verification-evidence"
    monkeypatch.setattr(settings, "EVIDENCE_ENCRYPTION_KEY", "")
    assert (await client.get(path, headers=owner)).json()["configured"] is False
    assert (await client.post(path + "/challenge", headers=owner)).status_code == 503
    assert (await client.get("/api/requests/community")).json()[0]["verification_status"] == "unverified"
    monkeypatch.setattr(settings, "EVIDENCE_ENCRYPTION_KEY", base64.urlsafe_b64encode(b"0123456789abcdef0123456789abcdef").decode())
    redis = AsyncMock()
    redis.incr.side_effect = RuntimeError("Cache unavailable")
    async def offline():
        return redis
    app.dependency_overrides[auth.get_redis] = offline
    assert (await client.post(path + "/challenge", headers=owner)).status_code == 503


@pytest.mark.asyncio
async def test_upload_size_and_format_errors_do_not_echo_private_content(client):
    request_id, owner, _, _, _ = await seed_case()
    path = f"/api/requests/{request_id}/verification-evidence"
    response = await client.post(path, headers=owner, json={"private_extra": "PRIVATE_INVALID_INPUT"})
    assert response.status_code == 422 and "PRIVATE_INVALID_INPUT" not in response.text
    response = await client.post(path, headers={**owner, "Content-Type": "application/json"}, content=b" " * (MAX_BODY_BYTES + 1))
    assert response.status_code == 413
    response = await client.post(path, headers=owner, content="not-json")
    assert response.status_code == 415


@pytest.mark.asyncio
async def test_challenge_rate_limit_and_disabled_admin_access(client):
    request_id, owner, _, reviewer, reviewer_id = await seed_case()
    path = f"/api/requests/{request_id}/verification-evidence"
    for _ in range(10):
        assert (await client.post(path + "/challenge", headers=owner)).status_code == 200
    assert (await client.post(path + "/challenge", headers=owner)).status_code == 429
    async for db in app.dependency_overrides[get_db]():
        admin = await db.get(Administrator, reviewer_id)
        admin.is_active = False
        await db.commit()
    assert (await client.get(path, headers=reviewer)).status_code == 403


@pytest.mark.parametrize("data", [
    "https://example.test/nic.jpg", "data:image/svg+xml;base64,PHN2Zy8+",
    "data:image/png;base64," + base64.b64encode(b"<script>private</script>").decode(),
])
def test_arbitrary_urls_svg_and_false_image_contents_rejected(data):
    with pytest.raises(HTTPException) as error:
        normalize_image(data)
    assert error.value.status_code == 422


def test_encryption_detects_corruption_and_cross_request_ciphertext_swap():
    request_id, evidence_id = uuid.uuid4(), uuid.uuid4()
    encrypted = encrypt_image(b"private-image", request_id, evidence_id, "nic")
    assert decrypt_image(encrypted, request_id, evidence_id, "nic") == b"private-image"
    for data, other_request, kind in ((encrypted, uuid.uuid4(), "nic"), (encrypted, request_id, "selfie"),
                                       (encrypted[:-1] + bytes([encrypted[-1] ^ 1]), request_id, "nic")):
        with pytest.raises(InvalidTag):
            decrypt_image(data, other_request, evidence_id, kind)


@pytest.mark.asyncio
async def test_slow_stream_times_out_without_locking_incident_review(client, monkeypatch):
    from app.routers import request_evidence
    request_id, owner, _, _, _ = await seed_case()
    original = request_evidence.upload_owner
    locks = []
    async def observe(*args, **kwargs):
        locks.append(kwargs.get("lock", False))
        return await original(*args, **kwargs)
    monkeypatch.setattr(request_evidence, "upload_owner", observe)
    monkeypatch.setattr(request_evidence, "UPLOAD_TIMEOUT_SECONDS", .01)
    async def slow_body():
        yield b'{"nic_image":"'
        await asyncio.Event().wait()
    response = await client.post(f"/api/requests/{request_id}/verification-evidence",
                                 headers={**owner, "Content-Type": "application/json"}, content=slow_body())
    assert response.status_code == 408
    assert locks == [False]


@pytest.mark.asyncio
async def test_coordinator_status_change_during_capture_prevents_late_upload(client, monkeypatch):
    from app.routers import request_evidence
    request_id, owner, _, _, _ = await seed_case()
    path = f"/api/requests/{request_id}/verification-evidence"
    payload = await capture_payload(client, request_id, owner)
    original = request_evidence.normalize_image
    changed = False
    async def normalize_and_close(fn, value):
        nonlocal changed
        if not changed:
            changed = True
            async for db in app.dependency_overrides[get_db]():
                record = await db.get(HelpRequest, request_id)
                record.admin_status = "in_progress"
                await db.commit()
        return original(value)
    monkeypatch.setattr(request_evidence.asyncio, "to_thread", normalize_and_close)
    response = await client.post(path, headers=owner, json=payload)
    assert response.status_code == 409
    async for db in app.dependency_overrides[get_db]():
        assert (await db.scalars(select(RequestEvidence))).all() == []
