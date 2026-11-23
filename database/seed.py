"""
ResQAI — Comprehensive Development Database Seeder.

Seeds or updates:
1. Administrator: admin@resqai.lk (password: admin123)
2. Primary Admin & Citizen: kirrsh001@gmail.com (password: Ranjan@2003, name: Kirrsh, phone: +94771234567)
3. Standard Test Citizen: citizen@example.com (password: password123, name: Citizen Example, phone: +94719876543)
4. Redis: Clears failed login attempt counters so no account remains locked.

Usage:
    python -m database.seed
"""

import os
import asyncio
import uuid
import bcrypt
import asyncpg

try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None

def get_db_urls():
    env_url = os.getenv("DATABASE_URL")
    urls = []
    if env_url:
        cleaned = env_url.replace("postgresql+asyncpg://", "postgresql://")
        urls.append(cleaned)
    urls.append("postgresql://resqai_user:resqai_local_db_password@resqai_db:5432/resqai")
    urls.append("postgresql://resqai_user:resqai_local_db_password@localhost:5433/resqai")
    return urls

REDIS_URLS = [
    os.getenv("REDIS_URL"),
    "redis://resqai_redis:6379",
    "redis://localhost:6379",
]

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


async def seed_admins(conn):
    print("--- Seeding Administrators ---")
    admins = [
        {
            "email": "admin@resqai.lk",
            "name": "ResQAI Admin",
            "agency": "DMC",
            "district": "Colombo",
            "password": "admin123",
        },
        {
            "email": "kirrsh001@gmail.com",
            "name": "Kirrsh Admin",
            "agency": "DMC",
            "district": "Colombo",
            "password": "Ranjan@2003",
        },
    ]

    for adm in admins:
        pw_hash = hash_password(adm["password"])
        existing = await conn.fetchrow(
            "SELECT admin_id FROM administrators WHERE LOWER(email) = LOWER($1)", adm["email"]
        )
        if existing:
            await conn.execute(
                """
                UPDATE administrators
                SET password_hash = $2, full_name = $3, agency = $4, district = $5, is_active = TRUE
                WHERE admin_id = $1
                """,
                existing["admin_id"], pw_hash, adm["name"], adm["agency"], adm["district"]
            )
            print(f"✅ Admin credentials updated: {adm['email']} (password: {adm['password']})")
        else:
            await conn.execute(
                """
                INSERT INTO administrators (admin_id, full_name, email, agency, district, password_hash, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                """,
                uuid.uuid4(), adm["name"], adm["email"].lower(), adm["agency"], adm["district"], pw_hash
            )
            print(f"✅ Admin user created: {adm['email']} (password: {adm['password']})")


async def seed_users(conn):
    print("--- Seeding Citizen Users ---")
    citizens = [
        {
            "email": "kirrsh001@gmail.com",
            "name": "Kirrsh",
            "phone": "+94771234567",
            "password": "Ranjan@2003",
        },
        {
            "email": "citizen@example.com",
            "name": "Citizen Example",
            "phone": "+94719876543",
            "password": "password123",
        },
    ]

    query = """
        INSERT INTO users (full_name, email, password_hash, phone_number, is_verified, is_active, language_pref)
        VALUES ($1, $2, $3, $4, TRUE, TRUE, 'en')
        ON CONFLICT (email) DO UPDATE 
        SET password_hash = $3, is_verified = TRUE, is_active = TRUE,
            phone_number = COALESCE(users.phone_number, EXCLUDED.phone_number),
            full_name = EXCLUDED.full_name
    """

    for citizen in citizens:
        pw_hash = hash_password(citizen["password"])
        await conn.execute(query, citizen["name"], citizen["email"].lower(), pw_hash, citizen["phone"])
        print(f"✅ Citizen seeded: {citizen['email']} (password: {citizen['password']}, phone: {citizen['phone']})")


async def clear_redis_fail_locks():
    if not aioredis:
        return
    for r_url in REDIS_URLS:
        if not r_url:
            continue
        try:
            r = aioredis.from_url(r_url)
            keys = await r.keys("fails:*")
            if keys:
                await r.delete(*keys)
                print(f"✅ Cleared {len(keys)} Redis failed login attempt lockout(s)")
            await r.aclose()
            break
        except Exception:
            continue


async def main():
    conn = None
    last_err = None
    for url in get_db_urls():
        try:
            conn = await asyncpg.connect(url)
            print(f"Connected to database at: {url.split('@')[-1] if '@' in url else url}")
            break
        except Exception as e:
            last_err = e
            continue

    if not conn:
        raise RuntimeError(f"Could not connect to database: {last_err}")

    try:
        await seed_admins(conn)
        await seed_users(conn)
    finally:
        await conn.close()

    await clear_redis_fail_locks()
    print("\n🎉 Database seeded successfully!")


if __name__ == "__main__":
    asyncio.run(main())
