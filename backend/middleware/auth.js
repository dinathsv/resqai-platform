/**
 * ResQAI — JWT Authentication Middleware
 * Verifies Bearer token and attaches user info to req.user
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'resqai-dev-secret-change-in-production';

/**
 * Middleware: require a valid JWT in the Authorization header.
 * Sets req.user = { user_id, email, role }
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role || 'people',
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth — sets req.user if token present, otherwise continues.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role || 'people',
    };
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Generate a JWT for a user.
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { requireAuth, optionalAuth, signToken, JWT_SECRET };
