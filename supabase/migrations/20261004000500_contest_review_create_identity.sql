BEGIN;

-- The server checks ownership of a purchase before creating a review. A first
-- review must still refer to that exact product if an admin has reassigned the
-- previously empty lot in the meantime, even when its season is unchanged.
CREATE OR REPLACE FUNCTION public.rpc_create_contest_review_atomic(
  p_entry_id text,
  p_season_id text,
  p_expected_product_id text,
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
  v_entry record;
BEGIN
  IF jsonb_typeof(p_scores) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_scores) = 0
     OR jsonb_typeof(p_aroma_tags) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_terpene_guesses) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'contest_review_invalid_collections' USING ERRCODE = '22023';
  END IF;

  SELECT product_id, season_id, is_published INTO v_entry
  FROM public.contest_entries
  WHERE id = p_entry_id
  FOR SHARE;
  IF NOT FOUND OR NOT v_entry.is_published THEN
    RAISE EXCEPTION 'Ce lot premium n''est pas disponible.' USING ERRCODE = '23514';
  END IF;
  IF v_entry.product_id IS DISTINCT FROM p_expected_product_id
     OR v_entry.season_id IS DISTINCT FROM p_season_id THEN
    RAISE EXCEPTION 'Le lot a changé. Recharge le carnet avant de soumettre ton avis.' USING ERRCODE = '23514';
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
  SELECT v_review_id, (item->>'criterion')::public.contest_score_criterion, (item->>'score')::smallint
  FROM jsonb_array_elements(p_scores) AS item;
  INSERT INTO public.contest_review_aroma_tags (review_id, tag, custom_label)
  SELECT v_review_id, (item->>'tag')::public.contest_aroma_tag, NULLIF(item->>'customLabel', '')
  FROM jsonb_array_elements(p_aroma_tags) AS item;
  INSERT INTO public.contest_review_terpene_guesses (review_id, terpene)
  SELECT v_review_id, trim(guess.value)
  FROM jsonb_array_elements_text(p_terpene_guesses) AS guess(value);
  RETURN v_review_id;
END;
$$;

-- Remove the overload that cannot verify which product was purchased. Keeping
-- it callable would bypass the guard and leave ambiguous PostgREST signatures.
DROP FUNCTION IF EXISTS public.rpc_create_contest_review_atomic(text, text, uuid, text, public.contest_consumption_method, text, text, jsonb, jsonb, jsonb);
REVOKE ALL ON FUNCTION public.rpc_create_contest_review_atomic(text, text, text, uuid, text, public.contest_consumption_method, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_create_contest_review_atomic(text, text, text, uuid, text, public.contest_consumption_method, text, text, jsonb, jsonb, jsonb) TO service_role;

COMMIT;
