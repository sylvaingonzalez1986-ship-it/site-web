BEGIN;

-- New producer completions earn 100 game euros per distinct notebook flower.
-- Existing receipts, balances and accounting entries remain unchanged: the
-- original product snapshot and credited amount are replayed on every retry.
-- Regular and Concours share the existing current-season requirement set.

CREATE OR REPLACE FUNCTION public.kq_producer_notebook_progress(p_user_id UUID, p_producer_id TEXT)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH required AS (SELECT product_id FROM public.kq_producer_notebook_products(p_producer_id)),
  reviewed AS (
    SELECT DISTINCT required.product_id FROM required
    JOIN public.contest_entries entry ON entry.product_id = required.product_id AND entry.producer_id = p_producer_id
    JOIN public.kq_current_notebook_season() season ON season.id = entry.season_id
    JOIN public.contest_reviews review ON review.entry_id = entry.id
      AND review.customer_id = p_user_id AND review.status = 'approved'
  ), purchased AS (
    SELECT DISTINCT product_id FROM public.kq_producer_paid_flower_items(p_user_id, p_producer_id)
  )
  SELECT jsonb_build_object(
    'producerId', p_producer_id,
    'selectedSeasonId', (SELECT id FROM public.kq_current_notebook_season()),
    'selectedSeasonLabel', (SELECT label FROM public.kq_current_notebook_season()),
    'qualifyingProductIds', COALESCE((SELECT jsonb_agg(product_id ORDER BY product_id) FROM required), '[]'::JSONB),
    'reviewedProductIds', COALESCE((SELECT jsonb_agg(product_id ORDER BY product_id) FROM reviewed), '[]'::JSONB),
    'purchasedProductIds', COALESCE((SELECT jsonb_agg(product_id ORDER BY product_id) FROM purchased), '[]'::JSONB),
    'completionGranted', EXISTS(SELECT 1 FROM public.kq_producer_completion_grants WHERE user_id = p_user_id AND producer_id = p_producer_id),
    'completionCashCents', COALESCE(
      (SELECT cash_cents::BIGINT FROM public.kq_producer_completion_grants WHERE user_id = p_user_id AND producer_id = p_producer_id),
      (SELECT count(*) * 10000::BIGINT FROM required)
    ),
    'purchaseGranted', EXISTS(SELECT 1 FROM public.kq_producer_purchase_buddie_grants WHERE user_id = p_user_id AND producer_id = p_producer_id),
    'purchaseCard', (SELECT jsonb_build_object('code', card.code, 'name', card.name, 'rarity', card.rarity, 'imageUrl', card.image_url)
      FROM public.kq_producer_purchase_buddie_grants reward
      JOIN public.lottery_card_definitions card ON card.id = reward.card_definition_id
      WHERE reward.user_id = p_user_id AND reward.producer_id = p_producer_id)
  );
