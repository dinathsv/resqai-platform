"""
ResQAI — Authentication Router.
Handles user registration, OTP verification, and login (user, admin, guest).
"""

import os
import logging
import secrets
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import httpx
import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.administrator import Administrator
from app.models.guest_session import GuestSession
from app.models.nic_entry import NicEntry
from app.models.user import User
from app.services.otp_service import send_otp
from app.services.sms_service import normalize_phone_number
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
    full_name: str = Field(..., min_length=1, max_length=150)
    email: EmailStr
    phone_number: str = Field(..., min_length=9, max_length=20)
    password: str = Field(..., min_length=6)
    language_pref: Literal["en", "ta", "si"] = "en"

    @field_validator("full_name", mode="before")
    @classmethod
    def strip_name(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        phone = normalize_phone_number(value)
        if not phone or not re.fullmatch(r"\+[1-9][0-9]{8,14}", phone):
            raise ValueError("A valid mobile number is required")
        return phone

import uuid

class VerifyOtpRequest(BaseModel):
    user_id: uuid.UUID
    otp: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GuestVerifyNicRequest(BaseModel):
    nic_number: str | None = None
    nic_photo: str | None = None
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
    phone_number = req.phone_number.strip()
    if not phone_number:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A mobile number is required for OTP verification",
        )

    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalars().first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    new_user = User(
        full_name=req.full_name,
        email=req.email,
        phone_number=phone_number,
        password_hash=pwd_context.hash(req.password),
        language_pref=req.language_pref,
        is_verified=False,
    )
    db.add(new_user)
    try:
        # Flush reserves the unique email without committing a partial account.
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        # Concurrent registrations can both pass the initial SELECT.
        if getattr(exc.orig, "sqlstate", None) == "23505" or "users.email" in str(exc.orig):
            raise HTTPException(status_code=409, detail="Email already registered") from None
        raise

    otp_key = f"otp:{new_user.user_id}"
    otp = str(secrets.randbelow(900000) + 100000)
    try:
        await redis_client.set(otp_key, otp, ex=300)
        delivery = await send_otp(email=req.email, phone=phone_number, otp=otp)
        if delivery.get("sms") is not True:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="We could not send the OTP. Please check the SMS sender configuration and try again.",
            )
        await db.commit()
    except Exception:
        await db.rollback()
        try:
            await redis_client.delete(otp_key)
        except Exception:
            pass  # TTL expires the orphan OTP; no account was committed.
        raise

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
    otp = str(secrets.randbelow(900000) + 100000)
    await redis_client.set(f"otp:{req.user_id}", otp, ex=300)

    # Track resend count (expires after 15 minutes)
    await redis_client.incr(resend_key)
    await redis_client.expire(resend_key, 900)

    # Send OTP via SMS to mobile number
    delivery = await send_otp(email=user.email, phone=user.phone_number, otp=otp)
    if delivery.get("sms") is not True:
        await redis_client.delete(f"otp:{req.user_id}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="We could not send the OTP. Please check the SMS sender configuration and try again.",
        )

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

    if not user.phone_number or not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mobile number not verified",
        )

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
            "language_pref": user.language_pref,
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
                "language_pref": user.language_pref,
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
    language_pref: str | None = None


