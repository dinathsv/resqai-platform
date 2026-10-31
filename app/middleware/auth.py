"""
ResQAI — JWT Authentication Middleware.
Provides get_current_user and require_role dependencies for FastAPI.
"""

from typing import Any
import uuid
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.administrator import Administrator
from app.models.guest_session import GuestSession

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Decode the JWT and return the payload dict.
    Raises 401 if the token is invalid or expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        sub: str | None = payload.get("sub") or payload.get("user_id")
        if sub is None:
            raise credentials_exception
        subject = uuid.UUID(sub)
    except (JWTError, ValueError, TypeError):
        raise credentials_exception
    role = payload.get("role")
    if role == "admin":
        record = (await db.execute(select(Administrator).where(Administrator.admin_id == subject))).scalar_one_or_none()
        if not record or not record.is_active:
            raise HTTPException(status_code=403, detail="Administrator account unavailable")
    elif role == "people":
        record = (await db.execute(select(User).where(User.user_id == subject))).scalar_one_or_none()
        if not record or not record.is_active:
            raise HTTPException(status_code=403, detail="Account unavailable")
        if not record.is_verified:
            raise HTTPException(status_code=403, detail={"code": "verification_required", "user_id": str(subject), "message": "Verify your mobile number before using this account."})
    elif role == "guest":
        record = (await db.execute(select(GuestSession).where(GuestSession.session_id == subject))).scalar_one_or_none()
        expiry = record.expires_at.replace(tzinfo=timezone.utc) if record and record.expires_at.tzinfo is None else record.expires_at if record else None
        if not record or not expiry or expiry <= datetime.now(timezone.utc):
            raise credentials_exception
        if record.admin_status == "rejected":
            raise HTTPException(status_code=403, detail="Guest identity review was rejected. Sign out to submit an urgent anonymous SOS or contact a coordinator.")
        payload["identity_status"] = record.admin_status
    else:
        raise credentials_exception
    payload["sub"] = str(subject)
    return payload

async def get_optional_user(
    token: str | None = Depends(oauth2_scheme_optional),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any] | None:
    """
    Anonymous SOS is allowed; invalid or revoked credentials never become anonymous silently.
    """
    if not token:
        return None
    return await get_current_user(token, db)

def require_role(*roles: str):
    """
    Dependency factory that checks the JWT payload 'role' field.

    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_role("admin"))])
        async def admin_endpoint(): ...

    Or inject the user directly:
        async def endpoint(user=Depends(require_role("admin", "people"))): ...
    """

    async def _check_role(
        current_user: dict[str, Any] = Depends(get_current_user),
    ) -> dict[str, Any]:
        user_role = current_user.get("role", "")
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user_role}' is not authorised for this resource",
            )
        return current_user

    return _check_role
