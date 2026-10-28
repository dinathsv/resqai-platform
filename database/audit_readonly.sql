-- Run in Supabase SQL Editor. Catalog reads only; does not read user records or secrets.
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS database_name, current_user AS sql_editor_role,
       current_setting('search_path') AS search_path,
       current_setting('pgrst.db_schemas', true) AS configured_data_api_schemas;
-- A NULL Data API setting is inconclusive: also inspect Dashboard > Data API > Exposed schemas.
SELECT extname, extversion, n.nspname AS extension_schema
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace ORDER BY extname;
SELECT c.table_name, c.column_name, c.data_type, c.udt_schema, c.udt_name,
       c.character_maximum_length, c.numeric_precision, c.numeric_scale,
       c.is_nullable, c.column_default
FROM information_schema.columns c WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;
SELECT c.relname AS table_name, pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') ORDER BY c.relname;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
SELECT r.rolname, r.rolsuper, r.rolinherit, r.rolcanlogin, r.rolbypassrls
FROM pg_roles r ORDER BY r.rolname;
SELECT parent.rolname AS granted_role, member.rolname AS member_role
FROM pg_auth_members m JOIN pg_roles parent ON parent.oid = m.roleid
JOIN pg_roles member ON member.oid = m.member ORDER BY 1, 2;
-- Effective grants include inherited privileges. PUBLIC grants can affect every role.
SELECT r.rolname, c.relname AS table_name,
       has_schema_privilege(r.oid, n.oid, 'USAGE') AS schema_usage,
       has_table_privilege(r.oid, c.oid, 'SELECT') AS can_select,
       has_table_privilege(r.oid, c.oid, 'INSERT') AS can_insert,
       has_table_privilege(r.oid, c.oid, 'UPDATE') AS can_update,
       has_table_privilege(r.oid, c.oid, 'DELETE') AS can_delete,
       has_table_privilege(r.oid, c.oid, 'TRUNCATE') AS can_truncate
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  AND (r.rolname IN ('anon', 'authenticated', 'service_role', current_user) OR r.rolcanlogin)
ORDER BY c.relname, r.rolname;
SELECT c.relname AS object_name,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type, a.is_grantable
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
ORDER BY c.relname, grantee, privilege_type;
SELECT pg_get_userbyid(d.defaclrole) AS creator_role, n.nspname AS schema_name,
       d.defaclobjtype, d.defaclacl::text AS default_privileges
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace;
SELECT c.relname AS table_name, con.conname, con.contype,
       pg_get_constraintdef(con.oid) AS definition, con.convalidated
FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' ORDER BY c.relname, con.conname;
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename, indexname;
SELECT c.relname AS table_name, t.tgname, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal ORDER BY 1, 2;
SELECT n.nspname AS schema_name, t.typname, e.enumlabel, e.enumsortorder
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder;
SELECT f_table_schema, f_table_name, f_geometry_column, coord_dimension, srid, type
FROM geometry_columns WHERE f_table_schema = 'public' ORDER BY f_table_name;
-- Function execution grants and SECURITY DEFINER functions are additional Data API paths.
SELECT p.oid::regprocedure::text AS function_name, p.prosecdef AS security_definer,
       pg_get_userbyid(p.proowner) AS owner, p.proacl::text AS execution_acl,
       p.proconfig AS function_settings
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' ORDER BY function_name;
SELECT to_regclass('public.schema_migrations') AS migration_ledger;
COMMIT;
-- If the preceding result confirms the ledger exists, run this separately:
-- SELECT version, applied_at FROM public.schema_migrations ORDER BY version;
-- Run under EACH backend connection identity (not only SQL Editor's privileged role):
-- SELECT current_user, session_user, current_setting('search_path');
