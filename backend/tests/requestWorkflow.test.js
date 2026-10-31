const test = require('node:test');
const assert = require('node:assert/strict');
const { reviewError, transitionError } = require('../services/requestWorkflow');
const { requireAdmin } = require('../middleware/auth');
const requestRouter = require('../routes/requests');
const chatRouter = require('../routes/chat');

const request = { request_id: 'c7b732cc-3439-4fab-808b-59209b2f8d85', user_id: 'recipient', emergency_type: 'donation', verification_status: 'unverified', status: 'pending', admin_status: 'pending', requested_items: [{ item_name: 'Rice', unit: 'kg', quantity: 20 }] };
const review = { decision: 'verified', method: 'phone_callback', notes: 'Called the recipient and confirmed the required quantity with field staff.', expected_verification_status: 'unverified' };

test('need approval requires evidence findings, method, registered recipient and itemized goods', () => {
  assert.equal(reviewError(review, request), null);
  assert.match(reviewError({ ...review, notes: '' }, request), /reason/);
  assert.match(reviewError({ ...review, method: 'ai_prediction' }, request), /method/);
  assert.match(reviewError(review, { ...request, user_id: null }), /registered recipient/);
  assert.match(reviewError(review, { ...request, requested_items: [] }), /items and quantities/);
  assert.match(reviewError(review, { ...request, requested_items: [{ item_name: 'Rice', unit: 'kg', quantity: -1 }] }), /positive quantity/);
});

test('stale reviews and reviews of closed requests are blocked', () => {
  assert.match(reviewError(review, { ...request, verification_status: 'rejected' }), /Another reviewer/);
  assert.match(reviewError(review, { ...request, admin_status: 'finished' }), /Closed/);
  assert.match(reviewError({ ...review, decision: 'needs_information' }, { ...request, admin_status: 'in_progress' }), /response has already started/);
});

test('goods cannot enter fulfillment unverified, while an urgent help response can start', () => {
  const reason = 'Dispatcher has assigned a response team.';
  assert.match(transitionError(request, 'in_progress', reason), /confirmed need/);
  assert.equal(transitionError({ ...request, emergency_type: 'help_rescue' }, 'in_progress', reason), null);
  assert.match(transitionError({ ...request, verification_status: 'rejected' }, 'in_progress', reason), /Rejected/);
  assert.match(transitionError({ ...request, verification_status: 'verified' }, 'finished', reason), /Start the response/);
  assert.match(transitionError({ ...request, admin_status: 'finished' }, 'in_progress', reason), /cannot be reopened/);
});

test('review/detail/status routes and persistent chat require live administrator checks', () => {
  for (const path of ['/', '/:id', '/:id/status', '/:id/verification']) {
    const route = requestRouter.stack.find(layer => layer.route?.path === path);
    assert.equal(route.route.stack[0].handle, requireAdmin, path);
  }
  assert.equal(chatRouter.stack[0].handle, requireAdmin);
});

test('a stale verification submission rolls back and never publishes or creates a mission', async () => {
  const statements = [];
  const client = { async query(sql) { statements.push(sql); return { rows: sql.startsWith('SELECT * FROM help_requests') ? [{ ...request, verification_status: 'rejected' }] : [] }; }, release() {} };
  const route = requestRouter.stack.find(layer => layer.route?.path === '/:id/verification').route;
  const handler = route.stack.at(-1).handle;
  const response = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ params: { id: request.request_id }, body: review, user: { user_id: 'admin' }, app: { locals: { pool: { connect: async () => client }, io: { to() { assert.fail('must not publish a stale review'); } } } } }, response);
  assert.equal(response.code, 409);
  assert.equal(statements.at(-1), 'ROLLBACK');
  assert.ok(statements.every(sql => !sql.startsWith('UPDATE') && !sql.startsWith('INSERT')));
});

test('request closure cannot skip unfinished missions', async () => {
  const statements = [];
  const client = { async query(sql) { statements.push(sql); if (sql.includes('FROM help_requests')) return { rows: [{ ...request, admin_status: 'in_progress', verification_status: 'verified' }] }; if (sql.includes('FROM relief_missions')) return { rows: [{ status: 'active' }] }; return { rows: [] }; }, release() {} };
  const handler = requestRouter.stack.find(layer => layer.route?.path === '/:id/status').route.stack.at(-1).handle;
  const response = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ params: { id: request.request_id }, body: { status: 'finished', reason: 'We would like to close this request.' }, user: { user_id: 'admin' }, app: { locals: { pool: { connect: async () => client } } } }, response);
  assert.equal(response.code, 409);
  assert.match(response.body.error, /delivery confirmations/);
  assert.ok(!statements.some(sql => sql.startsWith('UPDATE help_requests')));
});
