BEGIN;

-- Calendar v1: four real hours per game day, 120 real hours per business month.
-- Existing computers/stocks survive; no historical harvest or sale is invoiced.
ALTER TABLE public.kq_commerce_accounts
 ADD COLUMN business_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 ADD COLUMN shop_name TEXT CHECK(shop_name IS NULL OR char_length(shop_name) BETWEEN 3 AND 40),
 ADD COLUMN shop_created_at TIMESTAMPTZ,
 ADD COLUMN shop_paid_until TIMESTAMPTZ,
 ADD COLUMN shop_renew BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN shop_suspended BOOLEAN NOT NULL DEFAULT true,
 ADD COLUMN advertising JSONB,
 ADD COLUMN domiciliation_mode TEXT NOT NULL DEFAULT 'home' CHECK(domiciliation_mode IN ('home','external')),
 ADD COLUMN domiciliation_paid_until TIMESTAMPTZ,
 ADD COLUMN domiciliation_renew BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN vat_sales_ttc_cents BIGINT NOT NULL DEFAULT 0 CHECK(vat_sales_ttc_cents>=0),
 ADD COLUMN vat_reserved_cents BIGINT NOT NULL DEFAULT 0 CHECK(vat_reserved_cents>=0),
 ADD COLUMN vat_paid_cents BIGINT NOT NULL DEFAULT 0 CHECK(vat_paid_cents>=0),
 ADD COLUMN vat_next_settlement_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '120 hours';
ALTER TABLE public.kq_commerce_accounts DROP CONSTRAINT kq_commerce_accounts_online_demand_debt_check;
ALTER TABLE public.kq_commerce_accounts ADD CHECK(online_demand_debt>=0);
UPDATE public.kq_commerce_accounts SET internet_renew=false,revision=revision+1;
UPDATE public.kq_commerce_campaigns SET internet_paid=false,revision=revision+1;
ALTER TABLE public.kq_market_sale_receipts
 ADD COLUMN vat_cents INTEGER NOT NULL DEFAULT 0 CHECK(vat_cents>=0),
 ADD COLUMN lab_paid_cents INTEGER NOT NULL DEFAULT 0 CHECK(lab_paid_cents>=0);

