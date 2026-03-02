BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS loyalty_points_spent INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_loyalty_points_spent_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_loyalty_points_spent_check
  CHECK (loyalty_points_spent >= 0);

CREATE OR REPLACE FUNCTION public.rpc_purchase_lottery_packs_with_points(
  p_user_id UUID,
  p_pack_count INTEGER,
  p_cost_per_pack INTEGER,
  p_base_points INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack_count INTEGER;
  v_cost_per_pack INTEGER;
  v_base_points INTEGER;
  v_bonus_points INTEGER;
  v_spent_points INTEGER;
  v_total_points INTEGER;
  v_spendable_points INTEGER;
  v_total_cost INTEGER;
  v_start_number INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user_id';
  END IF;

  v_pack_count := COALESCE(p_pack_count, 0);
  IF v_pack_count < 1 OR v_pack_count > 50 THEN
    RAISE EXCEPTION 'invalid_pack_count';
  END IF;

  v_cost_per_pack := COALESCE(p_cost_per_pack, 0);
  IF v_cost_per_pack < 1 OR v_cost_per_pack > 100000 THEN
    RAISE EXCEPTION 'invalid_cost_per_pack';
  END IF;

  v_base_points := GREATEST(COALESCE(p_base_points, 0), 0);

  SELECT
    GREATEST(COALESCE(loyalty_points, 0), 0),
    GREATEST(COALESCE(loyalty_points_spent, 0), 0)
  INTO
    v_bonus_points,
    v_spent_points
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_found';
  END IF;

  v_total_points := v_base_points + v_bonus_points;
  v_spendable_points := GREATEST(v_total_points - v_spent_points, 0);
  v_total_cost := v_pack_count * v_cost_per_pack;

  IF v_spendable_points < v_total_cost THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  UPDATE public.profiles
  SET loyalty_points_spent = v_spent_points + v_total_cost
  WHERE id = p_user_id;

  PERFORM pg_advisory_xact_lock(hashtextextended('lottery_ticket_counter', 0));

  INSERT INTO public.lottery_ticket_counter (id, next_number)
  VALUES (1, 1)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.lottery_ticket_counter
  SET next_number = next_number + v_pack_count
  WHERE id = 1
  RETURNING next_number - v_pack_count INTO v_start_number;

  INSERT INTO public.lottery_tickets (
    user_id,
    order_id,
    ticket_number,
    order_amount,
    status
  )
  SELECT
    p_user_id,
    NULL,
    'TICKET-' || lpad((v_start_number + gs)::TEXT, 8, '0'),
    0,
    'available'
  FROM generate_series(0, v_pack_count - 1) AS gs;

  INSERT INTO public.lottery_audit_log (
    event_type,
    user_id,
    details
  )
  VALUES (
    'points_pack_purchase',
    p_user_id,
    jsonb_build_object(
      'pack_count', v_pack_count,
      'cost_per_pack', v_cost_per_pack,
      'total_cost', v_total_cost,
      'base_points', v_base_points,
      'bonus_points', v_bonus_points,
      'spent_points_before', v_spent_points,
      'spent_points_after', v_spent_points + v_total_cost,
      'spendable_points_before', v_spendable_points,
      'spendable_points_after', GREATEST(v_total_points - (v_spent_points + v_total_cost), 0)
    )
  );

  RETURN v_pack_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_purchase_lottery_packs_with_points(UUID, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_purchase_lottery_packs_with_points(UUID, INTEGER, INTEGER, INTEGER) TO service_role;

COMMIT;
