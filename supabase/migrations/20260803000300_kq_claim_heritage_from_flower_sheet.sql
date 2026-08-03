BEGIN;

-- A validated flower still grants its La Botte pack automatically. The producer
-- Heritage is now claimed explicitly from a flower sheet once the set is complete.
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
  v_entitlement public.kq_support_booster_entitlements%ROWTYPE;
  v_flower_grant public.kq_notebook_flower_reward_grants%ROWTYPE;
  v_flower_was_granted BOOLEAN := FALSE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT || ':producer-notebook', 0));

  SELECT * INTO v_review FROM public.contest_reviews
  WHERE id = p_review_id AND customer_id = p_user_id AND status = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_notebook_review_not_approved'; END IF;

  SELECT * INTO v_entry FROM public.contest_entries
  WHERE id = v_review.entry_id AND producer_id IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_notebook_entry_without_producer'; END IF;

  SELECT * INTO v_flower_grant FROM public.kq_notebook_flower_reward_grants
  WHERE user_id = p_user_id AND entry_id = v_entry.id;
  IF NOT FOUND THEN
    INSERT INTO public.kq_support_booster_entitlements(user_id, source, reward_key, card_count)
    VALUES (p_user_id, 'notebook_flower', 'notebook-flower:' || p_user_id::TEXT || ':' || v_entry.id::TEXT, 10)
    ON CONFLICT (reward_key) DO UPDATE SET reward_key = EXCLUDED.reward_key
    RETURNING * INTO v_entitlement;

    INSERT INTO public.kq_notebook_flower_reward_grants(
      user_id, entry_id, review_id, producer_id, entitlement_id
    ) VALUES (p_user_id, v_entry.id, v_review.id, v_entry.producer_id, v_entitlement.id)
    ON CONFLICT (user_id, entry_id) DO NOTHING
    RETURNING * INTO v_flower_grant;
    v_flower_was_granted := FOUND;
  END IF;

  RETURN jsonb_build_object(
    'flowerBoosterGranted', v_flower_was_granted,
    'boosterCardCount', CASE WHEN v_flower_was_granted THEN 10 ELSE 0 END,
    'heritageGranted', 0,
    'heritageCodes', '[]'::JSONB
  );
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_grant_producer_notebook_rewards(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_grant_producer_notebook_rewards(UUID, UUID)
  TO service_role;

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
  v_required INTEGER;
  v_completed INTEGER;
  v_draw public.kq_heritage_draws%ROWTYPE;
  v_grant public.kq_producer_heritage_reward_grants%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_campaign_id IS NULL OR p_entry_id IS NULL OR BTRIM(p_entry_id) = '' THEN
    RAISE EXCEPTION 'kq_producer_heritage_invalid';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::TEXT || ':producer-heritage:' || p_campaign_id::TEXT, 0)
  );

  SELECT campaign.id, campaign.producer_id, campaign.heritage_code
  INTO v_campaign
  FROM public.kq_producer_reward_campaigns campaign
  JOIN public.kq_heritage_card_definitions definition
    ON definition.code = campaign.heritage_code AND definition.is_active = TRUE
  WHERE campaign.id = p_campaign_id AND campaign.status = 'active'
  FOR UPDATE OF campaign;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_producer_heritage_unavailable'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.kq_producer_reward_entries
    WHERE campaign_id = p_campaign_id AND entry_id = BTRIM(p_entry_id)
  ) THEN
    RAISE EXCEPTION 'kq_producer_heritage_unavailable';
  END IF;

  SELECT * INTO v_grant FROM public.kq_producer_heritage_reward_grants
  WHERE user_id = p_user_id AND campaign_id = p_campaign_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'cardCode', v_grant.heritage_code,
      'alreadyGranted', TRUE
    );
  END IF;

  SELECT COUNT(*) INTO v_required
  FROM public.kq_producer_reward_entries
  WHERE campaign_id = p_campaign_id;

  SELECT COUNT(DISTINCT required_entry.entry_id) INTO v_completed
  FROM public.kq_producer_reward_entries required_entry
  JOIN public.contest_reviews review
    ON review.entry_id = required_entry.entry_id
    AND review.customer_id = p_user_id
    AND review.status = 'approved'
  WHERE required_entry.campaign_id = p_campaign_id;

  IF v_required = 0 OR v_completed <> v_required THEN
    RAISE EXCEPTION 'kq_producer_heritage_incomplete';
  END IF;

  INSERT INTO public.kq_heritage_draws(
    user_id, order_item_id, unit_index, card_code, rarity, seed,
    was_duplicate, source, craft_key, producer_campaign_id
  ) VALUES (
    p_user_id, NULL, NULL, v_campaign.heritage_code, 'common', 0,
    FALSE, 'producer_notebook', NULL, v_campaign.id
  ) RETURNING * INTO v_draw;

  INSERT INTO public.kq_producer_heritage_reward_grants(
    user_id, campaign_id, producer_id, heritage_code, heritage_draw_id
  ) VALUES (
    p_user_id, v_campaign.id, v_campaign.producer_id, v_campaign.heritage_code, v_draw.id
  ) RETURNING * INTO v_grant;

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

COMMIT;
