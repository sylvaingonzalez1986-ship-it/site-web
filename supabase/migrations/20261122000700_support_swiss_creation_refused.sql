-- A definitive provider refusal can release only the original, unbound creation attempt.
CREATE FUNCTION public.rpc_support_swiss_creation_refused(p_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.support_contributions
  SET checkout_state = 'cancelled', provider_issue = 'creation_refused', updated_at = now()
  WHERE id = p_id
    AND provider = 'swiss-bitcoin-pay'
    AND checkout_state = 'creating'
    AND invoice_id IS NULL
    AND paid_at IS NULL
    AND NOT review_required
    AND provider_issue IS NULL;
$$;

REVOKE ALL ON FUNCTION public.rpc_support_swiss_creation_refused(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_support_swiss_creation_refused(UUID) TO service_role;

-- Production checkout logged a definitive HTTP 403 at 08:03:52.662 UTC.
-- This was the only Lightning creation during that request. Release its saved
-- form only if the row is still exactly as it was immediately after the refusal.
UPDATE public.support_contributions
SET checkout_state = 'cancelled', provider_issue = 'creation_refused', updated_at = now()
WHERE provider = 'swiss-bitcoin-pay' AND source_code = 'producer-support'
  AND created_at = TIMESTAMPTZ '2026-11-22 08:03:52.204788+00'
  AND updated_at = TIMESTAMPTZ '2026-11-22 08:03:52.714922+00'
  AND checkout_state = 'uncertain' AND provider_issue = 'creation_uncertain'
  AND invoice_id IS NULL AND paid_at IS NULL AND NOT review_required;

-- Swiss Bitcoin Pay reports both paid and settled for verified Lightning payments.
CREATE OR REPLACE FUNCTION public.rpc_support_swiss_observe(
  p_id UUID, p_invoice UUID, p_state TEXT, p_amount INTEGER, p_currency TEXT,
  p_status TEXT, p_expires TIMESTAMPTZ, p_paid TIMESTAMPTZ, p_issue TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.support_contributions; v_expiry TIMESTAMPTZ; v_late BOOLEAN;
BEGIN
  SELECT * INTO v_row FROM public.support_contributions WHERE id = p_id AND provider = 'swiss-bitcoin-pay' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_not_found'; END IF;
  IF p_invoice IS NULL OR (v_row.invoice_id IS NOT NULL AND v_row.invoice_id <> p_invoice)
    OR p_state IS NULL OR p_state NOT IN ('pending', 'expired', 'paid', 'review')
    OR (p_state = 'review') IS DISTINCT FROM (p_issue IS NOT NULL)
    OR (p_state <> 'review' AND (p_amount IS DISTINCT FROM v_row.amount_cents OR p_currency IS DISTINCT FROM 'EUR'))
    OR (v_row.invoice_id IS NULL AND (p_amount IS DISTINCT FROM v_row.amount_cents OR p_currency IS DISTINCT FROM 'EUR'))
    OR (p_state = 'paid' AND (p_status IS NULL OR p_status NOT IN ('paid', 'settled') OR p_paid IS NULL OR p_expires IS NULL))
    OR (p_state = 'expired' AND p_status IS DISTINCT FROM 'expired')
    OR (p_state = 'pending' AND (p_status IS NULL OR p_status NOT IN ('draft', 'open', 'pending')))
  THEN RAISE EXCEPTION 'support_payment_mismatch'; END IF;

  -- Final payments are immutable. A stale open response cannot reopen an expired invoice.
  IF v_row.paid_at IS NOT NULL THEN RETURN; END IF;
  IF v_row.checkout_state = 'expired' AND p_state = 'pending' THEN
    UPDATE public.support_contributions SET last_checked_at = now(),
      next_check_at = CASE WHEN now() <= expires_at + interval '7 days' THEN now() + interval '1 hour' END
    WHERE id = p_id;
    RETURN;
  END IF;
  v_expiry := coalesce(p_expires, v_row.expires_at);
  v_late := p_state = 'paid' AND p_paid > v_expiry;
  UPDATE public.support_contributions SET
    invoice_id = p_invoice,
    checkout_state = CASE WHEN p_state = 'expired' OR checkout_state = 'expired' THEN 'expired' ELSE 'ready' END,
    paid_at = CASE WHEN p_state = 'paid' THEN p_paid END,
    provider_status = p_status,
    provider_issue = CASE WHEN v_late THEN 'paid_after_expiry' ELSE p_issue END,
    review_required = v_late OR p_state = 'review',
    expires_at = v_expiry,
    last_checked_at = now(),
    updated_at = now(),
    next_check_at = CASE
      WHEN p_state = 'paid' THEN NULL
      WHEN now() > v_expiry + interval '7 days' THEN NULL
      WHEN p_state = 'expired' OR checkout_state = 'expired' THEN now() + interval '1 hour'
      ELSE now() + interval '5 minutes'
    END
  WHERE id = p_id;
END $$;
