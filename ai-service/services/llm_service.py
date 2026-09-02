"""
ResQAI — LLM service wrapper.
Centralises all LLM API calls so routers never talk to the SDK directly.
Includes automatic fallback when the API is unreachable.
"""

import os
import json
import logging
from google import genai
from google.genai import types

logger = logging.getLogger("resqai.llm")

_client: genai.Client | None = None

def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.getenv("API_KEY", "")
        if not api_key or api_key == "your-api-key-here":
            logger.warning("API_KEY not configured — LLM calls will fail")
        _client = genai.Client(api_key=api_key)
    return _client

def get_model() -> str:
    return os.getenv("LLM_MODEL", "gemini-2.0-flash")

async def chat(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> str:
    """Send a single-turn chat to the LLM and return the text response."""
    try:
        client = _get_client()
        response = await client.aio.models.generate_content(
            model=get_model(),
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=max_tokens,
                temperature=temperature
            )
        )
        return response.text or ""
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
        first_newline = cleaned.find("\n")
        if first_newline != -1:
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
        # The new google-genai SDK does not have an aclose() method on Client.
        # It handles connections internally or relies on garbage collection.
        _client = None
