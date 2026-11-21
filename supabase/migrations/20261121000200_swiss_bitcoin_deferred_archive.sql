BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.orders ADD COLUMN swiss_bitcoin_archive_requested_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.guard_swiss_bitcoin_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.payment_provider <> 'swiss_bitcoin_pay' AND OLD.swiss_bitcoin_card_started_at IS NULL THEN RETURN NEW; END IF;
  IF OLD.swiss_bitcoin_archive_requested_at IS NOT NULL AND OLD.swiss_bitcoin_card_started_at IS NULL
    AND NEW.swiss_bitcoin_card_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'order_transition_bitcoin_archive_requested';
  END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at AND NEW.archived_at IS NOT NULL THEN
    IF OLD.payment_review_required
      OR (OLD.swiss_bitcoin_card_started_at IS NOT NULL AND OLD.viva_order_code IS NULL)
      OR EXISTS (SELECT 1 FROM public.swiss_bitcoin_payment_attempts WHERE order_id = OLD.id
        AND state NOT IN ('failed','expired')) THEN
      RAISE EXCEPTION 'order_transition_bitcoin_open';
    END IF;
  ELSIF NEW.payment_state IS DISTINCT FROM OLD.payment_state THEN
    IF (OLD.payment_provider = 'swiss_bitcoin_pay' AND (NEW.payment_state <> 'paid'
        OR NOT EXISTS (SELECT 1 FROM public.swiss_bitcoin_payment_attempts WHERE order_id = OLD.id AND state = 'paid')))
      OR (NEW.payment_state = 'paid' AND OLD.payment_provider = 'viva' AND NEW.viva_transaction_id IS NULL) THEN
      RAISE EXCEPTION 'order_transition_bitcoin_verification_required';
    END IF;
    IF NEW.payment_state = 'paid' THEN NEW.swiss_bitcoin_archive_requested_at := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_swiss_bitcoin_order() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER guard_swiss_bitcoin_order ON public.orders;
CREATE TRIGGER guard_swiss_bitcoin_order
  BEFORE UPDATE OF payment_state, archived_at, swiss_bitcoin_card_started_at ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_swiss_bitcoin_order();

CREATE OR REPLACE FUNCTION public.guard_swiss_bitcoin_attempt_after_archive_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE requested_at TIMESTAMPTZ;
BEGIN
  SELECT swiss_bitcoin_archive_requested_at INTO requested_at
  FROM public.orders WHERE id = NEW.order_id FOR UPDATE;
  IF requested_at IS NOT NULL THEN RAISE EXCEPTION 'order_transition_bitcoin_archive_requested'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_swiss_bitcoin_attempt_after_archive_request() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER guard_swiss_bitcoin_attempt_after_archive_request
  BEFORE INSERT ON public.swiss_bitcoin_payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.guard_swiss_bitcoin_attempt_after_archive_request();

CREATE OR REPLACE FUNCTION public.rpc_request_swiss_bitcoin_archive(p_order_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE purchase public.orders%ROWTYPE;
BEGIN
  SELECT * INTO purchase FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR purchase.payment_provider <> 'swiss_bitcoin_pay'
    OR purchase.payment_state NOT IN ('pending','failed') OR purchase.status IN ('paid','processing','shipped')
    OR purchase.archived_at IS NOT NULL OR purchase.payment_review_required
    OR purchase.swiss_bitcoin_card_started_at IS NOT NULL OR purchase.viva_order_code IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.swiss_bitcoin_payment_attempts WHERE order_id = p_order_id
      AND state IN ('paid','review')) THEN
    RETURN jsonb_build_object('action', 'blocked');
  END IF;

  IF EXISTS (SELECT 1 FROM public.swiss_bitcoin_payment_attempts WHERE order_id = p_order_id
    AND state IN ('creating','unknown','pending','confirming')) THEN
    UPDATE public.orders SET swiss_bitcoin_archive_requested_at = now()
      WHERE id = p_order_id AND swiss_bitcoin_archive_requested_at IS NULL;
    RETURN jsonb_build_object('action', 'scheduled');
  END IF;

  PERFORM public.rpc_archive_incomplete_order(p_order_id, 'admin_removed_incomplete');
  RETURN jsonb_build_object('action', 'archived');
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_request_swiss_bitcoin_archive(TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_request_swiss_bitcoin_archive(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_archive_idle_swiss_bitcoin_orders(p_limit INTEGER)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE candidate RECORD; archived INTEGER := 0;
BEGIN
  FOR candidate IN
    SELECT o.id, o.swiss_bitcoin_archive_requested_at FROM public.orders o
    WHERE o.payment_provider = 'swiss_bitcoin_pay' AND o.archived_at IS NULL AND NOT o.payment_review_required
      AND o.swiss_bitcoin_card_started_at IS NULL AND o.viva_order_code IS NULL
      AND (
        (o.swiss_bitcoin_archive_requested_at IS NOT NULL AND o.payment_state IN ('pending','failed')
          AND o.status NOT IN ('paid','processing','shipped'))
        OR (o.created_at <= now() - interval '60 minutes' AND o.status = 'pending_payment' AND o.payment_state = 'pending')
      )
      AND NOT EXISTS (SELECT 1 FROM public.swiss_bitcoin_payment_attempts a WHERE a.order_id = o.id
        AND a.state NOT IN ('expired','failed'))
    ORDER BY o.swiss_bitcoin_archive_requested_at NULLS LAST, o.created_at, o.id
    LIMIT least(greatest(COALESCE(p_limit, 25), 1), 100) FOR UPDATE OF o SKIP LOCKED
  LOOP
    PERFORM public.rpc_archive_incomplete_order(candidate.id,
      CASE WHEN candidate.swiss_bitcoin_archive_requested_at IS NULL THEN 'bitcoin_checkout_expired'
        ELSE 'admin_removed_incomplete' END);
    archived := archived + 1;
  END LOOP;
  RETURN archived;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_archive_idle_swiss_bitcoin_orders(INTEGER) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_archive_idle_swiss_bitcoin_orders(INTEGER) TO service_role;

COMMIT;
