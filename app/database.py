"""
ResQAI — Async Database Engine & Session.
Uses SQLAlchemy 2.0 async with asyncpg driver.
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import settings


def _async_database_url(database_url: str) -> str:
    """Use SQLAlchemy's asyncpg driver for standard PostgreSQL URLs."""
    for scheme in ("postgres://", "postgresql://"):
        if database_url.startswith(scheme):
            return f"postgresql+asyncpg://{database_url[len(scheme):]}"
    return database_url


engine = create_async_engine(
    _async_database_url(settings.DATABASE_URL),
    echo=False,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db():
    """FastAPI dependency that yields an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
