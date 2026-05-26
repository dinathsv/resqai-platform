"""
ResQAI — AI Microservice
FastAPI application with CORS, startup/shutdown lifecycle, and 4 routers.

Run:  uvicorn main:app --host 0.0.0.0 --port 8001 --reload
"""

import os
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers import chatbot, multilingual, situational, locator
from services import llm_service, db_service

# ── Load environment ─────────────────────────────────────────
load_dotenv()

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-22s │ %(levelname)-5s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("resqai")


# ── Lifespan (startup + shutdown) ────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    logger.info("🚀 ResQAI AI Microservice starting up")

    # Check DB connectivity
    if db_service.check_connection():
        logger.info("✅ PostgreSQL + PostGIS connection OK")
    else:
        logger.warning("⚠️  PostgreSQL connection failed — /locate-resources will be degraded")

    logger.info("✅ Service ready on port %s", os.getenv("PORT", "8001"))

    yield  # ← app is now running and serving requests

    # ── Shutdown ──
    logger.info("🛑 Shutting down — closing LLM client")
    await llm_service.close()
    logger.info("👋 ResQAI AI Microservice stopped")


# ── App ──────────────────────────────────────────────────────

app = FastAPI(
    title="ResQAI AI Microservice",
    description=(
        "AI-powered disaster relief services for Sri Lanka. "
        "Provides first-aid chat, multilingual report parsing, "
        "situational summaries, and hospital resource location."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────
# The Node.js backend on port 3000/5000 and any frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5000",
        "http://localhost:5173",  # Vite default
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global error handler ────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": "The AI service encountered an unexpected error. Please try again.",
        },
    )


# ── Routers ──────────────────────────────────────────────────
app.include_router(chatbot.router, prefix="/api/ai")
app.include_router(multilingual.router, prefix="/api/ai")
app.include_router(situational.router, prefix="/api/ai")
app.include_router(locator.router, prefix="/api/ai")


# ── Health check ─────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health():
    db_ok = db_service.check_connection()
    return {
        "status": "healthy" if db_ok else "degraded",
        "service": "resqai-ai",
        "version": "1.0.0",
        "database": "connected" if db_ok else "disconnected",
    }


# ── Run directly ─────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8001")),
        reload=True,
    )
