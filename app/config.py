"""
ResQAI - Application Configuration.
Uses pydantic-settings to load from environment variables / .env file.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):

    DATABASE_URL: str = "postgresql+asyncpg://localhost:5433/resqai"
    REDIS_URL: str = "redis://localhost:6379"

    SECRET_KEY: str = ""
    INTERNAL_API_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    GUEST_TOKEN_EXPIRE_MINUTES: int = 30

    AI_API_KEY: str = ""
    AI_MODEL: str = "gemini-3.5-flash-lite"

    NODE_BACKEND_URL: str = "http://localhost:5000"

    # --- Administrator recovery email; citizen OTPs use SMSlenz ---
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""

    # --- SMS Gateway: SMSlenz (Sri Lanka) ---
    SMSLENZ_USER_ID: str = ""
    SMSLENZ_API_KEY: str = ""
    SMSLENZ_SENDER_ID: str = ""
    SMSLENZ_BASE_URL: str = "https://smslenz.lk/api"


    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
