BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS loyalty_badge_id TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS extra_lottery_tickets INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_extra_lottery_tickets_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_extra_lottery_tickets_check
  CHECK (extra_lottery_tickets >= 0);

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
    loyalty_badge_id,
    extra_lottery_tickets,
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
    NULLIF(p_order->>'loyalty_badge_id', ''),
    COALESCE(NULLIF(p_order->>'extra_lottery_tickets', '')::integer, 0),
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

DROP FUNCTION IF EXISTS public.rpc_mint_lottery_tickets(UUID, TEXT, NUMERIC);

CREATE FUNCTION public.rpc_mint_lottery_tickets(
  p_user_id UUID,
  p_order_id TEXT,
  p_order_amount NUMERIC,
  p_bonus_ticket_count INTEGER DEFAULT 0
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config public.lottery_game_config%ROWTYPE;
  v_base_ticket_count INTEGER;
  v_bonus_ticket_count INTEGER;
  v_ticket_count INTEGER;
  v_start_number INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_order_id IS NULL OR btrim(p_order_id) = '' THEN
    RETURN 0;
  END IF;

  SELECT *
  INTO v_config
  FROM public.lottery_game_config
  WHERE id = 1;

  IF NOT FOUND OR v_config.is_active = FALSE OR v_config.euros_per_ticket <= 0 THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id, 0));

  IF EXISTS (SELECT 1 FROM public.lottery_tickets WHERE order_id = p_order_id) THEN
    RETURN 0;
  END IF;

  v_base_ticket_count := FLOOR(GREATEST(COALESCE(p_order_amount, 0), 0) / v_config.euros_per_ticket);
  v_base_ticket_count := LEAST(v_base_ticket_count, v_config.max_tickets_per_order);
  v_bonus_ticket_count := GREATEST(COALESCE(p_bonus_ticket_count, 0), 0);
  v_ticket_count := v_base_ticket_count + v_bonus_ticket_count;

  IF v_ticket_count < 1 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.lottery_ticket_counter (id, next_number)
  VALUES (1, 1)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.lottery_ticket_counter
  SET next_number = next_number + v_ticket_count
  WHERE id = 1
  RETURNING next_number - v_ticket_count INTO v_start_number;

  INSERT INTO public.lottery_tickets (
    user_id,
    order_id,
    ticket_number,
    order_amount,
    status
  )
  SELECT
    p_user_id,
    p_order_id,
    'TICKET-' || lpad((v_start_number + gs)::TEXT, 8, '0'),
    GREATEST(COALESCE(p_order_amount, 0), 0),
    'available'
  FROM generate_series(0, v_ticket_count - 1) AS gs;

  INSERT INTO public.lottery_audit_log (
    event_type,
    user_id,
    order_id,
    details
  )
  VALUES (
    'mint',
    p_user_id,
    p_order_id,
    jsonb_build_object(
      'ticket_count', v_ticket_count,
      'base_ticket_count', v_base_ticket_count,
      'bonus_ticket_count', v_bonus_ticket_count,
      'order_amount', GREATEST(COALESCE(p_order_amount, 0), 0),
      'euros_per_ticket', v_config.euros_per_ticket,
      'max_tickets_per_order', v_config.max_tickets_per_order
    )
  );

  RETURN v_ticket_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_mint_lottery_tickets(UUID, TEXT, NUMERIC, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_mint_lottery_tickets(UUID, TEXT, NUMERIC, INTEGER) TO service_role;

COMMIT;
