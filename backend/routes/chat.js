const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { emitToActiveAdmins } = require('../socket');

const router = express.Router();
router.use(requireAdmin);

// One shared operations room. History is persisted before any socket event.
router.get('/', async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const before = req.query.before;
  if (before && (typeof before !== 'string' || Number.isNaN(Date.parse(before)))) return res.status(400).json({ error: 'Invalid history timestamp' });
  try {
    const { rows } = await req.app.locals.pool.query(`
      SELECT m.message_id, m.message_text, m.sent_at, m.channel_id,
             a.full_name AS sender, a.agency, a.district
      FROM agency_chat_messages m JOIN administrators a ON a.admin_id=m.sender_id
      WHERE m.channel_id=1 AND ($1::timestamptz IS NULL OR m.sent_at < $1)
      ORDER BY m.sent_at DESC, m.message_id DESC LIMIT $2`, [before || null, limit]);
    return res.json({ messages: rows.reverse(), has_more: rows.length === limit });
  } catch (err) {
    console.error('Chat history failed:', err.message);
    return res.status(500).json({ error: 'Unable to load agency messages' });
  }
});

router.post('/', async (req, res) => {
  const message = req.body?.message_text;
  if (typeof message !== 'string' || !message.trim() || message.trim().length > 2000) return res.status(400).json({ error: 'A message between 1 and 2000 characters is required' });
  if (req.body.channel_id !== undefined && req.body.channel_id !== 1) return res.status(400).json({ error: 'Unknown operations channel' });
  try {
    const { rows } = await req.app.locals.pool.query(`
      WITH saved AS (
        INSERT INTO agency_chat_messages(sender_id, channel_id, message_text)
        VALUES ($1, 1, $2) RETURNING message_id, sender_id, message_text, sent_at, channel_id
      )
      SELECT s.message_id, s.message_text, s.sent_at, s.channel_id,
             a.full_name AS sender, a.agency, a.district
      FROM saved s JOIN administrators a ON a.admin_id=s.sender_id`, [req.user.user_id, message.trim()]);
    await emitToActiveAdmins(req.app.locals.io, 'agency_message', rows[0], req.app.locals.pool);
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Chat send failed:', err.message);
    return res.status(500).json({ error: 'Message was not saved. Please retry' });
  }
});

module.exports = router;
