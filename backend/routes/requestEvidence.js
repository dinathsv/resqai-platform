const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { UUID_PATTERN } = require('../services/requestWorkflow');

const router = express.Router();
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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

async function fetchEvidence(req, suffix = '') {
  const base = (process.env.FASTAPI_URL || 'http://localhost:8000').replace(/\/+$/, '');
  return fetch(`${base}/api/requests/${req.params.requestId}/verification-evidence${suffix}`, {
    headers: { Authorization: req.headers.authorization },
    // A redirect must never send an administrator credential to another host.
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
}

function upstreamError(response, res) {
  const status = [401, 403, 404, 409, 410, 429, 503].includes(response.status) ? response.status : 502;
  return res.status(status).json({ error: status === 404 || status === 410
    ? 'This private evidence is unavailable or has expired.'
    : 'Private evidence could not be loaded. Please try again.' });
}

router.get('/:requestId', requireAdmin, async (req, res) => {
  privateResponse(res);
  if (!validIds(req, res)) return;
  try {
    const response = await fetchEvidence(req);
    if (!response.ok) return upstreamError(response, res);
    const data = await response.json();
    if (typeof data.configured !== 'boolean' || !Array.isArray(data.items)) {
      return res.status(502).json({ error: 'The private evidence service returned an incomplete response.' });
    }
    return res.json(data);
  } catch {
    return res.status(502).json({ error: 'The private evidence service is unavailable.' });
  }
});

router.get('/:requestId/:evidenceId/image', requireAdmin, async (req, res) => {
  privateResponse(res);
  if (!validIds(req, res)) return;
  try {
    const response = await fetchEvidence(req, `/${req.params.evidenceId}/image`);
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
    return res.status(502).json({ error: 'The private evidence service is unavailable.' });
  }
});

module.exports = router;
