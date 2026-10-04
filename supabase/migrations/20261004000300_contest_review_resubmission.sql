BEGIN;

-- A rejected tasting can be corrected by its owner and returns to moderation.
-- Lock and recheck the current status inside the same transaction as replacing
-- its scores/aromas/guesses, so a concurrent approval cannot be overwritten.
CREATE OR REPLACE FUNCTION public.rpc_update_contest_review_atomic(
  p_review_id uuid,
  p_customer_id uuid,
  p_expected_updated_at timestamptz,
  p_pseudo_snapshot text,
  p_consumption_method public.contest_consumption_method,
  p_consumption_details text,
  p_comment text,
  p_scores jsonb,
  p_aroma_tags jsonb DEFAULT '[]'::jsonb,
  p_terpene_guesses jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.contest_review_status;
  v_updated_at timestamptz;
BEGIN
  IF jsonb_typeof(p_scores) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_scores) = 0
     OR jsonb_typeof(p_aroma_tags) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_terpene_guesses) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'contest_review_invalid_collections' USING ERRCODE = '22023';
  END IF;

  SELECT status, updated_at INTO v_status, v_updated_at FROM public.contest_reviews
  WHERE id = p_review_id AND customer_id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contest_review_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status NOT IN ('pending', 'rejected') THEN
    RAISE EXCEPTION 'contest_review_not_editable' USING ERRCODE = 'P0001';
  END IF;
  IF p_expected_updated_at IS NULL OR v_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'contest_review_version_conflict' USING ERRCODE = '40001';
  END IF;

  UPDATE public.contest_reviews
  SET pseudo_snapshot = p_pseudo_snapshot,
      consumption_method = p_consumption_method,
      consumption_details = p_consumption_details,
      comment = p_comment,
      status = 'pending',
      quality_mark = '',
      admin_note = '', reviewed_by = NULL, reviewed_at = NULL, updated_at = now()
  WHERE id = p_review_id AND customer_id = p_customer_id;

  DELETE FROM public.contest_review_scores WHERE review_id = p_review_id;
  DELETE FROM public.contest_review_aroma_tags WHERE review_id = p_review_id;
  DELETE FROM public.contest_review_terpene_guesses WHERE review_id = p_review_id;

  INSERT INTO public.contest_review_scores (review_id, criterion, score)
  SELECT p_review_id, (item->>'criterion')::public.contest_score_criterion, (item->>'score')::smallint
  FROM jsonb_array_elements(p_scores) AS item;
  INSERT INTO public.contest_review_aroma_tags (review_id, tag, custom_label)
  SELECT p_review_id, (item->>'tag')::public.contest_aroma_tag, NULLIF(item->>'customLabel', '')
  FROM jsonb_array_elements(p_aroma_tags) AS item;
  INSERT INTO public.contest_review_terpene_guesses (review_id, terpene)
  SELECT p_review_id, trim(guess.value)
  FROM jsonb_array_elements_text(p_terpene_guesses) AS guess(value);
  RETURN p_review_id;
END;
$$;

-- The previous overload cannot protect an edit from a stale browser tab.
DROP FUNCTION IF EXISTS public.rpc_update_contest_review_atomic(uuid, uuid, text, public.contest_consumption_method, text, text, jsonb, jsonb, jsonb);
REVOKE ALL ON FUNCTION public.rpc_update_contest_review_atomic(uuid, uuid, timestamptz, text, public.contest_consumption_method, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_update_contest_review_atomic(uuid, uuid, timestamptz, text, public.contest_consumption_method, text, text, jsonb, jsonb, jsonb) TO service_role;

COMMIT;
