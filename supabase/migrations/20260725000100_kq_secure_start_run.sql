BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_kq_start_run(
  p_user_id UUID,
  p_buddie_code TEXT,
  p_seed INTEGER,
  p_deck_codes TEXT[],
  p_scenario_codes TEXT[],
  p_initial_state JSONB
)
RETURNS public.kq_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buddie public.lottery_card_definitions%ROWTYPE;
  v_run public.kq_runs%ROWTYPE;
  v_substrate_count INTEGER;
BEGIN
  IF p_user_id IS NULL
    OR COALESCE(BTRIM(p_buddie_code), '') = ''
    OR p_seed NOT BETWEEN 0 AND 99999
    OR CARDINALITY(p_deck_codes) NOT BETWEEN 2 AND 250
    OR CARDINALITY(p_scenario_codes) <> 6
    OR p_initial_state IS NULL
  THEN
    RAISE EXCEPTION 'kq_invalid_run';
  END IF;

  IF EXISTS (SELECT 1 FROM public.kq_runs WHERE user_id = p_user_id AND status = 'active') THEN
    RAISE EXCEPTION 'kq_active_run_exists';
  END IF;

  SELECT definition.* INTO v_buddie
  FROM public.lottery_card_definitions definition
  WHERE definition.code = p_buddie_code
    AND EXISTS (
      SELECT 1 FROM public.lottery_card_instances instance
      WHERE instance.user_id = p_user_id
        AND instance.card_definition_id = definition.id
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_buddie_not_owned'; END IF;

  IF EXISTS (
    WITH requested AS (
      SELECT code, count(*)::INTEGER AS quantity
      FROM unnest(p_deck_codes) AS code
      GROUP BY code
    ), owned AS (
      SELECT definition.code, count(instance.id)::INTEGER AS quantity
      FROM public.lottery_card_definitions definition
      JOIN public.kq_support_card_rules rule ON rule.card_definition_id = definition.id
      LEFT JOIN public.lottery_card_instances instance
        ON instance.card_definition_id = definition.id
       AND instance.user_id = p_user_id
      WHERE definition.code = ANY(p_deck_codes)
        AND rule.category <> 'pbi'
      GROUP BY definition.code
    )
    SELECT 1
    FROM requested
    LEFT JOIN owned USING (code)
    WHERE owned.code IS NULL OR owned.quantity < requested.quantity
  ) THEN
    RAISE EXCEPTION 'kq_deck_copy_missing';
  END IF;

  SELECT count(*) INTO v_substrate_count
  FROM unnest(p_deck_codes) AS requested(code)
  JOIN public.lottery_card_definitions definition ON definition.code = requested.code
  JOIN public.kq_support_card_rules rule ON rule.card_definition_id = definition.id
  WHERE rule.category = 'substrate';
  IF v_substrate_count <> 1 THEN RAISE EXCEPTION 'kq_invalid_substrate'; END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_scenario_codes) AS scenario(code)
    WHERE scenario.code !~ '^SIT-[0-9]{3}$'
  ) THEN
    RAISE EXCEPTION 'kq_invalid_scenarios';
  END IF;

  INSERT INTO public.kq_runs (
    user_id, buddie_card_definition_id, seed, deck_codes, scenario_codes, state
  ) VALUES (
    p_user_id, v_buddie.id, p_seed, p_deck_codes, p_scenario_codes, p_initial_state
  )
  RETURNING * INTO v_run;

  RETURN v_run;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_start_run(UUID, TEXT, INTEGER, TEXT[], TEXT[], JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_start_run(UUID, TEXT, INTEGER, TEXT[], TEXT[], JSONB)
  TO service_role;

COMMIT;
