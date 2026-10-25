"""
ResQAI — Seed a verified citizen user for local development.

Usage:
    python database/seed_user.py [email] [password] [full_name]
"""

import os
import sys
import asyncio
import bcrypt
import asyncpg

DB_URL = os.getenv("DATABASE_URL", "postgresql://resqai_user:resqai_pass@localhost:5433/resqai")
if DB_URL.startswith("postgresql+asyncpg://"):
    DB_URL = DB_URL.replace("postgresql+asyncpg://", "postgresql://")

EMAIL = sys.argv[1] if len(sys.argv) > 1 else os.getenv("CITIZEN_EMAIL", "kirrsh001@gmail.com")
PASSWORD = sys.argv[2] if len(sys.argv) > 2 else os.getenv("CITIZEN_PASSWORD", "Ranjan@2003")
FULL_NAME = sys.argv[3] if len(sys.argv) > 3 else os.getenv("CITIZEN_NAME", "Kirrsh")

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

async def main():
    conn = await asyncpg.connect(DB_URL)
    pw_hash = hash_password(PASSWORD)
    query = """
        INSERT INTO users (full_name, email, password_hash, is_verified, is_active, language_pref)
        VALUES ($1, $2, $3, TRUE, TRUE, 'en')
        ON CONFLICT (email) DO UPDATE 
        SET password_hash = $3, is_verified = TRUE, is_active = TRUE
    """
    await conn.execute(query, FULL_NAME, EMAIL, pw_hash)
    user = await conn.fetchrow(
        "SELECT user_id, full_name, email, is_verified, is_active FROM users WHERE email = $1",
        EMAIL
    )
    print(f"✅ Citizen user seeded successfully!")
    print(f"   User ID:     {user['user_id']}")
    print(f"   Full Name:   {user['full_name']}")
    print(f"   Email:       {user['email']}")
    print(f"   Verified:    {user['is_verified']}")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
