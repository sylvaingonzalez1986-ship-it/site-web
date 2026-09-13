BEGIN;

ALTER TABLE public.arena_customer_reward_seasons
  ADD COLUMN IF NOT EXISTS standings_snapshot JSONB;

-- Keep the sales freeze and its ranking snapshot in the same transaction.
-- Legacy frozen seasons are deliberately not reconstructed from today's ranking.
CREATE OR REPLACE FUNCTION public.rpc_arena_freeze_customer_reward_snapshot(
  p_season_code TEXT,
  p_standings JSONB,
  p_execute BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_season public.arena_customer_reward_seasons%ROWTYPE;
  v_result JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('arena-customer-reward:' || p_season_code, 0));
  SELECT * INTO v_season FROM public.arena_customer_reward_seasons
    WHERE season_code = p_season_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arena_customer_reward_season_not_found'; END IF;
  IF jsonb_typeof(p_standings) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'arena_customer_reward_invalid_standings';
  END IF;
  IF v_season.status = 'frozen' AND v_season.standings_snapshot IS NULL THEN
    RAISE EXCEPTION 'arena_customer_reward_legacy_snapshot_required';
  END IF;
  v_result := public.rpc_arena_freeze_customer_reward_season(p_season_code, p_execute);
  IF p_execute AND v_season.status = 'active' THEN
    UPDATE public.arena_customer_reward_seasons
      SET standings_snapshot = p_standings
      WHERE season_code = p_season_code;
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_arena_freeze_customer_reward_snapshot(TEXT, JSONB, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_arena_freeze_customer_reward_snapshot(TEXT, JSONB, BOOLEAN) TO service_role;

COMMIT;
