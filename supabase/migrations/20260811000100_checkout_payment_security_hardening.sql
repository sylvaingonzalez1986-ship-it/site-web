BEGIN;

-- Viva order codes can contain 16 digits. Keep them as text so JavaScript never
-- rounds them before a lookup or a payment update.
DROP FUNCTION IF EXISTS public.rpc_update_payment(BIGINT, payment_state, TEXT);

ALTER TABLE public.orders
  ALTER COLUMN viva_order_code TYPE TEXT USING viva_order_code::TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_attempt_id UUID;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_review_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_review_reason TEXT;

-- Replace the latest order creation RPC so the Viva reference is inserted as
-- text after the column migration (all other transactional promo semantics are
-- kept unchanged).
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
    id, created_at, status, payment_provider, payment_state,
    viva_order_code, viva_transaction_id, customer_id, legacy_customer_id,
    customer_email, customer_name, shipping_address, shipping_city,
    shipping_postal_code, shipping_country, shipping_phone, delivery_method,
    delivery_fee, relay_provider, relay_id, relay_name, relay_address,
    relay_city, relay_postal_code, relay_country, promo_code,
    discount_percent, discount_amount, loyalty_badge_id,
    extra_lottery_tickets, items_count, total_ht, total_vat,
    vat_breakdown, total_amount
  )
  VALUES (
    v_order_id,
    COALESCE(NULLIF(p_order->>'created_at', '')::timestamptz, now()),
    COALESCE(NULLIF(p_order->>'status', '')::order_status, 'new'),
    COALESCE(NULLIF(p_order->>'payment_provider', ''), 'viva'),
    COALESCE(NULLIF(p_order->>'payment_state', '')::payment_state, 'pending'),
    NULLIF(p_order->>'viva_order_code', ''),
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
    order_id, product_id, name, unit_price, unit_price_ht, quantity,
    line_total, line_total_ht, line_vat_amount, vat_rate, bonus_points,
    parent_pack_id, parent_pack_name
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

    SELECT * INTO v_promo_row
    FROM promo_codes
    WHERE customer_id = v_promo_customer_id AND upper(code) = v_promo_code
    FOR UPDATE;
    IF NOT FOUND OR v_promo_row.used THEN
      RAISE EXCEPTION 'PROMO_NOT_AVAILABLE';
    END IF;

    UPDATE promo_codes SET used = TRUE, used_at = now()
    WHERE id = v_promo_row.id;
  END IF;

  RETURN v_order_id;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_checkout_attempt_id
  ON public.orders (checkout_attempt_id)
  WHERE checkout_attempt_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_viva_transaction_id
  ON public.orders (viva_transaction_id)
  WHERE viva_transaction_id IS NOT NULL AND btrim(viva_transaction_id) <> '';

CREATE TABLE IF NOT EXISTS public.checkout_attempts (
  attempt_id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cart_fingerprint TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'creating'
    CHECK (state IN ('creating', 'ready', 'failed', 'completed')),
  order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  viva_order_code TEXT,
  checkout_url TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cart_fingerprint ~ '^[0-9a-f]{64}$'),
  CHECK (viva_order_code IS NULL OR viva_order_code ~ '^\d{1,32}$')
);

ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_checkout_attempts_customer_updated
  ON public.checkout_attempts (customer_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.rpc_begin_checkout_attempt(
  p_attempt_id UUID,
  p_customer_id UUID,
  p_cart_fingerprint TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt public.checkout_attempts%ROWTYPE;
BEGIN
  IF p_attempt_id IS NULL OR p_customer_id IS NULL
     OR p_cart_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'checkout_attempt_invalid';
  END IF;

  -- Serialize both the client attempt and an equivalent cart for this customer.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_customer_id::TEXT || ':' || p_cart_fingerprint, 0)
  );

  SELECT * INTO v_attempt
  FROM public.checkout_attempts
  WHERE attempt_id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT ca.* INTO v_attempt
    FROM public.checkout_attempts ca
    LEFT JOIN public.orders o ON o.id = ca.order_id
    WHERE ca.customer_id = p_customer_id
      AND ca.cart_fingerprint = p_cart_fingerprint
      AND (
        (ca.state = 'creating' AND ca.updated_at > now() - interval '2 minutes')
        OR (
          ca.state = 'ready'
          AND ca.updated_at > now() - interval '24 hours'
          AND o.payment_state <> 'paid'
          AND o.archived_at IS NULL
        )
      )
    ORDER BY ca.updated_at DESC
    LIMIT 1
    FOR UPDATE OF ca;

    IF FOUND THEN
      IF v_attempt.state = 'ready' AND v_attempt.checkout_url IS NOT NULL THEN
        RETURN jsonb_build_object(
          'action', 'resume',
          'order_id', v_attempt.order_id,
          'order_code', v_attempt.viva_order_code,
          'checkout_url', v_attempt.checkout_url
        );
      END IF;
      RETURN jsonb_build_object('action', 'busy');
    END IF;

    INSERT INTO public.checkout_attempts (attempt_id, customer_id, cart_fingerprint)
    VALUES (p_attempt_id, p_customer_id, p_cart_fingerprint);
    RETURN jsonb_build_object('action', 'create');
  END IF;

  IF v_attempt.customer_id <> p_customer_id
     OR v_attempt.cart_fingerprint <> p_cart_fingerprint THEN
    RAISE EXCEPTION 'checkout_attempt_conflict';
  END IF;

  IF v_attempt.state = 'completed' THEN
    RETURN jsonb_build_object('action', 'completed');
  END IF;

  IF v_attempt.state = 'ready' AND v_attempt.checkout_url IS NOT NULL THEN
    RETURN jsonb_build_object(
      'action', 'resume',
      'order_id', v_attempt.order_id,
      'order_code', v_attempt.viva_order_code,
      'checkout_url', v_attempt.checkout_url
    );
  END IF;

  IF v_attempt.state = 'creating'
     AND v_attempt.updated_at > now() - interval '2 minutes' THEN
    RETURN jsonb_build_object('action', 'busy');
  END IF;

  UPDATE public.checkout_attempts
  SET state = 'creating', attempt_count = attempt_count + 1,
      last_error = NULL, updated_at = now()
  WHERE attempt_id = p_attempt_id;

  RETURN jsonb_build_object('action', 'create');
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_complete_checkout_attempt(
  p_attempt_id UUID,
  p_customer_id UUID,
  p_order_id TEXT,
  p_viva_order_code TEXT,
  p_checkout_url TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_viva_order_code !~ '^\d{1,32}$' OR p_checkout_url IS NULL THEN
    RAISE EXCEPTION 'checkout_attempt_completion_invalid';
  END IF;

  UPDATE public.orders
  SET checkout_attempt_id = p_attempt_id
  WHERE id = p_order_id AND customer_id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'checkout_attempt_order_not_found';
  END IF;

  UPDATE public.checkout_attempts
  SET state = 'ready', order_id = p_order_id,
      viva_order_code = p_viva_order_code, checkout_url = p_checkout_url,
      last_error = NULL, updated_at = now()
  WHERE attempt_id = p_attempt_id AND customer_id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'checkout_attempt_not_found';
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_fail_checkout_attempt(
  p_attempt_id UUID,
  p_customer_id UUID,
  p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.checkout_attempts
  SET state = 'failed', last_error = left(NULLIF(btrim(p_error), ''), 500),
      updated_at = now()
  WHERE attempt_id = p_attempt_id AND customer_id = p_customer_id;
  RETURN FOUND;
END;
$$;

-- A referral first-order discount can only be reserved by one active order.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_referral_first_order_discount
  ON public.orders (customer_id)
  WHERE customer_id IS NOT NULL
    AND promo_code = 'AUTO-FILLEUL-10'
    AND archived_at IS NULL;

-- Webhook events are claimed as "processing" and only become duplicates after
-- completion. Failed/stale events can therefore be retried safely by Viva.
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS last_error TEXT;

UPDATE public.webhook_events
SET event_type = COALESCE(NULLIF(event_type, ''), 'legacy'),
    status = 'completed',
    completed_at = COALESCE(completed_at, created_at),
    updated_at = COALESCE(updated_at, created_at);

ALTER TABLE public.webhook_events
  ALTER COLUMN event_type SET NOT NULL;
ALTER TABLE public.webhook_events
  DROP CONSTRAINT IF EXISTS uq_webhook_events_provider_external;
DROP INDEX IF EXISTS public.uq_webhook_events_provider_external;
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_provider_type_external
  ON public.webhook_events (provider, event_type, external_id);

CREATE OR REPLACE FUNCTION public.rpc_begin_webhook_event(
  p_provider TEXT,
  p_event_type TEXT,
  p_external_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.webhook_events%ROWTYPE;
  v_lock_key TEXT;
BEGIN
  IF NULLIF(btrim(p_provider), '') IS NULL
     OR NULLIF(btrim(p_event_type), '') IS NULL
     OR NULLIF(btrim(p_external_id), '') IS NULL THEN
    RAISE EXCEPTION 'webhook_event_invalid';
  END IF;

  v_lock_key := p_provider || ':' || p_event_type || ':' || p_external_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  SELECT * INTO v_event
  FROM public.webhook_events
  WHERE provider = p_provider AND event_type = p_event_type
    AND external_id = p_external_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.webhook_events (
      provider, event_type, external_id, status, attempts, updated_at
    ) VALUES (p_provider, p_event_type, p_external_id, 'processing', 1, now());
    RETURN 'process';
  END IF;

  IF v_event.status = 'completed' THEN
    RETURN 'duplicate';
  END IF;
  IF v_event.status = 'processing'
     AND v_event.updated_at > now() - interval '10 minutes' THEN
    RETURN 'busy';
  END IF;

  UPDATE public.webhook_events
  SET status = 'processing', attempts = attempts + 1,
      last_error = NULL, updated_at = now()
  WHERE id = v_event.id;
  RETURN 'process';
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_complete_webhook_event(
  p_provider TEXT, p_event_type TEXT, p_external_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.webhook_events
  SET status = 'completed', completed_at = now(), updated_at = now(), last_error = NULL
  WHERE provider = p_provider AND event_type = p_event_type
    AND external_id = p_external_id AND status = 'processing'
  RETURNING TRUE;
$$;

CREATE OR REPLACE FUNCTION public.rpc_fail_webhook_event(
  p_provider TEXT, p_event_type TEXT, p_external_id TEXT, p_error TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.webhook_events
  SET status = 'failed', updated_at = now(), last_error = left(p_error, 1000)
  WHERE provider = p_provider AND event_type = p_event_type
    AND external_id = p_external_id AND status = 'processing'
  RETURNING TRUE;
$$;

CREATE OR REPLACE FUNCTION public.rpc_update_payment(
  p_viva_order_code TEXT,
  p_payment_state payment_state,
  p_viva_transaction_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET payment_state = p_payment_state,
      viva_transaction_id = COALESCE(NULLIF(p_viva_transaction_id, ''), viva_transaction_id),
      status = CASE
        WHEN p_payment_state = 'paid' AND status <> 'cancelled' THEN 'paid'::order_status
        WHEN p_payment_state = 'failed' AND status IN ('new', 'pending_payment')
          THEN 'pending_payment'::order_status
        ELSE status
      END
  WHERE viva_order_code = p_viva_order_code AND archived_at IS NULL;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finalize_viva_payment(
  p_viva_order_code TEXT,
  p_viva_transaction_id TEXT,
  p_amount_minor BIGINT,
  p_currency_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_review_required BOOLEAN := FALSE;
  v_review_reason TEXT;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE viva_order_code = p_viva_order_code AND archived_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('updated', FALSE, 'reason', 'order_not_found');
  END IF;
  IF p_currency_code <> '978' THEN
    RAISE EXCEPTION 'payment_currency_mismatch';
  END IF;
  IF round(v_order.total_amount * 100)::BIGINT <> p_amount_minor THEN
    RAISE EXCEPTION 'payment_amount_mismatch';
  END IF;
  IF NULLIF(btrim(p_viva_transaction_id), '') IS NULL THEN
    RAISE EXCEPTION 'payment_transaction_id_required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE viva_transaction_id = p_viva_transaction_id AND id <> v_order.id
  ) THEN
    RAISE EXCEPTION 'payment_transaction_already_used';
  END IF;

  IF v_order.payment_state = 'paid' THEN
    IF v_order.viva_transaction_id IS DISTINCT FROM p_viva_transaction_id THEN
      RAISE EXCEPTION 'payment_transaction_mismatch';
    END IF;
    RETURN jsonb_build_object(
      'updated', FALSE, 'reason', 'already_paid', 'order_id', v_order.id,
      'review_required', v_order.payment_review_required
    );
  END IF;

  UPDATE public.orders
  SET payment_state = 'paid',
      viva_transaction_id = p_viva_transaction_id,
      status = CASE WHEN status = 'cancelled' THEN status ELSE 'paid'::order_status END,
      payment_review_required = FALSE,
      payment_review_reason = NULL
  WHERE id = v_order.id;

  UPDATE public.checkout_attempts
  SET state = 'completed', updated_at = now()
  WHERE order_id = v_order.id;

  BEGIN
    PERFORM public.rpc_apply_order_inventory(v_order.id);
  EXCEPTION WHEN OTHERS THEN
    v_review_required := TRUE;
    v_review_reason := left(SQLERRM, 1000);
    UPDATE public.orders
    SET payment_review_required = TRUE,
        payment_review_reason = v_review_reason
    WHERE id = v_order.id;
  END;

  RETURN jsonb_build_object(
    'updated', TRUE, 'order_id', v_order.id,
    'review_required', v_review_required,
    'review_reason', v_review_reason
  );
END;
$$;

REVOKE ALL ON TABLE public.checkout_attempts FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_begin_checkout_attempt(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_complete_checkout_attempt(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_fail_checkout_attempt(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_begin_webhook_event(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_complete_webhook_event(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_fail_webhook_event(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_update_payment(TEXT, payment_state, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_finalize_viva_payment(TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rpc_begin_checkout_attempt(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_complete_checkout_attempt(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_fail_checkout_attempt(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_begin_webhook_event(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_complete_webhook_event(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_fail_webhook_event(TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_update_payment(TEXT, payment_state, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finalize_viva_payment(TEXT, TEXT, BIGINT, TEXT) TO service_role;

COMMIT;
