"""Opt-in integration test. Requires a disposable localhost database named resqai_test."""
import asyncio
import os
from pathlib import Path
from unittest.mock import AsyncMock
from urllib.parse import urlparse

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


@pytest.mark.asyncio
async def test_migration_and_registration(monkeypatch):
    url = os.environ.get('TEST_POSTGRES_URL')
    if not url:
        pytest.skip('Set TEST_POSTGRES_URL to a disposable localhost resqai_test database')
    parsed = urlparse(url)
    assert parsed.hostname in {'localhost', '127.0.0.1'} and parsed.path == '/resqai_test'
    monkeypatch.setenv('SECRET_KEY', 'isolated-test-signing-key-at-least-32-characters')
    monkeypatch.setenv('DATABASE_URL', url)

    from database.run_migrations import run_migrations
    from app.database import get_db
    from app.main import app
    from app.routers import auth
    from app.schema_check import check_schema

    root = Path(__file__).resolve().parents[2]
    connection = await asyncpg.connect(url)
    try:
        assert await connection.fetchval("SELECT to_regclass('public.users')") is None, 'Use a NEW empty test database'
        schema = (root / 'database/schema.sql').read_text()
        # Reproduce the reported old schema and keep a legacy user through migration.
        schema = schema.replace('    avatar_url      TEXT,\n', '')
        schema = schema.replace("    user_type       VARCHAR(50) DEFAULT 'Citizen',\n", '')
        schema = schema.replace('    is_active       BOOLEAN DEFAULT TRUE,\n', '')
        schema = schema.replace('    target_zone     GEOMETRY,\n    district        VARCHAR(100),', '    target_zone     GEOMETRY,')
        schema = schema.replace('    target          NUMERIC(12,2) NOT NULL DEFAULT 0,\n', '')
        await connection.execute(schema)
        legacy_id = await connection.fetchval("""
            INSERT INTO users(full_name, email, phone_number, password_hash)
            VALUES ('Legacy user', 'legacy@example.com', '+94771234567', 'legacy-hash') RETURNING user_id
        """)
        engine = create_async_engine(url.replace('postgresql://', 'postgresql+asyncpg://', 1))
        async with engine.connect() as conn:
            with pytest.raises(RuntimeError, match='avatar_url'):
                await check_schema(conn)
        # Concurrent jobs must serialize their ledger/DDL operations.
        await asyncio.gather(run_migrations(), run_migrations())
        await run_migrations()
        assert await connection.fetchval('SELECT count(*) FROM schema_migrations') == 3
        legacy = await connection.fetchrow('SELECT email, password_hash, avatar_url FROM users WHERE user_id=$1', legacy_id)
        assert tuple(legacy.values()) == ('legacy@example.com', 'legacy-hash', None)
        async with engine.connect() as conn:
            await check_schema(conn)

        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async def db_override():
            async with sessions() as session:
                yield session
        redis = AsyncMock()
        codes = {}
        async def save_code(key, value, **kwargs):
            codes[key] = value
        async def read_code(key):
            return codes.get(key)
        async def delete_code(key):
            codes.pop(key, None)
        redis.set.side_effect = save_code
        redis.get.side_effect = read_code
        redis.delete.side_effect = delete_code
        async def redis_override():
            return redis
        app.dependency_overrides[get_db] = db_override
        app.dependency_overrides[auth.get_redis] = redis_override
        sender = AsyncMock(return_value={'sms': True, 'email': False})
        monkeypatch.setattr(auth, 'send_otp', sender)
        payload = {'full_name': 'New citizen', 'email': 'citizen@example.com', 'password': 'password123', 'phone_number': '0771234567'}
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
                response = await client.post('/api/auth/register', json=payload)
                assert response.status_code == 201, response.text
                user_id = response.json()['user_id']
                stored = await connection.fetchrow("SELECT password_hash, phone_number, avatar_url FROM users WHERE email=$1", payload['email'])
                assert stored['password_hash'] != payload['password']
                assert auth.pwd_context.verify(payload['password'], stored['password_hash'])
                assert stored['phone_number'] == '+94771234567' and stored['avatar_url'] is None
                assert (await client.post('/api/auth/register', json=payload)).status_code == 409
                assert (await client.post('/api/auth/login', json=payload)).status_code == 403
                verify = await client.post('/api/auth/verify-otp', json={'user_id': user_id, 'otp': codes[f'otp:{user_id}']})
                assert verify.status_code == 200
                login = await client.post('/api/auth/login', json=payload)
                assert login.status_code == 200
                token = login.json()['access_token']
                profile = await client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
                assert profile.status_code == 200 and profile.json()['avatar_url'] is None
                sender.return_value = {'sms': False}
                failed = await client.post('/api/auth/register', json={**payload, 'email': 'failed@example.com'})
                assert failed.status_code == 502
                assert await connection.fetchval("SELECT count(*) FROM users WHERE email='failed@example.com'") == 0
                assert not codes  # Verified token consumed; failed registration OTP removed.
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()
    finally:
        await connection.close()
