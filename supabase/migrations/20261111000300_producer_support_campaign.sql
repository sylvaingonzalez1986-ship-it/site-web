-- Voluntary support is independent from shop orders, stock, invoices and rewards.
-- Every mutation is an explicit service-only RPC. No client receives table access.
CREATE TABLE public.support_campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  goal_cents BIGINT CHECK (goal_cents > 0 AND goal_cents <= 1000000000),
  min_cents INTEGER NOT NULL DEFAULT 100 CHECK (min_cents >= 100),
  max_cents INTEGER NOT NULL DEFAULT 100000 CHECK (max_cents >= min_cents AND max_cents <= 100000),
  active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.support_contributions (
  id UUID PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES public.support_campaigns(id),
  access_token_hash TEXT NOT NULL CHECK (access_token_hash ~ '^[0-9a-f]{64}$'),
  pseudonym TEXT NOT NULL CHECK (length(btrim(pseudonym)) BETWEEN 1 AND 32 AND pseudonym !~ '[[:cntrl:]<>]'),
  publish_name BOOLEAN NOT NULL,
  publish_amount BOOLEAN NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 100 AND 100000),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  source_code TEXT NOT NULL CHECK (length(source_code) BETWEEN 1 AND 64),
  checkout_state TEXT NOT NULL DEFAULT 'creating' CHECK (checkout_state IN ('creating','ready','uncertain','cancelled')),
  order_code TEXT UNIQUE CHECK (order_code ~ '^[0-9]{1,32}$'),
  transaction_id UUID UNIQUE,
  paid_at TIMESTAMPTZ,
  provider_status TEXT,
  review_required BOOLEAN NOT NULL DEFAULT FALSE,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  fees_cents INTEGER CHECK (fees_cents BETWEEN 0 AND 1000000),
  fee_reference TEXT CHECK (length(fee_reference) BETWEEN 1 AND 200),
  fee_updated_at TIMESTAMPTZ,
  fee_updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (paid_at IS NULL OR (transaction_id IS NOT NULL AND order_code IS NOT NULL)),
  CHECK ((fees_cents IS NULL AND fee_reference IS NULL) OR (fees_cents IS NOT NULL AND fee_reference IS NOT NULL))
);
CREATE INDEX support_contributions_public ON public.support_contributions(campaign_id, paid_at DESC, id) WHERE paid_at IS NOT NULL;
CREATE TABLE public.support_reversals (
  transaction_id UUID PRIMARY KEY,
  contribution_id UUID NOT NULL REFERENCES public.support_contributions(id),
  parent_transaction_id UUID NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 100000),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX support_reversals_contribution ON public.support_reversals(contribution_id);
CREATE TABLE public.support_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  before_value JSONB,
  after_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_campaigns FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.support_contributions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.support_reversals FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.support_admin_audit FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.support_campaigns TO service_role;
GRANT SELECT ON TABLE public.support_contributions TO service_role;
GRANT SELECT ON TABLE public.support_reversals TO service_role;

INSERT INTO public.support_campaigns(id, title) VALUES ('producer-support', 'Soutenir les producteurs');

