"""
ResQAI — Application Configuration.
Uses pydantic-settings to load from environment variables / .env file.
"""

from pydantic_settings import BaseSettings

class Settings(BaseSettings):

    DATABASE_URL: str = "postgresql+asyncpg://resqai_user:resqai_pass@localhost:5433/resqai"

    REDIS_URL: str = "redis://localhost:6379"

    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440       
    GUEST_TOKEN_EXPIRE_MINUTES: int = 30

    AI_API_KEY: str = ""
    AI_MODEL: str = "gemini-3.6-flash"

    model_config = {"env_file": ".env", "extra": "ignore"}

settings = Settings()
