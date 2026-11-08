BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE INDEX IF NOT EXISTS lottery_audit_log_reward_release_order_idx
  ON public.lottery_audit_log (order_id)
  WHERE event_type = 'reward_claim_released';

-- A new name makes a newer webhook fail closed if this migration is absent.
-- Successful callbacks must continue through rpc_finalize_viva_payment, which
-- verifies amount/currency and records inventory review under the same lock.
CREATE OR REPLACE FUNCTION public.rpc_update_viva_payment(
  p_viva_order_code TEXT,
  p_payment_state public.payment_state,
  p_viva_transaction_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF p_viva_order_code IS NULL OR p_viva_order_code !~ '^[0-9]{1,32}$' THEN
    RAISE EXCEPTION 'viva_order_code_invalid';
  END IF;
  IF p_viva_transaction_id IS NULL
     OR p_viva_transaction_id !~* '^[0-9a-f-]{20,64}$' THEN
    RAISE EXCEPTION 'viva_transaction_id_invalid';
  END IF;
  IF p_payment_state IS DISTINCT FROM 'failed'::public.payment_state THEN
    RAISE EXCEPTION 'viva_payment_state_invalid';
  END IF;

  -- Serialize with rpc_finalize_viva_payment before deciding whether this
  -- failed attempt may touch the order or its reward reservations.
  SELECT * INTO v_order
  FROM public.orders
  WHERE viva_order_code = p_viva_order_code AND archived_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- TRUE acknowledges an existing order, including a no-op. Preserve every
  -- field of an already paid order, especially the successful transaction.
  IF v_order.payment_state = 'paid' THEN
    RETURN TRUE;
  END IF;

  UPDATE public.orders
  SET payment_state = 'failed',
      viva_transaction_id = p_viva_transaction_id,
      status = CASE
        WHEN status IN ('new', 'pending_payment') THEN 'pending_payment'::public.order_status
        ELSE status
      END
  WHERE id = v_order.id;

  -- A separate release after this transaction could race with a success.
  -- A release error rolls back both the payment transition and claim changes.
  PERFORM public.rpc_release_lottery_reward_claims_for_order(v_order.id);
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_update_viva_payment(TEXT, public.payment_state, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_update_viva_payment(TEXT, public.payment_state, TEXT)
  TO service_role;

-- Only the webhook used this obsolete API entry point. A stale instance must
-- fail closed during rollout; admin corrections and archival use other paths.
REVOKE ALL ON FUNCTION public.rpc_update_payment(TEXT, public.payment_state, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

-- A failure may legitimately release an unpaid order's reward reservations
-- before a later attempt succeeds. Keep that payment paid, but require review
-- rather than silently granting bonuses or reclaiming somebody else's claim.
CREATE OR REPLACE FUNCTION public.rpc_finalize_viva_payment(
  p_viva_order_code TEXT,
  p_viva_transaction_id TEXT,
  p_amount_minor BIGINT,
  p_currency_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_review_required BOOLEAN;
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

  v_review_required := v_order.payment_review_required;
  v_review_reason := v_order.payment_review_reason;
  -- Read durable release evidence only after acquiring the shared order lock.
  IF EXISTS (
    SELECT 1 FROM public.lottery_audit_log AS audit
    WHERE audit.order_id = v_order.id AND audit.event_type = 'reward_claim_released'
      AND CASE WHEN jsonb_typeof(audit.details->'claims_count') = 'number'
        THEN (audit.details->>'claims_count')::NUMERIC > 0 ELSE FALSE END
  ) THEN
    v_review_required := TRUE;
    IF strpos(COALESCE(v_review_reason, ''), 'reward_claim_released_before_payment') = 0 THEN
      v_review_reason := concat_ws('; ', NULLIF(v_review_reason, ''), 'reward_claim_released_before_payment');
    END IF;
  END IF;

  IF v_order.payment_state = 'paid' THEN
    IF v_order.viva_transaction_id IS DISTINCT FROM p_viva_transaction_id THEN
      RAISE EXCEPTION 'payment_transaction_mismatch';
    END IF;
    UPDATE public.orders
    SET payment_review_required = v_review_required, payment_review_reason = v_review_reason
    WHERE id = v_order.id AND (
      payment_review_required IS DISTINCT FROM v_review_required
      OR payment_review_reason IS DISTINCT FROM v_review_reason
    );
    RETURN jsonb_build_object(
      'updated', FALSE, 'reason', 'already_paid', 'order_id', v_order.id,
      'review_required', v_review_required, 'review_reason', v_review_reason
    );
  END IF;

  UPDATE public.orders
  SET payment_state = 'paid',
      viva_transaction_id = p_viva_transaction_id,
      status = CASE WHEN status = 'cancelled' THEN status ELSE 'paid'::public.order_status END,
      payment_review_required = v_review_required,
      payment_review_reason = v_review_reason
  WHERE id = v_order.id;

  UPDATE public.checkout_attempts
  SET state = 'completed', updated_at = now()
  WHERE order_id = v_order.id;

  BEGIN
    PERFORM public.rpc_apply_order_inventory(v_order.id);
  EXCEPTION WHEN OTHERS THEN
    v_review_required := TRUE;
    v_review_reason := concat_ws('; ', NULLIF(v_review_reason, ''), left(SQLERRM, 1000));
    UPDATE public.orders
    SET payment_review_required = TRUE, payment_review_reason = v_review_reason
    WHERE id = v_order.id;
  END;

  RETURN jsonb_build_object(
    'updated', TRUE, 'order_id', v_order.id,
    'review_required', v_review_required, 'review_reason', v_review_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_finalize_viva_payment(TEXT, TEXT, BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finalize_viva_payment(TEXT, TEXT, BIGINT, TEXT)
  TO service_role;

COMMIT;
