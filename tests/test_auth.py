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
    assert data["message"] == "OTP sent"

@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):

    await client.post('/api/auth/register', json={
        "full_name": "Dup User",
        "email": "dup@example.com",
        "password": "password123"
    })

    r = await client.post('/api/auth/register', json={
        "full_name": "Dup User",
        "email": "dup@example.com",
        "password": "password123"
    })
    assert r.status_code == 409
    assert r.json()["detail"] == "Email already registered"

@pytest.mark.asyncio
async def test_verify_otp_valid(client: AsyncClient):

    r_reg = await client.post('/api/auth/register', json={
        "full_name": "OTP User",
        "email": "otp@example.com",
        "password": "password123"
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
        "password": "password123"
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
        "password": "password123"
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
async def test_guest_nic_valid_old_format(client: AsyncClient):

    r = await client.post('/api/auth/guest/verify-nic', json={
        "nic_number": "881234567V"
    })
    assert r.status_code == 200
    assert "access_token" in r.json()

@pytest.mark.asyncio
async def test_guest_nic_valid_new_format(client: AsyncClient):

    r = await client.post('/api/auth/guest/verify-nic', json={
        "nic_number": "198812345678"
    })
    assert r.status_code == 200
    assert "access_token" in r.json()

@pytest.mark.asyncio
async def test_guest_nic_invalid_format(client: AsyncClient):
    r = await client.post('/api/auth/guest/verify-nic', json={
        "nic_number": "1234"
    })
    assert r.status_code == 400
    assert "format" in r.json()["detail"].lower()

@pytest.mark.asyncio
async def test_guest_nic_not_in_db(client: AsyncClient):
    r = await client.post('/api/auth/guest/verify-nic', json={
        "nic_number": "999999999V"
    })
    assert r.status_code == 400
    assert "registry" in r.json()["detail"].lower()
