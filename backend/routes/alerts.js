/**
 * ResQAI — Alerts Routes
 * GET  /api/alerts          — list active alerts
 * GET  /api/alerts/:id      — single alert detail
 * PATCH /api/alerts/:id/acknowledge — acknowledge an alert
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/alerts
 * Returns all active alerts, newest first.
 * Optional query param: ?district=Colombo
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { district } = req.query;
    let query = `
      SELECT alert_id, disaster_type, severity, district,
             zone_description, work_plan, is_active, created_at, updated_at
      FROM alerts
      WHERE is_active = TRUE
    `;
    const params = [];

    if (district) {
      params.push(district);
      query += ` AND district = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const { rows } = await req.app.locals.pool.query(query, params);
    return res.json({ alerts: rows });
  } catch (err) {
    console.error('GET /api/alerts error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/alerts/:id
 * Returns a single alert with full detail.
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await req.app.locals.pool.query(
      `SELECT alert_id, disaster_type, severity, district,
              zone_description, work_plan, is_active, created_at, updated_at
       FROM alerts
       WHERE alert_id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Check if current user has acknowledged
    const ackResult = await req.app.locals.pool.query(
      'SELECT acknowledged_at FROM alert_acknowledgements WHERE alert_id = $1 AND user_id = $2',
      [id, req.user.user_id]
    );

    const alert = rows[0];
    alert.acknowledged = ackResult.rows.length > 0;
    alert.acknowledged_at = ackResult.rows[0]?.acknowledged_at || null;

    return res.json({ alert });
  } catch (err) {
    console.error('GET /api/alerts/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/alerts/:id/acknowledge
 * Mark the current user as having acknowledged this alert.
 */
router.patch('/:id/acknowledge', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify alert exists
    const alertCheck = await req.app.locals.pool.query(
      'SELECT alert_id FROM alerts WHERE alert_id = $1',
      [id]
    );
    if (alertCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Upsert acknowledgement
    await req.app.locals.pool.query(
      `INSERT INTO alert_acknowledgements (alert_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (alert_id, user_id) DO NOTHING`,
      [id, req.user.user_id]
    );

    return res.json({ success: true, message: 'Alert acknowledged' });
  } catch (err) {
    console.error('PATCH /api/alerts/:id/acknowledge error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
