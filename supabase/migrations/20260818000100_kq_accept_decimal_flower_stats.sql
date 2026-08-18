BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_kq_update_run_state(
  p_user_id UUID,
  p_run_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_action TEXT,
  p_next_state JSONB,
  p_flower JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.kq_runs%ROWTYPE;
  v_flower public.kq_flowers%ROWTYPE;
  v_complete BOOLEAN;
BEGIN
  IF p_action NOT IN ('roll', 'resolve', 'advance', 'redraw', 'heritage')
    OR p_next_state IS NULL
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
  THEN RAISE EXCEPTION 'kq_invalid_state_transition'; END IF;

  v_complete := p_next_state->>'phase' = 'complete';
  IF v_complete THEN
    IF p_action <> 'advance' OR p_flower IS NULL
      OR p_flower->>'varietyCode' IS DISTINCT FROM p_next_state->>'varietyCode'
      OR p_flower->>'varietyName' IS DISTINCT FROM p_next_state->>'varietyName'
      OR (p_flower->>'quality')::INTEGER IS DISTINCT FROM (p_next_state->>'quality')::INTEGER
      OR jsonb_typeof(p_flower->'traits') <> 'array'
      OR jsonb_typeof(p_flower->'combos') <> 'array'
      OR jsonb_typeof(p_flower->'battleStats') <> 'object'
      OR COALESCE(p_flower->>'integrityCode', '') !~ '^KQ-[0-9A-F]{8}$'
    THEN RAISE EXCEPTION 'kq_invalid_flower'; END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_each_text(p_flower->'battleStats') AS stat(key, value)
      WHERE key NOT IN ('appearance', 'aroma', 'vigor', 'mastery', 'regularity')
        OR value::NUMERIC NOT BETWEEN 35 AND 99
    ) OR (SELECT count(*) FROM jsonb_object_keys(p_flower->'battleStats')) <> 5
    THEN RAISE EXCEPTION 'kq_invalid_flower_stats'; END IF;
  ELSIF p_flower IS NOT NULL THEN
    RAISE EXCEPTION 'kq_flower_before_completion';
  END IF;

  UPDATE public.kq_runs
  SET state = p_next_state,
    integrity_code = CASE WHEN v_complete THEN p_flower->>'integrityCode' ELSE integrity_code END,
    status = CASE WHEN v_complete THEN 'completed'::public.kq_run_status ELSE status END,
    completed_at = CASE WHEN v_complete THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = p_run_id;

  IF v_complete THEN
    INSERT INTO public.kq_flowers (
      run_id, owner_id, variety_code, variety_name, quality, traits, combos,
      battle_stats
    ) VALUES (
      p_run_id,
      p_user_id,
      p_flower->>'varietyCode',
      p_flower->>'varietyName',
      (p_flower->>'quality')::SMALLINT,
      ARRAY(SELECT jsonb_array_elements_text(p_flower->'traits')),
      ARRAY(SELECT jsonb_array_elements_text(p_flower->'combos')),
      p_flower->'battleStats'
    )
    RETURNING * INTO v_flower;
  END IF;

  RETURN jsonb_build_object(
    'state', p_next_state,
    'flower', CASE WHEN v_complete THEN to_jsonb(v_flower) ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_update_run_state(
  UUID, UUID, TIMESTAMPTZ, TEXT, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_update_run_state(
  UUID, UUID, TIMESTAMPTZ, TEXT, JSONB, JSONB
) TO service_role;

COMMIT;
