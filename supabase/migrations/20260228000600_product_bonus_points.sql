BEGIN;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS bonus_points INTEGER
CHECK (bonus_points IS NULL OR bonus_points >= 0);

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS bonus_points INTEGER
CHECK (bonus_points IS NULL OR bonus_points >= 0);

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS loyalty_bonus_applied_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.rpc_create_order(
  p_order JSONB,
  p_items JSONB,
  p_promo JSONB DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id TEXT;
  v_promo_customer_id UUID;
  v_promo_code TEXT;
  v_promo_row promo_codes%ROWTYPE;
BEGIN
  v_order_id := COALESCE(
    NULLIF(p_order->>'id', ''),
    'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || floor(random() * 9000 + 1000)::TEXT
  );

  INSERT INTO orders (
    id,
    created_at,
    status,
    payment_provider,
    payment_state,
    viva_order_code,
    viva_transaction_id,
    customer_id,
    legacy_customer_id,
    customer_email,
    customer_name,
    shipping_address,
    shipping_city,
    shipping_postal_code,
    shipping_country,
    shipping_phone,
    delivery_method,
    delivery_fee,
    relay_provider,
    relay_id,
    relay_name,
    relay_address,
    relay_city,
    relay_postal_code,
    relay_country,
    promo_code,
    discount_percent,
    discount_amount,
    items_count,
    total_ht,
    total_vat,
    vat_breakdown,
    total_amount
  )
  VALUES (
    v_order_id,
    COALESCE(NULLIF(p_order->>'created_at', '')::timestamptz, now()),
    COALESCE(NULLIF(p_order->>'status', '')::order_status, 'new'),
    COALESCE(NULLIF(p_order->>'payment_provider', ''), 'viva'),
    COALESCE(NULLIF(p_order->>'payment_state', '')::payment_state, 'pending'),
    NULLIF(p_order->>'viva_order_code', '')::bigint,
    NULLIF(p_order->>'viva_transaction_id', ''),
    NULLIF(p_order->>'customer_id', '')::uuid,
    NULLIF(p_order->>'legacy_customer_id', ''),
    NULLIF(p_order->>'customer_email', ''),
    NULLIF(p_order->>'customer_name', ''),
    NULLIF(p_order->>'shipping_address', ''),
    NULLIF(p_order->>'shipping_city', ''),
    NULLIF(p_order->>'shipping_postal_code', ''),
    NULLIF(p_order->>'shipping_country', ''),
    NULLIF(p_order->>'shipping_phone', ''),
    COALESCE(NULLIF(p_order->>'delivery_method', ''), 'home'),
    COALESCE(NULLIF(p_order->>'delivery_fee', '')::numeric, 0),
    NULLIF(p_order->>'relay_provider', ''),
    NULLIF(p_order->>'relay_id', ''),
    NULLIF(p_order->>'relay_name', ''),
    NULLIF(p_order->>'relay_address', ''),
    NULLIF(p_order->>'relay_city', ''),
    NULLIF(p_order->>'relay_postal_code', ''),
    NULLIF(p_order->>'relay_country', ''),
    NULLIF(p_order->>'promo_code', ''),
    NULLIF(p_order->>'discount_percent', '')::numeric,
    NULLIF(p_order->>'discount_amount', '')::numeric,
    COALESCE((p_order->>'items_count')::integer, 0),
    NULLIF(p_order->>'total_ht', '')::numeric,
    NULLIF(p_order->>'total_vat', '')::numeric,
    COALESCE(p_order->'vat_breakdown', '[]'::jsonb),
    COALESCE((p_order->>'total_amount')::numeric, 0)
  );

  INSERT INTO order_items (
    order_id,
    product_id,
    name,
    unit_price,
    unit_price_ht,
    quantity,
    line_total,
    line_total_ht,
    line_vat_amount,
    vat_rate,
    bonus_points,
    parent_pack_id,
    parent_pack_name
  )
  SELECT
    v_order_id,
    COALESCE(item->>'product_id', ''),
    COALESCE(item->>'name', ''),
    COALESCE((item->>'unit_price')::numeric, 0),
    NULLIF(item->>'unit_price_ht', '')::numeric,
    COALESCE((item->>'quantity')::integer, 1),
    COALESCE((item->>'line_total')::numeric, 0),
    NULLIF(item->>'line_total_ht', '')::numeric,
    NULLIF(item->>'line_vat_amount', '')::numeric,
    COALESCE(NULLIF(item->>'vat_rate', '')::numeric, 20),
    NULLIF(item->>'bonus_points', '')::integer,
    NULLIF(item->>'parent_pack_id', ''),
    NULLIF(item->>'parent_pack_name', '')
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item;

  IF p_promo IS NOT NULL THEN
    v_promo_customer_id := NULLIF(p_promo->>'customer_id', '')::UUID;
    v_promo_code := NULLIF(upper(p_promo->>'code'), '');

    IF v_promo_customer_id IS NULL OR v_promo_code IS NULL THEN
      RAISE EXCEPTION 'PROMO_PAYLOAD_INVALID';
    END IF;

    SELECT *
    INTO v_promo_row
    FROM promo_codes
    WHERE customer_id = v_promo_customer_id
      AND upper(code) = v_promo_code
    FOR UPDATE;

    IF NOT FOUND OR v_promo_row.used THEN
      RAISE EXCEPTION 'PROMO_NOT_AVAILABLE';
    END IF;

    UPDATE promo_codes
    SET
      used = TRUE,
      used_at = now()
    WHERE id = v_promo_row.id;
  END IF;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_apply_order_loyalty_bonus(
  p_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_payment_state payment_state;
  v_bonus_applied_at TIMESTAMPTZ;
  v_total_bonus INTEGER := 0;
BEGIN
  SELECT
    customer_id,
    payment_state,
    loyalty_bonus_applied_at
  INTO
    v_customer_id,
    v_payment_state,
    v_bonus_applied_at
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_payment_state <> 'paid' THEN
    RAISE EXCEPTION 'order_not_paid';
  END IF;

  IF v_bonus_applied_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'applied', FALSE,
      'reason', 'already_applied',
      'bonus_points', 0
    );
  END IF;

  SELECT COALESCE(SUM(COALESCE(bonus_points, 0) * quantity), 0)::INTEGER
  INTO v_total_bonus
  FROM public.order_items
  WHERE order_id = p_order_id;

  IF v_total_bonus <= 0 THEN
    UPDATE public.orders
    SET loyalty_bonus_applied_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'applied', FALSE,
      'reason', 'no_bonus_points',
      'bonus_points', 0
    );
  END IF;

  IF v_customer_id IS NULL THEN
    UPDATE public.orders
    SET loyalty_bonus_applied_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'applied', FALSE,
      'reason', 'no_customer',
      'bonus_points', 0
    );
  END IF;

  UPDATE public.profiles
  SET loyalty_points = loyalty_points + v_total_bonus
  WHERE id = v_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_found';
  END IF;

  UPDATE public.orders
  SET loyalty_bonus_applied_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'applied', TRUE,
    'bonus_points', v_total_bonus
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_order(JSONB, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_create_order(JSONB, JSONB, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_apply_order_loyalty_bonus(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_apply_order_loyalty_bonus(TEXT) TO service_role;

COMMIT;
