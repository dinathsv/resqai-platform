"""
ResQAI — Main FastAPI Application
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import settings
from .database import engine
from .schema_check import check_schema
from .routers import ai, alerts, auth, donations, missions, requests, quiz, volunteer_assignments
from .routers import auth as auth_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-22s │ %(levelname)-5s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("resqai")
DATABASE_STARTUP_TIMEOUT = 45
REDIS_STARTUP_TIMEOUT = 15


async def check_startup_dependencies():
    async def check_database():
        async with engine.connect() as conn:
            await check_schema(conn)

    logger.info("Checking PostgreSQL connection and database schema")
    try:
        await asyncio.wait_for(check_database(), timeout=DATABASE_STARTUP_TIMEOUT)
    except TimeoutError:
        raise RuntimeError(
            "PostgreSQL/schema startup check timed out. Verify Render DATABASE_URL, "
            "Supabase connectivity, and database availability."
        ) from None
    logger.info("PostgreSQL connection and schema checks passed")

    logger.info("Checking Redis connection")
    async def check_redis():
        redis_client = await auth_router.get_redis()
        await redis_client.ping()

    try:
        await asyncio.wait_for(check_redis(), timeout=REDIS_STARTUP_TIMEOUT)
    except TimeoutError:
        raise RuntimeError(
            "Redis startup check timed out. Verify Render REDIS_URL and Redis connectivity."
        ) from None
    logger.info("Redis connection check passed")

@asynccontextmanager
async def lifespan(app: FastAPI):

    logger.info("🚀 ResQAI main API starting up")

    if not settings.SECRET_KEY or len(settings.SECRET_KEY) < 32:
        raise RuntimeError("SECRET_KEY must contain at least 32 characters")
    await check_startup_dependencies()

    yield

    logger.info("🛑 Shutting down")
    await engine.dispose()
    if auth_router._redis_pool:
        await auth_router._redis_pool.close()

    from .services.ai_service import close
    await close()

app = FastAPI(
    title="ResQAI API",
    description="Main FastAPI application and authentication system for ResQAI",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s (%s)", request.url.path, type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again later."},
    )

app.include_router(auth.router, prefix="/api/auth")
app.include_router(requests.router, prefix="/api/requests")
app.include_router(ai.router, prefix="/api/ai")
app.include_router(alerts.router, prefix="/api/alerts")
app.include_router(donations.router, prefix="/api/donations")
app.include_router(missions.router, prefix="/api/missions")
app.include_router(quiz.router, prefix="/api/quiz")
app.include_router(volunteer_assignments.router, prefix="/api/volunteer-assignments")

@app.get("/", include_in_schema=False)
async def root():
    return {
        "status": "online",
        "service": "ResQAI API",
        "message": "ResQAI backend is running successfully",
        "version": "1.0.0",
    }

@app.get("/health", include_in_schema=False)
async def health():
    database_status = "connected"
    redis_status = "connected"

    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("Health database check failed: %s", exc)
        database_status = "disconnected"

    try:
        redis_client = await auth_router.get_redis()
        await redis_client.ping()
    except Exception as exc:
        logger.error("Health Redis check failed: %s", exc)
        redis_status = "disconnected"

    is_healthy = database_status == "connected" and redis_status == "connected"
    return JSONResponse(
        status_code=200 if is_healthy else 503,
        content={
            "status": "healthy" if is_healthy else "degraded",
            "service": "resqai-api",
            "database": database_status,
            "redis": redis_status,
        },
    )
