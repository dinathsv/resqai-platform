"""Manually or automatically apply reviewed migrations using a direct/session PostgreSQL connection."""

import asyncio
import os
from pathlib import Path

import asyncpg


def get_migrations_dir() -> Path:
    candidates = [
        Path(__file__).resolve().parent.parent / "backend" / "migrations",
        Path.cwd() / "backend" / "migrations",
        Path("/workspace/backend/migrations"),
        Path(__file__).resolve().parent / "backend" / "migrations",
    ]
    for p in candidates:
        if p.exists() and p.is_dir():
            return p
    return candidates[0]


def _asyncpg_database_url(database_url: str) -> str:
    for scheme in ("postgresql+asyncpg://", "postgres://", "postgresql://"):
        if database_url.startswith(scheme):
            return f"postgresql://{database_url[len(scheme):]}"
    return database_url


async def run_migrations(database_url: str | None = None) -> list[str]:
    db_url = database_url or os.environ.get("DATABASE_URL")
    if not db_url:
        try:
            from app.config import settings
            db_url = settings.DATABASE_URL
        except Exception:
            pass
    if not db_url:
        raise RuntimeError("DATABASE_URL is required to run database migrations")

    migrations_dir = get_migrations_dir()
    if not migrations_dir.exists():
        print(f"Warning: Migrations directory {migrations_dir} not found.")
        return []

    migration_files = sorted(migrations_dir.glob("*.sql"))
    if not migration_files:
        print(f"Notice: No SQL migration files found in {migrations_dir}")
        return []

    connection = await asyncpg.connect(_asyncpg_database_url(db_url), command_timeout=60)
    applied = []
    try:
        # Serialize the ledger check and DDL across all deploy jobs. A transaction
        # lock also works without depending on session affinity between transactions.
        async with connection.transaction():
            await connection.execute("SET LOCAL lock_timeout = '10s'")
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
        return applied
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(run_migrations())
