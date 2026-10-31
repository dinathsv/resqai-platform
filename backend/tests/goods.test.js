const test = require('node:test');
const assert = require('node:assert/strict');
const goods = require('../routes/goods');
const { requireAdmin } = require('../middleware/auth');
const ids = {
  pledge: '11111111-1111-4111-8111-111111111111', need: '22222222-2222-4222-8222-222222222222',
  request: '33333333-3333-4333-8333-333333333333', recipient: '44444444-4444-4444-8444-444444444444',
  donor: '55555555-5555-4555-8555-555555555555', admin: '66666666-6666-4666-8666-666666666666',
  operation: '77777777-7777-4777-8777-777777777777', mission: '88888888-8888-4888-8888-888888888888',
  delivery: '99999999-9999-4999-8999-999999999999',
};
const handler = (path, method) => goods.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
function fixture({ pledge = {}, delivery = {}, verified = true, previous = null } = {}) {
  const writes = [], queries = [];
  const stock = { donation_id: ids.pledge, donor_id: ids.donor, need_id: ids.need, quantity: '10', received_quantity: '4', dispatched_quantity: '2', delivered_quantity: '0', goods_status: 'dispatched', ...pledge };
  const parcel = { delivery_id: ids.delivery, donation_id: ids.pledge, quantity: '2', status: 'disputed', dispatched_by: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ...delivery };
  const client = { release() {}, async query(sql, values = []) {
    queries.push(sql);
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
    if (sql.startsWith('SELECT * FROM goods_events')) return { rows: previous ? [previous] : [] };
    if (sql.startsWith('SELECT d.need_id')) return { rows: [{ need_id: ids.need, origin_request_id: ids.request, mission_id: ids.mission }] };
    if (sql.startsWith('SELECT * FROM help_requests')) return { rows: [{ request_id: ids.request, user_id: ids.recipient, emergency_type: 'donation', verification_status: verified ? 'verified' : 'unverified', status: 'pending' }] };
    if (sql.startsWith('SELECT status FROM relief_missions')) return { rows: [{ status: 'active' }] };
    if (sql.startsWith('SELECT need_id FROM mission_needs')) return { rows: [{ need_id: ids.need }] };
    if (sql.startsWith('SELECT * FROM donations')) return { rows: [stock] };
    if (sql.startsWith('SELECT donation_id FROM goods_deliveries')) return { rows: [{ donation_id: ids.pledge }] };
    if (sql.startsWith('SELECT * FROM goods_deliveries')) return { rows: [parcel] };
    if (sql.startsWith('INSERT') || sql.startsWith('UPDATE')) { writes.push({ sql, values }); return { rows: [] }; }
    throw Error(`Unexpected SQL: ${sql}`);
  } };
  const req = { params: { id: ids.pledge }, user: { user_id: ids.admin }, body: { quantity: 2, reason: 'Checked stock at collection point', operation_id: ids.operation }, app: { locals: { pool: { async connect() { return client; } } } } };
  return { req, client, writes, queries, stock };
}

test('goods endpoints share live administrator authorization', () => assert.equal(goods.stack[0].handle, requireAdmin));
test('quantity rejects invalid and overly precise values without rounding away user intent', () => {
  for (const value of [0, -1, NaN, Infinity, true, [1], {}, 0.001, 1000001]) assert.throws(() => goods.quantity(value));
  assert.equal(goods.quantity(0.1), 0.1);
});
test('unverified requests cannot receive goods or create collectable missions', async () => {
  const f = fixture({ verified: false }), res = response();
  await handler('/pledges/:id/receive', 'post')(f.req, res);
  assert.equal(res.code, 409); assert.equal(f.writes.length, 0);
  await assert.rejects(goods.ensureGoodsNeedsForVerifiedRequest(f.client, { request_id: ids.request }), /verified/);
});
test('cannot dispatch more than physically received inventory', async () => {
  const f = fixture(), res = response(); f.req.body.quantity = 3;
  await handler('/pledges/:id/dispatch', 'post')(f.req, res);
  assert.equal(res.code, 409); assert.equal(f.writes.length, 0); assert.ok(f.queries.includes('ROLLBACK'));
});
test('decimal stock balance supports exact final fraction and creates recipient bound delivery', async () => {
  const f = fixture({ pledge: { quantity: '0.3', received_quantity: '0.3', dispatched_quantity: '0.2' } }), res = response(); f.req.body.quantity = 0.1;
  await handler('/pledges/:id/dispatch', 'post')(f.req, res);
  assert.equal(res.code, 200); assert.ok(res.body.delivery_id);
  assert.equal(f.writes.find(w => w.sql.startsWith('INSERT INTO goods_deliveries')).values[2], ids.recipient);
  assert.equal(f.writes.find(w => w.sql.startsWith('UPDATE donations')).values[0], 0.3);
  assert.ok(f.queries.some(sql => sql.includes('FROM donations') && sql.includes('FOR UPDATE')));
  assert.ok(f.writes.some(w => w.sql.startsWith('INSERT INTO goods_events')));
});
test('replayed inventory operation cannot duplicate stock and conflicting replay fails', async () => {
  const previous = { event_type: 'receive', donation_id: ids.pledge, quantity: '2', reason: 'Checked stock at collection point' };
  const f = fixture({ previous }), res = response();
  await handler('/pledges/:id/receive', 'post')(f.req, res);
  assert.equal(res.body.duplicate, true); assert.equal(f.writes.length, 0);
  f.req.body.quantity = 3; const conflicting = response();
  await handler('/pledges/:id/receive', 'post')(f.req, conflicting);
  assert.equal(conflicting.code, 409); assert.equal(f.writes.length, 0);
});
test('dispatching coordinator cannot resolve own disputed handover', async () => {
  const f = fixture({ delivery: { dispatched_by: ids.admin } }), res = response();
  f.req.params.id = ids.delivery; f.req.body = { resolution: 'confirmed', reason: 'Verified with recipient by callback' };
  await handler('/deliveries/:id/review', 'patch')(f.req, res);
  assert.equal(res.code, 403); assert.equal(f.writes.length, 0);
});
test('returned dispute restores available stock without counting a delivery', async () => {
  const f = fixture(), res = response(); f.req.params.id = ids.delivery;
  f.req.body = { resolution: 'returned', reason: 'Package physically returned to warehouse' };
  await handler('/deliveries/:id/review', 'patch')(f.req, res);
  assert.equal(res.body.status, 'returned');
  const update = f.writes.find(w => w.sql.startsWith('UPDATE donations'));
  assert.equal(update.values[0], 0); assert.equal(update.values[1], '0');
  assert.ok(f.writes.some(w => w.sql.includes('reviewed_by')));
});

