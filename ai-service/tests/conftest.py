import pytest
from httpx import AsyncClient
from app.main import app
import os

@pytest.fixture
async def client():
    # Use AsyncClient to test the FastAPI app
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def people_token(client):
    # Mock registration and login for a regular user
    res_reg = await client.post('/api/auth/register', json={
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "password123",
        "phone_number": "0771234567"
    })
    # Fallback to login if already exists
    if res_reg.status_code == 409:
        res_login = await client.post('/api/auth/login', json={
            "email": "test@example.com",
            "password": "password123"
        })
        return res_login.json().get('token')
    
    return res_reg.json().get('token')

@pytest.fixture
async def guest_token(client):
    # Mock guest NIC verification
    res = await client.post('/api/auth/guest-login', json={
        "nic_number": "881234567V"
    })
    return res.json().get('temp_token')

@pytest.fixture(autouse=True)
def clean_db():
    # Placeholder for database cleanup before each test
    # In a real environment, this would truncate tables or use transactions
    pass
