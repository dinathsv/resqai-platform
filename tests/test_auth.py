import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_success(client: AsyncClient, isolate_otp_delivery):
    r = await client.post('/api/auth/register', json={
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "password123",
        "phone_number": "0771234567"
    })
    assert r.status_code == 201
    data = r.json()
    assert "user_id" in data
    assert data["message"] == "OTP sent to your mobile number"
    assert data["phone_hint"] == "+94 ••••• 4567"
    assert "0771234567" not in r.text and "+94771234567" not in r.text
    assert isolate_otp_delivery.await_args.kwargs["phone"] == "+94771234567"


@pytest.mark.asyncio
async def test_resend_otp_returns_masked_sms_destination(client: AsyncClient, isolate_otp_delivery):
    registration = await client.post('/api/auth/register', json={
        "full_name": "Resend User",
        "email": "resend@example.com",
        "password": "password123",
        "phone_number": "0771234567",
    })
    assert registration.status_code == 201

    response = await client.post('/api/auth/resend-otp', json={
        "user_id": registration.json()["user_id"],
    })
    assert response.status_code == 200
    assert response.json()["phone_hint"] == registration.json()["phone_hint"]
    assert response.json()["delivery"]["sms"] is True
    assert "+94771234567" not in response.text
    assert isolate_otp_delivery.await_count == 2
    assert isolate_otp_delivery.await_args.kwargs["phone"] == "+94771234567"

@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):

    first = await client.post('/api/auth/register', json={
        "full_name": "Dup User",
        "email": "dup@example.com",
        "password": "password123",
        "phone_number": "0771234568"
    })
    assert first.status_code == 201

    r = await client.post('/api/auth/register', json={
        "full_name": "Dup User",
        "email": "DUP@example.com",
        "password": "password123",
        "phone_number": "0771234568",
    })
    assert r.status_code == 409
    assert r.json()["detail"] == "Email already registered"

@pytest.mark.asyncio
async def test_register_requires_mobile_number(client: AsyncClient):
    r = await client.post('/api/auth/register', json={
        "full_name": "No Phone",
        "email": "nophone@example.com",
        "password": "password123",
    })
    assert r.status_code == 422

@pytest.mark.asyncio
async def test_verify_otp_valid(client: AsyncClient):

    r_reg = await client.post('/api/auth/register', json={
        "full_name": "OTP User",
        "email": "otp@example.com",
        "password": "password123",
        "phone_number": "0771234569"
    })
    user_id = r_reg.json()["user_id"]

    from app.main import app
    from app.routers.auth import get_redis
    redis_dep = app.dependency_overrides.get(get_redis) or next((v for k, v in app.dependency_overrides.items() if k.__name__ == "get_redis"), None)
    assert redis_dep is not None, "Redis dependency override not found"
    redis_gen = redis_dep()
    redis_client = await anext(redis_gen)

    otp = await redis_client.get(f"otp:{user_id}")

    r_verify = await client.post('/api/auth/verify-otp', json={
        "user_id": user_id,
        "otp": otp
    })

    assert r_verify.status_code == 200
    assert "access_token" in r_verify.json()

@pytest.mark.asyncio
async def test_verify_otp_wrong(client: AsyncClient):

    r_reg = await client.post('/api/auth/register', json={
        "full_name": "OTP Fail",
        "email": "otpfail@example.com",
        "password": "password123",
        "phone_number": "0771234570"
    })
    user_id = r_reg.json()["user_id"]

    r_verify = await client.post('/api/auth/verify-otp', json={
        "user_id": user_id,
        "otp": "000000"
    })

    assert r_verify.status_code == 400
    assert "Invalid or expired OTP" in r_verify.json()["detail"]

@pytest.mark.asyncio
async def test_login_valid(client: AsyncClient):

    r_reg = await client.post('/api/auth/register', json={
        "full_name": "Login User",
        "email": "login@example.com",
        "password": "password123",
        "phone_number": "0771234571"
    })
    user_id = r_reg.json()["user_id"]

    from app.main import app
    from app.routers.auth import get_redis
    redis_dep = app.dependency_overrides.get(get_redis) or next((v for k, v in app.dependency_overrides.items() if k.__name__ == "get_redis"), None)
    assert redis_dep is not None, "Redis dependency override not found"
    redis_client = await anext(redis_dep())
    otp = await redis_client.get(f"otp:{user_id}")

    await client.post('/api/auth/verify-otp', json={"user_id": user_id, "otp": otp})

    r_login = await client.post('/api/auth/login', json={
        "email": "login@example.com",
        "password": "password123"
    })
    assert r_login.status_code == 200
    assert "access_token" in r_login.json()

@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    r_login = await client.post('/api/auth/login', json={
        "email": "login@example.com", 
        "password": "wrong"
    })
    assert r_login.status_code == 401