CREATE FUNCTION public.rpc_begin_support_checkout(
  p_id UUID, p_token_hash TEXT, p_pseudonym TEXT, p_amount INTEGER,
  p_publish_name BOOLEAN, p_publish_amount BOOLEAN, p_source TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.support_contributions; v_campaign public.support_campaigns;
BEGIN
  IF p_id IS NULL OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
    OR p_pseudonym IS NULL OR length(btrim(p_pseudonym)) NOT BETWEEN 1 AND 32 OR p_pseudonym ~ '[[:cntrl:]<>]'
    OR p_amount IS NULL OR p_amount NOT BETWEEN 100 AND 100000
    OR p_publish_name IS NULL OR p_publish_amount IS NULL OR p_source IS NULL OR length(p_source) NOT BETWEEN 1 AND 64
  THEN RAISE EXCEPTION 'support_invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::TEXT, 9911));
  SELECT * INTO v_row FROM public.support_contributions WHERE id = p_id FOR UPDATE;
  IF FOUND THEN
    IF v_row.access_token_hash <> p_token_hash OR v_row.pseudonym <> p_pseudonym OR v_row.amount_cents <> p_amount
      OR v_row.publish_name <> p_publish_name OR v_row.publish_amount <> p_publish_amount OR v_row.source_code <> p_source
    THEN RAISE EXCEPTION 'support_conflict'; END IF;
    RETURN jsonb_build_object('created', FALSE, 'contribution', to_jsonb(v_row));
  END IF;
  SELECT * INTO v_campaign FROM public.support_campaigns WHERE id = 'producer-support' FOR SHARE;
  IF NOT FOUND OR NOT v_campaign.active THEN RAISE EXCEPTION 'support_closed'; END IF;
  IF p_amount NOT BETWEEN v_campaign.min_cents AND v_campaign.max_cents THEN RAISE EXCEPTION 'support_amount'; END IF;
  INSERT INTO public.support_contributions(id, campaign_id, access_token_hash, pseudonym, amount_cents, publish_name, publish_amount, source_code)
    VALUES(p_id, v_campaign.id, p_token_hash, p_pseudonym, p_amount, p_publish_name, p_publish_amount, p_source) RETURNING * INTO v_row;
  RETURN jsonb_build_object('created', TRUE, 'contribution', to_jsonb(v_row));
END $$;

CREATE FUNCTION public.rpc_support_checkout_state(p_id UUID, p_state TEXT, p_order TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.support_contributions;
BEGIN
  SELECT * INTO v_row FROM public.support_contributions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_not_found'; END IF;
  IF p_state IS NULL OR p_state NOT IN ('ready','uncertain','cancelled') THEN RAISE EXCEPTION 'support_invalid'; END IF;
  IF p_state = 'ready' THEN
    IF p_order IS NULL OR p_order !~ '^[0-9]{1,32}$' OR (v_row.order_code IS NOT NULL AND v_row.order_code <> p_order)
      OR v_row.checkout_state = 'cancelled' THEN RAISE EXCEPTION 'support_conflict'; END IF;
    UPDATE public.support_contributions SET order_code = p_order, checkout_state = 'ready', updated_at = now() WHERE id = p_id;
  ELSIF p_state = 'cancelled' THEN
    IF v_row.paid_at IS NOT NULL OR v_row.transaction_id IS NOT NULL THEN RAISE EXCEPTION 'support_already_paid'; END IF;
    -- Only call after the provider has confirmed cancellation of this known order.
    IF p_order IS NULL OR p_order IS DISTINCT FROM v_row.order_code THEN RAISE EXCEPTION 'support_conflict'; END IF;
    UPDATE public.support_contributions SET checkout_state = 'cancelled', updated_at = now() WHERE id = p_id;
  ELSE
    UPDATE public.support_contributions SET checkout_state = 'uncertain', updated_at = now()
      WHERE id = p_id AND checkout_state = 'creating' AND order_code IS NULL;
  END IF;
END $$;

-- Invoked only after independently retrieving the transaction from Viva.
-- Refunds may arrive first. Capture and the append-only refund ledger remain independent.
CREATE FUNCTION public.rpc_support_apply_transaction(
  p_id UUID, p_order TEXT, p_transaction UUID, p_source TEXT,
  p_amount INTEGER, p_currency TEXT, p_status TEXT, p_parent UUID DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.support_contributions; v_refund public.support_reversals; v_refunded BIGINT;
BEGIN
  SELECT * INTO v_row FROM public.support_contributions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_not_found'; END IF;
  IF p_order IS NULL OR p_order IS DISTINCT FROM v_row.order_code OR p_transaction IS NULL
    OR p_source IS NULL OR p_source IS DISTINCT FROM v_row.source_code OR p_currency IS DISTINCT FROM 'EUR'
    OR p_amount IS NULL OR p_amount = 0 OR p_status IS NULL
  THEN RAISE EXCEPTION 'support_payment_mismatch'; END IF;
  SELECT coalesce(sum(amount_cents), 0) INTO v_refunded FROM public.support_reversals WHERE contribution_id = p_id;
  IF p_amount < 0 THEN
    IF p_status NOT IN ('F','C','R') OR p_parent IS NULL OR p_parent = p_transaction
      OR (v_row.transaction_id IS NOT NULL AND v_row.transaction_id <> p_parent)
    THEN RAISE EXCEPTION 'support_payment_mismatch'; END IF;
    SELECT * INTO v_refund FROM public.support_reversals WHERE transaction_id = p_transaction;
    IF FOUND THEN
      IF v_refund.contribution_id <> p_id OR v_refund.parent_transaction_id <> p_parent OR v_refund.amount_cents <> -p_amount
      THEN RAISE EXCEPTION 'support_payment_mismatch'; END IF;
      RETURN;
    END IF;
    IF -p_amount + v_refunded > v_row.amount_cents THEN RAISE EXCEPTION 'support_refund_exceeds_payment'; END IF;
    INSERT INTO public.support_reversals(transaction_id, contribution_id, parent_transaction_id, amount_cents)
      VALUES(p_transaction, p_id, p_parent, -p_amount);
    UPDATE public.support_contributions SET transaction_id = p_parent,
      review_required = CASE WHEN v_refunded - p_amount = amount_cents THEN FALSE ELSE review_required END,
      updated_at = now() WHERE id = p_id;
  ELSE
    IF p_amount <> v_row.amount_cents OR p_parent IS NOT NULL THEN RAISE EXCEPTION 'support_payment_mismatch'; END IF;
    IF p_status IN ('E','X') THEN
      IF v_row.paid_at IS NULL THEN UPDATE public.support_contributions SET provider_status = p_status, updated_at = now() WHERE id = p_id; END IF;
      RETURN;
    END IF;
    IF p_status NOT IN ('F','C','R','M','MA','MI','ML','MS','MW') THEN RAISE EXCEPTION 'support_payment_pending'; END IF;
    IF v_row.transaction_id IS NOT NULL AND v_row.transaction_id <> p_transaction THEN RAISE EXCEPTION 'support_payment_mismatch'; END IF;
    UPDATE public.support_contributions SET transaction_id = p_transaction, paid_at = coalesce(paid_at, now()),
      provider_status = CASE WHEN p_status IN ('F','C') AND provider_status IN ('R','M','MA','MI','ML','MS','MW') THEN provider_status ELSE p_status END,
      review_required = CASE WHEN v_refunded = amount_cents THEN FALSE WHEN checkout_state = 'cancelled' THEN TRUE WHEN p_status = 'R' THEN v_refunded <> amount_cents
        WHEN p_status IN ('M','MA','MI','ML','MS') THEN TRUE WHEN p_status = 'MW' THEN FALSE ELSE review_required END,
      updated_at = now() WHERE id = p_id;
  END IF;
END $$;

CREATE FUNCTION public.rpc_support_public_summary(p_offset INTEGER DEFAULT 0)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH confirmed AS (
    SELECT c.id, c.paid_at, c.pseudonym, c.publish_name, c.publish_amount, c.hidden, c.review_required, c.fees_cents,
      c.amount_cents - coalesce((SELECT sum(r.amount_cents) FROM public.support_reversals r WHERE r.contribution_id = c.id), 0) AS retained
    FROM public.support_contributions c WHERE c.campaign_id = 'producer-support' AND c.paid_at IS NOT NULL
  ), visible AS (
    SELECT * FROM confirmed WHERE retained > 0 AND NOT review_required
    ORDER BY paid_at DESC, id LIMIT 20 OFFSET greatest(0, least(coalesce(p_offset, 0), 1000000))
  )
  SELECT jsonb_build_object(
    'campaign', jsonb_build_object('title', title, 'goalCents', goal_cents, 'minCents', min_cents, 'maxCents', max_cents, 'active', active, 'createdAt', created_at),
    'collectedCents', (SELECT coalesce(sum(retained), 0) FROM confirmed),
    'feesCents', (SELECT CASE WHEN count(*) = count(fees_cents) THEN coalesce(sum(fees_cents), 0) ELSE NULL END FROM confirmed),
    'contributionCount', (SELECT count(*) FROM confirmed WHERE retained > 0),
    'needsReconciliation', (SELECT coalesce(bool_or(review_required), FALSE) FROM confirmed),
    'contributions', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id,
      'pseudonym', CASE WHEN publish_name AND NOT hidden THEN pseudonym ELSE 'Anonyme' END,
      'amountCents', CASE WHEN publish_amount AND NOT hidden THEN retained ELSE NULL END, 'paidAt', paid_at)
      ORDER BY paid_at DESC, id), '[]'::JSONB) FROM visible),
    'nextOffset', CASE WHEN (SELECT count(*) FROM confirmed WHERE retained > 0 AND NOT review_required) > p_offset + 20 THEN p_offset + 20 ELSE NULL END,
    'updatedAt', now()
  ) FROM public.support_campaigns WHERE id = 'producer-support';
