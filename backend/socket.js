const { verifyToken } = require('./middleware/auth');
const socketPools = new WeakMap();

async function activeSocketAccount(pool, user) {
  if (!user?.user_id || !Number.isFinite(user.exp) || user.exp * 1000 <= Date.now()) return false;
  let result;
  if (user.role === 'admin') result = await pool.query('SELECT admin_id FROM administrators WHERE admin_id=$1 AND is_active=TRUE', [user.user_id]);
  else if (user.role === 'people') result = await pool.query('SELECT user_id FROM users WHERE user_id=$1 AND is_active=TRUE AND is_verified=TRUE', [user.user_id]);
  else if (user.role === 'guest') result = await pool.query("SELECT session_id FROM guest_sessions WHERE session_id=$1 AND expires_at>NOW() AND admin_status!='rejected'", [user.user_id]);
  else return false;
  return result.rows.length > 0;
}

// Authentication is rechecked for each sensitive broadcast, including sockets
// established before an administrator was disabled. Fail closed on DB outages.
async function emitToActiveAdmins(io, event, payload, pool = socketPools.get(io)) {
  if (!io || !pool) return 0;
  try {
    const sockets = await io.in('role:admin').fetchSockets();
    if (!sockets.length) return 0;
    const ids = [...new Set(sockets.map(socket => (socket.data?.user || socket.user)?.user_id).filter(Boolean))];
    const { rows } = await pool.query('SELECT admin_id FROM administrators WHERE admin_id=ANY($1::uuid[]) AND is_active=TRUE', [ids]);
    const active = new Set(rows.map(row => String(row.admin_id)));
    let delivered = 0;
    for (const socket of sockets) {
      const user = socket.data?.user || socket.user;
      if (user?.role !== 'admin' || !active.has(user.user_id) || !Number.isFinite(user.exp) || user.exp * 1000 <= Date.now()) {
        socket.disconnect(true);
      } else { socket.emit(event, payload); delivered++; }
    }
    return delivered;
  } catch {
    console.warn('Protected socket notification withheld: authentication unavailable');
    return 0;
  }
}

function revokeUserSockets(io, userId) {
  io?.in(`user:${userId}`).disconnectSockets(true);
}

function initSocket(io, pool) {
  socketPools.set(io, pool);
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || token === 'anonymous') {
      socket.user = { user_id: null, role: 'public' };
      return next();
    }
    try {
      const decoded = verifyToken(token);
      const id = decoded.user_id || decoded.sub;
      const role = decoded.role;
      socket.user = { user_id: id, role, exp: decoded.exp };
      if (!await activeSocketAccount(pool, socket.user)) return next(new Error('Account unavailable'));
      socket.data.user = socket.user;
      next();
    } catch {
      next(new Error('Authentication unavailable or expired'));
    }
  });
  io.on('connection', socket => {
    socket.join('public:alerts');
    if (socket.user.user_id) {
      socket.join(`role:${socket.user.role}`);
      socket.join(`user:${socket.user.user_id}`);
    }
    const expiry = socket.user.exp ? setTimeout(() => socket.disconnect(true),
      Math.max(0, Math.min(socket.user.exp * 1000 - Date.now(), 2147483647))) : null;
    expiry?.unref?.();
    // Also catch account changes made by operations outside this Node process.
    let checking = false;
    const recheck = socket.user.user_id ? setInterval(async () => {
      if (checking) return;
      checking = true;
      try { if (!await activeSocketAccount(pool, socket.user)) socket.disconnect(true); }
      catch { socket.disconnect(true); }
      finally { checking = false; }
    }, 30000) : null;
    recheck?.unref?.();
    socket.on('disconnect', () => { if (expiry) clearTimeout(expiry); if (recheck) clearInterval(recheck); });
  });
}

function broadcastAlert(io, alert, userIds) {
  const target = Array.isArray(userIds)
    ? io.to(['role:admin', ...userIds.map(id => `user:${id}`)])
    : io.to('public:alerts');
  target.emit('alert_received', alert);
  target.emit('emergency_alert', alert);
}

async function notifyNewRequest(io, request, pool) {
  // A new claim is unverified. Precise location and free text are coordinator-only.
  return emitToActiveAdmins(io, 'new_request', { ...request, verification_status: 'unverified' }, pool || socketPools.get(io));
}

module.exports = { initSocket, broadcastAlert, notifyNewRequest, emitToActiveAdmins, revokeUserSockets, activeSocketAccount };
