BEGIN;

ALTER TABLE public.kq_runs DROP CONSTRAINT IF EXISTS kq_runs_deck_codes_check;
ALTER TABLE public.kq_runs ADD CONSTRAINT kq_runs_deck_codes_check
  CHECK (cardinality(deck_codes) BETWEEN 0 AND 250);

-- All new cultures use living soil without a substrate card or a startup burn.
CREATE OR REPLACE FUNCTION public.rpc_kq_start_run(
  p_user_id UUID,
  p_buddie_code TEXT,
  p_seed INTEGER,
  p_deck_codes TEXT[],
  p_scenario_codes TEXT[],
  p_initial_state JSONB,
  p_culture_tokens INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buddie public.lottery_card_definitions%ROWTYPE;
  v_run public.kq_runs%ROWTYPE;
  v_token_balance INTEGER := 0;
BEGIN
  IF p_user_id IS NULL
    OR COALESCE(BTRIM(p_buddie_code), '') = ''
    OR p_seed NOT BETWEEN 0 AND 99999
    OR p_deck_codes IS NULL
    OR CARDINALITY(p_deck_codes) NOT BETWEEN 0 AND 250
    OR array_position(p_deck_codes, NULL) IS NOT NULL
    OR p_scenario_codes IS NULL
    OR CARDINALITY(p_scenario_codes) <> 6
    OR p_initial_state IS NULL
    OR p_culture_tokens IS NULL OR p_culture_tokens NOT BETWEEN 0 AND 2
    OR p_seed IS NULL
    OR p_initial_state->'deckCodes' IS DISTINCT FROM to_jsonb(p_deck_codes)
    OR p_initial_state->'usedCards' IS DISTINCT FROM '[]'::JSONB
    OR p_initial_state->'playedThisStage' IS DISTINCT FROM '[]'::JSONB
    OR COALESCE((p_initial_state->>'xp')::INTEGER, -1) <> 1 + p_culture_tokens
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
        AND rule.category NOT IN ('pbi', 'substrate')
        AND definition.is_active = TRUE
      GROUP BY definition.code
    )
    SELECT 1
    FROM requested
    LEFT JOIN owned USING (code)
    WHERE (owned.code IS NULL OR owned.quantity < requested.quantity)
  ) THEN
    RAISE EXCEPTION 'kq_deck_copy_missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_scenario_codes) AS scenario(code)
    WHERE scenario.code !~ '^SIT-[0-9]{3}$'
  ) THEN
    RAISE EXCEPTION 'kq_invalid_scenarios';
  END IF;

  IF p_culture_tokens > 0 THEN
    INSERT INTO public.kq_culture_token_wallets(user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT balance INTO v_token_balance
    FROM public.kq_culture_token_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_token_balance < p_culture_tokens THEN
      RAISE EXCEPTION 'kq_culture_tokens_insufficient';
    END IF;
  ELSE
    SELECT COALESCE(balance, 0) INTO v_token_balance
    FROM public.kq_culture_token_wallets
    WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.kq_runs (
    user_id, buddie_card_definition_id, seed, deck_codes, scenario_codes, state,
    culture_tokens_spent
  ) VALUES (
    p_user_id, v_buddie.id, p_seed, p_deck_codes, p_scenario_codes, p_initial_state,
    p_culture_tokens
  )
  RETURNING * INTO v_run;

  IF p_culture_tokens > 0 THEN
    UPDATE public.kq_culture_token_wallets
    SET balance = balance - p_culture_tokens, updated_at = now()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_token_balance;

    INSERT INTO public.kq_culture_token_ledger(user_id, run_id, amount, reason, reward_key)
    VALUES (
      p_user_id, v_run.id, -p_culture_tokens, 'run_start',
      'run:' || v_run.id::TEXT || ':start'
    );
  END IF;

  RETURN jsonb_build_object(
    'run', to_jsonb(v_run),
    'burnReceipt', NULL,
    'freeSubstrate', TRUE,
    'cultureTokenBalance', v_token_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_start_run(UUID, TEXT, INTEGER, TEXT[], TEXT[], JSONB, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_start_run(UUID, TEXT, INTEGER, TEXT[], TEXT[], JSONB, INTEGER)
  TO service_role;

-- Existing instances and burn receipts are retained as historical records.
UPDATE public.lottery_card_definitions
SET is_active = FALSE, updated_at = now()
WHERE code IN ('BOTTE-001', 'BOTTE-007', 'BOTTE-008', 'BOTTE-009');

-- Align active persisted states with the client save migration so atomic RPC
-- deck identity and used-card checks continue to hold after deployment.
DO $$
DECLARE
  v_run RECORD;
  v_state JSONB;
  v_field TEXT;
  v_codes JSONB;
  v_retired TEXT[] := ARRAY['BOTTE-001','BOTTE-007','BOTTE-008','BOTTE-009'];
BEGIN
  FOR v_run IN SELECT id, state FROM public.kq_runs
    WHERE status = 'active' FOR UPDATE
  LOOP
    v_state := v_run.state;
    FOREACH v_field IN ARRAY ARRAY['deckCodes','collectionCodes','playedThisStage','usedCards']
    LOOP
      SELECT COALESCE(jsonb_agg(value ORDER BY ord), '[]'::JSONB) INTO v_codes
      FROM jsonb_array_elements_text(COALESCE(v_state->v_field, '[]'::JSONB)) WITH ORDINALITY AS entries(value, ord)
      WHERE NOT (value = ANY(v_retired));
      v_state := jsonb_set(v_state, ARRAY[v_field], v_codes);
    END LOOP;
    IF v_state IS DISTINCT FROM v_run.state THEN
      UPDATE public.kq_runs SET state = v_state,
        deck_codes = ARRAY(SELECT jsonb_array_elements_text(v_state->'deckCodes')),
        updated_at = now()
      WHERE id = v_run.id;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
