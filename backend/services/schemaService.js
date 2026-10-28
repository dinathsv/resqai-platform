// Read-only readiness checks. Only database/run_migrations.py owns schema DDL.
async function checkSchema(pool) {
  await pool.query('SELECT avatar_url, user_type, is_active FROM public.users LIMIT 0');
  await pool.query('SELECT district, target, funds_collected FROM public.relief_missions LIMIT 0');
  await pool.query('SELECT alert_id, admin_id, affected_zone, status FROM public.emergency_alerts LIMIT 0');
}

module.exports = { checkSchema };
