BEGIN;

-- A player may always start a culture. When no Substrate card is owned, the
-- selected basic Substrate is treated as a free game resource: it is present
-- in the run state for the rules engine, but no album instance is created or
-- burned.
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
  v_substrate_definition public.lottery_card_definitions%ROWTYPE;
  v_substrate_instance public.lottery_card_instances%ROWTYPE;
  v_receipt public.kq_card_burn_receipts%ROWTYPE;
  v_token_balance INTEGER := 0;
  v_free_substrate BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL
    OR COALESCE(BTRIM(p_buddie_code), '') = ''
    OR p_seed NOT BETWEEN 0 AND 99999
    OR CARDINALITY(p_deck_codes) NOT BETWEEN 1 AND 250
    OR CARDINALITY(p_scenario_codes) <> 6
    OR p_initial_state IS NULL
    OR p_culture_tokens NOT BETWEEN 0 AND 2
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

  SELECT definition.* INTO v_substrate_definition
  FROM unnest(p_deck_codes) AS requested(code)
  JOIN public.lottery_card_definitions definition ON definition.code = requested.code
  JOIN public.kq_support_card_rules rule ON rule.card_definition_id = definition.id
  WHERE rule.category = 'substrate';
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_invalid_substrate'; END IF;
  IF (
    SELECT count(*)
    FROM unnest(p_deck_codes) AS requested(code)
    JOIN public.lottery_card_definitions definition ON definition.code = requested.code
    JOIN public.kq_support_card_rules rule ON rule.card_definition_id = definition.id
    WHERE rule.category = 'substrate'
  ) <> 1 THEN
    RAISE EXCEPTION 'kq_invalid_substrate';
  END IF;

  v_free_substrate := NOT EXISTS (
    SELECT 1
    FROM public.lottery_card_instances instance
    JOIN public.kq_support_card_rules rule ON rule.card_definition_id = instance.card_definition_id
    WHERE instance.user_id = p_user_id
      AND rule.category = 'substrate'
  );

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
    WHERE (owned.code IS NULL OR owned.quantity < requested.quantity)
      AND NOT (v_free_substrate AND requested.code = v_substrate_definition.code)
  ) THEN
    RAISE EXCEPTION 'kq_deck_copy_missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_scenario_codes) AS scenario(code)
    WHERE scenario.code !~ '^SIT-[0-9]{3}$'
  ) THEN
    RAISE EXCEPTION 'kq_invalid_scenarios';
  END IF;

  IF NOT v_free_substrate THEN
    SELECT instance.* INTO v_substrate_instance
    FROM public.lottery_card_instances instance
    WHERE instance.user_id = p_user_id
      AND instance.card_definition_id = v_substrate_definition.id
    ORDER BY instance.created_at, instance.id
    LIMIT 1
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'kq_deck_copy_missing'; END IF;
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

  IF NOT v_free_substrate THEN
    DELETE FROM public.lottery_card_instances WHERE id = v_substrate_instance.id;

    INSERT INTO public.kq_card_burn_receipts (
      run_id, user_id, card_instance_id, card_definition_id, card_code, stage_index, use_kind
    ) VALUES (
      v_run.id, p_user_id, v_substrate_instance.id, v_substrate_definition.id,
      v_substrate_definition.code, 0, 'substrate'
    )
    RETURNING * INTO v_receipt;
  END IF;

  RETURN jsonb_build_object(
    'run', to_jsonb(v_run),
    'burnReceipt', CASE WHEN v_free_substrate THEN NULL ELSE to_jsonb(v_receipt) END,
    'freeSubstrate', v_free_substrate,
    'cultureTokenBalance', v_token_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_start_run(UUID, TEXT, INTEGER, TEXT[], TEXT[], JSONB, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_start_run(UUID, TEXT, INTEGER, TEXT[], TEXT[], JSONB, INTEGER)
  TO service_role;

COMMIT;
