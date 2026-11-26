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

test('new requests notify active coordinators without any community event before verification', async () => {
  const admin = fakeSocket('admin'), disabled = fakeSocket('disabled'), citizen = fakeSocket('citizen', 'people');
  const broadcasts = [];
  const io = {
    to(room) { return { emit(event, payload) { broadcasts.push({ room, event, payload }); } }; },
    in(room) { assert.equal(room, 'role:admin'); return { fetchSockets: async () => [admin, disabled, citizen] }; },
  };
  const pool = { query: async () => ({ rows: [{ admin_id: 'admin' }] }) };
  const claim = { request_id: 'request-id', message: 'Private household details', lat: 7.1, lng: 80.1, ai_summary: 'Private summary' };
  assert.equal(await notifyNewRequest(io, claim, pool), 1);
  assert.deepEqual(broadcasts, []);
  assert.equal(admin.messages[0].event, 'new_request');
  assert.equal(admin.messages[0].payload.message, claim.message);
  assert.equal(admin.messages[0].payload.verification_status, 'unverified');
  assert.equal(disabled.messages.length, 0);
  assert.equal(citizen.messages.length, 0);
});

test('new submissions fail closed for every socket when coordinator authentication is unavailable', async () => {
  const broadcasts = [];
  const io = {
    to(room) { return { emit(event, payload) { broadcasts.push({ room, event, payload }); } }; },
    in() { return { fetchSockets: async () => [fakeSocket('admin')] }; },
  };
  const pool = { query: async () => { throw Error('Database unavailable'); } };
  assert.equal(await notifyNewRequest(io, { message: 'Sensitive callback details' }, pool), 0);
  assert.deepEqual(broadcasts, []);
});

test('requester information updates also stay private until a coordinator verifies them', async () => {
  const admin = fakeSocket('admin');
  const io = {
    to() { assert.fail('requester updates must not refresh the community feed'); },
    in(room) { assert.equal(room, 'role:admin'); return { fetchSockets: async () => [admin] }; },
  };
  const pool = { query: async () => ({ rows: [{ admin_id: 'admin' }] }) };
  await notifyNewRequest(io, { request_id: 'existing-case', message: 'Additional private evidence', verification_status: 'verified' }, pool);
  assert.equal(admin.messages[0].payload.verification_status, 'unverified');
  assert.equal(admin.messages[0].payload.message, 'Additional private evidence');
});

test('only approval and withdrawal refresh the public feed after a review commits', async () => {
  const router = require('../routes/requests');
  const handler = router.stack.find(layer => layer.route?.path === '/:id/verification').route.stack.at(-1).handle;
  const reviews = [
    ['unverified', 'verified', true],
    ['unverified', 'needs_information', false],
    ['unverified', 'rejected', false],
    ['needs_information', 'verified', true],
    ['verified', 'verified', false],
    ['verified', 'needs_information', true],
    ['verified', 'rejected', true],
  ];
  for (const [previous, decision, refreshesFeed] of reviews) {
    const statements = [], broadcasts = [];
    const client = {
      async query(sql) {
        statements.push(sql);
        return { rows: sql.startsWith('SELECT * FROM help_requests') ? [{
          verification_status: previous, emergency_type: 'help_rescue', admin_status: 'pending', status: 'pending',
          original_message: 'Private report',
        }] : [] };
      },
      release() {},
    };
    const io = {
      in() { return { fetchSockets: async () => [] }; },
      to(room) {
        return { emit(event, payload) {
          assert.equal(statements.at(-1), 'COMMIT');
          broadcasts.push({ room, event, payload });
        } };
      },
    };
    const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({
      params: { id: 'c7b732cc-3439-4fab-808b-59209b2f8d85' },
      body: { decision, expected_verification_status: previous, method: 'phone_callback', notes: 'Private coordinator review findings' },
      user: { user_id: 'reviewer' }, app: { locals: { io, pool: { connect: async () => client } } },
    }, response);
    assert.equal(response.body.success, true);
    assert.deepEqual(broadcasts, refreshesFeed ? [{ room: 'public:alerts', event: 'community_requests_updated', payload: {} }] : []);
  }
});

test('a saved request closure still refreshes the community feed to remove the request', async () => {
  const router = require('../routes/requests');
  const handler = router.stack.find(layer => layer.route?.path === '/:id/status').route.stack.at(-1).handle;
  const broadcasts = [], statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes('FROM help_requests')) return { rows: [{ admin_status: 'in_progress', status: 'in_progress', emergency_type: 'help_rescue', verification_status: 'verified' }] };
      if (sql.includes('FROM relief_missions')) return { rows: [{ status: 'completed' }] };
      return { rows: [] };
    },
    release() {},
  };
  const io = {
    in() { return { fetchSockets: async () => [] }; },
    to(room) { return { emit(event, payload) { assert.equal(statements.at(-1), 'COMMIT'); broadcasts.push({ room, event, payload }); } }; },
  };
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({
    params: { id: 'c7b732cc-3439-4fab-808b-59209b2f8d85' },
    body: { status: 'finished', reason: 'All assigned response missions are complete.' },
    user: { user_id: 'reviewer' }, app: { locals: { io, pool: { connect: async () => client } } },
  }, response);
  assert.equal(response.body.success, true);
  assert.deepEqual(broadcasts, [{ room: 'public:alerts', event: 'community_requests_updated', payload: {} }]);
});

test('coordinators can start an unverified SOS response without notifying the community', async () => {
  const router = require('../routes/requests');
  const handler = router.stack.find(layer => layer.route?.path === '/:id/status').route.stack.at(-1).handle;
  const admin = fakeSocket('reviewer');
  const client = {
    async query(sql) {
      if (sql.includes('FROM help_requests')) return { rows: [{
        admin_status: 'pending', status: 'pending', emergency_type: 'help_rescue', verification_status: 'unverified',
      }] };
      if (sql.includes('FROM administrators')) return { rows: [{ admin_id: 'reviewer' }] };
      return { rows: [] };
    },
    release() {},
  };
  const io = {
    in() { return { fetchSockets: async () => [admin] }; },
    to() { assert.fail('private progress must not refresh the community feed'); },
  };
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await handler({
    params: { id: 'c7b732cc-3439-4fab-808b-59209b2f8d85' },
    body: { status: 'in_progress', reason: 'Coordinator began emergency response.' },
    user: { user_id: 'reviewer' }, app: { locals: { io, pool: { connect: async () => client } } },
  }, response);
  assert.equal(response.body.success, true);
  assert.equal(admin.messages[0].payload.status, 'in_progress');
});
