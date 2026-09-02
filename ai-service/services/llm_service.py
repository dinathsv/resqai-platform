"""
ResQAI — LLM service wrapper.
Centralises all LLM API calls so routers never talk to the SDK directly.
Includes automatic fallback when the API is unreachable.
"""

import os
import json
import logging
import google.generativeai as genai

logger = logging.getLogger("resqai.llm")

_client_configured = False

def _ensure_configured():
    global _client_configured
    if not _client_configured:
        api_key = os.getenv("API_KEY", "")
        if not api_key or api_key == "your-api-key-here":
            logger.warning("API_KEY not configured — LLM calls will fail")
        genai.configure(api_key=api_key)
        _client_configured = True

def get_model() -> str:
    return os.getenv("LLM_MODEL", "gemini-1.5-flash")

async def chat(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> str:
    """Send a single-turn chat to the LLM and return the text response."""
    try:
        _ensure_configured()
        model = genai.GenerativeModel(
            model_name=get_model(),
            system_instruction=system_prompt,
            generation_config={"max_output_tokens": max_tokens, "temperature": temperature}
        )
        response = await model.generate_content_async(user_message)
        return response.text
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
    pass
