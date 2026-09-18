

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
  // Broadcast to admin dashboard
  io.to('role:admin').emit('new_request', request);
  
  // If it's a critical request (urgency >= 4), broadcast emergency alert to all users
  if (request.urgency_level >= 4) {
    io.to('role:people').emit('emergency_alert', {
      alert_id: request.request_id,
      disaster_type: request.emergency_type,
      description: request.ai_summary || 'Critical emergency reported in the area.',
    });
  }
}

module.exports = { initSocket, broadcastAlert, notifyNewRequest };
