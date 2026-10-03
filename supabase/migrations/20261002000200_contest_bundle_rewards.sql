BEGIN;

-- Prospective purchase offer. Neither deleting/reimporting an order nor changing
-- the live notebook catalogue may recreate its offer or its reward receipt.
CREATE TABLE public.kq_contest_bundle_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  rule_version TEXT NOT NULL DEFAULT 'contest-bundle-v1' CHECK (rule_version = 'contest-bundle-v1')
);
ALTER TABLE public.kq_contest_bundle_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_contest_bundle_settings FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO public.kq_contest_bundle_settings(singleton) VALUES(true);

CREATE TABLE public.kq_contest_bundle_order_snapshots (
  order_id TEXT PRIMARY KEY CHECK (length(btrim(order_id)) > 0),
  offer_available BOOLEAN NOT NULL,
  required_flowers JSONB NOT NULL CHECK (jsonb_typeof(required_flowers) = 'array'),
  rule_version TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.kq_contest_bundle_order_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_contest_bundle_order_snapshots FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.kq_contest_bundle_reward_grants (
  order_id TEXT PRIMARY KEY CHECK (length(btrim(order_id)) > 0),
  user_id UUID NOT NULL,
  required_flowers JSONB NOT NULL CHECK (jsonb_typeof(required_flowers) = 'array' AND jsonb_array_length(required_flowers) > 0),
  purchased_grams JSONB NOT NULL CHECK (jsonb_typeof(purchased_grams) = 'object'),
  card_snapshot JSONB NOT NULL CHECK (card_snapshot->>'rarity' = 'epic'),
  buddies_packs INTEGER NOT NULL DEFAULT 3 CHECK (buddies_packs = 3),
  botte_packs INTEGER NOT NULL DEFAULT 5 CHECK (botte_packs = 5),
  rule_version TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kq_contest_bundle_reward_grants_user ON public.kq_contest_bundle_reward_grants(user_id, granted_at DESC, order_id);
ALTER TABLE public.kq_contest_bundle_reward_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_contest_bundle_reward_grants FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.lottery_card_instances ADD COLUMN contest_bundle_order_id TEXT
  REFERENCES public.kq_contest_bundle_reward_grants(order_id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX lottery_card_instances_contest_bundle ON public.lottery_card_instances(contest_bundle_order_id)
  WHERE contest_bundle_order_id IS NOT NULL;
ALTER TABLE public.lottery_card_instances DROP CONSTRAINT lottery_card_instances_source_required;
ALTER TABLE public.lottery_card_instances ADD CONSTRAINT lottery_card_instances_source_required CHECK (
  ticket_id IS NOT NULL OR kq_support_entitlement_id IS NOT NULL OR source_bot_battle_id IS NOT NULL
  OR pioneer_grant_id IS NOT NULL OR producer_purchase_buddie_grant_id IS NOT NULL
  OR community_mission_reward_id IS NOT NULL OR contest_bundle_order_id IS NOT NULL
);
ALTER TABLE public.kq_support_booster_entitlements DROP CONSTRAINT kq_support_booster_entitlements_source_check;
ALTER TABLE public.kq_support_booster_entitlements ADD CONSTRAINT kq_support_booster_entitlements_source_check CHECK (
  source IN ('ticket','arena_streak','notebook_badge','season_reward','points_purchase','welcome_pack',
    'pvp_win','notebook_flower','mission','achievement','pioneer_pack','contest_bundle')
);

-- Only real active seasons contribute. No fallback to an archived season and no
-- stock filter: selling out a required flower must never shrink the obligation.
CREATE FUNCTION public.kq_contest_bundle_flowers()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('productId', flower.id, 'title', flower.name,
    'unitWeightGrams', flower.weight_grams) ORDER BY flower.id), '[]'::JSONB)
  FROM (
    SELECT DISTINCT product.id, product.name, product.weight_grams
    FROM public.contest_entries entry
    JOIN public.contest_seasons season ON season.id = entry.season_id AND season.is_active AND NOT season.is_archived
    JOIN public.products product ON product.id = entry.product_id
    WHERE entry.is_published AND entry.track::TEXT = 'concours'
      AND product.category::TEXT = 'fleurs' AND product.is_pack IS FALSE
      AND (product.variant_options IS NULL OR product.variant_options = '[]'::JSONB)
      AND strpos(product.id, '::') = 0
      AND product.weight_grams > 0 AND product.weight_grams::TEXT NOT IN ('NaN','Infinity','-Infinity')
      AND product.price > 0 AND product.price::TEXT NOT IN ('NaN','Infinity','-Infinity')
  ) flower;
$$;

-- Unsupported weights/variants disable the offer instead of silently removing
-- a required flower and making an incomplete assortment eligible.
CREATE FUNCTION public.kq_contest_bundle_catalogue_ready()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_array_length(public.kq_contest_bundle_flowers()) > 0 AND NOT EXISTS (
    SELECT 1 FROM public.contest_entries entry
    JOIN public.contest_seasons season ON season.id = entry.season_id AND season.is_active AND NOT season.is_archived
    JOIN public.products product ON product.id = entry.product_id
    WHERE entry.is_published AND entry.track::TEXT = 'concours'
      AND product.category::TEXT = 'fleurs' AND product.is_pack IS FALSE
      AND (product.weight_grams IS NULL OR product.weight_grams <= 0
        OR product.weight_grams::TEXT IN ('NaN','Infinity','-Infinity')
        OR product.price IS NULL OR product.price <= 0 OR product.price::TEXT IN ('NaN','Infinity','-Infinity')
        OR (product.variant_options IS NOT NULL AND product.variant_options <> '[]'::JSONB)
        OR strpos(product.id, '::') > 0)
  );
$$;

CREATE FUNCTION public.kq_contest_bundle_gifts_ready()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.lottery_game_config WHERE id = 1 AND is_active)
    -- The existing Buddies opening RPC uses the oldest active collection.
    AND coalesce((SELECT code = 'HEMP_HEROES_2026' FROM public.lottery_card_collections
      WHERE is_active ORDER BY created_at ASC LIMIT 1), false)
    AND NOT EXISTS (
      SELECT 1 FROM unnest(ARRAY['common','silver','gold','epic','legendary']) wanted(rarity)
      WHERE NOT EXISTS(SELECT 1 FROM public.lottery_card_definitions card
        JOIN public.lottery_card_collections collection ON collection.id = card.collection_id
        WHERE collection.code = 'HEMP_HEROES_2026' AND collection.is_active AND card.is_active AND card.rarity::TEXT = wanted.rarity)
    )
    AND NOT EXISTS (
      SELECT 1 FROM unnest(ARRAY['common','silver','gold']) wanted(rarity)
      WHERE NOT EXISTS(SELECT 1 FROM public.lottery_card_definitions card
        JOIN public.lottery_card_collections collection ON collection.id = card.collection_id
        WHERE collection.code = 'BOTTE_DU_CHANVRIER_2026' AND collection.is_active AND card.is_active AND card.rarity::TEXT = wanted.rarity)
    );
