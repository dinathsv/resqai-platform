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
    Includes multi-model fallback and rate-limit handling.
    Returns None on any exception so callers can handle fallback.
    """
    import asyncio
    import re

    # Order candidate models starting with configured model, then backups
    candidate_models: list[str] = [settings.AI_MODEL]
    for backup in ["gemini-3.5-flash-lite", "gemini-3.5-flash"]:
        if backup not in candidate_models:
            candidate_models.append(backup)

    client = _get_client()

    for model_name in candidate_models:
        max_attempts = 2
        for attempt in range(max_attempts):
            try:
                response = await client.aio.models.generate_content(
                    model=model_name,
                    contents=user_message,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        max_output_tokens=max_tokens
                    )
                )
                if response and response.text:
                    return response.text
            except Exception as exc:
                exc_str = str(exc)
                is_rate_limit = "429" in exc_str or "RESOURCE_EXHAUSTED" in exc_str

                if is_rate_limit:
                    # Daily quota exhaustion - immediately fail over to next model
                    if "PerDay" in exc_str or "quotaValue': '20'" in exc_str or "limit: 20" in exc_str:
                        logger.warning(
                            "Model %s daily quota exhausted. Failing over to next model...",
                            model_name
                        )
                        break

                    # Minute rate limit - brief pause on first attempt, then fail over
                    if attempt < max_attempts - 1:
                        retry_delay = 2.0
                        delay_match = re.search(r"retry in ([\d\.]+)s", exc_str)
                        if delay_match:
                            try:
                                retry_delay = min(float(delay_match.group(1)), 3.0)
                            except ValueError:
                                pass
                        logger.warning(
                            "Rate limit hit (429) for %s. Retrying in %.1fs...",
                            model_name, retry_delay
                        )
                        await asyncio.sleep(retry_delay)
                        continue
                    else:
                        logger.warning(
                            "Rate limit hit for %s on all attempts. Failing over...",
                            model_name
                        )
                        break
                else:
                    logger.error("LLM call failed for %s: %s", model_name, exc)
                    break

    logger.error("All candidate LLM models failed to generate response.")
    return None

async def close():
    """Close the underlying HTTP client gracefully."""
    global _client
    if _client is not None:
        # The new google-genai SDK does not have an aclose() method on Client.
        # It handles connections internally or relies on garbage collection.
        _client = None
