BEGIN;

-- Producer ids are immutable receipt snapshots, deliberately not cascading
-- foreign keys: deleting a producer must not delete an earned reward.
CREATE TABLE public.kq_producer_completion_grants (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  producer_id TEXT NOT NULL CHECK (length(btrim(producer_id)) > 0),
  producer_name TEXT NOT NULL,
  cash_cents INTEGER NOT NULL DEFAULT 10000 CHECK (cash_cents > 0),
  qualifying_product_ids TEXT[] NOT NULL CHECK (cardinality(qualifying_product_ids) > 0),
  season_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, producer_id)
);
ALTER TABLE public.kq_producer_completion_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_producer_completion_grants FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.kq_producer_completion_grants TO service_role;

CREATE TABLE public.kq_producer_purchase_buddie_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  producer_id TEXT NOT NULL CHECK (length(btrim(producer_id)) > 0),
  producer_name TEXT NOT NULL,
  qualifying_product_ids TEXT[] NOT NULL CHECK (cardinality(qualifying_product_ids) > 0),
  qualifying_order_ids TEXT[] NOT NULL CHECK (cardinality(qualifying_order_ids) > 0),
  qualifying_order_item_ids BIGINT[] NOT NULL CHECK (cardinality(qualifying_order_item_ids) > 0),
  card_definition_id UUID NOT NULL REFERENCES public.lottery_card_definitions(id) ON DELETE RESTRICT,
  card_instance_id UUID UNIQUE REFERENCES public.lottery_card_instances(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, producer_id)
);
ALTER TABLE public.kq_producer_purchase_buddie_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_producer_purchase_buddie_grants FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.kq_producer_purchase_buddie_grants TO service_role;

