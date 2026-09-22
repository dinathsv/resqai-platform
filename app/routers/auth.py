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
from app.services.otp_service import send_otp
from app.middleware.auth import oauth2_scheme, get_current_user

router = APIRouter(tags=["Authentication"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_redis_pool = None

async def get_redis():
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_pool

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: str | None = None
    password: str = Field(..., min_length=6)
    language_pref: str = "en"

import uuid

class VerifyOtpRequest(BaseModel):
    user_id: uuid.UUID
    otp: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GuestVerifyNicRequest(BaseModel):
    nic_number: str
    lat: float | None = None
    lng: float | None = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str = Field(..., min_length=6)

def create_access_token(data: dict[str, Any], expires_delta: timedelta) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    req: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
):

    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalars().first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

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

    otp = f"{random.randint(100000, 999999)}"
    await redis_client.set(f"otp:{new_user.user_id}", otp, ex=300)

    # Send OTP via SMS to mobile number
    delivery = await send_otp(email=req.email, phone=req.phone_number, otp=otp)

    return {
        "user_id": str(new_user.user_id),
        "message": "OTP sent to your mobile number",
        "delivery": delivery,
    }

class ResendOtpRequest(BaseModel):
    user_id: uuid.UUID

@router.post("/resend-otp")
async def resend_otp(
    req: ResendOtpRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
):
    """Resend a new OTP for registration verification. Rate-limited to 3 resends."""

    # Rate-limit resend attempts
    resend_key = f"otp_resend_count:{req.user_id}"
    resend_count = await redis_client.get(resend_key)
    if resend_count and int(resend_count) >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP resend attempts. Please wait and try again.",
        )

    # Check user exists and is not already verified
    result = await db.execute(select(User).where(User.user_id == req.user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.is_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account already verified")

    # Generate and store new OTP
    otp = f"{random.randint(100000, 999999)}"
    await redis_client.set(f"otp:{req.user_id}", otp, ex=300)

    # Track resend count (expires after 15 minutes)
    await redis_client.incr(resend_key)
    await redis_client.expire(resend_key, 900)

    # Send OTP via SMS to mobile number
    delivery = await send_otp(email=user.email, phone=user.phone_number, otp=otp)

    return {"message": "OTP resent successfully", "delivery": delivery}

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
        data={"sub": str(user.user_id), "role": "people", "email": user.email, "name": user.full_name},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": str(user.user_id),
            "full_name": user.full_name,
            "email": user.email,
            "phone_number": user.phone_number,
        },
    }

@router.get("/me")
async def get_me(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    """Return current authenticated user profile."""
    from app.middleware.auth import get_current_user
    current_user = await get_current_user(token)
    sub = current_user.get("sub")
    role = current_user.get("role")

    if role == "guest":
        return {
            "user_id": sub,
            "full_name": f"Guest ({current_user.get('nic', 'Citizen')})",
            "email": None,
            "role": "guest",
        }

    try:
        user_uuid = uuid.UUID(sub)
        result = await db.execute(select(User).where(User.user_id == user_uuid))
        user = result.scalars().first()
        if user:
            return {
                "user_id": str(user.user_id),
                "full_name": user.full_name,
                "email": user.email,
                "phone_number": user.phone_number,
                "avatar_url": user.avatar_url,
                "role": role or "people",
            }
    except Exception:
        pass

    return {
        "user_id": sub,
        "full_name": current_user.get("name") or current_user.get("email", "Citizen"),
        "role": role or "people",
    }


class UpdateProfileRequest(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None
    phone_number: str | None = None


@router.patch("/me")
async def update_me(
    req: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    """Update citizen profile name, avatar, or phone number."""
    from app.middleware.auth import get_current_user
    current_user = await get_current_user(token)
    sub = current_user.get("sub")
    try:
        user_uuid = uuid.UUID(sub)
        result = await db.execute(select(User).where(User.user_id == user_uuid))
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if req.full_name is not None and req.full_name.strip():
            user.full_name = req.full_name.strip()
        if "avatar_url" in req.model_fields_set:
            user.avatar_url = req.avatar_url
        if req.phone_number is not None:
            user.phone_number = req.phone_number

        await db.commit()
        await db.refresh(user)
        return {
            "user_id": str(user.user_id),
            "full_name": user.full_name,
            "email": user.email,
            "phone_number": user.phone_number,
            "avatar_url": user.avatar_url,
            "role": current_user.get("role") or "people",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


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
            "user_id": str(admin.admin_id),
            "role": "admin",
            "email": admin.email,
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

    new_session = GuestSession(
        nic_number=req.nic_number,
        nic_verified=True,
        nic_format_valid=True,
        temp_token="pending", 
        expires_at=expires,
    )

    if req.lat is not None and req.lng is not None:
        new_session.gps_location = f"SRID=4326;POINT({req.lng} {req.lat})"

    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)

    token = create_access_token(
        data={"sub": str(new_session.session_id), "role": "guest", "nic": req.nic_number},
        expires_delta=timedelta(minutes=settings.GUEST_TOKEN_EXPIRE_MINUTES),
    )

    new_session.temp_token = token
    await db.commit()

    return {"access_token": token, "token_type": "bearer"}


@router.post("/forgot-password")
async def forgot_password(
    req: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()
    if not user:
        return {"message": "If that account exists, an OTP has been sent to the registered mobile number."}

    otp = f"{random.randint(100000, 999999)}"
    await redis_client.set(f"reset_otp:{user.user_id}", otp, ex=300)

    await send_otp(email=user.email, phone=user.phone_number, otp=otp)

    return {"message": "If that account exists, an OTP has been sent to the registered mobile number."}


@router.post("/reset-password")
async def reset_password(
    req: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request")

    stored_otp = await redis_client.get(f"reset_otp:{user.user_id}")
    if not stored_otp or stored_otp != req.otp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")

    user.password_hash = pwd_context.hash(req.new_password)
    await db.commit()
    await redis_client.delete(f"reset_otp:{user.user_id}")

    return {"message": "Password reset successfully"}


@router.post("/admin/forgot-password")
async def admin_forgot_password(
    req: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
):
    result = await db.execute(select(Administrator).where(Administrator.email == req.email))
    admin = result.scalars().first()
    if not admin:
        return {"message": "If that email is registered, an OTP has been sent."}

    otp = f"{random.randint(100000, 999999)}"
    await redis_client.set(f"reset_otp_admin:{admin.admin_id}", otp, ex=300)

    # Admin lacks a phone number, so phone is None. It will use Email OTP.
    await send_otp(email=admin.email, phone=None, otp=otp)

    return {"message": "If that email is registered, an OTP has been sent."}


@router.post("/admin/reset-password")
async def admin_reset_password(
    req: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
):
    result = await db.execute(select(Administrator).where(Administrator.email == req.email))
    admin = result.scalars().first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request")

    stored_otp = await redis_client.get(f"reset_otp_admin:{admin.admin_id}")
    if not stored_otp or stored_otp != req.otp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")

    admin.password_hash = pwd_context.hash(req.new_password)
    await db.commit()
    await redis_client.delete(f"reset_otp_admin:{admin.admin_id}")

    return {"message": "Password reset successfully"}
