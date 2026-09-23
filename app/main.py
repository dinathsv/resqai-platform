"""
ResQAI — Main FastAPI Application
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sqlalchemy import text
from app.config import settings
from app.database import engine, Base
from app.routers import ai, alerts, auth, donations, missions, requests, quiz
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
        # Create PostgreSQL enum types that models reference with create_type=False
        await conn.execute(
            text(
                "DO $$ BEGIN "
                "  CREATE TYPE emergency_type AS ENUM "
                "    ('flood','landslide','tsunami','earthquake','fire','medical',"
                "     'search_and_rescue','infrastructure_damage','hazardous_material','other'); "
                "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
            )
        )
        await conn.execute(
            text(
                "DO $$ BEGIN "
                "  CREATE TYPE request_status AS ENUM "
                "    ('pending','ai_processing','verified','dispatched','in_progress','resolved','cancelled'); "
                "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
            )
        )
        await conn.execute(
            text(
                "DO $$ BEGIN "
                "  CREATE TYPE alert_status AS ENUM "
                "    ('active','expired','cancelled'); "
                "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
            )
        )
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

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again later."},
    )

app.include_router(auth.router, prefix="/api/auth")
app.include_router(requests.router, prefix="/api/requests")
app.include_router(ai.router, prefix="/api/ai")
app.include_router(alerts.router, prefix="/api/alerts")
app.include_router(donations.router, prefix="/api/donations")

from fastapi import APIRouter

missions_router = missions.router
admin_router = APIRouter(tags=["Admin"])
locator_router = APIRouter(tags=["Locator"])

app.include_router(missions_router, prefix="/api/missions")
app.include_router(admin_router, prefix="/api/admin")
app.include_router(quiz.router, prefix="/api/quiz")
app.include_router(locator_router, prefix="/api/locator")

@app.get("/")
async def root():
    return {"status": "ResQAI API running"}
