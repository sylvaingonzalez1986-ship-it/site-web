-- Keep all contributions in the existing ledger and bind each to one provider.
ALTER TABLE public.support_contributions
  ADD COLUMN provider TEXT NOT NULL DEFAULT 'viva' CHECK (provider IN ('viva', 'swiss-bitcoin-pay')),
  ADD COLUMN invoice_id UUID UNIQUE,
  ADD COLUMN provider_issue TEXT,
  ADD COLUMN last_checked_at TIMESTAMPTZ,
  ADD COLUMN next_check_at TIMESTAMPTZ,
  DROP CONSTRAINT support_contributions_checkout_state_check,
  DROP CONSTRAINT support_contributions_check,
  ADD CONSTRAINT support_contributions_checkout_state_check CHECK (checkout_state IN ('creating', 'ready', 'uncertain', 'cancelled', 'expired')),
  ADD CONSTRAINT support_contributions_provider_binding CHECK (
    (provider = 'viva' AND invoice_id IS NULL AND (paid_at IS NULL OR (transaction_id IS NOT NULL AND order_code IS NOT NULL))) OR
    (provider = 'swiss-bitcoin-pay' AND source_code = 'producer-support' AND order_code IS NULL AND transaction_id IS NULL
      AND (paid_at IS NULL OR invoice_id IS NOT NULL))
  );

CREATE INDEX support_contributions_due ON public.support_contributions(next_check_at) WHERE next_check_at IS NOT NULL;

DROP FUNCTION public.rpc_begin_support_checkout(UUID,TEXT,TEXT,INTEGER,BOOLEAN,BOOLEAN,TEXT);

CREATE FUNCTION public.rpc_begin_support_checkout(
  p_id UUID, p_token_hash TEXT, p_pseudonym TEXT, p_amount INTEGER,
  p_publish_name BOOLEAN, p_publish_amount BOOLEAN, p_source TEXT, p_provider TEXT DEFAULT 'viva'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.support_contributions; v_campaign public.support_campaigns;
BEGIN
  IF p_id IS NULL OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
    OR p_pseudonym IS NULL OR length(btrim(p_pseudonym)) NOT BETWEEN 1 AND 32 OR p_pseudonym ~ '[[:cntrl:]<>]'
    OR p_amount IS NULL OR p_amount NOT BETWEEN 100 AND 100000
    OR p_publish_name IS NULL OR p_publish_amount IS NULL OR p_source IS NULL OR length(p_source) NOT BETWEEN 1 AND 64
    OR p_provider IS NULL OR p_provider NOT IN ('viva', 'swiss-bitcoin-pay')
    OR (p_provider = 'swiss-bitcoin-pay' AND p_source <> 'producer-support')
  THEN RAISE EXCEPTION 'support_invalid'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::TEXT, 9911));
  SELECT * INTO v_row FROM public.support_contributions WHERE id = p_id FOR UPDATE;
  IF FOUND THEN
    IF v_row.access_token_hash <> p_token_hash OR v_row.pseudonym <> p_pseudonym OR v_row.amount_cents <> p_amount
      OR v_row.publish_name <> p_publish_name OR v_row.publish_amount <> p_publish_amount
      OR v_row.source_code <> p_source OR v_row.provider <> p_provider
    THEN RAISE EXCEPTION 'support_conflict'; END IF;
    RETURN jsonb_build_object('created', FALSE, 'contribution', to_jsonb(v_row));
  END IF;

  SELECT * INTO v_campaign FROM public.support_campaigns WHERE id = 'producer-support' FOR SHARE;
  IF NOT FOUND OR NOT v_campaign.active THEN RAISE EXCEPTION 'support_closed'; END IF;
  IF p_amount NOT BETWEEN v_campaign.min_cents AND v_campaign.max_cents THEN RAISE EXCEPTION 'support_amount'; END IF;
  INSERT INTO public.support_contributions(
    id, campaign_id, access_token_hash, pseudonym, amount_cents, publish_name, publish_amount, source_code, provider
  ) VALUES (
    p_id, v_campaign.id, p_token_hash, p_pseudonym, p_amount, p_publish_name, p_publish_amount, p_source, p_provider
  ) RETURNING * INTO v_row;
  RETURN jsonb_build_object('created', TRUE, 'contribution', to_jsonb(v_row));
