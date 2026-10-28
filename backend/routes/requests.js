const express = require('express');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { notifyNewRequest } = require('../socket');
const { requireInternal } = require('../middleware/internal');
const ADMIN_REQUEST_STATUSES = new Set(['pending', 'in_progress', 'finished']);

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

router.get('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required' });
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const requestType = typeof req.query.type === 'string' ? req.query.type.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const params = [];
    const conditions = [];

    if (ADMIN_REQUEST_STATUSES.has(status)) {
      params.push(status);
      conditions.push(`COALESCE(hr.admin_status, CASE WHEN hr.status::text IN ('resolved','cancelled') THEN 'finished' ELSE 'pending' END) = $${params.length}`);
    } else if (status) {
      return res.status(400).json({ error: 'Invalid request status' });
    }
    if (requestType === 'help') {
      conditions.push("hr.emergency_type != 'donation'");
    } else if (requestType === 'donation') {
      conditions.push("hr.emergency_type = 'donation'");
    } else if (requestType) {
      return res.status(400).json({ error: 'Invalid request type' });
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(hr.original_message ILIKE $${params.length} OR COALESCE(u.full_name, 'Guest') ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const pool = req.app.locals.pool;
    const joins = 'FROM help_requests hr LEFT JOIN users u ON u.user_id = hr.user_id LEFT JOIN guest_sessions gs ON gs.session_id = hr.guest_session_id';
    const count = await pool.query(`SELECT COUNT(*)::int AS total ${joins} ${where}`, params);
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    const result = await pool.query(`
      SELECT hr.request_id, hr.emergency_type,
             CASE WHEN hr.emergency_type = 'donation' THEN 'donation' ELSE 'help' END AS request_type,
             hr.original_message, hr.created_at, hr.status,
             COALESCE(hr.admin_status, CASE WHEN hr.status::text IN ('resolved','cancelled') THEN 'finished' ELSE 'pending' END) AS admin_status,
             COALESCE(u.full_name, 'Guest') AS submitted_by,
             u.email AS submitted_by_email, u.phone_number AS submitted_by_phone,
             CASE WHEN hr.is_guest_request THEN 'guest' ELSE 'user' END AS source
      ${joins} ${where}
      ORDER BY hr.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    const total = count.rows[0].total;
    return res.json({ requests: result.rows, total, page, pages: Math.ceil(total / limit) || 1 });
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
router.post('/new', requireInternal, async (req, res) => {
  try {
    const { request_id, emergency_type, urgency_level, ai_summary, message, lat, lng } = req.body;

    if (!request_id || !emergency_type) {
      return res.status(400).json({ error: 'request_id and emergency_type are required' });
    }

    const io = req.app.locals.io;
    if (io) {
      notifyNewRequest(io, {
        request_id,
        emergency_type,
        urgency_level: urgency_level || 3,
        message: message || null,
        lat: lat || null,
        lng: lng || null,
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

    const pool = req.app.locals.pool;
    let hospitals = [];
    if (pool) {
      const { rows } = await pool.query(
        `SELECT hospital_id, name, phone, specialization,
                has_cardiac_icu, has_trauma_unit,
                ST_Y(gps_location::geometry) AS latitude,
                ST_X(gps_location::geometry) AS longitude,
                ST_Distance(
                  gps_location::geography,
                  ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
                ) AS distance_meters
         FROM hospitals
         WHERE is_active = true
         ORDER BY distance_meters ASC
         LIMIT 15`,
        [parsedLat, parsedLng]
      );
      hospitals = rows.map((r) => ({
        hospital_id: String(r.hospital_id),
        name: r.name,
        phone: r.phone,
        specialization: r.specialization,
        has_cardiac_icu: Boolean(r.has_cardiac_icu),
        has_trauma_unit: Boolean(r.has_trauma_unit),
        latitude: parseFloat(r.latitude) || 0.0,
        longitude: parseFloat(r.longitude) || 0.0,
        distance_meters: parseFloat(r.distance_meters) || 0.0,
        distance_metres: parseFloat(r.distance_meters) || 0.0,
      }));
    }

    const typeStr = typeof emergency_type === 'string' ? emergency_type : 'medical';
    const payload = {
      lat: parsedLat,
      lng: parsedLng,
      emergency_type: typeStr,
      hospitals,
    };

    try {
      const response = await fetch(`${AI_SERVICE_URL}/api/ai/locate-resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    } catch (aiErr) {
      console.warn('AI locate-resources fallback:', aiErr.message);
    }

    return res.json({
      hospitals,
      recommendation: hospitals[0] || null,
      should_call_1990: ['medical', 'accident', 'fire'].includes(typeStr.toLowerCase()),
    });
  } catch (err) {
    console.error('GET /api/requests/locate error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required' });
  try {
    const pool = req.app.locals.pool;
    const requestResult = await pool.query(`
      SELECT hr.request_id, hr.emergency_type,
             CASE WHEN hr.emergency_type = 'donation' THEN 'donation' ELSE 'help' END AS request_type,
             hr.original_message, hr.created_at, hr.updated_at,
             COALESCE(hr.admin_status, CASE WHEN hr.status::text IN ('resolved','cancelled') THEN 'finished' ELSE 'pending' END) AS admin_status,
             hr.status,
             CASE WHEN hr.gps_location IS NULL THEN NULL ELSE json_build_object('lat', ST_Y(hr.gps_location::geometry), 'lng', ST_X(hr.gps_location::geometry)) END AS gps_location,
             COALESCE(u.full_name, 'Guest') AS submitted_by,
             u.email AS submitted_by_email, u.phone_number AS submitted_by_phone,
             hr.is_guest_request, hr.user_id, hr.guest_session_id
      FROM help_requests hr LEFT JOIN users u ON u.user_id = hr.user_id
      WHERE hr.request_id = $1`, [req.params.id]);
    if (!requestResult.rows.length) return res.status(404).json({ error: 'Request not found' });

    const request = requestResult.rows[0];
    const volunteerResult = await pool.query(`
      SELECT va.assignment_id, va.status, va.assigned_at, va.completed_at, va.hours_logged,
             va.updated_at, u.user_id, u.full_name, u.email, u.phone_number, u.avatar_url,
             rm.mission_id, rm.title AS mission_title, rm.status AS mission_status
      FROM volunteer_assignments va
      JOIN relief_missions rm ON rm.mission_id = va.mission_id
      LEFT JOIN users u ON u.user_id = va.user_id
      WHERE rm.origin_request_id = $1
      ORDER BY va.assigned_at DESC`, [req.params.id]);
    const donationResult = await pool.query(`
      SELECT d.donation_id, d.amount, d.status, d.transaction_ref, d.created_at, d.updated_at,
             u.user_id, u.full_name, u.email, u.phone_number, u.avatar_url,
             rm.mission_id, rm.title AS mission_title, rm.status AS mission_status
      FROM donations d
      LEFT JOIN users u ON u.user_id = d.donor_id
      LEFT JOIN relief_missions rm ON rm.mission_id = d.mission_id
      WHERE rm.origin_request_id = $1 OR d.mission_id IN (
        SELECT mission_id FROM relief_missions WHERE origin_request_id = $1
      )
      ORDER BY d.created_at DESC`, [req.params.id]);
    const missionResult = await pool.query(`
      SELECT * FROM relief_missions WHERE origin_request_id = $1 ORDER BY created_at DESC`, [req.params.id]);
    const historyResult = await pool.query(`
      SELECT history_id, old_status, new_status, changed_at, admin_id
      FROM request_status_history WHERE request_id = $1 ORDER BY changed_at DESC`, [req.params.id]);

    return res.json({
      ...request,
      participants: request.request_type === 'donation' ? donationResult.rows : volunteerResult.rows,
      accepting_users: request.request_type === 'donation' ? donationResult.rows : volunteerResult.rows,
      missions: missionResult.rows,
      status_history: historyResult.rows,
      timeline: historyResult.rows.map((item) => ({ status: item.new_status, timestamp: item.changed_at })),
    });
  } catch (err) {
    console.error('GET /api/requests/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch request' });
  }
});

