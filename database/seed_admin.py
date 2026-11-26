"""Provision an administrator using explicit DATABASE_URL and ADMIN_EMAIL.

Run `python -m database.seed_admin` with ADMIN_PASSWORD to create an account.
Use `--reset-password` to change an existing account's password via a terminal prompt.
"""

import argparse
import asyncio
import getpass
import os
import sys
import uuid

import asyncpg
import bcrypt


async def main(*, reset_password: bool = False):
    url = os.getenv("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://", 1)
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    if not url or not email:
        raise SystemExit("Set DATABASE_URL and ADMIN_EMAIL.")

    if reset_password:
        if not sys.stdin.isatty():
            raise SystemExit("Run the password reset in an interactive terminal.")
        password = getpass.getpass("New administrator password: ")
        if password != getpass.getpass("Confirm new password: "):
            raise SystemExit("Passwords do not match.")
    else:
        password = os.getenv("ADMIN_PASSWORD", "")
    password_bytes = password.encode("utf-8")
    if len(password) < 12 or len(password_bytes) > 72:
        raise SystemExit("Use a password with at least 12 characters and at most 72 UTF-8 bytes.")

    password_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=12)).decode("utf-8")
    conn = await asyncpg.connect(url)
    try:
        if reset_password:
            async with conn.transaction():
                rows = await conn.fetch(
                    """
                    UPDATE public.administrators SET password_hash = $1, updated_at = NOW()
                    WHERE lower(email) = $2
                    RETURNING admin_id
                    """,
                    password_hash, email,
                )
                if len(rows) != 1:
                    raise SystemExit("Password reset requires exactly one matching administrator account.")
            print("Administrator password reset.")
            return

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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset-password", action="store_true", help="Reset the existing administrator password")
    asyncio.run(main(reset_password=parser.parse_args().reset_password))
