const express = require('express');
const jwt = require('jsonwebtoken');
const { requireAdmin } = require('../middleware/auth');
const { UUID_PATTERN } = require('../services/requestWorkflow');

const router = express.Router();
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SERVICE_UNAVAILABLE = 'The private evidence service is temporarily unavailable.';
const RENDER_BACKEND_HOST = 'resqai-platform-backend.onrender.com';
const RENDER_API_URL = 'https://resqai-platform-api.onrender.com';

function privateResponse(res) {
  res.set('Cache-Control', 'private, no-store');
  res.set('Pragma', 'no-cache');
  res.set('X-Content-Type-Options', 'nosniff');
}

function validIds(req, res) {
  if (!UUID_PATTERN.test(req.params.requestId) ||
      (req.params.evidenceId && !UUID_PATTERN.test(req.params.evidenceId))) {
    res.status(400).json({ error: 'Invalid request or evidence id' });
    return false;
  }
  return true;
}

async function fetchEvidence(req, res, suffix = '') {
  const configuredUrl = process.env.FASTAPI_URL?.trim();
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  const defaultUrl = process.env.RENDER_EXTERNAL_HOSTNAME === RENDER_BACKEND_HOST
    ? RENDER_API_URL : isProduction ? '' : 'http://localhost:8000';
  const base = configuredUrl || defaultUrl;
  if (!base) {
    console.error('Private evidence proxy requires FASTAPI_URL');
    res.status(503).json({ error: SERVICE_UNAVAILABLE });
    return;
  }
  let url;
  try {
    url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('Invalid FastAPI base URL');
    }
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/api/requests/${req.params.requestId}/verification-evidence${suffix}`;
  } catch {
    console.error('Private evidence proxy has an invalid FASTAPI_URL');
    res.status(503).json({ error: SERVICE_UNAVAILABLE });
    return;
  }
  const get = headers => fetch(url.href, {
    headers,
    // A redirect must never send a credential to another host.
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const internalKey = process.env.INTERNAL_API_KEY;
  if (req.admin && internalKey?.length >= 32) {
    const token = jwt.sign(
      { resource: `${req.params.requestId}${suffix}`.toLowerCase() },
      internalKey,
      {
        algorithm: 'HS256', audience: 'resqai-request-evidence', issuer: 'resqai-node',
        subject: req.admin.admin_id, expiresIn: '30s',
      },
    );
    const response = await get({ 'X-ResQAI-Evidence-Authorization': token });
    if (response.status !== 401) return response;
    await response.body?.cancel();
  }
  // An older Python deployment, or one without a shared internal key, can
  // still accept the original admin session when both services share its key.
  return get({ Authorization: req.headers.authorization });
}

function upstreamError(response, res) {
  // Node has already verified the admin session. An upstream 401 is a
  // service-to-service failure and must not sign the admin out of the panel.
  if (response.status === 401) {
    console.error('Private evidence API rejected authentication. Check the shared INTERNAL_API_KEY or matching JWT signing keys.');
    return res.status(502).json({ error: 'The evidence service could not authenticate the review. Contact the service administrator.' });
  }
  switch (response.status) {
    case 403:
      return res.status(403).json({ error: 'The evidence service denied access for this administrator.' });
    case 404:
    case 410:
      return res.status(response.status).json({ error: 'This private evidence is unavailable or has expired.' });
    case 429:
      return res.status(429).json({ error: 'Too many evidence requests. Wait briefly and try again.' });
    default:
      console.error('Private evidence API returned an error', { status: response.status });
      return res.status(response.status === 503 ? 503 : 502).json({ error: SERVICE_UNAVAILABLE });
  }
}

router.get('/:requestId', requireAdmin, async (req, res) => {
  privateResponse(res);
  if (!validIds(req, res)) return;
  try {
    const response = await fetchEvidence(req, res);
    if (!response) return;
    if (!response.ok) return upstreamError(response, res);
    const data = await response.json();
    if (typeof data.configured !== 'boolean' || !Array.isArray(data.items)) {
      return res.status(502).json({ error: 'The private evidence service returned an incomplete response.' });
    }
    return res.json(data);
  } catch {
    console.error('Private evidence metadata could not be read from FastAPI');
    return res.status(502).json({ error: SERVICE_UNAVAILABLE });
  }
});

router.get('/:requestId/:evidenceId/image', requireAdmin, async (req, res) => {
  privateResponse(res);
  if (!validIds(req, res)) return;
  try {
    const response = await fetchEvidence(req, res, `/${req.params.evidenceId}/image`);
    if (!response) return;
    if (!response.ok) return upstreamError(response, res);
    if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'image/jpeg' || !response.body) {
      return res.status(502).json({ error: 'The private evidence image is unavailable.' });
    }
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return res.status(502).json({ error: 'The private evidence image exceeds the supported size.' });
      }
      chunks.push(Buffer.from(value));
    }
    res.set('Content-Type', 'image/jpeg');
    res.set('Content-Disposition', 'inline; filename="private-verification.jpg"');
    return res.send(Buffer.concat(chunks));
  } catch {
    console.error('Private evidence image could not be read from FastAPI');
    return res.status(502).json({ error: SERVICE_UNAVAILABLE });
  }
});

module.exports = router;