$$;

CREATE FUNCTION public.kq_snapshot_contest_bundle_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE flowers JSONB; settings public.kq_contest_bundle_settings%ROWTYPE;
BEGIN
  SELECT * INTO settings FROM public.kq_contest_bundle_settings WHERE singleton;
  flowers := public.kq_contest_bundle_flowers();
  INSERT INTO public.kq_contest_bundle_order_snapshots(order_id, offer_available, required_flowers, rule_version)
    VALUES(NEW.id, coalesce(NEW.created_at >= settings.starts_at AND NEW.created_at <= now()
      AND public.kq_contest_bundle_catalogue_ready() AND public.kq_contest_bundle_gifts_ready(), false),
      flowers, settings.rule_version)
    ON CONFLICT(order_id) DO NOTHING;
  RETURN NULL;
END;
$$;
CREATE TRIGGER kq_snapshot_contest_bundle_order AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.kq_snapshot_contest_bundle_order();

CREATE FUNCTION public.kq_contest_bundle_owner(p_customer_id UUID, p_customer_email TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN count(*) = 1 THEN (array_agg(id))[1] ELSE NULL END FROM auth.users
  WHERE deleted_at IS NULL AND (
    (p_customer_id IS NOT NULL AND id = p_customer_id)
    OR (p_customer_id IS NULL AND email_confirmed_at IS NOT NULL
      AND nullif(lower(btrim(p_customer_email)), '') IS NOT NULL
      AND lower(btrim(email)) = lower(btrim(p_customer_email)))
  );
$$;

CREATE FUNCTION public.kq_grant_contest_bundle_reward(p_order_id TEXT, p_expected_user_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE purchase public.orders%ROWTYPE; snapshot public.kq_contest_bundle_order_snapshots%ROWTYPE;
  owner_id UUID; proof JSONB; card public.lottery_card_definitions%ROWTYPE;
  eligible_cards UUID[]; card_id UUID; card_json JSONB; starts TIMESTAMPTZ;
BEGIN
  SELECT * INTO purchase FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM public.kq_contest_bundle_reward_grants WHERE order_id = p_order_id) THEN RETURN; END IF;
  SELECT * INTO snapshot FROM public.kq_contest_bundle_order_snapshots WHERE order_id = p_order_id;
  -- Never reconstruct a missed/legacy checkout snapshot from today's catalogue.
  IF NOT FOUND OR NOT snapshot.offer_available OR jsonb_array_length(snapshot.required_flowers) = 0 THEN RETURN; END IF;
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
  IF proof IS NULL OR EXISTS(SELECT 1 FROM jsonb_each_text(proof) quantity WHERE quantity.value::NUMERIC < 5) THEN RETURN; END IF;
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

CREATE FUNCTION public.kq_contest_bundle_after_order_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE purchase_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN purchase_id := NEW.id::TEXT;
  ELSE purchase_id := NEW.order_id; END IF;
  BEGIN
    PERFORM public.kq_grant_contest_bundle_reward(purchase_id);
  EXCEPTION WHEN query_canceled OR assert_failure OR OTHERS THEN
    RAISE WARNING 'kq_contest_bundle_retry_needed order %, SQLSTATE %', purchase_id, SQLSTATE;
  END;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER kq_contest_bundle_after_payment AFTER INSERT OR UPDATE ON public.orders
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.kq_contest_bundle_after_order_change();
-- Also covers a paid order inserted before its line items in separate requests.
CREATE CONSTRAINT TRIGGER kq_contest_bundle_after_items AFTER INSERT OR UPDATE ON public.order_items
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.kq_contest_bundle_after_order_change();

CREATE FUNCTION public.rpc_kq_get_contest_bundle_rewards(p_user_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('available', public.kq_contest_bundle_catalogue_ready() AND public.kq_contest_bundle_gifts_ready(),
    'startsAt', settings.starts_at, 'minGrams', 5, 'buddiesPacks', 3, 'bottePacks', 5, 'flowers', flowers.value,
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

CREATE FUNCTION public.rpc_kq_sync_contest_bundle_rewards(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE purchase_ids TEXT[]; purchase_id TEXT;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'kq_contest_bundle_invalid_user';
  END IF;
  -- Lock all candidate orders before touching catalogue/counter rows. Snapshot
  -- requirements, not current publication/stock, determine old purchases.
  SELECT array_agg(candidate.id ORDER BY candidate.id) INTO purchase_ids FROM (
    SELECT purchase.id FROM public.orders purchase
    JOIN public.kq_contest_bundle_order_snapshots snapshot ON snapshot.order_id = purchase.id AND snapshot.offer_available
    WHERE purchase.payment_state::TEXT = 'paid' AND purchase.status::TEXT <> 'cancelled'
      AND purchase.archived_at IS NULL AND purchase.payment_review_required = FALSE
      AND public.kq_contest_bundle_owner(purchase.customer_id, purchase.customer_email) = p_user_id
      AND NOT EXISTS(SELECT 1 FROM public.kq_contest_bundle_reward_grants WHERE order_id = purchase.id)
    ORDER BY purchase.id FOR UPDATE OF purchase
  ) candidate;
  FOREACH purchase_id IN ARRAY coalesce(purchase_ids, ARRAY[]::TEXT[]) LOOP
    BEGIN
      PERFORM public.kq_grant_contest_bundle_reward(purchase_id, p_user_id);
    EXCEPTION WHEN query_canceled OR assert_failure OR OTHERS THEN
      RAISE WARNING 'kq_contest_bundle_retry_needed order %, SQLSTATE %', purchase_id, SQLSTATE;
    END;
  END LOOP;
  RETURN public.rpc_kq_get_contest_bundle_rewards(p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.kq_contest_bundle_flowers() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.kq_contest_bundle_catalogue_ready() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.kq_contest_bundle_gifts_ready() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.kq_snapshot_contest_bundle_order() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.kq_contest_bundle_owner(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.kq_grant_contest_bundle_reward(TEXT, UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.kq_contest_bundle_after_order_change() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_get_contest_bundle_rewards(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_sync_contest_bundle_rewards(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_get_contest_bundle_rewards(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_sync_contest_bundle_rewards(UUID) TO service_role;

COMMIT;
