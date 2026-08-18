BEGIN;

-- Keep the authoritative start-state validation in sync with the current
-- Buddie rarity bonuses and the rebalanced Reserve du jardinier Heritage.
CREATE OR REPLACE FUNCTION public.rpc_kq_start_run_with_heritage(
  p_user_id UUID,
  p_buddie_code TEXT,
  p_seed INTEGER,
  p_deck_codes TEXT[],
  p_scenario_codes TEXT[],
  p_initial_state JSONB,
  p_culture_tokens INTEGER DEFAULT 0,
  p_heritage_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_definition public.kq_heritage_card_definitions%ROWTYPE;
  v_state_for_start JSONB := p_initial_state;
  v_buddie_number INTEGER;
  v_buddie_xp INTEGER := 0;
  v_heritage_xp INTEGER := 0;
  v_base_xp INTEGER;
  v_expected_xp INTEGER;
  v_result JSONB;
  v_run_id UUID;
  v_run public.kq_runs%ROWTYPE;
BEGIN
  IF p_heritage_code IS NULL THEN
    IF p_initial_state ? 'heritageCode' THEN
      RAISE EXCEPTION 'kq_heritage_state_mismatch';
    END IF;
  ELSE
    IF p_heritage_code !~ '^HERITAGE-[0-9]{3}$'
      OR COALESCE(p_initial_state->>'heritageCode', '') <> p_heritage_code
    THEN
      RAISE EXCEPTION 'kq_heritage_state_mismatch';
    END IF;

    SELECT * INTO v_definition
    FROM public.kq_heritage_card_definitions
    WHERE code = p_heritage_code AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'kq_heritage_inactive'; END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.kq_heritage_draws
      WHERE user_id = p_user_id AND card_code = p_heritage_code
    ) THEN
      RAISE EXCEPTION 'kq_heritage_not_owned';
    END IF;

    IF COALESCE((p_initial_state->>'heritageUsed')::BOOLEAN, TRUE) <> FALSE
      OR COALESCE((p_initial_state->>'heritageArmed')::BOOLEAN, TRUE) <> FALSE
    THEN
      RAISE EXCEPTION 'kq_heritage_state_mismatch';
    END IF;

    v_heritage_xp := CASE v_definition.effect_code
      WHEN 'starting-xp' THEN 1
      WHEN 'starting-xp-two' THEN 2
      ELSE 0
    END;
  END IF;

  IF p_buddie_code ~ '^HH2026-[0-9]{3}$' THEN
    v_buddie_number := RIGHT(p_buddie_code, 3)::INTEGER;
    v_buddie_xp := CASE
      WHEN v_buddie_number = 1 THEN 4
      WHEN v_buddie_number BETWEEN 2 AND 4 THEN 3
      WHEN v_buddie_number BETWEEN 5 AND 9 THEN 2
      WHEN v_buddie_number BETWEEN 10 AND 19 THEN 1
      ELSE 0
    END;
  END IF;

  v_base_xp := 1 + p_culture_tokens;
  v_expected_xp := v_base_xp + v_buddie_xp + v_heritage_xp;
  IF COALESCE((p_initial_state->>'xp')::INTEGER, -1) <> v_expected_xp THEN
    RAISE EXCEPTION 'kq_heritage_state_mismatch';
  END IF;

  -- The base starter validates token spending against base XP. Validate every
  -- permanent bonus above, then temporarily remove those bonuses for that call.
  IF v_buddie_xp > 0 OR v_heritage_xp > 0 THEN
    v_state_for_start := jsonb_set(p_initial_state, '{xp}', to_jsonb(v_base_xp), FALSE);
  END IF;

  v_result := public.rpc_kq_start_run(
    p_user_id,
    p_buddie_code,
    p_seed,
    p_deck_codes,
    p_scenario_codes,
    v_state_for_start,
    p_culture_tokens
  );

  v_run_id := (v_result->'run'->>'id')::UUID;
  UPDATE public.kq_runs
  SET state = p_initial_state,
      heritage_code = p_heritage_code,
      updated_at = now()
  WHERE id = v_run_id AND user_id = p_user_id
  RETURNING * INTO v_run;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_run_not_found'; END IF;

  RETURN jsonb_set(v_result, '{run}', to_jsonb(v_run), FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_start_run_with_heritage(
  UUID, TEXT, INTEGER, TEXT[], TEXT[], JSONB, INTEGER, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_start_run_with_heritage(
  UUID, TEXT, INTEGER, TEXT[], TEXT[], JSONB, INTEGER, TEXT
) TO service_role;

COMMIT;
