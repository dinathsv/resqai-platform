

const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await req.app.locals.pool.query(
      'SELECT user_id, full_name, email, phone_number, language_pref FROM users WHERE user_id = $1',
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
    });
  } catch (err) {
    console.error('GET /api/auth/me error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
