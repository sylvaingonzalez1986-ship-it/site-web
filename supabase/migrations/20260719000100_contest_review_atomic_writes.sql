CREATE OR REPLACE FUNCTION public.rpc_create_contest_review_atomic(
  p_entry_id text,
  p_season_id text,
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
  v_review_id uuid;
BEGIN
  IF jsonb_typeof(p_scores) <> 'array'
     OR jsonb_array_length(p_scores) = 0
     OR jsonb_typeof(p_aroma_tags) <> 'array'
     OR jsonb_typeof(p_terpene_guesses) <> 'array' THEN
    RAISE EXCEPTION 'contest_review_invalid_collections' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.contest_reviews (
    entry_id, season_id, customer_id, pseudo_snapshot, consumption_method,
    consumption_details, comment, status
  ) VALUES (
    p_entry_id, p_season_id, p_customer_id, p_pseudo_snapshot, p_consumption_method,
    p_consumption_details, p_comment, 'pending'
  )
  RETURNING id INTO v_review_id;

  INSERT INTO public.contest_review_scores (review_id, criterion, score)
  SELECT
    v_review_id,
    (item->>'criterion')::public.contest_score_criterion,
    (item->>'score')::smallint
  FROM jsonb_array_elements(p_scores) AS item;

  INSERT INTO public.contest_review_aroma_tags (review_id, tag, custom_label)
  SELECT
    v_review_id,
    (item->>'tag')::public.contest_aroma_tag,
    NULLIF(item->>'customLabel', '')
  FROM jsonb_array_elements(p_aroma_tags) AS item;

  INSERT INTO public.contest_review_terpene_guesses (review_id, terpene)
  SELECT v_review_id, trim(guess.value)
  FROM jsonb_array_elements_text(p_terpene_guesses) AS guess(value);

  RETURN v_review_id;
END;
$$;
