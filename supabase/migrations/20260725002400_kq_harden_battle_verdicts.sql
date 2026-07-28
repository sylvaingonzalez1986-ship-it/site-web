BEGIN;

-- Lock flowers in a canonical order so two concurrent, reversed challenges cannot
-- deadlock while each transaction is holding one flower.
CREATE OR REPLACE FUNCTION public.rpc_kq_lock_battle(
  p_flower_one_id UUID,
  p_flower_two_id UUID,
  p_seed INTEGER
)
RETURNS public.kq_battles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flower_one public.kq_flowers%ROWTYPE;
  v_flower_two public.kq_flowers%ROWTYPE;
  v_battle public.kq_battles%ROWTYPE;
  v_locked_count INTEGER;
BEGIN
  IF p_flower_one_id = p_flower_two_id THEN RAISE EXCEPTION 'Two distinct flowers are required'; END IF;

  PERFORM id FROM public.kq_flowers
  WHERE id IN (p_flower_one_id, p_flower_two_id)
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO v_flower_one FROM public.kq_flowers WHERE id = p_flower_one_id;
  SELECT * INTO v_flower_two FROM public.kq_flowers WHERE id = p_flower_two_id;
  IF v_flower_one.id IS NULL OR v_flower_two.id IS NULL THEN RAISE EXCEPTION 'Flower unavailable'; END IF;
  IF v_flower_one.owner_id = v_flower_two.owner_id THEN RAISE EXCEPTION 'Players must be distinct'; END IF;
  IF v_flower_one.status <> 'available' OR v_flower_two.status <> 'available' THEN RAISE EXCEPTION 'Flower already used'; END IF;

  UPDATE public.kq_flowers SET status = 'locked', locked_at = now()
  WHERE id IN (p_flower_one_id, p_flower_two_id) AND status = 'available';
  GET DIAGNOSTICS v_locked_count = ROW_COUNT;
  IF v_locked_count <> 2 THEN RAISE EXCEPTION 'Could not lock both flowers'; END IF;

  INSERT INTO public.kq_battles (
    player_one_id, player_two_id, flower_one_id, flower_two_id, seed
  ) VALUES (
    v_flower_one.owner_id, v_flower_two.owner_id, v_flower_one.id, v_flower_two.id, p_seed
  ) RETURNING * INTO v_battle;
  RETURN v_battle;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_lock_battle(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_lock_battle(UUID, UUID, INTEGER) TO service_role;

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