router.patch('/:id/status', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required' });
  const status = req.body?.status;
  if (!ADMIN_REQUEST_STATUSES.has(status)) return res.status(400).json({ error: 'Status must be pending, in_progress, or finished' });
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT admin_status, status FROM help_requests WHERE request_id = $1 FOR UPDATE', [req.params.id]);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }
    const oldStatus = existing.rows[0].admin_status || 'pending';
    await client.query(`UPDATE help_requests SET admin_status=$1, status=CASE WHEN $1='finished' THEN status ELSE status END, resolved_at=CASE WHEN $1='finished' THEN NOW() ELSE resolved_at END, updated_at=NOW() WHERE request_id=$2`, [status, req.params.id]);
    await client.query(`INSERT INTO request_status_history(request_id, admin_id, old_status, new_status) VALUES($1,$2,$3,$4)`, [req.params.id, req.user.user_id || null, oldStatus, status]);
    await client.query('COMMIT');
    req.app.locals.io?.to('role:admin').emit('request_updated', { request_id: req.params.id, status });
    return res.json({ success: true, request_id: req.params.id, status });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PATCH /api/requests/:id/status error:', err.message);
    return res.status(500).json({ error: 'Failed to update request status' });
  } finally {
    client.release();
  }
});

module.exports = router;
