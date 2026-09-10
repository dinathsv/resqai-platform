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
    AI_MODEL: str = "gemini-3.5-flash-lite"

    # --- OTP Delivery: Email (primary) ---
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""

    # --- SMS Gateway: SMSlenz (Sri Lanka) ---
    SMSLENZ_USER_ID: str = "2462"
    SMSLENZ_API_KEY: str = "3ef7d7d9-1ae3-4615-b43c-b795f67375e7"
    SMSLENZ_SENDER_ID: str = "SMSlenzDEMO"
    SMSLENZ_BASE_URL: str = "https://smslenz.lk/api"

    # --- Legacy Twilio SMS (deprecated fallback) ---
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}

settings = Settings()
