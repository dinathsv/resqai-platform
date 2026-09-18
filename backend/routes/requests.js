

const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { notifyNewRequest } = require('../socket');

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

/**
 * POST /new
 * Called by the Python API when a new help request is created.
 * Broadcasts a real-time alert to all connected sockets.
 */
router.post('/new', async (req, res) => {
  try {
    const { request_id, emergency_type, urgency_level, ai_summary } = req.body;

    if (!request_id || !emergency_type) {
      return res.status(400).json({ error: 'request_id and emergency_type are required' });
    }

    const io = req.app.locals.io;
    if (io) {
      notifyNewRequest(io, {
        request_id,
        emergency_type,
        urgency_level: urgency_level || 3,
        ai_summary: ai_summary || null,
        alerted_at: new Date().toISOString(),
      });
    }

    console.log(`📡 New request broadcast: ${emergency_type} (urgency ${urgency_level}) — ${request_id}`);
    return res.json({ success: true, message: 'New request broadcast to clients' });
  } catch (err) {
    console.error('POST /api/requests/new error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/locate', optionalAuth, async (req, res) => {
  try {
    const { lat, lng, emergency_type } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng query params are required' });
    }

    if (typeof lat !== 'string' || typeof lng !== 'string') {
      return res.status(400).json({ error: 'lat and lng must be single string values' });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({ error: 'lat and lng must be valid numbers' });
    }

    const payload = {
      lat: parsedLat,
      lng: parsedLng,
      emergency_type: typeof emergency_type === 'string' ? emergency_type : 'medical',
    };

    const response = await fetch(`${AI_SERVICE_URL}/api/ai/locate-resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI service /locate-resources error:', response.status, errText);
      return res.status(502).json({ error: 'AI service unavailable' });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error('GET /api/requests/locate error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
