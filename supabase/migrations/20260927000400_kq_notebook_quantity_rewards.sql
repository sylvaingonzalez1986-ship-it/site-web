BEGIN;

-- A lifetime maximum per flower: later grouped purchases only earn the delta.
-- Product/producer identifiers are receipt snapshots, not cascading catalogue FKs.
CREATE TABLE public.kq_producer_quantity_bonus_grants (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL CHECK (length(btrim(product_id)) > 0),
  producer_id TEXT NOT NULL CHECK (length(btrim(producer_id)) > 0),
  best_order_grams NUMERIC NOT NULL CHECK (best_order_grams > 0),
  cash_cents INTEGER NOT NULL CHECK (cash_cents BETWEEN 1 AND 120000),
  rule_version TEXT NOT NULL DEFAULT 'notebook-quantity-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
ALTER TABLE public.kq_producer_quantity_bonus_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_producer_quantity_bonus_grants FROM PUBLIC, anon, authenticated, service_role;

-- NULL means the old uniform silver/gold draw. Never invent historic odds.
ALTER TABLE public.kq_producer_purchase_buddie_grants
  ADD COLUMN odds_snapshot JSONB,
  ADD COLUMN rule_version TEXT;

CREATE FUNCTION public.kq_producer_quantity_rewards(p_user_id UUID, p_producer_id TEXT)
RETURNS TABLE(product_id TEXT, best_order_grams NUMERIC, track TEXT, total_cash_cents INTEGER,
  bonus_cash_cents INTEGER, granted_cash_cents INTEGER, available_cash_cents INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH required AS (
    SELECT entry.product_id,
      CASE WHEN bool_or(entry.track::TEXT = 'concours') THEN 'concours' ELSE 'regular' END AS track
    FROM public.kq_producer_notebook_products(p_producer_id) required
    JOIN public.contest_entries entry ON entry.product_id = required.product_id
      AND entry.producer_id = p_producer_id AND entry.is_published
    JOIN public.kq_current_notebook_season() season ON season.id = entry.season_id
    GROUP BY entry.product_id
  ), grouped_orders AS (
    SELECT eligible.product_id, eligible.order_id,
      sum(item.quantity::NUMERIC * item.unit_weight_grams) AS grams
    FROM public.kq_producer_paid_flower_items(p_user_id, p_producer_id) eligible
    JOIN public.order_items item ON item.id = eligible.order_item_id
    -- Weight is an immutable checkout snapshot; never parse a variant suffix or
    -- substitute today's catalogue weight for a missing historical snapshot.
    -- Existing variant snapshots may contain the base product's weight. Keep
    -- them eligible for discovery, but do not invent grouped-volume rewards.
    WHERE item.product_category = 'fleurs' AND item.unit_weight_grams > 0
      AND strpos(item.product_id, '::') = 0
    GROUP BY eligible.product_id, eligible.order_id
  ), best_orders AS (
    SELECT product_id, max(grams) AS grams FROM grouped_orders GROUP BY product_id
  ), reviewed AS (
    SELECT DISTINCT entry.product_id
    FROM public.contest_entries entry
    JOIN public.kq_current_notebook_season() season ON season.id = entry.season_id
    JOIN public.contest_reviews review ON review.entry_id = entry.id
      AND review.customer_id = p_user_id AND review.status = 'approved'
    WHERE entry.producer_id = p_producer_id
  ), amounts AS (
    SELECT required.product_id, required.track, COALESCE(best.grams, 0) AS grams,
      round(10000 * least(COALESCE(best.grams, 0), 10) *
        CASE WHEN best.grams >= 10 THEN 1.3 WHEN best.grams >= 5 THEN 1.2
          WHEN best.grams >= 3 THEN 1.1 ELSE 1 END)::INTEGER AS total,
      COALESCE(receipt.cash_cents, 0) AS granted, reviewed.product_id IS NOT NULL AS approved
    FROM required LEFT JOIN best_orders best ON best.product_id = required.product_id
    LEFT JOIN public.kq_producer_quantity_bonus_grants receipt
      ON receipt.user_id = p_user_id AND receipt.product_id = required.product_id
    LEFT JOIN reviewed ON reviewed.product_id = required.product_id
  )
  SELECT product_id, grams, track, total, greatest(0, total - 10000), granted,
    CASE WHEN approved THEN greatest(0, total - 10000 - granted) ELSE 0 END
  FROM amounts;
$$;
REVOKE ALL ON FUNCTION public.kq_producer_quantity_rewards(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.kq_producer_purchase_odds(p_user_id UUID, p_producer_id TEXT)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH odds AS (
    SELECT avg(CASE WHEN track = 'concours' THEN 3 ELSE 1 END *
      CASE WHEN best_order_grams >= 10 THEN 2 WHEN best_order_grams >= 5 THEN 1.5
        WHEN best_order_grams >= 3 THEN 1.25 ELSE 1 END) AS gold,
      avg(CASE WHEN track = 'concours' THEN 18 ELSE 10 END) AS silver
    FROM public.kq_producer_quantity_rewards(p_user_id, p_producer_id)
  ) SELECT CASE WHEN gold IS NULL THEN NULL ELSE
    jsonb_build_object('common', 100 - silver - gold, 'silver', silver, 'gold', gold) END FROM odds;
$$;
REVOKE ALL ON FUNCTION public.kq_producer_purchase_odds(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;

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
  ), purchase AS (
    SELECT * FROM public.kq_producer_purchase_buddie_grants WHERE user_id = p_user_id AND producer_id = p_producer_id
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
    'purchaseGranted', EXISTS(SELECT 1 FROM purchase),
    'purchaseCard', (SELECT jsonb_build_object('code', card.code, 'name', card.name, 'rarity', card.rarity, 'imageUrl', card.image_url)
      FROM purchase reward JOIN public.lottery_card_definitions card ON card.id = reward.card_definition_id),
    'purchaseOdds', CASE WHEN EXISTS(SELECT 1 FROM purchase) THEN (SELECT odds_snapshot FROM purchase)
      ELSE public.kq_producer_purchase_odds(p_user_id, p_producer_id) END,
    'quantityRewardsAvailable', TRUE,
    'quantityRewards', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'productId', product_id, 'bestOrderGrams', best_order_grams, 'totalCashCents', total_cash_cents,
      'bonusCashCents', bonus_cash_cents, 'grantedCashCents', granted_cash_cents,
      'availableCashCents', available_cash_cents) ORDER BY product_id)
      FROM public.kq_producer_quantity_rewards(p_user_id, p_producer_id)), '[]'::JSONB)
  );
