const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ACTIVE_REQUEST_STATUSES,
  generateDashboardReport,
  getDashboardStats,
} = require('../services/dashboardService');

test('dashboard aggregates only nonterminal requests and urgency five is critical', async () => {
  let captured;
  const pool = {
    query: async (sql, params) => {
      captured = { sql, params };
      return {
        rows: [{ active_requests: 3, critical_count: 1, active_alerts: 2, total_donations: 1250 }],
      };
    },
  };

  const stats = await getDashboardStats(pool);

  assert.deepEqual(captured.params[0], ACTIVE_REQUEST_STATUSES);
  assert.match(captured.sql, /urgency_level = 5/);
  assert.match(captured.sql, /expires_at IS NULL OR expires_at > NOW\(\)/);
  assert.match(captured.sql, /status IN \('pending', 'completed'\)/);
  assert.equal(stats.active_requests, 3);
  assert.equal(stats.critical_count, 1);
  assert.equal(stats.active_alerts, 2);
  assert.equal(stats.total_donations, 1250);
});

test('dashboard report summarizes current database aggregates', async () => {
  const pool = {
    query: async (_sql, params) => {
      assert.deepEqual(params[0], ACTIVE_REQUEST_STATUSES);
      return {
        rows: [{
          total_incidents: 4,
          active_requests: 2,
          critical_count: 1,
          urgency_distribution: { 3: 1, 5: 1 },
          type_distribution: { flood: 2 },
        }],
      };
    },
  };

  const report = await generateDashboardReport(pool);

  assert.equal(report.total_incidents, 4);
  assert.equal(report.active_requests, 2);
  assert.equal(report.critical_count, 1);
  assert.match(report.narrative, /2 are currently active/);
  assert.match(report.narrative, /Level 5: 1/);
  assert.match(report.narrative, /flood \(2\)/);
  assert.ok(report.generated_at);
});

test('dashboard report handles an empty request dataset', async () => {
  const pool = {
    query: async () => ({
      rows: [{
        total_incidents: 0,
        active_requests: 0,
        critical_count: 0,
        urgency_distribution: {},
        type_distribution: {},
      }],
    }),
  };

  const report = await generateDashboardReport(pool);

  assert.equal(report.narrative, 'No emergency requests have been recorded yet.');
  assert.equal(report.active_requests, 0);
});