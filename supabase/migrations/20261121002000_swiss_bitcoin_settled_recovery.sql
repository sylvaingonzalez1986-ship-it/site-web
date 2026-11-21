BEGIN;
SET LOCAL lock_timeout = '5s';

-- The old reader discarded unrecognized status names. A newer reader talking
-- to the old RPC may already have recorded settlement evidence on the same hold.
CREATE OR REPLACE FUNCTION public.swiss_bitcoin_settlement_review(
  purchase public.orders, attempt public.swiss_bitcoin_payment_attempts
) RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT COALESCE(
    attempt.order_id = purchase.id AND attempt.state = 'review' AND attempt.issue = 'invoice_status_unknown'
    AND attempt.invoice_id IS NOT NULL AND NOT attempt.effects_pending
    AND (attempt.provider_status IS NULL OR attempt.provider_status = 'settled')
    AND purchase.payment_review_required AND purchase.payment_review_reason = 'invoice_status_unknown'
    AND purchase.payment_provider = 'swiss_bitcoin_pay' AND purchase.payment_state = 'pending'
    AND purchase.status = 'pending_payment' AND purchase.archived_at IS NULL
    AND purchase.swiss_bitcoin_card_started_at IS NULL AND purchase.viva_order_code IS NULL
    AND purchase.viva_transaction_id IS NULL AND purchase.paid_at IS NULL AND purchase.stock_applied_at IS NULL
    AND attempt.expected_eur_minor = round(purchase.total_amount * 100)::BIGINT
    AND NOT EXISTS (
      SELECT 1 FROM public.swiss_bitcoin_payment_attempts other
      WHERE other.order_id = purchase.id AND other.id <> attempt.id
        AND (other.created_at >= attempt.created_at OR other.state NOT IN ('failed','expired')
          OR other.paid_at IS NOT NULL OR other.paid_sats IS NOT NULL
          OR other.payment_reference IS NOT NULL OR other.effects_pending)
    ), FALSE);
$$;
REVOKE ALL ON FUNCTION public.swiss_bitcoin_settlement_review(public.orders, public.swiss_bitcoin_payment_attempts)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS swiss_bitcoin_attempt_payment_reference ON public.swiss_bitcoin_payment_attempts(lower(payment_reference))
  WHERE payment_reference IS NOT NULL;

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
  recover_review BOOLEAN := FALSE;
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
  IF attempt.state = 'review' THEN
    recover_review := public.swiss_bitcoin_settlement_review(purchase, attempt);
    IF p_state <> 'paid' AND (NOT recover_review OR problem IS NULL OR problem = 'invoice_status_unknown') THEN
      -- During a rolling deploy the old reader can still return unknown. Back
      -- off the queued check. A different non-settled state stays under review.
      IF attempt.next_check_at IS NOT NULL THEN
        UPDATE public.swiss_bitcoin_payment_attempts SET last_checked_at = now(),
          next_check_at = CASE WHEN recover_review AND problem = 'invoice_status_unknown'
            THEN now() + interval '30 minutes' END
        WHERE id = attempt.id;
      END IF;
      RETURN jsonb_build_object('effects_pending', FALSE);
    END IF;
  END IF;
  deadline := COALESCE(p_expires_at, attempt.expires_at);
  IF recover_review THEN
    deadline := least(p_expires_at, attempt.expires_at);
  END IF;

  -- The same Lightning hash cannot pay two invoices. Serialize observations
  -- of its settlement evidence across orders, including concurrent callbacks.
  IF p_payment_reference ~ '^[0-9a-fA-F]{64}$' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(lower(p_payment_reference), 0));
    IF p_state = 'paid' AND problem IS NULL AND (attempt.state <> 'review' OR recover_review) AND EXISTS (
      SELECT 1 FROM public.swiss_bitcoin_payment_attempts other
      WHERE other.id <> attempt.id AND lower(other.payment_reference) = lower(p_payment_reference)
    ) THEN
      problem := 'duplicate_payment';
    END IF;
  END IF;
  IF problem IS NULL AND p_state = 'paid' THEN
    problem := CASE
      WHEN attempt.state = 'review' AND NOT recover_review THEN COALESCE(attempt.issue, 'payment_verification_mismatch')
      WHEN recover_review AND (p_provider_status IS DISTINCT FROM 'settled' OR p_issue IS NOT NULL)
        THEN COALESCE(p_issue, 'invoice_status_unknown')
      WHEN recover_review AND (p_paid_at IS NULL OR NOT isfinite(p_paid_at) OR p_expires_at IS NULL
        OR NOT isfinite(p_expires_at) OR p_paid_at < date_trunc('second', attempt.created_at)
        OR p_paid_at > clock_timestamp()
        OR (attempt.paid_at IS NOT NULL AND p_paid_at IS DISTINCT FROM attempt.paid_at))
        THEN 'invoice_timing_unverified'
      WHEN recover_review AND (p_payment_reference IS NULL OR p_payment_reference !~ '^[0-9a-fA-F]{64}$'
        OR (attempt.payment_reference IS NOT NULL AND lower(p_payment_reference) <> lower(attempt.payment_reference)))
        THEN 'invoice_payment_reference_unverified'
      WHEN purchase.archived_at IS NOT NULL OR purchase.status = 'cancelled' THEN 'payment_after_cancellation'
      WHEN purchase.payment_state = 'paid' THEN 'duplicate_payment'
      WHEN purchase.swiss_bitcoin_card_started_at IS NOT NULL OR purchase.payment_provider <> 'swiss_bitcoin_pay'
        THEN 'payment_after_card_switch'
      WHEN attempt.state = 'expired' OR p_paid_at > deadline THEN 'payment_after_expiration'
      WHEN (purchase.payment_review_required AND NOT recover_review) OR purchase.payment_state <> 'pending' THEN 'payment_requires_review'
      ELSE NULL END;
    IF problem IS NULL THEN
      BEGIN
        UPDATE public.swiss_bitcoin_payment_attempts SET state = 'paid', invoice_id = p_invoice_id
          WHERE id = attempt.id;
        UPDATE public.orders SET status = 'paid', payment_state = 'paid',
          payment_review_required = CASE WHEN recover_review THEN FALSE ELSE payment_review_required END,
          payment_review_reason = CASE WHEN recover_review THEN NULL ELSE payment_review_reason END
        WHERE id = purchase.id;
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
      next_check_at = NULL, expires_at = deadline,
      paid_at = CASE WHEN recover_review THEN COALESCE(paid_at, p_paid_at) ELSE COALESCE(p_paid_at, paid_at) END,
      paid_sats = COALESCE(p_paid_sats, paid_sats),
      payment_reference = CASE WHEN recover_review THEN COALESCE(payment_reference, left(p_payment_reference, 128))
        ELSE COALESCE(left(p_payment_reference, 128), payment_reference) END
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

-- Requeue for an independent provider GET. Updating the schedule alone leaves
-- the order and its stock, rewards, and review restrictions intact.
UPDATE public.swiss_bitcoin_payment_attempts a SET next_check_at = now()
FROM public.orders o
WHERE a.order_id = o.id AND a.state = 'review' AND a.issue = 'invoice_status_unknown'
  AND a.next_check_at IS NULL AND public.swiss_bitcoin_settlement_review(o, a);

COMMIT;
