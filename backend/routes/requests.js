

const express = require('express');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

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
