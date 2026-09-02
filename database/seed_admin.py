"""
Seed a default administrator for local development.

Usage:
    python database/seed_admin.py

Default credentials:
    Email:    admin@resqai.lk
    Password: admin123
"""

import os
import asyncio
import bcrypt
import asyncpg

DB_URL = os.getenv("DATABASE_URL", "postgresql://resqai_user:resqai_pass@localhost:5433/resqai")

ADMIN_EMAIL = "admin@resqai.lk"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    raise ValueError("ADMIN_PASSWORD environment variable must be set")
ADMIN_NAME = "ResQAI Admin"
ADMIN_AGENCY = "DMC"
ADMIN_DISTRICT = "Colombo"

def hash_password(password: str) -> str:
    """Hash password using bcrypt, compatible with passlib's bcrypt output."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

async def main():
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
        INSERT INTO administrators (full_name, email, agency, district, password_hash, is_active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        """,
        ADMIN_NAME,
        ADMIN_EMAIL,
        ADMIN_AGENCY,
        ADMIN_DISTRICT,
        password_hash,
    )

    print(f"✅ Admin user created successfully!")
    print(f"   Email:    {ADMIN_EMAIL}")
    print(f"   Password: {ADMIN_PASSWORD}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
