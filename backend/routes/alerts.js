

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { sendBulkSMS, sendSMS } = require('../services/smsService');

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      disaster_type,
      severity = 1,
      zone_wkt,
      work_plan,
      expires_hours = 24,
      is_draft = false,
    } = req.body;

    if (!disaster_type) {
      return res.status(400).json({ error: 'disaster_type is required' });
    }

    const adminId = req.user?.user_id || req.user?.sub || null;
    const status = is_draft ? 'draft' : 'active';

    let expiresAt = null;
    if (expires_hours && Number(expires_hours) > 0) {
      expiresAt = new Date(Date.now() + Number(expires_hours) * 3600 * 1000);
    }

    // Insert alert into PostgreSQL
    let insertQuery = `
      INSERT INTO emergency_alerts (
        admin_id, disaster_type, severity, work_plan, status, expires_at, delivered_count
        ${zone_wkt ? ', affected_zone' : ''}
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7 ${zone_wkt ? `, ST_GeomFromText($8, 4326)` : ''})
      RETURNING alert_id, disaster_type, severity, work_plan, status, created_at, expires_at
    `;
    const insertParams = [
      adminId,
      disaster_type,
      Number(severity),
      work_plan || null,
      status,
      expiresAt,
      0,
    ];
    if (zone_wkt) {
      insertParams.push(zone_wkt);
    }

    const { rows: alertRows } = await req.app.locals.pool.query(insertQuery, insertParams);
    const alert = alertRows[0];

    let appCount = 0;
    let smsCount = 0;

    // Only dispatch notifications if not a draft
    if (!is_draft) {
      // Find all active users with phone numbers
      let userQuery = 'SELECT user_id, phone_number FROM users';
      if (zone_wkt) {
        userQuery = `
          SELECT user_id, phone_number FROM users
          WHERE gps_location IS NOT NULL
            AND ST_Within(gps_location, ST_GeomFromText($1, 4326))
        `;
      }

      const { rows: users } = await req.app.locals.pool.query(
        userQuery,
        zone_wkt ? [zone_wkt] : []
      );
      appCount = users.length;

      const phoneContacts = users
        .map((u) => u.phone_number)
        .filter((p) => Boolean(p && String(p).trim()));

      if (phoneContacts.length > 0) {
        const smsMsg = `[ResQAI ALERT] ${disaster_type.toUpperCase()} (Severity ${severity}/5). ${
          work_plan || 'Emergency reported in your area. Follow civil defense instructions.'
        }`.slice(0, 1500);

        if (phoneContacts.length === 1) {
          const smsRes = await sendSMS(phoneContacts[0], smsMsg);
          smsCount = smsRes.success ? 1 : 0;
        } else {
          const smsRes = await sendBulkSMS(phoneContacts, smsMsg);
          smsCount = smsRes.delivered_count || (smsRes.success ? phoneContacts.length : 0);
        }
      }

      // Update delivered_count in DB
      await req.app.locals.pool.query(
        'UPDATE emergency_alerts SET delivered_count = $1 WHERE alert_id = $2',
        [appCount, alert.alert_id]
      );

      // Broadcast alert via Socket.IO
      const io = req.app.locals.io;
      if (io) {
        io.emit('emergency_alert', {
          alert_id: alert.alert_id,
          disaster_type: alert.disaster_type,
          severity: alert.severity,
          work_plan: alert.work_plan,
          created_at: alert.created_at,
        });
      }
    }

    return res.status(201).json({
      success: true,
      alert_id: alert.alert_id,
      alert,
      app_count: appCount,
      sms_count: smsCount,
    });
  } catch (err) {
    console.error('POST /api/alerts error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

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