CREATE TABLE public.kq_lab_invoices (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 run_id UUID NOT NULL UNIQUE REFERENCES public.kq_runs(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 due_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '120 hours',
 amount_cents INTEGER NOT NULL DEFAULT 4500 CHECK(amount_cents=4500),
 remaining_cents INTEGER NOT NULL DEFAULT 4500 CHECK(remaining_cents BETWEEN 0 AND amount_cents),
 due_processed_at TIMESTAMPTZ
);
CREATE INDEX kq_lab_due ON public.kq_lab_invoices(user_id,due_at,id) WHERE remaining_cents>0;
CREATE TABLE public.kq_business_ledger (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL,
 amount_cents BIGINT NOT NULL DEFAULT 0 CHECK(amount_cents>=0),
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kq_business_ledger_user ON public.kq_business_ledger(user_id,occurred_at DESC,id);
ALTER TABLE public.kq_lab_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_business_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_lab_invoices,public.kq_business_ledger FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.kq_lab_invoices,public.kq_business_ledger TO service_role;

-- Advance in baseline-capacity units. Starting/ending an advert never deletes
-- consumption. A boosted full bucket can leave debt > 1 when the advert expires.
CREATE FUNCTION public.kq_business_advance_demand(p_user UUID,p_until TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_commerce_accounts%ROWTYPE; elapsed NUMERIC; boosted NUMERIC:=0; multiplier NUMERIC:=1;
BEGIN
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND OR p_until<=a.demand_updated_at THEN RETURN; END IF;
 elapsed:=EXTRACT(EPOCH FROM (p_until-a.demand_updated_at));
 IF a.advertising IS NOT NULL AND NOT a.shop_suspended THEN
  multiplier:=1+(a.advertising->>'boostPercent')::NUMERIC/100;
  boosted:=GREATEST(0,EXTRACT(EPOCH FROM (LEAST(p_until,a.shop_paid_until,(a.advertising->>'endsAt')::TIMESTAMPTZ)-GREATEST(a.demand_updated_at,(a.advertising->>'startedAt')::TIMESTAMPTZ))));
 END IF;
 UPDATE public.kq_commerce_accounts SET
  online_demand_debt=GREATEST(0,a.online_demand_debt-(elapsed+boosted*(multiplier-1))/14400),
  shop_demand_debt=GREATEST(0,a.shop_demand_debt-elapsed/43200),demand_updated_at=p_until
 WHERE user_id=p_user;
END $$;

CREATE FUNCTION public.kq_business_settle(p_user UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_commerce_accounts%ROWTYPE; cash INTEGER; event_at TIMESTAMPTZ; lab_at TIMESTAMPTZ;
 invoice public.kq_lab_invoices%ROWTYPE; periods BIGINT; changed BOOLEAN:=false;
BEGIN
 IF p_user IS NULL THEN RAISE EXCEPTION 'commerce_user_invalid'; END IF;
 PERFORM public.rpc_kq_ensure_equipment_profile(p_user);
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 INSERT INTO public.kq_commerce_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user FOR UPDATE;
 LOOP
  SELECT MIN(due_at) INTO lab_at FROM public.kq_lab_invoices WHERE user_id=p_user AND remaining_cents>0 AND due_processed_at IS NULL;
  event_at:=LEAST(a.vat_next_settlement_at,
   CASE WHEN NOT a.shop_suspended THEN a.shop_paid_until END,
   (a.advertising->>'endsAt')::TIMESTAMPTZ,lab_at,
   CASE WHEN a.domiciliation_mode='external' THEN a.domiciliation_paid_until END);
  EXIT WHEN event_at IS NULL OR event_at>now();
  PERFORM public.kq_business_advance_demand(p_user,event_at);
  changed:=true;
  -- VAT is already outside the wallet. Empty months are skipped in one step.
  IF a.vat_next_settlement_at=event_at THEN
   IF a.vat_reserved_cents>0 THEN
    INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user,'vat-paid',a.vat_reserved_cents,event_at);
   END IF;
   periods:=floor(EXTRACT(EPOCH FROM (now()-a.vat_next_settlement_at))/432000)+1;
   UPDATE public.kq_commerce_accounts SET vat_paid_cents=vat_paid_cents+vat_reserved_cents,vat_reserved_cents=0,
    vat_next_settlement_at=vat_next_settlement_at+periods*interval '120 hours' WHERE user_id=p_user;
  END IF;
  -- At equal deadlines laboratory invoices take priority over site renewal.
  FOR invoice IN SELECT * FROM public.kq_lab_invoices WHERE user_id=p_user AND due_at=event_at AND remaining_cents>0 AND due_processed_at IS NULL ORDER BY id FOR UPDATE LOOP
   IF cash>=invoice.remaining_cents THEN
    cash:=cash-invoice.remaining_cents;
    UPDATE public.kq_lab_invoices SET remaining_cents=0,due_processed_at=event_at WHERE id=invoice.id;
    INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user,'lab-paid',invoice.remaining_cents,event_at);
   ELSE
    UPDATE public.kq_lab_invoices SET due_processed_at=event_at WHERE id=invoice.id;
    INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user,'lab-overdue',invoice.remaining_cents,event_at);
   END IF;
  END LOOP;
  IF NOT a.shop_suspended AND a.shop_paid_until=event_at THEN
   IF a.shop_renew AND cash>=10000 THEN
    cash:=cash-10000;
    UPDATE public.kq_commerce_accounts SET shop_paid_until=shop_paid_until+interval '120 hours' WHERE user_id=p_user;
    INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user,'shop-renewed',10000,event_at);
   ELSE
    UPDATE public.kq_commerce_accounts SET shop_suspended=true WHERE user_id=p_user;
    INSERT INTO public.kq_business_ledger(user_id,kind,occurred_at) VALUES(p_user,'shop-suspended',event_at);
   END IF;
  END IF;
  IF a.domiciliation_mode='external' AND a.domiciliation_paid_until=event_at THEN
   IF a.domiciliation_renew AND cash>=5000 THEN
    cash:=cash-5000;
    UPDATE public.kq_commerce_accounts SET domiciliation_paid_until=domiciliation_paid_until+interval '120 hours' WHERE user_id=p_user;
    INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user,'domicile-paid',5000,event_at);
   ELSE
    UPDATE public.kq_commerce_accounts SET domiciliation_mode='home',domiciliation_renew=false WHERE user_id=p_user;
    INSERT INTO public.kq_business_ledger(user_id,kind,occurred_at) VALUES(p_user,'domicile-expired',event_at);
   END IF;
  END IF;
  IF (a.advertising->>'endsAt')::TIMESTAMPTZ=event_at THEN
   UPDATE public.kq_commerce_accounts SET advertising=NULL WHERE user_id=p_user;
   INSERT INTO public.kq_business_ledger(user_id,kind,occurred_at) VALUES(p_user,'advertising-ended',event_at);
  END IF;
  SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user;
 END LOOP;
 PERFORM public.kq_business_advance_demand(p_user,now());
 IF changed THEN
  UPDATE public.kq_equipment_wallets SET cash_cents=cash,updated_at=now() WHERE user_id=p_user;
  UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user;
 END IF;
 UPDATE public.kq_commerce_campaigns SET internet_paid=(a.shop_created_at IS NOT NULL AND NOT a.shop_suspended AND a.shop_paid_until>now())
 WHERE run_id=a.current_run_id AND internet_paid IS DISTINCT FROM (a.shop_created_at IS NOT NULL AND NOT a.shop_suspended AND a.shop_paid_until>now());
