-- Security hardening:
-- 1) Make promo consumption atomic inside rpc_create_order
-- 2) Add DB-backed rate limiting RPC for auth/webhook endpoints

BEGIN;

CREATE TABLE IF NOT EXISTS security_rate_limits (
  key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_updated_at
ON security_rate_limits(updated_at);

CREATE OR REPLACE FUNCTION public.rpc_rate_limit_hit(
  p_key TEXT,
  p_window_seconds INTEGER,
  p_max_hits INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  retry_after_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_window_start TIMESTAMPTZ;
  v_hits INTEGER;
  v_elapsed_seconds INTEGER;
BEGIN
  v_key := NULLIF(trim(p_key), '');
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'RATE_LIMIT_KEY_INVALID';
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'RATE_LIMIT_WINDOW_INVALID';
  END IF;

  IF p_max_hits IS NULL OR p_max_hits < 1 THEN
    RAISE EXCEPTION 'RATE_LIMIT_MAX_HITS_INVALID';
  END IF;

  LOOP
    UPDATE security_rate_limits
    SET
      hits = CASE
        WHEN v_now - window_started_at >= make_interval(secs => p_window_seconds) THEN 1
        ELSE hits + 1
      END,
      window_started_at = CASE
        WHEN v_now - window_started_at >= make_interval(secs => p_window_seconds) THEN v_now
        ELSE window_started_at
      END,
      updated_at = v_now
    WHERE key = v_key
    RETURNING window_started_at, hits INTO v_window_start, v_hits;

    IF FOUND THEN
      EXIT;
    END IF;

    BEGIN
      INSERT INTO security_rate_limits (key, window_started_at, hits, updated_at)
      VALUES (v_key, v_now, 1, v_now);
      v_window_start := v_now;
      v_hits := 1;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- Concurrent insert, retry the UPDATE path.
    END;
  END LOOP;

  IF v_hits <= p_max_hits THEN
    RETURN QUERY
    SELECT TRUE, GREATEST(p_max_hits - v_hits, 0), 0;
    RETURN;
  END IF;

  v_elapsed_seconds := GREATEST(
    FLOOR(EXTRACT(EPOCH FROM (v_now - v_window_start)))::INTEGER,
    0
  );

  RETURN QUERY
  SELECT FALSE, 0, GREATEST(p_window_seconds - v_elapsed_seconds, 1);
END;
$$;

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

REVOKE ALL ON FUNCTION public.rpc_rate_limit_hit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_rate_limit_hit(TEXT, INTEGER, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_create_order(JSONB, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_create_order(JSONB, JSONB, JSONB) TO service_role;

COMMIT;
