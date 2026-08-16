BEGIN;

-- A larger Elo coefficient separates close players faster. The two-point floor
-- keeps every official verdict meaningful even across a very large rating gap.
CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_battle(
  p_battle_id UUID,
  p_rounds JSONB,
  p_winner_id UUID
)
RETURNS public.kq_battles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.kq_battles%ROWTYPE;
  v_burned_count INTEGER;
  v_rating_one INTEGER;
  v_rating_two INTEGER;
  v_expected_one NUMERIC;
  v_expected_two NUMERIC;
  v_delta_one INTEGER;
  v_delta_two INTEGER;
  v_winner_streak INTEGER;
  v_streak_entitlement public.kq_support_booster_entitlements%ROWTYPE;
BEGIN
  SELECT * INTO v_battle FROM public.kq_battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND OR v_battle.status <> 'locked' THEN
    RAISE EXCEPTION 'Battle unavailable';
  END IF;
  IF p_winner_id NOT IN (v_battle.player_one_id, v_battle.player_two_id) THEN
    RAISE EXCEPTION 'Invalid winner';
  END IF;
  IF jsonb_typeof(p_rounds) <> 'array' OR jsonb_array_length(p_rounds) <> 3 THEN
    RAISE EXCEPTION 'A verdict requires exactly three rounds';
  END IF;

  UPDATE public.kq_flowers
  SET status = 'burned', burned_at = now()
  WHERE id IN (v_battle.flower_one_id, v_battle.flower_two_id) AND status = 'locked';
  GET DIAGNOSTICS v_burned_count = ROW_COUNT;
  IF v_burned_count <> 2 THEN RAISE EXCEPTION 'Both flowers must be locked'; END IF;

  UPDATE public.kq_battles SET status = 'verdict', rounds = p_rounds,
    winner_id = p_winner_id, verdict_at = now()
  WHERE id = p_battle_id RETURNING * INTO v_battle;

  INSERT INTO public.kq_rank_profiles (user_id)
  VALUES (v_battle.player_one_id), (v_battle.player_two_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT rating INTO v_rating_one FROM public.kq_rank_profiles
  WHERE user_id = v_battle.player_one_id FOR UPDATE;
  SELECT rating INTO v_rating_two FROM public.kq_rank_profiles
  WHERE user_id = v_battle.player_two_id FOR UPDATE;
  v_expected_one := 1.0 / (1.0 + power(10.0, (v_rating_two - v_rating_one)::NUMERIC / 400.0));
  v_expected_two := 1.0 - v_expected_one;
  v_delta_one := CASE WHEN v_battle.player_one_id = p_winner_id
    THEN GREATEST(2, round(32.0 * (1.0 - v_expected_one))::INTEGER)
    ELSE -GREATEST(2, round(32.0 * v_expected_one)::INTEGER)
  END;
  v_delta_two := CASE WHEN v_battle.player_two_id = p_winner_id
    THEN GREATEST(2, round(32.0 * (1.0 - v_expected_two))::INTEGER)
    ELSE -GREATEST(2, round(32.0 * v_expected_two)::INTEGER)
  END;

  UPDATE public.kq_rank_profiles SET
    rating = GREATEST(100, rating + CASE
      WHEN user_id = v_battle.player_one_id THEN v_delta_one ELSE v_delta_two END),
    season_points = season_points + CASE
      WHEN user_id = v_battle.player_one_id AND user_id = p_winner_id
        THEN round(10.0 + 20.0 * (1.0 - v_expected_one))::INTEGER + LEAST(6, streak * 2)
      WHEN user_id = v_battle.player_two_id AND user_id = p_winner_id
        THEN round(10.0 + 20.0 * (1.0 - v_expected_two))::INTEGER + LEAST(6, streak * 2)
      WHEN user_id = v_battle.player_one_id
        THEN round(3.0 + 3.0 * (1.0 - v_expected_one))::INTEGER
      ELSE round(3.0 + 3.0 * (1.0 - v_expected_two))::INTEGER
    END,
    wins = wins + CASE WHEN user_id = p_winner_id THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN user_id = p_winner_id THEN 0 ELSE 1 END,
    streak = CASE WHEN user_id = p_winner_id THEN streak + 1 ELSE 0 END,
    burned_flowers = burned_flowers + 1,
    updated_at = now()
  WHERE user_id IN (v_battle.player_one_id, v_battle.player_two_id);

  SELECT streak INTO v_winner_streak FROM public.kq_rank_profiles
  WHERE user_id = p_winner_id;
  IF v_winner_streak > 0 AND v_winner_streak % 3 = 0 THEN
    v_streak_entitlement := public.rpc_kq_grant_streak_booster(p_winner_id);
    IF v_streak_entitlement.status = 'available' THEN
      PERFORM public.rpc_kq_open_support_booster(v_streak_entitlement.id, p_winner_id);
    END IF;
  END IF;

  RETURN v_battle;
END;
$$;

-- The validated wrapper remains the only service-role entry point.
REVOKE ALL ON FUNCTION public.rpc_kq_finalize_battle(UUID, JSONB, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.kq_arena_experience_receipts
  DROP CONSTRAINT IF EXISTS kq_arena_experience_receipts_amount_check;
ALTER TABLE public.kq_arena_experience_receipts
  ADD CONSTRAINT kq_arena_experience_receipts_amount_check
  CHECK (amount IN (0.6, 0.8, 1.0, 1.4, 1.6));

-- Human Arena XP now reflects the actual best-of-three score. It is still
-- idempotent because each player has one receipt per battle.
CREATE OR REPLACE FUNCTION public.rpc_kq_award_human_battle_experience(
  p_battle_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.kq_battles%ROWTYPE;
  v_user_id UUID;
  v_player_one_wins INTEGER;
  v_user_round_wins INTEGER;
  v_amount NUMERIC(3,1);
  v_granted INTEGER := 0;
BEGIN
  SELECT * INTO v_battle FROM public.kq_battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND OR v_battle.status <> 'verdict' THEN RAISE EXCEPTION 'kq_battle_not_final'; END IF;

  SELECT count(*)::INTEGER INTO v_player_one_wins
  FROM jsonb_array_elements(v_battle.rounds) AS round
  WHERE round->>'winner' = 'player';

  FOREACH v_user_id IN ARRAY ARRAY[v_battle.player_one_id, v_battle.player_two_id] LOOP
    v_user_round_wins := CASE WHEN v_user_id = v_battle.player_one_id
      THEN v_player_one_wins ELSE 3 - v_player_one_wins END;
    v_amount := CASE
      WHEN v_user_round_wins = 3 THEN 1.6
      WHEN v_user_round_wins = 2 THEN 1.4
      WHEN v_user_round_wins = 1 THEN 0.8
      ELSE 0.6
    END;

    INSERT INTO public.kq_arena_experience_receipts (battle_id, user_id, amount)
    VALUES (p_battle_id, v_user_id, v_amount)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN
      UPDATE public.kq_rank_profiles
      SET arena_experience = arena_experience + v_amount, updated_at = now()
      WHERE user_id = v_user_id;
      v_granted := v_granted + 1;
    END IF;
  END LOOP;
  RETURN v_granted;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_award_human_battle_experience(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_award_human_battle_experience(UUID)
  TO service_role;

-- Exact rating/season ties favor the better win record, then the player who
-- needed fewer losses. The technical id is only the final stable fallback.
CREATE OR REPLACE FUNCTION public.rpc_kq_refresh_daily_leaderboard(p_season_code TEXT)
RETURNS public.kq_leaderboard_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot public.kq_leaderboard_snapshots%ROWTYPE;
  v_leaderboard JSONB;
  v_snapshot_date DATE := (timezone('Europe/Paris', now()))::date;
BEGIN
  SELECT * INTO v_snapshot FROM public.kq_leaderboard_snapshots
  WHERE snapshot_date = v_snapshot_date AND season_code = p_season_code;
  IF FOUND THEN RETURN v_snapshot; END IF;

  WITH ranked AS (
    SELECT user_id, rating, season_points, wins, losses, streak, burned_flowers,
      row_number() OVER (
        ORDER BY rating DESC, season_points DESC, wins DESC, losses ASC, user_id
      ) AS rank
    FROM public.kq_rank_profiles
    WHERE season_code = p_season_code
    ORDER BY rating DESC, season_points DESC, wins DESC, losses ASC, user_id
    LIMIT 100
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'rank', rank, 'userId', user_id, 'rating', rating, 'seasonPoints', season_points,
    'wins', wins, 'losses', losses, 'streak', streak, 'burnedFlowers', burned_flowers
  ) ORDER BY rank), '[]'::JSONB)
  INTO v_leaderboard FROM ranked;

  INSERT INTO public.kq_leaderboard_snapshots (snapshot_date, season_code, leaderboard)
  VALUES (v_snapshot_date, p_season_code, v_leaderboard)
  ON CONFLICT (snapshot_date, season_code) DO NOTHING
  RETURNING * INTO v_snapshot;

  IF v_snapshot.snapshot_date IS NULL THEN
    SELECT * INTO v_snapshot FROM public.kq_leaderboard_snapshots
    WHERE snapshot_date = v_snapshot_date AND season_code = p_season_code;
  END IF;
  RETURN v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_refresh_daily_leaderboard(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_refresh_daily_leaderboard(TEXT)
  TO service_role;

COMMIT;
