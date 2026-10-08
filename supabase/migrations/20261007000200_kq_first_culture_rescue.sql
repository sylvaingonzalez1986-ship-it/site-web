BEGIN;

-- The database grants the welcome rescue only to the first official culture.
-- Every previous run counts, including abandoned runs and older seasons.
-- No existing state is backfilled or reclassified.
CREATE OR REPLACE FUNCTION public.kq_guard_first_culture_rescue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.state := NEW.state - 'firstCultureRescue';

  IF TG_OP = 'INSERT' THEN
    -- Match the start RPC and equipment/rotation guards' lock order. A second
    -- start waits for the first transaction before checking its durable history.
    PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || NEW.user_id::TEXT, 0));
    IF NOT EXISTS (SELECT 1 FROM public.kq_runs WHERE user_id = NEW.user_id) THEN
      NEW.state := NEW.state || jsonb_build_object('firstCultureRescue', TRUE);
    END IF;
  ELSIF OLD.state->'firstCultureRescue' = 'true'::JSONB THEN
    -- The heritage wrapper writes its original initial state after insertion.
    -- Preserve the database-owned grant through that write and every later save;
    -- the consumed rescue stays recorded in history[].rescued by the game engine.
    NEW.state := NEW.state || jsonb_build_object('firstCultureRescue', TRUE);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.kq_guard_first_culture_rescue()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER kq_guard_first_culture_rescue
BEFORE INSERT OR UPDATE OF state ON public.kq_runs
FOR EACH ROW EXECUTE FUNCTION public.kq_guard_first_culture_rescue();

COMMIT;
