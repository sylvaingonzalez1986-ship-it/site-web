BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.rpc_begin_checkout_attempt(
  p_attempt_id UUID,
  p_customer_id UUID,
  p_cart_fingerprint TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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
        (ca.state = 'creating' AND ca.updated_at > now() - interval '2 minutes' AND o.archived_at IS NULL)
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

  -- An archived order still owns its unique checkout_attempt_id.
  IF EXISTS (SELECT 1 FROM public.orders
    WHERE id = v_attempt.order_id AND archived_at IS NOT NULL) THEN
    RETURN jsonb_build_object('action', 'restart');
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

REVOKE ALL ON FUNCTION public.rpc_begin_checkout_attempt(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_begin_checkout_attempt(UUID, UUID, TEXT) TO service_role;

COMMIT;
