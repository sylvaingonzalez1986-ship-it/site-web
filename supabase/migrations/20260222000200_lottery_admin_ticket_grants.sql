BEGIN;

ALTER TABLE lottery_tickets
ALTER COLUMN order_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.rpc_admin_grant_lottery_tickets(
  p_user_id UUID,
  p_ticket_count INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_admin_email TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_count INTEGER;
  v_start_number INTEGER;
  v_reason TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user_id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'customer_not_found';
  END IF;

  v_ticket_count := COALESCE(p_ticket_count, 0);
  IF v_ticket_count < 1 OR v_ticket_count > 200 THEN
    RAISE EXCEPTION 'invalid_ticket_count';
  END IF;

  v_reason := LEFT(COALESCE(NULLIF(BTRIM(p_reason), ''), 'Attribution manuelle admin'), 300);

  PERFORM pg_advisory_xact_lock(hashtextextended('lottery_ticket_counter', 0));

  INSERT INTO lottery_ticket_counter (id, next_number)
  VALUES (1, 1)
  ON CONFLICT (id) DO NOTHING;

  UPDATE lottery_ticket_counter
  SET next_number = next_number + v_ticket_count
  WHERE id = 1
  RETURNING next_number - v_ticket_count INTO v_start_number;

  INSERT INTO lottery_tickets (
    user_id,
    order_id,
    ticket_number,
    order_amount,
    status
  )
  SELECT
    p_user_id,
    NULL,
    'TICKET-' || lpad((v_start_number + gs)::text, 8, '0'),
    0,
    'available'
  FROM generate_series(0, v_ticket_count - 1) AS gs;

  INSERT INTO lottery_audit_log (
    event_type,
    user_id,
    details
  )
  VALUES (
    'admin_grant',
    p_user_id,
    jsonb_build_object(
      'ticket_count', v_ticket_count,
      'reason', v_reason,
      'admin_email', LEFT(COALESCE(BTRIM(p_admin_email), ''), 200)
    )
  );

  RETURN v_ticket_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_grant_lottery_tickets(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_admin_grant_lottery_tickets(UUID, INTEGER, TEXT, TEXT) TO service_role;

COMMIT;
