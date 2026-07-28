BEGIN;

ALTER TABLE public.kq_heritage_draws
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'purchase',
  ADD COLUMN IF NOT EXISTS craft_key TEXT UNIQUE;

ALTER TABLE public.kq_heritage_draws
  ALTER COLUMN order_item_id DROP NOT NULL,
  ALTER COLUMN unit_index DROP NOT NULL;

ALTER TABLE public.kq_heritage_draws
  DROP CONSTRAINT IF EXISTS kq_heritage_draws_order_item_id_unit_index_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_kq_heritage_purchase_unit
  ON public.kq_heritage_draws(order_item_id, unit_index)
  WHERE source = 'purchase';

ALTER TABLE public.kq_heritage_draws
  DROP CONSTRAINT IF EXISTS kq_heritage_draws_source_shape_check;
ALTER TABLE public.kq_heritage_draws
  ADD CONSTRAINT kq_heritage_draws_source_shape_check CHECK (
    (
      source = 'purchase'
      AND order_item_id IS NOT NULL
      AND unit_index IS NOT NULL
      AND craft_key IS NULL
    )
    OR
    (
      source = 'craft'
      AND order_item_id IS NULL
      AND unit_index IS NULL
      AND craft_key IS NOT NULL
      AND was_duplicate = FALSE
    )
  );

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
  v_cost INTEGER;
  v_balance INTEGER;
  v_draw public.kq_heritage_draws%ROWTYPE;
  v_craft_key TEXT;
BEGIN
  IF p_user_id IS NULL OR p_card_code !~ '^HERITAGE-[0-9]{3}$' THEN
    RAISE EXCEPTION 'kq_heritage_invalid_craft';
  END IF;

  SELECT * INTO v_card
  FROM public.kq_heritage_card_definitions
  WHERE code = p_card_code AND is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_heritage_collection_inactive'; END IF;

  v_cost := CASE v_card.rarity
    WHEN 'common' THEN 5
    WHEN 'rare' THEN 12
    ELSE NULL
  END;
  IF v_cost IS NULL THEN RAISE EXCEPTION 'kq_heritage_epic_not_craftable'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.kq_heritage_draws
    WHERE user_id = p_user_id AND card_code = p_card_code
  ) THEN
    RAISE EXCEPTION 'kq_heritage_already_owned';
  END IF;

  INSERT INTO public.kq_heritage_fragment_wallets(user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.kq_heritage_fragment_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF v_balance < v_cost THEN RAISE EXCEPTION 'kq_heritage_fragments_insufficient'; END IF;

  v_craft_key := 'craft:' || p_user_id::TEXT || ':' || p_card_code;

  UPDATE public.kq_heritage_fragment_wallets
  SET balance = balance - v_cost, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.kq_heritage_fragment_ledger(user_id, amount, reason, reward_key)
  VALUES (
    p_user_id,
    -v_cost,
    CASE v_card.rarity WHEN 'common' THEN 'craft_common' ELSE 'craft_rare' END,
    v_craft_key
  );

  INSERT INTO public.kq_heritage_draws(
    user_id, order_item_id, unit_index, card_code, rarity, seed, was_duplicate,
    source, craft_key
  ) VALUES (
    p_user_id, NULL, NULL, v_card.code, v_card.rarity, 0, FALSE,
    'craft', v_craft_key
  )
  RETURNING * INTO v_draw;

  RETURN jsonb_build_object(
    'draw', to_jsonb(v_draw),
    'fragmentBalance', v_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_craft_heritage_card(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_craft_heritage_card(UUID, TEXT)
  TO service_role;

COMMIT;
