BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.orders
  ADD COLUMN swiss_bitcoin_card_started_at TIMESTAMPTZ,
  ADD COLUMN swiss_bitcoin_reward_claim_id UUID;

CREATE TABLE public.swiss_bitcoin_payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES public.orders(id),
  invoice_id UUID UNIQUE,
  expected_eur_minor BIGINT NOT NULL CHECK (expected_eur_minor > 0),
  state TEXT NOT NULL DEFAULT 'creating'
    CHECK (state IN ('creating','unknown','pending','confirming','expired','failed','paid','review')),
  checkout_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  paid_sats BIGINT CHECK (paid_sats > 0),
  payment_reference TEXT,
  issue TEXT,
  effects_pending BOOLEAN NOT NULL DEFAULT FALSE,
  provider_status TEXT
);
ALTER TABLE public.swiss_bitcoin_payment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.swiss_bitcoin_payment_attempts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.swiss_bitcoin_payment_attempts TO service_role;

CREATE INDEX swiss_bitcoin_attempt_order ON public.swiss_bitcoin_payment_attempts(order_id, created_at DESC);
CREATE INDEX swiss_bitcoin_attempt_due ON public.swiss_bitcoin_payment_attempts(next_check_at)
  WHERE next_check_at IS NOT NULL;
CREATE UNIQUE INDEX swiss_bitcoin_one_open_attempt ON public.swiss_bitcoin_payment_attempts(order_id)
  WHERE state IN ('creating','unknown','pending','confirming');

