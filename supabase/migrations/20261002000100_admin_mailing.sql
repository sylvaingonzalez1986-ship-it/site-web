-- Durable, server-only mailing queue. SMTP is outside the transaction: an expired
-- claim is uncertain and is NEVER returned to pending automatically.
BEGIN;

CREATE TABLE public.mailing_campaigns (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  subject TEXT NOT NULL CHECK (length(btrim(subject)) BETWEEN 1 AND 200 AND subject !~ E'[\r\n]'),
  body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 20000),
  kind TEXT NOT NULL CHECK (kind IN ('marketing', 'information')),
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'completed')),
  counts JSONB NOT NULL DEFAULT '{"total":0,"pending":0,"processing":0,"sent":0,"failed":0,"skipped":0,"uncertain":0}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CHECK (cardinality(recipient_emails) <= 10000)
);

CREATE TABLE public.mailing_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.mailing_campaigns(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254),
  first_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped', 'uncertain')),
  error TEXT CHECK (length(error) <= 1000),
  sent_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);

-- A single locked row serializes SMTP claims across every campaign and server.
CREATE TABLE public.mailing_dispatch_state (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  last_claimed_at TIMESTAMPTZ
);
INSERT INTO public.mailing_dispatch_state (id) VALUES (true);

CREATE INDEX mailing_campaigns_created_idx ON public.mailing_campaigns (created_at DESC);
CREATE INDEX mailing_recipients_queue_idx ON public.mailing_recipients (campaign_id, status, id);
CREATE INDEX mailing_recipients_history_idx ON public.mailing_recipients (campaign_id, updated_at DESC);
CREATE INDEX mailing_recipients_email_idx ON public.mailing_recipients (email);
CREATE UNIQUE INDEX mailing_recipients_one_processing_idx ON public.mailing_recipients (campaign_id) WHERE status = 'processing';

ALTER TABLE public.mailing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mailing_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mailing_dispatch_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mailing_campaigns, public.mailing_recipients, public.mailing_dispatch_state FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.mailing_campaigns, public.mailing_recipients TO service_role;