$$;

CREATE FUNCTION public.rpc_support_admin(p_action TEXT, p_id UUID, p_value JSONB, p_actor TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_before JSONB; v_after JSONB; v_goal BIGINT; v_fee INTEGER;
BEGIN
  IF p_actor IS NULL OR length(p_actor) NOT BETWEEN 1 AND 200 OR p_value IS NULL THEN RAISE EXCEPTION 'support_invalid'; END IF;
  IF p_action = 'campaign' THEN
    IF jsonb_typeof(p_value->'active') IS DISTINCT FROM 'boolean' OR NOT (p_value ? 'goalCents')
      OR jsonb_typeof(p_value->'goalCents') NOT IN ('number','null') THEN RAISE EXCEPTION 'support_invalid'; END IF;
    IF p_value->>'goalCents' IS NOT NULL THEN
      IF p_value->>'goalCents' !~ '^[0-9]+$' THEN RAISE EXCEPTION 'support_invalid'; END IF;
      v_goal := (p_value->>'goalCents')::BIGINT;
      IF v_goal NOT BETWEEN 1 AND 1000000000 THEN RAISE EXCEPTION 'support_invalid'; END IF;
    END IF;
    SELECT to_jsonb(c) INTO v_before FROM public.support_campaigns c WHERE id = 'producer-support' FOR UPDATE;
    UPDATE public.support_campaigns SET goal_cents = v_goal, active = (p_value->>'active')::BOOLEAN, updated_at = now() WHERE id = 'producer-support'
      RETURNING to_jsonb(support_campaigns) INTO v_after;
  ELSE
    SELECT jsonb_build_object('hidden', hidden, 'feesCents', fees_cents, 'feeReference', fee_reference) INTO v_before
      FROM public.support_contributions WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'support_not_found'; END IF;
    IF p_action = 'visibility' AND jsonb_typeof(p_value->'hidden') = 'boolean' THEN
      UPDATE public.support_contributions SET hidden = (p_value->>'hidden')::BOOLEAN, updated_at = now() WHERE id = p_id;
    ELSIF p_action = 'fees' THEN
      IF (p_value->>'feesCents') IS NULL OR p_value->>'feesCents' !~ '^[0-9]+$'
        OR coalesce(length(btrim(p_value->>'reference')), 0) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'support_invalid'; END IF;
      v_fee := (p_value->>'feesCents')::INTEGER;
      IF v_fee NOT BETWEEN 0 AND 1000000 THEN RAISE EXCEPTION 'support_invalid'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.support_contributions WHERE id = p_id AND paid_at IS NOT NULL) THEN RAISE EXCEPTION 'support_invalid'; END IF;
      UPDATE public.support_contributions SET fees_cents = v_fee, fee_reference = btrim(p_value->>'reference'), fee_updated_at = now(), fee_updated_by = p_actor, updated_at = now() WHERE id = p_id;
    ELSE RAISE EXCEPTION 'support_invalid'; END IF;
    SELECT jsonb_build_object('hidden', hidden, 'feesCents', fees_cents, 'feeReference', fee_reference) INTO v_after FROM public.support_contributions WHERE id = p_id;
  END IF;
  INSERT INTO public.support_admin_audit(actor, action, target, before_value, after_value)
    VALUES(p_actor, p_action, coalesce(p_id::TEXT, 'producer-support'), v_before, v_after);
END $$;

REVOKE ALL ON FUNCTION public.rpc_begin_support_checkout(UUID,TEXT,TEXT,INTEGER,BOOLEAN,BOOLEAN,TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_support_checkout_state(UUID,TEXT,TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_support_apply_transaction(UUID,TEXT,UUID,TEXT,INTEGER,TEXT,TEXT,UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_support_public_summary(INTEGER) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_support_admin(TEXT,UUID,JSONB,TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_begin_support_checkout(UUID,TEXT,TEXT,INTEGER,BOOLEAN,BOOLEAN,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_support_checkout_state(UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_support_apply_transaction(UUID,TEXT,UUID,TEXT,INTEGER,TEXT,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_support_public_summary(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_support_admin(TEXT,UUID,JSONB,TEXT) TO service_role;
