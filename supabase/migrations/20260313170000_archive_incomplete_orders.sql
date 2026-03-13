ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS archived_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_archived_at
  ON public.orders (archived_at)
  WHERE archived_at IS NOT NULL;

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
  UPDATE public.orders
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
  WHERE viva_order_code = p_viva_order_code
    AND archived_at IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN v_rows_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_archive_incomplete_order(
  p_order_id TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_reason TEXT;
BEGIN
  IF p_order_id IS NULL OR btrim(p_order_id) = '' THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_order.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'order_already_archived';
  END IF;

  IF v_order.payment_state IN ('paid', 'not_configured') THEN
    RAISE EXCEPTION 'completed_order_cannot_be_archived';
  END IF;

  IF v_order.status IN ('processing', 'shipped') THEN
    RAISE EXCEPTION 'fulfilled_order_cannot_be_archived';
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');

  PERFORM public.rpc_release_lottery_reward_claims_for_order(p_order_id);

  IF v_order.customer_id IS NOT NULL
     AND v_order.promo_code IS NOT NULL
     AND btrim(v_order.promo_code) <> '' THEN
    UPDATE public.promo_codes
    SET
      used = FALSE,
      used_at = NULL
    WHERE customer_id = v_order.customer_id
      AND upper(code) = upper(v_order.promo_code)
      AND used = TRUE;
  END IF;

  UPDATE public.orders
  SET
    status = 'cancelled',
    payment_state = CASE
      WHEN payment_state = 'pending' THEN 'failed'
      ELSE payment_state
    END,
    archived_at = now(),
    archived_reason = COALESCE(v_reason, archived_reason, 'admin_removed_incomplete')
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_update_payment(BIGINT, payment_state, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_update_payment(BIGINT, payment_state, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_archive_incomplete_order(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_archive_incomplete_order(TEXT, TEXT) TO service_role;
