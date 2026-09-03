

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || process.env.SECRET_KEY || 'supersecretkey_local';

const CANDIDATE_SECRETS = Array.from(
  new Set([
    process.env.JWT_SECRET,
    process.env.SECRET_KEY,
    'supersecretkey_local',
    'supersecretkey_jwt_local',
    'supersecretkey',
  ].filter(Boolean))
);

function verifyToken(token) {
  let lastError = null;
  for (const secret of CANDIDATE_SECRETS) {
    try {
      return jwt.verify(token, secret);
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

module.exports = { requireAuth, optionalAuth, signToken, verifyToken, JWT_SECRET };
