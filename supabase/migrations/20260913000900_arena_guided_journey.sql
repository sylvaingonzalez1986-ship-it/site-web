BEGIN;
CREATE TABLE public.arena_journey_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version=1),
  step INTEGER NOT NULL DEFAULT 0 CHECK(step BETWEEN 0 AND 4),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','active','completed','skipped')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,version)
);
ALTER TABLE public.arena_journey_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.arena_journey_progress FROM anon,authenticated;
GRANT ALL ON public.arena_journey_progress TO service_role;
COMMIT;
