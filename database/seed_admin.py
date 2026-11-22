"""
Seed a default administrator for local development.

Usage:
    python database/seed_admin.py

Default credentials:
    Email:    admin@resqai.lk
    Password: admin123 (or set ADMIN_PASSWORD in environment)
"""

import os
import asyncio
import uuid
import bcrypt
import asyncpg

# Use DATABASE_URL from environment if available, otherwise fallback to localhost
DB_URL = os.getenv("DATABASE_URL", "postgresql://resqai_user:resqai_local_db_password@localhost:5433/resqai")

# asyncpg doesn't support 'postgresql+asyncpg://', so we replace it
if DB_URL.startswith("postgresql+asyncpg://"):
    DB_URL = DB_URL.replace("postgresql+asyncpg://", "postgresql://")


ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@resqai.lk")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_NAME = os.getenv("ADMIN_NAME", "ResQAI Admin")
ADMIN_AGENCY = os.getenv("ADMIN_AGENCY", "DMC")
ADMIN_DISTRICT = os.getenv("ADMIN_DISTRICT", "Colombo")

def hash_password(password: str) -> str:
    """Hash password using bcrypt, compatible with passlib's bcrypt output."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

async def main():
    if not ADMIN_EMAIL or len(ADMIN_PASSWORD) < 6 or len(ADMIN_PASSWORD.encode("utf-8")) > 72:
        raise RuntimeError("Set ADMIN_EMAIL and ADMIN_PASSWORD (6 characters minimum, 72 UTF-8 bytes maximum)")
    conn = await asyncpg.connect(DB_URL)

    admins = [
        {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "name": ADMIN_NAME,
            "agency": ADMIN_AGENCY,
            "district": ADMIN_DISTRICT,
        },
        {
            "email": "kirrsh001@gmail.com",
            "password": "password123",
            "name": "Kirrsh Admin",
            "agency": "DMC",
            "district": "Colombo",
        },
    ]

    for adm in admins:
        pw_hash = hash_password(adm["password"])
        existing = await conn.fetchrow(
            "SELECT admin_id FROM administrators WHERE email = $1", adm["email"]
        )
        if existing:
            await conn.execute(
                """
                UPDATE administrators
                SET password_hash = $2, full_name = $3, agency = $4, district = $5, is_active = TRUE
                WHERE email = $1
                """,
                adm["email"], pw_hash, adm["name"], adm["agency"], adm["district"]
            )
            print(f"✅ Admin credentials updated: {adm['email']}")
        else:
            await conn.execute(
                """
                INSERT INTO administrators (admin_id, full_name, email, agency, district, password_hash, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                """,
                uuid.uuid4(),
                adm["name"],
                adm["email"],
                adm["agency"],
                adm["district"],
                pw_hash,
            )
            print(f"✅ Admin user created: {adm['email']}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
