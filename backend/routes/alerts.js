

const express = require('express');
const { requireAdmin, optionalAuth } = require('../middleware/auth');
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


const SRI_LANKA_DISTRICTS = {
  colombo: { minLng: 79.80, minLat: 6.75, maxLng: 80.22, maxLat: 7.05 },
  gampaha: { minLng: 79.82, minLat: 6.98, maxLng: 80.25, maxLat: 7.35 },
  kalutara: { minLng: 79.90, minLat: 6.45, maxLng: 80.35, maxLat: 6.78 },
  kandy: { minLng: 80.45, minLat: 7.10, maxLng: 80.95, maxLat: 7.55 },
  matale: { minLng: 80.45, minLat: 7.40, maxLng: 80.95, maxLat: 8.05 },
  'nuwara eliya': { minLng: 80.45, minLat: 6.75, maxLng: 80.98, maxLat: 7.18 },
  nuwaraeliya: { minLng: 80.45, minLat: 6.75, maxLng: 80.98, maxLat: 7.18 },
  galle: { minLng: 80.05, minLat: 5.95, maxLng: 80.50, maxLat: 6.45 },
  matara: { minLng: 80.40, minLat: 5.85, maxLng: 80.80, maxLat: 6.40 },
  hambantota: { minLng: 80.75, minLat: 6.05, maxLng: 81.65, maxLat: 6.55 },
  jaffna: { minLng: 79.85, minLat: 9.45, maxLng: 80.45, maxLat: 9.85 },
  kilinochchi: { minLng: 80.05, minLat: 9.20, maxLng: 80.65, maxLat: 9.60 },
  mannar: { minLng: 79.70, minLat: 8.70, maxLng: 80.30, maxLat: 9.20 },
  vavuniya: { minLng: 80.20, minLat: 8.55, maxLng: 80.75, maxLat: 9.10 },
  mullaitivu: { minLng: 80.35, minLat: 9.00, maxLng: 80.95, maxLat: 9.45 },
  batticaloa: { minLng: 81.30, minLat: 7.30, maxLng: 81.85, maxLat: 7.95 },
  ampara: { minLng: 81.40, minLat: 6.80, maxLng: 81.95, maxLat: 7.60 },
  trincomalee: { minLng: 80.85, minLat: 8.30, maxLng: 81.45, maxLat: 8.95 },
  kurunegala: { minLng: 79.80, minLat: 7.25, maxLng: 80.60, maxLat: 8.15 },
  puttalam: { minLng: 79.70, minLat: 7.50, maxLng: 80.20, maxLat: 8.55 },
  anuradhapura: { minLng: 80.05, minLat: 8.05, maxLng: 80.95, maxLat: 8.85 },
  polonnaruwa: { minLng: 80.70, minLat: 7.65, maxLng: 81.35, maxLat: 8.35 },
  badulla: { minLng: 80.85, minLat: 6.70, maxLng: 81.35, maxLat: 7.35 },
  monaragala: { minLng: 80.95, minLat: 6.35, maxLng: 81.65, maxLat: 7.25 },
  ratnapura: { minLng: 80.20, minLat: 6.30, maxLng: 80.95, maxLat: 6.95 },
  kegalle: { minLng: 80.10, minLat: 6.90, maxLng: 80.60, maxLat: 7.35 },
};

const PROVINCES = {
  western: ['colombo', 'gampaha', 'kalutara'],
  central: ['kandy', 'matale', 'nuwara eliya'],
  southern: ['galle', 'matara', 'hambantota'],
  northern: ['jaffna', 'kilinochchi', 'mannar', 'vavuniya', 'mullaitivu'],
  eastern: ['trincomalee', 'batticaloa', 'ampara'],
  'north western': ['kurunegala', 'puttalam'],
  wayamba: ['kurunegala', 'puttalam'],
  'north central': ['anuradhapura', 'polonnaruwa'],
  uva: ['badulla', 'monaragala'],
  sabaragamuwa: ['ratnapura', 'kegalle'],
};

function resolveZoneWKT(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.toUpperCase().startsWith('POLYGON') || trimmed.toUpperCase().startsWith('MULTIPOLYGON')) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  if (['all', 'nationwide', 'islandwide', 'sri lanka', 'srilanka', 'national', 'island-wide', 'entire country'].includes(lower)) {
    return null;
  }

  const tokens = lower.split(/[,;\n/]+/).map(t => t.trim()).filter(Boolean);
  const matchedBounds = [];

  for (const rawToken of tokens) {
    const token = rawToken.replace(/\s*(province|district)\s*$/i, '').trim();
    if (PROVINCES[token]) {
      for (const d of PROVINCES[token]) {
        if (SRI_LANKA_DISTRICTS[d]) matchedBounds.push(SRI_LANKA_DISTRICTS[d]);
      }
      continue;
    }
    if (SRI_LANKA_DISTRICTS[token]) {
      matchedBounds.push(SRI_LANKA_DISTRICTS[token]);
      continue;
    }
    for (const [distName, bounds] of Object.entries(SRI_LANKA_DISTRICTS)) {
      if (token.includes(distName) || distName.includes(token)) {
        matchedBounds.push(bounds);
        break;
      }
    }
  }

  if (matchedBounds.length === 0) {
    return null;
  }

  const minLng = Math.min(...matchedBounds.map(b => b.minLng));
  const minLat = Math.min(...matchedBounds.map(b => b.minLat));
  const maxLng = Math.max(...matchedBounds.map(b => b.maxLng));
  const maxLat = Math.max(...matchedBounds.map(b => b.maxLat));

  return `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`;
}

