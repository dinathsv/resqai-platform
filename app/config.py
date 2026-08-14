"""
ResQAI — Application Configuration.
Uses pydantic-settings to load from environment variables / .env file.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ─────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://resqai_user:resqai_pass@localhost:5433/resqai"

    # ── Redis ────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379"

    # ── JWT / Auth ───────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440       # 24 hours
    GUEST_TOKEN_EXPIRE_MINUTES: int = 30

    # ── AI / LLM ─────────────────────────────────────────────
    AI_API_KEY: str = ""
    AI_MODEL: str = "claude-sonnet-4-20250514"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