ALTER TABLE public.lottery_card_instances
  ADD COLUMN producer_purchase_buddie_grant_id UUID
  REFERENCES public.kq_producer_purchase_buddie_grants(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX uq_kq_producer_purchase_buddie_instance
  ON public.lottery_card_instances(producer_purchase_buddie_grant_id)
  WHERE producer_purchase_buddie_grant_id IS NOT NULL;
ALTER TABLE public.lottery_card_instances DROP CONSTRAINT lottery_card_instances_source_required;
ALTER TABLE public.lottery_card_instances ADD CONSTRAINT lottery_card_instances_source_required
  CHECK (ticket_id IS NOT NULL OR kq_support_entitlement_id IS NOT NULL
    OR source_bot_battle_id IS NOT NULL OR pioneer_grant_id IS NOT NULL
    OR producer_purchase_buddie_grant_id IS NOT NULL);

-- Match resolveContestSeason(): first active, non-archived season, otherwise
-- the first season in the public notebook's ordering. No archived obligations.
CREATE FUNCTION public.kq_current_notebook_season()
RETURNS TABLE(id TEXT, label TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT season.id, season.label FROM public.contest_seasons season
  ORDER BY (season.is_active AND NOT season.is_archived) DESC,
    season.is_active DESC, season.is_archived ASC, season.year DESC,
    season.harvest_end DESC NULLS LAST, season.created_at DESC, season.id
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.kq_current_notebook_season() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.kq_producer_notebook_products(p_producer_id TEXT)
RETURNS TABLE(product_id TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT entry.product_id
  FROM public.contest_entries entry
  JOIN public.products product ON product.id = entry.product_id AND product.category::TEXT = 'fleurs'
  JOIN public.kq_current_notebook_season() season ON season.id = entry.season_id
  WHERE entry.producer_id = p_producer_id AND entry.is_published;
$$;
REVOKE ALL ON FUNCTION public.kq_producer_notebook_products(TEXT) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.kq_producer_paid_flower_items(p_user_id UUID, p_producer_id TEXT)
RETURNS TABLE(order_id TEXT, order_item_id BIGINT, product_id TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT orders.id, item.id, required.product_id
  FROM public.kq_producer_notebook_products(p_producer_id) required
  JOIN public.order_items item ON split_part(btrim(item.product_id), '::', 1) = required.product_id AND item.quantity > 0
  JOIN public.orders orders ON orders.id = item.order_id
  JOIN auth.users customer ON customer.id = p_user_id
  WHERE orders.payment_state = 'paid' AND orders.status <> 'cancelled'
    AND orders.created_at <= now()
    AND (orders.customer_id = p_user_id OR (
      orders.customer_id IS NULL AND customer.email_confirmed_at IS NOT NULL
      AND nullif(btrim(customer.email), '') IS NOT NULL
      AND lower(btrim(orders.customer_email)) = lower(btrim(customer.email))
    ));
$$;
REVOKE ALL ON FUNCTION public.kq_producer_paid_flower_items(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.kq_producer_notebook_progress(p_user_id UUID, p_producer_id TEXT)
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
    'purchaseGranted', EXISTS(SELECT 1 FROM public.kq_producer_purchase_buddie_grants WHERE user_id = p_user_id AND producer_id = p_producer_id),
    'purchaseCard', (SELECT jsonb_build_object('code', card.code, 'name', card.name, 'rarity', card.rarity, 'imageUrl', card.image_url)
      FROM public.kq_producer_purchase_buddie_grants reward
      JOIN public.lottery_card_definitions card ON card.id = reward.card_definition_id
      WHERE reward.user_id = p_user_id AND reward.producer_id = p_producer_id)
  );
$$;
REVOKE ALL ON FUNCTION public.kq_producer_notebook_progress(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.rpc_kq_get_producer_notebook_progress(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'kq_producer_reward_invalid_user';
  END IF;
  SELECT COALESCE(jsonb_agg(progress ORDER BY producer_id), '[]'::JSONB) INTO result
  FROM (
    SELECT producer.id AS producer_id, public.kq_producer_notebook_progress(p_user_id, producer.id) AS progress
    FROM public.producers producer
    WHERE EXISTS(SELECT 1 FROM public.kq_producer_notebook_products(producer.id))
  ) rows;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_get_producer_notebook_progress(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_get_producer_notebook_progress(UUID) TO service_role;

CREATE FUNCTION public.rpc_kq_claim_producer_completion(p_user_id UUID, p_producer_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reward public.kq_producer_completion_grants%ROWTYPE;
  progress JSONB; product_ids TEXT[]; producer_name TEXT; wallet INTEGER;
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
  INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
  SELECT cash_cents INTO wallet FROM public.kq_equipment_wallets WHERE user_id = p_user_id FOR UPDATE;
  IF wallet > 2147483647 - 10000 THEN RAISE EXCEPTION 'kq_producer_completion_wallet_limit'; END IF;
  PERFORM public.kq_treasury_initialize(p_user_id);
  INSERT INTO public.kq_producer_completion_grants(user_id, producer_id, producer_name, cash_cents, qualifying_product_ids, season_id)
    VALUES(p_user_id, p_producer_id, producer_name, 10000, product_ids, progress->>'selectedSeasonId');
  UPDATE public.kq_equipment_wallets SET cash_cents = cash_cents + 10000, updated_at = now() WHERE user_id = p_user_id;
  -- The wallet observer has already posted cash/suspense. Classify that credit.
  PERFORM public.kq_treasury_pair(p_user_id, 'reward', 'producer-completion:' || p_producer_id,
    now(), 'suspense', 'revenue_rewards', 10000, 'Carnet complet : ' || producer_name);
  RETURN jsonb_build_object('producerId', p_producer_id, 'cashCents', 10000,
    'qualifyingProductIds', to_jsonb(product_ids), 'alreadyGranted', FALSE);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_claim_producer_completion(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_claim_producer_completion(UUID, TEXT) TO service_role;

CREATE FUNCTION public.rpc_kq_claim_producer_purchase_buddie(p_user_id UUID, p_producer_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reward public.kq_producer_purchase_buddie_grants%ROWTYPE;
  card public.lottery_card_definitions%ROWTYPE; progress JSONB; producer_name TEXT;
  product_ids TEXT[]; order_ids TEXT[]; item_ids BIGINT[]; pool UUID[]; instance_id UUID;
BEGIN
  IF p_user_id IS NULL OR COALESCE(btrim(p_producer_id), '') = ''
    OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'kq_producer_purchase_invalid';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('producer-buddie:' || p_user_id::TEXT || ':' || p_producer_id, 0));
  -- Keep verified guest-email ownership stable until the receipt is minted.
  PERFORM 1 FROM auth.users WHERE id = p_user_id FOR SHARE;
  SELECT * INTO reward FROM public.kq_producer_purchase_buddie_grants WHERE user_id = p_user_id AND producer_id = p_producer_id;
  IF FOUND THEN
    SELECT * INTO card FROM public.lottery_card_definitions WHERE id = reward.card_definition_id;
    RETURN jsonb_build_object('producerId', p_producer_id, 'cardCode', card.code, 'cardName', card.name,
      'cardRarity', card.rarity, 'cardImageUrl', card.image_url, 'cardInstanceId', reward.card_instance_id,
      'qualifyingProductIds', to_jsonb(reward.qualifying_product_ids), 'alreadyGranted', TRUE);
  END IF;
  SELECT name INTO producer_name FROM public.producers WHERE id = p_producer_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_producer_purchase_invalid'; END IF;
  PERFORM entry.id FROM public.contest_entries entry
    JOIN public.products product ON product.id = entry.product_id
    WHERE entry.producer_id = p_producer_id ORDER BY entry.id FOR SHARE OF entry, product;
  -- Lock both the qualifying order and its line, then read eligibility again.
  PERFORM orders.id FROM public.orders orders
    JOIN public.order_items item ON item.order_id = orders.id
    JOIN public.kq_producer_paid_flower_items(p_user_id, p_producer_id) eligible ON eligible.order_item_id = item.id
    ORDER BY orders.id, item.id FOR SHARE OF orders, item;
  progress := public.kq_producer_notebook_progress(p_user_id, p_producer_id);
  IF jsonb_array_length(progress->'qualifyingProductIds') = 0
    OR progress->'qualifyingProductIds' <> progress->'purchasedProductIds' THEN
    RAISE EXCEPTION 'kq_producer_purchase_incomplete';
  END IF;
  PERFORM definition.id FROM public.lottery_card_definitions definition
    JOIN public.lottery_card_collections collection ON collection.id = definition.collection_id
    WHERE collection.code = 'HEMP_HEROES_2026' AND collection.is_active AND definition.is_active
      AND definition.rarity IN ('silver', 'gold')
    ORDER BY definition.id FOR SHARE OF definition, collection;
  SELECT array_agg(definition.id ORDER BY definition.card_number, definition.id) INTO pool
    FROM public.lottery_card_definitions definition
    JOIN public.lottery_card_collections collection ON collection.id = definition.collection_id
    WHERE collection.code = 'HEMP_HEROES_2026' AND collection.is_active AND definition.is_active
      AND definition.rarity IN ('silver', 'gold');
  IF COALESCE(cardinality(pool), 0) = 0 THEN RAISE EXCEPTION 'kq_producer_buddie_unavailable'; END IF;
  SELECT * INTO card FROM public.lottery_card_definitions
    WHERE id = pool[public.lottery_secure_random_int(1, cardinality(pool))];
  SELECT array_agg(DISTINCT product_id ORDER BY product_id), array_agg(DISTINCT order_id ORDER BY order_id),
    array_agg(DISTINCT order_item_id ORDER BY order_item_id) INTO product_ids, order_ids, item_ids
    FROM public.kq_producer_paid_flower_items(p_user_id, p_producer_id);
  INSERT INTO public.kq_producer_purchase_buddie_grants(user_id, producer_id, producer_name,
    qualifying_product_ids, qualifying_order_ids, qualifying_order_item_ids, card_definition_id)
    VALUES(p_user_id, p_producer_id, producer_name, product_ids, order_ids, item_ids, card.id) RETURNING * INTO reward;
  INSERT INTO public.lottery_card_instances(user_id, card_definition_id, pack_slot, producer_purchase_buddie_grant_id)
    VALUES(p_user_id, card.id, 1, reward.id) RETURNING id INTO instance_id;
  UPDATE public.kq_producer_purchase_buddie_grants SET card_instance_id = instance_id WHERE id = reward.id;
  RETURN jsonb_build_object('producerId', p_producer_id, 'cardCode', card.code, 'cardName', card.name,
    'cardRarity', card.rarity, 'cardImageUrl', card.image_url, 'cardInstanceId', instance_id,
    'qualifyingProductIds', to_jsonb(product_ids), 'alreadyGranted', FALSE);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_claim_producer_purchase_buddie(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_claim_producer_purchase_buddie(UUID, TEXT) TO service_role;

-- Keep first-tasting Heritage attribution. Both tracks now share the producer
-- completion reward; past flower packs/entitlements are never removed or topped up.
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
    'cashCents', CASE WHEN completion_granted THEN 10000 ELSE 0 END, 'producerId', entry.producer_id);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_grant_producer_notebook_rewards(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_grant_producer_notebook_rewards(UUID, UUID) TO service_role;

COMMIT;
