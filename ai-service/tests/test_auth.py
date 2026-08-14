import pytest

@pytest.mark.asyncio
async def test_register_success(client):
    r = await client.post('/api/auth/register', json={
        "full_name": "New User",
        "email": "new@example.com",
        "password": "password123",
        "phone_number": "0779999999"
    })
    # Might fail if endpoint not implemented, assuming 201 per spec
    assert r.status_code == 201
    assert 'user_id' in r.json()

@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    # Register first
    await client.post('/api/auth/register', json={
        "full_name": "Dup User",
        "email": "dup@example.com",
        "password": "password123"
    })
    # Try again
    r = await client.post('/api/auth/register', json={
        "full_name": "Dup User",
        "email": "dup@example.com",
        "password": "password123"
    })
    assert r.status_code == 409

@pytest.mark.asyncio
async def test_login_valid(client, people_token):
    # Assuming people_token fixture registered test@example.com
    r = await client.post('/api/auth/login', json={
        "email": "test@example.com",
        "password": "password123"
    })
    assert r.status_code == 200
    assert 'token' in r.json()

@pytest.mark.asyncio
async def test_login_wrong_password(client, people_token):
    r = await client.post('/api/auth/login', json={
        "email": "test@example.com",
        "password": "wrongpassword"
    })
    assert r.status_code == 401

@pytest.mark.asyncio
async def test_login_rate_limited(client):
    for _ in range(5):
        await client.post('/api/auth/login', json={
            "email": "ratelimit@example.com",
            "password": "wrong"
        })
    
    r = await client.post('/api/auth/login', json={
        "email": "ratelimit@example.com",
        "password": "wrong"
    })
    assert r.status_code == 429

@pytest.mark.asyncio
async def test_guest_nic_valid_old(client):
    r = await client.post('/api/auth/guest-login', json={"nic_number": "881234567V"})
    assert r.status_code == 200

@pytest.mark.asyncio
async def test_guest_nic_valid_new(client):
    r = await client.post('/api/auth/guest-login', json={"nic_number": "198812345678"})
    assert r.status_code == 200

@pytest.mark.asyncio
async def test_guest_nic_bad_format(client):
    r = await client.post('/api/auth/guest-login', json={"nic_number": "1234"})
    assert r.status_code == 400

@pytest.mark.asyncio
async def test_guest_nic_not_in_db(client):
    r = await client.post('/api/auth/guest-login', json={"nic_number": "999999999V"})
    assert r.status_code == 400
