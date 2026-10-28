

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || process.env.SECRET_KEY || '';

const CANDIDATE_SECRETS = Array.from(
  new Set([
    process.env.JWT_SECRET,
    process.env.SECRET_KEY,
  ].filter(Boolean))
);

function verifyToken(token) {
  let lastError = null;
  for (const secret of CANDIDATE_SECRETS) {
    try {
      const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
      if (!decoded || typeof decoded !== 'object' || !(decoded.sub || decoded.user_id)) {
        throw new Error('Missing token subject');
      }
      return decoded;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Invalid or expired token');
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = {
      user_id: decoded.user_id || decoded.sub,
      email: decoded.email,
      role: decoded.role || 'people',
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = header.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = {
      user_id: decoded.user_id || decoded.sub,
      email: decoded.email,
      role: decoded.role || 'people',
    };
  } catch {
    req.user = null;
  }
  next();
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function requireAdmin(req, res, next) {
  return requireAuth(req, res, async () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required' });
    }
    try {
      const { rows } = await req.app.locals.pool.query(
        'SELECT admin_id FROM administrators WHERE admin_id = $1 AND is_active = TRUE',
        [req.user.user_id],
      );
      if (!rows.length) {
        return res.status(403).json({ error: 'Administrator account unavailable' });
      }
      req.admin = rows[0];
      return next();
    } catch {
      return res.status(503).json({ error: 'Authentication service unavailable' });
    }
  });
}

module.exports = { requireAuth, requireAdmin, optionalAuth, signToken, verifyToken, JWT_SECRET };
