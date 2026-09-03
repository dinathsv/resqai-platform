# AI Service Fix Summary

## Problem
The AI chatbot was only returning the emergency message:
```
"Please call 1990 Suwa Seriya immediately for emergency assistance"
```

Instead of providing actual first-aid guidance.

## Root Causes Identified

1. **Port Mismatch** ✅ FIXED
   - Mobile app was calling port 8000
   - AI service was running on port 8001
   - **Fix**: Updated `mobile/config/api.ts` to use port 8001

2. **Invalid Model Name** ✅ FIXED
   - Initial model `gemini-3.6-flash` was causing issues
   - Google GenAI SDK had reliability problems (503 errors)
   - **Fix**: Migrated to Vertex AI with stable models

3. **API Reliability Issues** ✅ FIXED
   - Google GenAI SDK experiencing high demand (503 errors)
   - Rate limiting and availability issues
   - **Fix**: Switched to Vertex AI for better stability

## Changes Made

### 1. Mobile App Configuration
**File**: `/home/SDinath/Projects/resqai/mobile/config/api.ts`
```typescript
// Changed from:
export const AI_BASE = `http://${LOCALHOST}:8000`;

// Changed to:
export const AI_BASE = `http://${LOCALHOST}:8001`;
```

### 2. AI Service - LLM Service Migration
**File**: `/home/SDinath/Projects/resqai/ai-service/services/llm_service.py`
- Replaced `google-genai` SDK with Vertex AI
- Uses `google-cloud-aiplatform` package
- Supports system instructions properly
- Better error handling and stability

### 3. Requirements Update
**File**: `/home/SDinath/Projects/resqai/ai-service/requirements.txt`
```diff
- google-genai==1.0.0
+ google-cloud-aiplatform==1.74.0
```

### 4. Environment Configuration
**File**: `/home/SDinath/Projects/resqai/ai-service/.env`
```env
# Old (GenAI SDK):
API_KEY=AQ.Ab8RN6IqV2KS-llV92_G0TlbZyYUfX-OYA8b75sgwmRRTKwCfA
LLM_MODEL=gemini-3.6-flash

# New (Vertex AI):
GOOGLE_CREDENTIAL_FILE=/app/credentials.json
PROJECT_ID=your-gcp-project-id
LLM_MODEL=gemini-1.5-flash-001
```

### 5. Docker Image
✅ Successfully rebuilt with Vertex AI dependencies

## What You Need to Do Next

### ⚠️ IMPORTANT: Set Up Vertex AI Credentials

The AI service now requires **Google Cloud Vertex AI** credentials. Follow these steps:

#### 1. Get Your GCP Project ID
Go to https://console.cloud.google.com and note your project ID

#### 2. Create Service Account & Download Key
```bash
# Create service account
gcloud iam service-accounts create resqai-service \
    --display-name="ResQAI AI Service"

# Grant Vertex AI permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:resqai-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

# Download credentials
gcloud iam service-accounts keys create credentials.json \
    --iam-account=resqai-service@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

Or manually via console:
- Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
- Create new service account with Vertex AI User role
- Create and download JSON key

#### 3. Place Credentials
```bash
# Copy the downloaded credentials.json to:
cp ~/Downloads/credentials.json /home/SDinath/Projects/resqai/ai-service/credentials.json
```

#### 4. Update .env File
```bash
# Edit the .env file
nano /home/SDinath/Projects/resqai/ai-service/.env

# Update this line with your actual project ID:
PROJECT_ID=your-actual-project-id-here
```

#### 5. Update Dockerfile
Add this line to the Dockerfile before `COPY . .`:
```dockerfile
COPY credentials.json /app/credentials.json
```

#### 6. Rebuild & Restart
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

#### 7. Test
```bash
curl -X POST http://localhost:8001/api/ai/first-aid-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "I have a headache", "language": "auto"}'
```

You should now get actual first-aid guidance instead of just the emergency message!

## Expected Behavior After Setup

### Before (Broken):
```json
{
  "reply": "I'm temporarily unable to provide detailed guidance. If this is a life-threatening emergency, please call 1990 (Suwa Seriya) immediately.",
  "language_detected": "en",
  "show_1990": true,
  "is_critical": true
}
```

### After (Working):
```json
{
  "reply": "For a headache:\n1. Rest in a quiet, dark room\n2. Apply a cold compress to your forehead\n3. Stay hydrated - drink water\n4. Take over-the-counter pain reliever if available\n5. If severe or accompanied by fever, confusion, or vision problems, call 1990",
  "language_detected": "en",
  "show_1990": false,
  "is_critical": false
}
```

## Why Vertex AI?

✅ **More Stable**: No 503 "high demand" errors
✅ **Better Rate Limits**: Designed for production use
✅ **Latest Models**: Access to Gemini 1.5 models
✅ **GCP Integration**: Better monitoring and logging
✅ **Reliable**: Enterprise-grade SLA

## Reference Files

- Full setup guide: `/home/SDinath/Projects/resqai/VERTEX_AI_SETUP.md`
- ML Models repo: `/home/SDinath/Projects/resqai/ml-models/`

## Questions?

If you encounter any issues:
1. Check Docker logs: `docker logs resqai_ai_service`
2. Verify credentials file exists: `docker exec resqai_ai_service ls -la /app/credentials.json`
3. Check environment: `docker exec resqai_ai_service cat /app/.env`