@pytest.mark.asyncio
async def test_login_locked_after_5(client: AsyncClient):
    for _ in range(5):
        await client.post('/api/auth/login', json={
            "email": "locked@example.com",
            "password": "wrong"
        })

    r_6 = await client.post('/api/auth/login', json={
        "email": "locked@example.com",
        "password": "wrong"
    })
    assert r_6.status_code == 429
    assert "locked" in r_6.json()["detail"].lower()


@pytest.mark.asyncio
async def test_admin_login_requires_password_and_enforces_lockout(client: AsyncClient):
    from app.database import get_db
    from app.main import app
    from app.models.administrator import Administrator
    from app.routers.auth import pwd_context

    email = "coordinator@example.com"
    password = "test-coordinator-passphrase"
    async for session in app.dependency_overrides[get_db]():
        session.add(Administrator(
            full_name="Test Coordinator",
            email=email,
            password_hash=pwd_context.hash(password),
        ))
        await session.commit()

    url = '/api/auth/admin/login'
    valid = await client.post(url, json={"email": email, "password": password})
    assert valid.status_code == 200

    too_long = await client.post(url, json={"email": email, "password": "é" * 37})
    assert too_long.status_code == 422

    for _ in range(5):
        invalid = await client.post(url, json={"email": email, "password": "incorrect-password"})
        assert invalid.status_code == 401

    locked = await client.post(url, json={"email": email.upper(), "password": password})
    assert locked.status_code == 429


async def get_test_redis():
    from app.main import app
    from app.routers.auth import get_redis
    return await anext(app.dependency_overrides[get_redis]())


@pytest.mark.asyncio
async def test_admin_password_recovery_replaces_the_old_password(client, monkeypatch, isolate_otp_delivery):
    from app.config import settings
    from app.database import get_db
    from app.main import app
    from app.models.administrator import Administrator
    from app.routers.auth import pwd_context

    url = '/api/auth/admin'
    email = 'coordinator@example.com'
    monkeypatch.setattr(settings, 'SMTP_USER', '')
    unavailable = await client.post(f'{url}/forgot-password', json={'email': email})
    assert unavailable.status_code == 503
    isolate_otp_delivery.assert_not_awaited()

    for key in ('SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM_EMAIL'):
        monkeypatch.setattr(settings, key, 'configured-for-test')
    isolate_otp_delivery.return_value = {'email': True}
    async for session in app.dependency_overrides[get_db]():
        account = Administrator(full_name='Test coordinator', email=email.upper(),
                                password_hash=pwd_context.hash('previous-test-password'))
        session.add(account)
        await session.commit()

    sent = await client.post(f'{url}/forgot-password', json={'email': email})
    assert sent.status_code == 200
    isolate_otp_delivery.assert_awaited_once()
    code = isolate_otp_delivery.await_args.kwargs['otp']
    reset = await client.post(f'{url}/reset-password', json={
        'email': email, 'otp': code, 'new_password': 'new-test-password',
    })
    assert reset.status_code == 200

    async def sign_in(password):
        return await client.post(f'{url}/login', json={'email': email, 'password': password})

    assert (await sign_in('previous-test-password')).status_code == 401
    assert (await sign_in('new-test-password')).status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize('nic', ['881234567V', '198812345678'])
async def test_guest_phone_verified_identity_pending(client, nic):
    import base64
    await client.post('/api/auth/guest/send-otp', json={'phone_number': '0771234567'})
    redis = await get_test_redis()
    code = await redis.get('guest_otp:+94771234567')
    photo = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'x' * 100).decode()
    response = await client.post('/api/auth/guest/verify-nic', json={
        'nic_number': nic, 'nic_photo': photo, 'phone_number': '0771234567', 'otp': code,
    })
    assert response.status_code == 200, response.text
    assert response.json()['identity_status'] == 'pending'
    assert response.json()['decoded']['identity_verified'] is False


