const test = require('node:test');
const assert = require('node:assert/strict');

const { generateDashboardReport, getDashboardStats } = require('../services/dashboardService');

test('dashboard returns separate help, donation, mission, and alert totals', async () => {
  const pool = { query: async () => ({ rows: [{ help_requests: 4, donation_requests: 2, active_missions: 3, active_alerts: 1 }] }) };
  const stats = await getDashboardStats(pool);
  assert.deepEqual(stats, { help_requests: 4, donation_requests: 2, active_missions: 3, active_alerts: 1 });
  assert.equal('critical_count' in stats, false);
  assert.equal('total_donations' in stats, false);
});

test('dashboard report excludes urgency and includes participation statistics', async () => {
  const pool = { query: async () => ({ rows: [{ total_help_requests: 4, total_donation_requests: 2, pending_requests: 3, in_progress_requests: 1, active_missions: 2, completed_missions: 1, active_alerts: 1, help_participants: 5, donation_participants: 3 }] }) };
  const report = await generateDashboardReport(pool);
  assert.equal(report.statistics.help_requests, 4);
  assert.equal(report.statistics.donation_requests, 2);
  assert.equal(report.statistics.help_participants, 5);
  assert.equal(report.statistics.donation_participants, 3);
  assert.doesNotMatch(report.narrative, /urgency|critical/i);
  assert.ok(report.generated_at);
});

test('dashboard report handles empty database counts', async () => {
  const pool = { query: async () => ({ rows: [{ total_help_requests: 0, total_donation_requests: 0, pending_requests: 0, in_progress_requests: 0, active_missions: 0, completed_missions: 0, active_alerts: 0, help_participants: 0, donation_participants: 0 }] }) };
  const report = await generateDashboardReport(pool);
  assert.equal(report.statistics.help_requests, 0);
  assert.match(report.narrative, /0 help requests and 0 donation requests/);
});