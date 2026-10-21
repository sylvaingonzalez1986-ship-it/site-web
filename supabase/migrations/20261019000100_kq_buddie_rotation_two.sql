BEGIN;

-- A Buddie becomes available after two other distinct varieties have started.
-- Serialize the history conversion with solo starts and shared campaigns.
LOCK TABLE public.kq_runs IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.kq_buddie_rotation IN SHARE ROW EXCLUSIVE MODE;

-- The existing queue is authoritative: it also preserves the deterministic
-- zone order of campaigns whose accounting runs share the same start time.
UPDATE public.kq_buddie_rotation
SET recent_buddie_codes = recent_buddie_codes[1:2], updated_at = now()
WHERE cardinality(recent_buddie_codes) > 2;

ALTER TABLE public.kq_buddie_rotation
  DROP CONSTRAINT IF EXISTS kq_buddie_rotation_two_recent_buddies;
ALTER TABLE public.kq_buddie_rotation
  ADD CONSTRAINT kq_buddie_rotation_two_recent_buddies
  CHECK (cardinality(recent_buddie_codes) <= 2);

COMMENT ON COLUMN public.kq_buddie_rotation.recent_buddie_codes IS
  'Two most recently used distinct Buddie codes, newest first; missing codes are available.';

CREATE OR REPLACE FUNCTION public.kq_guard_buddie_rotation() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT;
  v_recent TEXT[];
  v_position INTEGER;
BEGIN
  -- Campaigns validate the pre-start queue and advance it once after all their
  -- members succeed. Keep this bypass installed by the shared-campaign patch.
  IF NEW.campaign_id IS NOT NULL THEN RETURN NEW; END IF;

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
        'remainingDistinctBuddies', 3 - v_position
      )::TEXT;
  END IF;

  UPDATE public.kq_buddie_rotation
  SET recent_buddie_codes = ARRAY[v_code] || v_recent[1:1],
      updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Preserve the complete audited campaign RPC: only its final queue bound
-- changes. In particular, all active assigned zones must still participate.
DO $$
DECLARE
  body TEXT;
  previous_bound TEXT := '(new_codes||previous_codes)[1:5]';
  next_bound TEXT := '(new_codes||previous_codes)[1:2]';
BEGIN
  body := pg_get_functiondef('public.rpc_kq_start_campaign(uuid,uuid,jsonb,jsonb,integer,text)'::REGPROCEDURE);
  IF cardinality(string_to_array(body, previous_bound)) = 2
    AND strpos(body, next_bound) = 0 THEN
    EXECUTE replace(body, previous_bound, next_bound);
  ELSIF strpos(body, previous_bound) = 0
    AND cardinality(string_to_array(body, next_bound)) = 2 THEN
    NULL; -- Reapplying this migration must not change already converted history.
  ELSE
    RAISE EXCEPTION 'kq_buddie_rotation_campaign_anchor_changed';
  END IF;
END;
$$;

-- History remains server-readable, with writes restricted to definer routines.
REVOKE ALL ON TABLE public.kq_buddie_rotation FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.kq_buddie_rotation TO service_role;
REVOKE ALL ON FUNCTION public.kq_guard_buddie_rotation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_start_campaign(UUID,UUID,JSONB,JSONB,INTEGER,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_start_campaign(UUID,UUID,JSONB,JSONB,INTEGER,TEXT) TO service_role;

COMMIT;
