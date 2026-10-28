-- Add nic_photo support to guest_sessions for photo-based verification
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.guest_sessions
    ADD COLUMN IF NOT EXISTS nic_photo TEXT,
    ALTER COLUMN nic_number DROP NOT NULL,
    ALTER COLUMN nic_number TYPE VARCHAR(50);