$$;
REVOKE ALL ON FUNCTION public.kq_producer_notebook_progress(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_claim_producer_completion(p_user_id UUID, p_producer_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reward public.kq_producer_completion_grants%ROWTYPE;
  progress JSONB; product_ids TEXT[]; producer_name TEXT; wallet INTEGER; reward_cash_cents BIGINT;
BEGIN
  IF p_user_id IS NULL OR COALESCE(btrim(p_producer_id), '') = ''
    OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'kq_producer_completion_invalid';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('producer-completion:' || p_user_id::TEXT || ':' || p_producer_id, 0));
  SELECT * INTO reward FROM public.kq_producer_completion_grants WHERE user_id = p_user_id AND producer_id = p_producer_id;
  IF FOUND THEN
    RETURN jsonb_build_object('producerId', p_producer_id, 'cashCents', reward.cash_cents,
      'qualifyingProductIds', to_jsonb(reward.qualifying_product_ids), 'alreadyGranted', TRUE);
  END IF;
  SELECT name INTO producer_name FROM public.producers WHERE id = p_producer_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_producer_completion_invalid'; END IF;
  -- An approval/unpublication cannot be revoked between validation and credit.
  PERFORM entry.id FROM public.contest_entries entry
    JOIN public.products product ON product.id = entry.product_id
    WHERE entry.producer_id = p_producer_id ORDER BY entry.id FOR SHARE OF entry, product;
  PERFORM review.id FROM public.contest_reviews review
    JOIN public.contest_entries entry ON entry.id = review.entry_id
    WHERE review.customer_id = p_user_id AND entry.producer_id = p_producer_id
    ORDER BY review.id FOR SHARE OF review;
  progress := public.kq_producer_notebook_progress(p_user_id, p_producer_id);
  IF jsonb_array_length(progress->'qualifyingProductIds') = 0
    OR progress->'qualifyingProductIds' <> progress->'reviewedProductIds' THEN
    RAISE EXCEPTION 'kq_producer_completion_incomplete';
  END IF;
  SELECT array_agg(value ORDER BY value) INTO product_ids FROM jsonb_array_elements_text(progress->'qualifyingProductIds');
  -- Product ids already come from the distinct, complete notebook requirement set.
  reward_cash_cents := cardinality(product_ids)::BIGINT * 10000;
  INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
  SELECT cash_cents INTO wallet FROM public.kq_equipment_wallets WHERE user_id = p_user_id FOR UPDATE;
  IF reward_cash_cents > 2147483647 OR wallet::BIGINT + reward_cash_cents > 2147483647 THEN RAISE EXCEPTION 'kq_producer_completion_wallet_limit'; END IF;
  PERFORM public.kq_treasury_initialize(p_user_id);
  INSERT INTO public.kq_producer_completion_grants(user_id, producer_id, producer_name, cash_cents, qualifying_product_ids, season_id)
    VALUES(p_user_id, p_producer_id, producer_name, reward_cash_cents::INTEGER, product_ids, progress->>'selectedSeasonId');
  UPDATE public.kq_equipment_wallets SET cash_cents = cash_cents + reward_cash_cents::INTEGER, updated_at = now() WHERE user_id = p_user_id;
  -- The wallet observer has already posted cash/suspense. Classify that credit.
  PERFORM public.kq_treasury_pair(p_user_id, 'reward', 'producer-completion:' || p_producer_id,
    now(), 'suspense', 'revenue_rewards', reward_cash_cents, 'Carnet complet : ' || producer_name);
  RETURN jsonb_build_object('producerId', p_producer_id, 'cashCents', reward_cash_cents,
    'qualifyingProductIds', to_jsonb(product_ids), 'alreadyGranted', FALSE);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_claim_producer_completion(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_claim_producer_completion(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_grant_producer_notebook_rewards(p_user_id UUID, p_review_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE review public.contest_reviews%ROWTYPE; entry public.contest_entries%ROWTYPE;
  campaign RECORD; draw public.kq_heritage_draws%ROWTYPE; progress JSONB; completion JSONB;
  heritage_granted INTEGER := 0; heritage_codes JSONB := '[]'::JSONB; completion_granted BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL OR p_review_id IS NULL THEN RAISE EXCEPTION 'kq_notebook_reward_invalid'; END IF;
  SELECT * INTO review FROM public.contest_reviews WHERE id = p_review_id AND customer_id = p_user_id AND status = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_notebook_review_not_approved'; END IF;
  SELECT * INTO entry FROM public.contest_entries WHERE id = review.entry_id;
  IF entry.producer_id IS NOT NULL THEN
    SELECT c.id, c.producer_id, c.heritage_code, definition.rarity INTO campaign
    FROM public.kq_producer_reward_campaigns c
    JOIN public.kq_producer_reward_entries required ON required.campaign_id = c.id AND required.entry_id = entry.id
    JOIN public.kq_heritage_card_definitions definition ON definition.code = c.heritage_code AND definition.is_active
    WHERE c.producer_id = entry.producer_id AND c.status = 'active';
    IF FOUND THEN
      PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT || ':producer-heritage:' || campaign.id::TEXT, 0));
      IF NOT EXISTS(SELECT 1 FROM public.kq_producer_heritage_reward_grants WHERE user_id = p_user_id AND campaign_id = campaign.id) THEN
        INSERT INTO public.kq_heritage_draws(user_id, order_item_id, unit_index, card_code, rarity, seed,
          was_duplicate, source, craft_key, producer_campaign_id)
        VALUES(p_user_id, NULL, NULL, campaign.heritage_code, campaign.rarity, 0, FALSE, 'producer_notebook', NULL, campaign.id)
        RETURNING * INTO draw;
        INSERT INTO public.kq_producer_heritage_reward_grants(user_id, campaign_id, producer_id, heritage_code, heritage_draw_id)
          VALUES(p_user_id, campaign.id, campaign.producer_id, campaign.heritage_code, draw.id);
        heritage_granted := 1; heritage_codes := jsonb_build_array(campaign.heritage_code);
      END IF;
    END IF;
    progress := public.kq_producer_notebook_progress(p_user_id, entry.producer_id);
    IF jsonb_array_length(progress->'qualifyingProductIds') > 0
      AND progress->'qualifyingProductIds' = progress->'reviewedProductIds' THEN
      -- Revalidation happens inside the claim's lock. If a simultaneous
      -- moderation/catalogue change removed eligibility, keep the Heritage.
      BEGIN
        completion := public.rpc_kq_claim_producer_completion(p_user_id, entry.producer_id);
        completion_granted := NOT (completion->>'alreadyGranted')::BOOLEAN;
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'kq_producer_completion_incomplete' THEN RAISE; END IF;
      END;
    END IF;
  END IF;
  RETURN jsonb_build_object('flowerBoosterGranted', FALSE, 'flowerBoostersGranted', 0,
    'flowerBoostersTotal', 0, 'boosterCardCount', 0, 'heritageGranted', heritage_granted,
    'heritageCodes', heritage_codes, 'completionGranted', completion_granted,
    'cashCents', CASE WHEN completion_granted THEN (completion->>'cashCents')::INTEGER ELSE 0 END, 'producerId', entry.producer_id);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_grant_producer_notebook_rewards(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_grant_producer_notebook_rewards(UUID, UUID) TO service_role;

COMMIT;
