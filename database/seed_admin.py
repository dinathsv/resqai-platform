"""Create an administrator using DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD.

Run `python -m database.seed_admin`.
"""

import asyncio
import os
import uuid

import asyncpg
import bcrypt

DEFAULT_URLS = [
    os.getenv("DATABASE_URL"),
    "postgresql://resqai_user:resqai_local_db_password@resqai_db:5432/resqai",
    "postgresql://resqai_user:resqai_local_db_password@localhost:5433/resqai",
]

def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")

async def main():
    conn = None
    last_err = None
    for raw_url in DEFAULT_URLS:
        if not raw_url:
            continue
        url = raw_url.replace("postgresql+asyncpg://", "postgresql://", 1)
        try:
            conn = await asyncpg.connect(url)
            break
        except Exception as e:
            last_err = e
            continue

    if not conn:
        raise SystemExit(f"Could not connect to database: {last_err}")

    admins = []
    env_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    env_password = os.getenv("ADMIN_PASSWORD", "")
    if env_email and env_password:
        admins.append({
            "email": env_email,
            "password": env_password,
            "name": os.getenv("ADMIN_NAME", "ResQAI Admin"),
            "agency": os.getenv("ADMIN_AGENCY") or "DMC",
            "district": os.getenv("ADMIN_DISTRICT") or "Colombo",
        })
    else:
        admins.extend([
            {
                "email": "admin@resqai.lk",
                "password": "admin123",
                "name": "ResQAI Admin",
                "agency": "DMC",
                "district": "Colombo",
            },
            {
                "email": "kirrsh001@gmail.com",
                "password": "Ranjan@2003",
                "name": "Kirrsh Admin",
                "agency": "DMC",
                "district": "Colombo",
            },
        ])

    try:
        for adm in admins:
            pw_hash = hash_pw(adm["password"])
            existing = await conn.fetchrow(
                "SELECT admin_id FROM public.administrators WHERE lower(email) = lower($1)", adm["email"]
            )
            if existing:
                await conn.execute(
                    """
                    UPDATE public.administrators
                    SET password_hash = $2, full_name = $3, agency = $4, district = $5, is_active = TRUE
                    WHERE admin_id = $1
                    """,
                    existing["admin_id"], pw_hash, adm["name"], adm["agency"], adm["district"]
                )
                print(f"✅ Administrator updated: {adm['email']}")
            else:
                await conn.execute(
                    """
                    INSERT INTO public.administrators (admin_id, full_name, email, agency, district, password_hash, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                    """,
                    uuid.uuid4(), adm["name"], adm["email"].lower(), adm["agency"], adm["district"], pw_hash
                )
                print(f"✅ Administrator created: {adm['email']}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
