import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
import fakeredis.aioredis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from passlib.context import CryptContext

from app.main import app
from app.database import Base, get_db
from app.routers import auth
from app.models.nic_entry import NicEntry

# ── Test Database Config ─────────────────────────────────────
# We use an in-memory SQLite database for testing, but since the schema 
# uses PostGIS geometry columns (which sqlite doesn't support directly), 
# we can mock out the geometry columns or use a test postgres db.
# For simplicity, if we run into GeoAlchemy errors with sqlite, 
# we'd normally spin up a test postgis container. 
# Here we'll just try sqlite and see if it passes the basic tests.
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

async def override_get_redis():
    # Use fakeredis
    server = fakeredis.FakeServer()
    redis = fakeredis.aioredis.FakeRedis(server=server, decode_responses=True)
    yield redis

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[auth.get_redis] = override_get_redis


@pytest.fixture(autouse=True)
async def setup_db():
    # Create tables
    async with engine.begin() as conn:
        # Patch geoalchemy2 geometry for sqlite compatibility in tests
        # This is a hack for tests; real app uses PostGIS
        from app.models.user import User
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    # Seed test NICs
    async with TestingSessionLocal() as session:
        nic1 = NicEntry(nic_number="881234567V", is_valid=True, district="Colombo")
        nic2 = NicEntry(nic_number="198812345678", is_valid=True, district="Kandy")
        session.add_all([nic1, nic2])
        await session.commit()

    yield
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