test('need changes lock the mission before inventory and reject closed missions', async () => {
  for (const missionStatus of ['active', 'completed']) {
    const statements = [];
    const client = { release() {}, async query(sql, args) {
      statements.push(sql);
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
      if (sql.startsWith('SELECT n.*')) return { rows: [{need_id: ids.need, mission_id: ids.mission, origin_request_id: ids.request}] };
      if (sql.startsWith('SELECT * FROM help_requests')) return { rows: [{user_id: ids.recipient, emergency_type:'donation', verification_status:'verified', status:'pending'}] };
      if (sql.startsWith('SELECT status FROM relief_missions')) return { rows: [{status:missionStatus}] };
      if (sql.startsWith('SELECT need_id')) return { rows: [{need_id:ids.need}] };
      if (sql.startsWith('SELECT COALESCE')) return { rows: [{quantity:4}] };
      if (sql.startsWith('UPDATE mission_needs')) return { rows: [{need_id:ids.need, required_quantity:args[0]}] };
      if (sql.startsWith('INSERT INTO goods_events')) return { rows: [] };
      throw Error(`Unexpected SQL: ${sql}`);
    } };
    const req = {params:{id:ids.need},body:{quantity:12,reason:'Recipient confirmed additional household need'},user:{user_id:ids.admin},app:{locals:{pool:{async connect(){return client;}}}}};
    const res = response();
    await handler('/needs/:id','patch')(req,res);
    if (missionStatus === 'completed') {
      assert.equal(res.code,409);
      assert.equal(statements.some(sql=>sql.startsWith('UPDATE mission_needs')),false);
    } else {
      assert.equal(res.code,200);
      const locks=statements.filter(sql=>sql.includes('FOR UPDATE'));
      assert.match(locks[0],/help_requests/); assert.match(locks[1],/relief_missions/); assert.match(locks[2],/mission_needs/);
    }
  }
});

test('receipt cannot exceed pledged quantity', async () => {
  const f = fixture(), res = response(); f.req.body.quantity = 7;
  await handler('/pledges/:id/receive', 'post')(f.req, res);
  assert.equal(res.code, 409); assert.equal(f.writes.length, 0);
});

test('independent confirmed dispute records delivered quantity once; final deliveries cannot be reviewed again', async () => {
  const f = fixture(), res = response(); f.req.params.id = ids.delivery;
  f.req.body = { resolution: 'confirmed', reason: 'Independent callback confirmed both parcels received' };
  await handler('/deliveries/:id/review', 'patch')(f.req, res);
  assert.equal(res.body.status, 'delivered');
  const update = f.writes.find(w => w.sql.startsWith('UPDATE donations'));
  assert.equal(update.values[0], '2'); assert.equal(update.values[1], 2); assert.equal(update.values[2], 'partially_delivered');
  assert.ok(f.writes.some(w => w.sql.startsWith('INSERT INTO goods_events') && w.values[0] === 'dispute_confirmed'));
  const repeated = fixture({ delivery: { status: 'delivered' } }), duplicateResponse = response();
  repeated.req.params.id = ids.delivery; repeated.req.body = f.req.body;
  await handler('/deliveries/:id/review', 'patch')(repeated.req, duplicateResponse);
  assert.equal(duplicateResponse.code, 409); assert.equal(repeated.writes.length, 0);
});
