# Request visibility and real-time delivery

`POST /api/requests` returning `201 Created` means the report is saved. Other users immediately see a generic **Unverified** listing in Alerts. The full description, contact information, exact location and verification images stay private. The signed-in owner and authorized coordinators can inspect the full report. Account/phone verification does not verify an incident.

The Python API reads open requests directly from the shared database for `/api/alerts` and `/api/requests/community`. Listings retain their actual **Unverified**, **Needs information** or **Verified** status. Rejected and closed requests disappear. Community acceptance, goods pledges and fulfillment still require coordinator verification. Node sends empty refresh hints; private request bodies are sent only to authorized coordinator sockets. Home and Alerts reload the saved feed when opened, when the app resumes, after a socket reconnect or publication/review event, and every 15 seconds while active. A temporary Node outage does not prevent a saved request from appearing through this fallback.

## Fix the localhost error on Render

On the **FastAPI service**, set:

```dotenv
NODE_BACKEND_URL=https://resqai-platform-backend.onrender.com
```

Use the actual Node service URL if it differs. `localhost` inside the FastAPI service points back to that service, not to a separately hosted Node service. Changing Expo's socket URL does not configure Python's notification destination.

Set the same private `INTERNAL_API_KEY` (at least 32 characters) on **both FastAPI and Node**, then restart/redeploy both services. Node checks this key for `/api/requests/new`. Do not include it in the mobile application. Both services must use the same database; their database URL formats may differ by driver.

Local processes use `http://localhost:5000` and Node defaults to port `5000`; a hosting provider's `PORT` overrides this. Docker Compose already sets `http://node-backend:5000` for Python.

After deployment:

1. Submit a help request. It should appear in the owner's Activities, the administrator's Requests list, and a second user's Alerts as **Unverified**, without the private description.
2. Check the FastAPI log for `New request alert delivered to Node backend`. Connection errors indicate the URL/reachability problem; HTTP 401/503 indicates the internal key needs checking.
3. Verify the request in the administrator dashboard. The second user's Alerts should update its badge to **Verified** and enable eligible community participation; pull-to-refresh also remains available.
4. Reject or close the case and confirm it disappears from the current community feed.

These updates refresh the open app. They do not add operating-system push delivery while the app is closed.

## Affected people and automatic priority

The request form asks whether people are affected and asks for a count only for **Yes**. **No** submits zero. Users no longer choose urgency; the server uses the description and affected-person response, with AI assistance when available. Critical phrases retain their existing highest-priority rules even if the reported count is zero. Automated priority remains triage assistance and does not verify the incident.

Apply migrations `015_request_affected_people_zero.sql` and `016_private_request_evidence.sql` to the configured database before deploying the updated API:

```sh
python -m database.run_migrations --check
python -m database.run_migrations
```

For Docker, use `docker compose run --rm --build migrate`. Migration 015 preserves existing reports and allows the explicit zero count; 016 adds private evidence storage. Older queued submissions containing an urgency estimate remain accepted.

## Private NIC and camera-selfie evidence

After a request reaches the server, a phone-verified signed-in requester can open **Add private identity photos (optional)** on the receipt or in Activities request details. Anonymous urgent reports remain available. Evidence is optional, so obtaining documents does not delay the initial report.

1. Read and accept private reviewer access and seven-day retention.
2. Start a five-minute capture challenge. Write the new six-digit code on paper and hold it beside your face for the selfie.
3. Capture or select an NIC image and take a new front-camera selfie. Each image must be JPEG, PNG or WebP and no larger than 3 MB.
4. Submit the pair. It remains **pending review** and does not automatically change the request's verification status.
5. An administrator opens the request, explicitly opens the private images, compares the document/photo and visible challenge, and records the actual checks and findings through the existing review form. Confirmation of the need remains a separate human judgment.

The camera flow and timestamp are client claims; the challenge is not a certified liveness or identity check. There is no automatic face matching. A coordinator can use phone callback, field confirmation or agency confirmation when images are missing or inconclusive.

To enable uploads, generate a dedicated key locally and put it in the **FastAPI service's** private `EVIDENCE_ENCRYPTION_KEY` environment variable:

```sh
python -c 'import base64,secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())'
```

Keep this key separate from JWT/internal keys and retain it securely across redeploys. Changing it without re-encrypting existing evidence makes those images unreadable. Do not put it in Expo, frontend environment variables, source control or logs. Without a valid key, uploads are unavailable and ordinary request submission continues to work.

The admin browser calls an authenticated Node proxy, which forwards the original admin bearer to Python. Configure Node's `FASTAPI_URL` to the actual Python API URL. Set Node's `JWT_SECRET` equal to Python's `SECRET_KEY` (at least 32 random characters) so Python can authenticate the forwarded administrator. The Node `SECRET_KEY` should match as well. Use HTTPS for hosted/mobile API URLs. Reinstall Python requirements, redeploy both APIs/admin UI and rebuild the native mobile app for the camera permissions update. The main API Gemini SDK now matches the AI service's version, allowing a current Pillow decoder without the old SDK's dependency conflict.

New evidence is decoded only by allowed image handlers, resized, converted to JPEG and stripped of metadata, then encrypted with AES-256-GCM using a separate nonce and binding to its request, evidence ID and type. Uploads have size/time/rate limits; challenge consumption is atomic and bound to requester and request. Slow uploads do not lock incident review. Invalid inputs do not echo image content in validation errors.

Only active administrators can read image bytes. Image access is audited before bytes are returned, served with `no-store`/`nosniff`, and loaded by the admin UI only after an explicit click. Owners can list metadata and delete their evidence; unrelated users cannot list, read or delete it. The mobile app does not put images into the durable submission queue, receipt storage or offline cache; native picker cache copies are deleted before preview. Browser previews are released when hidden, expired or closed.

The API denies access at the seven-day expiry, removes expired records when listed, and purges expired ciphertext hourly while running. Requesters can remove uploads earlier. Database backup retention must be managed separately by the deployment operator. This encryption and retention flow covers the new per-request evidence table; legacy guest-onboarding NIC images are a separate existing workflow.

The upload controls follow the [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html); authenticated encryption follows the [cryptography AES-GCM API](https://cryptography.io/en/stable/hazmat/primitives/aead/). These implemented controls do not establish independent penetration testing or a certified identity service.
