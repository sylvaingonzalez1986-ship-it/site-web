BEGIN;

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS region_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE INDEX IF NOT EXISTS analytics_events_country_code_idx
  ON public.analytics_events (country_code);

CREATE INDEX IF NOT EXISTS analytics_events_city_idx
  ON public.analytics_events (city);

COMMIT;
