const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function harness() {
  let token = 'verified-session';
  let response = new Response(JSON.stringify({ items: [], configured: true }), { status: 200 });
  const calls = [];
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/requestEvidence.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, Date, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => { calls.push({ url, options }); return response; },
    require: name => {
      assert.equal(name, '../config/api');
      return { API_BASE: 'https://api.example.test', getToken: async () => token, parseErrorResponse: async res => (await res.json()).detail };
    },
  });
  return { api: exports, calls, signOut: () => { token = null; }, respond: value => { response = value; } };
}
const image = bytes => `data:image/jpeg;base64,${Buffer.alloc(bytes, 7).toString('base64')}`;

test('evidence image limits count decoded bytes and reject invalid encodings or media types', () => {
  const { api } = harness();
  assert.equal(api.isValidEvidenceImage(image(63)), false);
  assert.equal(api.isValidEvidenceImage(image(64)), true);
  assert.equal(api.isValidEvidenceImage(image(3_000_000)), true);
  assert.equal(api.isValidEvidenceImage(image(3_000_001)), false);
  assert.equal(api.isValidEvidenceImage(image(100).replace('image/jpeg', 'text/html')), false);
  assert.equal(api.isValidEvidenceImage(image(100).replace(/.$/, '!')), false);
});

test('expired or malformed camera challenges cannot be reused', () => {
  const { api } = harness();
  const now = Date.parse('2026-11-04T00:00:00Z');
  const challenge = { challenge_id: 'session', challenge_code: '012345', prompt: 'Write code 012345 on paper and hold it beside your face.', expires_at: new Date(now + 1).toISOString() };
  assert.equal(api.isActiveEvidenceChallenge(challenge, now), true);
  assert.equal(api.isActiveEvidenceChallenge(challenge, now + 1), false);
  assert.equal(api.isActiveEvidenceChallenge({ ...challenge, expires_at: 'invalid' }, now), false);
  assert.equal(api.isActiveEvidenceChallenge({ ...challenge, prompt: '' }, now), false);
  assert.equal(api.isActiveEvidenceChallenge(null, now), false);
});

test('private uploads require authentication before any network request', async () => {
  const h = harness(); h.signOut();
  await assert.rejects(h.api.evidenceRequest('request-id', 'POST', { nic_image: image(100) }), /Sign in/);
  assert.equal(h.calls.length, 0);
});

test('the photo pair goes only to the authenticated private endpoint with caching disabled', async () => {
  const h = harness();
  const pair = { challenge_id: 'challenge-id', nic_image: image(100), selfie_image: image(101), captured_at: '2026-11-04T00:00:00Z', consent: true };
  await h.api.evidenceRequest('request-id', 'POST', pair);
  assert.equal(h.calls[0].url, 'https://api.example.test/api/requests/request-id/verification-evidence');
  assert.equal(h.calls[0].options.headers.Authorization, 'Bearer verified-session');
  assert.equal(h.calls[0].options.headers['Cache-Control'], 'no-store');
  assert.equal(h.calls[0].options.cache, 'no-store');
  assert.equal(h.calls[0].options.redirect, 'error');
  assert.deepEqual(JSON.parse(h.calls[0].options.body), pair);
});

test('challenge creation sends no photo payload and deletion supports an empty response', async () => {
  const h = harness();
  await h.api.evidenceRequest('request-id', 'POST', undefined, true);
  assert.equal(h.calls[0].url.endsWith('/verification-evidence/challenge'), true);
  assert.equal(h.calls[0].options.body, undefined);
  h.respond(new Response(null, { status: 204 }));
  assert.equal(await h.api.evidenceRequest('request-id', 'DELETE'), undefined);
  assert.equal(h.calls[1].options.method, 'DELETE');
});

test('a rejected evidence upload exposes the server reason and is never retried automatically', async () => {
  const h = harness(); h.respond(new Response(JSON.stringify({ detail: 'Camera session expired' }), { status: 409 }));
  await assert.rejects(h.api.evidenceRequest('request-id', 'POST', { consent: true }), /Camera session expired/);
  assert.equal(h.calls.length, 1);
});