END $$;

CREATE FUNCTION public.kq_business_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('version',1,'serverNow',now(),'startedAt',a.business_started_at,
 'shop',jsonb_build_object('name',a.shop_name,'createdAt',a.shop_created_at,'paidUntil',a.shop_paid_until,'renew',a.shop_renew,
  'active',a.shop_created_at IS NOT NULL AND NOT a.shop_suspended AND a.shop_paid_until>now()),
 'advertising',a.advertising,
 'domiciliation',jsonb_build_object('mode',a.domiciliation_mode,'paidUntil',a.domiciliation_paid_until,'renew',a.domiciliation_renew,
  'active',a.domiciliation_mode='external' AND a.domiciliation_paid_until>now()),
 'vat',jsonb_build_object('ratePercent',20,'reservedCents',a.vat_reserved_cents,'paidCents',a.vat_paid_cents,'salesTtcCents',a.vat_sales_ttc_cents,'nextSettlementAt',a.vat_next_settlement_at),
 'lab',jsonb_build_object('outstandingCents',COALESCE((SELECT SUM(remaining_cents) FROM public.kq_lab_invoices WHERE user_id=p_user),0),
  'overdueCents',COALESCE((SELECT SUM(remaining_cents) FROM public.kq_lab_invoices WHERE user_id=p_user AND due_at<=now()),0),
  'invoices',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'runId',i.run_id,'issuedAt',i.issued_at,'dueAt',i.due_at,'amountCents',i.amount_cents,'remainingCents',i.remaining_cents) ORDER BY i.due_at,i.id)
   FROM public.kq_lab_invoices i WHERE i.user_id=p_user AND i.remaining_cents>0),'[]'::JSONB)),
 'nextEventAt',LEAST(a.vat_next_settlement_at,CASE WHEN NOT a.shop_suspended THEN a.shop_paid_until END,(a.advertising->>'endsAt')::TIMESTAMPTZ,
  (SELECT MIN(due_at) FROM public.kq_lab_invoices WHERE user_id=p_user AND remaining_cents>0 AND due_processed_at IS NULL),
  CASE WHEN a.domiciliation_mode='external' THEN a.domiciliation_paid_until END),
 'ledger',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'kind',l.kind,'amountCents',l.amount_cents,'occurredAt',l.occurred_at) ORDER BY l.occurred_at DESC,l.id)
  FROM (SELECT * FROM public.kq_business_ledger WHERE user_id=p_user ORDER BY occurred_at DESC,id LIMIT 30) l),'[]'::JSONB))
 FROM public.kq_commerce_accounts a WHERE user_id=p_user;
$$;

CREATE FUNCTION public.kq_invoice_completed_lab() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status::TEXT='completed' AND OLD.status::TEXT<>'completed' THEN
  PERFORM public.kq_business_settle(NEW.user_id);
  INSERT INTO public.kq_lab_invoices(run_id,user_id) VALUES(NEW.id,NEW.user_id) ON CONFLICT(run_id) DO NOTHING;
  IF FOUND THEN
   INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents) VALUES(NEW.user_id,'lab-issued',4500);
   UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=NEW.user_id;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_invoice_completed_lab AFTER UPDATE OF status ON public.kq_runs FOR EACH ROW EXECUTE FUNCTION public.kq_invoice_completed_lab();

CREATE FUNCTION public.kq_business_sale_preview(p_user UUID,p_payout INTEGER) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH tax AS (SELECT (ROUND((vat_sales_ttc_cents+p_payout)::NUMERIC/6)-ROUND(vat_sales_ttc_cents::NUMERIC/6))::INTEGER vat FROM public.kq_commerce_accounts WHERE user_id=p_user),
 lab AS (SELECT vat,LEAST((p_payout-vat)/2,COALESCE((SELECT SUM(remaining_cents) FROM public.kq_lab_invoices WHERE user_id=p_user AND due_at<=now()),0))::INTEGER paid FROM tax),
 energy AS (SELECT vat,paid,LEAST((p_payout-vat)/2-paid,COALESCE((SELECT SUM(remaining_cents) FROM public.kq_energy_invoices WHERE user_id=p_user),0))::INTEGER paid_energy FROM lab)
 SELECT jsonb_build_object('vatCents',vat,'labPaidCents',paid,'electricityPaidCents',paid_energy,'netPayoutCents',p_payout-vat-paid-paid_energy) FROM energy;
$$;

