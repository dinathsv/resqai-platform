"""
ResQAI — LLM Service Wrapper.
Centralised async function for calling the Anthropic API.
"""

import logging

from anthropic import AsyncAnthropic

from app.config import settings

logger = logging.getLogger("resqai.ai_service")

_client: AsyncAnthropic | None = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.AI_API_KEY)
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
        response = await client.messages.create(
            model=settings.AI_MODEL,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        block = response.content[0]
        return block.text
    except Exception as exc:
        logger.error("LLM API call failed: %s", exc, exc_info=True)
        return None


async def close():
    """Close the underlying HTTP client gracefully."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
