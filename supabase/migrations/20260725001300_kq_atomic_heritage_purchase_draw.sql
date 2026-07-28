BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_kq_draw_heritage_for_purchase(
  p_user_id UUID,
  p_order_item_id BIGINT,
  p_unit_index INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.order_items%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_state public.kq_heritage_player_state%ROWTYPE;
  v_existing public.kq_heritage_draws%ROWTYPE;
  v_draw public.kq_heritage_draws%ROWTYPE;
  v_card public.kq_heritage_card_definitions%ROWTYPE;
  v_seed INTEGER;
  v_roll INTEGER;
  v_rarity TEXT;
  v_duplicate BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_order_item_id IS NULL OR p_unit_index < 1 THEN
    RAISE EXCEPTION 'kq_heritage_invalid_purchase';
  END IF;

  SELECT * INTO v_item
  FROM public.order_items
  WHERE id = p_order_item_id
  FOR UPDATE;
  IF NOT FOUND OR p_unit_index > v_item.quantity THEN
    RAISE EXCEPTION 'kq_heritage_invalid_purchase';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_item.order_id;
  IF NOT FOUND
    OR v_order.customer_id IS DISTINCT FROM p_user_id
    OR v_order.payment_state <> 'paid'
    OR v_order.status = 'cancelled'
  THEN
    RAISE EXCEPTION 'kq_heritage_purchase_not_paid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.contest_entries entry
    WHERE entry.product_id = split_part(BTRIM(v_item.product_id), '::', 1)
  ) THEN
    RAISE EXCEPTION 'kq_heritage_purchase_not_eligible';
  END IF;

  SELECT * INTO v_existing
  FROM public.kq_heritage_draws
  WHERE order_item_id = p_order_item_id AND unit_index = p_unit_index;
  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'kq_heritage_purchase_owner_mismatch';
    END IF;
    RETURN jsonb_build_object('draw', to_jsonb(v_existing), 'alreadyDrawn', TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.kq_heritage_card_definitions WHERE is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'kq_heritage_collection_inactive';
  END IF;

  INSERT INTO public.kq_heritage_player_state(user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_state
  FROM public.kq_heritage_player_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_seed := (
    (hashtextextended(
      p_user_id::TEXT || ':' || p_order_item_id::TEXT || ':' || p_unit_index::TEXT,
      20260725
    ) & 2147483647) % 2147483647
  )::INTEGER;
  v_roll := v_seed % 10000;

  IF v_state.pulls_without_rare >= 5 THEN
    v_rarity := CASE WHEN v_roll < 8400 THEN 'rare' ELSE 'epic' END;
  ELSE
    v_rarity := CASE
      WHEN v_roll < 7000 THEN 'common'
      WHEN v_roll < 9500 THEN 'rare'
      ELSE 'epic'
    END;
  END IF;

  SELECT definition.* INTO v_card
  FROM public.kq_heritage_card_definitions definition
  WHERE definition.is_active = TRUE
    AND definition.rarity = v_rarity
    AND NOT EXISTS (
      SELECT 1 FROM public.kq_heritage_draws owned
      WHERE owned.user_id = p_user_id AND owned.card_code = definition.code
    )
  ORDER BY hashtextextended(definition.code, v_seed), definition.code
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT definition.* INTO v_card
    FROM public.kq_heritage_card_definitions definition
    WHERE definition.is_active = TRUE AND definition.rarity = v_rarity
    ORDER BY hashtextextended(definition.code, v_seed), definition.code
    LIMIT 1;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_heritage_rarity_unavailable'; END IF;

  v_duplicate := EXISTS (
    SELECT 1 FROM public.kq_heritage_draws
    WHERE user_id = p_user_id AND card_code = v_card.code
  );

  INSERT INTO public.kq_heritage_draws(
    user_id, order_item_id, unit_index, card_code, rarity, seed, was_duplicate
  ) VALUES (
    p_user_id, p_order_item_id, p_unit_index, v_card.code, v_card.rarity, v_seed, v_duplicate
  )
  RETURNING * INTO v_draw;

  UPDATE public.kq_heritage_player_state
  SET pulls_without_rare = CASE WHEN v_card.rarity = 'common' THEN LEAST(5, pulls_without_rare + 1) ELSE 0 END,
      total_pulls = total_pulls + 1,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('draw', to_jsonb(v_draw), 'alreadyDrawn', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_draw_heritage_for_purchase(UUID, BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_draw_heritage_for_purchase(UUID, BIGINT, INTEGER)
  TO service_role;

COMMIT;
