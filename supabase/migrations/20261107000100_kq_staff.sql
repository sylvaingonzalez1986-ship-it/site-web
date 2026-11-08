BEGIN;

-- The application server owns the simulation. SQL serializes it with commerce,
-- validates bounded effects, and keeps permanent receipts and real cash atomic.
CREATE TABLE public.kq_staff_accounts (
 user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 state JSONB CHECK(state IS NULL OR (jsonb_typeof(state)='object' AND state->'version'='1'::JSONB)),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.kq_staff_receipts (
 user_id UUID NOT NULL REFERENCES public.kq_staff_accounts(user_id) ON DELETE CASCADE,
 request_key UUID NOT NULL,
 command JSONB NOT NULL CHECK(jsonb_typeof(command)='object'),
 result JSONB NOT NULL CHECK(jsonb_typeof(result)='object'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_key)
);
ALTER TABLE public.kq_staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_staff_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_staff_accounts FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON TABLE public.kq_staff_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_staff_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('state',a.state,'revision',a.revision,'serverNow',now(),'cashCents',w.cash_cents,
  'context',jsonb_build_object('businessStartedAt',COALESCE(c.business_started_at,w.created_at),'reputation',w.reputation,
   'instagramFollowers',COALESCE((SELECT followers FROM public.kq_social_platforms WHERE user_id=p_user AND platform='instagram'),0),
   'shopPartners',COALESCE(c.shop_partners,0),
   'activeRuns',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'name',COALESCE(r.state->>'varietyName','Culture')) ORDER BY r.started_at,r.id)
    FROM public.kq_runs r WHERE r.user_id=p_user AND r.status::TEXT='active' AND r.state->'rulesVersion'='3'::JSONB
     AND r.state->>'phase' IN ('prepare','rolled','resolved')
     AND (r.campaign_id IS NULL OR r.id::TEXT=r.state->'campaign'->>'leaderRunId')),'[]'::JSONB),
   'processingBatches',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',b.flower_id,'flowerId',b.flower_id,
     'name',COALESCE(f.variety_name,'Lot'),'startedAt',b.processing_started_at,'readyAt',b.processing_ready_at)
     ORDER BY b.processing_ready_at,b.flower_id)
    FROM public.kq_commerce_batches b LEFT JOIN public.kq_flowers f ON f.id=b.flower_id
    WHERE b.user_id=p_user AND b.processing_started_at<=now() AND b.processing_ready_at>now()),'[]'::JSONB),
   'supplierInvoices',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'remainingCents',i.remaining_cents,'dueAt',i.due_at)
     ORDER BY i.due_at,i.id) FROM public.kq_supplier_invoices i WHERE i.user_id=p_user AND i.remaining_cents>0),'[]'::JSONB)))
 FROM public.kq_staff_accounts a JOIN public.kq_equipment_wallets w USING(user_id)
 LEFT JOIN public.kq_commerce_accounts c USING(user_id) WHERE a.user_id=p_user;