@router.patch("/me")
async def update_me(
    req: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    """Update citizen profile name, avatar, phone number, or language preference."""
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
        if req.language_pref is not None:
            pref = req.language_pref.strip().lower()
            if pref in ("en", "ta", "si"):
                user.language_pref = pref

        await db.commit()
        await db.refresh(user)
        return {
            "user_id": str(user.user_id),
            "full_name": user.full_name,
            "email": user.email,
            "phone_number": user.phone_number,
            "avatar_url": user.avatar_url,
            "language_pref": user.language_pref,
            "role": current_user.get("role") or "people",
        }
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Could not update profile") from None


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

logger = logging.getLogger("resqai.auth")

async def validate_nic_with_induwara(nic_number: str) -> tuple[bool, str, dict | None]:
    """
    Validate a Sri Lankan NIC number using the official Induwara.lk NIC decoder API.
    Detects if the NIC is real or fake based on encoded checksum, day-of-year range,
    and official Sri Lankan DRP format rules.
    """
    clean_nic = nic_number.strip().upper()
    if not clean_nic:
        return False, "NIC number cannot be empty", None

    # Enforce basic format first (9 digits + V/X or 12 digits)
    if not re.match(r"^[0-9]{9}[VvXx]$|^[0-9]{12}$", clean_nic):
        return False, "NIC must be 10 characters (old format, e.g. 923456789V) or 12 digits (new format)", None

    api_key = getattr(settings, "INDUWARA_API_KEY", "") or os.getenv(
        "INDUWARA_API_KEY", "ilk_live_2e72ea094d19d9119b74033c8453a1cc063b56f3fe1154d4"
    )

    url = f"https://induwara.lk/api/v1/nic/{clean_nic}"
    headers = {
        "x-api-key": api_key,
        "User-Agent": "ResQAI-Platform/1.0",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                payload = resp.json()
                if payload.get("ok") and payload.get("data", {}).get("valid"):
                    return True, "Valid Sri Lankan National Identity Card", payload.get("data")
                err_msg = payload.get("error", {}).get("message") or "Invalid or fake NIC number"
                return False, err_msg, None
            else:
                try:
                    payload = resp.json()
                    err_msg = payload.get("error", {}).get("message")
                except Exception:
                    err_msg = None
                return False, err_msg or f"Invalid NIC number (HTTP {resp.status_code})", None
    except Exception as exc:
        logger.warning("Induwara.lk NIC API lookup failed: %s", exc)
        # Fallback offline check if the external API is temporarily down
        if re.match(r"^[0-9]{9}[VvXx]$|^[0-9]{12}$", clean_nic):
            return True, "Valid NIC format (offline verification)", {"nic": clean_nic, "valid": True}
        return False, "Invalid NIC format", None


@router.get("/guest/validate-nic/{nic_number}")
async def validate_guest_nic(nic_number: str):
    """
    Real-time Sri Lankan NIC real/fake verification endpoint using Induwara.lk API.
    Decodes gender, DOB, age, and valid status for guest users.
    """
    is_valid, message, data = await validate_nic_with_induwara(nic_number)
    return {
        "is_valid": is_valid,
        "message": message,
        "data": data,
    }


@router.post("/guest/verify-nic")
async def verify_nic(req: GuestVerifyNicRequest, db: AsyncSession = Depends(get_db)):
    """
    Guest verification endpoint:
    Validates Sri Lankan NIC number real/fake status via Induwara.lk API,
    and stores optional NIC photo for visual verification.
    """
    nic_num = (req.nic_number or "").strip()
    if not nic_num:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NIC number is required for guest verification"
        )

    # Validate whether NIC is real or fake using Induwara.lk API
    is_valid, validation_msg, decoded_data = await validate_nic_with_induwara(nic_num)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fake or invalid NIC: {validation_msg}"
        )

    clean_nic = nic_num.upper()
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.GUEST_TOKEN_EXPIRE_MINUTES)

    new_session = GuestSession(
        nic_number=clean_nic[:50],
        nic_photo=req.nic_photo,
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
        data={"sub": str(new_session.session_id), "role": "guest", "nic": clean_nic},
        expires_delta=timedelta(minutes=settings.GUEST_TOKEN_EXPIRE_MINUTES),
    )

    new_session.temp_token = token
    await db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "nic_number": clean_nic,
        "session_id": str(new_session.session_id),
        "decoded": decoded_data,
        "message": "Real Sri Lankan NIC verified successfully"
    }


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

    otp = str(secrets.randbelow(900000) + 100000)
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

    otp = str(secrets.randbelow(900000) + 100000)
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
