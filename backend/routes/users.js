const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Require authorization for all user management endpoints
router.use(requireAuth);

/**
 * GET /api/admin/users
 * Returns list of registered users with search and pagination support.
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;

    const pool = req.app.locals.pool;

    let countQuery = 'SELECT COUNT(*) AS total FROM users';
    let query = `
      SELECT 
        user_id,
        full_name,
        email,
        phone_number,
        COALESCE(user_type, 'Citizen') AS user_type,
        is_verified,
        COALESCE(is_active, true) AS is_active,
        created_at
      FROM users
    `;
    let queryParams = [];

    if (search) {
      countQuery += ' WHERE full_name ILIKE $1 OR email ILIKE $1 OR phone_number ILIKE $1';
      query += ' WHERE full_name ILIKE $1 OR email ILIKE $1 OR phone_number ILIKE $1';
      queryParams.push(search);
    }

    query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const countRes = await pool.query(countQuery, search ? [search] : []);
    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10);

    const { rows } = await pool.query(query, queryParams);

    const mappedUsers = rows.map((u) => ({
      user_id: u.user_id,
      id: u.user_id,
      full_name: u.full_name,
      name: u.full_name,
      email: u.email,
      phone_number: u.phone_number || '',
      phone: u.phone_number || '',
      user_type: u.user_type || 'Citizen',
      type: u.user_type || 'Citizen',
      role: u.user_type || 'Citizen',
      is_verified: Boolean(u.is_verified),
      verified: Boolean(u.is_verified),
      is_active: u.is_active !== false,
      created_at: u.created_at,
      joined: u.created_at,
    }));

    return res.json({
      users: mappedUsers,
      data: mappedUsers,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit) || 1,
    });
  } catch (err) {
    console.error('GET /api/admin/users error:', err);
    return res.status(500).json({ error: 'Failed to fetch users: ' + err.message });
  }
});

/**
 * GET /api/admin/users/:id
 * Fetches user details along with request history and donation history.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = req.app.locals.pool;

    const userRes = await pool.query(
      `SELECT 
        user_id, full_name, email, phone_number,
        COALESCE(user_type, 'Citizen') AS user_type,
        is_verified, COALESCE(is_active, true) AS is_active, created_at
       FROM users WHERE user_id = $1`,
      [id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = userRes.rows[0];

    const requestsRes = await pool.query(
      `SELECT request_id, emergency_type, urgency_level, status, created_at
       FROM help_requests
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    const donationsRes = await pool.query(
      `SELECT d.amount, d.status, d.created_at AS date, COALESCE(r.title, 'General Emergency Fund') AS mission_name
       FROM donations d
       LEFT JOIN relief_missions r ON d.mission_id = r.mission_id
       WHERE d.donor_id = $1
       ORDER BY d.created_at DESC`,
      [id]
    );

    const totalDonations = donationsRes.rows.reduce(
      (sum, row) => sum + (parseFloat(row.amount) || 0),
      0
    );

    return res.json({
      user_id: u.user_id,
      id: u.user_id,
      full_name: u.full_name,
      name: u.full_name,
      email: u.email,
      phone_number: u.phone_number || '',
      phone: u.phone_number || '',
      user_type: u.user_type,
      type: u.user_type,
      role: u.user_type,
      is_verified: Boolean(u.is_verified),
      verified: Boolean(u.is_verified),
      is_active: u.is_active !== false,
      created_at: u.created_at,
      joined: u.created_at,
      total_requests: requestsRes.rows.length,
      donations_made: totalDonations,
      quiz_attempts: 0,
      requests_history: requestsRes.rows,
      donation_history: donationsRes.rows,
    });
  } catch (err) {
    console.error(`GET /api/admin/users/${req.params.id} error:`, err);
    return res.status(500).json({ error: 'Failed to fetch user details: ' + err.message });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Updates user account state (e.g. suspend / activate).
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active, is_verified, user_type } = req.body;
    const pool = req.app.locals.pool;

    const updates = [];
    const values = [];
    let idx = 1;

    if (typeof is_active === 'boolean') {
      updates.push(`is_active = $${idx++}`);
      values.push(is_active);
    }
    if (typeof is_verified === 'boolean') {
      updates.push(`is_verified = $${idx++}`);
      values.push(is_verified);
    }
    if (typeof user_type === 'string') {
      updates.push(`user_type = $${idx++}`);
      values.push(user_type);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid update fields provided' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${idx} RETURNING *`;
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ message: 'User updated successfully', user: rows[0] });
  } catch (err) {
    console.error(`PATCH /api/admin/users/${req.params.id} error:`, err);
    return res.status(500).json({ error: 'Failed to update user: ' + err.message });
  }
});

/**
 * POST /api/admin/users/:id/resend-otp
 * Resends OTP for user verification.
 */
router.post('/:id/resend-otp', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = req.app.locals.pool;

    const { rows } = await pool.query('SELECT user_id, email, phone_number FROM users WHERE user_id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ message: 'OTP resent successfully', user_id: id });
  } catch (err) {
    console.error(`POST /api/admin/users/${req.params.id}/resend-otp error:`, err);
    return res.status(500).json({ error: 'Failed to resend OTP: ' + err.message });
  }
});

module.exports = router;
