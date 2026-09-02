

const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT alert_id, disaster_type, severity,
             work_plan, status, created_at, expires_at, updated_at
      FROM emergency_alerts
      WHERE status = 'active'
    `;
    const params = [];

    if (status) {
      params.push(status);
      query = `
        SELECT alert_id, disaster_type, severity,
               work_plan, status, created_at, expires_at, updated_at
        FROM emergency_alerts
        WHERE status = $${params.length}
      `;
    }

    query += ' ORDER BY created_at DESC';

    const { rows } = await req.app.locals.pool.query(query, params);
    return res.json({ alerts: rows });
  } catch (err) {
    console.error('GET /api/alerts error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await req.app.locals.pool.query(
      `SELECT alert_id, disaster_type, severity,
              work_plan, status, created_at, expires_at, updated_at
       FROM emergency_alerts
       WHERE alert_id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    return res.json({ alert: rows[0] });
  } catch (err) {
    console.error('GET /api/alerts/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const alertCheck = await req.app.locals.pool.query(
      'SELECT alert_id FROM emergency_alerts WHERE alert_id = $1',
      [id]
    );
    if (alertCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await req.app.locals.pool.query(
      'UPDATE emergency_alerts SET status = $1, updated_at = NOW() WHERE alert_id = $2',
      [status, id]
    );

    return res.json({ success: true, message: 'Alert updated' });
  } catch (err) {
    console.error('PATCH /api/alerts/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
