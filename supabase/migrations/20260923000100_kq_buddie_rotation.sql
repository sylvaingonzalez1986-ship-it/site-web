BEGIN;

-- Keep historical starts and new starts consistent while installing the guard.
LOCK TABLE public.kq_runs IN SHARE ROW EXCLUSIVE MODE;

-- A player must start cultures with five other distinct Buddies before reuse.
-- This history belongs to the player, across seasons and physical card copies.
-- A successfully started culture counts even if it later dies or is abandoned.
CREATE TABLE IF NOT EXISTS public.kq_buddie_rotation (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  recent_buddie_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cardinality(recent_buddie_codes) <= 5),
  CHECK (array_position(recent_buddie_codes, NULL) IS NULL)
);

ALTER TABLE public.kq_buddie_rotation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_buddie_rotation FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.kq_buddie_rotation FROM service_role;
GRANT SELECT ON TABLE public.kq_buddie_rotation TO service_role;

COMMENT ON COLUMN public.kq_buddie_rotation.recent_buddie_codes IS
  'Five most recently used distinct Buddie codes, newest first; missing codes are available.';

-- Deduplicate before limiting: repeated historical uses of the same card must
-- not falsely count as several distinct Buddies. Include every run status.
WITH latest_use AS (
  SELECT DISTINCT ON (run.user_id, definition.code)
    run.user_id, definition.code, run.started_at, run.id
  FROM public.kq_runs run
  JOIN public.lottery_card_definitions definition ON definition.id = run.buddie_card_definition_id
  ORDER BY run.user_id, definition.code, run.started_at DESC, run.id DESC
), ranked AS (
  SELECT *, row_number() OVER (
    PARTITION BY user_id ORDER BY started_at DESC, id DESC
  ) AS recency
  FROM latest_use
)
INSERT INTO public.kq_buddie_rotation(user_id, recent_buddie_codes)
SELECT user_id, array_agg(code ORDER BY recency)
FROM ranked
WHERE recency <= 5
GROUP BY user_id
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.kq_guard_buddie_rotation() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT;
  v_recent TEXT[];
  v_position INTEGER;
BEGIN
  -- Preserve the same lock order as both starter RPCs and the equipment guard.
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || NEW.user_id::TEXT, 0));

  SELECT code INTO STRICT v_code
  FROM public.lottery_card_definitions
  WHERE id = NEW.buddie_card_definition_id;

  INSERT INTO public.kq_buddie_rotation(user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT recent_buddie_codes INTO v_recent
  FROM public.kq_buddie_rotation
  WHERE user_id = NEW.user_id
  FOR UPDATE;

  v_position := array_position(v_recent, v_code);
  IF v_position IS NOT NULL THEN
    RAISE EXCEPTION 'kq_buddie_rotation_locked'
      USING DETAIL = jsonb_build_object(
        'buddieCode', v_code,
        'remainingDistinctBuddies', 6 - v_position
      )::TEXT;
  END IF;

  UPDATE public.kq_buddie_rotation
  SET recent_buddie_codes = ARRAY[v_code] || v_recent[1:4],
      updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.kq_guard_buddie_rotation() FROM PUBLIC, anon, authenticated, service_role;

-- Cover both starter RPCs and any future insertion path. AFTER INSERT ensures
-- an ON CONFLICT DO NOTHING replay cannot advance the queue. Status/state
-- updates never count again; errors later in the start transaction roll back
-- this queue together with the run, token spending and any other charges.
DROP TRIGGER IF EXISTS kq_guard_buddie_rotation ON public.kq_runs;
CREATE TRIGGER kq_guard_buddie_rotation AFTER INSERT ON public.kq_runs
FOR EACH ROW EXECUTE FUNCTION public.kq_guard_buddie_rotation();

COMMIT;
