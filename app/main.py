"""
ResQAI — Main FastAPI Application
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import engine
from .schema_check import check_schema
from .routers import ai, alerts, auth, donations, missions, requests, quiz
from .routers import auth as auth_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-22s │ %(levelname)-5s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("resqai")

@asynccontextmanager
async def lifespan(app: FastAPI):

    logger.info("🚀 ResQAI main API starting up")

    if not settings.SECRET_KEY or len(settings.SECRET_KEY) < 32:
        raise RuntimeError("SECRET_KEY must contain at least 32 characters")
    async with engine.connect() as conn:
        await check_schema(conn)

    redis_client = await auth_router.get_redis()
    await redis_client.ping()
    logger.info("✅ Redis connected")

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
