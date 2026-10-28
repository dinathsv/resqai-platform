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
      (SELECT COUNT(*)::int FROM help_requests
       WHERE emergency_type != 'donation') AS help_requests,
      (SELECT COUNT(*)::int FROM help_requests
       WHERE emergency_type = 'donation') AS donation_requests,
      (SELECT COUNT(*)::int FROM relief_missions
       WHERE status = 'active') AS active_missions,
      (SELECT COUNT(*)::int FROM emergency_alerts
       WHERE status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())) AS active_alerts
  `);
  return rows[0];
}

async function generateDashboardReport(pool) {
  const { rows } = await pool.query(
    `SELECT
      (SELECT COUNT(*)::int FROM help_requests WHERE emergency_type != 'donation') AS total_help_requests,
      (SELECT COUNT(*)::int FROM help_requests WHERE emergency_type = 'donation') AS total_donation_requests,
      (SELECT COUNT(*)::int FROM help_requests
       WHERE COALESCE(admin_status, CASE WHEN status::text IN ('resolved','cancelled') THEN 'finished' ELSE 'pending' END) = 'pending') AS pending_requests,
      (SELECT COUNT(*)::int FROM help_requests
       WHERE COALESCE(admin_status, CASE WHEN status::text IN ('resolved','cancelled') THEN 'finished' ELSE 'pending' END) = 'in_progress') AS in_progress_requests,
      (SELECT COUNT(*)::int FROM relief_missions WHERE status = 'active') AS active_missions,
      (SELECT COUNT(*)::int FROM relief_missions WHERE status = 'completed') AS completed_missions,
      (SELECT COUNT(*)::int FROM emergency_alerts WHERE status = 'active'
       AND (expires_at IS NULL OR expires_at > NOW())) AS active_alerts,
      (SELECT COUNT(*)::int FROM (
        SELECT DISTINCT va.user_id FROM volunteer_assignments va
        WHERE va.status IN ('accepted','active','completed')
      ) help_participants) AS help_participants,
      (SELECT COUNT(*)::int FROM (
        SELECT DISTINCT donor_id FROM donations WHERE status IN ('pending','completed')
      ) donation_participants) AS donation_participants
  `);
  const data = rows[0];
  data.statistics = {
    help_requests: data.total_help_requests,
    donation_requests: data.total_donation_requests,
    pending_requests: data.pending_requests,
    in_progress_requests: data.in_progress_requests,
    active_missions: data.active_missions,
    completed_missions: data.completed_missions,
    active_alerts: data.active_alerts,
    help_participants: data.help_participants,
    donation_participants: data.donation_participants,
  };
  data.narrative = `Database summary: ${data.total_help_requests} help requests and ${data.total_donation_requests} donation requests are recorded. ` +
    `${data.pending_requests} are pending and ${data.in_progress_requests} are in progress. ` +
    `${data.active_missions} missions are active and ${data.completed_missions} are completed. ` +
    `${data.active_alerts} alerts are currently active. ` +
    `${data.help_participants} users have participated in help assignments, and ${data.donation_participants} users have donation commitments.`;
  data.generated_at = new Date().toISOString();
  return data;
}

module.exports = {
  ACTIVE_REQUEST_STATUSES,
  generateDashboardReport,
  getDashboardStats,
};