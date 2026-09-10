BEGIN;

ALTER TABLE public.kq_daily_challenge_claims
  ALTER COLUMN battle_id DROP NOT NULL;

ALTER TABLE public.kq_daily_challenge_claims
  ADD COLUMN IF NOT EXISTS bot_battle_id UUID
  REFERENCES public.kq_bot_battles(id) ON DELETE RESTRICT;

ALTER TABLE public.kq_daily_challenge_claims
  DROP CONSTRAINT IF EXISTS kq_daily_challenge_claim_source;
ALTER TABLE public.kq_daily_challenge_claims
  ADD CONSTRAINT kq_daily_challenge_claim_source
  CHECK (num_nonnulls(battle_id, bot_battle_id) = 1);

CREATE INDEX IF NOT EXISTS idx_kq_challenge_claims_bot_battle
  ON public.kq_daily_challenge_claims(bot_battle_id)
  WHERE bot_battle_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.rpc_kq_claim_bot_daily_challenges(
  p_user_id UUID,
  p_bot_battle_id UUID,
  p_challenge_day DATE,
  p_challenge_codes TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_day DATE;
  v_awarded INTEGER := 0;
  v_claimed_codes JSONB := '[]'::JSONB;
  v_rotation TEXT[] := ARRAY[
    'steady-grower', 'spark-hunter', 'green-streak', 'biocontrol', 'clean-sweep',
    'no-failure', 'critical-touch', 'jury-edge', 'comeback'
  ];
  v_start INTEGER;
  v_daily_codes TEXT[];
BEGIN
  IF p_user_id IS NULL OR p_bot_battle_id IS NULL OR p_challenge_day IS NULL THEN
    RAISE EXCEPTION 'kq_invalid_bot_challenge_claim';
  END IF;

  SELECT r.challenge_day INTO v_run_day
  FROM public.kq_bot_battles battle
  JOIN public.kq_flowers flower ON flower.id = battle.flower_id
  JOIN public.kq_runs r ON r.id = flower.run_id
  WHERE battle.id = p_bot_battle_id
    AND battle.user_id = p_user_id;

  IF v_run_day IS NULL OR v_run_day <> p_challenge_day THEN
    RAISE EXCEPTION 'kq_bot_challenge_run_mismatch';
  END IF;

  v_start := to_char(p_challenge_day, 'YYYYMMDD')::INTEGER % cardinality(v_rotation);
  v_daily_codes := ARRAY[
    v_rotation[v_start + 1],
    v_rotation[((v_start + 4) % cardinality(v_rotation)) + 1],
    v_rotation[((v_start + 8) % cardinality(v_rotation)) + 1]
  ];

  WITH requested AS (
    SELECT DISTINCT code
    FROM unnest(COALESCE(p_challenge_codes, ARRAY[]::TEXT[])) AS code
  ), inserted AS (
    INSERT INTO public.kq_daily_challenge_claims (
      user_id, challenge_day, challenge_code, battle_id, bot_battle_id, points
    )
    SELECT p_user_id, p_challenge_day, code, NULL, p_bot_battle_id, CASE code
      WHEN 'steady-grower' THEN 8 WHEN 'spark-hunter' THEN 10 WHEN 'green-streak' THEN 8
      WHEN 'biocontrol' THEN 12 WHEN 'clean-sweep' THEN 15 WHEN 'no-failure' THEN 12
      WHEN 'critical-touch' THEN 10 WHEN 'jury-edge' THEN 9 WHEN 'comeback' THEN 11
    END
    FROM requested
    WHERE code = ANY(v_daily_codes)
    ON CONFLICT (user_id, challenge_day, challenge_code) DO NOTHING
    RETURNING challenge_code, points
  )
  SELECT
    COALESCE(sum(points), 0)::INTEGER,
    COALESCE(jsonb_agg(challenge_code ORDER BY challenge_code), '[]'::JSONB)
  INTO v_awarded, v_claimed_codes
  FROM inserted;

  INSERT INTO public.kq_rank_profiles (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.kq_rank_profiles
  SET season_points = season_points + v_awarded,
      updated_at = now()
  WHERE user_id = p_user_id AND v_awarded > 0;

  RETURN jsonb_build_object(
    'points', v_awarded,
    'challengeCodes', v_claimed_codes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_bot_battle_with_challenges(
  p_user_id UUID,
  p_flower_id UUID,
  p_bot_code TEXT,
  p_bot_flower JSONB,
  p_seed INTEGER,
  p_rounds JSONB,
  p_winner TEXT,
  p_challenge_day DATE,
  p_challenge_codes TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt JSONB;
  v_claim JSONB;
BEGIN
  v_receipt := public.rpc_kq_finalize_bot_battle(
    p_user_id,
    p_flower_id,
    p_bot_code,
    p_bot_flower,
    p_seed,
    p_rounds,
    p_winner
  );

  v_claim := public.rpc_kq_claim_bot_daily_challenges(
    p_user_id,
    (v_receipt ->> 'battleId')::UUID,
    p_challenge_day,
    COALESCE(p_challenge_codes, ARRAY[]::TEXT[])
  );

  RETURN v_receipt || jsonb_build_object(
    'challengePoints', COALESCE((v_claim ->> 'points')::INTEGER, 0),
    'claimedChallengeCodes', COALESCE(v_claim -> 'challengeCodes', '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_claim_bot_daily_challenges(UUID, UUID, DATE, TEXT[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_claim_bot_daily_challenges(UUID, UUID, DATE, TEXT[])
  TO service_role;

REVOKE ALL ON FUNCTION public.rpc_kq_finalize_bot_battle_with_challenges(
  UUID, UUID, TEXT, JSONB, INTEGER, JSONB, TEXT, DATE, TEXT[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_finalize_bot_battle_with_challenges(
  UUID, UUID, TEXT, JSONB, INTEGER, JSONB, TEXT, DATE, TEXT[]
) TO service_role;

COMMENT ON FUNCTION public.rpc_kq_finalize_bot_battle_with_challenges(
  UUID, UUID, TEXT, JSONB, INTEGER, JSONB, TEXT, DATE, TEXT[]
) IS 'Atomically finalizes bot training, burns the flower and awards eligible daily challenge points without changing Elo or streak.';

COMMIT;
