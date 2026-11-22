"""
ResQAI — Seed a verified citizen user for local development.

Usage:
    python database/seed_user.py [email] [password] [full_name] [phone_number]
"""

import os
import sys
import asyncio
import bcrypt
import asyncpg

DB_URL = os.getenv("DATABASE_URL", "postgresql://resqai_user:resqai_local_db_password@localhost:5433/resqai")
if DB_URL.startswith("postgresql+asyncpg://"):
    DB_URL = DB_URL.replace("postgresql+asyncpg://", "postgresql://")

EMAIL = sys.argv[1] if len(sys.argv) > 1 else os.getenv("CITIZEN_EMAIL", "kirrsh001@gmail.com")
PASSWORD = sys.argv[2] if len(sys.argv) > 2 else os.getenv("CITIZEN_PASSWORD", "password123")
FULL_NAME = sys.argv[3] if len(sys.argv) > 3 else os.getenv("CITIZEN_NAME", "Kirrsh")
PHONE_NUMBER = sys.argv[4] if len(sys.argv) > 4 else os.getenv("CITIZEN_PHONE", "+94771234567")

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

async def main():
    if not PASSWORD or len(PASSWORD) < 6 or len(PASSWORD.encode("utf-8")) > 72:
        raise RuntimeError("Set a valid password (6 characters minimum, 72 UTF-8 bytes maximum)")
    conn = await asyncpg.connect(DB_URL)
    pw_hash = hash_password(PASSWORD)
    query = """
        INSERT INTO users (full_name, email, password_hash, phone_number, is_verified, is_active, language_pref)
        VALUES ($1, $2, $3, $4, TRUE, TRUE, 'en')
        ON CONFLICT (email) DO UPDATE 
        SET password_hash = $3, is_verified = TRUE, is_active = TRUE,
            phone_number = COALESCE(users.phone_number, EXCLUDED.phone_number)
    """
    await conn.execute(query, FULL_NAME, EMAIL, pw_hash, PHONE_NUMBER)
    user = await conn.fetchrow(
        "SELECT user_id, full_name, email, phone_number, is_verified, is_active FROM users WHERE email = $1",
        EMAIL
    )
    print(f"✅ Citizen user seeded successfully!")
    print(f"   User ID:      {user['user_id']}")
    print(f"   Full Name:    {user['full_name']}")
    print(f"   Email:        {user['email']}")
    print(f"   Phone:        {user['phone_number']}")
    print(f"   Verified:     {user['is_verified']}")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
