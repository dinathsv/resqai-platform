# AI service configuration and overload recovery

The AI microservice uses the Gemini Developer API with an API key again.
The previous Vertex AI migration introduced project ID and service-account
requirements that are unnecessary for this authentication method.

## Configuration

Set these server-side variables in `ai-service/.env` for local development:

```env
GEMINI_API_KEY=your_gemini_api_key
LLM_MODEL=gemini-3.8-flash
LLM_FALLBACK_MODELS=gemini-3.5-flash-lite
LLM_MODEL_TIMEOUT_SECONDS=30
LLM_REQUEST_TIMEOUT_SECONDS=65
```

`GOOGLE_API_KEY`, `API_KEY`, and `AI_API_KEY` are also accepted for compatibility.
No `PROJECT_ID` or service-account JSON file is required by this service.
Do not put the Gemini key in the mobile app.

The primary model defaults to the stable `gemini-3.8-flash` model ID. Existing
`LLM_MODEL` values still override it, including `gemini-flash-latest`. An unset
or blank `LLM_FALLBACK_MODELS` enables `gemini-3.5-flash-lite` as the backup.
You can supply a comma-separated list of other model IDs enabled for your API
project. Duplicate IDs are removed; to use only the primary model, set
`LLM_FALLBACK_MODELS` to the same ID as `LLM_MODEL`.

## Why the chatbot showed the emergency fallback

Gemini returned HTTP 503 with a high-demand message. The previous wrapper
retried only that overloaded model three times when no backup was configured.
The chatbot then returned HTTP 200 with its emergency fallback and
`service_available=false`. HTTP 200 from `/` only confirms the web service is
running; it does not test Gemini availability.

The wrapper now tries the next model immediately after a temporary error
(408, 429, 500, 502, 503, 504, network failure, or timeout). It waits with
exponential backoff and jitter between rounds, with at most three attempts per
model, 30 seconds per attempt, and a 65-second total generation deadline.
Rate-limit (429) and model-not-found errors skip that model for the rest of the
request. Invalid requests and authentication/permission errors fail immediately.

### Repeated 429 and 504 responses

A 429 can indicate exhausted daily quota, which short retries cannot restore.
The wrapper now logs the provider's quota ID, limit, and retry delay without
logging request content or credentials, and moves to the backup immediately.
For example, `GenerateRequestsPerDayPerProjectPerModel-FreeTier` identifies a
daily limit. Check the specific model's remaining quota in
[Google AI Studio](https://aistudio.google.com/usage?tab=rate-limit).
Quota is per Google project; changing the key within that project does not
reset it. An available backup can still answer while the primary is limited.

The old 10-second SDK timeout also sent `X-Server-Timeout: 10`, asking Gemini to
abort generation at that deadline. This contributed to repeated 504 responses.
`LLM_MODEL_TIMEOUT_SECONDS` now defaults to 30 and
`LLM_REQUEST_TIMEOUT_SECONDS` to 65. Both accept positive finite seconds;
unset or blank values use those defaults. When overriding them, leave enough
total time for a full attempt on both models.

Automatic function calling is explicitly disabled for these text requests,
removing the SDK warning. That warning was separate from the 503 failure.

## Run locally

```bash
cd ai-service
python -m pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

## Hosted mobile app

The mobile environment currently points to **resqai-platform-ai-service** on
Render. Its environment is separate from **resqai-platform-api**, the main
application API. Open the AI service's Environment page, set the variables in
the configuration block above, and redeploy the AI microservice with this code.
`AI_MODEL` configures the main API; the AI microservice reads `LLM_MODEL`.
The existing Gemini key can be retained (`AI_API_KEY` is also accepted).
Local `.env` or `.env.example` edits do not update Render's environment or the
deployed application. No mobile rebuild is required for this server change.

After deployment, check the `/api/ai/first-aid-chat` response body for
`service_available=true`. During primary-model overload, logs should show a
different model being tried and `Gemini recovered using fallback model=...`
when it succeeds.

The chatbot still returns its existing emergency fallback when Gemini fails.
API keys, model access, quota, and upstream availability can affect live calls;
switching SDKs does not guarantee freedom from 503 errors.

Provider references: [supported models](https://ai.google.dev/gemini-api/docs/models),
[retry guidance](https://ai.google.dev/gemini-api/docs/troubleshooting),
[rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), and
[Python SDK configuration](https://github.com/googleapis/python-genai).

`VERTEX_AI_SETUP.md` describes the previous configuration and is no longer
required for this API-key implementation.
