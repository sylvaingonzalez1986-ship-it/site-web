CREATE OR REPLACE FUNCTION public.rpc_update_contest_review_atomic(
  p_review_id uuid,
  p_customer_id uuid,
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
BEGIN
  IF jsonb_typeof(p_scores) <> 'array'
     OR jsonb_array_length(p_scores) = 0
     OR jsonb_typeof(p_aroma_tags) <> 'array'
     OR jsonb_typeof(p_terpene_guesses) <> 'array' THEN
    RAISE EXCEPTION 'contest_review_invalid_collections' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_status FROM public.contest_reviews
  WHERE id = p_review_id AND customer_id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contest_review_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'contest_review_not_pending' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.contest_reviews
  SET pseudo_snapshot = p_pseudo_snapshot,
      consumption_method = p_consumption_method,
      consumption_details = p_consumption_details,
      comment = p_comment,
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
