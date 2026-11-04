SET LOCAL lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS public.request_evidence (
  evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.help_requests(request_id) ON DELETE CASCADE,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('nic', 'selfie')),
  encrypted_image BYTEA NOT NULL,
  challenge_prompt VARCHAR(150) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT request_evidence_request_kind_key UNIQUE (request_id, kind)
);
CREATE INDEX IF NOT EXISTS ix_request_evidence_expires_at ON public.request_evidence(expires_at);
