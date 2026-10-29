const express = require('express');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Require admin authorization for all guest verification endpoints
router.use(requireAdmin);

/**
 * GET /api/admin/guests
 * List guest sessions for NIC verification and approval
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;
    const filterStatus = req.query.status && ['pending', 'approved', 'rejected'].includes(req.query.status)
      ? req.query.status
      : null;

    const pool = req.app.locals.pool;

    // Fetch stats for all status types
    const statsQuery = `
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE admin_status = 'pending' OR admin_status IS NULL) AS pending,
        COUNT(*) FILTER (WHERE admin_status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE admin_status = 'rejected') AS rejected
      FROM guest_sessions
    `;
    const statsRes = await pool.query(statsQuery);
    const statsRow = statsRes.rows[0] || {};
    const stats = {
      total: parseInt(statsRow.total || '0', 10),
      pending: parseInt(statsRow.pending || '0', 10),
      approved: parseInt(statsRow.approved || '0', 10),
      rejected: parseInt(statsRow.rejected || '0', 10),
    };

    // Build filter where clauses
    let whereClauses = [];
    let queryParams = [];

    if (search) {
      queryParams.push(search);
      whereClauses.push(`(nic_number ILIKE $${queryParams.length} OR phone_number ILIKE $${queryParams.length})`);
    }

    if (filterStatus) {
      queryParams.push(filterStatus);
      whereClauses.push(`admin_status = $${queryParams.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count query
    const countQuery = `SELECT COUNT(*) AS total FROM guest_sessions ${whereSql}`;
    const countRes = await pool.query(countQuery, queryParams);
    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10);

    // Data query
    const dataQuery = `
      SELECT 
        session_id,
        nic_number,
        nic_photo,
        nic_verified,
        nic_format_valid,
        phone_number,
        phone_verified,
        COALESCE(admin_status, 'pending') AS admin_status,
        admin_reviewed_at,
        admin_notes,
        created_at,
        expires_at
      FROM guest_sessions
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    const { rows } = await pool.query(dataQuery, [...queryParams, limit, offset]);

    return res.json({
      guests: rows,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      page,
      limit,
      stats,
    });
  } catch (err) {
    console.error('GET /api/admin/guests error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve guest sessions' });
  }
});

/**
 * PATCH /api/admin/guests/:id/status
 * Approve or reject guest user NIC verification
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status: newStatus, notes } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(newStatus)) {
      return res.status(400).json({ error: 'Status must be approved, rejected, or pending' });
    }

    const pool = req.app.locals.pool;

    const updateQuery = `
      UPDATE guest_sessions
      SET 
        admin_status = $1,
        admin_reviewed_at = NOW(),
        admin_notes = $2,
        updated_at = NOW()
      WHERE session_id = $3
      RETURNING 
        session_id,
        nic_number,
        nic_photo,
        nic_verified,
        phone_number,
        phone_verified,
        admin_status,
        admin_reviewed_at,
        admin_notes,
        created_at
    `;

    const { rows } = await pool.query(updateQuery, [newStatus, notes || null, id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Guest session not found' });
    }

    return res.json({
      success: true,
      guest: rows[0],
      message: `Guest user verification status updated to ${newStatus}`,
    });
  } catch (err) {
    console.error('PATCH /api/admin/guests/:id/status error:', err.message);
    return res.status(500).json({ error: 'Failed to update guest verification status' });
  }
});

module.exports = router;