END $$;

-- Only the worker that won the begin RPC submits a create request to Swiss Bitcoin Pay.
CREATE FUNCTION public.rpc_support_swiss_checkout(p_id UUID, p_invoice UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.support_contributions;
BEGIN
  SELECT * INTO v_row FROM public.support_contributions WHERE id = p_id AND provider = 'swiss-bitcoin-pay' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_not_found'; END IF;

  IF p_invoice IS NULL THEN
    UPDATE public.support_contributions SET checkout_state = 'uncertain', provider_issue = 'creation_uncertain', updated_at = now()
      WHERE id = p_id AND checkout_state = 'creating' AND invoice_id IS NULL;
  ELSIF v_row.invoice_id IS NULL THEN
    UPDATE public.support_contributions SET invoice_id = p_invoice, checkout_state = 'ready', provider_issue = NULL,
      expires_at = now() + interval '10 minutes', next_check_at = now(), updated_at = now() WHERE id = p_id;
  ELSIF v_row.invoice_id <> p_invoice THEN
    RAISE EXCEPTION 'support_conflict';
  END IF;
END $$;

-- Called with data obtained from Get invoice. Both existing bindings and recovered
-- bindings are checked under the contribution lock before they can affect the ledger.
CREATE FUNCTION public.rpc_support_swiss_observe(
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
    OR (p_state = 'paid' AND (p_status IS DISTINCT FROM 'paid' OR p_paid IS NULL OR p_expires IS NULL))
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

CREATE FUNCTION public.rpc_claim_support_swiss_checks()
RETURNS TABLE(id UUID, invoice_id UUID, amount_cents INTEGER) LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH due AS (
    SELECT c.id FROM public.support_contributions c
    WHERE c.provider = 'swiss-bitcoin-pay' AND c.invoice_id IS NOT NULL AND c.next_check_at <= now()
    ORDER BY c.next_check_at, c.id LIMIT 16 FOR UPDATE SKIP LOCKED
  )
  UPDATE public.support_contributions c SET next_check_at = now() + interval '5 minutes'
  FROM due WHERE c.id = due.id RETURNING c.id, c.invoice_id, c.amount_cents;
$$;

-- An admin acknowledges a re-verified late payment without erasing the anomaly or changing the funds.
CREATE FUNCTION public.rpc_ack_support_swiss_late(p_id UUID, p_invoice UUID, p_actor TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.support_contributions;
BEGIN
  IF p_actor IS NULL OR length(p_actor) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'support_invalid'; END IF;
  SELECT * INTO v_row FROM public.support_contributions WHERE id = p_id AND provider = 'swiss-bitcoin-pay' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_not_found'; END IF;
  IF p_invoice IS NULL OR v_row.invoice_id IS DISTINCT FROM p_invoice OR v_row.provider_issue IS DISTINCT FROM 'paid_after_expiry' OR v_row.paid_at IS NULL
  THEN RAISE EXCEPTION 'support_payment_mismatch'; END IF;
  IF NOT v_row.review_required THEN RETURN; END IF;

  UPDATE public.support_contributions SET review_required = FALSE, updated_at = now() WHERE id = p_id;
  INSERT INTO public.support_admin_audit(actor, action, target, before_value, after_value) VALUES (
    p_actor, 'ack_late_payment', p_id::TEXT,
    jsonb_build_object('reviewRequired', TRUE, 'invoiceId', p_invoice),
    jsonb_build_object('reviewRequired', FALSE, 'invoiceId', p_invoice)
  );
END $$;

REVOKE ALL ON FUNCTION public.rpc_begin_support_checkout(UUID,TEXT,TEXT,INTEGER,BOOLEAN,BOOLEAN,TEXT,TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_support_swiss_checkout(UUID,UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_support_swiss_observe(UUID,UUID,TEXT,INTEGER,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_claim_support_swiss_checks() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_ack_support_swiss_late(UUID,UUID,TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_begin_support_checkout(UUID,TEXT,TEXT,INTEGER,BOOLEAN,BOOLEAN,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_support_swiss_checkout(UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_support_swiss_observe(UUID,UUID,TEXT,INTEGER,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_claim_support_swiss_checks() TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ack_support_swiss_late(UUID,UUID,TEXT) TO service_role;
