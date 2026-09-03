# Vertex AI Setup Guide for ResQAI

## What Changed

The AI service has been migrated from Google GenAI SDK to **Vertex AI** to use the more stable and reliable Gemini models.

## Prerequisites

1. **Google Cloud Project** with Vertex AI API enabled
2. **Service Account** with the following roles:
   - Vertex AI User
   - AI Platform Admin (optional)

## Setup Steps

### 1. Create a Google Cloud Service Account

```bash
# Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
# Or use gcloud CLI:

gcloud iam service-accounts create resqai-service \
    --display-name="ResQAI AI Service Account"

# Grant Vertex AI permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:resqai-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"
```

### 2. Download Service Account Key

```bash
gcloud iam service-accounts keys create credentials.json \
    --iam-account=resqai-service@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

Place the `credentials.json` file in `/home/SDinath/Projects/resqai/ai-service/`

### 3. Update Environment Variables

Edit `/home/SDinath/Projects/resqai/ai-service/.env`:

```env
GOOGLE_CREDENTIAL_FILE=/app/credentials.json
PROJECT_ID=your-actual-gcp-project-id
LLM_MODEL=gemini-1.5-flash-001
```

Replace `your-actual-gcp-project-id` with your actual GCP project ID.

### 4. Update Dockerfile

Add this line before `COPY . .` in the Dockerfile:

```dockerfile
# Copy credentials
COPY credentials.json /app/credentials.json
```

### 5. Rebuild and Restart

```bash
cd /home/SDinath/Projects/resqai/ai-service
docker build -t resqai-ai-service .
docker stop resqai_ai_service
docker rm resqai_ai_service
docker run -d --name resqai_ai_service \
  --network resqai_default \
  -p 8001:8001 \
  resqai-ai-service
```

### 6. Test the Service

```bash
curl -X POST http://localhost:8001/api/ai/first-aid-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "I have a headache", "language": "auto"}'
```

## Benefits of Vertex AI

- ✅ More stable API (no 503 high-demand errors)
- ✅ Better rate limits for production use
- ✅ Access to latest Gemini models
- ✅ Integrated with GCP ecosystem
- ✅ Better monitoring and logging

## Troubleshooting

### Error: "GOOGLE_CREDENTIAL_FILE or PROJECT_ID not configured"
- Make sure `.env` file has the correct values
- Verify `credentials.json` exists in the ai-service directory

### Error: "Permission denied" or "403 Forbidden"
- Check that your service account has `roles/aiplatform.user` role
- Verify Vertex AI API is enabled in your GCP project

### Error: "Model not found"
- Available models: `gemini-1.5-flash-001`, `gemini-1.5-pro-001`
- Update `LLM_MODEL` in `.env` if needed

## Next Steps

1. Get your GCP project ID
2. Create service account and download credentials
3. Place credentials.json in ai-service directory
4. Update .env with your project ID
5. Rebuild Docker container
6. Test the chatbot!

## Support

For more information:
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Gemini API Quickstart](https://cloud.google.com/vertex-ai/docs/generative-ai/start/quickstarts/quickstart-multimodal)
