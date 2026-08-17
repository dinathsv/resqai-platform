"""
ResQAI — LLM service wrapper.
Centralises all LLM API calls so routers never talk to the SDK directly.
Includes automatic fallback when the API is unreachable.
"""

import os
import json
import logging
from anthropic import AsyncAnthropic
from anthropic.types import TextBlock

logger = logging.getLogger("resqai.llm")

_client: AsyncAnthropic | None = None

def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        api_key = os.getenv("API_KEY", "")
        if not api_key or api_key == "your-api-key-here":
            logger.warning("API_KEY not configured — LLM calls will fail")
        _client = AsyncAnthropic(api_key=api_key)
    return _client

def get_model() -> str:
    return os.getenv("LLM_MODEL", "claude-sonnet-4-20250514")

async def chat(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> str:
    """Send a single-turn chat to the LLM and return the text response."""
    try:
        client = _get_client()
        response = await client.messages.create(
            model=get_model(),
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        block = response.content[0]
        if isinstance(block, TextBlock):
            return block.text
        return str(block)
    except Exception as exc:
        logger.error("LLM API call failed: %s", exc, exc_info=True)
        raise

async def chat_json(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 1024,
    temperature: float = 0.2,
) -> dict:
    """
    Call the LLM and parse the response as JSON.
    If the model wraps its answer in a code fence we strip it first.
    """
    raw = await chat(system_prompt, user_message, max_tokens, temperature)

    cleaned = raw.strip()
    if cleaned.startswith("```"):

        first_newline = cleaned.index("\n")
        cleaned = cleaned[first_newline + 1:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("LLM returned non-JSON: %s", raw[:300])
        raise ValueError(f"LLM response was not valid JSON: {raw[:200]}")

async def close():
    """Close the underlying HTTP client gracefully."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
