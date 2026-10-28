"""Apply the repository's PostgreSQL migrations before the API starts."""

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
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required to run database migrations")

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migration_files:
        raise RuntimeError(f"No SQL migrations found in {MIGRATIONS_DIR}")

    connection = await asyncpg.connect(_asyncpg_database_url(database_url))
    try:
        await connection.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )

        for migration_file in migration_files:
            version = migration_file.name
            already_applied = await connection.fetchval(
                "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)",
                version,
            )
            if already_applied:
                continue

            sql = migration_file.read_text(encoding="utf-8")
            async with connection.transaction():
                await connection.execute(sql)
                await connection.execute(
                    "INSERT INTO schema_migrations (version) VALUES ($1)",
                    version,
                )
            print(f"Applied migration {version}")
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(run_migrations())
