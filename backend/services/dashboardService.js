const ACTIVE_REQUEST_STATUSES = Object.freeze(['pending', 'ai_processing', 'verified', 'dispatched', 'in_progress']);

async function getDashboardStats(pool) {
  const { rows } = await pool.query(`SELECT
    (SELECT COUNT(*)::int FROM help_requests WHERE emergency_type != 'donation') AS help_requests,
    (SELECT COUNT(*)::int FROM help_requests WHERE emergency_type = 'donation') AS donation_requests,
    (SELECT COUNT(*)::int FROM help_requests WHERE verification_status IN ('unverified','needs_information') AND status::text NOT IN ('resolved','cancelled')) AS awaiting_verification,
    (SELECT COUNT(*)::int FROM help_requests WHERE urgency_level >= 4 AND admin_status='pending' AND verification_status!='rejected' AND status::text NOT IN ('resolved','cancelled')) AS urgent_waiting,
    (SELECT COUNT(*)::int FROM help_requests WHERE admin_status='pending' AND verification_status!='rejected' AND status::text NOT IN ('resolved','cancelled')) AS pending_requests,
    (SELECT COUNT(*)::int FROM help_requests WHERE admin_status='in_progress' AND status::text NOT IN ('resolved','cancelled')) AS in_progress_requests,
    (SELECT COUNT(*)::int FROM help_requests WHERE status='resolved') AS fulfilled_requests,
    (SELECT COUNT(*)::int FROM relief_missions WHERE status='active') AS active_missions,
    (SELECT COUNT(*)::int FROM relief_missions WHERE status='completed') AS completed_missions,
    (SELECT COUNT(*)::int FROM emergency_alerts WHERE status='active' AND (expires_at IS NULL OR expires_at>NOW())) AS active_alerts,
    (SELECT COUNT(DISTINCT user_id)::int FROM volunteer_assignments WHERE status IN ('accepted','active','completed')) AS help_participants,
    (SELECT COUNT(DISTINCT donor_id)::int FROM donations WHERE need_id IS NOT NULL AND goods_status!='cancelled') AS donation_participants,
    (SELECT COUNT(*)::int FROM donations WHERE need_id IS NOT NULL AND goods_status!='cancelled') AS goods_pledges,
    (SELECT COUNT(*)::int FROM goods_deliveries WHERE status='delivered') AS confirmed_deliveries,
    (SELECT COUNT(*)::int FROM goods_deliveries WHERE status='disputed') AS disputed_deliveries,
    (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (verified_at-created_at))/60)::numeric,1) FROM help_requests WHERE verification_status='verified') AS average_verification_minutes,
    (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at-created_at))/60)::numeric,1) FROM help_requests WHERE status='resolved' AND resolved_at IS NOT NULL) AS average_resolution_minutes
  `);
  return rows[0];
}

async function generateDashboardReport(pool) {
  const statistics = await getDashboardStats(pool);
  // Only matching item/unit pairs are aggregated; kilograms and packages are never added together.
  const goods = await pool.query(`
    SELECT n.item_name, n.unit, SUM(n.required_quantity)::numeric AS required_quantity,
           SUM(COALESCE(p.pledged_quantity,0))::numeric AS pledged_quantity,
           SUM(COALESCE(p.received_quantity,0))::numeric AS received_quantity,
           SUM(COALESCE(p.dispatched_quantity,0))::numeric AS dispatched_quantity,
           SUM(COALESCE(p.delivered_quantity,0))::numeric AS delivered_quantity
    FROM mission_needs n JOIN relief_missions m ON m.mission_id=n.mission_id
    LEFT JOIN LATERAL (
      SELECT SUM(quantity) AS pledged_quantity, SUM(received_quantity) AS received_quantity,
             SUM(dispatched_quantity) AS dispatched_quantity, SUM(delivered_quantity) AS delivered_quantity
      FROM donations WHERE need_id=n.need_id AND goods_status!='cancelled'
    ) p ON TRUE WHERE m.status!='cancelled'
    GROUP BY n.item_name,n.unit ORDER BY n.item_name,n.unit`);
  return {
    statistics,
    goods: goods.rows,
    narrative: `Database summary: ${statistics.help_requests} help requests and ${statistics.donation_requests} goods requests are recorded. ` +
      `${statistics.awaiting_verification} requests await verification; ${statistics.urgent_waiting} urgent requests await a response. ` +
      `${statistics.active_missions} missions are active and ${statistics.fulfilled_requests} requests are resolved. ` +
      `${statistics.confirmed_deliveries} deliveries are confirmed; ${statistics.disputed_deliveries} delivery disputes require review.`,
    source: 'Operational database snapshot',
    generated_at: new Date().toISOString(),
  };
}

module.exports = { ACTIVE_REQUEST_STATUSES, generateDashboardReport, getDashboardStats };
