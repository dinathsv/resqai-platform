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


def get_model() -> str:
    return os.getenv("LLM_MODEL", "gemini-flash-latest")


async def chat(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> str:
    """Call Gemini directly with an API key; no Vertex AI credentials required."""
    api_key = (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or os.getenv("API_KEY")
        or os.getenv("AI_API_KEY")
    )
    if not api_key:
        raise RuntimeError("Set GEMINI_API_KEY in ai-service/.env")

    async with genai.Client(api_key=api_key, vertexai=False).aio as client:
        response = await client.models.generate_content(
            model=get_model(),
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=max_tokens,
                temperature=temperature,
            ),
        )
    if not response.text or not response.text.strip():
        raise ValueError("Gemini returned an empty response")
    return response.text


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
    """Clients are closed after each request by the async context manager."""
    pass
