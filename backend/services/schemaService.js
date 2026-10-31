// Read-only readiness checks. Only database/run_migrations.py owns schema DDL.
async function checkSchema(pool) {
  await pool.query('SELECT avatar_url, user_type, is_active FROM public.users LIMIT 0');
  await pool.query('SELECT district, origin_request_id, mission_type FROM public.relief_missions LIMIT 0');
  await pool.query('SELECT alert_id, admin_id, affected_zone, status FROM public.emergency_alerts LIMIT 0');
  await pool.query('SELECT admin_status, verification_status, requested_items, client_request_id FROM public.help_requests LIMIT 0');
  await pool.query('SELECT origin_request_id, mission_type FROM public.relief_missions LIMIT 0');
  await pool.query('SELECT need_id, required_quantity FROM public.mission_needs LIMIT 0');
  await pool.query('SELECT quantity, goods_status, delivered_quantity FROM public.donations LIMIT 0');
  await pool.query('SELECT recipient_id, status FROM public.goods_deliveries LIMIT 0');
  await pool.query('SELECT event_id, operation_id FROM public.goods_events LIMIT 0');
  await pool.query('SELECT notes FROM public.request_status_history LIMIT 0');
  await pool.query('SELECT decision FROM public.request_verifications LIMIT 0');
  await pool.query('SELECT notes FROM public.mission_status_history LIMIT 0');
  await pool.query('SELECT recipient_confirmed_at, completion_review_reason FROM public.volunteer_assignments LIMIT 0');
}

module.exports = { checkSchema };
