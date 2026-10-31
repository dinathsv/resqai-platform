const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { UUID_PATTERN } = require('../services/requestWorkflow');
const { emitToActiveAdmins } = require('../socket');

const router = express.Router();
router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const filter = typeof req.query.filter === 'string' ? req.query.filter.trim() : 'active';
    const conditions = [];
    const params = [];

    if (filter === 'active') conditions.push("rm.status = 'active'");
    else if (filter === 'help') {
      conditions.push("rm.status = 'active'");
      conditions.push("rm.mission_type = 'help'");
    } else if (filter === 'donation') {
      conditions.push("rm.status = 'active'");
      conditions.push("rm.mission_type = 'donation'");
    } else if (filter === 'completed') conditions.push("rm.status = 'completed'");
    else if (filter !== 'all') return res.status(400).json({ error: 'Invalid mission filter' });

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await req.app.locals.pool.query(`
      SELECT rm.mission_id, rm.title, rm.description, rm.status, rm.created_at, rm.origin_request_id,
             hr.original_message, hr.request_id, hr.verification_status,
             COALESCE(u.full_name, 'Guest') AS requester_name,
             u.email AS requester_email, u.phone_number AS requester_phone,
             rm.mission_type,
             (SELECT COUNT(*)::int FROM volunteer_assignments va WHERE va.mission_id=rm.mission_id AND va.status IN ('accepted','active','completed')) AS volunteer_count,
             (SELECT COUNT(*)::int FROM donations d WHERE d.mission_id=rm.mission_id AND d.need_id IS NOT NULL AND d.goods_status!='cancelled') AS donation_count
      FROM relief_missions rm
      LEFT JOIN help_requests hr ON hr.request_id = rm.origin_request_id
      LEFT JOIN users u ON u.user_id = hr.user_id
      ${where}
      ORDER BY rm.created_at DESC`, params);
    return res.json({ missions: rows });
  } catch (err) {
    console.error('GET /api/missions error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch missions' });
  }
});

router.get('/:id', async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) return res.status(400).json({ error: 'Invalid mission id' });
  try {
    const pool = req.app.locals.pool;
    const missionResult = await pool.query(`
      SELECT rm.mission_id, rm.title, rm.description, rm.status, rm.created_at, rm.mission_type,
             hr.request_id, hr.original_message, hr.created_at AS request_created_at, hr.verification_status,
             hr.emergency_type, hr.status AS legacy_request_status,
             COALESCE(hr.admin_status, CASE WHEN hr.status::text IN ('resolved','cancelled') THEN 'finished' ELSE 'pending' END) AS request_status,
             COALESCE(u.full_name, 'Guest') AS requester_name, u.email AS requester_email, u.phone_number AS requester_phone
      FROM relief_missions rm
      LEFT JOIN help_requests hr ON hr.request_id = rm.origin_request_id
      LEFT JOIN users u ON u.user_id = hr.user_id
      WHERE rm.mission_id=$1`, [req.params.id]);
    if (!missionResult.rows.length) return res.status(404).json({ error: 'Mission not found' });

    const mission = missionResult.rows[0];
    const volunteers = await pool.query(`
      SELECT va.*, u.full_name, u.email, u.phone_number, u.avatar_url
      FROM volunteer_assignments va LEFT JOIN users u ON u.user_id=va.user_id
      WHERE va.mission_id=$1 ORDER BY va.assigned_at DESC`, [req.params.id]);
    const donations = await pool.query(`
      SELECT d.donation_id, d.quantity, d.goods_status AS status, d.received_quantity,
             d.dispatched_quantity, d.delivered_quantity, d.created_at, n.item_name, n.unit,
             u.full_name, u.email, u.phone_number, u.avatar_url
      FROM donations d JOIN mission_needs n ON n.need_id=d.need_id LEFT JOIN users u ON u.user_id=d.donor_id
      WHERE d.mission_id=$1 ORDER BY d.created_at DESC`, [req.params.id]);
    const history = await pool.query(`SELECT h.*,a.full_name AS reviewer_name FROM mission_status_history h
      LEFT JOIN administrators a ON a.admin_id=h.admin_id WHERE mission_id=$1 ORDER BY changed_at DESC`, [req.params.id]);
    return res.json({ mission, participants: volunteers.rows, donations: donations.rows, history: history.rows });
  } catch (err) {
    console.error('GET /api/missions/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch mission' });
  }
});

