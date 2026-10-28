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
model, 10 seconds per attempt, and a 35-second total generation deadline.
Model-not-found errors skip that model for the rest of the request. Invalid
requests and authentication/permission errors fail immediately.

Automatic function calling is explicitly disabled for these text requests,
removing the SDK warning. That warning was separate from the 503 failure.

## Run locally

```bash
cd ai-service
python -m pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

## Hosted mobile app

The mobile environment currently points to the AI service hosted on Render.
Set `GEMINI_API_KEY`, `LLM_MODEL=gemini-3.8-flash`, and
`LLM_FALLBACK_MODELS=gemini-3.5-flash-lite` in that Render service's environment
settings and redeploy the **AI microservice** with this code. The existing key
can be retained. Local `.env` edits do not update Render's environment or the
deployed application. No mobile rebuild is required for this server change.

After deployment, check the `/api/ai/first-aid-chat` response body for
`service_available=true`. During primary-model overload, logs should show a
different model being tried and `Gemini recovered using fallback model=...`
when it succeeds.

The chatbot still returns its existing emergency fallback when Gemini fails.
API keys, model access, quota, and upstream availability can affect live calls;
switching SDKs does not guarantee freedom from 503 errors.

Provider references: [supported models](https://ai.google.dev/gemini-api/docs/models),
[retry guidance](https://ai.google.dev/gemini-api/docs/troubleshooting), and
[Python SDK configuration](https://github.com/googleapis/python-genai).

`VERTEX_AI_SETUP.md` describes the previous configuration and is no longer
required for this API-key implementation.
