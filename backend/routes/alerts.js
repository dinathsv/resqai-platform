

const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { sendBulkSMS, sendSMS } = require('../services/smsService');

const router = express.Router();

function mapEmergencyType(typeStr) {
  if (!typeStr) return 'other';
  const lower = String(typeStr).trim().toLowerCase();
  const validTypes = [
    'flood',
    'landslide',
    'tsunami',
    'earthquake',
    'fire',
    'medical',
    'search_and_rescue',
    'infrastructure_damage',
    'hazardous_material',
    'other',
  ];
  if (validTypes.includes(lower)) return lower;
  if (lower === 'accident') return 'search_and_rescue';
  return 'other';
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const raw_disaster_type = req.body.disaster_type || req.body.disasterType;
    const zone_wkt = req.body.zone_wkt || req.body.affectedZone;
    const work_plan = req.body.work_plan || req.body.workPlan;
    const expires_hours = req.body.expires_hours || req.body.expiresIn || 24;
    const severity = req.body.severity || 3;
    const is_draft = req.body.is_draft || false;

    if (!raw_disaster_type) {
      return res.status(400).json({ error: 'disaster_type is required' });
    }

    const disaster_type = mapEmergencyType(raw_disaster_type);

    // Resolve valid admin_id or fallback to existing admin ID if foreign key mismatch
    let adminId = req.user?.user_id || req.user?.sub || null;
    try {
      if (adminId) {
        const adminCheck = await req.app.locals.pool.query(
          'SELECT admin_id FROM administrators WHERE admin_id = $1',
          [adminId]
        );
        if (adminCheck.rows.length === 0) {
          const firstAdmin = await req.app.locals.pool.query('SELECT admin_id FROM administrators LIMIT 1');
          if (firstAdmin.rows.length > 0) {
            adminId = firstAdmin.rows[0].admin_id;
          } else {
            const newAdmin = await req.app.locals.pool.query(
              `INSERT INTO administrators (full_name, email, agency, district, password_hash)
               VALUES ('System Admin', 'admin@resqai.lk', 'DMC', 'Colombo', 'hash')
               ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
               RETURNING admin_id`
            );
            adminId = newAdmin.rows[0].admin_id;
          }
        }
      } else {
        const firstAdmin = await req.app.locals.pool.query('SELECT admin_id FROM administrators LIMIT 1');
        if (firstAdmin.rows.length > 0) {
          adminId = firstAdmin.rows[0].admin_id;
        } else {
          const newAdmin = await req.app.locals.pool.query(
            `INSERT INTO administrators (full_name, email, agency, district, password_hash)
             VALUES ('System Admin', 'admin@resqai.lk', 'DMC', 'Colombo', 'hash')
             ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
             RETURNING admin_id`
          );
          adminId = newAdmin.rows[0].admin_id;
        }
      }
    } catch (aErr) {
      console.warn('Admin ID lookup failed:', aErr.message);
      adminId = null;
    }

    const status = is_draft ? 'draft' : 'active';

    let expiresAt = null;
    if (expires_hours && Number(expires_hours) > 0) {
      expiresAt = new Date(Date.now() + Number(expires_hours) * 3600 * 1000);
    }

    // Check if zone_wkt is a valid WKT polygon
    const cleanZone = zone_wkt && typeof zone_wkt === 'string' ? zone_wkt.trim() : '';
    const isWktPolygon = Boolean(
      cleanZone &&
      (cleanZone.toUpperCase().startsWith('POLYGON') || cleanZone.toUpperCase().startsWith('MULTIPOLYGON'))
    );

    let insertQuery;
    let insertParams;

    if (isWktPolygon) {
      insertQuery = `
        INSERT INTO emergency_alerts (
          admin_id, disaster_type, severity, work_plan, status, expires_at, delivered_count, affected_zone
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeomFromText($8, 4326))
        RETURNING alert_id, disaster_type, severity, work_plan, status, created_at, expires_at
      `;
      insertParams = [adminId, disaster_type, Number(severity) || 3, work_plan || null, status, expiresAt, 0, cleanZone];
    } else {
      insertQuery = `
        INSERT INTO emergency_alerts (
          admin_id, disaster_type, severity, work_plan, status, expires_at, delivered_count
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING alert_id, disaster_type, severity, work_plan, status, created_at, expires_at
      `;
      insertParams = [adminId, disaster_type, Number(severity) || 3, work_plan || null, status, expiresAt, 0];
    }

    const { rows: alertRows } = await req.app.locals.pool.query(insertQuery, insertParams);
    const alert = alertRows[0];

    let appCount = 0;
    let smsCount = 0;

    // Dispatch notifications if not a draft
    if (!is_draft) {
      let userQuery = 'SELECT user_id, phone_number FROM users';
      let userParams = [];

      if (isWktPolygon) {
        userQuery = `
          SELECT user_id, phone_number FROM users
          WHERE gps_location IS NOT NULL
            AND ST_Within(gps_location, ST_GeomFromText($1, 4326))
        `;
        userParams = [cleanZone];
      }

      let users = [];
      try {
        const { rows } = await req.app.locals.pool.query(userQuery, userParams);
        users = rows;
      } catch (qErr) {
        console.warn('WKT Spatial Query failed, falling back to all users:', qErr.message);
        const { rows } = await req.app.locals.pool.query('SELECT user_id, phone_number FROM users');
        users = rows;
      }

      appCount = users.length;

      const phoneContacts = users
        .map((u) => u.phone_number)
        .filter((p) => Boolean(p && String(p).trim()));

      if (phoneContacts.length > 0) {
        const zoneText = cleanZone ? ` [Zone: ${cleanZone}]` : '';
        const smsMsg = `[ResQAI ALERT] ${disaster_type.toUpperCase()}${zoneText}. ${
          work_plan || 'Emergency reported in your area. Follow civil defense instructions.'
        }`.slice(0, 1500);

        try {
          if (phoneContacts.length === 1) {
            const smsRes = await sendSMS(phoneContacts[0], smsMsg);
            smsCount = smsRes.success ? 1 : 0;
          } else {
            const smsRes = await sendBulkSMS(phoneContacts, smsMsg);
            smsCount = smsRes.delivered_count || (smsRes.success ? phoneContacts.length : 0);
          }
        } catch (smsErr) {
          console.warn('SMS delivery warning:', smsErr.message);
        }
      }

      // Update delivered_count in DB
      await req.app.locals.pool.query(
        'UPDATE emergency_alerts SET delivered_count = $1 WHERE alert_id = $2',
        [appCount, alert.alert_id]
      );

      // Broadcast alert to all clients via Socket.IO
      const io = req.app.locals.io;
      if (io) {
        const broadcastPayload = {
          alert_id: alert.alert_id,
          disaster_type: alert.disaster_type,
          affected_zone: cleanZone || null,
          work_plan: alert.work_plan,
          created_at: alert.created_at,
          expires_at: alert.expires_at,
          status: alert.status,
        };
        const { broadcastAlert } = require('../socket');
        if (broadcastAlert) {
          broadcastAlert(io, broadcastPayload);
        } else {
          io.to('role:people').emit('alert_received', broadcastPayload);
          io.to('role:people').emit('emergency_alert', broadcastPayload);
          io.emit('emergency_alert', broadcastPayload);
        }
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

router.get('/', optionalAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT alert_id, disaster_type, severity,
             work_plan, status, created_at, expires_at, updated_at
      FROM emergency_alerts
    `;
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      query += ` WHERE status = $${params.length}`;
    } else if (!status) {
      query += ` WHERE status = 'active'`;
    }
    // If status === 'all', return all alerts without status filter

    query += ' ORDER BY created_at DESC';

    const { rows } = await req.app.locals.pool.query(query, params);
    return res.json({ alerts: rows });
  } catch (err) {
    console.error('GET /api/alerts error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
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