$$;
REVOKE ALL ON FUNCTION public.kq_producer_notebook_progress(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.rpc_kq_claim_producer_quantity_bonus(p_user_id UUID, p_producer_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE flower RECORD; producer_name TEXT; wallet INTEGER; total_credit BIGINT := 0;
BEGIN
  IF p_user_id IS NULL OR COALESCE(btrim(p_producer_id), '') = ''
    OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'kq_producer_quantity_invalid';
  END IF;
  -- Global per-user quantity lock also protects a product moved to a producer.
  PERFORM pg_advisory_xact_lock(hashtextextended('producer-quantity:' || p_user_id::TEXT, 0));
  PERFORM 1 FROM auth.users WHERE id = p_user_id FOR SHARE;
  SELECT name INTO producer_name FROM public.producers WHERE id = p_producer_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_producer_quantity_invalid'; END IF;
  PERFORM entry.id FROM public.contest_entries entry
    JOIN public.products product ON product.id = entry.product_id
    WHERE entry.producer_id = p_producer_id ORDER BY entry.id FOR SHARE OF entry, product;
  PERFORM review.id FROM public.contest_reviews review
    JOIN public.contest_entries entry ON entry.id = review.entry_id
    WHERE review.customer_id = p_user_id AND entry.producer_id = p_producer_id
    ORDER BY review.id FOR SHARE OF review;
  PERFORM orders.id FROM public.orders orders
    JOIN public.order_items item ON item.order_id = orders.id
    JOIN public.kq_producer_paid_flower_items(p_user_id, p_producer_id) eligible ON eligible.order_item_id = item.id
    ORDER BY orders.id, item.id FOR SHARE OF orders, item;
  FOR flower IN SELECT * FROM public.kq_producer_quantity_rewards(p_user_id, p_producer_id)
    WHERE available_cash_cents > 0 ORDER BY product_id
  LOOP
    IF total_credit = 0 THEN
      INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
      SELECT cash_cents INTO wallet FROM public.kq_equipment_wallets WHERE user_id = p_user_id FOR UPDATE;
      PERFORM public.kq_treasury_initialize(p_user_id);
    END IF;
    total_credit := total_credit + flower.available_cash_cents;
    IF total_credit > 2147483647 OR wallet::BIGINT + total_credit > 2147483647 THEN
      RAISE EXCEPTION 'kq_producer_quantity_wallet_limit';
    END IF;
    INSERT INTO public.kq_producer_quantity_bonus_grants(user_id, product_id, producer_id, best_order_grams, cash_cents)
      VALUES(p_user_id, flower.product_id, p_producer_id, flower.best_order_grams, flower.bonus_cash_cents)
      ON CONFLICT(user_id, product_id) DO UPDATE SET producer_id = EXCLUDED.producer_id,
        best_order_grams = EXCLUDED.best_order_grams, cash_cents = EXCLUDED.cash_cents,
        rule_version = EXCLUDED.rule_version, updated_at = now();
    UPDATE public.kq_equipment_wallets SET cash_cents = cash_cents + flower.available_cash_cents,
      updated_at = now() WHERE user_id = p_user_id;
    -- Unique per attained amount, matching the wallet observer's cash/suspense.
    PERFORM public.kq_treasury_pair(p_user_id, 'reward',
      'producer-quantity:' || flower.product_id || ':' || flower.bonus_cash_cents::TEXT,
      now(), 'suspense', 'revenue_rewards', flower.available_cash_cents,
      'Bonus quantite : ' || producer_name || ' / ' || flower.product_id);
  END LOOP;
  RETURN jsonb_build_object('producerId', p_producer_id, 'cashCents', total_credit, 'alreadyGranted', total_credit = 0);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_claim_producer_quantity_bonus(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_claim_producer_quantity_bonus(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_claim_producer_purchase_buddie(p_user_id UUID, p_producer_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reward public.kq_producer_purchase_buddie_grants%ROWTYPE;
  card public.lottery_card_definitions%ROWTYPE; progress JSONB; producer_name TEXT; odds JSONB;
  product_ids TEXT[]; order_ids TEXT[]; item_ids BIGINT[]; pool UUID[]; instance_id UUID;
  ticket INTEGER; ticket_count INTEGER; gold_tickets INTEGER; silver_tickets INTEGER; selected_rarity TEXT;
BEGIN
  IF p_user_id IS NULL OR COALESCE(btrim(p_producer_id), '') = ''
    OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'kq_producer_purchase_invalid';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('producer-buddie:' || p_user_id::TEXT || ':' || p_producer_id, 0));
  PERFORM 1 FROM auth.users WHERE id = p_user_id FOR SHARE;
  SELECT * INTO reward FROM public.kq_producer_purchase_buddie_grants WHERE user_id = p_user_id AND producer_id = p_producer_id;
  IF FOUND THEN
    SELECT * INTO card FROM public.lottery_card_definitions WHERE id = reward.card_definition_id;
    RETURN jsonb_build_object('producerId', p_producer_id, 'cardCode', card.code, 'cardName', card.name,
      'cardRarity', card.rarity, 'cardImageUrl', card.image_url, 'cardInstanceId', reward.card_instance_id,
      'qualifyingProductIds', to_jsonb(reward.qualifying_product_ids), 'alreadyGranted', TRUE,
      'purchaseOdds', reward.odds_snapshot, 'ruleVersion', reward.rule_version);
  END IF;
  SELECT name INTO producer_name FROM public.producers WHERE id = p_producer_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_producer_purchase_invalid'; END IF;
  PERFORM entry.id FROM public.contest_entries entry
    JOIN public.products product ON product.id = entry.product_id
    WHERE entry.producer_id = p_producer_id ORDER BY entry.id FOR SHARE OF entry, product;
  PERFORM orders.id FROM public.orders orders
    JOIN public.order_items item ON item.order_id = orders.id
    JOIN public.kq_producer_paid_flower_items(p_user_id, p_producer_id) eligible ON eligible.order_item_id = item.id
    ORDER BY orders.id, item.id FOR SHARE OF orders, item;
  progress := public.kq_producer_notebook_progress(p_user_id, p_producer_id);
  IF jsonb_array_length(progress->'qualifyingProductIds') = 0
    OR progress->'qualifyingProductIds' <> progress->'purchasedProductIds' THEN
    RAISE EXCEPTION 'kq_producer_purchase_incomplete';
  END IF;
  -- Validate every positive-probability bucket before RNG. Otherwise a client
  -- could retry failures until an available (rarer) bucket won the draw.
  PERFORM definition.id FROM public.lottery_card_definitions definition
    JOIN public.lottery_card_collections collection ON collection.id = definition.collection_id
    WHERE collection.code = 'HEMP_HEROES_2026' AND collection.is_active AND definition.is_active
      AND definition.rarity IN ('common', 'silver', 'gold')
    ORDER BY definition.id FOR SHARE OF definition, collection;
  IF (SELECT count(DISTINCT definition.rarity) FROM public.lottery_card_definitions definition
    JOIN public.lottery_card_collections collection ON collection.id = definition.collection_id
    WHERE collection.code = 'HEMP_HEROES_2026' AND collection.is_active AND definition.is_active
      AND definition.rarity IN ('common', 'silver', 'gold')) <> 3 THEN
    RAISE EXCEPTION 'kq_producer_buddie_unavailable';
  END IF;
  odds := progress->'purchaseOdds';
  ticket_count := jsonb_array_length(progress->'qualifyingProductIds') * 10000;
  gold_tickets := round((odds->>'gold')::NUMERIC * ticket_count / 100)::INTEGER;
  silver_tickets := round((odds->>'silver')::NUMERIC * ticket_count / 100)::INTEGER;
  ticket := public.lottery_secure_random_int(1, ticket_count);
  selected_rarity := CASE WHEN ticket <= gold_tickets THEN 'gold'
    WHEN ticket <= gold_tickets + silver_tickets THEN 'silver' ELSE 'common' END;
  SELECT array_agg(definition.id ORDER BY definition.card_number, definition.id) INTO pool
    FROM public.lottery_card_definitions definition
    JOIN public.lottery_card_collections collection ON collection.id = definition.collection_id
    WHERE collection.code = 'HEMP_HEROES_2026' AND collection.is_active AND definition.is_active
      AND definition.rarity::TEXT = selected_rarity;
  IF COALESCE(cardinality(pool), 0) = 0 THEN RAISE EXCEPTION 'kq_producer_buddie_unavailable'; END IF;
  SELECT * INTO card FROM public.lottery_card_definitions
    WHERE id = pool[public.lottery_secure_random_int(1, cardinality(pool))];
  SELECT array_agg(DISTINCT product_id ORDER BY product_id), array_agg(DISTINCT order_id ORDER BY order_id),
    array_agg(DISTINCT order_item_id ORDER BY order_item_id) INTO product_ids, order_ids, item_ids
    FROM public.kq_producer_paid_flower_items(p_user_id, p_producer_id);
  INSERT INTO public.kq_producer_purchase_buddie_grants(user_id, producer_id, producer_name,
    qualifying_product_ids, qualifying_order_ids, qualifying_order_item_ids, card_definition_id, odds_snapshot, rule_version)
    VALUES(p_user_id, p_producer_id, producer_name, product_ids, order_ids, item_ids, card.id, odds, 'notebook-quantity-v1') RETURNING * INTO reward;
  INSERT INTO public.lottery_card_instances(user_id, card_definition_id, pack_slot, producer_purchase_buddie_grant_id)
    VALUES(p_user_id, card.id, 1, reward.id) RETURNING id INTO instance_id;
  UPDATE public.kq_producer_purchase_buddie_grants SET card_instance_id = instance_id WHERE id = reward.id;
  RETURN jsonb_build_object('producerId', p_producer_id, 'cardCode', card.code, 'cardName', card.name,
    'cardRarity', card.rarity, 'cardImageUrl', card.image_url, 'cardInstanceId', instance_id,
    'qualifyingProductIds', to_jsonb(product_ids), 'alreadyGranted', FALSE,
    'purchaseOdds', odds, 'ruleVersion', 'notebook-quantity-v1');
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_claim_producer_purchase_buddie(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_claim_producer_purchase_buddie(UUID, TEXT) TO service_role;

-- Keep the historical Heritage and completion behavior, plus grouped volume.
CREATE OR REPLACE FUNCTION public.rpc_kq_grant_producer_notebook_rewards(p_user_id UUID, p_review_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE review public.contest_reviews%ROWTYPE; entry public.contest_entries%ROWTYPE;
  campaign RECORD; draw public.kq_heritage_draws%ROWTYPE; progress JSONB; completion JSONB; quantity_bonus JSONB;
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
    -- Match the standalone completion claim's lock order before quantity can
    -- lock the wallet. Otherwise completion->wallet and wallet->completion
    -- could deadlock when a manual claim races this approval callback.
    PERFORM pg_advisory_xact_lock(hashtextextended('producer-completion:' || p_user_id::TEXT || ':' || entry.producer_id, 0));
    quantity_bonus := public.rpc_kq_claim_producer_quantity_bonus(p_user_id, entry.producer_id);
    progress := public.kq_producer_notebook_progress(p_user_id, entry.producer_id);
    IF jsonb_array_length(progress->'qualifyingProductIds') > 0
      AND progress->'qualifyingProductIds' = progress->'reviewedProductIds' THEN
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
    'cashCents', COALESCE((quantity_bonus->>'cashCents')::BIGINT, 0)
      + CASE WHEN completion_granted THEN (completion->>'cashCents')::BIGINT ELSE 0 END,
    'producerId', entry.producer_id);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_grant_producer_notebook_rewards(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_grant_producer_notebook_rewards(UUID, UUID) TO service_role;

COMMIT;
