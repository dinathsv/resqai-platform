const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function harness(storage = new Map()) {
  let token = null;
  let handle = async () => new Response(JSON.stringify({ request_id: 'server-request', status: 'pending', verification_status: 'unverified' }), { status: 201 });
  const calls = [];
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/requestQueue.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const exports = {};
  const context = {
    exports, console, setTimeout, clearTimeout, AbortController, Response, atob,
    fetch: async (url, options) => { calls.push({ url, options }); return handle(url, options); },
    require: name => name.includes('async-storage') ? {
      getItem: async key => storage.get(key) ?? null,
      setItem: async (key, value) => { storage.set(key, value); },
    } : name === '../config/api' ? {
      API_BASE: 'https://api.example.test', getToken: async () => token,
      parseErrorResponse: async r => (await r.json()).detail || 'Server error',
    } : (() => { throw new Error(name); })(),
  };
  vm.runInNewContext(source, context);
  return { api: exports, storage, calls,
    setUser(id) { token = id ? `x.${Buffer.from(JSON.stringify({ sub: id, role: 'people' })).toString('base64url')}.x` : null; },
    network(fn) { handle = fn; },
  };
}
const payload = (id = '01234567-1234-4234-8234-123456789012') => ({ client_request_id: id, message: 'Need drinking water', request_type: 'donation', lat: null, lng: null, location_label: 'School', location_source: 'manual', affected_people: 4, requested_items: [{ item_name: 'Water', quantity: 4, unit: 'bottles' }], evidence_note: '', urgency_level: 4 });

test('an accepted request with a lost response survives restart and reuses its idempotency key', async () => {
  const first = harness(); first.setUser('alice'); first.network(async () => { throw new Error('response lost'); });
  assert.equal(await first.api.submitDurableRequest(payload()), 'queued');
  const second = harness(first.storage); second.setUser('alice'); await second.api.syncMyRequests();
  assert.equal(second.calls[0].url, 'https://api.example.test/api/requests');
  assert.deepEqual(JSON.parse(second.calls[0].options.body), payload());
  assert.equal((await second.api.getMyQueuedRequests()).length, 0);
  assert.equal((await second.api.getMyRequestReceipts())[0].request_id, 'server-request');
});
test('switching accounts never sends a previous owner queue', async () => {
  const h = harness(); h.setUser('alice'); await h.api.queueRequest(payload());
  h.setUser('bob'); await h.api.syncMyRequests(); assert.equal(h.calls.length, 0);
  assert.equal((await h.api.getMyQueuedRequests()).length, 0);
  h.setUser('alice'); await h.api.syncMyRequests(); assert.equal(h.calls.length, 1);
});
test('anonymous SOS sends without Authorization and stays separate from a later login', async () => {
  const h = harness(); const sos = { ...payload(), request_type: 'help_rescue', requested_items: [] };
  await h.api.queueRequest(sos); h.setUser('alice'); await h.api.syncMyRequests(); assert.equal(h.calls.length, 0);
  h.setUser(null); await h.api.syncMyRequests(); assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].options.headers.Authorization, undefined);
});
test('a rejected request remains visible and retries only on explicit user action', async () => {
  const h = harness(); h.setUser('alice'); h.network(async () => new Response(JSON.stringify({ detail: 'Phone verification required' }), { status: 403 }));
  assert.equal(await h.api.submitDurableRequest(payload()), 'failed');
  assert.equal((await h.api.getMyQueuedRequests())[0].error, 'Phone verification required');
  await h.api.syncMyRequests(); assert.equal(h.calls.length, 1);
  await h.api.syncMyRequests(true); assert.equal(h.calls.length, 2);
});
test('parallel retries do not send a saved request twice', async () => {
  const h = harness(); h.setUser('alice'); await h.api.queueRequest(payload());
  await Promise.all([h.api.syncMyRequests(), h.api.syncMyRequests()]);
  assert.equal(h.calls.length, 1);
});
test('storage failure never produces a false saved or sent result', async () => {
  const storage = new Map(); storage.set = () => { throw new Error('Storage full'); };
  const h = harness(storage); h.setUser('alice');
  await assert.rejects(h.api.submitDurableRequest(payload()), /Storage full/);
  assert.equal(h.calls.length, 0);
});
