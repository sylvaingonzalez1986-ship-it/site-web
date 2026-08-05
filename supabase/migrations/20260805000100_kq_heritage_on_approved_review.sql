BEGIN;

-- Producer Heritage cards are earned through tasting: approving one review for
-- any entry attached to the active producer campaign grants its permanent card.
-- No La Botte pack is created here; packs remain limited to notebook missions.
CREATE OR REPLACE FUNCTION public.rpc_kq_grant_producer_notebook_rewards(
  p_user_id UUID,
  p_review_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review public.contest_reviews%ROWTYPE;
  v_entry public.contest_entries%ROWTYPE;
  v_campaign RECORD;
  v_draw public.kq_heritage_draws%ROWTYPE;
  v_grant public.kq_producer_heritage_reward_grants%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_review_id IS NULL THEN
    RAISE EXCEPTION 'kq_notebook_reward_invalid';
  END IF;

  SELECT * INTO v_review
  FROM public.contest_reviews
  WHERE id = p_review_id
    AND customer_id = p_user_id
    AND status = 'approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'kq_notebook_review_not_approved';
  END IF;

  SELECT * INTO v_entry
  FROM public.contest_entries
  WHERE id = v_review.entry_id
    AND producer_id IS NOT NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'flowerBoosterGranted', FALSE,
      'boosterCardCount', 0,
      'heritageGranted', 0,
      'heritageCodes', '[]'::JSONB
    );
  END IF;

  SELECT campaign.id, campaign.producer_id, campaign.heritage_code, definition.rarity
  INTO v_campaign
  FROM public.kq_producer_reward_campaigns campaign
  JOIN public.kq_producer_reward_entries campaign_entry
    ON campaign_entry.campaign_id = campaign.id
    AND campaign_entry.entry_id = v_entry.id
  JOIN public.kq_heritage_card_definitions definition
    ON definition.code = campaign.heritage_code
    AND definition.is_active = TRUE
  WHERE campaign.producer_id = v_entry.producer_id
    AND campaign.status = 'active'
  FOR UPDATE OF campaign;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'flowerBoosterGranted', FALSE,
      'boosterCardCount', 0,
      'heritageGranted', 0,
      'heritageCodes', '[]'::JSONB
    );
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::TEXT || ':producer-heritage:' || v_campaign.id::TEXT, 0)
  );

  SELECT * INTO v_grant
  FROM public.kq_producer_heritage_reward_grants
  WHERE user_id = p_user_id
    AND campaign_id = v_campaign.id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'flowerBoosterGranted', FALSE,
      'boosterCardCount', 0,
      'heritageGranted', 0,
      'heritageCodes', '[]'::JSONB
    );
  END IF;

  INSERT INTO public.kq_heritage_draws(
    user_id, order_item_id, unit_index, card_code, rarity, seed,
    was_duplicate, source, craft_key, producer_campaign_id
  ) VALUES (
    p_user_id, NULL, NULL, v_campaign.heritage_code, v_campaign.rarity, 0,
    FALSE, 'producer_notebook', NULL, v_campaign.id
  )
  RETURNING * INTO v_draw;

  INSERT INTO public.kq_producer_heritage_reward_grants(
    user_id, campaign_id, producer_id, heritage_code, heritage_draw_id
  ) VALUES (
    p_user_id, v_campaign.id, v_campaign.producer_id, v_campaign.heritage_code, v_draw.id
  );

  RETURN jsonb_build_object(
    'flowerBoosterGranted', FALSE,
    'boosterCardCount', 0,
    'heritageGranted', 1,
    'heritageCodes', jsonb_build_array(v_campaign.heritage_code)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_grant_producer_notebook_rewards(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_grant_producer_notebook_rewards(UUID, UUID)
  TO service_role;

-- Keep the explicit claim endpoint as an idempotent recovery path, but apply
-- the same rule: one approved review on the selected eligible flower is enough.
CREATE OR REPLACE FUNCTION public.rpc_kq_claim_producer_heritage(
  p_user_id UUID,
  p_campaign_id UUID,
  p_entry_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign RECORD;
  v_draw public.kq_heritage_draws%ROWTYPE;
  v_grant public.kq_producer_heritage_reward_grants%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_campaign_id IS NULL OR COALESCE(BTRIM(p_entry_id), '') = '' THEN
    RAISE EXCEPTION 'kq_producer_heritage_invalid';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::TEXT || ':producer-heritage:' || p_campaign_id::TEXT, 0)
  );

  SELECT campaign.id, campaign.producer_id, campaign.heritage_code, definition.rarity
  INTO v_campaign
  FROM public.kq_producer_reward_campaigns campaign
  JOIN public.kq_producer_reward_entries campaign_entry
    ON campaign_entry.campaign_id = campaign.id
    AND campaign_entry.entry_id = BTRIM(p_entry_id)
  JOIN public.kq_heritage_card_definitions definition
    ON definition.code = campaign.heritage_code
    AND definition.is_active = TRUE
  WHERE campaign.id = p_campaign_id
    AND campaign.status = 'active'
  FOR UPDATE OF campaign;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'kq_producer_heritage_unavailable';
  END IF;

  SELECT * INTO v_grant
  FROM public.kq_producer_heritage_reward_grants
  WHERE user_id = p_user_id
    AND campaign_id = p_campaign_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'cardCode', v_grant.heritage_code,
      'alreadyGranted', TRUE
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.contest_reviews review
    WHERE review.entry_id = BTRIM(p_entry_id)
      AND review.customer_id = p_user_id
      AND review.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'kq_producer_heritage_incomplete';
  END IF;

  INSERT INTO public.kq_heritage_draws(
    user_id, order_item_id, unit_index, card_code, rarity, seed,
    was_duplicate, source, craft_key, producer_campaign_id
  ) VALUES (
    p_user_id, NULL, NULL, v_campaign.heritage_code, v_campaign.rarity, 0,
    FALSE, 'producer_notebook', NULL, v_campaign.id
  )
  RETURNING * INTO v_draw;

  INSERT INTO public.kq_producer_heritage_reward_grants(
    user_id, campaign_id, producer_id, heritage_code, heritage_draw_id
  ) VALUES (
    p_user_id, v_campaign.id, v_campaign.producer_id, v_campaign.heritage_code, v_draw.id
  )
  RETURNING * INTO v_grant;

  RETURN jsonb_build_object(
    'cardCode', v_grant.heritage_code,
    'alreadyGranted', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_claim_producer_heritage(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_claim_producer_heritage(UUID, UUID, TEXT)
  TO service_role;

-- Defense in depth: payment can no longer invoke the old producer-card path.
REVOKE ALL ON FUNCTION public.rpc_kq_draw_heritage_for_purchase(UUID, BIGINT, INTEGER)
  FROM service_role;

COMMIT;
