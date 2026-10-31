const test = require('node:test');
const assert = require('node:assert/strict');
const { generateDashboardReport, getDashboardStats } = require('../services/dashboardService');

const statistics = { help_requests: 4, donation_requests: 2, active_missions: 3, active_alerts: 1,
  awaiting_verification: 2, urgent_waiting: 1, fulfilled_requests: 2, goods_pledges: 4,
  confirmed_deliveries: 3, disputed_deliveries: 1, average_verification_minutes: null };

test('operational dashboard includes unverified urgent reports without labeling them as confirmed', async () => {
  const pool = { query: async sql => {
    assert.match(sql, /urgency_level >= 4 AND admin_status='pending'/);
    assert.match(sql, /verification_status IN \('unverified','needs_information'\)/);
    assert.doesNotMatch(sql, /SUM\(amount\)/);
    return { rows: [statistics] };
  } };
  assert.deepEqual(await getDashboardStats(pool), statistics);
});

test('report keeps different goods units separate and exposes review workload and disputes', async () => {
  let calls = 0;
  const goods = [{ item_name: 'rice', unit: 'kg', delivered_quantity: 10 }, { item_name: 'water', unit: 'bottles', delivered_quantity: 20 }];
  const pool = { query: async sql => {
    if (++calls === 1) return { rows: [statistics] };
    assert.match(sql, /GROUP BY n.item_name,n.unit/);
    assert.match(sql, /goods_status!='cancelled'/);
    return { rows: goods };
  } };
  const report = await generateDashboardReport(pool);
  assert.deepEqual(report.goods, goods);
  assert.equal(report.statistics.average_verification_minutes, null);
  assert.match(report.narrative, /2 requests await verification; 1 urgent requests/);
  assert.match(report.narrative, /1 delivery disputes/);
  assert.equal(report.source, 'Operational database snapshot');
  assert.ok(report.generated_at);
});

test('an empty report has no invented completion times or AI claims', async () => {
  let calls = 0;
  const empty = Object.fromEntries(Object.keys(statistics).map(key => [key, key.includes('minutes') ? null : 0]));
  const report = await generateDashboardReport({ query: async () => ({ rows: ++calls === 1 ? [empty] : [] }) });
  assert.equal(report.statistics.fulfilled_requests, 0);
  assert.equal(report.statistics.average_verification_minutes, null);
  assert.deepEqual(report.goods, []);
  assert.doesNotMatch(report.narrative, /AI-generated|predicted|guaranteed/i);
});