CREATE FUNCTION public.kq_business_collect_sale(p_user UUID,p_payout INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE amounts JSONB; vat INTEGER; lab INTEGER; energy INTEGER; budget INTEGER; part INTEGER; invoice RECORD;
BEGIN
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 PERFORM 1 FROM public.kq_commerce_accounts WHERE user_id=p_user FOR UPDATE;
 amounts:=public.kq_business_sale_preview(p_user,p_payout);
 vat:=(amounts->>'vatCents')::INTEGER; lab:=(amounts->>'labPaidCents')::INTEGER; budget:=lab;
 UPDATE public.kq_commerce_accounts SET vat_sales_ttc_cents=vat_sales_ttc_cents+p_payout,vat_reserved_cents=vat_reserved_cents+vat WHERE user_id=p_user;
 UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-vat-lab WHERE user_id=p_user;
 FOR invoice IN SELECT id,remaining_cents FROM public.kq_lab_invoices WHERE user_id=p_user AND due_at<=now() AND remaining_cents>0 ORDER BY due_at,id FOR UPDATE LOOP
  EXIT WHEN budget<=0;
  part:=LEAST(budget,invoice.remaining_cents); budget:=budget-part;
  UPDATE public.kq_lab_invoices SET remaining_cents=remaining_cents-part WHERE id=invoice.id;
 END LOOP;
 IF lab>0 THEN INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents) VALUES(p_user,'lab-paid',lab); END IF;
 energy:=public.kq_settle_energy(p_user,(amounts->>'electricityPaidCents')::INTEGER);
 IF energy IS DISTINCT FROM (amounts->>'electricityPaidCents')::INTEGER THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
 RETURN amounts;
END $$;