router.patch('/:id/status', async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) return res.status(400).json({ error: 'Invalid mission id' });
  const status = req.body?.status;
  const reason = req.body?.reason;
  if (!['planning','active','paused','completed','cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid mission status' });
  }
  if (typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 2000) return res.status(400).json({ error: 'Record a reason between 10 and 2000 characters' });
  let client;
  try {
    client = await req.app.locals.pool.connect();
    await client.query('BEGIN');
    const initial = await client.query('SELECT origin_request_id FROM relief_missions WHERE mission_id=$1', [req.params.id]);
    if (!initial.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Mission not found' }); }
    const originatingRequest = initial.rows[0].origin_request_id
      ? (await client.query('SELECT verification_status, status, admin_status FROM help_requests WHERE request_id=$1 FOR UPDATE', [initial.rows[0].origin_request_id])).rows[0]
      : null;
    const result = await client.query('SELECT mission_id, status, mission_type, origin_request_id FROM relief_missions WHERE mission_id=$1 FOR UPDATE', [req.params.id]);
    if (!result.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Mission not found' }); }
    const mission = result.rows[0];
    const transitions = { planning: ['active','cancelled'], active: ['paused','completed','cancelled'], paused: ['active','cancelled'], completed: [], cancelled: [] };
    if (mission.status === status) { await client.query('COMMIT'); return res.json({ success: true, mission }); }
    if (!transitions[mission.status]?.includes(status)) { await client.query('ROLLBACK'); return res.status(409).json({ error: `Cannot change ${mission.status} to ${status}` }); }
    if (mission.mission_type === 'donation') {
      if (['active','completed'].includes(status) && (originatingRequest?.verification_status !== 'verified' || originatingRequest.admin_status === 'finished' || ['resolved','cancelled'].includes(originatingRequest.status))) {
        await client.query('ROLLBACK'); return res.status(409).json({ error: 'Confirm the originating request before activating or completing goods fulfillment' });
      }
      if (['completed','cancelled'].includes(status)) {
        await client.query('SELECT need_id FROM mission_needs WHERE mission_id=$1 ORDER BY need_id FOR UPDATE', [req.params.id]);
        const outstanding = await client.query(`SELECT
          EXISTS(SELECT 1 FROM goods_deliveries gd JOIN donations d ON d.donation_id=gd.donation_id WHERE d.mission_id=$1 AND gd.status IN ('dispatched','disputed')) AS unsettled,
          EXISTS(SELECT 1 FROM mission_needs n WHERE n.mission_id=$1 AND n.required_quantity > COALESCE((SELECT SUM(d.delivered_quantity) FROM donations d WHERE d.need_id=n.need_id AND d.goods_status!='cancelled'),0)) AS incomplete,
          EXISTS(SELECT 1 FROM mission_needs WHERE mission_id=$1) AS has_needs,
          EXISTS(SELECT 1 FROM donations WHERE mission_id=$1 AND need_id IS NOT NULL AND goods_status!='cancelled' AND received_quantity>delivered_quantity) AS stock_remaining`, [req.params.id]);
        const state = outstanding.rows[0];
        if (state.unsettled || state.stock_remaining || (status === 'completed' && (state.incomplete || !state.has_needs))) {
          await client.query('ROLLBACK'); return res.status(409).json({ error: 'Resolve outstanding stock and deliveries; every requested quantity must be confirmed before completion' });
        }
      }
    } else if (status === 'completed') {
      const assignments = await client.query(`SELECT COUNT(*) FILTER (WHERE status='completed' AND
        (recipient_confirmed_at IS NOT NULL OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND LENGTH(TRIM(COALESCE(completion_review_reason,'')))>0)))::int AS completed,
        COUNT(*) FILTER (WHERE status::text NOT IN ('completed','withdrawn') OR (status='completed' AND
        recipient_confirmed_at IS NULL AND (reviewed_by IS NULL OR reviewed_at IS NULL OR LENGTH(TRIM(COALESCE(completion_review_reason,'')))=0)))::int AS outstanding
        FROM volunteer_assignments WHERE mission_id=$1`, [req.params.id]);
      if (!assignments.rows[0].completed || assignments.rows[0].outstanding) {
        await client.query('ROLLBACK'); return res.status(409).json({ error: 'Review and complete the volunteer assignments before closing the mission' });
      }
    }
    const { rows } = await client.query(`UPDATE relief_missions SET status=$1, updated_at=NOW()
      WHERE mission_id=$2 RETURNING mission_id,title,status,mission_type`, [status, req.params.id]);
    await client.query(`INSERT INTO mission_status_history(mission_id,admin_id,old_status,new_status,notes) VALUES($1,$2,$3,$4,$5)`, [req.params.id,req.user.user_id,mission.status,status,reason.trim()]);
    await client.query(`INSERT INTO audit_logs(admin_id,action,entity_type,entity_id) VALUES($1,$2,'relief_mission',$3)`, [req.user.user_id,`mission_status:${mission.status}:${status}`,req.params.id]);
    await client.query('COMMIT');
    await emitToActiveAdmins(req.app.locals.io, 'mission_updated', rows[0], client);
    return res.json({ success: true, mission: rows[0] });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('PATCH /api/missions/:id/status error:', err.message);
    return res.status(500).json({ error: 'Failed to update mission status' });
  } finally { client?.release(); }
});

module.exports = router;
