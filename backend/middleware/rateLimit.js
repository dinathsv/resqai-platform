const { createHash } = require('node:crypto');

// Bounded per-instance protection. Deployment-wide limits should additionally be
// enforced at the edge when running multiple replicas.
function createRateLimiter({ limit = 10, windowMs = 15 * 60 * 1000, now = Date.now } = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const time = now();
    const identity = String(req.body?.email || req.ip || 'anonymous').trim().toLowerCase();
    const key = createHash('sha256').update(identity).digest('hex');
    let current = attempts.get(key);
    if (!current || current.expires <= time) {
      if (attempts.size >= 10000) {
        for (const [oldKey, oldValue] of attempts) if (oldValue.expires <= time) attempts.delete(oldKey);
        if (attempts.size >= 10000) return res.status(429).json({ error: 'Authentication is busy. Please try again later.' });
      }
      current = { count: 0, expires: time + windowMs };
      attempts.set(key, current);
    }
    current.count++;
    if (current.count > limit) {
      res.setHeader('Retry-After', String(Math.ceil((current.expires - time) / 1000)));
      return res.status(429).json({ error: 'Too many authentication attempts. Try again later.' });
    }
    next();
  };
}
module.exports = { createRateLimiter };
