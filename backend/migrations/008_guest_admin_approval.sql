-- Migration 008: Add admin approval columns to guest_sessions table
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.guest_sessions
  ADD COLUMN IF NOT EXISTS admin_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_guest_admin_status ON public.guest_sessions (admin_status);
