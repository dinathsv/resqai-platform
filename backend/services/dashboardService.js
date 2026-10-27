const ACTIVE_REQUEST_STATUSES = Object.freeze([
  'pending',
  'ai_processing',
  'verified',
  'dispatched',
  'in_progress',
]);

async function getDashboardStats(pool) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int
        FROM help_requests
        WHERE status = ANY($1::request_status[])) AS active_requests,
       (SELECT COUNT(*)::int
        FROM help_requests
        WHERE urgency_level = 5
          AND status = ANY($1::request_status[])) AS critical_count,
       (SELECT COUNT(*)::int
        FROM emergency_alerts
        WHERE status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())) AS active_alerts,
       (SELECT COALESCE(SUM(amount), 0)::float
        FROM donations
      WHERE status IN ('pending', 'completed')) AS total_donations`,
    [ACTIVE_REQUEST_STATUSES],
  );

  return rows[0];
}

async function generateDashboardReport(pool) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM help_requests) AS total_incidents,
       (SELECT COUNT(*)::int FROM help_requests
        WHERE status = ANY($1::request_status[])) AS active_requests,
       (SELECT COUNT(*)::int FROM help_requests
        WHERE urgency_level = 5
          AND status = ANY($1::request_status[])) AS critical_count,
       (SELECT COALESCE(json_object_agg(urgency_level, request_count), '{}'::json)
        FROM (
          SELECT urgency_level, COUNT(*)::int AS request_count
          FROM help_requests
          WHERE status = ANY($1::request_status[])
          GROUP BY urgency_level
        ) urgency_counts) AS urgency_distribution,
       (SELECT COALESCE(json_object_agg(emergency_type, request_count), '{}'::json)
        FROM (
          SELECT emergency_type, COUNT(*)::int AS request_count
          FROM help_requests
          WHERE status = ANY($1::request_status[])
          GROUP BY emergency_type
        ) type_counts) AS type_distribution`,
    [ACTIVE_REQUEST_STATUSES],
  );

  const report = rows[0];
  const urgency = Object.entries(report.urgency_distribution || {})
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([level, count]) => `Level ${level}: ${count}`)
    .join(', ') || 'No active requests';
  const types = Object.entries(report.type_distribution || {})
    .sort(([, left], [, right]) => Number(right) - Number(left))
    .map(([type, count]) => `${type.replaceAll('_', ' ')} (${count})`)
    .join(', ') || 'none';

  report.narrative = report.total_incidents === 0
    ? 'No emergency requests have been recorded yet.'
    : `There are ${report.total_incidents} recorded emergency requests. ` +
      `${report.active_requests} are currently active, including ${report.critical_count} ` +
      `critical case${report.critical_count === 1 ? '' : 's'} (urgency level 5). ` +
      `Active request urgency distribution: ${urgency}. ` +
      `Active request types: ${types}.`;
  report.generated_at = new Date().toISOString();
  return report;
}

module.exports = {
  ACTIVE_REQUEST_STATUSES,
  generateDashboardReport,
  getDashboardStats,
};