const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'isolated-node-test-secret-at-least-32-characters';
process.env.SECRET_KEY = 'isolated-python-test-secret-at-least-32-characters';
const jwt = require('jsonwebtoken');
const { requireAdmin, verifyToken } = require('../middleware/auth');
const { requireInternal } = require('../middleware/internal');
const usersRouter = require('../routes/users');
const alertsRouter = require('../routes/alerts');

function response() {
  return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
function request(role = 'people', rows = []) {
  const token = jwt.sign({ sub: 'b589bb5b-894a-408b-8604-d80b92988741', role }, process.env.JWT_SECRET);
  let calls = 0;
  return { headers: { authorization: `Bearer ${token}` }, app: { locals: { pool: { async query() { calls++; return { rows }; } } } }, get calls() { return calls; } };
}

test('user management and alert writes use administrator authorization', () => {
  assert.equal(usersRouter.stack[0].handle, requireAdmin);
  for (const layer of alertsRouter.stack.filter(item => item.route && (item.route.methods.post || item.route.methods.patch))) {
    assert.equal(layer.route.stack[0].handle, requireAdmin);
  }
});

test('citizens and guests cannot administer users or issue alerts', async () => {
  for (const role of ['people', 'guest']) {
    const req = request(role); const res = response();
    await requireAdmin(req, res, () => assert.fail('must reject non-admin'));
    assert.equal(res.code, 403); assert.equal(req.calls, 0);
  }
});

test('missing and inactive administrators are denied; active administrators continue', async () => {
  const denied = response();
  await requireAdmin(request('admin'), denied, () => assert.fail('missing administrator'));
  assert.equal(denied.code, 403);
  const active = request('admin', [{ admin_id: 'active-admin' }]);
  let continued = false;
  await requireAdmin(active, response(), () => { continued = true; });
  assert.equal(continued, true); assert.equal(active.admin.admin_id, 'active-admin');
});

test('shared Python JWTs remain compatible and unsigned or wrong-algorithm JWTs fail', () => {
  const token = jwt.sign({ sub: 'citizen', role: 'people' }, process.env.SECRET_KEY);
  assert.equal(verifyToken(token).sub, 'citizen');
  assert.throws(() => verifyToken(jwt.sign({ sub: 'citizen' }, process.env.SECRET_KEY, { algorithm: 'HS384' })));
  assert.throws(() => verifyToken(jwt.sign({ role: 'admin' }, process.env.JWT_SECRET)));
});

test('internal broadcast requires the configured server-only credential', () => {
  process.env.INTERNAL_API_KEY = 'isolated-internal-test-key-at-least-32-characters';
  const denied = response();
  requireInternal({ get() { return ''; } }, denied, () => assert.fail('missing credential'));
  assert.equal(denied.code, 401);
  let continued = false;
  requireInternal({ get() { return process.env.INTERNAL_API_KEY; } }, response(), () => { continued = true; });
  assert.equal(continued, true);
});

test('schema readiness is read-only and propagates incompatible schema failures', async () => {
  const { checkSchema } = require('../services/schemaService');
  const statements = [];
  await checkSchema({ async query(sql) { statements.push(sql); } });
  for (const table of ['users','help_requests','relief_missions','mission_needs','donations','goods_deliveries','goods_events','request_verifications','request_status_history','mission_status_history','volunteer_assignments']) {
    assert.ok(statements.some(sql => sql.includes(`FROM public.${table} LIMIT 0`)), `Readiness must inspect ${table}`);
  }
  for (const column of ['verification_status','requested_items','goods_status','operation_id','recipient_confirmed_at']) {
    assert.ok(statements.some(sql => sql.includes(column)), `Readiness must inspect ${column}`);
  }
  assert.ok(statements.every(sql => sql.startsWith('SELECT ') && sql.endsWith('LIMIT 0')));
  await assert.rejects(checkSchema({ async query() { throw Error('missing column'); } }), /missing column/);
});
