"""Manually apply reviewed migrations using a direct/session PostgreSQL connection."""

import asyncio
import os
from pathlib import Path

import asyncpg


MIGRATIONS_DIR = Path(__file__).parent.parent / "backend" / "migrations"


def _asyncpg_database_url(database_url: str) -> str:
    for scheme in ("postgresql+asyncpg://", "postgres://", "postgresql://"):
        if database_url.startswith(scheme):
            return f"postgresql://{database_url[len(scheme):]}"
    return database_url


async def run_migrations() -> None:
    database_url = os.environ.get("DATABASE_URL") or os.environ.get("PYTHON_DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL or PYTHON_DATABASE_URL is required to run database migrations")

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migration_files:
        raise RuntimeError(f"No SQL migrations found in {MIGRATIONS_DIR}")

    connection = await asyncpg.connect(_asyncpg_database_url(database_url), command_timeout=60)
    applied = []
    try:
        # Serialize the ledger check and DDL across all deploy jobs. A transaction
        # lock also works without depending on session affinity between transactions.
        async with connection.transaction():
            await connection.execute("SET LOCAL lock_timeout = '5s'")
            await connection.execute("SET LOCAL search_path = public, extensions")
            await connection.execute("SELECT pg_advisory_xact_lock(726573716169)")
            await connection.execute(
                """
                CREATE TABLE IF NOT EXISTS public.schema_migrations (
                    version TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            for migration_file in migration_files:
                version = migration_file.name
                already_applied = await connection.fetchval(
                    "SELECT EXISTS (SELECT 1 FROM public.schema_migrations WHERE version = $1)",
                    version,
                )
                if already_applied:
                    continue
                await connection.execute(migration_file.read_text(encoding="utf-8"))
                await connection.execute(
                    "INSERT INTO public.schema_migrations (version) VALUES ($1)", version,
                )
                applied.append(version)
        for version in applied:
            print(f"Applied migration {version}")
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(run_migrations())
