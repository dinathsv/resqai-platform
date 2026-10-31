const express = require('express');
const { randomUUID } = require('node:crypto');
const { requireAdmin } = require('../middleware/auth');
const { emitToActiveAdmins } = require('../socket');
const router = express.Router();
router.use(requireAdmin);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function quantity(value) {
  const number = Number(value);
  if (!['number', 'string'].includes(typeof value) || !Number.isFinite(number) || number <= 0 || number > 1000000 || Math.abs(number * 100 - Math.round(number * 100)) > 0.00001) fail(400, 'Quantity must be positive, at most 1000000, with at most two decimals');
  return number;
}
function reason(value) { const result = typeof value === 'string' ? value.trim() : ''; if (result.length < 5 || result.length > 1500) fail(400, 'Provide a reason between 5 and 1500 characters'); return result; }
function validId(value) { if (typeof value !== 'string' || !UUID.test(value)) fail(400, 'A valid identifier is required'); return value; }
function itemInput(body) {
  const item = typeof body.item_name === 'string' ? body.item_name.trim().toLowerCase() : '';
  const unit = typeof body.unit === 'string' ? body.unit.trim().toLowerCase() : '';
  if (!item || item.length > 120 || !unit || unit.length > 40) fail(400, 'Provide an item name and unit');
  return { item_name: item, unit, quantity: quantity(body.quantity) };
}
function cents(value) { return Math.round(Number(value) * 100); }
function goodsStatus(pledge) {
  if (Number(pledge.delivered_quantity) >= Number(pledge.quantity)) return 'delivered';
  if (Number(pledge.delivered_quantity) > 0) return 'partially_delivered';
  if (Number(pledge.dispatched_quantity) > 0) return 'dispatched';
  if (Number(pledge.received_quantity) > 0) return 'received';
  return 'pledged';
}
async function event(client, type, fields) {
  await client.query(`INSERT INTO goods_events(event_type,need_id,donation_id,delivery_id,actor_admin_id,quantity,reason,operation_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [type, fields.need_id || null, fields.donation_id || null, fields.delivery_id || null,
    fields.admin_id || null, fields.quantity ?? null, fields.reason, fields.operation_id || null]);
}
async function transaction(req, res, work) {
  let client;
  try {
    client = await req.app.locals.pool.connect();
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    client.release(); client = null;
    // Broadcast authorization uses the pool; release the transaction connection first.
    try {
      await emitToActiveAdmins(req.app.locals.io, 'goods_updated', { changed_at: new Date().toISOString() }, req.app.locals.pool);
    } catch { console.error('Goods update saved; live notification unavailable'); }
    return res.json(result);
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'This operation was already submitted; refresh to check its result' });
    if (!error.status) console.error('Goods workflow failed:', error.message);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Goods operation failed' });
  } finally { client?.release(); }
}

async function lockedVerifiedRequest(client, requestId) {
  const { rows } = await client.query('SELECT * FROM help_requests WHERE request_id=$1 FOR UPDATE', [requestId]);
  const request = rows[0];
  if (!request || request.emergency_type !== 'donation' || request.verification_status !== 'verified' || !request.user_id || ['resolved', 'cancelled'].includes(request.status) || request.admin_status === 'finished') fail(409, 'An open, verified goods request with a registered recipient is required');
  return request;
}
async function ensureMission(client, request, adminId) {
  const { rows } = await client.query('SELECT * FROM relief_missions WHERE origin_request_id=$1 ORDER BY created_at LIMIT 1 FOR UPDATE', [request.request_id]);
  if (rows[0]) {
    if (['completed', 'cancelled'].includes(rows[0].status)) fail(409, 'The mission is closed');
    const updated = await client.query("UPDATE relief_missions SET mission_type='donation',status='active',updated_at=NOW() WHERE mission_id=$1 RETURNING *", [rows[0].mission_id]);
    return updated.rows[0];
  }
  const result = await client.query(`INSERT INTO relief_missions(mission_id,admin_id,title,description,origin_request_id,mission_type,status,target,funds_collected)
    VALUES($1,$2,$3,$4,$5,'donation','active',0,0) RETURNING *`, [randomUUID(), adminId, 'Verified goods relief', request.original_message, request.request_id]);
  return result.rows[0];
}
// Caller supplies a transaction; request row lock serializes approval and need creation.
async function ensureGoodsNeedsForVerifiedRequest(client, request, adminId = null) {
  const verified = await lockedVerifiedRequest(client, validId(request.request_id));
  let requested = verified.requested_items;
  if (typeof requested === 'string') { try { requested = JSON.parse(requested); } catch { fail(400, 'Invalid requested goods list'); } }
  if (!Array.isArray(requested) || requested.length === 0 || requested.length > 30) fail(400, 'Verify a list of 1 to 30 required goods before opening a mission');
  const items = requested.map(itemInput);
  const unique = new Set(items.map(item => `${item.item_name}\u0000${item.unit}`));
  if (unique.size !== items.length) fail(400, 'Combine duplicate goods into one requested quantity');
  const mission = await ensureMission(client, verified, adminId);
  for (const item of items) {
    const inserted = await client.query(`INSERT INTO mission_needs(mission_id,item_name,unit,required_quantity) VALUES($1,$2,$3,$4)
      ON CONFLICT(mission_id,item_name,unit) DO NOTHING RETURNING *`, [mission.mission_id, item.item_name, item.unit, item.quantity]);
    if (inserted.rows[0]) await event(client, 'need_verified', { need_id: inserted.rows[0].need_id, admin_id: adminId, quantity: item.quantity, reason: 'Need approved with the verified originating request' });
  }
  const needs = await client.query('SELECT * FROM mission_needs WHERE mission_id=$1 ORDER BY created_at', [mission.mission_id]);
  return { mission_id: mission.mission_id, needs: needs.rows };
}

router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { rows: missions } = await pool.query(`SELECT rm.mission_id,rm.title,rm.status,rm.origin_request_id,hr.verification_status,
      COALESCE(u.full_name,'Recipient') requester_name FROM relief_missions rm
      JOIN help_requests hr ON hr.request_id=rm.origin_request_id LEFT JOIN users u ON u.user_id=hr.user_id
      WHERE rm.mission_type='donation' ORDER BY rm.created_at DESC LIMIT 100`);
    for (const mission of missions) {
      const { rows: needs } = await pool.query(`SELECT n.*,COALESCE(SUM(d.quantity),0) pledged_quantity,
        COALESCE(SUM(d.received_quantity),0) received_quantity,COALESCE(SUM(d.dispatched_quantity),0) dispatched_quantity,
        COALESCE(SUM(d.delivered_quantity),0) delivered_quantity FROM mission_needs n
        LEFT JOIN donations d ON d.need_id=n.need_id AND d.goods_status<>'cancelled'
        WHERE n.mission_id=$1 GROUP BY n.need_id ORDER BY n.created_at`, [mission.mission_id]);
      mission.needs = needs.map(need => ({ ...need, ...Object.fromEntries(['required_quantity','pledged_quantity','received_quantity','dispatched_quantity','delivered_quantity'].map(key => [key, Number(need[key])])) }));
      const { rows: pledges } = await pool.query(`SELECT d.donation_id,d.need_id,d.quantity,d.received_quantity,d.dispatched_quantity,d.delivered_quantity,
        d.goods_status status,d.item_condition condition,d.availability_note,d.created_at,n.item_name,n.unit,u.full_name donor_name
        FROM donations d JOIN mission_needs n ON n.need_id=d.need_id JOIN users u ON u.user_id=d.donor_id WHERE n.mission_id=$1 ORDER BY d.created_at DESC`, [mission.mission_id]);
      mission.pledges = pledges.map(pledge => ({ ...pledge, ...Object.fromEntries(['quantity','received_quantity','dispatched_quantity','delivered_quantity'].map(key => [key, Number(pledge[key])])) }));
      const { rows: deliveries } = await pool.query(`SELECT gd.*,n.item_name,n.unit,u.full_name recipient_name FROM goods_deliveries gd
        JOIN donations d ON d.donation_id=gd.donation_id JOIN mission_needs n ON n.need_id=d.need_id
        JOIN users u ON u.user_id=gd.recipient_id WHERE n.mission_id=$1 ORDER BY gd.created_at DESC`, [mission.mission_id]);
      mission.deliveries = deliveries.map(delivery => ({ ...delivery, quantity: Number(delivery.quantity) }));
      mission.events = (await pool.query(`SELECT e.* FROM goods_events e JOIN mission_needs n ON n.need_id=e.need_id WHERE n.mission_id=$1 ORDER BY e.created_at DESC LIMIT 150`, [mission.mission_id])).rows;
    }
    return res.json({ missions });
  } catch (error) { console.error('Goods listing failed:', error.message); return res.status(500).json({ error: 'Could not load goods relief' }); }
});

router.post('/needs', (req, res) => transaction(req, res, async client => {
  const item = itemInput(req.body || {});
  let requestId = req.body.request_id;
  if (!requestId && req.body.mission_id) {
    const result = await client.query('SELECT origin_request_id FROM relief_missions WHERE mission_id=$1', [validId(req.body.mission_id)]);
    requestId = result.rows[0]?.origin_request_id;
  }
  const request = await lockedVerifiedRequest(client, validId(requestId));
  const mission = await ensureMission(client, request, req.user.user_id);
  if (req.body.mission_id && req.body.mission_id !== mission.mission_id) fail(409, 'Use the mission linked to this verified request');
  const inserted = await client.query('INSERT INTO mission_needs(mission_id,item_name,unit,required_quantity) VALUES($1,$2,$3,$4) RETURNING *', [mission.mission_id, item.item_name, item.unit, item.quantity]);
  await event(client, 'need_created', { need_id: inserted.rows[0].need_id, admin_id: req.user.user_id, quantity: item.quantity, reason: req.body.reason ? reason(req.body.reason) : 'Coordinator added a need to a verified request' });
  return { mission_id: mission.mission_id, need: inserted.rows[0] };
}));

router.patch('/needs/:id', (req, res) => transaction(req, res, async client => {
  const id = validId(req.params.id), required = quantity(req.body.quantity), note = reason(req.body.reason);
  const initial = await client.query('SELECT n.*,rm.origin_request_id FROM mission_needs n JOIN relief_missions rm ON rm.mission_id=n.mission_id WHERE n.need_id=$1', [id]);
  if (!initial.rows[0]) fail(404, 'Need not found');
  await lockedVerifiedRequest(client, initial.rows[0].origin_request_id);
  // Match pledge/dispatch ordering so a need cannot change after mission closure checks.
  const mission = await client.query('SELECT status FROM relief_missions WHERE mission_id=$1 FOR UPDATE', [initial.rows[0].mission_id]);
  if (mission.rows[0]?.status !== 'active') fail(409, 'Only an active mission may change its goods needs');
  await client.query('SELECT need_id FROM mission_needs WHERE need_id=$1 FOR UPDATE', [id]);
  const reserved = await client.query("SELECT COALESCE(SUM(quantity),0) quantity FROM donations WHERE need_id=$1 AND goods_status<>'cancelled'", [id]);
  if (required < Number(reserved.rows[0].quantity)) fail(409, 'Required quantity cannot be below existing commitments');
  const updated = await client.query('UPDATE mission_needs SET required_quantity=$1,updated_at=NOW() WHERE need_id=$2 RETURNING *', [required, id]);
  await event(client, 'need_updated', { need_id: id, admin_id: req.user.user_id, quantity: required, reason: note });
  return { need: updated.rows[0] };
}));

async function lockedPledge(client, id, verify = true) {
  const initial = await client.query(`SELECT d.need_id,rm.origin_request_id,rm.mission_id FROM donations d
    JOIN relief_missions rm ON rm.mission_id=d.mission_id WHERE d.donation_id=$1 AND d.need_id IS NOT NULL`, [id]);
  if (!initial.rows[0]) fail(404, 'Goods pledge not found');
  const initialPledge = initial.rows[0];
  let request;
  if (verify) {
    request = await lockedVerifiedRequest(client, initialPledge.origin_request_id);
    const mission = await client.query('SELECT status FROM relief_missions WHERE mission_id=$1 FOR UPDATE', [initialPledge.mission_id]);
    if (mission.rows[0]?.status !== 'active') fail(409, 'Only an active mission may receive or dispatch goods');
  }
  await client.query('SELECT need_id FROM mission_needs WHERE need_id=$1 FOR UPDATE', [initialPledge.need_id]);
  const result = await client.query('SELECT * FROM donations WHERE donation_id=$1 FOR UPDATE', [id]);
  const pledge = result.rows[0];
  if (pledge.goods_status === 'cancelled') fail(409, 'Pledge is cancelled');
  return { pledge, request };
}
async function previousOperation(client, operationId, type, pledgeId, amount, note) {
  const previous = await client.query('SELECT * FROM goods_events WHERE operation_id=$1', [operationId]);
  if (!previous.rows[0]) return null;
  const event = previous.rows[0];
  if (event.event_type !== type || event.donation_id !== pledgeId || Number(event.quantity) !== amount || event.reason !== note) fail(409, 'Operation identifier was used for different data');
  return { success: true, duplicate: true, delivery_id: event.delivery_id || undefined };
}

for (const action of ['receive', 'dispatch']) {
  router.post(`/pledges/:id/${action}`, (req, res) => transaction(req, res, async client => {
    const id = validId(req.params.id), amount = quantity(req.body.quantity), note = reason(req.body.reason), operationId = validId(req.body.operation_id);
    const previous = await previousOperation(client, operationId, action, id, amount, note);
    if (previous) return previous;
    const { pledge, request } = await lockedPledge(client, id);
    const duplicate = await previousOperation(client, operationId, action, id, amount, note);
    if (duplicate) return duplicate;
    let deliveryId;
    if (action === 'receive') {
      if (cents(amount) > cents(pledge.quantity) - cents(pledge.received_quantity)) fail(409, 'Quantity exceeds goods still expected from this pledge');
      pledge.received_quantity = (cents(pledge.received_quantity) + cents(amount)) / 100;
      await client.query('UPDATE donations SET received_quantity=$1,goods_status=$2,updated_at=NOW() WHERE donation_id=$3', [pledge.received_quantity, goodsStatus(pledge), id]);
    } else {
      if (cents(amount) > cents(pledge.received_quantity) - cents(pledge.dispatched_quantity)) fail(409, 'Quantity exceeds available received stock');
      if (request.user_id === pledge.donor_id) fail(409, 'The recipient cannot confirm their own donated goods');
      deliveryId = randomUUID();
      await client.query(`INSERT INTO goods_deliveries(delivery_id,donation_id,recipient_id,quantity,dispatched_by,dispatch_note)
        VALUES($1,$2,$3,$4,$5,$6)`, [deliveryId, id, request.user_id, amount, req.user.user_id, note]);
      pledge.dispatched_quantity = (cents(pledge.dispatched_quantity) + cents(amount)) / 100;
      await client.query('UPDATE donations SET dispatched_quantity=$1,goods_status=$2,updated_at=NOW() WHERE donation_id=$3', [pledge.dispatched_quantity, goodsStatus(pledge), id]);
    }
    await event(client, action, { need_id: pledge.need_id, donation_id: id, delivery_id: deliveryId, admin_id: req.user.user_id, quantity: amount, reason: note, operation_id: operationId });
    return { success: true, donation_id: id, delivery_id: deliveryId };
  }));
}

router.patch('/deliveries/:id/review', (req, res) => transaction(req, res, async client => {
  const deliveryId = validId(req.params.id), note = reason(req.body.reason), resolution = req.body.resolution;
  if (!['confirmed', 'returned'].includes(resolution)) fail(400, 'Choose confirmed or returned');
  const initial = await client.query('SELECT donation_id FROM goods_deliveries WHERE delivery_id=$1', [deliveryId]);
  if (!initial.rows[0]) fail(404, 'Delivery not found');
  const { pledge } = await lockedPledge(client, initial.rows[0].donation_id, false);
  const result = await client.query('SELECT * FROM goods_deliveries WHERE delivery_id=$1 FOR UPDATE', [deliveryId]);
  const delivery = result.rows[0];
  if (delivery.status !== 'disputed') fail(409, 'Only disputed deliveries require exception review');
  // A second coordinator reviews a disputed handover, preventing self-approval.
  if (delivery.dispatched_by === req.user.user_id) fail(403, 'A different coordinator must review this disputed dispatch');
  const next = resolution === 'confirmed' ? 'delivered' : 'returned';
  if (resolution === 'confirmed') pledge.delivered_quantity = (cents(pledge.delivered_quantity) + cents(delivery.quantity)) / 100;
  else pledge.dispatched_quantity = (cents(pledge.dispatched_quantity) - cents(delivery.quantity)) / 100;
  const nextStatus = goodsStatus(pledge);
  await client.query(`UPDATE donations SET dispatched_quantity=$1,delivered_quantity=$2,goods_status=$3::varchar,
    status=CASE WHEN $3::varchar='delivered' THEN 'completed'::donation_status ELSE status END,updated_at=NOW() WHERE donation_id=$4`,
    [pledge.dispatched_quantity, pledge.delivered_quantity, nextStatus, pledge.donation_id]);
  await client.query(`UPDATE goods_deliveries SET status=$1::varchar,review_reason=$2,reviewed_by=$3,reviewed_at=NOW(),
    confirmed_at=CASE WHEN $1::varchar='delivered' THEN NOW() ELSE confirmed_at END WHERE delivery_id=$4`, [next, note, req.user.user_id, deliveryId]);
  await event(client, `dispute_${resolution}`, { need_id: pledge.need_id, donation_id: pledge.donation_id, delivery_id: deliveryId,
    admin_id: req.user.user_id, quantity: Number(delivery.quantity), reason: note });
  return { success: true, delivery_id: deliveryId, status: next };
}));

router.post('/volunteers/:id/complete-exception', (req, res) => transaction(req, res, async client => {
  const id = validId(req.params.id), note = reason(req.body.reason);
  const result = await client.query('SELECT * FROM volunteer_assignments WHERE assignment_id=$1 FOR UPDATE', [id]);
  const assignment = result.rows[0];
  if (!assignment) fail(404, 'Volunteer assignment not found');
  if (assignment.status === 'completed' && (assignment.recipient_confirmed_at || assignment.reviewed_at)) {
    return { assignment_id: id, status: 'completed', duplicate: true };
  }
  if (!['accepted', 'active', 'completed'].includes(assignment.status) || (assignment.status !== 'completed' && !assignment.completion_requested_at)) fail(409, 'The volunteer must first request completion');
  await client.query(`UPDATE volunteer_assignments SET status='completed',completed_at=NOW(),
    completion_review_reason=$1,reviewed_by=$2,reviewed_at=NOW(),updated_at=NOW() WHERE assignment_id=$3`, [note, req.user.user_id, id]);
  await client.query(`INSERT INTO audit_logs(admin_id,action,entity_type,entity_id)
    VALUES($1,'volunteer_completion_exception','volunteer_assignment',$2)`, [req.user.user_id, id]);
  return { assignment_id: id, status: 'completed', completion_review_reason: note };
}));

module.exports = router;
module.exports.ensureGoodsNeedsForVerifiedRequest = ensureGoodsNeedsForVerifiedRequest;
module.exports.goodsStatus = goodsStatus;
module.exports.quantity = quantity;