router.post('/', requireAdmin, async (req, res) => {
  try {
    const raw_disaster_type = req.body.disaster_type || req.body.disasterType;
    const zone_wkt = req.body.zone_wkt || req.body.affectedZone;
    const work_plan = req.body.work_plan || req.body.workPlan;
    const expires_hours = req.body.expires_hours !== undefined ? req.body.expires_hours : (req.body.expiresIn !== undefined ? req.body.expiresIn : 24);
    const severity = req.body.severity || 3;
    const is_draft = req.body.is_draft || false;

    const expNum = Number(expires_hours);
    const sevNum = Number(severity);
    if (!Number.isInteger(sevNum) || sevNum < 1 || sevNum > 5 ||
        !Number.isFinite(expNum) || expNum < 0 || expNum > 168) {
      return res.status(400).json({ error: 'Severity must be 1–5 and expiry 0–168 hours' });
    }
    if (!raw_disaster_type) {
      return res.status(400).json({ error: 'disaster_type is required' });
    }

    const disaster_type = mapEmergencyType(raw_disaster_type);
    const adminId = req.admin.admin_id;

    if (is_draft) {
      return res.status(400).json({ error: 'Draft alerts are not supported by the current database schema' });
    }

    const status = 'active';

    let expiresAt = null;
    if (expNum > 0) {
      expiresAt = new Date(Date.now() + expNum * 3600 * 1000);
    }

    // Resolve district names or direct WKT to a valid PostGIS polygon
    const cleanZone = zone_wkt && typeof zone_wkt === 'string' ? zone_wkt.trim() : '';
    const resolvedZone = resolveZoneWKT(cleanZone);
    const isWktPolygon = Boolean(resolvedZone);

    let insertQuery;
    let insertParams;

    if (isWktPolygon) {
      insertQuery = `
        INSERT INTO emergency_alerts (
          alert_id, admin_id, disaster_type, severity, work_plan, status, expires_at, delivered_count, affected_zone
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, ST_GeomFromText($8, 4326))
        RETURNING alert_id, disaster_type, severity, work_plan, status, created_at, expires_at
      `;
      insertParams = [adminId, disaster_type, sevNum, work_plan || null, status, expiresAt, 0, resolvedZone];
    } else {
      insertQuery = `
        INSERT INTO emergency_alerts (
          alert_id, admin_id, disaster_type, severity, work_plan, status, expires_at, delivered_count
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
        RETURNING alert_id, disaster_type, severity, work_plan, status, created_at, expires_at
      `;
      insertParams = [adminId, disaster_type, sevNum, work_plan || null, status, expiresAt, 0];
    }

    const { rows: alertRows } = await req.app.locals.pool.query(insertQuery, insertParams);
    const alert = alertRows[0];

    let appCount = 0;
    let smsCount = 0;

    // Dispatch notifications if not a draft
    if (!is_draft) {
      let userQuery = 'SELECT user_id, phone_number FROM users WHERE is_active=TRUE AND is_verified=TRUE';
      let userParams = [];

      if (isWktPolygon) {
        userQuery = `
          SELECT user_id, phone_number FROM users
          WHERE is_active=TRUE AND is_verified=TRUE AND gps_location IS NOT NULL
            AND ST_Within(gps_location, ST_GeomFromText($1, 4326))
        `;
        userParams = [resolvedZone];
      }

      let users = [];
      try {
        const { rows } = await req.app.locals.pool.query(userQuery, userParams);
        users = rows;
      } catch (qErr) {
        console.warn('Spatial targeting unavailable; notification audience remains empty');
        users = [];
      }

      appCount = 0; // Socket emit is not a confirmed handset delivery.

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
          broadcastAlert(io, broadcastPayload, isWktPolygon ? users.map(user => user.user_id) : undefined);
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
      delivery_confirmed: false,
      delivery_note: 'SMSlenz accepted messages for sending; handset delivery is not confirmed.',
    });
  } catch (err) {
    console.error('POST /api/alerts error:', err.message);
    return res.status(500).json({ error: 'Alert could not be created. Check the selected area and try again.' });
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

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'expired', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'A valid alert status is required' });
    }

    const alertCheck = await req.app.locals.pool.query(
      'SELECT alert_id FROM emergency_alerts WHERE alert_id = $1',
      [id]
    );
    if (alertCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const { rows } = await req.app.locals.pool.query(
      `UPDATE emergency_alerts
       SET status = $1, updated_at = NOW()
       WHERE alert_id = $2
       RETURNING alert_id, status, expires_at`,
      [status, id]
    );

    req.app.locals.io?.to('role:admin').emit('alert_updated', rows[0]);

    return res.json({ success: true, message: 'Alert updated' });
  } catch (err) {
    console.error('PATCH /api/alerts/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

