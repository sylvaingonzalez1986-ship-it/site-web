-- RPC functions for critical transactional workflows

BEGIN;

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
  v_promo_customer_id UUID;
  v_promo_code TEXT;
BEGIN
  v_order_id := COALESCE(NULLIF(p_order->>'id', ''), 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || floor(random() * 9000 + 1000)::TEXT);

  IF EXISTS (SELECT 1 FROM orders WHERE id = v_order_id) THEN
    RETURN v_order_id;
  END IF;

  v_customer_id := NULLIF(p_order->>'customer_id', '')::UUID;

  INSERT INTO orders (
    id,
    created_at,
    status,
    payment_provider,
    payment_state,
    viva_order_code,
    viva_transaction_id,
    customer_id,
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
    v_promo_customer_id := NULLIF(p_promo->>'customer_id', '')::uuid;
    v_promo_code := NULLIF(upper(p_promo->>'code'), '');

    IF v_promo_customer_id IS NOT NULL AND v_promo_code IS NOT NULL THEN
      UPDATE promo_codes
      SET used = TRUE,
          used_at = now()
      WHERE customer_id = v_promo_customer_id
        AND code = v_promo_code
        AND used = FALSE;
    END IF;
  END IF;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_update_payment(
  p_viva_order_code BIGINT,
  p_payment_state payment_state,
  p_viva_transaction_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_updated INTEGER := 0;
BEGIN
  UPDATE orders
  SET
    payment_state = p_payment_state,
    viva_transaction_id = COALESCE(NULLIF(p_viva_transaction_id, ''), viva_transaction_id),
    status = CASE
      WHEN p_payment_state = 'paid' THEN
        CASE
          WHEN status = 'cancelled' THEN status
          ELSE 'paid'
        END
      WHEN p_payment_state = 'failed' THEN
        CASE
          WHEN status IN ('new', 'pending_payment') THEN 'pending_payment'
          ELSE status
        END
      ELSE status
    END
  WHERE viva_order_code = p_viva_order_code;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN v_rows_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_issue_invoice(
  p_order_id TEXT
)
RETURNS TABLE (
  invoice_number TEXT,
  sequence INTEGER,
  year INTEGER,
  issued_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_year INTEGER;
  v_sequence INTEGER;
  v_invoice_number TEXT;
BEGIN
  -- Idempotency guard against concurrent calls for same order
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id, 0));

  RETURN QUERY
  SELECT i.invoice_number, i.sequence, i.year, i.issued_at
  FROM invoices i
  WHERE i.order_id = p_order_id;

  IF FOUND THEN
    RETURN;
  END IF;

  v_current_year := EXTRACT(YEAR FROM now())::INTEGER;

  INSERT INTO invoice_counter (year, next_sequence)
  VALUES (v_current_year, 1)
  ON CONFLICT (year) DO NOTHING;

  UPDATE invoice_counter
  SET next_sequence = next_sequence + 1
  WHERE invoice_counter.year = v_current_year
  RETURNING next_sequence - 1 INTO v_sequence;

  v_invoice_number := format('FA-%s-%s', v_current_year, lpad(v_sequence::text, 6, '0'));

  INSERT INTO invoices (order_id, invoice_number, sequence, year)
  VALUES (p_order_id, v_invoice_number, v_sequence, v_current_year);

  RETURN QUERY
  SELECT i.invoice_number, i.sequence, i.year, i.issued_at
  FROM invoices i
  WHERE i.order_id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_order(JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_update_payment(BIGINT, payment_state, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_issue_invoice(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rpc_create_order(JSONB, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_update_payment(BIGINT, payment_state, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_issue_invoice(TEXT) TO service_role;

COMMIT;

