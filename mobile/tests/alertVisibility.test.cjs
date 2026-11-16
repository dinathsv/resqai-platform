const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');

function load(name, dependencies = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, `../services/${name}.ts`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: dependency => {
    if (Object.hasOwn(dependencies, dependency)) return dependencies[dependency];
    throw new Error(`Unexpected dependency: ${dependency}`);
  } });
  return exports;
}
const visibility = load('alertVisibility');
const ids = rows => Array.from(rows, row => row.alert_id).sort();

function storageHarness() {
  const database = new DatabaseSync(':memory:');
  const connection = {
    execSync: sql => database.exec(sql),
    runSync: (sql, parameters = []) => database.prepare(sql).run(...parameters),
    getAllSync: sql => database.prepare(sql).all(),
    withTransactionSync: callback => {
      database.exec('BEGIN');
      try { callback(); database.exec('COMMIT'); }
      catch (error) { database.exec('ROLLBACK'); throw error; }
    },
    closeSync: () => database.close(),
  };
  const api = load('offlineStorage', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-sqlite': { openDatabaseSync: () => connection },
    './alertVisibility': visibility,
  });
  return { api, database, close: () => database.close() };
}

test('only explicitly verified community requests appear while administrator broadcasts remain visible', () => {
  const feed = [
    { alert_id: 'unverified', source: 'community_request', disaster_type: 'help_rescue', verification_status: 'unverified' },
    { alert_id: 'needs-info', source: 'community_request', disaster_type: 'donation', verification_status: 'needs_information' },
    { alert_id: 'rejected', source: 'community_request', disaster_type: 'flood', verification_status: 'rejected' },
    { alert_id: 'unknown', source: 'community_request', disaster_type: 'medical', verification_status: 'future_status' },
    { alert_id: 'no-status', source: 'community_request', disaster_type: 'fire' },
    { alert_id: 'verified', source: 'community_request', disaster_type: 'help_rescue', verification_status: 'verified' },
    { alert_id: 'broadcast', source: 'admin_alert', disaster_type: 'flood' },
    { alert_id: 'request-type-broadcast', source: 'admin_alert', disaster_type: 'help_rescue' },
  ];
  assert.deepEqual(ids(visibility.visibleAlerts(feed)), ['broadcast', 'request-type-broadcast', 'verified']);
});

test('legacy help and goods alerts with missing review metadata are never assumed approved', () => {
  const feed = [
    { alert_id: 'help', disaster_type: 'help_rescue' },
    { alert_id: 'goods', disaster_type: 'donation', verification_status: null },
    { alert_id: 'unknown-review', disaster_type: 'medical', verification_status: '' },
    { alert_id: 'old-approved', disaster_type: 'help_rescue', verification_status: 'verified' },
    { alert_id: 'old-broadcast', disaster_type: 'flood' },
  ];
  assert.deepEqual(ids(visibility.visibleAlerts(feed)), ['old-approved', 'old-broadcast']);
});

test('legacy SQLite cache upgrade drops unreviewed requests, preserves broadcasts and accepts UUID IDs', () => {
  const h = storageHarness();
  try {
    h.database.exec(`CREATE TABLE cached_alerts (
      alert_id INTEGER PRIMARY KEY, disaster_type TEXT, work_plan TEXT, severity INTEGER, zone TEXT, cached_at TEXT
    ); INSERT INTO cached_alerts VALUES
      (1, 'flood', 'Administrator evacuation notice', 4, 'Colombo', '2026-11-15'),
      (2, 'help_rescue', 'Unverified help request', 3, NULL, '2026-11-15'),
      (3, 'donation', 'Unverified goods assistance request', 2, NULL, '2026-11-15');`);
    h.api.initDB();
    assert.deepEqual(ids(h.api.getCachedAlerts()), ['1']);
    assert.deepEqual(ids(h.database.prepare('SELECT alert_id FROM cached_alerts').all()), ['1']);
    const columns = h.database.prepare('PRAGMA table_info(cached_alerts)').all();
    assert.equal(columns.find(column => column.name === 'alert_id').type, 'TEXT');
    assert.ok(columns.some(column => column.name === 'verification_status'));
    const requestId = '6d8d24bc-9bba-43f6-8d62-68cf7196993c';
    h.api.cacheAlerts([{ alert_id: requestId, disaster_type: 'help_rescue', source: 'community_request', verification_status: 'verified', severity: 3 }]);
    const stored = h.api.getCachedAlerts()[0];
    assert.equal(stored.alert_id, requestId);
    assert.equal(stored.verification_status, 'verified');
    assert.equal(stored.source, 'community_request');
  } finally { h.close(); }
});

test('cache writes reject pending requests and cache reads recheck approval metadata', () => {
  const h = storageHarness();
  try {
    h.api.initDB();
    h.api.cacheAlerts([
      { alert_id: 'approved', source: 'community_request', disaster_type: 'help_rescue', verification_status: 'verified' },
      { alert_id: 'pending', source: 'community_request', disaster_type: 'help_rescue', verification_status: 'unverified' },
      { alert_id: 'broadcast', source: 'admin_alert', disaster_type: 'donation' },
    ]);
    assert.deepEqual(ids(h.database.prepare('SELECT alert_id FROM cached_alerts').all()), ['approved', 'broadcast']);
    h.database.exec("UPDATE cached_alerts SET verification_status='rejected' WHERE alert_id='approved'");
    assert.deepEqual(ids(h.api.getCachedAlerts()), ['broadcast']);
    h.api.cacheAlerts([]);
    assert.deepEqual(ids(h.api.getCachedAlerts()), []);
  } finally { h.close(); }
});