-- Commit the order, the discounts/claim and the link to the shared checkout
-- before issuing a Lightning invoice. A replay never consumes them again.
CREATE OR REPLACE FUNCTION public.rpc_create_swiss_bitcoin_order(
  p_order JSONB, p_items JSONB, p_promo JSONB, p_attempt_id UUID, p_reward_claim_id UUID
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE attempt public.checkout_attempts%ROWTYPE; created_id TEXT; owner_id UUID;
BEGIN
  owner_id := (p_order->>'customer_id')::UUID;
  SELECT * INTO attempt FROM public.checkout_attempts WHERE attempt_id = p_attempt_id FOR UPDATE;
  IF NOT FOUND OR owner_id IS NULL OR attempt.customer_id <> owner_id THEN
    RAISE EXCEPTION 'checkout_attempt_invalid';
  END IF;
  IF attempt.state = 'ready' AND attempt.checkout_url = '/checkout/bitcoin/' || attempt.order_id THEN
    RETURN attempt.order_id;
  END IF;
  IF attempt.state <> 'creating' OR COALESCE((p_order->>'total_amount')::NUMERIC, 0) <= 0 THEN
    RAISE EXCEPTION 'checkout_attempt_invalid';
  END IF;
  created_id := public.rpc_create_order(p_order || jsonb_build_object(
    'payment_provider', 'swiss_bitcoin_pay', 'payment_state', 'pending', 'status', 'pending_payment',
    'created_at', now(), 'viva_order_code', NULL, 'viva_transaction_id', NULL
  ), p_items, p_promo);
  UPDATE public.orders SET checkout_attempt_id = p_attempt_id, swiss_bitcoin_reward_claim_id = p_reward_claim_id
    WHERE id = created_id;
  IF p_reward_claim_id IS NOT NULL THEN
    PERFORM public.rpc_reserve_lottery_reward_claim(
      p_claim_id => p_reward_claim_id, p_user_id => owner_id, p_order_id => created_id, p_reservation_minutes => 120
    );
  END IF;
  UPDATE public.checkout_attempts SET state = 'ready', order_id = created_id, viva_order_code = NULL,
    checkout_url = '/checkout/bitcoin/' || created_id, updated_at = now(), last_error = NULL
  WHERE attempt_id = p_attempt_id;
  RETURN created_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_create_swiss_bitcoin_order(JSONB, JSONB, JSONB, UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_create_swiss_bitcoin_order(JSONB, JSONB, JSONB, UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_begin_swiss_bitcoin_payment(p_order_id TEXT, p_retry BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE purchase public.orders%ROWTYPE; attempt public.swiss_bitcoin_payment_attempts%ROWTYPE;
BEGIN
  SELECT * INTO purchase FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR purchase.payment_provider <> 'swiss_bitcoin_pay' OR purchase.payment_state <> 'pending'
    OR purchase.status <> 'pending_payment' OR purchase.archived_at IS NOT NULL OR purchase.payment_review_required
    OR purchase.swiss_bitcoin_card_started_at IS NOT NULL OR purchase.viva_order_code IS NOT NULL
    OR purchase.created_at <= now() - interval '60 minutes' THEN
    RETURN jsonb_build_object('action', 'blocked');
  END IF;
  SELECT * INTO attempt FROM public.swiss_bitcoin_payment_attempts
    WHERE order_id = p_order_id ORDER BY created_at DESC, id DESC LIMIT 1;
  IF FOUND AND (NOT p_retry OR attempt.state NOT IN ('expired','failed')) THEN
    RETURN jsonb_build_object('action', 'existing', 'attempt_id', attempt.id);
  END IF;
  INSERT INTO public.swiss_bitcoin_payment_attempts(order_id, expected_eur_minor, next_check_at)
    VALUES (p_order_id, round(purchase.total_amount * 100)::BIGINT, now() + interval '1 minute')
    RETURNING * INTO attempt;
  RETURN jsonb_build_object('action', 'create', 'attempt_id', attempt.id, 'expected_eur_minor', attempt.expected_eur_minor);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_begin_swiss_bitcoin_payment(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_begin_swiss_bitcoin_payment(TEXT, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_attach_swiss_bitcoin_invoice(p_attempt_id UUID, p_invoice_id UUID, p_checkout_url TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.swiss_bitcoin_payment_attempts
    SET invoice_id = p_invoice_id,
      checkout_url = COALESCE(checkout_url, p_checkout_url),
      state = CASE WHEN state IN ('creating','unknown') THEN 'pending' ELSE state END,
      issue = CASE WHEN state IN ('creating','unknown') THEN NULL ELSE issue END,
      next_check_at = CASE WHEN state IN ('creating','unknown') THEN now() ELSE next_check_at END
  WHERE id = p_attempt_id AND p_invoice_id IS NOT NULL
    AND (invoice_id = p_invoice_id OR (invoice_id IS NULL AND state IN ('creating','unknown')));
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_attach_swiss_bitcoin_invoice(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_attach_swiss_bitcoin_invoice(UUID, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_note_swiss_bitcoin_creation(p_attempt_id UUID, p_definitive BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.swiss_bitcoin_payment_attempts
    SET state = CASE WHEN p_definitive THEN 'failed' ELSE 'unknown' END,
      issue = CASE WHEN p_definitive THEN 'creation_refused' ELSE 'creation_unconfirmed' END,
      next_check_at = NULL
  WHERE id = p_attempt_id AND invoice_id IS NULL AND state IN ('creating','unknown');
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_note_swiss_bitcoin_creation(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_note_swiss_bitcoin_creation(UUID, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_defer_swiss_bitcoin_check(p_attempt_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.swiss_bitcoin_payment_attempts SET
    state = CASE WHEN state = 'creating' AND invoice_id IS NULL THEN 'unknown' ELSE state END,
    issue = CASE WHEN state = 'creating' AND invoice_id IS NULL THEN 'creation_unconfirmed' ELSE issue END,
    next_check_at = CASE
      WHEN invoice_id IS NULL THEN NULL
      WHEN state = 'expired' AND COALESCE(expires_at, created_at) <= now() - interval '7 days' THEN NULL
      WHEN state = 'expired' OR created_at <= now() - interval '24 hours' THEN now() + interval '30 minutes'
      ELSE now() + interval '5 minutes' END
  WHERE id = p_attempt_id AND next_check_at <= now();
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_defer_swiss_bitcoin_check(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_defer_swiss_bitcoin_check(UUID) TO service_role;

-- All writes that can accept funds, archive an order or switch its provider
-- serialize on the order row. Delivery and rewards require accepted payment.
CREATE OR REPLACE FUNCTION public.rpc_observe_swiss_bitcoin_payment(
  p_attempt_id UUID, p_invoice_id UUID, p_state TEXT, p_eur_minor BIGINT, p_currency TEXT,
  p_provider_status TEXT, p_paid_at TIMESTAMPTZ, p_paid_sats BIGINT, p_payment_reference TEXT,
  p_expires_at TIMESTAMPTZ, p_issue TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  purchase public.orders%ROWTYPE;
  attempt public.swiss_bitcoin_payment_attempts%ROWTYPE;
  problem TEXT;
  deadline TIMESTAMPTZ;
BEGIN
  SELECT o.* INTO purchase FROM public.orders o
    JOIN public.swiss_bitcoin_payment_attempts a ON a.order_id = o.id
    WHERE a.id = p_attempt_id FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'bitcoin_attempt_not_found'; END IF;
  SELECT * INTO attempt FROM public.swiss_bitcoin_payment_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF p_invoice_id IS NULL OR (attempt.invoice_id IS NOT NULL AND attempt.invoice_id <> p_invoice_id)
    OR (attempt.invoice_id IS NULL AND attempt.state NOT IN ('creating','unknown')) THEN
    RAISE EXCEPTION 'bitcoin_invoice_mismatch';
  END IF;
  IF p_state IS NULL OR p_state NOT IN ('pending','confirming','expired','paid','review') THEN
    RAISE EXCEPTION 'bitcoin_state_invalid';
  END IF;
  IF attempt.state = 'paid' THEN
    RETURN jsonb_build_object('effects_pending', attempt.effects_pending);
  END IF;
  IF p_currency IS DISTINCT FROM 'EUR' OR p_eur_minor IS DISTINCT FROM attempt.expected_eur_minor
    OR p_eur_minor IS DISTINCT FROM round(purchase.total_amount * 100)::BIGINT THEN
    IF attempt.invoice_id IS NULL THEN RAISE EXCEPTION 'bitcoin_invoice_mismatch'; END IF;
    problem := COALESCE(p_issue, 'payment_verification_mismatch');
  ELSIF p_state = 'review' THEN
    problem := COALESCE(p_issue, 'payment_verification_mismatch');
  END IF;
  IF attempt.state = 'review' AND p_state <> 'paid' THEN
    RETURN jsonb_build_object('effects_pending', FALSE);
  END IF;
  deadline := COALESCE(p_expires_at, attempt.expires_at);
  IF problem IS NULL AND p_state = 'paid' THEN
    problem := CASE
      WHEN attempt.state = 'review' THEN COALESCE(attempt.issue, 'payment_verification_mismatch')
      WHEN purchase.archived_at IS NOT NULL OR purchase.status = 'cancelled' THEN 'payment_after_cancellation'
      WHEN purchase.payment_state = 'paid' THEN 'duplicate_payment'
      WHEN purchase.swiss_bitcoin_card_started_at IS NOT NULL OR purchase.payment_provider <> 'swiss_bitcoin_pay'
        THEN 'payment_after_card_switch'
      WHEN attempt.state = 'expired' OR p_paid_at > deadline THEN 'payment_after_expiration'
      WHEN purchase.payment_review_required OR purchase.payment_state <> 'pending' THEN 'payment_requires_review'
      ELSE NULL END;
    IF problem IS NULL THEN
      BEGIN
        UPDATE public.swiss_bitcoin_payment_attempts SET state = 'paid', invoice_id = p_invoice_id
          WHERE id = attempt.id;
        UPDATE public.orders SET status = 'paid', payment_state = 'paid' WHERE id = purchase.id;
        PERFORM public.rpc_apply_order_inventory(purchase.id);
        IF public.rpc_consume_lottery_reward_claims_for_order(purchase.id) = 0
          AND purchase.swiss_bitcoin_reward_claim_id IS NOT NULL THEN
          RAISE EXCEPTION 'bitcoin_reward_reservation_lost';
        END IF;
        UPDATE public.checkout_attempts SET state = 'completed', updated_at = now() WHERE order_id = purchase.id;
      EXCEPTION WHEN raise_exception THEN
        IF left(SQLERRM, 10) = 'inventory_' OR SQLERRM = 'bitcoin_reward_reservation_lost' THEN
          problem := SQLERRM;
        ELSE
          RAISE;
        END IF;
      END;
    END IF;
  END IF;
  IF problem IS NOT NULL THEN
    UPDATE public.swiss_bitcoin_payment_attempts SET state = 'review', invoice_id = p_invoice_id,
      issue = left(problem, 250), provider_status = left(p_provider_status, 32), last_checked_at = now(),
      next_check_at = NULL, expires_at = deadline, paid_at = COALESCE(p_paid_at, paid_at),
      paid_sats = COALESCE(p_paid_sats, paid_sats), payment_reference = COALESCE(left(p_payment_reference, 128), payment_reference)
    WHERE id = attempt.id;
    UPDATE public.orders SET payment_review_required = TRUE, payment_review_reason = CASE
      WHEN strpos(COALESCE(payment_review_reason, ''), left(problem, 250)) > 0 THEN payment_review_reason
      ELSE concat_ws(' / ', NULLIF(payment_review_reason,''), left(problem, 250)) END
    WHERE id = purchase.id;
    RETURN jsonb_build_object('effects_pending', FALSE);
  END IF;
  IF (attempt.state = 'expired' AND p_state IN ('pending','confirming'))
    OR (attempt.state = 'confirming' AND p_state = 'pending') THEN
    UPDATE public.swiss_bitcoin_payment_attempts SET next_check_at = CASE
      WHEN attempt.state = 'expired' AND COALESCE(deadline, attempt.created_at) <= now() - interval '7 days' THEN NULL
      ELSE now() + interval '30 minutes' END
    WHERE id = attempt.id;
    RETURN jsonb_build_object('effects_pending', FALSE);
  END IF;
  UPDATE public.swiss_bitcoin_payment_attempts SET state = p_state, invoice_id = p_invoice_id,
    last_checked_at = now(), expires_at = deadline, provider_status = left(p_provider_status, 32),
    paid_at = p_paid_at, paid_sats = p_paid_sats, payment_reference = left(p_payment_reference, 128),
    issue = NULL, effects_pending = p_state = 'paid',
    next_check_at = CASE
      WHEN p_state = 'paid' THEN now()
      WHEN p_state <> 'expired' AND attempt.created_at > now() - interval '24 hours' THEN now() + interval '2 minutes'
      WHEN p_state <> 'expired' THEN now() + interval '30 minutes'
      WHEN COALESCE(deadline, attempt.created_at) > now() - interval '7 days' THEN now() + interval '30 minutes'
      ELSE NULL END
  WHERE id = attempt.id;
  RETURN jsonb_build_object('effects_pending', p_state = 'paid');
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_observe_swiss_bitcoin_payment(UUID, UUID, TEXT, BIGINT, TEXT, TEXT, TIMESTAMPTZ, BIGINT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_observe_swiss_bitcoin_payment(UUID, UUID, TEXT, BIGINT, TEXT, TEXT, TIMESTAMPTZ, BIGINT, TEXT, TIMESTAMPTZ, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_complete_swiss_bitcoin_effects(p_attempt_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.swiss_bitcoin_payment_attempts SET effects_pending = FALSE, next_check_at = NULL
    WHERE id = p_attempt_id AND state = 'paid';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_complete_swiss_bitcoin_effects(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_complete_swiss_bitcoin_effects(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_claim_swiss_bitcoin_card_fallback(p_order_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE purchase public.orders%ROWTYPE;
BEGIN
  SELECT * INTO purchase FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR purchase.payment_provider <> 'swiss_bitcoin_pay' OR purchase.status <> 'pending_payment'
    OR purchase.payment_state <> 'pending' OR purchase.archived_at IS NOT NULL OR purchase.payment_review_required
    OR purchase.viva_order_code IS NOT NULL OR purchase.swiss_bitcoin_card_started_at IS NOT NULL
    OR purchase.created_at <= now() - interval '60 minutes'
    OR EXISTS (SELECT 1 FROM public.swiss_bitcoin_payment_attempts WHERE order_id = p_order_id
      AND state NOT IN ('expired','failed')) THEN
    RETURN FALSE;
  END IF;
  UPDATE public.orders SET swiss_bitcoin_card_started_at = now() WHERE id = p_order_id;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_claim_swiss_bitcoin_card_fallback(TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_claim_swiss_bitcoin_card_fallback(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_attach_swiss_bitcoin_card_fallback(p_order_id TEXT, p_viva_order_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_viva_order_code IS NULL OR p_viva_order_code !~ '^[0-9]{1,32}$' THEN RAISE EXCEPTION 'viva_order_code_invalid'; END IF;
  -- Keep a created card reference even if a Bitcoin payment came in during the
  -- request. In that case the handler withholds the card link for review.
  UPDATE public.orders SET payment_provider = 'viva', viva_order_code = p_viva_order_code
    WHERE id = p_order_id AND swiss_bitcoin_card_started_at IS NOT NULL
      AND (viva_order_code IS NULL OR viva_order_code = p_viva_order_code);
  IF NOT FOUND THEN RETURN FALSE; END IF;
  RETURN EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id AND status = 'pending_payment'
    AND payment_state = 'pending' AND archived_at IS NULL AND NOT payment_review_required);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_attach_swiss_bitcoin_card_fallback(TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_attach_swiss_bitcoin_card_fallback(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_swiss_bitcoin_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.payment_provider <> 'swiss_bitcoin_pay' AND OLD.swiss_bitcoin_card_started_at IS NULL THEN RETURN NEW; END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at AND NEW.archived_at IS NOT NULL THEN
    IF OLD.payment_review_required
      OR (OLD.swiss_bitcoin_card_started_at > now() - interval '60 minutes' AND OLD.viva_order_code IS NULL)
      OR EXISTS (SELECT 1 FROM public.swiss_bitcoin_payment_attempts WHERE order_id = OLD.id
        AND (state IN ('creating','pending','confirming')
          OR (state = 'unknown' AND created_at > now() - interval '60 minutes'))) THEN
      RAISE EXCEPTION 'order_transition_bitcoin_open';
    END IF;
  ELSIF NEW.payment_state IS DISTINCT FROM OLD.payment_state THEN
    IF (OLD.payment_provider = 'swiss_bitcoin_pay' AND (NEW.payment_state <> 'paid'
        OR NOT EXISTS (SELECT 1 FROM public.swiss_bitcoin_payment_attempts WHERE order_id = OLD.id AND state = 'paid')))
      OR (NEW.payment_state = 'paid' AND OLD.payment_provider = 'viva' AND NEW.viva_transaction_id IS NULL) THEN
      RAISE EXCEPTION 'order_transition_bitcoin_verification_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_swiss_bitcoin_order() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER guard_swiss_bitcoin_order
  BEFORE UPDATE OF payment_state, archived_at ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_swiss_bitcoin_order();

CREATE OR REPLACE FUNCTION public.rpc_archive_idle_swiss_bitcoin_orders(p_limit INTEGER)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE order_id TEXT; archived INTEGER := 0;
BEGIN
  FOR order_id IN
    SELECT o.id FROM public.orders o
    WHERE o.payment_provider = 'swiss_bitcoin_pay' AND o.status = 'pending_payment' AND o.payment_state = 'pending'
      AND o.created_at <= now() - interval '60 minutes' AND o.archived_at IS NULL AND NOT o.payment_review_required
      AND o.swiss_bitcoin_card_started_at IS NULL AND o.viva_order_code IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.swiss_bitcoin_payment_attempts a WHERE a.order_id = o.id
        AND a.state NOT IN ('expired','failed'))
    ORDER BY o.created_at
    LIMIT least(greatest(COALESCE(p_limit, 25), 1), 100) FOR UPDATE OF o SKIP LOCKED
  LOOP
    PERFORM public.rpc_archive_incomplete_order(order_id, 'bitcoin_checkout_expired');
    archived := archived + 1;
  END LOOP;
  RETURN archived;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_archive_idle_swiss_bitcoin_orders(INTEGER) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_archive_idle_swiss_bitcoin_orders(INTEGER) TO service_role;

COMMIT;
