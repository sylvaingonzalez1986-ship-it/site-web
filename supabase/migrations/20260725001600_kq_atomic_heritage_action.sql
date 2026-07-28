BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_kq_update_run_state(
  p_user_id UUID,
  p_run_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_action TEXT,
  p_next_state JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_run public.kq_runs%ROWTYPE;
BEGIN
  IF p_action NOT IN ('roll', 'resolve', 'advance', 'redraw', 'heritage') OR p_next_state IS NULL
  THEN RAISE EXCEPTION 'kq_invalid_action'; END IF;
  SELECT * INTO v_run FROM public.kq_runs
  WHERE id = p_run_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_run.status <> 'active' THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
  IF v_run.updated_at <> p_expected_updated_at THEN RAISE EXCEPTION 'kq_stale_run'; END IF;
  IF p_next_state->'seed' IS DISTINCT FROM v_run.state->'seed'
    OR p_next_state->'deckCodes' IS DISTINCT FROM v_run.state->'deckCodes'
    OR p_next_state->'situationCodes' IS DISTINCT FROM v_run.state->'situationCodes'
    OR p_next_state->'varietyCode' IS DISTINCT FROM v_run.state->'varietyCode'
    OR p_next_state->'heritageCode' IS DISTINCT FROM v_run.state->'heritageCode'
    OR p_next_state->'usedCards' IS DISTINCT FROM v_run.state->'usedCards'
  THEN RAISE EXCEPTION 'kq_invalid_state_transition'; END IF;
  UPDATE public.kq_runs
  SET state = p_next_state,
    status = CASE WHEN p_next_state->>'phase' = 'complete' THEN 'completed'::public.kq_run_status ELSE status END,
    completed_at = CASE WHEN p_next_state->>'phase' = 'complete' THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = p_run_id;
  RETURN p_next_state;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_update_run_state(UUID, UUID, TIMESTAMPTZ, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_update_run_state(UUID, UUID, TIMESTAMPTZ, TEXT, JSONB)
  TO service_role;

COMMIT;
