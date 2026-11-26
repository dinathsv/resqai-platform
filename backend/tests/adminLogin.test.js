const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const signingKey = 'isolated-admin-login-test-key-at-least-32-characters';
process.env.JWT_SECRET = signingKey;
const router = require('../routes/auth');
const login = router.stack.find(layer => layer.route?.path === '/login').route.stack[0].handle;

const password = 'test-only-coordinator-passphrase';
const admin = {
  admin_id: 'b589bb5b-894a-408b-8604-d80b92988741',
  email: 'coordinator@example.test',
  full_name: 'Test coordinator',
  is_active: true,
  password_hash: bcrypt.hashSync(password, 4),
};

async function submitLogin(suppliedPassword, account = admin, email = admin.email) {
  const queries = [];
  const req = {
    body: { email, password: suppliedPassword },
    app: { locals: { pool: {
      async query(sql, params) {
        queries.push({ sql, params });
        return { rows: [account] };
      },
    } } },
  };
  const res = {
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await login(req, res);
  return { ...res, queries };
}

test('a wrong administrator password creates no session and changes no account data', async () => {
  const { code, body, queries } = await submitLogin('different-test-passphrase');
  assert.equal(code, 401);
  assert.deepEqual(body, { success: false, error: 'Invalid email or password' });
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /^\s*SELECT\s/i);
});

test('a correct password creates an admin session using a normalized email lookup', async () => {
  const { code, body, queries } = await submitLogin(password, admin, ` ${admin.email.toUpperCase()} `);
  assert.equal(code, 200);
  const claims = jwt.verify(body.access_token, signingKey, { algorithms: ['HS256'] });
  assert.equal(claims.sub, admin.admin_id);
  assert.equal(claims.role, 'admin');
  assert.deepEqual(queries[0].params, [admin.email]);
});

test('an administrator without a stored hash cannot use the dummy password check', async t => {
  t.mock.method(bcrypt, 'compare', async () => true);
  const { code, body } = await submitLogin(password, { ...admin, password_hash: '' });
  assert.equal(code, 401);
  assert.equal(body.access_token, undefined);
});

test('a disabled administrator stays disabled even with a correct password', async () => {
  const { code, body, queries } = await submitLogin(password, { ...admin, is_active: false });
  assert.equal(code, 403);
  assert.equal(body.access_token, undefined);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /^\s*SELECT\s/i);
});

test('administrator login rejects passwords above the bcrypt byte limit', async () => {
  const { code, body, queries } = await submitLogin('é'.repeat(37));
  assert.equal(code, 400);
  assert.equal(body.access_token, undefined);
  assert.equal(queries.length, 0);
});
