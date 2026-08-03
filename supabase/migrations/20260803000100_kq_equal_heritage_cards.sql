BEGIN;

-- The legacy column remains only for backward compatibility with existing draws.
-- Every Heritage card now has the same technical value and no public rarity.
UPDATE public.kq_heritage_card_definitions SET rarity = 'common', updated_at = now()
WHERE rarity <> 'common';
UPDATE public.kq_heritage_draws SET rarity = 'common' WHERE rarity <> 'common';
UPDATE public.kq_heritage_player_state SET pulls_without_rare = 0 WHERE pulls_without_rare <> 0;

ALTER TABLE public.kq_heritage_card_definitions
  DROP CONSTRAINT IF EXISTS kq_heritage_definitions_equal_value;
ALTER TABLE public.kq_heritage_card_definitions
  ADD CONSTRAINT kq_heritage_definitions_equal_value CHECK (rarity = 'common');
ALTER TABLE public.kq_heritage_draws
  DROP CONSTRAINT IF EXISTS kq_heritage_draws_equal_value;
ALTER TABLE public.kq_heritage_draws
  ADD CONSTRAINT kq_heritage_draws_equal_value CHECK (rarity = 'common');

DROP FUNCTION IF EXISTS public.rpc_kq_update_heritage_card_editorial(
  TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT
);
CREATE FUNCTION public.rpc_kq_update_heritage_card_editorial(
  p_code TEXT, p_name TEXT, p_description TEXT,
  p_image_url TEXT, p_is_active BOOLEAN, p_advantage TEXT, p_drawback TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_code !~ '^HERITAGE-[0-9]{3}$'
    OR char_length(BTRIM(p_name)) NOT BETWEEN 3 AND 120
    OR char_length(BTRIM(p_advantage)) NOT BETWEEN 3 AND 500
    OR char_length(BTRIM(p_description)) NOT BETWEEN 10 AND 500
    OR char_length(p_image_url) > 2000
    OR char_length(p_drawback) > 500 THEN
    RAISE EXCEPTION 'kq_heritage_card_invalid';
  END IF;
  UPDATE public.kq_heritage_card_definitions SET
    name = BTRIM(p_name), description = BTRIM(p_description),
    image_url = BTRIM(p_image_url), is_active = p_is_active,
    advantage = BTRIM(p_advantage), drawback = BTRIM(p_drawback), updated_at = now()
  WHERE code = p_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_heritage_card_not_found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_update_heritage_card_editorial(
  TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_update_heritage_card_editorial(
  TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.kq_credit_heritage_duplicate_fragments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.was_duplicate IS DISTINCT FROM TRUE THEN RETURN NEW; END IF;

  INSERT INTO public.kq_heritage_fragment_ledger(user_id, draw_id, amount, reason)
  VALUES (NEW.user_id, NEW.id, 1, 'duplicate_common')
  ON CONFLICT (draw_id) DO NOTHING;

  IF FOUND THEN
    INSERT INTO public.kq_heritage_fragment_wallets(user_id, balance)
    VALUES (NEW.user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET
      balance = public.kq_heritage_fragment_wallets.balance + 1,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.kq_credit_heritage_duplicate_fragments()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_kq_craft_heritage_card(
  p_user_id UUID,
  p_card_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.kq_heritage_card_definitions%ROWTYPE;
  v_cost CONSTANT INTEGER := 5;
  v_balance INTEGER;
  v_draw public.kq_heritage_draws%ROWTYPE;
  v_craft_key TEXT;
BEGIN
  IF p_user_id IS NULL OR p_card_code !~ '^HERITAGE-[0-9]{3}$' THEN
    RAISE EXCEPTION 'kq_heritage_invalid_craft';
  END IF;
  SELECT * INTO v_card FROM public.kq_heritage_card_definitions
  WHERE code = p_card_code AND is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_heritage_collection_inactive'; END IF;
  IF EXISTS (SELECT 1 FROM public.kq_heritage_draws WHERE user_id = p_user_id AND card_code = p_card_code) THEN
    RAISE EXCEPTION 'kq_heritage_already_owned';
  END IF;

  INSERT INTO public.kq_heritage_fragment_wallets(user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.kq_heritage_fragment_wallets
  WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance < v_cost THEN RAISE EXCEPTION 'kq_heritage_fragments_insufficient'; END IF;

  v_craft_key := 'craft:' || p_user_id::TEXT || ':' || p_card_code;
  UPDATE public.kq_heritage_fragment_wallets SET balance = balance - v_cost, updated_at = now()
  WHERE user_id = p_user_id RETURNING balance INTO v_balance;
  INSERT INTO public.kq_heritage_fragment_ledger(user_id, amount, reason, reward_key)
  VALUES (p_user_id, -v_cost, 'craft_common', v_craft_key);
  INSERT INTO public.kq_heritage_draws(
    user_id, order_item_id, unit_index, card_code, rarity, seed, was_duplicate, source, craft_key
  ) VALUES (
    p_user_id, NULL, NULL, v_card.code, 'common', 0, FALSE, 'craft', v_craft_key
  ) RETURNING * INTO v_draw;
  RETURN jsonb_build_object('draw', to_jsonb(v_draw), 'fragmentBalance', v_balance);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_craft_heritage_card(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_craft_heritage_card(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_draw_heritage_for_purchase_unlocked(
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
  v_existing public.kq_heritage_draws%ROWTYPE;
  v_draw public.kq_heritage_draws%ROWTYPE;
  v_card public.kq_heritage_card_definitions%ROWTYPE;
  v_seed INTEGER;
  v_duplicate BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_order_item_id IS NULL OR p_unit_index < 1 THEN
    RAISE EXCEPTION 'kq_heritage_invalid_purchase';
  END IF;
  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id FOR UPDATE;
  IF NOT FOUND OR p_unit_index > v_item.quantity THEN RAISE EXCEPTION 'kq_heritage_invalid_purchase'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = v_item.order_id;
  IF NOT FOUND OR v_order.customer_id IS DISTINCT FROM p_user_id
    OR v_order.payment_state <> 'paid' OR v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'kq_heritage_purchase_not_paid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.contest_entries entry
    WHERE entry.product_id = split_part(BTRIM(v_item.product_id), '::', 1)
  ) THEN RAISE EXCEPTION 'kq_heritage_purchase_not_eligible'; END IF;

  SELECT * INTO v_existing FROM public.kq_heritage_draws
  WHERE order_item_id = p_order_item_id AND unit_index = p_unit_index;
  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'kq_heritage_purchase_owner_mismatch';
    END IF;
    RETURN jsonb_build_object('draw', to_jsonb(v_existing), 'alreadyDrawn', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kq_heritage_card_definitions WHERE is_active = TRUE) THEN
    RAISE EXCEPTION 'kq_heritage_collection_inactive';
  END IF;

  INSERT INTO public.kq_heritage_player_state(user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.kq_heritage_player_state WHERE user_id = p_user_id FOR UPDATE;
  v_seed := (((hashtextextended(
    p_user_id::TEXT || ':' || p_order_item_id::TEXT || ':' || p_unit_index::TEXT,
    20260725
  ) & 2147483647) % 2147483647))::INTEGER;

  SELECT definition.* INTO v_card FROM public.kq_heritage_card_definitions definition
  WHERE definition.is_active = TRUE AND NOT EXISTS (
    SELECT 1 FROM public.kq_heritage_draws owned
    WHERE owned.user_id = p_user_id AND owned.card_code = definition.code
  )
  ORDER BY hashtextextended(definition.code, v_seed), definition.code LIMIT 1;
  IF NOT FOUND THEN
    SELECT definition.* INTO v_card FROM public.kq_heritage_card_definitions definition
    WHERE definition.is_active = TRUE
    ORDER BY hashtextextended(definition.code, v_seed), definition.code LIMIT 1;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_heritage_card_unavailable'; END IF;

  v_duplicate := EXISTS (
    SELECT 1 FROM public.kq_heritage_draws WHERE user_id = p_user_id AND card_code = v_card.code
  );
  INSERT INTO public.kq_heritage_draws(
    user_id, order_item_id, unit_index, card_code, rarity, seed, was_duplicate
  ) VALUES (
    p_user_id, p_order_item_id, p_unit_index, v_card.code, 'common', v_seed, v_duplicate
  ) RETURNING * INTO v_draw;
  UPDATE public.kq_heritage_player_state
  SET pulls_without_rare = 0, total_pulls = total_pulls + 1, updated_at = now()
  WHERE user_id = p_user_id;
  RETURN jsonb_build_object('draw', to_jsonb(v_draw), 'alreadyDrawn', FALSE);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_draw_heritage_for_purchase_unlocked(UUID, BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
