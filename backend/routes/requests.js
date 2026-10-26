

const express = require('express');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { notifyNewRequest } = require('../socket');

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

router.get('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required' });
  }

  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const statuses = typeof req.query.status === 'string'
      ? req.query.status.split(',').map((value) => value.trim()).filter(Boolean)
      : [];
    const emergencyType = typeof (req.query.type || req.query.emergency_type) === 'string'
      ? (req.query.type || req.query.emergency_type).trim()
      : '';
    const params = [];
    const conditions = [];

    if (statuses.length > 0) {
      params.push(statuses);
      conditions.push(`status = ANY($${params.length}::request_status[])`);
    }
    if (emergencyType) {
      params.push(emergencyType.toLowerCase());
      conditions.push(`emergency_type = $${params.length}::emergency_type`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const pool = req.app.locals.pool;
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM help_requests ${where}`,
      params,
    );
    const total = countResult.rows[0].total;
    const offset = (page - 1) * limit;

    params.push(limit, offset);
    const { rows } = await pool.query(
      `SELECT request_id, emergency_type, urgency_level, original_message,
              created_at, status, ai_summary,
              CASE WHEN is_guest_request THEN 'guest' ELSE 'user' END AS source
       FROM help_requests
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return res.json({
      requests: rows,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error('GET /api/requests error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

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
