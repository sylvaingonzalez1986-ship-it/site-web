BEGIN;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'home' CHECK (delivery_method IN ('home', 'relay')),
ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
ADD COLUMN IF NOT EXISTS relay_provider TEXT,
ADD COLUMN IF NOT EXISTS relay_id TEXT,
ADD COLUMN IF NOT EXISTS relay_name TEXT,
ADD COLUMN IF NOT EXISTS relay_address TEXT,
ADD COLUMN IF NOT EXISTS relay_city TEXT,
ADD COLUMN IF NOT EXISTS relay_postal_code TEXT,
ADD COLUMN IF NOT EXISTS relay_country TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_method ON orders(delivery_method);
CREATE INDEX IF NOT EXISTS idx_orders_relay_id ON orders(relay_id);

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
  v_customer_id UUID;
  v_legacy_customer_id TEXT;
  v_promo_customer_id UUID;
  v_promo_code TEXT;
  v_promo_rows_updated INTEGER := 0;
BEGIN
  v_order_id := COALESCE(NULLIF(p_order->>'id', ''), 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || floor(random() * 9000 + 1000)::TEXT);

  IF EXISTS (SELECT 1 FROM orders WHERE id = v_order_id) THEN
    RETURN v_order_id;
  END IF;

  v_customer_id := NULLIF(p_order->>'customer_id', '')::UUID;
  v_legacy_customer_id := NULLIF(p_order->>'legacy_customer_id', '');

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
    COALESCE((p_order->>'created_at')::timestamptz, now()),
    COALESCE((p_order->>'status')::order_status, 'new'),
    COALESCE(NULLIF(p_order->>'payment_provider', ''), 'viva'),
    COALESCE((p_order->>'payment_state')::payment_state, 'pending'),
    NULLIF(p_order->>'viva_order_code', '')::bigint,
    NULLIF(p_order->>'viva_transaction_id', ''),
    v_customer_id,
    v_legacy_customer_id,
    NULLIF(p_order->>'customer_email', ''),
    NULLIF(p_order->>'customer_name', ''),
    NULLIF(p_order->>'shipping_address', ''),
    NULLIF(p_order->>'shipping_city', ''),
    NULLIF(p_order->>'shipping_postal_code', ''),
    NULLIF(p_order->>'shipping_country', ''),
    NULLIF(p_order->>'shipping_phone', ''),
    CASE
      WHEN lower(COALESCE(NULLIF(p_order->>'delivery_method', ''), 'home')) = 'relay' THEN 'relay'
      ELSE 'home'
    END,
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
    NULLIF(item->>'parent_pack_id', ''),
    NULLIF(item->>'parent_pack_name', '')
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item;

  IF p_promo IS NOT NULL THEN
    v_promo_customer_id := NULLIF(p_promo->>'customer_id', '')::UUID;
    v_promo_code := NULLIF(upper(p_promo->>'code'), '');

    IF v_promo_customer_id IS NULL OR v_promo_code IS NULL THEN
      RAISE EXCEPTION 'PROMO_PAYLOAD_INVALID';
    END IF;

    UPDATE promo_codes
    SET used = TRUE,
        used_at = now()
    WHERE customer_id = v_promo_customer_id
      AND code = v_promo_code
      AND used = FALSE;

    GET DIAGNOSTICS v_promo_rows_updated = ROW_COUNT;
    IF v_promo_rows_updated = 0 THEN
      RAISE EXCEPTION 'PROMO_NOT_AVAILABLE';
    END IF;
  END IF;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_order(JSONB, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_create_order(JSONB, JSONB, JSONB) TO service_role;

COMMIT;
