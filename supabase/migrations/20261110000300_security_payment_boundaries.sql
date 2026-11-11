BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Canonical SKU checks also apply to historical orders and all payment paths.
CREATE OR REPLACE FUNCTION public.rpc_apply_order_inventory(p_order_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  purchase public.orders%ROWTYPE;
  item RECORD;
  product public.products%ROWTYPE;
  base_id TEXT; variant_id TEXT; option JSONB; option_index INTEGER;
  remaining INTEGER; processed INTEGER := 0;
BEGIN
  SELECT * INTO purchase FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF purchase.payment_state NOT IN ('paid', 'not_configured') THEN RAISE EXCEPTION 'order_not_paid'; END IF;
  IF purchase.stock_applied_at IS NOT NULL THEN
    RETURN jsonb_build_object('applied', FALSE, 'reason', 'already_applied');
  END IF;

  -- Stable product order avoids opposite-cart lock ordering. The order row is
  -- the single inventory idempotency lock, also held by payment transitions.
  FOR item IN SELECT product_id, quantity, unit_price FROM public.order_items
    WHERE order_id = p_order_id ORDER BY split_part(product_id, '::', 1), product_id, id
  LOOP
    IF item.quantity IS NULL OR item.quantity <= 0 THEN RAISE EXCEPTION 'inventory_invalid_quantity'; END IF;
    base_id := split_part(item.product_id, '::', 1);
    variant_id := NULLIF(split_part(item.product_id, '::', 2), '');
    SELECT * INTO product FROM public.products WHERE id = base_id FOR UPDATE;
    IF NOT FOUND THEN
      -- Checkout creates this zero-price line for a separately reserved gift.
      IF item.product_id ~ '^gift-reward-[0-9a-f-]{36}$' AND item.quantity = 1 AND item.unit_price = 0 THEN CONTINUE; END IF;
      RAISE EXCEPTION 'inventory_product_missing:%', base_id;
    END IF;
    IF jsonb_typeof(product.variant_options) = 'array' AND jsonb_array_length(product.variant_options) > 0 THEN
      IF variant_id IS NULL THEN RAISE EXCEPTION 'inventory_variant_required:%', base_id; END IF;
      SELECT elem, ordinality::INTEGER - 1 INTO option, option_index
      FROM jsonb_array_elements(product.variant_options) WITH ORDINALITY AS variants(elem, ordinality)
      WHERE elem->>'id' = variant_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'inventory_variant_invalid:%:%', base_id, variant_id; END IF;
      IF option->>'enabled' = 'false' OR option->>'inStock' = 'false' THEN
        RAISE EXCEPTION 'inventory_variant_unavailable:%:%', base_id, variant_id;
      END IF;
      IF option->'stockQuantity' IS NOT NULL AND option->'stockQuantity' <> 'null'::JSONB THEN
        IF option->>'stockQuantity' !~ '^[0-9]+$' THEN RAISE EXCEPTION 'inventory_variant_stock_invalid'; END IF;
        remaining := (option->>'stockQuantity')::INTEGER - item.quantity;
        IF remaining < 0 THEN RAISE EXCEPTION 'inventory_insufficient_variant:%:%', base_id, variant_id; END IF;
        option := jsonb_set(jsonb_set(option, '{stockQuantity}', to_jsonb(remaining), TRUE), '{inStock}', to_jsonb(remaining > 0), TRUE);
        UPDATE public.products SET variant_options = jsonb_set(variant_options, ARRAY[option_index::TEXT], option, FALSE)
          WHERE id = base_id;
        processed := processed + 1;
        CONTINUE;
      END IF;
    ELSIF variant_id IS NOT NULL THEN
      RAISE EXCEPTION 'inventory_variant_invalid:%:%', base_id, variant_id;
    END IF;
    IF product.track_stock THEN
      remaining := COALESCE(product.stock_quantity, 0) - item.quantity;
      IF remaining < 0 THEN RAISE EXCEPTION 'inventory_insufficient_product:%', base_id; END IF;
      UPDATE public.products SET stock_quantity = remaining WHERE id = base_id;
      processed := processed + 1;
    END IF;
  END LOOP;
  UPDATE public.orders SET stock_applied_at = now() WHERE id = p_order_id;
  RETURN jsonb_build_object('applied', TRUE, 'processed_items', processed);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_apply_order_inventory(TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_apply_order_inventory(TEXT) TO service_role;

-- All manual status/payment/tracking changes share the payment row lock. A
-- rejected manual transition rolls back everything, including deferred rewards.
CREATE OR REPLACE FUNCTION public.rpc_admin_update_order(p_order_id TEXT, p_patch JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  purchase public.orders%ROWTYPE;
  next_payment public.payment_state; next_status public.order_status;
  review BOOLEAN; reason TEXT;
BEGIN
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object'
    OR p_patch = '{}'::JSONB
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) AS fields(key)
      WHERE key NOT IN ('status', 'payment_state', 'tracking_number')) THEN
    RAISE EXCEPTION 'order_transition_invalid_patch';
  END IF;
  IF (p_patch ? 'status' AND (jsonb_typeof(p_patch->'status') <> 'string'
      OR p_patch->>'status' NOT IN ('new','pending_payment','paid','processing','shipped','cancelled')))
    OR (p_patch ? 'payment_state' AND (jsonb_typeof(p_patch->'payment_state') <> 'string'
      OR p_patch->>'payment_state' NOT IN ('pending','paid','failed')))
    OR (p_patch ? 'tracking_number' AND (jsonb_typeof(p_patch->'tracking_number') NOT IN ('null','string')
      OR length(p_patch->>'tracking_number') > 200)) THEN
    RAISE EXCEPTION 'order_transition_invalid_patch';
  END IF;
  SELECT * INTO purchase FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF purchase.archived_at IS NOT NULL THEN RAISE EXCEPTION 'order_transition_archived'; END IF;
  next_payment := COALESCE((p_patch->>'payment_state')::public.payment_state, purchase.payment_state);
  next_status := COALESCE((p_patch->>'status')::public.order_status, purchase.status);
  review := purchase.payment_review_required;
  reason := purchase.payment_review_reason;

  IF purchase.payment_state IN ('paid','not_configured') AND next_payment NOT IN ('paid','not_configured') THEN
    RAISE EXCEPTION 'order_transition_payment_regression';
  END IF;
  -- Cancellation of a pending provider session uses the archive operation after
  -- Viva confirmation. A paid cancellation/refund requires explicit reconciliation.
  IF next_status = 'cancelled' AND purchase.status <> 'cancelled' THEN
    RAISE EXCEPTION 'order_transition_use_cancellation';
  END IF;
  IF purchase.status = 'cancelled' AND next_status <> 'cancelled' THEN RAISE EXCEPTION 'order_transition_cancelled'; END IF;
  IF (purchase.status = 'shipped' AND next_status <> 'shipped')
    OR (purchase.status = 'processing' AND next_status NOT IN ('processing','shipped'))
    OR (purchase.status = 'paid' AND next_status IN ('new','pending_payment')) THEN
    RAISE EXCEPTION 'order_transition_status_regression';
  END IF;
  IF NOT (p_patch ? 'status') AND next_payment = 'paid' AND next_status IN ('new','pending_payment') THEN next_status := 'paid'; END IF;
  IF next_payment = 'paid' AND next_status IN ('new','pending_payment') THEN RAISE EXCEPTION 'order_transition_status_regression'; END IF;
  IF next_status IN ('paid','processing','shipped') AND next_payment <> 'paid' THEN
    RAISE EXCEPTION 'order_transition_unpaid_fulfillment';
  END IF;
  IF next_payment = 'paid' AND EXISTS(
    SELECT 1 FROM public.lottery_audit_log audit WHERE audit.order_id = p_order_id AND audit.event_type = 'reward_claim_released'
      AND CASE WHEN jsonb_typeof(audit.details->'claims_count') = 'number' THEN (audit.details->>'claims_count')::NUMERIC > 0 ELSE FALSE END
  ) THEN
    review := TRUE;
    IF strpos(COALESCE(reason,''),'reward_claim_released_before_payment') = 0 THEN
      reason := concat_ws('; ', NULLIF(reason,''), 'reward_claim_released_before_payment');
    END IF;
  END IF;
  IF next_payment = 'paid' AND next_status = 'cancelled' THEN
    review := TRUE;
    IF strpos(COALESCE(reason,''),'payment_after_cancellation') = 0 THEN
      reason := concat_ws('; ', NULLIF(reason,''), 'payment_after_cancellation');
    END IF;
  END IF;
  IF next_status IN ('processing','shipped') AND (review OR purchase.status = 'cancelled') THEN
    RAISE EXCEPTION 'order_transition_review_required';
  END IF;

  UPDATE public.orders SET payment_state = next_payment, status = next_status,
    -- A failed-attempt ID is not evidence for a manually recorded payment.
    viva_transaction_id = CASE WHEN next_payment = 'paid' AND purchase.payment_state <> 'paid' THEN NULL ELSE viva_transaction_id END,
    payment_review_required = review, payment_review_reason = reason,
    tracking_number = CASE WHEN p_patch ? 'tracking_number' THEN NULLIF(btrim(p_patch->>'tracking_number'),'') ELSE tracking_number END
  WHERE id = p_order_id;
  IF next_payment = 'paid' AND purchase.status <> 'cancelled' THEN
    PERFORM public.rpc_apply_order_inventory(p_order_id);
    IF NOT review THEN PERFORM public.rpc_consume_lottery_reward_claims_for_order(p_order_id); END IF;
    UPDATE public.checkout_attempts SET state = 'completed', updated_at = now() WHERE order_id = p_order_id;
  ELSIF next_payment = 'failed' THEN
    PERFORM public.rpc_release_lottery_reward_claims_for_order(p_order_id);
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_admin_update_order(TEXT, JSONB) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_admin_update_order(TEXT, JSONB) TO service_role;

-- Close resumable local attempts when an unpaid order is archived. Provider
-- cancellation happens before this RPC; the shared row lock rechecks late success.
CREATE OR REPLACE FUNCTION public.rpc_archive_incomplete_order(p_order_id TEXT, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE purchase public.orders%ROWTYPE;
BEGIN
  SELECT * INTO purchase FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF purchase.archived_at IS NOT NULL THEN RAISE EXCEPTION 'order_already_archived'; END IF;
  IF purchase.payment_state IN ('paid','not_configured') THEN RAISE EXCEPTION 'completed_order_cannot_be_archived'; END IF;
  IF purchase.status IN ('processing','shipped') THEN RAISE EXCEPTION 'fulfilled_order_cannot_be_archived'; END IF;
  PERFORM public.rpc_release_lottery_reward_claims_for_order(p_order_id);
  IF purchase.customer_id IS NOT NULL AND NULLIF(btrim(purchase.promo_code),'') IS NOT NULL THEN
    UPDATE public.promo_codes SET used = FALSE, used_at = NULL
      WHERE customer_id = purchase.customer_id AND upper(code) = upper(purchase.promo_code) AND used;
  END IF;
  UPDATE public.orders SET status = 'cancelled',
    payment_state = CASE WHEN payment_state = 'pending' THEN 'failed'::public.payment_state ELSE payment_state END,
    archived_at = now(), archived_reason = COALESCE(NULLIF(btrim(p_reason),''), archived_reason, 'admin_removed_incomplete')
  WHERE id = p_order_id;
  UPDATE public.checkout_attempts SET state = 'failed', updated_at = now(), last_error = 'order_archived' WHERE order_id = p_order_id;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_archive_incomplete_order(TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_archive_incomplete_order(TEXT, TEXT) TO service_role;

-- Checkout initialization may report an error after a verified capture raced
-- ahead of its response. Never downgrade the durable completed attempt.
CREATE OR REPLACE FUNCTION public.rpc_fail_checkout_attempt(p_attempt_id UUID, p_customer_id UUID, p_error TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.checkout_attempts SET state = 'failed', last_error = left(NULLIF(btrim(p_error),''),500), updated_at = now()
    WHERE attempt_id = p_attempt_id AND customer_id = p_customer_id AND state <> 'completed';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_fail_checkout_attempt(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_fail_checkout_attempt(UUID, UUID, TEXT) TO service_role;

-- Failures for an archived session are acknowledged no-ops, including after a
-- late capture. Never downgrade paid or release claims after that order lock.
CREATE OR REPLACE FUNCTION public.rpc_update_viva_payment(
  p_viva_order_code TEXT, p_payment_state public.payment_state, p_viva_transaction_id TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE purchase public.orders%ROWTYPE;
BEGIN
  IF p_viva_order_code IS NULL OR p_viva_order_code !~ '^[0-9]{1,32}$' THEN RAISE EXCEPTION 'viva_order_code_invalid'; END IF;
  IF p_viva_transaction_id IS NULL OR p_viva_transaction_id !~* '^[0-9a-f-]{20,64}$' THEN RAISE EXCEPTION 'viva_transaction_id_invalid'; END IF;
  IF p_payment_state IS DISTINCT FROM 'failed'::public.payment_state THEN RAISE EXCEPTION 'viva_payment_state_invalid'; END IF;
  SELECT * INTO purchase FROM public.orders WHERE viva_order_code = p_viva_order_code FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF purchase.payment_state = 'paid' OR purchase.archived_at IS NOT NULL THEN RETURN TRUE; END IF;
  UPDATE public.orders SET payment_state = 'failed', viva_transaction_id = p_viva_transaction_id,
    status = CASE WHEN status IN ('new','pending_payment') THEN 'pending_payment'::public.order_status ELSE status END
    WHERE id = purchase.id;
  PERFORM public.rpc_release_lottery_reward_claims_for_order(purchase.id);
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_update_viva_payment(TEXT, public.payment_state, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_update_viva_payment(TEXT, public.payment_state, TEXT) TO service_role;

-- A verified capture is recorded even when cancellation/archival won the local
-- race. Staff queries include archived captures under review; retain archival
-- so a released first-order discount is not reserved twice. Withhold fulfillment
-- and rewards until a human reconciles/refunds the captured payment.
CREATE OR REPLACE FUNCTION public.rpc_finalize_viva_payment(
  p_viva_order_code TEXT, p_viva_transaction_id TEXT, p_amount_minor BIGINT, p_currency_code TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE purchase public.orders%ROWTYPE; review BOOLEAN; reason TEXT; cancelled BOOLEAN;
BEGIN
  IF p_viva_order_code IS NULL OR p_viva_order_code !~ '^[0-9]{1,32}$' THEN RAISE EXCEPTION 'viva_order_code_invalid'; END IF;
  IF p_viva_transaction_id IS NULL OR p_viva_transaction_id !~* '^[0-9a-f-]{20,64}$' THEN RAISE EXCEPTION 'viva_transaction_id_invalid'; END IF;
  SELECT * INTO purchase FROM public.orders WHERE viva_order_code = p_viva_order_code FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('updated', FALSE, 'reason', 'order_not_found'); END IF;
  IF p_currency_code IS DISTINCT FROM '978' THEN RAISE EXCEPTION 'payment_currency_mismatch'; END IF;
  IF p_amount_minor IS NULL OR round(purchase.total_amount * 100)::BIGINT IS DISTINCT FROM p_amount_minor THEN RAISE EXCEPTION 'payment_amount_mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM public.orders WHERE viva_transaction_id = p_viva_transaction_id AND id <> purchase.id) THEN RAISE EXCEPTION 'payment_transaction_already_used'; END IF;
  review := purchase.payment_review_required;
  reason := purchase.payment_review_reason;
  cancelled := purchase.archived_at IS NOT NULL OR purchase.status = 'cancelled';
  IF cancelled THEN
    review := TRUE;
    IF strpos(COALESCE(reason,''),'payment_after_cancellation') = 0 THEN
      reason := concat_ws('; ', NULLIF(reason,''), 'payment_after_cancellation');
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM public.lottery_audit_log audit
    WHERE audit.order_id = purchase.id AND audit.event_type = 'reward_claim_released'
      AND CASE WHEN jsonb_typeof(audit.details->'claims_count') = 'number' THEN (audit.details->>'claims_count')::NUMERIC > 0 ELSE FALSE END
  ) THEN
    review := TRUE;
    IF strpos(COALESCE(reason,''),'reward_claim_released_before_payment') = 0 THEN
      reason := concat_ws('; ', NULLIF(reason,''), 'reward_claim_released_before_payment');
    END IF;
  END IF;
  IF purchase.payment_state = 'paid' AND purchase.viva_transaction_id IS NOT NULL
    AND purchase.viva_transaction_id IS DISTINCT FROM p_viva_transaction_id THEN
    RAISE EXCEPTION 'payment_transaction_mismatch';
  END IF;

  UPDATE public.orders SET payment_state = 'paid', viva_transaction_id = p_viva_transaction_id,
    status = CASE WHEN cancelled THEN 'cancelled'::public.order_status
      WHEN status IN ('new','pending_payment') THEN 'paid'::public.order_status ELSE status END,
    payment_review_required = review, payment_review_reason = reason
  WHERE id = purchase.id AND (payment_state <> 'paid' OR viva_transaction_id IS DISTINCT FROM p_viva_transaction_id
    OR payment_review_required IS DISTINCT FROM review OR payment_review_reason IS DISTINCT FROM reason);
  UPDATE public.checkout_attempts SET state = 'completed', updated_at = now()
    WHERE order_id = purchase.id AND state IS DISTINCT FROM 'completed';

  -- Preserve previous review decisions and inventory idempotency on replays.
  IF purchase.payment_state <> 'paid' AND NOT cancelled THEN
    BEGIN
      PERFORM public.rpc_apply_order_inventory(purchase.id);
    EXCEPTION WHEN OTHERS THEN
      review := TRUE;
      reason := concat_ws('; ', NULLIF(reason,''), left(SQLERRM,1000));
      UPDATE public.orders SET payment_review_required = TRUE, payment_review_reason = reason WHERE id = purchase.id;
    END;
  END IF;
  RETURN jsonb_build_object('updated', purchase.payment_state <> 'paid',
    'reason', CASE WHEN purchase.payment_state = 'paid' THEN 'already_paid' ELSE NULL END,
    'order_id', purchase.id, 'review_required', review, 'review_reason', reason);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_finalize_viva_payment(TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finalize_viva_payment(TEXT, TEXT, BIGINT, TEXT) TO service_role;
COMMIT;
