BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_kq_swap_heritage_hand(
  p_user_id UUID,
  p_run_id UUID,
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
BEGIN
  IF p_next_state IS NULL
  THEN RAISE EXCEPTION 'kq_invalid_action'; END IF;

  SELECT * INTO v_run
  FROM public.kq_runs
  WHERE id = p_run_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_run.status <> 'active'
  THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
  IF v_run.updated_at <> p_expected_updated_at
  THEN RAISE EXCEPTION 'kq_stale_run'; END IF;

  IF p_next_state->'seed' IS DISTINCT FROM v_run.state->'seed'
    OR p_next_state->'deckCodes' IS DISTINCT FROM v_run.state->'deckCodes'
    OR p_next_state->'situationCodes' IS DISTINCT FROM v_run.state->'situationCodes'
    OR p_next_state->'varietyCode' IS DISTINCT FROM v_run.state->'varietyCode'
    OR p_next_state->'heritageCode' IS DISTINCT FROM v_run.state->'heritageCode'
    OR p_next_state->'usedCards' IS DISTINCT FROM v_run.state->'usedCards'
    OR p_next_state->>'phase' IS DISTINCT FROM v_run.state->>'phase'
    OR p_next_state->'stageIndex' IS DISTINCT FROM v_run.state->'stageIndex'
    OR jsonb_array_length(COALESCE(p_next_state->'handCodes', '[]'::JSONB))
      <> jsonb_array_length(COALESCE(v_run.state->'handCodes', '[]'::JSONB))
    OR jsonb_array_length(COALESCE(p_next_state->'heritageReserveCodes', '[]'::JSONB))
      <> jsonb_array_length(COALESCE(v_run.state->'heritageReserveCodes', '[]'::JSONB))
  THEN RAISE EXCEPTION 'kq_invalid_state_transition'; END IF;

  UPDATE public.kq_runs
  SET state = p_next_state, updated_at = now()
  WHERE id = p_run_id;

  RETURN jsonb_build_object('state', p_next_state, 'flower', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_swap_heritage_hand(
  UUID, UUID, TIMESTAMPTZ, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_swap_heritage_hand(
  UUID, UUID, TIMESTAMPTZ, JSONB
) TO service_role;

COMMIT;
