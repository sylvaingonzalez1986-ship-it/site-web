BEGIN;

-- Lower the live offer for new checkouts only. Existing order snapshots and
-- receipts retain v1 (5 g); starts_at still records the original offer launch.
-- ALTER TABLE locks settings until commit, serializing the switch with snapshots.
ALTER TABLE public.kq_contest_bundle_settings
  DROP CONSTRAINT kq_contest_bundle_settings_rule_version_check;
ALTER TABLE public.kq_contest_bundle_settings
  ADD CONSTRAINT kq_contest_bundle_settings_rule_version_check
    CHECK (rule_version IN ('contest-bundle-v1', 'contest-bundle-v2')),
  ALTER COLUMN rule_version SET DEFAULT 'contest-bundle-v2';
UPDATE public.kq_contest_bundle_settings SET rule_version = 'contest-bundle-v2' WHERE singleton;

CREATE OR REPLACE FUNCTION public.kq_grant_contest_bundle_reward(p_order_id TEXT, p_expected_user_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE purchase public.orders%ROWTYPE; snapshot public.kq_contest_bundle_order_snapshots%ROWTYPE;
  owner_id UUID; proof JSONB; card public.lottery_card_definitions%ROWTYPE;
  eligible_cards UUID[]; card_id UUID; card_json JSONB; starts TIMESTAMPTZ; min_grams NUMERIC;
BEGIN
  SELECT * INTO purchase FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM public.kq_contest_bundle_reward_grants WHERE order_id = p_order_id) THEN RETURN; END IF;
  SELECT * INTO snapshot FROM public.kq_contest_bundle_order_snapshots WHERE order_id = p_order_id;
  -- Never reconstruct a missed/legacy checkout snapshot from today's catalogue.
  IF NOT FOUND OR NOT snapshot.offer_available OR jsonb_array_length(snapshot.required_flowers) = 0 THEN RETURN; END IF;
  -- The requirement belongs to the original checkout, including deleted/reimported orders.
  min_grams := CASE snapshot.rule_version
    WHEN 'contest-bundle-v1' THEN 5
    WHEN 'contest-bundle-v2' THEN 3
    ELSE NULL END;
  IF min_grams IS NULL THEN RETURN; END IF;
  SELECT starts_at INTO starts FROM public.kq_contest_bundle_settings WHERE singleton;
  IF starts IS NULL OR purchase.payment_state::TEXT IS DISTINCT FROM 'paid'
    OR purchase.status::TEXT = 'cancelled' OR purchase.archived_at IS NOT NULL
    OR purchase.payment_review_required IS DISTINCT FROM FALSE
    OR purchase.paid_at IS NULL OR purchase.paid_at < starts OR purchase.paid_at > now() THEN RETURN; END IF;

  owner_id := public.kq_contest_bundle_owner(purchase.customer_id, purchase.customer_email);
  IF owner_id IS NULL OR (p_expected_user_id IS NOT NULL AND owner_id <> p_expected_user_id) THEN RETURN; END IF;
  PERFORM 1 FROM auth.users WHERE id = owner_id FOR SHARE;
  IF NOT FOUND OR public.kq_contest_bundle_owner(purchase.customer_id, purchase.customer_email)
    IS DISTINCT FROM owner_id THEN RETURN; END IF;
  PERFORM id FROM public.order_items WHERE order_id = p_order_id ORDER BY id FOR SHARE;

  SELECT jsonb_object_agg(required->>'productId', coalesce(amount.grams, 0)) INTO proof
  FROM jsonb_array_elements(snapshot.required_flowers) required
  LEFT JOIN LATERAL (
    SELECT sum(item.quantity::NUMERIC * item.unit_weight_grams) AS grams
    FROM public.order_items item
    WHERE item.order_id = p_order_id AND item.product_id = required->>'productId'
      AND strpos(item.product_id, '::') = 0 AND item.product_category = 'fleurs'
      AND item.quantity > 0 AND item.unit_weight_grams > 0
      AND item.unit_weight_grams::TEXT NOT IN ('NaN','Infinity','-Infinity')
      AND item.unit_price > 0 AND item.line_total > 0
      AND item.unit_price::TEXT NOT IN ('NaN','Infinity','-Infinity')
      AND item.line_total::TEXT NOT IN ('NaN','Infinity','-Infinity')
  ) amount ON true;
  IF proof IS NULL OR EXISTS(SELECT 1 FROM jsonb_each_text(proof) quantity WHERE quantity.value::NUMERIC < min_grams) THEN RETURN; END IF;
  IF NOT public.kq_contest_bundle_gifts_ready() THEN RETURN; END IF;

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

  INSERT INTO public.kq_contest_bundle_reward_grants(order_id, user_id, required_flowers, purchased_grams, card_snapshot, rule_version)
    VALUES(p_order_id, owner_id, snapshot.required_flowers, proof, card_json, snapshot.rule_version);
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

CREATE OR REPLACE FUNCTION public.rpc_kq_get_contest_bundle_rewards(p_user_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('available', public.kq_contest_bundle_catalogue_ready() AND public.kq_contest_bundle_gifts_ready(),
    'startsAt', settings.starts_at, 'minGrams', CASE settings.rule_version
      WHEN 'contest-bundle-v1' THEN 5 WHEN 'contest-bundle-v2' THEN 3 END, 'buddiesPacks', 3, 'bottePacks', 5, 'flowers', flowers.value,
    'receipts', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'orderId', reward.order_id, 'grantedAt', reward.granted_at, 'card', reward.card_snapshot,
      'buddiesPacks', reward.buddies_packs, 'bottePacks', reward.botte_packs,
      'requiredProductIds', (SELECT jsonb_agg(flower->>'productId' ORDER BY flower->>'productId')
        FROM jsonb_array_elements(reward.required_flowers) flower)
    ) ORDER BY reward.granted_at DESC, reward.order_id)
      FROM public.kq_contest_bundle_reward_grants reward WHERE reward.user_id = p_user_id), '[]'::JSONB))
  FROM public.kq_contest_bundle_settings settings CROSS JOIN LATERAL (SELECT public.kq_contest_bundle_flowers() AS value) flowers
  WHERE settings.singleton;
$$;

-- CREATE OR REPLACE retains privileges; restate the intended narrow access.
REVOKE ALL ON FUNCTION public.kq_grant_contest_bundle_reward(TEXT, UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_get_contest_bundle_rewards(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_get_contest_bundle_rewards(UUID) TO service_role;

COMMIT;
