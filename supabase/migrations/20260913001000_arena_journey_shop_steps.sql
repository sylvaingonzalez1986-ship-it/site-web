BEGIN;
-- Keep the first edition's progress intact; the expanded visit has its own version.
ALTER TABLE public.arena_journey_progress DROP CONSTRAINT arena_journey_progress_version_check;
ALTER TABLE public.arena_journey_progress DROP CONSTRAINT arena_journey_progress_step_check;
ALTER TABLE public.arena_journey_progress ADD CONSTRAINT arena_journey_progress_version_check CHECK (version IN (1, 2));
ALTER TABLE public.arena_journey_progress ADD CONSTRAINT arena_journey_progress_step_check
  CHECK ((version = 1 AND step BETWEEN 0 AND 4) OR (version = 2 AND step BETWEEN 0 AND 9));
COMMIT;
