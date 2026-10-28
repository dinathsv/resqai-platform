const express = require('express');
const { requireAdmin } = require('../middleware/auth');

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
      conditions.push("COALESCE(rm.mission_type, CASE WHEN EXISTS (SELECT 1 FROM donations d WHERE d.mission_id=rm.mission_id) THEN 'donation' ELSE 'help' END) = 'help'");
    } else if (filter === 'donation') {
      conditions.push("rm.status = 'active'");
      conditions.push("COALESCE(rm.mission_type, CASE WHEN EXISTS (SELECT 1 FROM donations d WHERE d.mission_id=rm.mission_id) THEN 'donation' ELSE 'help' END) = 'donation'");
    } else if (filter === 'completed') conditions.push("rm.status = 'completed'");
    else if (filter !== 'all') return res.status(400).json({ error: 'Invalid mission filter' });

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await req.app.locals.pool.query(`
      SELECT rm.*, hr.original_message, hr.request_id,
             COALESCE(u.full_name, 'Guest') AS requester_name,
             u.email AS requester_email, u.phone_number AS requester_phone,
             COALESCE(rm.mission_type, CASE WHEN EXISTS (SELECT 1 FROM donations d WHERE d.mission_id=rm.mission_id) THEN 'donation' ELSE 'help' END) AS mission_type,
             (SELECT COUNT(*)::int FROM volunteer_assignments va WHERE va.mission_id=rm.mission_id AND va.status IN ('accepted','active','completed')) AS volunteer_count,
             (SELECT COUNT(*)::int FROM donations d WHERE d.mission_id=rm.mission_id AND d.status IN ('pending','completed')) AS donation_count
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
  try {
    const pool = req.app.locals.pool;
    const missionResult = await pool.query(`
      SELECT rm.*, hr.request_id, hr.original_message, hr.created_at AS request_created_at,
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
      SELECT d.*, u.full_name, u.email, u.phone_number, u.avatar_url
      FROM donations d LEFT JOIN users u ON u.user_id=d.donor_id
      WHERE d.mission_id=$1 ORDER BY d.created_at DESC`, [req.params.id]);
    return res.json({ mission, participants: volunteers.rows, donations: donations.rows });
  } catch (err) {
    console.error('GET /api/missions/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch mission' });
  }
});

router.patch('/:id/status', async (req, res) => {
  const status = req.body?.status;
  if (!['planning','active','paused','completed','cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid mission status' });
  }
  try {
    const { rows } = await req.app.locals.pool.query(`
      UPDATE relief_missions SET status=$1, updated_at=NOW()
      WHERE mission_id=$2 RETURNING *`, [status, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Mission not found' });
    req.app.locals.io?.to('role:admin').emit('mission_updated', rows[0]);
    return res.json({ success: true, mission: rows[0] });
  } catch (err) {
    console.error('PATCH /api/missions/:id/status error:', err.message);
    return res.status(500).json({ error: 'Failed to update mission status' });
  }
});

module.exports = router;
