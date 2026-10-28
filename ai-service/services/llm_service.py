"""
ResQAI — LLM service wrapper.
Centralises all LLM API calls so routers never talk to the SDK directly.
Retries temporary failures across models within a bounded request deadline.
"""

import os
import asyncio
import random
import httpx
import json
import logging
import math
from google import genai
from google.genai import types

logger = logging.getLogger("resqai.llm")

DEFAULT_MODEL = "gemini-3.8-flash"
DEFAULT_FALLBACK_MODELS = ("gemini-3.5-flash-lite",)
MODEL_TIMEOUT_SECONDS = 30
REQUEST_TIMEOUT_SECONDS = 65
MAX_ATTEMPTS_PER_MODEL = 3


def _model_name(value: str) -> str:
    return value.strip().removeprefix("models/").strip()


def get_model() -> str:
    return _model_name(os.getenv("LLM_MODEL", "")) or DEFAULT_MODEL


def get_models() -> list[str]:
    """Keep a backup enabled even for deployments with an empty env variable."""
    fallbacks = [
        name for value in os.getenv("LLM_FALLBACK_MODELS", "").split(",")
        if (name := _model_name(value))
    ]
    return list(dict.fromkeys([get_model(), *(fallbacks or DEFAULT_FALLBACK_MODELS)]))


def get_timeouts() -> tuple[float, float]:
    """Read deadlines at request time so dotenv and hosted configuration apply."""
    timeouts = []
    for name, default in (
        ("LLM_MODEL_TIMEOUT_SECONDS", MODEL_TIMEOUT_SECONDS),
        ("LLM_REQUEST_TIMEOUT_SECONDS", REQUEST_TIMEOUT_SECONDS),
    ):
        raw = os.getenv(name, "").strip()
        try:
            value = float(raw) if raw else float(default)
        except ValueError:
            raise ValueError(f"{name} must be a positive number") from None
        if not math.isfinite(value) or value <= 0:
            raise ValueError(f"{name} must be a positive number")
        timeouts.append(value)
    return timeouts[0], timeouts[1]


def _quota_summary(exc: Exception) -> dict:
    """Extract diagnostic quota fields without logging prompts or credentials."""
    payload = getattr(exc, "details", {})
    if not isinstance(payload, dict):
        return {}
    error = payload.get("error", payload)
    if not isinstance(error, dict) or not isinstance(error.get("details"), list):
        return {}

    summary = {}
    for detail in error["details"]:
        if not isinstance(detail, dict):
            continue
        if detail.get("@type") == "type.googleapis.com/google.rpc.RetryInfo":
            summary["retry_delay"] = str(detail.get("retryDelay", ""))[:32]
        if detail.get("@type") == "type.googleapis.com/google.rpc.QuotaFailure":
            violations = detail.get("violations", [])
            if not isinstance(violations, list):
                continue
            for violation in violations:
                if isinstance(violation, dict):
                    summary.setdefault("quota_ids", []).append(str(violation.get("quotaId", ""))[:128])
                    summary.setdefault("quota_values", []).append(str(violation.get("quotaValue", ""))[:32])
    return summary


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

    # Bound the entire operation, including SDK calls and backoff, for mobile clients.
    models = get_models()
    model_timeout, request_timeout = get_timeouts()
    client = genai.Client(
        api_key=api_key, vertexai=False,
        http_options=types.HttpOptions(
            timeout=math.ceil(model_timeout * 1000),
            retry_options=types.HttpRetryOptions(attempts=1),
        ),
    ).aio

    async def generate():
        active_models = models.copy()
        last_error = None
        # Give every candidate a chance before retrying an overloaded model.
        for attempt in range(MAX_ATTEMPTS_PER_MODEL):
            for model in active_models.copy():
                try:
                    response = await asyncio.wait_for(
                        client.models.generate_content(
                            model=model,
                            contents=user_message,
                            config=types.GenerateContentConfig(
                                system_instruction=system_prompt,
                                max_output_tokens=max_tokens,
                                temperature=temperature,
                                automatic_function_calling=types.AutomaticFunctionCallingConfig(
                                    disable=True,
                                ),
                            ),
                        ),
                        timeout=model_timeout,
                    )
                    if not response.text or not response.text.strip():
                        raise ValueError("Gemini returned an empty response")
                    if model != models[0]:
                        logger.info("Gemini recovered using fallback model=%s", model)
                    return response.text
                except Exception as exc:
                    code = getattr(exc, "code", None)
                    if code == 429:
                        # A short backoff cannot restore exhausted quota. Let the
                        # backup run instead of hammering this model again.
                        last_error = exc
                        active_models.remove(model)
                        logger.warning(
                            "Gemini rate limited (model=%s, status=429, quota=%s); "
                            "skipping for this request; check this project's model limits in AI Studio",
                            model, json.dumps(_quota_summary(exc)),
                        )
                        continue
                    # An unavailable/retired model should not block a valid backup.
                    if code == 404:
                        last_error = exc
                        active_models.remove(model)
                        logger.warning("Gemini model unavailable (model=%s, status=404); skipping", model)
                        continue
                    transient = code in {408, 500, 502, 503, 504} or isinstance(
                        exc, (httpx.TransportError, asyncio.TimeoutError)
                    )
                    if not transient:
                        raise
                    last_error = exc
                    logger.warning(
                        "Gemini temporarily unavailable (model=%s, status=%s, round=%s/%s)",
                        model, code, attempt + 1, MAX_ATTEMPTS_PER_MODEL,
                    )
            if not active_models or attempt == MAX_ATTEMPTS_PER_MODEL - 1:
                break
            await asyncio.sleep(2 ** attempt + random.uniform(0, 0.5))
        if last_error is not None:
            raise last_error
        raise RuntimeError("No LLM model available")

    try:
        return await asyncio.wait_for(generate(), timeout=request_timeout)
    finally:
        await client.aclose()


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
    """Clients are closed after each request in the finally block."""
    pass
