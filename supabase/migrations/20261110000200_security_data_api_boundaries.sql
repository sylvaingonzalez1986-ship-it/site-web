BEGIN;

-- S01: every historical overload is named deliberately. Only the current
-- server paths remain executable; no blanket/default-privilege grants.
REVOKE ALL ON FUNCTION public.rpc_burn_duplicate_cards(UUID, public.lottery_card_rarity, UUID[], INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_burn_duplicate_cards(UUID, public.lottery_card_rarity, UUID[], public.lottery_reward_kind, INTEGER, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_claim_collection_page_reward(UUID, public.lottery_card_rarity, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

-- S04: profiles are updated by the server. Preserve existing scoped reads.
-- Table revocation does not remove old per-column grants, so clear both.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.profiles
  FROM PUBLIC, anon, authenticated;
DO $profile_columns$
DECLARE columns_sql TEXT;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO columns_sql
  FROM pg_attribute
  WHERE attrelid = 'public.profiles'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format(
    'REVOKE INSERT (%1$s), UPDATE (%1$s), REFERENCES (%1$s) ON TABLE public.profiles FROM PUBLIC, anon, authenticated',
    columns_sql
  );
END
$profile_columns$;
DROP POLICY IF EXISTS profiles_user_update_own ON public.profiles;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO service_role;

-- S03: SQL equality keeps _, %, * and backslashes literal. The server supplies
-- the authenticated customer's email; no role can bypass its authorization.
CREATE OR REPLACE FUNCTION public.rpc_get_customer_guest_orders(p_email TEXT)
RETURNS SETOF public.orders
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT orders.*
  FROM public.orders AS orders
  WHERE orders.customer_id IS NULL
    AND NULLIF(trim(p_email), '') IS NOT NULL
    AND lower(orders.customer_email) = lower(trim(p_email))
  ORDER BY orders.created_at DESC, orders.id;
$$;
REVOKE ALL ON FUNCTION public.rpc_get_customer_guest_orders(TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_customer_guest_orders(TEXT) TO service_role;

-- One UPDATE makes direct ownership + exact legacy ownership atomic and avoids
-- re-matching rows after their customer_id has been anonymized.
CREATE OR REPLACE FUNCTION public.rpc_anonymize_customer_orders(p_customer_id UUID, p_email TEXT)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE changed INTEGER;
BEGIN
  IF p_customer_id IS NULL OR NULLIF(trim(p_email), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_account_deletion';
  END IF;
  UPDATE public.orders
  SET customer_id = NULL,
      legacy_customer_id = NULL,
      customer_email = 'deleted+' || left(p_customer_id::TEXT, 8) || '@privacy.invalid',
      customer_name = 'Compte supprime',
      shipping_address = NULL, shipping_city = NULL, shipping_postal_code = NULL,
      shipping_country = NULL, shipping_phone = NULL,
      relay_id = NULL, relay_name = NULL, relay_address = NULL,
      relay_postal_code = NULL, relay_city = NULL, relay_country = NULL
  WHERE customer_id = p_customer_id
     OR (customer_id IS NULL AND lower(customer_email) = lower(trim(p_email)));
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_anonymize_customer_orders(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_anonymize_customer_orders(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_burn_duplicate_cards(
  p_user_id UUID,
  p_rarity public.lottery_card_rarity,
  p_instance_ids UUID[],
  p_reward_kind public.lottery_reward_kind,
  p_discount_percent INTEGER DEFAULT NULL,
  p_gift_weight_grams INTEGER DEFAULT NULL,
  p_gift_label TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_valid_count INTEGER;
  v_claim_id UUID;
  v_generated_code TEXT;
  v_snapshot JSONB;
  v_claim_row RECORD;
  v_instance UUID;
  v_title TEXT;
  v_description TEXT;
  v_required_count INTEGER;
BEGIN
  IF p_rarity = 'legendary' THEN
    RAISE EXCEPTION 'burn_legendary_not_allowed';
  END IF;

  IF p_reward_kind NOT IN ('discount_percent', 'gift_weight_grams') THEN
    RAISE EXCEPTION 'burn_reward_kind_invalid';
  END IF;

  -- Keep the commercial schedule authoritative at the database boundary too.
  -- These values match LOTTERY_DUPLICATE_BURN_RULES in lottery-collection.ts.
  IF p_reward_kind = 'discount_percent' AND p_discount_percent IS DISTINCT FROM
    (CASE p_rarity WHEN 'common' THEN 10 WHEN 'silver' THEN 20 WHEN 'gold' THEN 30 WHEN 'epic' THEN 50 END)
  THEN
    RAISE EXCEPTION 'burn_discount_invalid';
  END IF;
  IF p_reward_kind = 'gift_weight_grams' AND p_gift_weight_grams IS DISTINCT FROM
    (CASE p_rarity WHEN 'common' THEN 3 WHEN 'silver' THEN 10 WHEN 'gold' THEN 20 WHEN 'epic' THEN 50 END)
  THEN
    RAISE EXCEPTION 'burn_gift_invalid';
  END IF;
  -- The public API never lets a player supply fulfillment instructions.
  p_gift_label := p_gift_weight_grams || 'g offerts';

  v_required_count := 10;

  v_count := array_length(p_instance_ids, 1);
  IF v_count IS NULL OR v_count <> v_required_count THEN
    RAISE EXCEPTION 'burn_requires_exactly_count';
  END IF;

  SELECT count(*) INTO v_valid_count
  FROM lottery_card_instances ci
  JOIN lottery_card_definitions cd ON cd.id = ci.card_definition_id
  WHERE ci.id = ANY(p_instance_ids)
    AND ci.user_id = p_user_id
    AND cd.rarity = p_rarity;

  IF v_valid_count <> v_required_count THEN
    RAISE EXCEPTION 'burn_instances_invalid';
  END IF;

  FOR v_instance IN
    SELECT unnest(p_instance_ids)
  LOOP
    IF (
      SELECT count(*)
      FROM lottery_card_instances ci2
      WHERE ci2.card_definition_id = (
        SELECT card_definition_id FROM lottery_card_instances WHERE id = v_instance
      )
      AND ci2.user_id = p_user_id
      AND ci2.id <> ALL(p_instance_ids)
    ) < 1 THEN
      RAISE EXCEPTION 'burn_would_remove_last_copy';
    END IF;
  END LOOP;

  DELETE FROM lottery_card_instances
  WHERE id = ANY(p_instance_ids) AND user_id = p_user_id;

  IF p_reward_kind = 'discount_percent' THEN
    IF p_discount_percent IS NULL OR p_discount_percent < 1 OR p_discount_percent > 80 THEN
      RAISE EXCEPTION 'burn_discount_invalid';
    END IF;

    v_generated_code := 'BURN-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8));
    v_title := 'Burn ' || p_rarity::TEXT || ' x' || v_required_count::TEXT;
    v_description := 'Remise ' || p_discount_percent || '% obtenue en brulant ' || v_required_count || ' doublons ' || p_rarity::TEXT;

    v_snapshot := jsonb_build_object(
      'title', v_title,
      'description', v_description,
      'kind', 'discount_percent',
      'discountPercent', p_discount_percent,
      'deleted', FALSE
    );

    INSERT INTO lottery_reward_claims (
      user_id, reward_snapshot, status, generated_code, discount_percent
    )
    VALUES (
      p_user_id, v_snapshot, 'available', v_generated_code, p_discount_percent
    )
    RETURNING id INTO v_claim_id;
  ELSE
    IF p_gift_weight_grams IS NULL OR p_gift_weight_grams < 1 THEN
      RAISE EXCEPTION 'burn_gift_invalid';
    END IF;

    v_generated_code := NULL;
    v_title := 'Burn ' || p_rarity::TEXT || ' x' || v_required_count::TEXT;
    v_description := COALESCE(
      NULLIF(trim(p_gift_label), ''),
      p_gift_weight_grams || 'g offerts obtenus en brulant ' || v_required_count || ' doublons ' || p_rarity::TEXT
    );

    v_snapshot := jsonb_build_object(
      'title', v_title,
      'description', v_description,
      'kind', 'gift_weight_grams',
      'giftWeightGrams', p_gift_weight_grams,
      'giftLabel', COALESCE(NULLIF(trim(p_gift_label), ''), p_gift_weight_grams || 'g offerts'),
      'deleted', FALSE
    );

    INSERT INTO lottery_reward_claims (
      user_id, reward_snapshot, status, gift_weight_grams, gift_label
    )
    VALUES (
      p_user_id,
      v_snapshot,
      'available',
      p_gift_weight_grams,
      COALESCE(NULLIF(trim(p_gift_label), ''), p_gift_weight_grams || 'g offerts')
    )
    RETURNING id INTO v_claim_id;
  END IF;

  INSERT INTO lottery_collection_burn_log (
    user_id,
    rarity,
    burned_instance_ids,
    reward_claim_id,
    reward_kind,
    discount_percent,
    gift_weight_grams,
    gift_label
  )
  VALUES (
    p_user_id,
    p_rarity,
    p_instance_ids,
    v_claim_id,
    p_reward_kind,
    CASE WHEN p_reward_kind = 'discount_percent' THEN p_discount_percent ELSE NULL END,
    CASE WHEN p_reward_kind = 'gift_weight_grams' THEN p_gift_weight_grams ELSE NULL END,
    CASE WHEN p_reward_kind = 'gift_weight_grams' THEN COALESCE(NULLIF(trim(p_gift_label), ''), p_gift_weight_grams || 'g offerts') ELSE NULL END
  );

  SELECT * INTO v_claim_row FROM lottery_reward_claims WHERE id = v_claim_id;

  RETURN jsonb_build_object(
    'id', v_claim_row.id,
    'user_id', v_claim_row.user_id,
    'reward_line_id', v_claim_row.reward_line_id,
    'source_ticket_id', v_claim_row.source_ticket_id,
    'reward_definition_id', v_claim_row.reward_definition_id,
    'reward_snapshot', v_claim_row.reward_snapshot,
    'status', v_claim_row.status,
    'generated_code', v_claim_row.generated_code,
    'discount_percent', v_claim_row.discount_percent,
    'gift_weight_grams', v_claim_row.gift_weight_grams,
    'gift_product_sku', v_claim_row.gift_product_sku,
    'gift_label', v_claim_row.gift_label,
    'reserved_order_id', v_claim_row.reserved_order_id,
    'reserved_at', v_claim_row.reserved_at,
    'reserved_until', v_claim_row.reserved_until,
    'used_order_id', v_claim_row.used_order_id,
    'used_at', v_claim_row.used_at,
    'fulfilled_at', v_claim_row.fulfilled_at,
    'created_at', v_claim_row.created_at,
    'rarity', p_rarity::TEXT,
    'burned_count', v_required_count,
    'consumed_instance_ids', to_jsonb(p_instance_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_burn_duplicate_cards(UUID, public.lottery_card_rarity, UUID[], public.lottery_reward_kind, INTEGER, INTEGER, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_claim_collection_page_reward(UUID, public.lottery_card_rarity, UUID)
  TO service_role;

COMMIT;

