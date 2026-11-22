"""
ResQAI — Comprehensive Development Database Seeder.

Seeds or updates:
1. Administrator: admin@resqai.lk (password: admin123)
2. Primary Citizen: kirrsh001@gmail.com (password: password123, name: Kirrsh, phone: +94771234567)
3. Standard Test Citizen: citizen@example.com (password: password123, name: Citizen Example, phone: +94719876543)
4. NIC Registry: 500 valid Sri Lankan NICs if not already present
5. Redis: Clears failed login attempt counters so no account remains locked.

Usage:
    python -m database.seed
"""

import os
import random
import asyncio
import uuid
import bcrypt
import asyncpg

try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None

DB_URL = os.getenv("DATABASE_URL", "postgresql://resqai_user:resqai_local_db_password@localhost:5433/resqai")
if DB_URL.startswith("postgresql+asyncpg://"):
    DB_URL = DB_URL.replace("postgresql+asyncpg://", "postgresql://")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@resqai.lk")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_NAME = os.getenv("ADMIN_NAME", "ResQAI Admin")
ADMIN_AGENCY = os.getenv("ADMIN_AGENCY", "DMC")
ADMIN_DISTRICT = os.getenv("ADMIN_DISTRICT", "Colombo")

CITIZEN_PASSWORD = os.getenv("CITIZEN_PASSWORD", "password123")


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


async def seed_admins(conn):
    print("--- Seeding Administrators ---")
    pw_hash = hash_password(ADMIN_PASSWORD)
    existing = await conn.fetchrow(
        "SELECT admin_id FROM administrators WHERE email = $1", ADMIN_EMAIL
    )
    if existing:
        await conn.execute(
            """
            UPDATE administrators
            SET password_hash = $2, full_name = $3, agency = $4, district = $5, is_active = TRUE
            WHERE email = $1
            """,
            ADMIN_EMAIL, pw_hash, ADMIN_NAME, ADMIN_AGENCY, ADMIN_DISTRICT
        )
        print(f"✅ Admin credentials updated: {ADMIN_EMAIL} (password: {ADMIN_PASSWORD})")
    else:
        await conn.execute(
            """
            INSERT INTO administrators (admin_id, full_name, email, agency, district, password_hash, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE)
            """,
            uuid.uuid4(), ADMIN_NAME, ADMIN_EMAIL, ADMIN_AGENCY, ADMIN_DISTRICT, pw_hash
        )
        print(f"✅ Admin user created: {ADMIN_EMAIL} (password: {ADMIN_PASSWORD})")


async def seed_users(conn):
    print("--- Seeding Citizen Users ---")
    citizens = [
        {
            "email": "kirrsh001@gmail.com",
            "name": "Kirrsh",
            "phone": "+94771234567",
            "password": CITIZEN_PASSWORD,
        },
        {
            "email": "citizen@example.com",
            "name": "Citizen Example",
            "phone": "+94719876543",
            "password": CITIZEN_PASSWORD,
        },
    ]

    query = """
        INSERT INTO users (full_name, email, password_hash, phone_number, is_verified, is_active, language_pref)
        VALUES ($1, $2, $3, $4, TRUE, TRUE, 'en')
        ON CONFLICT (email) DO UPDATE 
        SET password_hash = $3, is_verified = TRUE, is_active = TRUE,
            phone_number = COALESCE(users.phone_number, EXCLUDED.phone_number)
    """

    for citizen in citizens:
        pw_hash = hash_password(citizen["password"])
        await conn.execute(query, citizen["name"], citizen["email"], pw_hash, citizen["phone"])
        print(f"✅ Citizen seeded: {citizen['email']} (password: {citizen['password']}, phone: {citizen['phone']})")


async def seed_nics(conn):
    from database.seed_nic import generate_old_nic, generate_new_nic, DISTRICTS
    count = await conn.fetchval("SELECT count(*) FROM nic_database")
    if count and count >= 50:
        print(f"✅ NIC database already has {count} records.")
        return

    print("--- Seeding NIC Records ---")
    records = []
    for _ in range(250):
        records.append((generate_old_nic(), True, random.choice(DISTRICTS)))
    for _ in range(250):
        records.append((generate_new_nic(), True, random.choice(DISTRICTS)))
    query = """
        INSERT INTO nic_database (nic_number, is_valid, district)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
    """
    await conn.executemany(query, records)
    print("✅ Seeded 500 NIC records.")


async def clear_redis_fail_locks():
    if not aioredis:
        return
    try:
        r = aioredis.from_url(REDIS_URL)
        keys = await r.keys("fails:*")
        if keys:
            await r.delete(*keys)
            print(f"✅ Cleared {len(keys)} Redis failed login attempt lockout(s): {[k.decode() if isinstance(k, bytes) else k for k in keys]}")
        else:
            print("✅ No Redis login locks found.")
        await r.aclose()
    except Exception as e:
        print(f"ℹ️ Redis lockout clear skipped ({e})")


async def main():
    print("Connecting to database at:", DB_URL.split("@")[-1] if "@" in DB_URL else DB_URL)
    conn = await asyncpg.connect(DB_URL)
    try:
        await seed_admins(conn)
        await seed_users(conn)
        await seed_nics(conn)
    finally:
        await conn.close()

    await clear_redis_fail_locks()
    print("\n🎉 All development database seeds completed successfully!")


if __name__ == "__main__":
    asyncio.run(main())

