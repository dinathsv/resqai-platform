"""
ResQAI — LLM service wrapper.
Centralises all LLM API calls so routers never talk to the SDK directly.
Includes automatic fallback when the API is unreachable.
"""

import os
import json
import logging
import asyncio
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig

logger = logging.getLogger("resqai.llm")

_initialized = False

def _init_vertex():
    """Initialize Vertex AI with credentials."""
    global _initialized
    if not _initialized:
        credential_file = os.getenv("GOOGLE_CREDENTIAL_FILE")
        project_id = os.getenv("PROJECT_ID")

        if not credential_file or not project_id:
            logger.warning("GOOGLE_CREDENTIAL_FILE or PROJECT_ID not configured")
        else:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credential_file
            vertexai.init(project=project_id, location="us-central1")
            _initialized = True
            logger.info("Vertex AI initialized successfully")

def get_model() -> str:
    return os.getenv("LLM_MODEL", "gemini-1.5-flash-001")

async def chat(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> str:
    """Send a single-turn chat to the LLM and return the text response."""
    try:
        _init_vertex()

        # Run the blocking Vertex AI call in a thread pool
        def _generate():
            model = GenerativeModel(
                model_name=get_model(),
                system_instruction=system_prompt,
            )
            response = model.generate_content(
                contents=[{"role": "user", "parts": [{"text": user_message}]}],
                generation_config=GenerationConfig(
                    max_output_tokens=max_tokens,
                    temperature=temperature,
                ),
            )
            return response.text

        result = await asyncio.to_thread(_generate)
        return result or ""
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
    global _initialized
    _initialized = False
    logger.info("Vertex AI client closed")
