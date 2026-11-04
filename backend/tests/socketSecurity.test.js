const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'socket-test-secret-at-least-32-characters';
const jwt = require('jsonwebtoken');
const { initSocket, emitToActiveAdmins, notifyNewRequest, revokeUserSockets } = require('../socket');

function fakeSocket(id, role = 'admin', expired = false) {
  return { data: { user: { user_id: id, role, exp: Date.now()/1000 + (expired ? -60 : 60) } },
    messages: [], disconnected: false,
    emit(event, payload) { this.messages.push({ event, payload }); },
    disconnect() { this.disconnected = true; } };
}

test('sensitive broadcasts recheck active administrators and deny expired or revoked sockets', async () => {
  const active = fakeSocket('active'), revoked = fakeSocket('revoked'), expired = fakeSocket('expired', 'admin', true), wrongRole = fakeSocket('citizen', 'people');
  const io = { in(room) { assert.equal(room, 'role:admin'); return { fetchSockets: async () => [active, revoked, expired, wrongRole] }; } };
  const pool = { query: async () => ({ rows: [{ admin_id: 'active' }, { admin_id: 'expired' }, { admin_id: 'citizen' }] }) };
  assert.equal(await emitToActiveAdmins(io, 'new_request', { message: 'Private report' }, pool), 1);
  assert.equal(active.messages.length, 1);
  for (const socket of [revoked, expired, wrongRole]) { assert.equal(socket.messages.length, 0); assert.equal(socket.disconnected, true); }
});

test('database outages withhold private socket payloads rather than using stale authorization', async () => {
  const socket = fakeSocket('admin');
  const io = { in: () => ({ fetchSockets: async () => [socket] }) };
  const pool = { query: async () => { throw Error('database unavailable'); } };
  assert.equal(await emitToActiveAdmins(io, 'agency_message', { message_text: 'Private coordination' }, pool), 0);
  assert.equal(socket.messages.length, 0);
});

test('revoking a user disconnects every connection in that user room', () => {
  let room, disconnected = false;
  revokeUserSockets({ in(value) { room = value; return { disconnectSockets(force) { disconnected = force; } }; } }, 'subject-id');
  assert.equal(room, 'user:subject-id'); assert.equal(disconnected, true);
});

test('unknown roles and disabled accounts cannot enter authenticated socket rooms', async () => {
  let authenticate;
  const io = { use(fn) { authenticate = fn; }, on() {} };
  initSocket(io, { query: async () => ({ rows: [] }) });
  for (const role of ['unknown', 'admin', 'people', 'guest']) {
    const token = jwt.sign({ sub: '0b0114c8-973d-46e7-8f8f-ad5f1e149f1d', role }, process.env.JWT_SECRET, { expiresIn: '5m' });
    let error;
    await authenticate({ handshake: { auth: { token } }, data: {} }, value => { error = value; });
    assert.ok(error instanceof Error, role);
  }
});

test('new requests prompt a public feed refresh while their details stay with active coordinators', async () => {
  const admin = fakeSocket('admin');
  const broadcasts = [];
  const io = {
    to(room) { return { emit(event, payload) { broadcasts.push({ room, event, payload }); } }; },
    in(room) { assert.equal(room, 'role:admin'); return { fetchSockets: async () => [admin] }; },
  };
  const pool = { query: async () => ({ rows: [{ admin_id: 'admin' }] }) };
  const claim = { request_id: 'request-id', message: 'Private household details', lat: 7.1, lng: 80.1, ai_summary: 'Private summary' };
  assert.equal(await notifyNewRequest(io, claim, pool), 1);
  assert.deepEqual(broadcasts, [{ room: 'public:alerts', event: 'community_requests_updated', payload: {} }]);
  assert.equal(admin.messages[0].event, 'new_request');
  assert.equal(admin.messages[0].payload.message, claim.message);
  assert.equal(admin.messages[0].payload.verification_status, 'unverified');
});

test('a public refresh hint exposes no claim details when coordinator authentication is unavailable', async () => {
  const broadcasts = [];
  const io = {
    to(room) { return { emit(event, payload) { broadcasts.push({ room, event, payload }); } }; },
    in() { return { fetchSockets: async () => [fakeSocket('admin')] }; },
  };
  const pool = { query: async () => { throw Error('Database unavailable'); } };
  assert.equal(await notifyNewRequest(io, { message: 'Sensitive callback details' }, pool), 0);
  assert.deepEqual(broadcasts, [{ room: 'public:alerts', event: 'community_requests_updated', payload: {} }]);
});
