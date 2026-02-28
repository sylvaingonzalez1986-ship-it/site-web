BEGIN;

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

  SELECT COALESCE(SUM(COALESCE(bonus_points, 0)), 0)::INTEGER
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

REVOKE ALL ON FUNCTION public.rpc_apply_order_loyalty_bonus(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_apply_order_loyalty_bonus(TEXT) TO service_role;

COMMIT;
