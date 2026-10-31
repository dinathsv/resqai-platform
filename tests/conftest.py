import asyncio
import os
from unittest.mock import AsyncMock

# Never use deployment secrets for test JWTs or make live SMS requests.
os.environ["SECRET_KEY"] = "isolated-test-signing-key-at-least-32-characters"
os.environ["AI_API_KEY"] = ""
import pytest
from httpx import AsyncClient, ASGITransport
import fakeredis.aioredis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from passlib.context import CryptContext

from app.main import app
from app.database import Base, get_db
from app.routers import auth
from app.models.nic_entry import NicEntry

from sqlalchemy.ext.compiler import compiles
from geoalchemy2.types import Geometry

@compiles(Geometry, "sqlite")
def compile_geometry_sqlite(element, compiler, **kw):
    return "VARCHAR"

Geometry.bind_expression = lambda self, bindvalue: bindvalue
Geometry.column_expression = lambda self, col: col
_geometry_result_processor = Geometry.result_processor
Geometry.result_processor = lambda self, dialect, coltype: (
    (lambda value: value) if dialect.name == "sqlite"
    else _geometry_result_processor(self, dialect, coltype)
)

import geoalchemy2.admin.dialects.sqlite
geoalchemy2.admin.dialects.sqlite.before_create = lambda *args, **kwargs: None
geoalchemy2.admin.dialects.sqlite.after_create = lambda *args, **kwargs: None
geoalchemy2.admin.dialects.sqlite.before_drop = lambda *args, **kwargs: None
geoalchemy2.admin.dialects.sqlite.after_drop = lambda *args, **kwargs: None

TEST_DATABASE_URL = "sqlite+aiosqlite:///file:testdb?mode=memory&cache=shared&uri=true"
engine = create_async_engine(
    TEST_DATABASE_URL, 
    echo=False, 
    poolclass=StaticPool, 
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

_fake_server = fakeredis.FakeServer()

async def override_get_redis():
    redis = fakeredis.aioredis.FakeRedis(server=_fake_server, decode_responses=True)
    try:
        yield redis
    finally:
        await redis.aclose()

import pytest_asyncio

@pytest.fixture(autouse=True)
def isolate_otp_delivery(monkeypatch):
    sender = AsyncMock(return_value={"sms": True, "email": False})
    monkeypatch.setattr(auth, "send_otp", sender)
    return sender

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[auth.get_redis] = override_get_redis
    redis = fakeredis.aioredis.FakeRedis(server=_fake_server, decode_responses=True)
    await redis.flushall()
    await redis.aclose()

    async with engine.begin() as conn:

        from app.models.user import User
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        nic1 = NicEntry(nic_number="881234567V", is_valid=True, district="Colombo")
        nic2 = NicEntry(nic_number="198812345678", is_valid=True, district="Kandy")
        session.add_all([nic1, nic2])
        await session.commit()

    yield

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    app.dependency_overrides.clear()

import pytest_asyncio

@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)  # type: ignore
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
