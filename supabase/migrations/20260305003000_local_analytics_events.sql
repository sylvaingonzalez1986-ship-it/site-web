BEGIN;

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id bigserial PRIMARY KEY,
  event_name text NOT NULL,
  pathname text NOT NULL,
  source text NOT NULL DEFAULT 'web',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
  ON public.analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_event_name_idx
  ON public.analytics_events (event_name);

CREATE INDEX IF NOT EXISTS analytics_events_pathname_idx
  ON public.analytics_events (pathname);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events_no_direct_access" ON public.analytics_events;
CREATE POLICY "analytics_events_no_direct_access"
  ON public.analytics_events
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

COMMIT;
