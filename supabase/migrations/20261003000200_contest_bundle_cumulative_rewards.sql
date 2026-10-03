BEGIN;

-- A single programme for each customer. Historical paid purchases count, but
-- installing this migration never grants a gift or scans/mutates customer orders.
-- Freeze the whole programme catalogue before replacing its former live helpers.
DO $$ BEGIN
  IF NOT public.kq_contest_bundle_catalogue_ready() THEN
    RAISE EXCEPTION 'kq_contest_bundle_cannot_freeze_incomplete_catalogue';
  END IF;
END; $$;
ALTER TABLE public.kq_contest_bundle_settings
  DROP CONSTRAINT kq_contest_bundle_settings_rule_version_check;
ALTER TABLE public.kq_contest_bundle_settings
  ADD CONSTRAINT kq_contest_bundle_settings_rule_version_check
    CHECK (rule_version IN ('contest-bundle-v1', 'contest-bundle-v2', 'contest-bundle-v3')),
  ALTER COLUMN rule_version SET DEFAULT 'contest-bundle-v3',
  ADD COLUMN required_flowers JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (jsonb_typeof(required_flowers) = 'array'),
  ADD COLUMN catalogue_captured_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp();
UPDATE public.kq_contest_bundle_settings SET rule_version = 'contest-bundle-v3',
  required_flowers = public.kq_contest_bundle_flowers() WHERE singleton;

ALTER TABLE public.kq_contest_bundle_reward_grants
  ADD COLUMN contributing_orders JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (jsonb_typeof(contributing_orders) = 'array');
CREATE UNIQUE INDEX kq_contest_bundle_reward_grants_once_per_customer
  ON public.kq_contest_bundle_reward_grants(user_id) WHERE rule_version = 'contest-bundle-v3';
CREATE INDEX kq_contest_bundle_reward_grants_contributing_orders
  ON public.kq_contest_bundle_reward_grants USING gin(contributing_orders jsonb_path_ops);
REVOKE ALL ON TABLE public.kq_contest_bundle_settings FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.kq_contest_bundle_reward_grants FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.kq_contest_bundle_flowers()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT required_flowers FROM public.kq_contest_bundle_settings WHERE singleton), '[]'::JSONB);
$$;
CREATE OR REPLACE FUNCTION public.kq_contest_bundle_catalogue_ready()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_array_length(public.kq_contest_bundle_flowers()) > 0;
$$;

