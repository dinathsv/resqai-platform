"""
ResQAI — Async PostgreSQL + PostGIS service.
Uses psycopg2 in a thread-pool because psycopg2 is synchronous;
for a production upgrade swap to asyncpg + PostGIS.
"""

import os
import logging
import asyncio
from functools import partial
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger("resqai.db")

# ── Connection pool (simple) ────────────────────────────────

_dsn: str | None = None


def _get_dsn() -> str:
    global _dsn
    if _dsn is None:
        _dsn = os.getenv(
            "DATABASE_URL",
            "postgresql://resqai_user:resqai_pass@localhost:5433/resqai",
        )
    return _dsn


@contextmanager
def _get_conn():
    """Yield a short-lived connection (auto-commit, dict cursor)."""
    conn = psycopg2.connect(_dsn or _get_dsn())
    conn.autocommit = True
    try:
        yield conn
    finally:
        conn.close()


# ── Public API ───────────────────────────────────────────────

def _sync_nearest_hospitals(lat: float, lng: float, limit: int = 3) -> list[dict]:
    """Blocking call — run in executor from async code."""
    with _get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM get_nearest_hospitals(%s, %s, %s)",
                (lat, lng, limit),
            )
            rows = cur.fetchall()
            return [dict(r) for r in rows]


async def get_nearest_hospitals(lat: float, lng: float, limit: int = 3) -> list[dict]:
    """
    Async wrapper around the PostGIS function.
    Runs the blocking psycopg2 call in the default executor.
    """
    loop = asyncio.get_running_loop()
    try:
        return await loop.run_in_executor(
            None,
            partial(_sync_nearest_hospitals, lat, lng, limit),
        )
    except Exception as exc:
        logger.error("Database query failed: %s", exc, exc_info=True)
        return []


def check_connection() -> bool:
    """Quick health-check used by the startup event."""
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                return True
    except Exception as exc:
        logger.warning("DB health-check failed: %s", exc)
        return False
