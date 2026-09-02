"""
ResQAI — LLM Service Wrapper.
Centralised async function for calling the Gemini API.
"""

import logging

import google.generativeai as genai

from app.config import settings

logger = logging.getLogger("resqai.ai_service")

_client_configured = False

def _ensure_configured():
    global _client_configured
    if not _client_configured:
        genai.configure(api_key=settings.AI_API_KEY)
        _client_configured = True

async def call_llm(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 1024,
) -> str | None:
    """
    Send a single-turn message to the LLM and return the text response.
    Returns None on any exception so callers can handle fallback.
    """
    try:
        _ensure_configured()
        model = genai.GenerativeModel(
            model_name=settings.AI_MODEL,
            system_instruction=system_prompt,
            generation_config={"max_output_tokens": max_tokens}
        )
        response = await model.generate_content_async(user_message)
        return response.text
    except Exception as exc:
        logger.error("LLM API call failed: %s", exc, exc_info=True)
        return None

async def close():
    """Close the underlying HTTP client gracefully."""
    pass
