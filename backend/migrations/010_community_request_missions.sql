-- Community acknowledgements create missions before an administrator is assigned.
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.relief_missions ALTER COLUMN admin_id DROP NOT NULL;
