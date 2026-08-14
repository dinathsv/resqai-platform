"""
ResQAI — Main FastAPI Application
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.routers import ai, auth, requests
import app.routers.auth as auth_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-22s │ %(levelname)-5s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("resqai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    logger.info("🚀 ResQAI main API starting up")
    
    # Create tables
    async with engine.begin() as conn:
        # Note: In production you'd use Alembic. 
        # Here we just create any missing tables.
        # Ensure postgis is created via raw SQL if needed, but the spec says "Run this first to set up the database: CREATE EXTENSION..."
        # So we just run create_all
        await conn.run_sync(Base.metadata.create_all)
        
    # Connect Redis
    redis_client = await auth_router.get_redis()
    await redis_client.ping()
    logger.info("✅ Redis connected")

    yield

    # ── Shutdown ──
    logger.info("🛑 Shutting down")
    await engine.dispose()
    if auth_router._redis_pool:
        await auth_router._redis_pool.close()
    
    # Close AI client
    from app.services.ai_service import close
    await close()


app = FastAPI(
    title="ResQAI API",
    description="Main FastAPI application and authentication system for ResQAI",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth")
app.include_router(requests.router, prefix="/api/requests")
app.include_router(ai.router, prefix="/api/ai")

# Note: The spec also mentions /api/alerts, /api/locator, /api/donations, /api/missions, /api/admin, /api/quiz
# It says "Include all routers with prefixes" but we only implemented auth, requests, ai.
# For the rest we'll add placeholder routers or just skip them since we weren't asked to implement their endpoints.
# I will create a dummy router for them so the app starts without errors.

from fastapi import APIRouter

alerts_router = APIRouter(tags=["Alerts"])
donations_router = APIRouter(tags=["Donations"])
missions_router = APIRouter(tags=["Missions"])
admin_router = APIRouter(tags=["Admin"])
quiz_router = APIRouter(tags=["Quiz"])
locator_router = APIRouter(tags=["Locator"])

app.include_router(alerts_router, prefix="/api/alerts")
app.include_router(donations_router, prefix="/api/donations")
app.include_router(missions_router, prefix="/api/missions")
app.include_router(admin_router, prefix="/api/admin")
app.include_router(quiz_router, prefix="/api/quiz")
app.include_router(locator_router, prefix="/api/locator")


@app.get("/")
async def root():
    return {"status": "ResQAI API running"}
