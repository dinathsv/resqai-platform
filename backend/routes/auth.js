

const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await req.app.locals.pool.query(
      'SELECT user_id, full_name, email, phone_number, language_pref, avatar_url FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    return res.json({
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      phone_number: user.phone_number,
      language_pref: user.language_pref,
      avatar_url: user.avatar_url,
    });
  } catch (err) {
    console.error('GET /api/auth/me error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { full_name, avatar_url, phone_number } = req.body;
    const updates = [];
    const params = [];

    if (full_name) {
      params.push(full_name.trim());
      updates.push(`full_name = $${params.length}`);
    }
    if (avatar_url !== undefined) {
      params.push(avatar_url);
      updates.push(`avatar_url = $${params.length}`);
    }
    if (phone_number !== undefined) {
      params.push(phone_number);
      updates.push(`phone_number = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    params.push(req.user.user_id);
    const query = `
      UPDATE users
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE user_id = $${params.length}
      RETURNING user_id, full_name, email, phone_number, language_pref, avatar_url
    `;

    const { rows } = await req.app.locals.pool.query(query, params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/auth/me error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
