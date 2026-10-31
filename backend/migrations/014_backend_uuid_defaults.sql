-- Legacy ORM-created tables generated these IDs in Python only. Node writes
-- need server defaults too. Existing rows and existing defaults are preserved.
SET LOCAL lock_timeout = '5s';

DO $migration$
DECLARE
    target RECORD;
    column_type TEXT;
    current_default TEXT;
BEGIN
    FOR target IN
        SELECT * FROM (VALUES
            ('agency_chat_messages', 'message_id'),
            ('audit_logs', 'log_id')
        ) AS targets(table_name, column_name)
    LOOP
        SELECT c.udt_name, c.column_default
        INTO column_type, current_default
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = target.table_name
          AND c.column_name = target.column_name;

        IF column_type IS DISTINCT FROM 'uuid' THEN
            RAISE EXCEPTION 'Expected UUID column public.%.%',
                target.table_name, target.column_name;
        END IF;

        IF current_default IS NULL THEN
            EXECUTE format(
                'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT gen_random_uuid()',
                target.table_name, target.column_name
            );
        END IF;
    END LOOP;
END;
$migration$;
