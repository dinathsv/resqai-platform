-- Forward-only repair of columns required by both APIs. No existing rows are removed.
-- Repeat avatar addition deliberately: it also repairs databases whose 002 ledger
-- entry exists but whose physical schema has drifted. Refuse incompatible types below.
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS user_type VARCHAR(50) DEFAULT 'Citizen',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = 'avatar_url' AND data_type = 'text'
          AND is_nullable = 'YES' AND column_default IS NULL
    ) THEN
        RAISE EXCEPTION 'users.avatar_url must be nullable TEXT without a default; inspect schema before proceeding';
    END IF;
END $$;

ALTER TABLE public.relief_missions
    ADD COLUMN IF NOT EXISTS district VARCHAR(100),
    ADD COLUMN IF NOT EXISTS target NUMERIC(12,2) NOT NULL DEFAULT 0;

-- These values were previously added by FastAPI startup DDL.
ALTER TYPE public.emergency_type ADD VALUE IF NOT EXISTS 'donation';
ALTER TYPE public.emergency_type ADD VALUE IF NOT EXISTS 'help_rescue';
