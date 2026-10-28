"""
Seed a default administrator for local development.

Usage:
    python database/seed_admin.py

Set ADMIN_EMAIL and ADMIN_PASSWORD explicitly in the environment.
"""

import os
import asyncio
import uuid
import bcrypt
import asyncpg

# Use DATABASE_URL from environment if available, otherwise fallback to localhost
DB_URL = os.getenv("DATABASE_URL", "postgresql://resqai_user:resqai_pass@localhost:5433/resqai")

# asyncpg doesn't support 'postgresql+asyncpg://', so we replace it
if DB_URL.startswith("postgresql+asyncpg://"):
    DB_URL = DB_URL.replace("postgresql+asyncpg://", "postgresql://")


ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_NAME = "ResQAI Admin"
ADMIN_AGENCY = "DMC"
ADMIN_DISTRICT = "Colombo"

def hash_password(password: str) -> str:
    """Hash password using bcrypt, compatible with passlib's bcrypt output."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

async def main():
    if not ADMIN_EMAIL or len(ADMIN_PASSWORD) < 12 or len(ADMIN_PASSWORD.encode("utf-8")) > 72:
        raise RuntimeError("Set ADMIN_EMAIL and ADMIN_PASSWORD (12 characters minimum, 72 UTF-8 bytes maximum)")
    conn = await asyncpg.connect(DB_URL)

    existing = await conn.fetchrow(
        "SELECT admin_id FROM administrators WHERE email = $1", ADMIN_EMAIL
    )
    if existing:
        print(f"✅ Admin already exists: {ADMIN_EMAIL}")
        await conn.close()
        return

    password_hash = hash_password(ADMIN_PASSWORD)

    await conn.execute(
        """
        INSERT INTO administrators (admin_id, full_name, email, agency, district, password_hash, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        """,
        uuid.uuid4(),
        ADMIN_NAME,
        ADMIN_EMAIL,
        ADMIN_AGENCY,
        ADMIN_DISTRICT,
        password_hash,
    )

    print(f"✅ Admin user created successfully!")
    print(f"   Email:    {ADMIN_EMAIL}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