$$;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_staff_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'staff_invalid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 IF NOT EXISTS(SELECT 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'staff_profile'; END IF;
 PERFORM public.kq_business_settle(p_user_id);
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 INSERT INTO public.kq_staff_accounts(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 RETURN public.kq_staff_snapshot(p_user_id);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_staff_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_staff_snapshot(UUID) TO service_role;

-- Check the permanent receipt before the server evaluates current eligibility.
-- Retrying an already completed hire/leave/payment must not fail because its
-- original preconditions have changed. A missing receipt has no write effects.
CREATE FUNCTION public.rpc_kq_staff_receipt(p_user_id UUID,p_request_key UUID,p_command JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous public.kq_staff_receipts%ROWTYPE;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR jsonb_typeof(p_command) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 SELECT * INTO previous FROM public.kq_staff_receipts WHERE user_id=p_user_id AND request_key=p_request_key;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF previous.command IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'staff_request_mismatch'; END IF;
 RETURN public.kq_staff_snapshot(p_user_id)||jsonb_build_object('replayed',true);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_staff_receipt(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_staff_receipt(UUID,UUID,JSONB) TO service_role;

CREATE FUNCTION public.rpc_kq_staff_commit(p_user_id UUID,p_expected_revision INTEGER,p_request_key UUID,
 p_command JSONB,p_state JSONB,p_debit_cents INTEGER,p_effects JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE account public.kq_staff_accounts%ROWTYPE; previous public.kq_staff_receipts%ROWTYPE;
 cash INTEGER; effect JSONB; field TEXT; effect_kind TEXT; delta INTEGER; audience INTEGER;
 instagram_count INTEGER; total_followers INTEGER; next_run JSONB; care JSONB; run public.kq_runs%ROWTYPE;
 invoice public.kq_supplier_invoices%ROWTYPE; payment JSONB; result JSONB; social JSONB;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR jsonb_typeof(p_command) IS DISTINCT FROM 'object'
  OR COALESCE(p_command->>'action','') NOT IN ('hire','assign','train','extra-hours','payroll','pay-invoice','leave','cancel-leave','settle')
 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 -- Replays are resolved before CAS or any new financial settlement.
 SELECT * INTO previous FROM public.kq_staff_receipts WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF previous.command IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'staff_request_mismatch'; END IF;
  RETURN public.kq_staff_snapshot(p_user_id)||jsonb_build_object('replayed',true);
 END IF;
 IF p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 0 AND 2147483646
  OR p_debit_cents IS NULL OR p_debit_cents NOT BETWEEN 0 AND 100000000
  OR jsonb_typeof(p_state) IS DISTINCT FROM 'object' OR p_state->'version' IS DISTINCT FROM '1'::JSONB
  OR jsonb_typeof(p_state->'employees') IS DISTINCT FROM 'array' OR jsonb_array_length(p_state->'employees')>40
  OR jsonb_typeof(p_state->'tasks') IS DISTINCT FROM 'array' OR jsonb_array_length(p_state->'tasks')>1000
  OR jsonb_typeof(p_state->'payroll') IS DISTINCT FROM 'array' OR jsonb_array_length(p_state->'payroll')>4000
  OR octet_length(p_state::TEXT)>2000000
  OR jsonb_typeof(p_state->'supplierDiscountPercent') IS DISTINCT FROM 'number'
  OR COALESCE(p_state->>'supplierDiscountPercent','') !~ '^[0-9]{1,2}$'
  OR (p_state->>'supplierDiscountPercent')::INTEGER NOT BETWEEN 0 AND 10
  OR jsonb_typeof(p_state->'lastSettledAt') IS DISTINCT FROM 'string'
  OR (p_state->>'lastSettledAt')::TIMESTAMPTZ>now()+interval '1 second'
  OR (p_state->>'lastSettledAt')::TIMESTAMPTZ<now()-interval '5 minutes'
  OR jsonb_typeof(p_state->'supplierDiscountUntil') IS NULL
  OR jsonb_typeof(p_state->'supplierDiscountUntil') NOT IN ('string','null')
  OR (p_state->>'supplierDiscountUntil')::TIMESTAMPTZ>now()+interval '30 days'
  OR jsonb_typeof(p_effects) IS DISTINCT FROM 'array' OR jsonb_array_length(p_effects)>1000
 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'staff_profile'; END IF;
 -- This settles elapsed sales with OLD audience/reputation before staff rewards.
 PERFORM public.kq_business_settle(p_user_id);
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 INSERT INTO public.kq_staff_accounts(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO account FROM public.kq_staff_accounts WHERE user_id=p_user_id FOR UPDATE;
 IF account.revision<>p_expected_revision THEN RAISE EXCEPTION 'staff_changed'; END IF;
 IF (p_state->>'lastSettledAt')::TIMESTAMPTZ<(account.state->>'lastSettledAt')::TIMESTAMPTZ THEN RAISE EXCEPTION 'staff_changed'; END IF;
 IF cash<p_debit_cents THEN RAISE EXCEPTION 'staff_cash'; END IF;
 PERFORM public.kq_treasury_initialize(p_user_id);
 IF p_debit_cents>0 THEN
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-p_debit_cents,updated_at=now() WHERE user_id=p_user_id;
  -- Wallet observers already post cash/suspense; record the expense only once.
  PERFORM public.kq_treasury_pair(p_user_id,'staff-cost','staff-cost:'||p_request_key::TEXT,now(),
   'expense_other','suspense',p_debit_cents,'Personnel · '||(p_command->>'action'));
 END IF;
 FOR effect IN SELECT item FROM jsonb_array_elements(p_effects) item LOOP
  effect_kind:=effect->>'kind';
  IF jsonb_typeof(effect) IS DISTINCT FROM 'object' OR effect_kind IS NULL THEN RAISE EXCEPTION 'staff_invalid'; END IF;
  IF effect_kind='culture' THEN
   FOREACH field IN ARRAY ARRAY['vitalityDelta','terpenesDelta','yieldBonusDelta','cannabinoidDelta'] LOOP
    IF jsonb_typeof(effect->field) IS DISTINCT FROM 'number' OR COALESCE(effect->>field,'') !~ '^[0-9]{1,2}$'
     OR (effect->>field)::INTEGER>(CASE field WHEN 'vitalityDelta' THEN 10 WHEN 'yieldBonusDelta' THEN 2 ELSE 5 END)
    THEN RAISE EXCEPTION 'staff_invalid'; END IF;
   END LOOP;
   IF COALESCE(effect->>'runId','') !~* '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'staff_invalid'; END IF;
   SELECT * INTO run FROM public.kq_runs WHERE id=(effect->>'runId')::UUID AND user_id=p_user_id FOR UPDATE;
   -- A culture can finish while a staff task is running. Never revive it or
   -- overwrite a projected campaign member that its leader would replace.
   IF NOT FOUND OR run.status::TEXT<>'active' OR run.state->'rulesVersion' IS DISTINCT FROM '3'::JSONB
    OR run.state->>'phase' NOT IN ('prepare','rolled','resolved')
    OR (run.campaign_id IS NOT NULL AND run.id::TEXT IS DISTINCT FROM run.state->'campaign'->>'leaderRunId') THEN CONTINUE; END IF;
   care:=run.state->'care';
   IF NOT public.kq_care_state_valid(care) THEN RAISE EXCEPTION 'staff_changed'; END IF;
   care:=jsonb_set(care,'{vitality}',to_jsonb(LEAST(100,(care->>'vitality')::INTEGER+(effect->>'vitalityDelta')::INTEGER)));
   care:=jsonb_set(care,'{terpenes}',to_jsonb(LEAST(99,(care->>'terpenes')::INTEGER+(effect->>'terpenesDelta')::INTEGER)));
   care:=jsonb_set(care,'{yieldBonusPercent}',to_jsonb(LEAST(10,(care->>'yieldBonusPercent')::INTEGER+(effect->>'yieldBonusDelta')::INTEGER)));
   care:=jsonb_set(care,'{cannabinoidExpression}',to_jsonb(LEAST(99,(care->>'cannabinoidExpression')::INTEGER+(effect->>'cannabinoidDelta')::INTEGER)));
   next_run:=jsonb_set(run.state,'{care}',care);
   UPDATE public.kq_runs SET state=next_run,updated_at=GREATEST(clock_timestamp(),run.updated_at+interval '1 microsecond') WHERE id=run.id;
  ELSIF effect_kind='processing' THEN
   IF COALESCE(effect->>'flowerId','') !~* '^[0-9a-f-]{36}$'
    OR jsonb_typeof(effect->'secondsSaved') IS DISTINCT FROM 'number' OR COALESCE(effect->>'secondsSaved','') !~ '^[0-9]{1,4}$'
    OR (effect->>'secondsSaved')::INTEGER NOT BETWEEN 0 AND 3600 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
   -- Only an already-running machine can be helped. Future reservations keep
   -- their start/end, so sharing equipment cannot create overlapping jobs.
   UPDATE public.kq_commerce_batches SET processing_ready_at=GREATEST(now(),processing_ready_at-(effect->>'secondsSaved')::INTEGER*interval '1 second')
    WHERE flower_id=(effect->>'flowerId')::UUID AND user_id=p_user_id AND processing_started_at<=now() AND processing_ready_at>now();
  ELSIF effect_kind IN ('communication','sales') THEN
   IF jsonb_typeof(effect->'reputation') IS DISTINCT FROM 'number' OR COALESCE(effect->>'reputation','') !~ '^[0-9]{1,2}$'
    OR (effect->>'reputation')::INTEGER NOT BETWEEN 0 AND 25 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
   UPDATE public.kq_equipment_wallets SET reputation=LEAST(2147483647,reputation::BIGINT+(effect->>'reputation')::INTEGER),updated_at=now()
    WHERE user_id=p_user_id;
   IF effect_kind='communication' THEN
    IF jsonb_typeof(effect->'instagramFollowers') IS DISTINCT FROM 'number' OR COALESCE(effect->>'instagramFollowers','') !~ '^[0-9]{1,3}$'
     OR (effect->>'instagramFollowers')::INTEGER NOT BETWEEN 0 AND 500 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
    INSERT INTO public.kq_social_accounts(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.kq_social_platforms(user_id,platform) VALUES(p_user_id,'instagram'),(p_user_id,'x') ON CONFLICT DO NOTHING;
    SELECT followers INTO audience FROM public.kq_online_accounts WHERE user_id=p_user_id FOR UPDATE;
    SELECT p.followers INTO instagram_count FROM public.kq_social_platforms p WHERE p.user_id=p_user_id AND p.platform='instagram' FOR UPDATE;
    delta:=LEAST((effect->>'instagramFollowers')::INTEGER,50000-instagram_count,100000-audience);
    UPDATE public.kq_social_platforms SET followers=instagram_count+delta WHERE user_id=p_user_id AND platform='instagram';
    UPDATE public.kq_online_accounts SET followers=audience+delta,revision=revision+1 WHERE user_id=p_user_id;
    SELECT sum(p.followers)::INTEGER INTO total_followers FROM public.kq_social_platforms p WHERE p.user_id=p_user_id;
    social:=public.kq_social_snapshot(p_user_id);
    UPDATE public.kq_social_accounts SET revision=revision+1,game_state=CASE WHEN game_state IS NULL THEN NULL ELSE
     jsonb_set(jsonb_set(game_state,'{platforms,instagram,followers}',to_jsonb(instagram_count+delta)),'{revision}',to_jsonb(revision+1))
      ||jsonb_build_object('audienceFollowers',audience+delta,'socialFollowers',total_followers,
         'additionalVisitsPerDay',social->'additionalVisitsPerDay','serverNow',now()) END WHERE user_id=p_user_id;
   ELSE
    IF jsonb_typeof(effect->'shopPartners') IS DISTINCT FROM 'number' OR COALESCE(effect->>'shopPartners','') !~ '^[0-9]$'
     OR (effect->>'shopPartners')::INTEGER NOT BETWEEN 0 AND 2 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
    SELECT LEAST(20-shop_partners,(effect->>'shopPartners')::INTEGER) INTO delta FROM public.kq_commerce_accounts WHERE user_id=p_user_id FOR UPDATE;
    UPDATE public.kq_commerce_accounts SET shop_partners=shop_partners+delta WHERE user_id=p_user_id;
    -- Recruitment is external to current sales. Carry it into the baseline so
    -- the next sale does not recompute and erase the new partnership.
    UPDATE public.kq_commerce_campaigns c SET shop_partners_start=LEAST(20,shop_partners_start+delta),revision=c.revision+1
     FROM public.kq_commerce_accounts a WHERE a.user_id=p_user_id AND c.run_id=a.current_run_id;
   END IF;
  ELSIF effect_kind='supplier-payment' THEN
   IF p_command->>'action' IS DISTINCT FROM 'pay-invoice'
    OR effect->>'invoiceId' IS DISTINCT FROM p_command->>'invoiceId'
    OR effect->'amountCents' IS DISTINCT FROM p_command->'expectedCents'
    OR COALESCE(effect->>'invoiceId','') !~* '^[0-9a-f-]{36}$'
    OR jsonb_typeof(effect->'amountCents') IS DISTINCT FROM 'number'
    OR COALESCE(effect->>'amountCents','') !~ '^[0-9]{1,10}$'
    OR (effect->>'amountCents')::BIGINT NOT BETWEEN 1 AND 2147483647 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
   SELECT * INTO invoice FROM public.kq_supplier_invoices WHERE id=(effect->>'invoiceId')::UUID AND user_id=p_user_id FOR UPDATE;
   IF NOT FOUND OR invoice.remaining_cents<>(effect->>'amountCents')::INTEGER THEN RAISE EXCEPTION 'staff_changed'; END IF;
   SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
   IF cash<invoice.remaining_cents THEN RAISE EXCEPTION 'staff_cash'; END IF;
   -- Existing command charges the wallet, updates the invoice and records its
   -- payable settlement. The staff debit above does not include this payment.
   payment:=public.kq_business_command(p_user_id,'pay-supplier',jsonb_build_object('invoiceId',invoice.id));
   IF (payment->>'paidCents')::INTEGER IS DISTINCT FROM invoice.remaining_cents THEN RAISE EXCEPTION 'staff_changed'; END IF;
  ELSE RAISE EXCEPTION 'staff_invalid'; END IF;
 END LOOP;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 UPDATE public.kq_staff_accounts SET state=p_state,revision=revision+1,updated_at=now() WHERE user_id=p_user_id;
 result:=public.kq_staff_snapshot(p_user_id)||jsonb_build_object('replayed',false);
 INSERT INTO public.kq_staff_receipts(user_id,request_key,command,result) VALUES(p_user_id,p_request_key,p_command,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_staff_commit(UUID,INTEGER,UUID,JSONB,JSONB,INTEGER,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_staff_commit(UUID,INTEGER,UUID,JSONB,JSONB,INTEGER,JSONB) TO service_role;

-- Negotiations apply prospectively to newly delivered supplies only. Run input
-- snapshots, already issued debts and prior receipts remain immutable.
CREATE FUNCTION public.kq_staff_supplier_discount() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE staff JSONB; discount INTEGER;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||NEW.user_id::TEXT,0));
 SELECT state INTO staff FROM public.kq_staff_accounts WHERE user_id=NEW.user_id;
 IF staff IS NULL OR NEW.remaining_cents<>NEW.amount_cents
  OR COALESCE((staff->>'supplierDiscountUntil')::TIMESTAMPTZ<=now(),true) THEN RETURN NEW; END IF;
 discount:=LEAST(10,GREATEST(0,COALESCE((staff->>'supplierDiscountPercent')::INTEGER,0)));
 NEW.amount_cents:=GREATEST(1,NEW.amount_cents-floor(NEW.amount_cents::NUMERIC*discount/100)::INTEGER);
 NEW.remaining_cents:=NEW.amount_cents;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_supplier_discount() FROM PUBLIC,anon,authenticated,service_role;
-- Alphabetic ordering places the actual discounted amount before accounting.
CREATE TRIGGER aaa_kq_staff_supplier_discount BEFORE INSERT ON public.kq_supplier_invoices
 FOR EACH ROW EXECUTE FUNCTION public.kq_staff_supplier_discount();
DO $$ DECLARE body TEXT; anchor TEXT:='VALUES(NEW.user_id,''supplier-issued'',cost);'; BEGIN
 SELECT pg_get_functiondef('public.kq_invoice_warehouse_consumables()'::regprocedure) INTO body;
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'staff_supplier_patch_drift'; END IF;
 EXECUTE replace(body,anchor,'VALUES(NEW.user_id,''supplier-issued'',(SELECT amount_cents FROM public.kq_supplier_invoices WHERE run_id=NEW.id));');
END $$;

COMMIT;
