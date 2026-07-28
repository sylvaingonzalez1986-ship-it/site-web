BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_kq_lock_battle_rank_profiles(
  p_player_one_id UUID,
  p_player_two_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_player_one_id = p_player_two_id THEN RAISE EXCEPTION 'Players must be distinct'; END IF;
  INSERT INTO public.kq_rank_profiles (user_id)
  VALUES (p_player_one_id), (p_player_two_id)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM user_id
  FROM public.kq_rank_profiles
  WHERE user_id IN (p_player_one_id, p_player_two_id)
  ORDER BY user_id
  FOR UPDATE;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_lock_battle_rank_profiles(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

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
  v_round JSONB;
  v_player_wins INTEGER;
  v_expected_winner UUID;
BEGIN
  SELECT * INTO v_battle FROM public.kq_battles
  WHERE id = p_battle_id
    AND p_user_id IN (player_one_id, player_two_id)
  FOR UPDATE;
  IF NOT FOUND OR v_battle.status <> 'locked' THEN RAISE EXCEPTION 'Battle unavailable for player'; END IF;

  IF jsonb_typeof(p_rounds) <> 'array' OR jsonb_array_length(p_rounds) <> 3 THEN
    RAISE EXCEPTION 'A verdict requires exactly three rounds';
  END IF;
  FOR v_round IN SELECT value FROM jsonb_array_elements(p_rounds)
  LOOP
    IF jsonb_typeof(v_round) <> 'object'
      OR COALESCE(v_round->>'code', '') = ''
      OR COALESCE(v_round->>'label', '') = ''
      OR COALESCE(v_round->>'explanation', '') = ''
      OR jsonb_typeof(v_round->'playerScore') <> 'number'
      OR jsonb_typeof(v_round->'opponentScore') <> 'number'
      OR COALESCE(v_round->>'winner', '') NOT IN ('player', 'opponent')
    THEN
      RAISE EXCEPTION 'Invalid jury round';
    END IF;
  END LOOP;

  SELECT count(*)::INTEGER INTO v_player_wins
  FROM jsonb_array_elements(p_rounds) AS round
  WHERE round->>'winner' = 'player';
  v_expected_winner := CASE
    WHEN v_player_wins >= 2 THEN p_user_id
    WHEN v_battle.player_one_id = p_user_id THEN v_battle.player_two_id
    ELSE v_battle.player_one_id
  END;
  IF p_winner_id <> v_expected_winner THEN RAISE EXCEPTION 'Winner does not match jury rounds'; END IF;

  PERFORM public.rpc_kq_lock_battle_rank_profiles(v_battle.player_one_id, v_battle.player_two_id);
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

-- The low-level finalizer remains an implementation detail of the validated wrapper.
REVOKE EXECUTE ON FUNCTION public.rpc_kq_finalize_battle(UUID, JSONB, UUID)
  FROM service_role;

COMMIT;
