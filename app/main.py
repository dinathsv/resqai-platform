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

    logger.info("🚀 ResQAI main API starting up")

    async with engine.begin() as conn:

        await conn.run_sync(Base.metadata.create_all)

    redis_client = await auth_router.get_redis()
    await redis_client.ping()
    logger.info("✅ Redis connected")

    yield

    logger.info("🛑 Shutting down")
    await engine.dispose()
    if auth_router._redis_pool:
        await auth_router._redis_pool.close()

    from app.services.ai_service import close
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

app.include_router(auth.router, prefix="/api/auth")
app.include_router(requests.router, prefix="/api/requests")
app.include_router(ai.router, prefix="/api/ai")

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
