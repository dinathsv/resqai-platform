/**
 * ResQAI — Socket.IO Setup
 * Handles real-time alert broadcasting and auth via JWT.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'resqai-dev-secret-change-in-production';

/**
 * Initialize Socket.IO with authentication middleware.
 * @param {import('socket.io').Server} io
 */
function initSocket(io) {
  // ── Auth middleware ──────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = {
        user_id: decoded.user_id,
        email: decoded.email,
        role: decoded.role || 'people',
      };
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ──────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.user.email} (${socket.user.role})`);

    // Join role-based rooms
    socket.join(`role:${socket.user.role}`);
    socket.join(`user:${socket.user.user_id}`);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.user.email}`);
    });
  });
}

/**
 * Broadcast a new alert to all connected people.
 * @param {import('socket.io').Server} io
 * @param {object} alert — the alert row from the database
 */
function broadcastAlert(io, alert) {
  io.to('role:people').emit('alert_received', alert);
}

/**
 * Notify admins of a critical help request.
 * @param {import('socket.io').Server} io
 * @param {object} request — the help request data
 */
function notifyCriticalRequest(io, request) {
  io.to('role:admin').emit('critical_request', request);
}

module.exports = { initSocket, broadcastAlert, notifyCriticalRequest };
