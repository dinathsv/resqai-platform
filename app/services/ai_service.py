"""
ResQAI — LLM Service Wrapper.
Centralised async function for calling the Gemini API.
"""

import logging

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger("resqai.ai_service")

_client: genai.Client | None = None

def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.AI_API_KEY)
    return _client

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
        client = _get_client()
        response = await client.aio.models.generate_content(
            model=settings.AI_MODEL,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=max_tokens
            )
        )
        return response.text
    except Exception as exc:
        logger.error("LLM API call failed: %s", exc, exc_info=True)
        return None

async def close():
    """Close the underlying HTTP client gracefully."""
    global _client
    if _client is not None:
        # The new google-genai SDK does not have an aclose() method on Client.
        # It handles connections internally or relies on garbage collection.
        _client = None
