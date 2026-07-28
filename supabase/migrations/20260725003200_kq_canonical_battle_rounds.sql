BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_battle_for_both_players(
  p_battle_id UUID,
  p_rounds JSONB,
  p_winner_id UUID,
  p_user_id UUID,
  p_challenge_day DATE,
  p_challenge_codes TEXT[],
  p_opponent_challenge_day DATE,
  p_opponent_challenge_codes TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.kq_battles%ROWTYPE;
  v_opponent_id UUID;
  v_result JSONB;
  v_opponent_points INTEGER;
  v_canonical_rounds JSONB;
BEGIN
  SELECT * INTO v_battle FROM public.kq_battles
  WHERE id = p_battle_id
    AND p_user_id IN (player_one_id, player_two_id)
  FOR UPDATE;
  IF NOT FOUND OR v_battle.status <> 'locked' THEN
    RAISE EXCEPTION 'Battle unavailable for player';
  END IF;
  v_opponent_id := CASE
    WHEN v_battle.player_one_id = p_user_id THEN v_battle.player_two_id
    ELSE v_battle.player_one_id
  END;

  v_result := public.rpc_kq_finalize_battle_with_challenges(
    p_battle_id, p_rounds, p_winner_id, p_user_id,
    p_challenge_day, COALESCE(p_challenge_codes, ARRAY[]::TEXT[])
  );
  v_opponent_points := public.rpc_kq_claim_daily_challenges(
    v_opponent_id, p_battle_id, p_opponent_challenge_day,
    COALESCE(p_opponent_challenge_codes, ARRAY[]::TEXT[])
  );

  IF p_user_id = v_battle.player_two_id THEN
    SELECT jsonb_agg(
      (round_value - 'playerScore' - 'opponentScore' - 'winner')
      || jsonb_build_object(
        'playerScore', round_value->'opponentScore',
        'opponentScore', round_value->'playerScore',
        'winner', CASE round_value->>'winner'
          WHEN 'player' THEN 'opponent'
          ELSE 'player'
        END
      )
      ORDER BY round_index
    ) INTO v_canonical_rounds
    FROM jsonb_array_elements(p_rounds) WITH ORDINALITY AS rounds(round_value, round_index);

    UPDATE public.kq_battles SET rounds = v_canonical_rounds
    WHERE id = p_battle_id AND status = 'verdict';
  ELSE
    v_canonical_rounds := p_rounds;
  END IF;

  RETURN v_result || jsonb_build_object(
    'opponentChallengePoints', v_opponent_points,
    'roundsStoredFrom', 'player_one'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_finalize_battle_for_both_players(
  UUID, JSONB, UUID, UUID, DATE, TEXT[], DATE, TEXT[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_finalize_battle_for_both_players(
  UUID, JSONB, UUID, UUID, DATE, TEXT[], DATE, TEXT[]
) TO service_role;

COMMIT;
