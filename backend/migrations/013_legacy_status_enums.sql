-- ORM-created installations used VARCHAR for these three lifecycle columns.
-- Validate everything before DDL; never rewrite unknown statuses or defaults.
-- The migration runner owns the transaction, including the migration ledger.
SET LOCAL lock_timeout = '5s';

DO $migration$
DECLARE
    target RECORD;
    enum_oid pg_catalog.oid;
    enum_kind "char";
    enum_labels TEXT[];
    source_oid pg_catalog.oid;
    source_schema TEXT;
    source_name TEXT;
    default_expression TEXT;
    default_literal TEXT;
    invalid_values BOOLEAN;
    needs_conversion BOOLEAN;
    plans JSONB := '[]'::pg_catalog.jsonb;
    plan JSONB;
    quoted_labels TEXT;
BEGIN
    -- Prevent a concurrent writer introducing an unchecked value before ALTER.
    LOCK TABLE public.relief_missions, public.volunteer_assignments,
               public.donations IN ACCESS EXCLUSIVE MODE;

    FOR target IN
        SELECT * FROM (VALUES
            ('relief_missions', 'mission_status',
             ARRAY['planning', 'active', 'paused', 'completed', 'cancelled']::TEXT[]),
            ('volunteer_assignments', 'assignment_status',
             ARRAY['pending', 'accepted', 'active', 'completed', 'withdrawn']::TEXT[]),
            ('donations', 'donation_status',
             ARRAY['pending', 'completed', 'failed', 'refunded']::TEXT[])
        ) AS targets(table_name, enum_name, required_labels)
    LOOP
        SELECT t.oid, t.typtype INTO enum_oid, enum_kind
        FROM pg_catalog.pg_type AS t
        JOIN pg_catalog.pg_namespace AS n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = target.enum_name;

        IF enum_oid IS NOT NULL THEN
            SELECT pg_catalog.array_agg(e.enumlabel::TEXT ORDER BY e.enumsortorder)
            INTO enum_labels
            FROM pg_catalog.pg_enum AS e WHERE e.enumtypid = enum_oid;
            IF enum_kind <> 'e' OR NOT (target.required_labels <@ enum_labels)
               OR enum_labels IS NULL THEN
                RAISE EXCEPTION 'Cannot upgrade public.%: expected an enum containing all required lifecycle labels', target.enum_name;
            END IF;
        ELSE
            enum_labels := target.required_labels;
        END IF;

        SELECT a.atttypid, tn.nspname, t.typname,
               pg_catalog.pg_get_expr(d.adbin, d.adrelid)
        INTO source_oid, source_schema, source_name, default_expression
        FROM pg_catalog.pg_attribute AS a
        JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_type AS t ON t.oid = a.atttypid
        JOIN pg_catalog.pg_namespace AS tn ON tn.oid = t.typnamespace
        LEFT JOIN pg_catalog.pg_attrdef AS d
          ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE n.nspname = 'public' AND c.relname = target.table_name
          AND a.attname = 'status' AND NOT a.attisdropped;

        IF source_oid IS NULL THEN
            RAISE EXCEPTION 'Cannot upgrade public.%.status: column is missing', target.table_name;
        END IF;
        needs_conversion := enum_oid IS NULL OR source_oid <> enum_oid;
        IF needs_conversion THEN
            IF source_schema <> 'pg_catalog' OR source_name NOT IN ('varchar', 'text') THEN
                RAISE EXCEPTION 'Cannot upgrade public.%.status: expected VARCHAR, TEXT, or the matching public enum', target.table_name;
            END IF;

            EXECUTE pg_catalog.format(
                'SELECT EXISTS (SELECT 1 FROM public.%I WHERE status IS NOT NULL AND NOT (status::pg_catalog.text = ANY ($1)))',
                target.table_name
            ) INTO invalid_values USING enum_labels;
            IF invalid_values THEN
                RAISE EXCEPTION 'Cannot upgrade public.%.status: unsupported status values require review', target.table_name;
            END IF;

            -- Only known literal defaults are safe to preserve automatically.
            -- Do not evaluate arbitrary expressions (which may have side effects).
            IF default_expression IS NOT NULL THEN
                default_literal := pg_catalog.regexp_replace(default_expression,
                    '::(character varying|text)(\([0-9]+\))?$', '');
                IF default_literal <> 'NULL' AND NOT EXISTS (
                    SELECT 1 FROM pg_catalog.unnest(enum_labels) AS label(value)
                    WHERE default_literal = pg_catalog.quote_literal(label.value)
                ) THEN
                    RAISE EXCEPTION 'Cannot upgrade public.%.status: unsupported or invalid default requires review', target.table_name;
                END IF;
            END IF;
        END IF;

        plans := plans || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'table_name', target.table_name, 'enum_name', target.enum_name,
            'required_labels', target.required_labels, 'needs_type', enum_oid IS NULL,
            'needs_conversion', needs_conversion, 'default_expression', default_expression));
    END LOOP;

    FOR plan IN SELECT value FROM pg_catalog.jsonb_array_elements(plans)
    LOOP
        IF (plan->>'needs_type')::BOOLEAN THEN
            SELECT pg_catalog.string_agg(pg_catalog.quote_literal(value), ', ')
            INTO quoted_labels
            FROM pg_catalog.jsonb_array_elements_text(plan->'required_labels');
            EXECUTE pg_catalog.format('CREATE TYPE public.%I AS ENUM (%s)',
                                      plan->>'enum_name', quoted_labels);
        END IF;
        IF (plan->>'needs_conversion')::BOOLEAN THEN
            -- PostgreSQL cannot implicitly cast an old VARCHAR/TEXT default.
            EXECUTE pg_catalog.format('ALTER TABLE public.%I ALTER COLUMN status DROP DEFAULT',
                                      plan->>'table_name');
            EXECUTE pg_catalog.format(
                'ALTER TABLE public.%I ALTER COLUMN status TYPE public.%I USING status::pg_catalog.text::public.%I',
                plan->>'table_name', plan->>'enum_name', plan->>'enum_name');
            IF plan->>'default_expression' IS NOT NULL THEN
                EXECUTE pg_catalog.format(
                    'ALTER TABLE public.%I ALTER COLUMN status SET DEFAULT (%s)::pg_catalog.text::public.%I',
                    plan->>'table_name', plan->>'default_expression', plan->>'enum_name');
            END IF;
        END IF;
    END LOOP;
END
$migration$;
