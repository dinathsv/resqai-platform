# AI service authentication fix

The AI microservice uses the Gemini Developer API with an API key again.
The previous Vertex AI migration introduced project ID and service-account
requirements that are unnecessary for this authentication method.

## Configuration

Set these server-side variables in `ai-service/.env` for local development:

```env
GEMINI_API_KEY=your_gemini_api_key
LLM_MODEL=gemini-flash-latest
```

`GOOGLE_API_KEY`, `API_KEY`, and `AI_API_KEY` are also accepted for compatibility.
No `PROJECT_ID` or service-account JSON file is required by this service.
Do not put the Gemini key in the mobile app.

## Run locally

```bash
cd ai-service
python -m pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

## Hosted mobile app

The mobile environment currently points to the AI service hosted on Render.
Set `GEMINI_API_KEY` and `LLM_MODEL=gemini-flash-latest` in that Render service's
environment settings and redeploy this code. Local `.env` edits do not update
Render's environment or the deployed application.

The chatbot still returns its existing emergency fallback when Gemini fails.
API keys, model access, quota, and upstream availability can affect live calls;
switching SDKs does not guarantee freedom from 503 errors.

`VERTEX_AI_SETUP.md` describes the previous configuration and is no longer
required for this API-key implementation.
