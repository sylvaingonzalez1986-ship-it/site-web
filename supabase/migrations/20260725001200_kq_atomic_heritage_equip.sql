BEGIN;

ALTER TABLE public.kq_runs
  ADD COLUMN IF NOT EXISTS heritage_code TEXT
  REFERENCES public.kq_heritage_card_definitions(code) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_kq_runs_user_heritage
  ON public.kq_runs(user_id, heritage_code)
  WHERE heritage_code IS NOT NULL;

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
  END IF;

  v_expected_xp := 1 + p_culture_tokens
    + CASE WHEN v_definition.effect_code = 'starting-xp' THEN 1 ELSE 0 END;
  IF COALESCE((p_initial_state->>'xp')::INTEGER, -1) <> v_expected_xp THEN
    RAISE EXCEPTION 'kq_heritage_state_mismatch';
  END IF;

  -- The existing atomic starter validates the base economy. For the permanent
  -- starting-XP Heritage only, normalize XP during that call, then persist the
  -- already validated final state before this transaction commits.
  IF v_definition.effect_code = 'starting-xp' THEN
    v_state_for_start := jsonb_set(p_initial_state, '{xp}', to_jsonb(1 + p_culture_tokens), FALSE);
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
