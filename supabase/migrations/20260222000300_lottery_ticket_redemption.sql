BEGIN;

ALTER TABLE lottery_tickets
ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ;

ALTER TABLE lottery_tickets
ADD COLUMN IF NOT EXISTS redeemed_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_lottery_tickets_user_redeemed
  ON lottery_tickets(user_id, redeemed_at);

CREATE OR REPLACE FUNCTION public.rpc_redeem_lottery_ticket(
  p_ticket_id UUID,
  p_user_id UUID,
  p_order_id TEXT,
  p_reward_label TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket lottery_tickets%ROWTYPE;
BEGIN
  IF p_ticket_id IS NULL OR p_user_id IS NULL OR p_order_id IS NULL OR btrim(p_order_id) = '' THEN
    RAISE EXCEPTION 'invalid_redeem_payload';
  END IF;

  SELECT *
  INTO v_ticket
  FROM lottery_tickets
  WHERE id = p_ticket_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket_not_found';
  END IF;

  IF v_ticket.status <> 'scratched' OR v_ticket.is_win IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'ticket_not_winning_or_not_scratched';
  END IF;

  IF v_ticket.redeemed_at IS NOT NULL THEN
    RAISE EXCEPTION 'ticket_already_redeemed';
  END IF;

  UPDATE lottery_tickets
  SET
    redeemed_at = now(),
    redeemed_order_id = p_order_id
  WHERE id = v_ticket.id;

  INSERT INTO lottery_audit_log (
    event_type,
    user_id,
    ticket_id,
    order_id,
    details
  )
  VALUES (
    'redeem',
    p_user_id,
    v_ticket.id,
    p_order_id,
    jsonb_build_object(
      'reward_label', LEFT(COALESCE(p_reward_label, ''), 240)
    )
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_redeem_lottery_ticket(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_redeem_lottery_ticket(UUID, UUID, TEXT, TEXT) TO service_role;

COMMIT;
