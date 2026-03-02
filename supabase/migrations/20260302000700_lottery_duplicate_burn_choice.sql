BEGIN;

ALTER TABLE public.lottery_collection_burn_log
  ALTER COLUMN discount_percent DROP NOT NULL;

ALTER TABLE public.lottery_collection_burn_log
  ADD COLUMN IF NOT EXISTS reward_kind public.lottery_reward_kind,
  ADD COLUMN IF NOT EXISTS gift_weight_grams INTEGER CHECK (gift_weight_grams IS NULL OR gift_weight_grams > 0),
  ADD COLUMN IF NOT EXISTS gift_label TEXT;

UPDATE public.lottery_collection_burn_log
SET reward_kind = COALESCE(reward_kind, 'discount_percent');

ALTER TABLE public.lottery_collection_burn_log
  ALTER COLUMN reward_kind SET NOT NULL;

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
BEGIN
  IF p_rarity = 'legendary' THEN
    RAISE EXCEPTION 'burn_legendary_not_allowed';
  END IF;

  IF p_reward_kind NOT IN ('discount_percent', 'gift_weight_grams') THEN
    RAISE EXCEPTION 'burn_reward_kind_invalid';
  END IF;

  v_count := array_length(p_instance_ids, 1);
  IF v_count IS NULL OR v_count <> 5 THEN
    RAISE EXCEPTION 'burn_requires_exactly_5';
  END IF;

  SELECT count(*) INTO v_valid_count
  FROM lottery_card_instances ci
  JOIN lottery_card_definitions cd ON cd.id = ci.card_definition_id
  WHERE ci.id = ANY(p_instance_ids)
    AND ci.user_id = p_user_id
    AND cd.rarity = p_rarity;

  IF v_valid_count <> 5 THEN
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
    v_title := 'Burn ' || p_rarity::TEXT || ' x5';
    v_description := 'Remise ' || p_discount_percent || '% obtenue en brulant 5 doublons ' || p_rarity::TEXT;

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
    v_title := 'Burn ' || p_rarity::TEXT || ' x5';
    v_description := COALESCE(
      NULLIF(trim(p_gift_label), ''),
      p_gift_weight_grams || 'g offerts obtenus en brulant 5 doublons ' || p_rarity::TEXT
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
    'burned_count', 5,
    'consumed_instance_ids', to_jsonb(p_instance_ids)
  );
END;
$$;

COMMIT;
