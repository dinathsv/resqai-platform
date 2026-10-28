-- Add phone verification fields used by the guest authentication workflow.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.guest_sessions
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.guest_sessions
SET phone_verified = FALSE
WHERE phone_verified IS NULL;
