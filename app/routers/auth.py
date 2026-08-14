"""
ResQAI — Authentication Router.
Handles user registration, OTP verification, and login (user, admin, guest).
"""

import random
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.administrator import Administrator
from app.models.guest_session import GuestSession
from app.models.nic_entry import NicEntry
from app.models.user import User

router = APIRouter(tags=["Authentication"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Redis Dependency (Global instance for simplicity) ──────────

_redis_pool = None

async def get_redis():
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_pool


# ── Schemas ──────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: str | None = None
    password: str = Field(..., min_length=6)
    language_pref: str = "en"


class VerifyOtpRequest(BaseModel):
    user_id: str
    otp: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GuestVerifyNicRequest(BaseModel):
    nic_number: str
    lat: float | None = None
    lng: float | None = None


# ── Helpers ──────────────────────────────────────────────────

def create_access_token(data: dict[str, Any], expires_delta: timedelta) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# ── Endpoints ────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    req: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
):
    # Check if email exists
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalars().first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Insert user
    new_user = User(
        full_name=req.full_name,
        email=req.email,
        phone_number=req.phone_number,
        password_hash=pwd_context.hash(req.password),
        language_pref=req.language_pref,
        is_verified=False,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Generate and store OTP
    otp = f"{random.randint(100000, 999999)}"
    await redis_client.set(f"otp:{new_user.user_id}", otp, ex=300)

    print(f"--- [MOCK SMS] OTP for {req.email}: {otp} ---")

    return {"user_id": str(new_user.user_id), "message": "OTP sent"}


@router.post("/verify-otp")
async def verify_otp(
    req: VerifyOtpRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
):
    stored_otp = await redis_client.get(f"otp:{req.user_id}")
    if not stored_otp or stored_otp != req.otp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")

    result = await db.execute(select(User).where(User.user_id == req.user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_verified = True
    await db.commit()
    await redis_client.delete(f"otp:{req.user_id}")

    access_token = create_access_token(
        data={"sub": str(user.user_id), "role": "people", "email": user.email},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login")
async def login(
    req: LoginRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
):
    fail_key = f"fails:{req.email}"
    fails = await redis_client.get(fail_key)
    if fails and int(fails) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account locked for 15 minutes due to too many failed attempts",
        )

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()

    if not user or not pwd_context.verify(req.password, user.password_hash):
        await redis_client.incr(fail_key)
        await redis_client.expire(fail_key, 900)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account not verified")

    await redis_client.delete(fail_key)

    access_token = create_access_token(
        data={"sub": str(user.user_id), "role": "people", "email": user.email},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/admin/login")
async def admin_login(
    req: LoginRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
):
    fail_key = f"fails:admin:{req.email}"
    fails = await redis_client.get(fail_key)
    if fails and int(fails) >= 5:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Locked")

    result = await db.execute(select(Administrator).where(Administrator.email == req.email))
    admin = result.scalars().first()

    if not admin or not pwd_context.verify(req.password, admin.password_hash):
        await redis_client.incr(fail_key)
        await redis_client.expire(fail_key, 900)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not admin.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account inactive")

    await redis_client.delete(fail_key)

    access_token = create_access_token(
        data={
            "sub": str(admin.admin_id),
            "role": "admin",
            "agency": admin.agency,
            "district": admin.district,
        },
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/guest/verify-nic")
async def verify_nic(req: GuestVerifyNicRequest, db: AsyncSession = Depends(get_db)):
    if not re.match(r"^[0-9]{9}[VvXx]$|^[0-9]{12}$", req.nic_number):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid NIC format")

    result = await db.execute(
        select(NicEntry).where(NicEntry.nic_number == req.nic_number, NicEntry.is_valid == True)
    )
    if not result.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="NIC not in registry")

    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.GUEST_TOKEN_EXPIRE_MINUTES)
    
    # We create the DB session without geometry first if we just use PostGIS functions later, 
    # but geoalchemy2 handles ST_GeomFromText if we wanted to set it directly.
    # The spec didn't strictly require saving the point directly on guest login except lat/lng,
    # but we can set it via raw SQL or let it be null.
    
    new_session = GuestSession(
        nic_number=req.nic_number,
        nic_verified=True,
        nic_format_valid=True,
        temp_token="pending", # Temp placeholder
        expires_at=expires,
    )
    # Note: for GPS location, we can use WKT if lat/lng provided
    if req.lat is not None and req.lng is not None:
        new_session.gps_location = f"SRID=4326;POINT({req.lng} {req.lat})"

    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)

    # Generate JWT
    token = create_access_token(
        data={"sub": str(new_session.session_id), "role": "guest", "nic": req.nic_number},
        expires_delta=timedelta(minutes=settings.GUEST_TOKEN_EXPIRE_MINUTES),
    )
    
    new_session.temp_token = token
    await db.commit()

    return {"access_token": token, "token_type": "bearer"}
