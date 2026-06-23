CREATE TABLE IF NOT EXISTS public.contest_beta_testers (
  customer_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_touch_contest_beta_testers_updated_at ON public.contest_beta_testers;
CREATE TRIGGER trg_touch_contest_beta_testers_updated_at
BEFORE UPDATE ON public.contest_beta_testers
FOR EACH ROW
EXECUTE FUNCTION public.touch_contest_updated_at();

CREATE INDEX IF NOT EXISTS idx_contest_beta_testers_enabled
  ON public.contest_beta_testers (enabled)
  WHERE enabled = TRUE;

ALTER TABLE public.contest_beta_testers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.contest_beta_testers IS
  'Admin-managed allowlist for private Bete de concours beta access.';
