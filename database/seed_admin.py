"""Create an administrator using explicit DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD.

Run `python -m database.seed_admin`. ADMIN_NAME, ADMIN_AGENCY and ADMIN_DISTRICT
are optional.
"""

import asyncio
import os
import uuid

import asyncpg
import bcrypt


async def main():
    url = os.getenv("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://", 1)
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "")
    password_bytes = password.encode("utf-8")
    if not url or not email or len(password) < 12 or len(password_bytes) > 72:
        raise SystemExit("Set DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD (12 characters minimum, 72 UTF-8 bytes maximum)")

    password_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=12)).decode("utf-8")
    conn = await asyncpg.connect(url)
    try:
        created = await conn.fetchval(
            """
            INSERT INTO public.administrators (admin_id, full_name, email, agency, district, password_hash)
            SELECT $1, $2, $3, $4, $5, $6
            WHERE NOT EXISTS (
                SELECT 1 FROM public.administrators WHERE lower(email) = $3::varchar
            )
            ON CONFLICT (email) DO NOTHING
            RETURNING admin_id
            """,
            uuid.uuid4(),
            os.getenv("ADMIN_NAME", "ResQAI Admin"),
            email,
            os.getenv("ADMIN_AGENCY") or None,
            os.getenv("ADMIN_DISTRICT") or None,
            password_hash,
        )
    finally:
        await conn.close()

    print("Administrator created." if created else "Administrator already exists.")


if __name__ == "__main__":
    asyncio.run(main())
