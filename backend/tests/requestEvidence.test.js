const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const router = require('../routes/requestEvidence');
const { requireAdmin } = require('../middleware/auth');

const requestId = 'b589bb5b-894a-408b-8604-d80b92988741';
const evidenceId = '33960e18-b065-496a-ae56-1c2a8302db66';
const adminId = '41ceb086-c217-4ebb-bc92-0f019d3a3ff3';
const handlers = Object.fromEntries(router.stack.map(layer => [layer.route.path, layer.route.stack.at(-1).handle]));

function request(params = {}) {
  return { params: { requestId, evidenceId, ...params }, headers: { authorization: 'Bearer private-admin-token' } };
}
function response() {
  return {
    statusCode: 200, headers: {},
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
  };
}

function setEnv(t, name, value) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  });
}

test('every private evidence endpoint requires an active administrator', () => {
  assert.equal(router.stack.length, 2);
  for (const layer of router.stack) assert.equal(layer.route.stack[0].handle, requireAdmin);
});

test('metadata forwards the administrator bearer and forbids redirects and caches', async t => {
  setEnv(t, 'FASTAPI_URL', 'https://evidence.example.test/');
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ configured: true, items: [] }));
  const res = response();
  await handlers['/:requestId'](request({ evidenceId: undefined }), res);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, `https://evidence.example.test/api/requests/${requestId}/verification-evidence`);
  assert.equal(options.headers.Authorization, 'Bearer private-admin-token');
  assert.equal(options.redirect, 'error');
  assert.equal(options.cache, 'no-store');
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['cache-control'], 'private, no-store');
  assert.deepEqual(res.body, { configured: true, items: [] });
});

test('the production Render backend uses the main API and signs a short-lived credential for the requested image', async t => {
  const key = 'isolated-internal-test-key-at-least-32-characters';
  setEnv(t, 'FASTAPI_URL', undefined);
  setEnv(t, 'RENDER_EXTERNAL_HOSTNAME', 'resqai-platform-backend.onrender.com');
  setEnv(t, 'INTERNAL_API_KEY', key);
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 404 }));
  const res = response();
  await handlers['/:requestId/:evidenceId/image']({ ...request(), admin: { admin_id: adminId } }, res);
  const [url, { headers }] = fetch.mock.calls[0].arguments;
  assert.equal(url, `https://resqai-platform-api.onrender.com/api/requests/${requestId}/verification-evidence/${evidenceId}/image`);
  assert.equal(headers.Authorization, undefined);
  const claims = jwt.verify(headers['X-ResQAI-Evidence-Authorization'], key, {
    algorithms: ['HS256'], audience: 'resqai-request-evidence', issuer: 'resqai-node',
  });
  assert.equal(claims.sub, adminId);
  assert.equal(claims.resource, `${requestId}/${evidenceId}/image`);
  assert.equal(claims.exp - claims.iat, 30);
});

test('an older Python API can still accept the original administrator session', async t => {
  setEnv(t, 'FASTAPI_URL', 'https://evidence.example.test');
  setEnv(t, 'INTERNAL_API_KEY', 'isolated-internal-test-key-at-least-32-characters');
  const fetch = t.mock.method(globalThis, 'fetch', async (_url, { headers }) =>
    headers.Authorization ? Response.json({ configured: true, items: [] }) : new Response(null, { status: 401 }));
  const res = response();
  await handlers['/:requestId']({ ...request({ evidenceId: undefined }), admin: { admin_id: adminId } }, res);
  assert.equal(fetch.mock.calls.length, 2);
  assert.equal(fetch.mock.calls[1].arguments[1].headers.Authorization, 'Bearer private-admin-token');
  assert.equal(res.statusCode, 200);
});

test('image bytes are proxied privately without forwarding a public URL', async t => {
  const bytes = Uint8Array.from([255, 216, 255, 217]);
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(bytes, { headers: { 'Content-Type': 'image/jpeg' } }));
  const res = response();
  await handlers['/:requestId/:evidenceId/image'](request(), res);
  assert.ok(fetch.mock.calls[0].arguments[0].endsWith(`/${evidenceId}/image`));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, Buffer.from(bytes));
  assert.equal(res.headers['content-type'], 'image/jpeg');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['cache-control'], 'private, no-store');
});

test('malformed identifiers cannot influence the upstream request path', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => assert.fail('must reject before proxying'));
  for (const params of [{ requestId: '../identity' }, { evidenceId: 'not-an-id' }]) {
    const res = response();
    await handlers['/:requestId/:evidenceId/image'](request(params), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(fetch.mock.calls.length, 0);
});

test('upstream denial remains denied and never includes private upstream error text', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('secret identity details', { status: 403 }));
  const res = response();
  await handlers['/:requestId/:evidenceId/image'](request(), res);
  assert.equal(res.statusCode, 403);
  assert.ok(!JSON.stringify(res.body).includes('secret'));
});

test('FastAPI token rejection does not invalidate the Node admin session', async t => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response('private upstream details', { status: 401 }));
  for (const [path, params] of [
    ['/:requestId', { evidenceId: undefined }],
    ['/:requestId/:evidenceId/image', {}],
  ]) {
    const res = response();
    await handlers[path](request(params), res);
    assert.equal(res.statusCode, 502);
    assert.match(res.body.error, /could not authenticate/);
    assert.doesNotMatch(res.body.error, /private upstream details/);
    assert.equal(res.headers['cache-control'], 'private, no-store');
  }
});

test('non-JPEG and oversized upstream image responses are rejected', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('<script>private</script>', { headers: { 'Content-Type': 'text/html' } }));
  const nonImage = response();
  await handlers['/:requestId/:evidenceId/image'](request(), nonImage);
  assert.equal(nonImage.statusCode, 502);
  assert.ok(!JSON.stringify(nonImage.body).includes('<script>'));
  fetch.mock.mockImplementation(async () => new Response(new Uint8Array(8 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'image/jpeg' } }));
  const oversized = response();
  await handlers['/:requestId/:evidenceId/image'](request(), oversized);
  assert.equal(oversized.statusCode, 502);
});