-- Pure calculation from immutable order-line weight/price snapshots, including
-- purchases before programme launch. No current product weight or stock is used.
-- An order already credited to a different customer cannot be reassigned/reused.
CREATE FUNCTION public.kq_contest_bundle_purchase_progress(p_user_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH customer AS (
    SELECT id, email, email_confirmed_at FROM auth.users WHERE id = p_user_id AND deleted_at IS NULL
  ), required AS (
    SELECT flower->>'productId' AS product_id FROM jsonb_array_elements(public.kq_contest_bundle_flowers()) flower
  ), candidate_orders AS MATERIALIZED (
    -- Narrow by indexed customer/email before checking ambiguous guest ownership.
    SELECT purchase.id, purchase.created_at, purchase.paid_at, purchase.customer_id, purchase.customer_email
    FROM customer JOIN public.orders purchase ON purchase.customer_id = customer.id
      OR (purchase.customer_id IS NULL AND customer.email_confirmed_at IS NOT NULL
        AND nullif(lower(btrim(customer.email)), '') IS NOT NULL
        AND lower(btrim(purchase.customer_email)) = lower(btrim(customer.email)))
    WHERE purchase.payment_state::TEXT = 'paid'
      AND purchase.status::TEXT IS DISTINCT FROM 'cancelled' AND purchase.archived_at IS NULL
      AND purchase.payment_review_required IS FALSE
      AND purchase.created_at <= now() AND purchase.paid_at <= now()
  ), quantities AS (
    SELECT purchase.id AS order_id, purchase.created_at, purchase.paid_at, item.product_id,
      sum(item.quantity::NUMERIC * item.unit_weight_grams) AS grams
    FROM candidate_orders purchase
    JOIN public.order_items item ON item.order_id = purchase.id
    JOIN required ON required.product_id = item.product_id
    WHERE (purchase.customer_id IS NOT NULL
      OR public.kq_contest_bundle_owner(NULL, purchase.customer_email) = p_user_id)
      AND NOT EXISTS(SELECT 1 FROM public.kq_contest_bundle_reward_grants prior
        WHERE prior.user_id <> p_user_id AND (prior.order_id = purchase.id
          OR prior.contributing_orders @> jsonb_build_array(jsonb_build_object('orderId', purchase.id))))
      AND strpos(item.product_id, '::') = 0 AND item.product_category = 'fleurs'
      AND item.quantity > 0 AND item.unit_weight_grams > 0
      AND item.unit_weight_grams::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')
      AND item.unit_price > 0 AND item.line_total > 0
      AND item.unit_price::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')
      AND item.line_total::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')
    GROUP BY purchase.id, purchase.created_at, purchase.paid_at, item.product_id
  ), orders AS (
    SELECT order_id, created_at, paid_at, jsonb_object_agg(product_id, grams ORDER BY product_id) AS grams
    FROM quantities GROUP BY order_id, created_at, paid_at
  ), totals AS (
    SELECT product_id, sum(grams) AS grams FROM quantities GROUP BY product_id
  ), progress AS (
    SELECT required.product_id, coalesce(totals.grams, 0) AS grams
    FROM required LEFT JOIN totals USING(product_id)
  )
  SELECT jsonb_build_object(
    'flowers', coalesce((SELECT jsonb_agg(jsonb_build_object('productId', product_id,
      'purchasedGrams', grams, 'complete', grams >= 3) ORDER BY product_id) FROM progress), '[]'::JSONB),
    'completedCount', (SELECT count(*) FROM progress WHERE grams >= 3),
    'requiredCount', (SELECT count(*) FROM progress),
    'eligible', EXISTS(SELECT 1 FROM progress) AND NOT EXISTS(SELECT 1 FROM progress WHERE grams < 3),
    'purchasedGrams', coalesce((SELECT jsonb_object_agg(product_id, grams ORDER BY product_id) FROM progress), '{}'::JSONB),
    'contributingOrders', coalesce((SELECT jsonb_agg(jsonb_build_object('orderId', order_id,
      'paidAt', paid_at, 'purchasedGrams', grams) ORDER BY paid_at, created_at, order_id) FROM orders), '[]'::JSONB),
    'anchorOrderId', (SELECT order_id FROM orders ORDER BY paid_at DESC, created_at DESC, order_id DESC LIMIT 1)
  );
$$;

CREATE FUNCTION public.kq_grant_contest_bundle_customer_reward(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id UUID := p_user_id; proof JSONB; p_order_id TEXT;
  card public.lottery_card_definitions%ROWTYPE; eligible_cards UUID[]; card_id UUID; card_json JSONB;
BEGIN
  IF owner_id IS NULL THEN RETURN; END IF;
  -- Payment transactions already own their changed order. Never lock other
  -- orders after this customer lock: two concurrent payments would deadlock.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('contest-bundle-customer:' || owner_id::TEXT, 0));
  -- This separate statement sees payments committed while waiting for the lock.
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id = owner_id AND deleted_at IS NULL)
    OR EXISTS(SELECT 1 FROM public.kq_contest_bundle_reward_grants WHERE user_id = owner_id) THEN RETURN; END IF;
  proof := public.kq_contest_bundle_purchase_progress(owner_id);
  p_order_id := proof->>'anchorOrderId';
  IF p_order_id IS NULL OR (proof->>'eligible')::BOOLEAN IS DISTINCT FROM true
    OR NOT public.kq_contest_bundle_catalogue_ready() OR NOT public.kq_contest_bundle_gifts_ready() THEN RETURN; END IF;

  -- Freeze the eligible epic pool before selecting the reward. All three gifts
  -- and the receipt belong to the same transaction and roll back together.
  SELECT array_agg(locked.id ORDER BY locked.id) INTO eligible_cards FROM (
    SELECT definition.id FROM public.lottery_card_definitions definition
    JOIN public.lottery_card_collections collection ON collection.id = definition.collection_id
    WHERE collection.code = 'HEMP_HEROES_2026' AND collection.is_active
      AND definition.is_active AND definition.rarity::TEXT = 'epic'
    ORDER BY definition.id FOR SHARE OF definition, collection
  ) locked;
  IF coalesce(cardinality(eligible_cards), 0) = 0 THEN RETURN; END IF;
  card_id := eligible_cards[public.lottery_secure_random_int(1, cardinality(eligible_cards))];
  SELECT * INTO card FROM public.lottery_card_definitions WHERE id = card_id;
  card_json := jsonb_build_object('id', card.id, 'code', card.code, 'name', card.name,
    'imageUrl', card.image_url, 'rarity', 'epic');

  INSERT INTO public.kq_contest_bundle_reward_grants(order_id, user_id, required_flowers, purchased_grams,
      card_snapshot, rule_version, contributing_orders)
    VALUES(p_order_id, owner_id, public.kq_contest_bundle_flowers(), proof->'purchasedGrams',
      card_json, 'contest-bundle-v3', proof->'contributingOrders');
  INSERT INTO public.lottery_card_instances(user_id, card_definition_id, pack_slot, contest_bundle_order_id)
    VALUES(owner_id, card.id, 1, p_order_id);
  -- NULL order_id is intentional: the standard loyalty mint considers ANY
  -- ticket linked to an order proof that its own packs have already been minted.
  PERFORM public.rpc_admin_grant_lottery_tickets(owner_id, 3,
    'Bonus assortiment concours - ' || p_order_id, 'contest-bundle@system.local');
  INSERT INTO public.kq_support_booster_entitlements(user_id, source, reward_key, card_count)
    SELECT owner_id, 'contest_bundle', 'contest-bundle:' || p_order_id || ':pack:' || index, 10
    FROM generate_series(1, 5) index;