CREATE FUNCTION public.kq_business_command(p_user UUID,p_action TEXT,p_payload JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_commerce_accounts%ROWTYPE; cash INTEGER; cost INTEGER:=0; shop_label TEXT; enabled BOOLEAN;
 kind TEXT; hours INTEGER; boost INTEGER; invoice public.kq_lab_invoices%ROWTYPE; ad JSONB;
BEGIN
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user FOR UPDATE;
 IF p_action IN ('create-shop','rename-shop') THEN
  IF jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'commerce_shop_name'; END IF;
  IF (p_payload->>'name') ~ '[[:cntrl:]<>]' OR (p_payload->>'name') ~ U&'[\00AD\0600-\0605\061C\06DD\070F\0890-\0891\08E2\180E\200B-\200F\202A-\202E\2060-\2064\2066-\206F\FEFF\FFF9-\FFFB\+0110BD\+0110CD\+013430-\+01343F\+01BCA0-\+01BCA3\+01D173-\+01D17A\+0E0001\+0E0020-\+0E007F]' THEN RAISE EXCEPTION 'commerce_shop_name'; END IF;
  shop_label:=normalize(trim(regexp_replace(p_payload->>'name','[[:space:]]+',' ','g')),NFC);
  IF char_length(shop_label) NOT BETWEEN 3 AND 40 THEN RAISE EXCEPTION 'commerce_shop_name'; END IF;
  IF p_action='create-shop' THEN
   IF a.shop_created_at IS NOT NULL THEN RAISE EXCEPTION 'commerce_shop_exists'; END IF;
   IF NOT a.computer_owned THEN RAISE EXCEPTION 'commerce_computer_required'; END IF;
   cost:=100000;
   IF cash<cost THEN RAISE EXCEPTION 'commerce_cash'; END IF;
   UPDATE public.kq_commerce_accounts SET shop_name=shop_label,shop_created_at=now(),shop_paid_until=now()+interval '120 hours',shop_renew=true,shop_suspended=false,internet_renew=true WHERE user_id=p_user;
  ELSE
   IF a.shop_created_at IS NULL THEN RAISE EXCEPTION 'commerce_shop_required'; END IF;
   UPDATE public.kq_commerce_accounts SET shop_name=shop_label WHERE user_id=p_user;
  END IF;
 ELSIF p_action='shop-renewal' THEN
  IF a.shop_created_at IS NULL THEN RAISE EXCEPTION 'commerce_shop_required'; END IF;
  IF jsonb_typeof(p_payload->'enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'commerce_invalid_request'; END IF;
  enabled:=(p_payload->>'enabled')::BOOLEAN;
  UPDATE public.kq_commerce_accounts SET shop_renew=enabled,internet_renew=enabled WHERE user_id=p_user;
 ELSIF p_action='renew-shop' THEN
  IF a.shop_created_at IS NULL THEN RAISE EXCEPTION 'commerce_shop_required'; END IF;
  IF NOT a.shop_suspended AND a.shop_paid_until>now() THEN RAISE EXCEPTION 'commerce_shop_active'; END IF;
  cost:=10000;
  IF cash<cost THEN RAISE EXCEPTION 'commerce_cash'; END IF;
  UPDATE public.kq_commerce_accounts SET shop_paid_until=now()+interval '120 hours',shop_suspended=false WHERE user_id=p_user;
 ELSIF p_action='advertise' THEN
  IF a.shop_created_at IS NULL OR a.shop_suspended OR a.shop_paid_until<=now() THEN RAISE EXCEPTION 'commerce_shop_required'; END IF;
  IF a.advertising IS NOT NULL THEN RAISE EXCEPTION 'commerce_ad_active'; END IF;
  kind:=p_payload->>'kind';
  CASE kind WHEN 'flyers' THEN cost:=6000; hours:=40; boost:=20;
   WHEN 'instagram' THEN cost:=15000; hours:=28; boost:=50;
   WHEN 'radio' THEN cost:=40000; hours:=20; boost:=100;
   ELSE RAISE EXCEPTION 'commerce_ad_kind'; END CASE;
  IF cash<cost THEN RAISE EXCEPTION 'commerce_cash'; END IF;
  ad:=jsonb_build_object('id',gen_random_uuid(),'kind',kind,'startedAt',now(),'endsAt',now()+hours*interval '1 hour','boostPercent',boost);
  UPDATE public.kq_commerce_accounts SET advertising=ad WHERE user_id=p_user;
 ELSIF p_action='domiciliation' THEN
  kind:=p_payload->>'mode';
  IF kind IS NULL OR kind NOT IN ('home','external') THEN RAISE EXCEPTION 'commerce_domiciliation_mode'; END IF;
  IF kind='home' THEN
   UPDATE public.kq_commerce_accounts SET domiciliation_mode='home',domiciliation_renew=false WHERE user_id=p_user;
  ELSE
   IF a.domiciliation_paid_until IS NULL OR a.domiciliation_paid_until<=now() THEN
    cost:=5000;
    IF cash<cost THEN RAISE EXCEPTION 'commerce_cash'; END IF;
    UPDATE public.kq_commerce_accounts SET domiciliation_paid_until=now()+interval '120 hours' WHERE user_id=p_user;
   END IF;
   UPDATE public.kq_commerce_accounts SET domiciliation_mode='external',domiciliation_renew=true WHERE user_id=p_user;
  END IF;
 ELSIF p_action='pay-lab' THEN
  SELECT * INTO invoice FROM public.kq_lab_invoices WHERE id=(p_payload->>'invoiceId')::UUID AND user_id=p_user FOR UPDATE;
  IF NOT FOUND OR invoice.remaining_cents=0 THEN RAISE EXCEPTION 'commerce_lab_unavailable'; END IF;
  cost:=invoice.remaining_cents;
  IF cash<cost THEN RAISE EXCEPTION 'commerce_cash'; END IF;
  UPDATE public.kq_lab_invoices SET remaining_cents=0 WHERE id=invoice.id;
 ELSE RAISE EXCEPTION 'commerce_invalid_action'; END IF;
 IF cost>0 THEN UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-cost,updated_at=now() WHERE user_id=p_user; END IF;
 INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents) VALUES(p_user,CASE p_action WHEN 'create-shop' THEN 'shop-created' WHEN 'renew-shop' THEN 'shop-renewed' WHEN 'pay-lab' THEN 'lab-paid' WHEN 'advertise' THEN 'advertising-started' WHEN 'domiciliation' THEN CASE WHEN kind='home' THEN 'domicile-home' ELSE 'domicile-paid' END ELSE p_action END,cost);
 -- Keep the legacy flag as display compatibility only; authorization uses the shop.
 UPDATE public.kq_commerce_campaigns c SET internet_paid=(x.shop_created_at IS NOT NULL AND NOT x.shop_suspended AND x.shop_paid_until>now())
 FROM public.kq_commerce_accounts x WHERE x.user_id=p_user AND c.run_id=x.current_run_id;
 RETURN jsonb_build_object('action',p_action,'paidCents',cost,'name',shop_label,'advertising',ad);
END $$;

CREATE OR REPLACE FUNCTION public.kq_commerce_demand_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('serverNow',now(),'updatedAt',a.demand_updated_at,'onlineDebt',a.online_demand_debt,'shopDebt',a.shop_demand_debt,
 'onlineCapacityMultiplier',CASE WHEN NOT a.shop_suspended AND a.shop_paid_until>now() AND (a.advertising->>'endsAt')::TIMESTAMPTZ>now() THEN 1+(a.advertising->>'boostPercent')::NUMERIC/100 ELSE 1 END,
 'growthResetsAt',c.growth_started_at+interval '24 hours')
 FROM public.kq_commerce_accounts a LEFT JOIN public.kq_commerce_campaigns c ON c.run_id=a.current_run_id WHERE a.user_id=p_user;
$$;

CREATE OR REPLACE FUNCTION public.kq_commerce_consume_demand(p_user UUID,p_offer JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_commerce_accounts%ROWTYPE; capacity JSONB; base NUMERIC; multiplier NUMERIC;
 direct_cost NUMERIC:=(p_offer->>'directCost')::NUMERIC; shop_cost NUMERIC:=(p_offer->>'shopCost')::NUMERIC; channel TEXT:=p_offer->>'channel';
BEGIN
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user FOR UPDATE;
 IF channel IS NULL OR channel NOT IN ('online','cbd-shop','wholesale') OR direct_cost IS NULL OR shop_cost IS NULL
 OR direct_cost<0 OR shop_cost<0 OR (channel<>'online' AND direct_cost<>0) OR (channel<>'cbd-shop' AND shop_cost<>0)
 OR (channel='online' AND direct_cost=0) OR (channel='cbd-shop' AND shop_cost=0) THEN RAISE EXCEPTION 'commerce_invalid_quote'; END IF;
 IF channel='wholesale' THEN RETURN; END IF;
 PERFORM public.kq_business_advance_demand(p_user,now());
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user;
 capacity:=public.kq_commerce_capacity(p_user);
 IF capacity IS NULL THEN RAISE EXCEPTION 'commerce_cycle_required'; END IF;
 base:=(capacity->>'onlineBase')::NUMERIC; multiplier:=(capacity->>'online')::NUMERIC/base;
 IF direct_cost>GREATEST(0,multiplier-a.online_demand_debt)*base+.000001
 OR shop_cost>(1-a.shop_demand_debt)*(capacity->>'cbd-shop')::NUMERIC+.000001 THEN RAISE EXCEPTION 'commerce_demand_exhausted'; END IF;
 UPDATE public.kq_commerce_accounts SET online_demand_debt=online_demand_debt+direct_cost/base,
 shop_demand_debt=LEAST(1,shop_demand_debt+shop_cost/(capacity->>'cbd-shop')::NUMERIC) WHERE user_id=p_user;
END $$;

-- Carefully extend the installed versions, preserving precision, partner, merchant,
-- route mastery, maintenance, achievements and realtime demand fixes.
DO $$
DECLARE definition TEXT; fragment TEXT; replacement TEXT;
BEGIN
 SELECT pg_get_functiondef('public.kq_commerce_capacity(uuid)'::regprocedure) INTO definition;
 fragment:='SELECT c.*,CASE';
 IF position(fragment in definition)=0 THEN RAISE EXCEPTION 'business_capacity_context_drift'; END IF;
 definition:=replace(definition,fragment,'SELECT c.*,a.advertising,a.shop_suspended,a.shop_paid_until,CASE');
 fragment:='''online'',multiplier*base*(1+.25*LEAST(1,clients_start::NUMERIC/max_clients))';
 IF position(fragment in definition)=0 THEN RAISE EXCEPTION 'business_capacity_drift'; END IF;
 replacement:=$patch$'onlineBase',multiplier*base*(1+.25*LEAST(1,clients_start::NUMERIC/max_clients)),
 'online',multiplier*base*(1+.25*LEAST(1,clients_start::NUMERIC/max_clients))*CASE WHEN NOT shop_suspended AND shop_paid_until>now() AND (advertising->>'endsAt')::TIMESTAMPTZ>now() THEN 1+(advertising->>'boostPercent')::NUMERIC/100 ELSE 1 END$patch$;
 EXECUTE replace(definition,fragment,replacement);

 SELECT replace(pg_get_functiondef('public.kq_commerce_open_cycle(uuid,uuid)'::regprocedure),E'\r\n',E'\n') INTO definition;
 fragment:=$patch$ paid:=a.computer_owned AND a.internet_renew AND w.cash_cents>=1500;
 IF paid THEN UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-1500 WHERE user_id=p_user; END IF;$patch$;
 IF position(fragment in definition)=0 THEN RAISE EXCEPTION 'business_open_cycle_drift'; END IF;
 definition:=replace(definition,fragment,' paid:=a.shop_created_at IS NOT NULL AND NOT a.shop_suspended AND a.shop_paid_until>now();');
 fragment:=' PERFORM public.rpc_kq_ensure_equipment_profile(p_user);';
 definition:=replace(definition,fragment,' PERFORM public.kq_business_settle(p_user);');
 EXECUTE definition;

 SELECT pg_get_functiondef('public.rpc_kq_commerce_state(uuid)'::regprocedure) INTO definition;
 fragment:=' PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);';
 IF position(fragment in definition)=0 THEN RAISE EXCEPTION 'business_state_drift'; END IF;
 definition:=replace(definition,fragment,' PERFORM public.kq_business_settle(p_user_id);');
 definition:=replace(definition,'RETURN jsonb_build_object(','RETURN jsonb_build_object(''business'',public.kq_business_snapshot(p_user_id),');
 EXECUTE definition;

 SELECT pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,'shop_after INTEGER; shop_price INTEGER;','shop_after INTEGER; shop_price INTEGER; charges JSONB; vat INTEGER:=0; lab INTEGER:=0;');
 fragment:=' IF p_action=''buy-computer'' THEN';
 replacement:=$patch$ IF p_action IN ('create-shop','rename-shop','shop-renewal','renew-shop','advertise','pay-lab','domiciliation') THEN
  result:=public.kq_business_command(p_user_id,p_action,p_payload);
 ELSIF p_action='buy-computer' THEN$patch$;
 IF position(fragment in definition)=0 THEN RAISE EXCEPTION 'business_actions_drift'; END IF;
 definition:=replace(definition,fragment,replacement);
 -- Remove the old subscription branch completely: cached clients cannot buy access for 15 EUR.
 fragment:=substring(definition FROM ' ELSIF p_action=''internet'' THEN[\s\S]*? ELSIF p_action=''prepare'' THEN');
 IF fragment IS NULL THEN RAISE EXCEPTION 'business_internet_drift'; END IF;
 definition:=replace(definition,fragment,E' ELSIF p_action=''internet'' THEN\n  RAISE EXCEPTION ''commerce_legacy_internet'';\n ELSIF p_action=''prepare'' THEN');
 fragment:='IF channel=''online'' AND (NOT a.computer_owned OR NOT COALESCE(c.internet_paid,false))';
 IF position(fragment in definition)=0 THEN RAISE EXCEPTION 'business_gate_drift'; END IF;
 definition:=replace(definition,fragment,'IF channel=''online'' AND (NOT a.computer_owned OR a.shop_created_at IS NULL OR a.shop_suspended OR a.shop_paid_until<=now())');
 fragment:='  delta:=GREATEST(-w.reputation,delta+bonus);';
 replacement:=$patch$  charges:=public.kq_business_sale_preview(p_user_id,payout);
  IF (offer->>'vatCents')::INTEGER IS DISTINCT FROM (charges->>'vatCents')::INTEGER
   OR (offer->>'labPaidCents')::INTEGER IS DISTINCT FROM (charges->>'labPaidCents')::INTEGER
   OR (offer->>'electricityPaidCents')::INTEGER IS DISTINCT FROM (charges->>'electricityPaidCents')::INTEGER
   OR (offer->>'netPayoutCents')::INTEGER IS DISTINCT FROM (charges->>'netPayoutCents')::INTEGER THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
  delta:=GREATEST(-w.reputation,delta+bonus);$patch$;
 IF position(fragment in definition)=0 THEN RAISE EXCEPTION 'business_preview_drift'; END IF;
 definition:=replace(definition,fragment,replacement);
 fragment:='  energy:=public.kq_settle_energy(p_user_id,payout/2);';
 replacement:=$patch$  charges:=public.kq_business_collect_sale(p_user_id,payout);
  vat:=(charges->>'vatCents')::INTEGER; lab:=(charges->>'labPaidCents')::INTEGER; energy:=(charges->>'electricityPaidCents')::INTEGER;$patch$;
 IF position(fragment in definition)=0 THEN RAISE EXCEPTION 'business_collection_drift'; END IF;
 definition:=replace(definition,fragment,replacement);
 definition:=replace(definition,'electricity_paid_cents,sales_channel','electricity_paid_cents,vat_cents,lab_paid_cents,sales_channel');
 definition:=replace(definition,'w.cash_cents-energy,w.reputation','w.cash_cents-vat-lab-energy,w.reputation');
 definition:=replace(definition,'sale_count_now,bonus,energy,channel','sale_count_now,bonus,energy,vat,lab,channel');
 definition:=replace(definition,'''electricityPaidCents'',energy,''netPayoutCents'',payout-energy','''vatCents'',vat,''labPaidCents'',lab,''electricityPaidCents'',energy,''netPayoutCents'',payout-vat-lab-energy');
 EXECUTE definition;
END $$;

-- Retire new whole-lot sales: their old pricing has no professional/online
-- channel and must not bypass the paid shop. Historical request replays survive.
DO $$
DECLARE definition TEXT; fragment TEXT; routine REGPROCEDURE;
BEGIN
 FOREACH routine IN ARRAY ARRAY['public.rpc_kq_sell_market_lot(uuid,uuid,uuid,text)'::regprocedure,'public.rpc_kq_sell_market_offer(uuid,uuid,uuid,text,text,integer,bigint)'::regprocedure] LOOP
  SELECT pg_get_functiondef(routine) INTO definition;
  fragment:='  SELECT * INTO v_lot';
  IF position(fragment in definition)=0 THEN RAISE EXCEPTION 'business_legacy_retirement_drift'; END IF;
  definition:=replace(definition,fragment,E'  RAISE EXCEPTION ''commerce_legacy_sale'';\n'||fragment);
  definition:=replace(definition,'''electricityPaidCents'', v_existing.electricity_paid_cents,','''vatCents'',v_existing.vat_cents,''labPaidCents'',v_existing.lab_paid_cents,''electricityPaidCents'', v_existing.electricity_paid_cents,');
  definition:=replace(definition,'v_existing.payout_cents-v_existing.electricity_paid_cents','v_existing.payout_cents-v_existing.vat_cents-v_existing.lab_paid_cents-v_existing.electricity_paid_cents');
  EXECUTE definition;
 END LOOP;
END $$;
-- Settle elapsed time before every existing public RPC that mutates the game
-- wallet (equipment, repairs, replacements, savings, rewards and legacy sales).
-- The profile initializer is deliberately excluded: settlement calls it itself.
DO $$
DECLARE routine RECORD; definition TEXT; patched TEXT;
BEGIN
 FOR routine IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
  WHERE n.nspname='public' AND l.lanname='plpgsql' AND p.proname LIKE 'rpc_%'
   AND p.proname NOT IN ('rpc_kq_ensure_equipment_profile','rpc_kq_commerce_command','rpc_kq_commerce_state')
   AND 'p_user_id'=ANY(p.proargnames) AND (p.prosrc ~* 'UPDATE\s+public\.kq_equipment_wallets' OR p.proname IN ('rpc_kq_pay_energy','rpc_kq_update_run_state'))
 LOOP
  definition:=pg_get_functiondef(routine.oid);
  -- Preserve any established advisory-lock-before-wallet order.
  patched:=regexp_replace(definition,'(PERFORM[[:space:]]+pg_advisory_xact_lock[^;]+;)',E'\\1\n  PERFORM public.kq_business_settle(p_user_id);');
  IF patched=definition THEN
   patched:=regexp_replace(definition,'\mBEGIN\M',E'BEGIN\n  PERFORM public.kq_business_settle(p_user_id);');
  END IF;
  IF patched=definition THEN RAISE EXCEPTION 'business_wallet_entry_drift: %',routine.oid::regprocedure; END IF;
  EXECUTE patched;
 END LOOP;
END $$;

-- Validate the address at the actual start transaction, after elapsed bills are
-- settled. The snapshot is immutable for that culture, including old missing fields.
CREATE FUNCTION public.kq_business_assert_domiciliation(p_user UUID,p_state JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE expected TEXT;
BEGIN
 -- The equipment start trigger also takes this advisory lock before the wallet.
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 PERFORM public.kq_business_settle(p_user);
 SELECT CASE WHEN domiciliation_mode='external' AND domiciliation_paid_until>now() THEN 'external' ELSE 'home' END
 INTO expected FROM public.kq_commerce_accounts WHERE user_id=p_user;
 IF p_state->>'domiciliation' IS DISTINCT FROM expected THEN RAISE EXCEPTION 'kq_domiciliation_changed'; END IF;
END $$;
DO $$
DECLARE routine RECORD; definition TEXT; patched TEXT; fragment TEXT;
BEGIN
 FOR routine IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('rpc_kq_start_run','rpc_kq_start_run_with_heritage')
   AND 'p_initial_state'=ANY(p.proargnames) AND 'p_user_id'=ANY(p.proargnames)
 LOOP
  definition:=pg_get_functiondef(routine.oid);
  patched:=regexp_replace(definition,'\mBEGIN\M',E'BEGIN\n  PERFORM public.kq_business_assert_domiciliation(p_user_id,p_initial_state);');
  IF patched=definition THEN RAISE EXCEPTION 'business_start_drift: %',routine.oid::regprocedure; END IF;
  EXECUTE patched;
 END LOOP;
 fragment:='p_next_state->''situationCodes'' IS DISTINCT FROM v_run.state->''situationCodes''';
 FOR routine IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname LIKE 'rpc_kq_%' AND position(fragment in p.prosrc)>0
 LOOP
  definition:=pg_get_functiondef(routine.oid);
  definition:=replace(definition,fragment,fragment||E'\n    OR p_next_state->''domiciliation'' IS DISTINCT FROM v_run.state->''domiciliation''');
  EXECUTE definition;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.kq_business_assert_domiciliation(UUID,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.kq_business_advance_demand(UUID,TIMESTAMPTZ),public.kq_business_settle(UUID),public.kq_business_snapshot(UUID),
 public.kq_invoice_completed_lab(),public.kq_business_sale_preview(UUID,INTEGER),public.kq_business_collect_sale(UUID,INTEGER),public.kq_business_command(UUID,TEXT,JSONB)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kq_business_settle(UUID),public.kq_business_snapshot(UUID),public.kq_business_sale_preview(UUID,INTEGER) TO service_role;
COMMIT;
