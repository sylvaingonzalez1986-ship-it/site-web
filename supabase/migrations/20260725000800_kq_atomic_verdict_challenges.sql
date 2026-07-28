BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_battle_with_challenges(
  p_battle_id UUID,
  p_rounds JSONB,
  p_winner_id UUID,
  p_user_id UUID,
  p_challenge_day DATE,
  p_challenge_codes TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.kq_battles%ROWTYPE;
  v_points INTEGER;
BEGIN
  SELECT * INTO v_battle FROM public.kq_battles
  WHERE id = p_battle_id
    AND p_user_id IN (player_one_id, player_two_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Battle unavailable for player'; END IF;

  v_battle := public.rpc_kq_finalize_battle(p_battle_id, p_rounds, p_winner_id);
  v_points := public.rpc_kq_claim_daily_challenges(
    p_user_id, p_battle_id, p_challenge_day, COALESCE(p_challenge_codes, ARRAY[]::TEXT[])
  );
  RETURN jsonb_build_object('battle', to_jsonb(v_battle), 'challengePoints', v_points);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_finalize_battle_with_challenges(UUID, JSONB, UUID, UUID, DATE, TEXT[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_finalize_battle_with_challenges(UUID, JSONB, UUID, UUID, DATE, TEXT[])
  TO service_role;

COMMIT;