CREATE FUNCTION public.rpc_mailing_recipient_eligible(p_email TEXT, p_kind TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p_kind IN ('marketing', 'information')
    AND NOT EXISTS (
      SELECT 1 FROM public.newsletter_subscribers s
      WHERE s.email_normalized = lower(btrim(p_email)) AND s.status = 'unsubscribed'
    )
    AND CASE WHEN p_kind = 'marketing' THEN EXISTS (
      SELECT 1 FROM public.newsletter_subscribers s
      WHERE s.email_normalized = lower(btrim(p_email)) AND s.status = 'active'
    ) ELSE EXISTS (
      SELECT 1 FROM auth.users u
      WHERE lower(btrim(u.email)) = lower(btrim(p_email))
        AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
    ) END;
$$;

-- Callers hold the campaign row lock. Counts are derived from persisted results,
-- including uncertain outcomes, rather than incremented by retried HTTP calls.
CREATE FUNCTION public.mailing_refresh_counts(p_campaign_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_counts JSONB;
  v_remaining BIGINT;
BEGIN
  SELECT jsonb_build_object(
    'total', count(*),
    'pending', count(*) FILTER (WHERE status = 'pending'),
    'processing', count(*) FILTER (WHERE status = 'processing'),
    'sent', count(*) FILTER (WHERE status = 'sent'),
    'failed', count(*) FILTER (WHERE status = 'failed'),
    'skipped', count(*) FILTER (WHERE status = 'skipped'),
    'uncertain', count(*) FILTER (WHERE status = 'uncertain')
  ), count(*) FILTER (WHERE status IN ('pending', 'processing'))
  INTO v_counts, v_remaining FROM public.mailing_recipients WHERE campaign_id = p_campaign_id;

  UPDATE public.mailing_campaigns SET counts = v_counts, updated_at = clock_timestamp(),
    status = CASE WHEN status = 'sending' AND v_remaining = 0 THEN 'completed' ELSE status END,
    completed_at = CASE WHEN status = 'sending' AND v_remaining = 0 THEN clock_timestamp() ELSE completed_at END
  WHERE id = p_campaign_id;
END;
$$;

CREATE FUNCTION public.rpc_save_mailing_draft(
  p_id UUID, p_name TEXT, p_subject TEXT, p_body TEXT, p_kind TEXT, p_recipient_emails TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_campaign public.mailing_campaigns%ROWTYPE;
  v_emails TEXT[];
BEGIN
  IF p_recipient_emails IS NULL OR cardinality(p_recipient_emails) > 10000 OR EXISTS (
    SELECT 1 FROM unnest(p_recipient_emails) email
    WHERE email IS NULL OR length(email) > 254 OR btrim(email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
  ) THEN RAISE EXCEPTION 'Destinataires invalides.'; END IF;
  SELECT coalesce(array_agg(email ORDER BY email), '{}') INTO v_emails
  FROM (SELECT DISTINCT lower(btrim(email)) AS email FROM unnest(p_recipient_emails) email) normalized;

  INSERT INTO public.mailing_campaigns (id, name, subject, body, kind, recipient_emails)
    VALUES (p_id, btrim(p_name), btrim(p_subject), btrim(p_body), p_kind, v_emails)
    ON CONFLICT (id) DO NOTHING;
  SELECT * INTO v_campaign FROM public.mailing_campaigns WHERE id = p_id FOR UPDATE;
  IF v_campaign.status <> 'draft' THEN RAISE EXCEPTION 'Une campagne déjà lancée ne peut plus être modifiée.'; END IF;
  UPDATE public.mailing_campaigns SET name = btrim(p_name), subject = btrim(p_subject),
    body = btrim(p_body), kind = p_kind, recipient_emails = v_emails, updated_at = clock_timestamp()
  WHERE id = p_id RETURNING * INTO v_campaign;
  RETURN to_jsonb(v_campaign);
END;
$$;

CREATE FUNCTION public.rpc_start_mailing_campaign(p_id UUID, p_recipients JSONB, p_expected_updated_at TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_campaign public.mailing_campaigns%ROWTYPE;
  v_count INTEGER;
BEGIN
  SELECT * INTO v_campaign FROM public.mailing_campaigns WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campagne introuvable.'; END IF;
  IF v_campaign.status <> 'draft' THEN RETURN to_jsonb(v_campaign); END IF;
  IF p_expected_updated_at IS DISTINCT FROM v_campaign.updated_at THEN
    RAISE EXCEPTION 'Le brouillon a changé. Rechargez la campagne avant son lancement.';
  END IF;
  IF jsonb_typeof(p_recipients) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Destinataires invalides.'; END IF;
  IF jsonb_array_length(p_recipients) > 10000 THEN RAISE EXCEPTION 'Maximum 10000 destinataires.'; END IF;

  INSERT INTO public.mailing_recipients (campaign_id, email, first_name)
  SELECT p_id, lower(btrim(r.email)), left(coalesce(r.first_name, ''), 120)
  FROM jsonb_to_recordset(p_recipients) AS r(email TEXT, first_name TEXT)
  WHERE lower(btrim(r.email)) = ANY(v_campaign.recipient_emails)
    AND public.rpc_mailing_recipient_eligible(lower(btrim(r.email)), v_campaign.kind)
  ON CONFLICT (campaign_id, email) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RAISE EXCEPTION 'Aucun destinataire éligible dans cette campagne.'; END IF;

  UPDATE public.mailing_campaigns SET status = 'sending', started_at = clock_timestamp(),
    recipient_emails = ARRAY(SELECT email FROM public.mailing_recipients WHERE campaign_id = p_id ORDER BY email)
  WHERE id = p_id;
  PERFORM public.mailing_refresh_counts(p_id);
  SELECT * INTO v_campaign FROM public.mailing_campaigns WHERE id = p_id;
  RETURN to_jsonb(v_campaign);
END;
$$;

CREATE FUNCTION public.rpc_claim_mailing_recipient(p_campaign_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_campaign public.mailing_campaigns%ROWTYPE;
  v_recipient public.mailing_recipients%ROWTYPE;
  v_last_claim TIMESTAMPTZ;
BEGIN
  SELECT last_claimed_at INTO v_last_claim FROM public.mailing_dispatch_state WHERE id = true FOR UPDATE;
  SELECT * INTO v_campaign FROM public.mailing_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campagne introuvable.'; END IF;
  IF v_campaign.status <> 'sending' THEN RETURN NULL; END IF;

  UPDATE public.mailing_recipients SET status = 'uncertain', updated_at = clock_timestamp(),
    error = 'Envoi interrompu : résultat inconnu. Aucun nouvel essai automatique.'
  WHERE campaign_id = p_campaign_id AND status = 'processing'
    AND claimed_at < clock_timestamp() - interval '5 minutes';
  PERFORM public.mailing_refresh_counts(p_campaign_id);

  IF EXISTS (SELECT 1 FROM public.mailing_recipients WHERE campaign_id = p_campaign_id AND status = 'processing')
    OR v_last_claim > clock_timestamp() - interval '1 second' THEN RETURN NULL; END IF;
  SELECT * INTO v_recipient FROM public.mailing_recipients
    WHERE campaign_id = p_campaign_id AND status = 'pending' ORDER BY id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.mailing_recipients SET status = 'processing', claimed_at = clock_timestamp(), updated_at = clock_timestamp()
    WHERE id = v_recipient.id RETURNING * INTO v_recipient;
  UPDATE public.mailing_dispatch_state SET last_claimed_at = clock_timestamp() WHERE id = true;
  PERFORM public.mailing_refresh_counts(p_campaign_id);
  SELECT * INTO v_campaign FROM public.mailing_campaigns WHERE id = p_campaign_id;
  RETURN jsonb_build_object('campaign', to_jsonb(v_campaign), 'recipient', to_jsonb(v_recipient));
END;
$$;

CREATE FUNCTION public.rpc_finish_mailing_recipient(p_recipient_id UUID, p_status TEXT, p_error TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_campaign_id UUID;
  v_recipient public.mailing_recipients%ROWTYPE;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('sent', 'failed', 'skipped', 'uncertain') THEN RAISE EXCEPTION 'Résultat invalide.'; END IF;
  SELECT campaign_id INTO v_campaign_id FROM public.mailing_recipients WHERE id = p_recipient_id;
  -- Account deletion may erase the row while an external SMTP request finishes.
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM 1 FROM public.mailing_campaigns WHERE id = v_campaign_id FOR UPDATE;
  SELECT * INTO v_recipient FROM public.mailing_recipients WHERE id = p_recipient_id FOR UPDATE;
  IF NOT FOUND OR v_recipient.status NOT IN ('processing', 'uncertain') THEN RETURN; END IF;
  UPDATE public.mailing_recipients SET status = p_status,
    error = CASE WHEN p_status = 'sent' THEN NULL ELSE left(p_error, 1000) END,
    sent_at = CASE WHEN p_status = 'sent' THEN clock_timestamp() ELSE NULL END,
    updated_at = clock_timestamp()
  WHERE id = p_recipient_id;
  IF p_status = 'sent' THEN
    UPDATE public.newsletter_subscribers SET last_contacted_at = clock_timestamp(), updated_at = clock_timestamp()
    WHERE email_normalized = v_recipient.email;
  END IF;
  PERFORM public.mailing_refresh_counts(v_campaign_id);
END;
$$;

CREATE FUNCTION public.rpc_delete_mailing_contact(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_email TEXT := lower(btrim(p_email));
  v_campaign_id UUID;
BEGIN
  -- Use the same campaign-first lock order as dispatch completion and start.
  FOR v_campaign_id IN SELECT id FROM public.mailing_campaigns
    WHERE v_email = ANY(recipient_emails)
      OR id IN (SELECT campaign_id FROM public.mailing_recipients WHERE email = v_email)
    ORDER BY id FOR UPDATE
  LOOP
    DELETE FROM public.mailing_recipients WHERE campaign_id = v_campaign_id AND email = v_email;
    UPDATE public.mailing_campaigns SET recipient_emails = array_remove(recipient_emails, v_email), updated_at = clock_timestamp()
      WHERE id = v_campaign_id;
    PERFORM public.mailing_refresh_counts(v_campaign_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.mailing_refresh_counts(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_mailing_recipient_eligible(TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_save_mailing_draft(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_start_mailing_campaign(UUID, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_claim_mailing_recipient(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_finish_mailing_recipient(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_delete_mailing_contact(TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_mailing_recipient_eligible(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_save_mailing_draft(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_start_mailing_campaign(UUID, JSONB, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_claim_mailing_recipient(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finish_mailing_recipient(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_delete_mailing_contact(TEXT) TO service_role;

COMMIT;