END;
$$;

-- Replace the old per-order award path entirely, including v1/v2 order snapshots.
-- Pending/failed orders do not trigger historical catch-up; a paid event or SYNC does.
CREATE OR REPLACE FUNCTION public.kq_grant_contest_bundle_reward(p_order_id TEXT, p_expected_user_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id UUID;
BEGIN
  SELECT public.kq_contest_bundle_owner(purchase.customer_id, purchase.customer_email) INTO owner_id
    FROM public.orders purchase WHERE purchase.id = p_order_id AND purchase.payment_state::TEXT = 'paid'
      AND purchase.status::TEXT IS DISTINCT FROM 'cancelled' AND purchase.archived_at IS NULL
      AND purchase.payment_review_required IS FALSE AND purchase.created_at <= now() AND purchase.paid_at <= now();
  IF owner_id IS NULL OR (p_expected_user_id IS NOT NULL AND owner_id <> p_expected_user_id) THEN RETURN; END IF;
  PERFORM public.kq_grant_contest_bundle_customer_reward(owner_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_get_contest_bundle_rewards(p_user_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH progress AS MATERIALIZED (
    SELECT CASE WHEN p_user_id IS NULL THEN NULL
      ELSE public.kq_contest_bundle_purchase_progress(p_user_id) END AS value
  )
  SELECT jsonb_build_object('available', public.kq_contest_bundle_catalogue_ready() AND public.kq_contest_bundle_gifts_ready(),
    'startsAt', settings.starts_at, 'minGrams', 3, 'buddiesPacks', 3, 'bottePacks', 5,
    'flowers', public.kq_contest_bundle_flowers(),
    'receipts', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'orderId', reward.order_id, 'grantedAt', reward.granted_at, 'card', reward.card_snapshot,
      'buddiesPacks', reward.buddies_packs, 'bottePacks', reward.botte_packs,
      'requiredProductIds', (SELECT jsonb_agg(flower->>'productId' ORDER BY flower->>'productId')
        FROM jsonb_array_elements(reward.required_flowers) flower)
    ) ORDER BY reward.granted_at DESC, reward.order_id)
      FROM public.kq_contest_bundle_reward_grants reward WHERE reward.user_id = p_user_id), '[]'::JSONB),
    'progress', CASE WHEN p_user_id IS NULL THEN NULL ELSE jsonb_build_object(
      'flowers', progress.value->'flowers', 'completedCount', progress.value->'completedCount',
      'requiredCount', progress.value->'requiredCount', 'eligible', progress.value->'eligible',
      'rewarded', EXISTS(SELECT 1 FROM public.kq_contest_bundle_reward_grants WHERE user_id = p_user_id),
      'grantedAt', (SELECT min(granted_at) FROM public.kq_contest_bundle_reward_grants WHERE user_id = p_user_id)
    ) END)
  FROM public.kq_contest_bundle_settings settings CROSS JOIN progress
  WHERE settings.singleton;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_sync_contest_bundle_rewards(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'kq_contest_bundle_invalid_user';
  END IF;
  BEGIN
    PERFORM public.kq_grant_contest_bundle_customer_reward(p_user_id);
  EXCEPTION WHEN query_canceled OR assert_failure OR OTHERS THEN
    RAISE WARNING 'kq_contest_bundle_retry_needed customer %, SQLSTATE %', p_user_id, SQLSTATE;
  END;
  RETURN public.rpc_kq_get_contest_bundle_rewards(p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.kq_contest_bundle_flowers() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.kq_contest_bundle_catalogue_ready() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.kq_contest_bundle_purchase_progress(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.kq_grant_contest_bundle_customer_reward(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.kq_grant_contest_bundle_reward(TEXT, UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_get_contest_bundle_rewards(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_sync_contest_bundle_rewards(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_get_contest_bundle_rewards(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_sync_contest_bundle_rewards(UUID) TO service_role;

COMMIT;