@pytest.mark.asyncio
@pytest.mark.parametrize('decision', ['pending', 'approved', 'rejected'])
async def test_guest_sign_in_again_restores_the_nic_review(client, decision):
    import base64
    import uuid
    from datetime import datetime, timedelta, timezone
    from app.database import get_db
    from app.main import app
    from app.models.guest_session import GuestSession

    original = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'x' * 100).decode()
    replacement = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'y' * 100).decode()
    guest_id = uuid.uuid4()
    async for db in app.dependency_overrides[get_db]():
        db.add(GuestSession(
            session_id=guest_id, nic_number='881234567V', nic_photo=original, admin_status=decision,
            nic_verified=decision == 'approved', phone_number='+94771234567', phone_verified=True,
            temp_token='expired-token', expires_at=datetime.now(timezone.utc) - timedelta(minutes=10),
        ))
        await db.commit()

    async def sign_in(photo):
        sent = await client.post('/api/auth/guest/send-otp', json={'phone_number': '0771234567'})
        assert sent.status_code == 200
        code = await (await get_test_redis()).get('guest_otp:+94771234567')
        response = await client.post('/api/auth/guest/verify-nic', json={
            'nic_number': '881234567V', 'nic_photo': photo, 'phone_number': '0771234567', 'otp': code,
        })
        assert response.status_code == 200, response.text
        return response.json()

    resumed = await sign_in(original if decision == 'rejected' else replacement)
    assert resumed['identity_status'] == decision
    assert resumed['session_id'] == str(guest_id)
    profile = await client.get('/api/auth/me', headers={'Authorization': 'Bearer ' + resumed['access_token']})
    assert profile.json()['identity_status'] == decision
    async for db in app.dependency_overrides[get_db]():
        assert (await db.get(GuestSession, guest_id)).nic_photo == original

    if decision == 'rejected':
        review = await sign_in(replacement)
        assert review['identity_status'] == 'pending'
        assert review['session_id'] != str(guest_id)


@pytest.mark.asyncio
async def test_nic_format_does_not_claim_identity(client):
    valid = await client.get('/api/auth/guest/validate-nic/881234567V')
    assert valid.json()['is_valid'] is True
    assert valid.json()['data']['identity_verified'] is False
    invalid = await client.get('/api/auth/guest/validate-nic/1234')
    assert invalid.json()['is_valid'] is False


@pytest.mark.asyncio
async def test_guest_requires_actual_image_container(client):
    response = await client.post('/api/auth/guest/verify-nic', json={
        'nic_number': '881234567V', 'nic_photo': 'x' * 100,
        'phone_number': '0771234567', 'otp': '123456',
    })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_guest_sms_failure_is_not_success(client, isolate_otp_delivery):
    isolate_otp_delivery.return_value = {'sms': False}
    response = await client.post('/api/auth/guest/send-otp', json={'phone_number': '0771234567'})
    assert response.status_code == 502


@pytest.mark.asyncio
@pytest.mark.parametrize('changes', [
    {'language_pref': 'fr'}, {'full_name': '   '}, {'phone_number': '+not-a-number'},
    {'password': 'අ' * 25},
])
async def test_registration_rejects_invalid_fields(client, changes):
    payload = {'full_name': 'Test citizen', 'email': 'invalid@example.com',
               'password': 'password123', 'phone_number': '0771234567'}
    response = await client.post('/api/auth/register', json={**payload, **changes})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_sms_failure_rolls_back_registration(client, isolate_otp_delivery):
    from sqlalchemy import select
    from app.models.user import User
    from app.main import app
    from app.database import get_db
    isolate_otp_delivery.return_value = {'sms': False, 'email': False}
    response = await client.post('/api/auth/register', json={
        'full_name': 'Failed citizen', 'email': 'failed@example.com',
        'password': 'password123', 'phone_number': '0771234567',
    })
    assert response.status_code == 502
    async for session in app.dependency_overrides[get_db]():
        assert (await session.execute(select(User).where(User.email == 'failed@example.com'))).scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_password_login_requires_completed_registration_otp(client: AsyncClient, isolate_otp_delivery):
    registration = await client.post('/api/auth/register', json={
        "full_name": "Password Login User",
        "email": "password-only@example.com",
        "password": "password123",
        "phone_number": "0771234572",
    })
    assert registration.status_code == 201

    response = await client.post('/api/auth/login', json={
        "email": "password-only@example.com", "password": "password123",
    })
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "verification_required"
    assert response.json()["detail"]["phone_hint"] == "+94 ••••• 4572"
    assert "+94771234572" not in response.text
    # Recovery directs the citizen to the existing code; login does not send a new SMS.
    assert isolate_otp_delivery.await_count == 1

    # Password authentication must still reject an incorrect password.
    response = await client.post('/api/auth/login', json={
        "email": "password-only@example.com", "password": "incorrect",
    })
    assert response.status_code == 401
    assert "phone_hint" not in response.text


@pytest.mark.asyncio
async def test_otp_guessing_is_limited(client):
    registration = await client.post('/api/auth/register', json={
        'full_name': 'OTP limit', 'email': 'limit@example.com',
        'password': 'password123', 'phone_number': '0771234567',
    })
    user_id = registration.json()['user_id']
    for _ in range(5):
        response = await client.post('/api/auth/verify-otp', json={'user_id': user_id, 'otp': '000000'})
        assert response.status_code == 400
    response = await client.post('/api/auth/verify-otp', json={'user_id': user_id, 'otp': '000000'})
    assert response.status_code == 429
