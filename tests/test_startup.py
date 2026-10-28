"""Startup diagnostics must fail promptly and never bypass failed dependencies."""
import asyncio
import importlib
from unittest.mock import AsyncMock, MagicMock

import pytest

main = importlib.import_module('app.main')


@pytest.fixture
def dependencies(monkeypatch):
    connection = MagicMock()
    connection.__aenter__ = AsyncMock(return_value=object())
    connection.__aexit__ = AsyncMock(return_value=False)
    engine = MagicMock()
    engine.connect.return_value = connection
    schema = AsyncMock()
    redis = MagicMock()
    redis.ping = AsyncMock()
    monkeypatch.setattr(main, 'engine', engine)
    monkeypatch.setattr(main, 'check_schema', schema)
    monkeypatch.setattr(main.auth_router, 'get_redis', AsyncMock(return_value=redis))
    return schema, redis


@pytest.mark.asyncio
async def test_startup_dependencies_succeed(dependencies):
    schema, redis = dependencies
    await main.check_startup_dependencies()
    schema.assert_awaited_once()
    redis.ping.assert_awaited_once()


@pytest.mark.asyncio
async def test_startup_preserves_schema_failure(dependencies):
    schema, redis = dependencies
    schema.side_effect = RuntimeError('missing column users.avatar_url')
    with pytest.raises(RuntimeError, match='users.avatar_url'):
        await main.check_startup_dependencies()
    redis.ping.assert_not_awaited()


@pytest.mark.asyncio
async def test_startup_database_timeout_has_actionable_error(dependencies, monkeypatch):
    schema, redis = dependencies
    async def blocked(*args):
        await asyncio.Event().wait()
    schema.side_effect = blocked
    monkeypatch.setattr(main, 'DATABASE_STARTUP_TIMEOUT', 0.01)
    with pytest.raises(RuntimeError, match='PostgreSQL/schema startup check timed out'):
        await main.check_startup_dependencies()
    redis.ping.assert_not_awaited()


@pytest.mark.asyncio
async def test_startup_redis_timeout_has_actionable_error(dependencies, monkeypatch):
    _, redis = dependencies
    async def blocked():
        await asyncio.Event().wait()
    redis.ping.side_effect = blocked
    monkeypatch.setattr(main, 'REDIS_STARTUP_TIMEOUT', 0.01)
    with pytest.raises(RuntimeError, match='Redis startup check timed out'):
        await main.check_startup_dependencies()
