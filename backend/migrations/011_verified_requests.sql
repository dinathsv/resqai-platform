-- Additive upgrade: existing requests stay unverified until a reviewer checks them.
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.help_requests
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_method VARCHAR(40),
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.administrators(admin_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS affected_people INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS location_source VARCHAR(20) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS location_label VARCHAR(255),
  ADD COLUMN IF NOT EXISTS requested_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_note TEXT,
  ADD COLUMN IF NOT EXISTS risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS client_request_id UUID,
  ADD COLUMN IF NOT EXISTS submission_fingerprint VARCHAR(64),
  ADD COLUMN IF NOT EXISTS triage_source VARCHAR(30) NOT NULL DEFAULT 'rules',
  ADD COLUMN IF NOT EXISTS incident_type VARCHAR(40);
ALTER TABLE public.help_requests
  DROP CONSTRAINT IF EXISTS help_requests_verification_status_check,
  ADD CONSTRAINT help_requests_verification_status_check CHECK (verification_status IN ('unverified','needs_information','verified','rejected')),
  DROP CONSTRAINT IF EXISTS help_requests_location_source_check,
  ADD CONSTRAINT help_requests_location_source_check CHECK (location_source IN ('gps','manual','unknown')),
  DROP CONSTRAINT IF EXISTS help_requests_affected_people_check,
  ADD CONSTRAINT help_requests_affected_people_check CHECK (affected_people BETWEEN 1 AND 100000);
CREATE UNIQUE INDEX IF NOT EXISTS help_requests_client_request_id_key ON public.help_requests(client_request_id);
CREATE INDEX IF NOT EXISTS help_requests_verification_queue ON public.help_requests(verification_status, urgency_level DESC, created_at);
ALTER TABLE public.request_status_history ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE TABLE IF NOT EXISTS public.request_verifications (
  verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.help_requests(request_id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.administrators(admin_id) ON DELETE SET NULL,
  decision VARCHAR(30) NOT NULL CHECK (decision IN ('verified','needs_information','rejected')),
  method VARCHAR(40) NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS request_verifications_request_idx ON public.request_verifications(request_id, created_at);
CREATE TABLE IF NOT EXISTS public.mission_status_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.relief_missions(mission_id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.administrators(admin_id) ON DELETE SET NULL,
  old_status VARCHAR(20), new_status VARCHAR(20) NOT NULL,
  notes TEXT NOT NULL, changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
