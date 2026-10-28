

const { verifyToken } = require('./middleware/auth');

function initSocket(io) {

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = verifyToken(token);
      socket.user = {
        user_id: decoded.user_id || decoded.sub,
        email: decoded.email || decoded.nic || 'anonymous',
        role: decoded.role || 'people',
      };
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.user.email} (${socket.user.role})`);

    socket.join(`role:${socket.user.role}`);
    if (socket.user.role === 'guest') {
      socket.join('role:people');
    }
    socket.join(`user:${socket.user.user_id}`);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.user.email}`);
    });
  });
}

function broadcastAlert(io, alert) {
  io.to('role:people').emit('alert_received', alert);
  io.to('role:people').emit('emergency_alert', alert);
  io.emit('emergency_alert', alert);
}

function notifyNewRequest(io, request) {
  // 1. Broadcast to admin dashboard
  io.to('role:admin').emit('new_request', request);

  // 2. Build user-facing alert payload for person-to-person notifications
  const isDonation = request.emergency_type === 'donation';
  const defaultDesc = isDonation
    ? 'New donation request submitted in your community.'
    : 'Emergency help & rescue request submitted nearby.';
  const description = request.message || request.ai_summary || defaultDesc;

  const alertPayload = {
    alert_id: request.request_id,
    disaster_type: request.emergency_type || (isDonation ? 'donation' : 'help_rescue'),
    severity: request.urgency_level || 3,
    description: description,
    work_plan: description,
    status: 'active',
    created_at: request.alerted_at || new Date().toISOString(),
    lat: request.lat,
    lng: request.lng,
  };

  // 3. Broadcast to all citizens (role:people) and all connected clients
  io.to('role:people').emit('new_request', request);
  io.to('role:people').emit('community_request', request);
  io.to('role:people').emit('emergency_alert', alertPayload);
  io.to('role:people').emit('alert_received', alertPayload);

  // Universal broadcast across all rooms to ensure reach
  io.emit('new_request', request);
  io.emit('emergency_alert', alertPayload);
  io.emit('alert_received', alertPayload);
}

module.exports = { initSocket, broadcastAlert, notifyNewRequest };
