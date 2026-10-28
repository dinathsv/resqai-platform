-- Backward-compatible admin workflow support.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.help_requests
  ADD COLUMN IF NOT EXISTS admin_status VARCHAR(20) NOT NULL DEFAULT 'pending';

UPDATE public.help_requests
SET admin_status = CASE
  WHEN status::text IN ('in_progress', 'verified', 'dispatched', 'ai_processing') THEN 'in_progress'
  WHEN status::text IN ('resolved', 'finished') THEN 'finished'
  ELSE 'pending'
END
WHERE admin_status = 'pending';

ALTER TABLE public.relief_missions
  ADD COLUMN IF NOT EXISTS origin_request_id UUID REFERENCES public.help_requests(request_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mission_type VARCHAR(20);

UPDATE public.relief_missions
SET mission_type = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.donations d
    WHERE d.mission_id = relief_missions.mission_id
  ) THEN 'donation'
  ELSE 'help'
END
WHERE mission_type IS NULL;

CREATE TABLE IF NOT EXISTS public.request_status_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.help_requests(request_id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.administrators(admin_id) ON DELETE SET NULL,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_status_history_request
  ON public.request_status_history(request_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_relief_missions_origin_request
  ON public.relief_missions(origin_request_id);

ALTER TABLE public.request_status_history
  DROP CONSTRAINT IF EXISTS request_status_history_status_check,
  ADD CONSTRAINT request_status_history_status_check
  CHECK (new_status IN ('pending', 'in_progress', 'finished'));
