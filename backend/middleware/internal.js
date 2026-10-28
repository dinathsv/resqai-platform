const { timingSafeEqual } = require('node:crypto');

function requireInternal(req, res, next) {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected || expected.length < 32) {
    return res.status(503).json({ error: 'Internal notifications are not configured' });
  }
  const provided = req.get('X-Internal-API-Key') || '';
  const actual = Buffer.from(provided);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    return res.status(401).json({ error: 'Internal authentication required' });
  }
  return next();
}

module.exports = { requireInternal };
