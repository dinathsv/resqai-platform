import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
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
        "email": "dup@example.com",
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

async def get_test_redis():
    from app.main import app
    from app.routers.auth import get_redis
    return await anext(app.dependency_overrides[get_redis]())


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
async def test_password_login_requires_completed_registration_otp(client: AsyncClient):
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

    # Password authentication must still reject an incorrect password.
    response = await client.post('/api/auth/login', json={
        "email": "password-only@example.com", "password": "incorrect",
    })
    assert response.status_code == 401


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
