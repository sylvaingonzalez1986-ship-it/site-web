BEGIN;

DROP FUNCTION IF EXISTS public.rpc_kq_burn_support_card(UUID, UUID, SMALLINT, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_kq_play_support_card(
  p_user_id UUID,
  p_run_id UUID,
  p_card_code TEXT,
  p_stage_index SMALLINT,
  p_use_kind TEXT,
  p_expected_updated_at TIMESTAMPTZ,
  p_next_state JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.kq_runs%ROWTYPE;
  v_definition public.lottery_card_definitions%ROWTYPE;
  v_instance public.lottery_card_instances%ROWTYPE;
  v_receipt public.kq_card_burn_receipts%ROWTYPE;
  v_category TEXT;
  v_old_used JSONB;
  v_old_played JSONB;
BEGIN
  IF p_user_id IS NULL OR p_run_id IS NULL OR COALESCE(BTRIM(p_card_code), '') = ''
    OR p_stage_index NOT BETWEEN 0 AND 5 OR p_use_kind NOT IN ('support', 'pbi')
    OR p_expected_updated_at IS NULL OR p_next_state IS NULL
  THEN RAISE EXCEPTION 'kq_invalid_card_play'; END IF;

  SELECT * INTO v_run
  FROM public.kq_runs
  WHERE id = p_run_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_run.status <> 'active' THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
  IF v_run.updated_at <> p_expected_updated_at THEN RAISE EXCEPTION 'kq_stale_run'; END IF;
  IF (v_run.state->>'stageIndex')::SMALLINT <> p_stage_index
    OR (p_next_state->>'stageIndex')::SMALLINT <> p_stage_index
  THEN RAISE EXCEPTION 'kq_stage_mismatch'; END IF;

  SELECT definition.* INTO v_definition
  FROM public.lottery_card_definitions definition
  JOIN public.kq_support_card_rules rule ON rule.card_definition_id = definition.id
  WHERE definition.code = p_card_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_card_kind_mismatch'; END IF;
  SELECT rule.category INTO v_category
  FROM public.kq_support_card_rules rule
  WHERE rule.card_definition_id = v_definition.id;
  IF NOT FOUND OR v_category = 'substrate' OR v_category <> p_use_kind THEN
    RAISE EXCEPTION 'kq_card_kind_mismatch';
  END IF;
  IF p_use_kind = 'support' AND NOT (p_card_code = ANY(v_run.deck_codes)) THEN
    RAISE EXCEPTION 'kq_card_not_in_deck';
  END IF;
  IF p_use_kind = 'support' AND (
    SELECT count(*) FROM public.kq_card_burn_receipts
    WHERE run_id = p_run_id AND card_code = p_card_code AND use_kind = 'support'
  ) >= (
    SELECT count(*) FROM unnest(v_run.deck_codes) AS code WHERE code = p_card_code
  ) THEN RAISE EXCEPTION 'kq_card_already_played'; END IF;
  IF p_use_kind = 'pbi' AND COALESCE(v_run.state->>'revealedPest', '') = '' THEN
    RAISE EXCEPTION 'kq_pest_not_revealed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.kq_card_burn_receipts
    WHERE run_id = p_run_id AND stage_index = p_stage_index AND card_code = p_card_code
      AND use_kind = 'pbi'
  ) THEN RAISE EXCEPTION 'kq_card_already_played'; END IF;

  v_old_used := COALESCE(v_run.state->'usedCards', '[]'::JSONB);
  v_old_played := COALESCE(v_run.state->'playedThisStage', '[]'::JSONB);
  IF (p_next_state->'usedCards') IS DISTINCT FROM (v_old_used || jsonb_build_array(p_card_code))
    OR (p_next_state->'playedThisStage') IS DISTINCT FROM (v_old_played || jsonb_build_array(p_card_code))
    OR p_next_state->'seed' IS DISTINCT FROM v_run.state->'seed'
    OR p_next_state->'deckCodes' IS DISTINCT FROM v_run.state->'deckCodes'
    OR p_next_state->'situationCodes' IS DISTINCT FROM v_run.state->'situationCodes'
    OR p_next_state->'varietyCode' IS DISTINCT FROM v_run.state->'varietyCode'
    OR p_next_state->'history' IS DISTINCT FROM v_run.state->'history'
  THEN RAISE EXCEPTION 'kq_invalid_state_transition'; END IF;

  SELECT instance.* INTO v_instance
  FROM public.lottery_card_instances instance
  WHERE instance.user_id = p_user_id AND instance.card_definition_id = v_definition.id
  ORDER BY instance.created_at, instance.id
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_card_copy_unavailable'; END IF;

  DELETE FROM public.lottery_card_instances WHERE id = v_instance.id;
  INSERT INTO public.kq_card_burn_receipts (
    run_id, user_id, card_instance_id, card_definition_id, card_code, stage_index, use_kind
  ) VALUES (
    p_run_id, p_user_id, v_instance.id, v_definition.id, p_card_code, p_stage_index, p_use_kind
  ) RETURNING * INTO v_receipt;

  UPDATE public.kq_runs
  SET state = p_next_state, updated_at = now()
  WHERE id = p_run_id;

  RETURN jsonb_build_object('state', p_next_state, 'burnReceipt', to_jsonb(v_receipt));
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_play_support_card(UUID, UUID, TEXT, SMALLINT, TEXT, TIMESTAMPTZ, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_play_support_card(UUID, UUID, TEXT, SMALLINT, TEXT, TIMESTAMPTZ, JSONB)
  TO service_role;

COMMIT;
