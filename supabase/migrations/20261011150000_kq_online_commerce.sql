BEGIN;

-- Online orders are a simulation of the virtual shop. One physical stock and
-- one wallet remain authoritative across retail, professional and bulk sales.
CREATE TABLE public.kq_online_accounts (
 user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 settled_until TIMESTAMPTZ NOT NULL DEFAULT now(),
 site_tier TEXT NOT NULL DEFAULT 'none' CHECK(site_tier IN ('none','basic','improved','pro')),
 photography BOOLEAN NOT NULL DEFAULT false,
 branding BOOLEAN NOT NULL DEFAULT false,
 confidence NUMERIC(12,6) NOT NULL DEFAULT 60 CHECK(confidence BETWEEN 0 AND 100),
 followers INTEGER NOT NULL DEFAULT 0 CHECK(followers BETWEEN 0 AND 100000),
 client_progress NUMERIC(24,12) NOT NULL DEFAULT 0,
 loss_progress NUMERIC(24,12) NOT NULL DEFAULT 0,
 growth_day DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::DATE,
 clients_start INTEGER NOT NULL DEFAULT 0,
 clients_gained INTEGER NOT NULL DEFAULT 0,
 clients_lost INTEGER NOT NULL DEFAULT 0,
 satisfied_packets INTEGER NOT NULL DEFAULT 0 CHECK(satisfied_packets>=0),
 total_packets INTEGER NOT NULL DEFAULT 0 CHECK(total_packets>=0),
 fee_exact NUMERIC(30,12) NOT NULL DEFAULT 0 CHECK(fee_exact>=0),
 fee_rounded BIGINT NOT NULL DEFAULT 0 CHECK(fee_rounded>=0),
 visitors NUMERIC(30,12) NOT NULL DEFAULT 0,
 marketing JSONB,
 marketing_history JSONB NOT NULL DEFAULT '[]'::JSONB,
 revision BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE public.kq_online_packaging (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 code TEXT NOT NULL CHECK(code IN ('kraft-5','kraft-10','printed-5','printed-10','glass-5','glass-10')),
 quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity BETWEEN 0 AND 1000000),
 cost_cents BIGINT NOT NULL DEFAULT 0 CHECK(cost_cents>=0),
 PRIMARY KEY(user_id,code)
);
CREATE TABLE public.kq_online_listings (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 stock_id UUID NOT NULL REFERENCES public.kq_commerce_stock(id),
 format_grams INTEGER NOT NULL CHECK(format_grams IN (5,10)),
 packaging_code TEXT NOT NULL CHECK(packaging_code IN ('kraft-5','kraft-10','printed-5','printed-10','glass-5','glass-10')),
 packet_price_cents INTEGER NOT NULL CHECK(packet_price_cents BETWEEN 1 AND 1000000),
 initial_packets INTEGER NOT NULL CHECK(initial_packets BETWEEN 1 AND 100000),
 remaining_packets INTEGER NOT NULL CHECK(remaining_packets>=0 AND remaining_packets<=initial_packets),
 sold_packets INTEGER NOT NULL DEFAULT 0 CHECK(sold_packets>=0 AND sold_packets<=initial_packets),
 packaging_cost_cents BIGINT NOT NULL CHECK(packaging_cost_cents>=0),
 packaging_cost_sold_cents BIGINT NOT NULL DEFAULT 0 CHECK(packaging_cost_sold_cents>=0),
 packed_quality NUMERIC(4,2) NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','closed','sold-out','discarded')),
 order_progress NUMERIC(36,18) NOT NULL DEFAULT 0 CHECK(order_progress>=0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 revision BIGINT NOT NULL DEFAULT 0,
 CHECK(sold_packets+remaining_packets<=initial_packets)
);
CREATE INDEX kq_online_listings_active ON public.kq_online_listings(user_id,created_at,id) WHERE status='active' AND remaining_packets>0;
CREATE INDEX kq_online_listings_reserved ON public.kq_online_listings(stock_id) WHERE status IN ('active','paused') AND remaining_packets>0;
CREATE TABLE public.kq_online_sales (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 listing_id UUID NOT NULL REFERENCES public.kq_online_listings(id),
 packet_number INTEGER NOT NULL CHECK(packet_number>0),
 occurred_at TIMESTAMPTZ NOT NULL,
 payout_cents INTEGER NOT NULL CHECK(payout_cents>0),
 vat_cents INTEGER NOT NULL CHECK(vat_cents>=0),
 fee_cents INTEGER NOT NULL CHECK(fee_cents>=0),
 lab_paid_cents INTEGER NOT NULL CHECK(lab_paid_cents>=0),
 electricity_paid_cents INTEGER NOT NULL CHECK(electricity_paid_cents>=0),
 net_payout_cents INTEGER NOT NULL CHECK(net_payout_cents>=0),
 packaging_cost_cents INTEGER NOT NULL CHECK(packaging_cost_cents>=0),
 quality_score NUMERIC(4,2) NOT NULL,
 value_ratio NUMERIC(20,8) NOT NULL,
 satisfaction_score NUMERIC(12,6) NOT NULL,
 satisfaction TEXT NOT NULL CHECK(satisfaction IN ('satisfied','neutral','disappointed')),
 UNIQUE(listing_id,packet_number)
);
CREATE INDEX kq_online_sales_user ON public.kq_online_sales(user_id,occurred_at DESC,id);
CREATE TABLE public.kq_online_requests (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_key UUID NOT NULL,
 action TEXT NOT NULL,
 payload JSONB NOT NULL,
 receipt JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_key)
);
ALTER TABLE public.kq_online_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_online_packaging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_online_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_online_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_online_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_online_accounts,public.kq_online_packaging,public.kq_online_listings,public.kq_online_sales,public.kq_online_requests FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_online_packaging_catalog(p_code TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE p_code
 WHEN 'kraft-5' THEN jsonb_build_object('code',p_code,'unitCostCents',25,'formatGrams',5,'protectionRate',1,'satisfactionBonus',0,'requiresBranding',false)
 WHEN 'kraft-10' THEN jsonb_build_object('code',p_code,'unitCostCents',30,'formatGrams',10,'protectionRate',1,'satisfactionBonus',0,'requiresBranding',false)
 WHEN 'printed-5' THEN jsonb_build_object('code',p_code,'unitCostCents',110,'formatGrams',5,'protectionRate',0.8,'satisfactionBonus',4,'requiresBranding',true)
 WHEN 'printed-10' THEN jsonb_build_object('code',p_code,'unitCostCents',125,'formatGrams',10,'protectionRate',0.8,'satisfactionBonus',4,'requiresBranding',true)
 WHEN 'glass-5' THEN jsonb_build_object('code',p_code,'unitCostCents',180,'formatGrams',5,'protectionRate',0.5,'satisfactionBonus',8,'requiresBranding',false)
 WHEN 'glass-10' THEN jsonb_build_object('code',p_code,'unitCostCents',210,'formatGrams',10,'protectionRate',0.5,'satisfactionBonus',8,'requiresBranding',false)
 ELSE NULL END;
$$;

CREATE FUNCTION public.kq_online_site_catalog(p_tier TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE p_tier
 WHEN 'basic' THEN jsonb_build_object('tier',p_tier,'costCents',0,'monthlyCents',0,'feePercent',2.5,'conversion',1,'requiredPackets',0,'requiredConfidence',0)
 WHEN 'improved' THEN jsonb_build_object('tier',p_tier,'costCents',90000,'monthlyCents',3000,'feePercent',2.5,'conversion',1.25,'requiredPackets',5,'requiredConfidence',45)
 WHEN 'pro' THEN jsonb_build_object('tier',p_tier,'costCents',300000,'monthlyCents',6000,'feePercent',2.5,'conversion',1.6,'requiredPackets',30,'requiredConfidence',60)
 ELSE NULL END;
$$;

CREATE FUNCTION public.kq_online_marketing_catalog(p_code TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE p_code
 WHEN 'introduction' THEN jsonb_build_object('code',p_code,'costCents',0,'durationHours',24,'followers',15,'visitorsPerDay',35,'cooldownHours',0,'once',true)
 WHEN 'harvest' THEN jsonb_build_object('code',p_code,'costCents',0,'durationHours',48,'followers',25,'visitorsPerDay',50,'cooldownHours',72,'once',false)
 WHEN 'behind-scenes' THEN jsonb_build_object('code',p_code,'costCents',0,'durationHours',48,'followers',15,'visitorsPerDay',30,'cooldownHours',168,'once',false)
 WHEN 'feedback' THEN jsonb_build_object('code',p_code,'costCents',0,'durationHours',48,'followers',10,'visitorsPerDay',20,'cooldownHours',168,'once',false)
 ELSE NULL END;
$$;

-- Capture the current business implementation, including prior loan patches,
-- with an explicit historical clock. Existing callers keep their public name.
DO $$ DECLARE body TEXT; BEGIN
 SELECT pg_get_functiondef('public.kq_business_settle(uuid)'::regprocedure) INTO body;
 body:=replace(body,'kq_business_settle(p_user uuid)','kq_online_business_at(p_user uuid, p_until timestamp with time zone)');
 body:=replace(body,'now()', 'p_until');
 body:=replace(body,'public.kq_bank_settle(p_user)','public.kq_online_bank_at(p_user,p_until)');
 -- Each elapsed interval is visited by the online timeline. Do not skip sales
 -- months as the former, manual-only business routine could safely do.
 body:=replace(body,'periods:=floor(EXTRACT(EPOCH FROM (p_until-a.vat_next_settlement_at))/432000)+1;','periods:=1;');
 body:=replace(body,'cash>=10000','cash>=public.kq_online_monthly(p_user)');
 body:=replace(body,'cash:=cash-10000','cash:=cash-public.kq_online_monthly(p_user)');
 body:=replace(body,'''shop-renewed'',10000,event_at','''shop-renewed'',public.kq_online_monthly(p_user),event_at');
 body:=replace(body,'a.shop_created_at IS NOT NULL AND NOT a.shop_suspended AND a.shop_paid_until>p_until','a.shop_created_at IS NOT NULL AND ((SELECT site_tier=''basic'' FROM public.kq_online_accounts WHERE user_id=p_user) OR (NOT a.shop_suspended AND a.shop_paid_until>p_until))');
 IF strpos(body,'kq_online_business_at(')=0 THEN RAISE EXCEPTION 'online_business_signature_changed'; END IF;
 EXECUTE body;
 IF to_regprocedure('public.kq_bank_settle(uuid)') IS NOT NULL THEN
  SELECT pg_get_functiondef('public.kq_bank_settle(uuid)'::regprocedure) INTO body;
  body:=replace(body,'kq_bank_settle(p_user uuid)','kq_online_bank_at(p_user uuid, p_until timestamp with time zone)');
  EXECUTE replace(body,'now()','p_until');
 ELSE
  EXECUTE 'CREATE FUNCTION public.kq_online_bank_at(p_user UUID,p_until TIMESTAMPTZ) RETURNS INTEGER LANGUAGE sql AS ''SELECT 0''';
 END IF;
END $$;

CREATE FUNCTION public.kq_online_next_bank_event(p_user UUID,p_at TIMESTAMPTZ) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE event_at TIMESTAMPTZ;
BEGIN
 IF to_regclass('public.kq_bank_loans') IS NULL THEN RETURN NULL; END IF;
 EXECUTE 'SELECT min(accepted_at+(floor(GREATEST(0,extract(epoch FROM ($2-accepted_at)))/(installment_hours*3600))+1)*installment_hours*interval ''1 hour'')
 FROM public.kq_bank_loans WHERE user_id=$1 AND paid_at IS NULL AND $2<accepted_at+7*installment_hours*interval ''1 hour'''
 INTO event_at USING p_user,p_at;
 RETURN event_at;
END $$;

CREATE FUNCTION public.kq_online_offer(p_user UUID,p_listing public.kq_online_listings,p_at TIMESTAMPTZ) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_commerce_accounts%ROWTYPE; o public.kq_online_accounts%ROWTYPE; s public.kq_commerce_stock%ROWTYPE;
 quality NUMERIC; reference NUMERIC; ratio NUMERIC; acceptance NUMERIC; satisfaction NUMERIC;
 audience NUMERIC; conversion NUMERIC; rate NUMERIC; rep INTEGER; count_active INTEGER; package JSONB; site JSONB; active BOOLEAN; mission_visitors NUMERIC; alignment NUMERIC;
BEGIN
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user;
 SELECT * INTO o FROM public.kq_online_accounts WHERE user_id=p_user;
 SELECT * INTO s FROM public.kq_commerce_stock WHERE id=p_listing.stock_id AND user_id=p_user;
 SELECT reputation INTO rep FROM public.kq_equipment_wallets WHERE user_id=p_user;
 quality:=public.kq_online_quality(p_listing,p_at); package:=public.kq_online_packaging_catalog(p_listing.packaging_code);
 site:=public.kq_online_site_catalog(o.site_tier);
 reference:=GREATEST(1,round(s.base_unit_cents*p_listing.format_grams*(.7+quality/20)
  *(1+LEAST(.2,rep::NUMERIC/15000)*GREATEST(0,LEAST(1,(quality-7)/2)))+(package->>'unitCostCents')::INTEGER));
 ratio:=p_listing.packet_price_cents/reference;
 acceptance:=CASE WHEN ratio<=1 THEN LEAST(1.35,1+.35*(1-ratio)) WHEN ratio<=1.25 THEN 1-.7*(ratio-1)
  WHEN ratio<2.5 THEN .825*power((2.5-ratio)/1.25,2) ELSE 0 END;
 satisfaction:=GREATEST(0,LEAST(98,80+(quality-7)*3+(package->>'satisfactionBonus')::INTEGER
  +LEAST(5,GREATEST(0,1-ratio)*20)-GREATEST(0,ratio-1)*80));
 audience:=(24+LEAST(o.followers,5000)*.12)*(1+LEAST(.25,rep::NUMERIC/6000))+a.clients*2.4;
 IF o.marketing IS NOT NULL AND (o.marketing->>'startedAt')::TIMESTAMPTZ<=p_at AND (o.marketing->>'endsAt')::TIMESTAMPTZ>p_at THEN
  mission_visitors:=(public.kq_online_marketing_catalog(o.marketing->>'code')->>'visitorsPerDay')::NUMERIC;
  alignment:=CASE o.marketing->>'angle' WHEN 'value' THEN CASE WHEN ratio<=1.05 THEN 1.1 ELSE .9 END
   WHEN 'premium' THEN CASE WHEN quality>=8.5 AND ratio BETWEEN 1 AND 1.5 THEN 1.1 ELSE .85 END
   ELSE CASE WHEN quality>=7.5 AND ratio<=1.3 THEN 1.1 ELSE .95 END END;
  audience:=audience+mission_visitors*alignment;
 END IF;
 IF a.advertising IS NOT NULL AND (a.advertising->>'startedAt')::TIMESTAMPTZ<=p_at AND (a.advertising->>'endsAt')::TIMESTAMPTZ>p_at THEN
  audience:=audience*(1+LEAST(100,(a.advertising->>'boostPercent')::NUMERIC)/100);
 END IF;
 conversion:=.025*COALESCE((site->>'conversion')::NUMERIC,1)*(CASE WHEN o.photography THEN 1.1 ELSE 1 END)
  *(CASE WHEN o.branding THEN 1.08 ELSE 1 END)*(.4+.6*o.confidence/100);
 SELECT count(*) INTO count_active FROM public.kq_online_listings x WHERE user_id=p_user AND status='active' AND remaining_packets>0 AND public.kq_online_quality(x,p_at)>=5.8;
 active:=a.computer_owned AND a.shop_created_at IS NOT NULL AND (o.site_tier='basic' OR (NOT a.shop_suspended AND a.shop_paid_until>p_at));
 rate:=CASE WHEN active AND p_listing.status='active' AND quality>=5.8 AND p_listing.remaining_packets>0 THEN
  audience*conversion*acceptance*(.75+.25*GREATEST(0,LEAST(1,(quality-5.8)/3.7)))*5/p_listing.format_grams/GREATEST(1,count_active) ELSE 0 END;
 RETURN jsonb_build_object('qualityScore',quality,'referencePacketCents',reference,'valueRatio',ratio,'acceptance',acceptance,
  'satisfactionScore',satisfaction,'satisfaction',CASE WHEN satisfaction>=75 THEN 'satisfied' WHEN satisfaction>=60 THEN 'neutral' ELSE 'disappointed' END,
  'visitorsPerDay',CASE WHEN active THEN audience ELSE 0 END,'ordersPerDay',rate,'siteActive',active);
END $$;


-- Packet prices are TTC; packaging was paid at preparation and is only a cost
-- allocation here. Fees and VAT use cumulative rounding, never one rounding
-- decision per HTTP request. Historical sales only collect debts already due.
CREATE FUNCTION public.kq_online_collect(p_user UUID,p_payout INTEGER,p_at TIMESTAMPTZ) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_commerce_accounts%ROWTYPE; o public.kq_online_accounts%ROWTYPE;
 tax INTEGER; fee INTEGER; budget INTEGER; paid_lab INTEGER:=0; paid_energy INTEGER:=0; part INTEGER; inv RECORD;
BEGIN
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO o FROM public.kq_online_accounts WHERE user_id=p_user FOR UPDATE;
 tax:=round((a.vat_sales_ttc_cents+p_payout)::NUMERIC/6)-round(a.vat_sales_ttc_cents::NUMERIC/6);
 fee:=round(o.fee_exact+p_payout*0.025)-o.fee_rounded;
 UPDATE public.kq_online_accounts SET fee_exact=fee_exact+p_payout*0.025,fee_rounded=fee_rounded+fee WHERE user_id=p_user;
 budget:=floor(GREATEST(0,p_payout-tax-fee)/2.0);
 FOR inv IN SELECT id,remaining_cents FROM public.kq_lab_invoices WHERE user_id=p_user AND due_at<=p_at AND remaining_cents>0 ORDER BY due_at,id FOR UPDATE LOOP
  EXIT WHEN budget=0; part:=LEAST(budget,inv.remaining_cents); budget:=budget-part; paid_lab:=paid_lab+part;
  UPDATE public.kq_lab_invoices SET remaining_cents=remaining_cents-part WHERE id=inv.id;
 END LOOP;
 FOR inv IN SELECT run_id,remaining_cents FROM public.kq_energy_invoices WHERE user_id=p_user AND created_at<=p_at AND remaining_cents>0 ORDER BY created_at,run_id FOR UPDATE LOOP
  EXIT WHEN budget=0; part:=LEAST(budget,inv.remaining_cents); budget:=budget-part; paid_energy:=paid_energy+part;
  UPDATE public.kq_energy_invoices SET remaining_cents=remaining_cents-part WHERE run_id=inv.run_id;
 END LOOP;
 UPDATE public.kq_commerce_accounts SET vat_sales_ttc_cents=vat_sales_ttc_cents+p_payout,vat_reserved_cents=vat_reserved_cents+tax,revision=revision+1 WHERE user_id=p_user;
 UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+p_payout-tax-fee-paid_lab-paid_energy,updated_at=p_at WHERE user_id=p_user;
 IF fee>0 THEN
  INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user,'online-fee',fee,p_at);
 END IF;
 IF paid_lab>0 THEN INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user,'lab-paid',paid_lab,p_at); END IF;
 RETURN jsonb_build_object('vatCents',tax,'feesCents',fee,'labPaidCents',paid_lab,'electricityPaidCents',paid_energy,'netPayoutCents',p_payout-tax-fee-paid_lab-paid_energy);
END $$;

CREATE FUNCTION public.kq_online_quality(p_listing public.kq_online_listings,p_at TIMESTAMPTZ) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT GREATEST(0,p_listing.packed_quality-floor(GREATEST(0,extract(epoch FROM(p_at-p_listing.created_at)))/14400)*0.01*(public.kq_online_packaging_catalog(p_listing.packaging_code)->>'protectionRate')::NUMERIC);
$$;


CREATE FUNCTION public.kq_online_monthly(p_user UUID) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((public.kq_online_site_catalog(site_tier)->>'monthlyCents')::INTEGER,10000)
 FROM public.kq_online_accounts WHERE user_id=p_user;
$$;

CREATE FUNCTION public.kq_online_initialize(p_user UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_user IS NULL THEN RAISE EXCEPTION 'online_invalid_request'; END IF;
 PERFORM public.rpc_kq_ensure_equipment_profile(p_user);
 INSERT INTO public.kq_commerce_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
 INSERT INTO public.kq_online_accounts(user_id,site_tier,clients_start)
 SELECT p_user,CASE WHEN shop_created_at IS NULL THEN 'none' ELSE 'improved' END,clients
 FROM public.kq_commerce_accounts WHERE user_id=p_user ON CONFLICT DO NOTHING;
END $$;

CREATE FUNCTION public.kq_online_dispatch(p_user UUID,p_listing UUID,p_at TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
<<delivery>>
DECLARE l public.kq_online_listings%ROWTYPE; s public.kq_commerce_stock%ROWTYPE; b public.kq_commerce_batches%ROWTYPE;
 o public.kq_online_accounts%ROWTYPE; a public.kq_commerce_accounts%ROWTYPE; w public.kq_equipment_wallets%ROWTYPE;
 offer JSONB; charges JSONB; eq NUMERIC; score NUMERIC; sat NUMERIC; rep_exact NUMERIC; rep_rounded INTEGER;
 delta INTEGER; bonus INTEGER:=0; sale_count INTEGER; learned BOOLEAN; money INTEGER; package_cost INTEGER;
 gain INTEGER:=0; loss INTEGER:=0; progress NUMERIC; loss_progress NUMERIC; receipt UUID:=gen_random_uuid();
BEGIN
 SELECT * INTO l FROM public.kq_online_listings WHERE id=p_listing AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR l.status<>'active' OR l.remaining_packets<=0 OR l.order_progress<1 THEN RETURN; END IF;
 offer:=public.kq_online_offer(p_user,l,p_at);
 IF NOT (offer->>'siteActive')::BOOLEAN OR (offer->>'qualityScore')::NUMERIC<5.8 OR (offer->>'acceptance')::NUMERIC=0 THEN RETURN; END IF;
 SELECT * INTO s FROM public.kq_commerce_stock WHERE id=l.stock_id FOR UPDATE;
 SELECT * INTO b FROM public.kq_commerce_batches WHERE flower_id=s.flower_id FOR UPDATE;
 SELECT * INTO o FROM public.kq_online_accounts WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO w FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 score:=(offer->>'qualityScore')::NUMERIC; sat:=(offer->>'satisfactionScore')::NUMERIC;
 money:=l.packet_price_cents; eq:=l.format_grams*10*s.equivalent_units::NUMERIC/s.initial_units;
 rep_exact:=b.rep_exact+CASE WHEN sat<60 THEN LEAST(-1,public.kq_market_reputation_delta(s.route,score))
  ELSE GREATEST(0,public.kq_market_reputation_delta(s.route,score)) END*eq/b.original_units;
 rep_rounded:=sign(rep_exact)*floor(abs(rep_exact)+.5); delta:=rep_rounded-b.rep_rounded;
 learned:=NOT b.counted AND s.route=b.route AND b.professional_units+eq>=(SELECT sum(equivalent_units)*.5 FROM public.kq_commerce_stock WHERE flower_id=s.flower_id AND route=b.route)
  AND public.kq_market_reputation_delta(b.route,score)>0 AND sat>=75;
 SELECT COALESCE((SELECT m.sale_count FROM public.kq_player_route_masteries m WHERE user_id=p_user AND route=b.route),0) INTO sale_count;
 IF learned THEN
  sale_count:=sale_count+1;
  IF b.route NOT IN ('raw','biomass') THEN bonus:=CASE sale_count WHEN 3 THEN 5 WHEN 6 THEN 12 WHEN 10 THEN 25 ELSE 0 END; END IF;
 END IF;
 delta:=GREATEST(-w.reputation,delta+bonus);
 charges:=public.kq_online_collect(p_user,money,p_at);
 package_cost:=round(l.packaging_cost_cents*(l.sold_packets+1)::NUMERIC/l.initial_packets)-l.packaging_cost_sold_cents;
 UPDATE public.kq_online_listings SET remaining_packets=remaining_packets-1,sold_packets=sold_packets+1,
  packaging_cost_sold_cents=packaging_cost_sold_cents+package_cost,order_progress=GREATEST(0,order_progress-1),
  status=CASE WHEN remaining_packets=1 THEN 'sold-out' ELSE status END,revision=revision+1 WHERE id=l.id;
 UPDATE public.kq_commerce_stock SET payout_exact=payout_exact+money,payout_rounded=payout_rounded+money WHERE id=s.id;
 UPDATE public.kq_commerce_batches SET rep_exact=delivery.rep_exact,rep_rounded=delivery.rep_rounded,
  professional_units=professional_units+CASE WHEN s.route=b.route THEN eq ELSE 0 END,counted=counted OR learned WHERE flower_id=b.flower_id;
 -- Names qualified through variables below avoid PL/pgSQL column ambiguity.
 UPDATE public.kq_equipment_wallets SET reputation=reputation+delta WHERE user_id=p_user RETURNING * INTO w;
 progress:=o.client_progress+CASE WHEN sat>=75 THEN l.format_grams/50.0 ELSE 0 END;
 loss_progress:=o.loss_progress+CASE WHEN sat<60 THEN l.format_grams/10.0*(60-sat)/20 ELSE 0 END;
 gain:=LEAST(GREATEST(0,5-o.clients_gained),floor(progress)::INTEGER); progress:=progress-gain;
 loss:=LEAST(GREATEST(0,ceil(o.clients_start*.25)::INTEGER-o.clients_lost),floor(loss_progress)::INTEGER,a.clients+gain); loss_progress:=loss_progress-loss;
 UPDATE public.kq_commerce_accounts SET clients=GREATEST(0,clients+gain-loss) WHERE user_id=p_user;
 UPDATE public.kq_online_accounts SET confidence=GREATEST(0,LEAST(100,confidence+GREATEST(-2,LEAST(1,(sat-70)/40))*l.format_grams/10.0)),
  total_packets=total_packets+1,satisfied_packets=satisfied_packets+CASE WHEN sat>=75 THEN 1 ELSE 0 END,
  client_progress=LEAST(1,progress),loss_progress=LEAST(1,delivery.loss_progress),clients_gained=clients_gained+gain,clients_lost=clients_lost+loss,revision=revision+1 WHERE user_id=p_user;
 INSERT INTO public.kq_online_sales(id,user_id,listing_id,packet_number,occurred_at,payout_cents,vat_cents,fee_cents,lab_paid_cents,electricity_paid_cents,net_payout_cents,packaging_cost_cents,quality_score,value_ratio,satisfaction_score,satisfaction)
 VALUES(receipt,p_user,l.id,l.sold_packets+1,p_at,money,(charges->>'vatCents')::INTEGER,(charges->>'feesCents')::INTEGER,(charges->>'labPaidCents')::INTEGER,
  (charges->>'electricityPaidCents')::INTEGER,(charges->>'netPayoutCents')::INTEGER,package_cost,score,(offer->>'valueRatio')::NUMERIC,sat,offer->>'satisfaction');
 INSERT INTO public.kq_market_sale_receipts(id,request_key,flower_id,owner_id,route,jury_score,harvest_grams,payout_cents,reputation_gain,cash_after_cents,reputation_after,
  route_sale_count,expertise_bonus_reputation,electricity_paid_cents,vat_cents,lab_paid_cents,sales_channel,first_route_mastery,matched_route_plan,created_at)
 VALUES(receipt,receipt,s.flower_id,p_user,s.route,score,eq/10,money,delta,w.cash_cents,w.reputation,sale_count,bonus,
  (charges->>'electricityPaidCents')::INTEGER,(charges->>'vatCents')::INTEGER,(charges->>'labPaidCents')::INTEGER,'online',learned AND sale_count=1,learned AND COALESCE(w.planned_route_code=b.route,false),p_at);
 IF learned THEN
  INSERT INTO public.kq_player_route_masteries(user_id,route,first_sale_receipt_id,last_sale_receipt_id,first_jury_score,best_jury_score,sale_count,total_payout_cents,total_reputation,mastered_at,updated_at)
  SELECT p_user,b.route,receipt,receipt,score,score,1,COALESCE(sum(payout_cents),0),COALESCE(sum(reputation_gain),0),p_at,p_at FROM public.kq_market_sale_receipts WHERE flower_id=s.flower_id
  ON CONFLICT(user_id,route) DO UPDATE SET sale_count=public.kq_player_route_masteries.sale_count+1,last_sale_receipt_id=receipt,
   best_jury_score=GREATEST(public.kq_player_route_masteries.best_jury_score,score),total_payout_cents=public.kq_player_route_masteries.total_payout_cents+EXCLUDED.total_payout_cents,
   total_reputation=public.kq_player_route_masteries.total_reputation+EXCLUDED.total_reputation,updated_at=p_at;
  IF w.planned_route_code=b.route THEN UPDATE public.kq_equipment_wallets SET planned_route_code=NULL,planned_equipment_code=NULL WHERE user_id=p_user; END IF;
 ELSIF b.counted THEN
  UPDATE public.kq_player_route_masteries SET last_sale_receipt_id=receipt,total_payout_cents=total_payout_cents+money,total_reputation=total_reputation+delta,updated_at=p_at WHERE user_id=p_user AND route=b.route;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.kq_commerce_stock WHERE flower_id=s.flower_id AND remaining_units>0)
  AND NOT EXISTS(SELECT 1 FROM public.kq_online_listings x JOIN public.kq_commerce_stock z ON z.id=x.stock_id WHERE z.flower_id=s.flower_id AND x.remaining_packets>0) THEN
  UPDATE public.kq_market_lots SET status='sold',payout_cents=(SELECT sum(payout_cents) FROM public.kq_market_sale_receipts WHERE flower_id=s.flower_id),
   reputation_gain=(SELECT sum(reputation_gain) FROM public.kq_market_sale_receipts WHERE flower_id=s.flower_id),settled_at=p_at WHERE flower_id=s.flower_id;
 END IF;
END $$;

CREATE FUNCTION public.kq_online_settle_until(p_user UUID,p_until TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.kq_online_accounts%ROWTYPE; a public.kq_commerce_accounts%ROWTYPE; l public.kq_online_listings%ROWTYPE;
 cursor_at TIMESTAMPTZ; next_at TIMESTAMPTZ; candidate TIMESTAMPTZ; offer JSONB; rates JSONB; rate NUMERIC;
 elapsed NUMERIC; audience NUMERIC; events INTEGER:=0; mission JSONB; current_clients INTEGER; day_end TIMESTAMPTZ;
BEGIN
 IF p_until IS NULL OR p_until>now() THEN RAISE EXCEPTION 'online_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 PERFORM public.kq_online_initialize(p_user);
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO o FROM public.kq_online_accounts WHERE user_id=p_user FOR UPDATE;
 cursor_at:=o.settled_until;
 IF p_until<cursor_at THEN RETURN; END IF;
 LOOP
  PERFORM public.kq_online_business_at(p_user,cursor_at);
  SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user;
  SELECT * INTO o FROM public.kq_online_accounts WHERE user_id=p_user;
  IF o.growth_day<>(cursor_at AT TIME ZONE 'UTC')::DATE THEN
   UPDATE public.kq_online_accounts SET growth_day=(cursor_at AT TIME ZONE 'UTC')::DATE,clients_start=a.clients,clients_gained=0,clients_lost=0 WHERE user_id=p_user;
  END IF;
  IF o.marketing IS NOT NULL AND (o.marketing->>'endsAt')::TIMESTAMPTZ<=cursor_at THEN
   mission:=public.kq_online_marketing_catalog(o.marketing->>'code');
   UPDATE public.kq_online_accounts SET followers=LEAST(100000,followers+(mission->>'followers')::INTEGER),
    marketing_history=marketing_history||jsonb_build_array(marketing||jsonb_build_object('completedAt',cursor_at)),marketing=NULL,revision=revision+1 WHERE user_id=p_user;
  END IF;
  -- Simultaneous orders have a stable order independent of polling frequency.
  FOR l IN SELECT * FROM public.kq_online_listings WHERE user_id=p_user AND status='active' AND remaining_packets>0 AND order_progress>=1 ORDER BY created_at,id LOOP
   PERFORM public.kq_online_dispatch(p_user,l.id,cursor_at);
  END LOOP;
  -- Already overdue loan installments collect sale income at the sale event,
  -- rather than at an incidental later HTTP read.
  PERFORM public.kq_online_bank_at(p_user,cursor_at);
  EXIT WHEN cursor_at>=p_until;
  events:=events+1;
  IF events>50000 THEN RAISE EXCEPTION 'online_catchup_limit'; END IF;
  SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user;
  SELECT * INTO o FROM public.kq_online_accounts WHERE user_id=p_user;
  rates:='{}'::JSONB; audience:=0; next_at:=p_until;
  -- Deadlines are handled before an order at that same instant. Revenue just
  -- before renewal can fund it; revenue after suspension cannot revive it.
  candidate:=LEAST(a.vat_next_settlement_at,CASE WHEN NOT a.shop_suspended THEN a.shop_paid_until END,
   (a.advertising->>'endsAt')::TIMESTAMPTZ,(o.marketing->>'endsAt')::TIMESTAMPTZ,
   CASE WHEN a.domiciliation_mode='external' THEN a.domiciliation_paid_until END,
   (SELECT min(due_at) FROM public.kq_lab_invoices WHERE user_id=p_user AND remaining_cents>0 AND due_processed_at IS NULL),
   public.kq_online_next_bank_event(p_user,cursor_at));
  IF candidate>cursor_at THEN next_at:=LEAST(next_at,candidate); END IF;
  day_end:=((cursor_at AT TIME ZONE 'UTC')::DATE+1)::TIMESTAMP AT TIME ZONE 'UTC';
  next_at:=LEAST(next_at,day_end);
  FOR l IN SELECT * FROM public.kq_online_listings WHERE user_id=p_user AND status='active' AND remaining_packets>0 ORDER BY created_at,id LOOP
   offer:=public.kq_online_offer(p_user,l,cursor_at); rate:=(offer->>'ordersPerDay')::NUMERIC;
   audience:=GREATEST(audience,(offer->>'visitorsPerDay')::NUMERIC);
   rates:=rates||jsonb_build_object(l.id::TEXT,rate);
   IF rate>0 THEN
    elapsed:=GREATEST(1,ceil(GREATEST(0,1-l.order_progress)*86400*1000000/rate));
    -- A price just below total refusal can imply centuries of waiting. Only
    -- materialize a timestamp when an order falls inside this bounded window.
    IF elapsed<=extract(epoch FROM(next_at-cursor_at))*1000000 THEN
     next_at:=cursor_at+elapsed*interval '1 microsecond';
    END IF;
   END IF;
   IF (offer->>'qualityScore')::NUMERIC>=5.8 THEN
    candidate:=l.created_at+(floor(extract(epoch FROM(cursor_at-l.created_at))/14400)+1)*interval '4 hours';
    next_at:=LEAST(next_at,candidate);
   END IF;
  END LOOP;
  -- No physical product can be shipped twice: only preparation owns stock;
  -- dispatch owns a unique packet number within its prepared listing.
  elapsed:=extract(epoch FROM(next_at-cursor_at));
  UPDATE public.kq_online_listings x SET order_progress=order_progress+COALESCE((rates->>id::TEXT)::NUMERIC,0)*elapsed/86400
   WHERE user_id=p_user AND status='active' AND remaining_packets>0;
  UPDATE public.kq_online_accounts SET settled_until=next_at,visitors=visitors+audience*elapsed/86400 WHERE user_id=p_user;
  cursor_at:=next_at;
 END LOOP;
END $$;

-- All existing wallet mutations already enter this function. Replacing this
-- single entry point prevents purchases/bank actions skipping online income.
CREATE OR REPLACE FUNCTION public.kq_business_settle(p_user UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.kq_online_settle_until(p_user,now());
END $$;

CREATE FUNCTION public.kq_online_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('version',1,'serverNow',now(),'settledUntil',o.settled_until,
 'site',jsonb_build_object('tier',CASE WHEN o.site_tier='none' THEN 'basic' ELSE o.site_tier END,'createdAt',a.shop_created_at,
  'active',a.computer_owned AND a.shop_created_at IS NOT NULL AND (o.site_tier='basic' OR (NOT a.shop_suspended AND a.shop_paid_until>now())),
  'paidUntil',a.shop_paid_until,'renew',a.shop_renew,'feePercent',2.5),
 'upgrades',jsonb_build_object('photography',o.photography,'branding',o.branding),'confidence',o.confidence,'followers',o.followers,
 'packaging',(SELECT jsonb_agg(jsonb_build_object('code',item.code,'quantity',COALESCE(p.quantity,0),'unitCostCents',(public.kq_online_packaging_catalog(item.code)->>'unitCostCents')::INTEGER) ORDER BY item.code)
  FROM unnest(ARRAY['kraft-5','kraft-10','printed-5','printed-10','glass-5','glass-10']) item(code) LEFT JOIN public.kq_online_packaging p ON p.user_id=p_user AND p.code=item.code),
 'listings',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'stockId',l.stock_id,'name',f.variety_name,'route',s.route,
  'formatGrams',l.format_grams,'packagingCode',l.packaging_code,'packetPriceCents',l.packet_price_cents,'remainingPackets',l.remaining_packets,
  'initialPackets',l.initial_packets,'soldPackets',l.sold_packets,'status',CASE WHEN l.status='active' AND public.kq_online_quality(l,now())<5.8 THEN 'quality-blocked' ELSE l.status END,
  'qualityScore',public.kq_online_quality(l,now()),'baseUnitCents',s.base_unit_cents,'createdAt',l.created_at,'offer',public.kq_online_offer(p_user,l,now())) ORDER BY l.created_at,l.id)
  FROM public.kq_online_listings l JOIN public.kq_commerce_stock s ON s.id=l.stock_id JOIN public.kq_flowers f ON f.id=s.flower_id WHERE l.user_id=p_user),'[]'::JSONB),
 'marketing',jsonb_build_object('active',o.marketing,'completedCodes',COALESCE((SELECT jsonb_agg(DISTINCT e->>'code') FROM jsonb_array_elements(o.marketing_history) e),'[]'::JSONB),
  'cooldowns',COALESCE((SELECT jsonb_object_agg(code,deadline) FROM (SELECT e->>'code' code,max((e->>'startedAt')::TIMESTAMPTZ+(public.kq_online_marketing_catalog(e->>'code')->>'cooldownHours')::INTEGER*interval '1 hour') deadline FROM jsonb_array_elements(o.marketing_history) e GROUP BY e->>'code') c),'{}'::JSONB)),
 'stats',(SELECT jsonb_build_object('visitors',floor(o.visitors),'orders',count(*),'revenueCents',COALESCE(sum(x.payout_cents),0),'netRevenueCents',COALESCE(sum(x.net_payout_cents),0),
  'feesCents',COALESCE(sum(x.fee_cents),0),'packagingCostCents',COALESCE(sum(x.packaging_cost_cents),0),'soldGrams',COALESCE(sum(l.format_grams),0))
  FROM public.kq_online_sales x JOIN public.kq_online_listings l ON l.id=x.listing_id WHERE x.user_id=p_user),
 'recentSales',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'listingId',x.listing_id,'name',f.variety_name,'soldAt',x.occurred_at,'packets',1,
  'formatGrams',l.format_grams,'packetPriceCents',x.payout_cents,'payoutCents',x.payout_cents,'netPayoutCents',x.net_payout_cents,
  'feesCents',x.fee_cents,'packagingCostCents',x.packaging_cost_cents,'satisfaction',x.satisfaction_score) ORDER BY x.occurred_at DESC,x.id)
  FROM (SELECT * FROM public.kq_online_sales WHERE user_id=p_user ORDER BY occurred_at DESC,id LIMIT 30) x
  JOIN public.kq_online_listings l ON l.id=x.listing_id JOIN public.kq_commerce_stock s ON s.id=l.stock_id JOIN public.kq_flowers f ON f.id=s.flower_id),'[]'::JSONB))
 FROM public.kq_online_accounts o JOIN public.kq_commerce_accounts a USING(user_id) WHERE o.user_id=p_user;
$$;

CREATE FUNCTION public.rpc_kq_online_state(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.kq_business_settle(p_user_id);
 RETURN public.kq_online_snapshot(p_user_id);
END $$;

CREATE FUNCTION public.kq_online_integer(p_value JSONB,p_min INTEGER,p_max INTEGER) RETURNS INTEGER
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE n NUMERIC;
BEGIN
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'online_invalid_request'; END IF;
 n:=p_value::TEXT::NUMERIC;
 IF n<>floor(n) OR n<p_min OR n>p_max THEN RAISE EXCEPTION 'online_invalid_request'; END IF;
 RETURN n::INTEGER;
END $$;

CREATE FUNCTION public.rpc_kq_online_command(p_user_id UUID,p_action TEXT,p_payload JSONB,p_request_key UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.kq_online_accounts%ROWTYPE; a public.kq_commerce_accounts%ROWTYPE; s public.kq_commerce_stock%ROWTYPE;
 l public.kq_online_listings%ROWTYPE; inv public.kq_online_packaging%ROWTYPE; old public.kq_online_requests%ROWTYPE;
 spec JSONB; condition JSONB; lot public.kq_storage_lots%ROWTYPE; result JSONB:='{}'; existing_cost INTEGER; cost BIGINT:=0;
 qty INTEGER; grams INTEGER; price INTEGER; score NUMERIC; code TEXT; label TEXT; angle TEXT; sid UUID; listing UUID; amount INTEGER; source_flower UUID;
BEGIN
 IF p_request_key IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'online_invalid_request'; END IF;
 PERFORM public.kq_business_settle(p_user_id);
 SELECT * INTO old FROM public.kq_online_requests WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF old.action IS DISTINCT FROM p_action OR old.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'online_request_mismatch'; END IF;
  RETURN old.receipt||jsonb_build_object('replayed',true);
 END IF;
 SELECT * INTO o FROM public.kq_online_accounts WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user_id FOR UPDATE;
 IF p_action='buy-packaging' THEN
  code:=p_payload->>'code'; spec:=public.kq_online_packaging_catalog(code);
  IF spec IS NULL THEN RAISE EXCEPTION 'online_packaging_unknown'; END IF;
  IF (spec->>'requiresBranding')::BOOLEAN AND NOT o.branding THEN RAISE EXCEPTION 'online_branding_required'; END IF;
  qty:=public.kq_online_integer(p_payload->'quantity',1,100000); cost:=qty*(spec->>'unitCostCents')::INTEGER;
  INSERT INTO public.kq_online_packaging(user_id,code,quantity,cost_cents) VALUES(p_user_id,code,qty,cost)
  ON CONFLICT ON CONSTRAINT kq_online_packaging_pkey DO UPDATE SET quantity=public.kq_online_packaging.quantity+qty,cost_cents=public.kq_online_packaging.cost_cents+cost;
 ELSIF p_action='create-listing' THEN
  IF o.site_tier='none' THEN RAISE EXCEPTION 'online_site_required'; END IF;
  code:=p_payload->>'packagingCode'; spec:=public.kq_online_packaging_catalog(code);
  IF spec IS NULL THEN RAISE EXCEPTION 'online_packaging_unknown'; END IF;
  grams:=public.kq_online_integer(p_payload->'formatGrams',5,10);
  IF grams NOT IN (5,10) OR grams<>(spec->>'formatGrams')::INTEGER THEN RAISE EXCEPTION 'online_invalid_request'; END IF;
  qty:=public.kq_online_integer(p_payload->'packets',1,100000); price:=public.kq_online_integer(p_payload->'packetPriceCents',1,1000000);
  sid:=(p_payload->>'stockId')::UUID;
  SELECT * INTO s FROM public.kq_commerce_stock WHERE id=sid AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR s.route='biomass' OR s.remaining_units<qty*grams*10 THEN RAISE EXCEPTION 'online_stock_unavailable'; END IF;
  IF (spec->>'requiresBranding')::BOOLEAN AND NOT o.branding THEN RAISE EXCEPTION 'online_branding_required'; END IF;
  SELECT * INTO inv FROM public.kq_online_packaging p WHERE user_id=p_user_id AND p.code=spec->>'code' FOR UPDATE;
  IF NOT FOUND OR inv.quantity<qty THEN RAISE EXCEPTION 'online_packaging_shortage'; END IF;
  SELECT * INTO lot FROM public.kq_storage_lots WHERE flower_id=s.flower_id AND user_id=p_user_id FOR UPDATE;
  SELECT jury_score INTO score FROM public.kq_market_lots WHERE flower_id=s.flower_id;
  condition:=public.kq_storage_condition(lot.state,score,now());
  IF lot.flower_id IS NULL OR now()<(lot.state->>'readyAt')::TIMESTAMPTZ OR (condition->>'conditionScore')::NUMERIC<5.8
   OR (lot.state->'capacity'->>'totalUnits')::INTEGER>COALESCE((SELECT sum((e->>'storedUnits')::INTEGER) FROM jsonb_array_elements(lot.state->'capacity'->'allocations') e),0)
  THEN RAISE EXCEPTION 'online_storage_not_ready'; END IF;
  amount:=round(inv.cost_cents*qty::NUMERIC/inv.quantity);
  UPDATE public.kq_online_packaging p SET quantity=quantity-qty,cost_cents=cost_cents-amount WHERE user_id=p_user_id AND p.code=spec->>'code';
  UPDATE public.kq_commerce_stock SET remaining_units=remaining_units-qty*grams*10 WHERE id=s.id;
  INSERT INTO public.kq_online_listings(user_id,stock_id,format_grams,packaging_code,packet_price_cents,initial_packets,remaining_packets,packaging_cost_cents,packed_quality)
  VALUES(p_user_id,s.id,grams,code,price,qty,qty,amount,(condition->>'conditionScore')::NUMERIC) RETURNING id INTO listing;
  PERFORM public.kq_storage_allocate(s.flower_id);
  result:=jsonb_build_object('listingId',listing,'packets',qty,'packagingCostCents',amount);
 ELSIF p_action IN ('update-listing','pause-listing','resume-listing','close-listing','discard-listing') THEN
  listing:=(p_payload->>'listingId')::UUID;
  SELECT * INTO l FROM public.kq_online_listings WHERE id=listing AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'online_listing_unknown'; END IF;
  IF l.remaining_packets=0 THEN RAISE EXCEPTION 'online_listing_inactive'; END IF;
  IF p_action='discard-listing' THEN
   UPDATE public.kq_online_listings SET status='discarded',remaining_packets=0,order_progress=0,changed_at=now(),revision=revision+1 WHERE id=l.id;
   result:=jsonb_build_object('discardedPackets',l.remaining_packets,'discardedGrams',l.remaining_packets*l.format_grams);
  ELSIF p_action='update-listing' THEN
   price:=public.kq_online_integer(p_payload->'packetPriceCents',1,1000000);
   UPDATE public.kq_online_listings SET packet_price_cents=price,order_progress=0,changed_at=now(),revision=revision+1 WHERE id=l.id;
  ELSE
   UPDATE public.kq_online_listings SET status=CASE p_action WHEN 'resume-listing' THEN 'active' WHEN 'pause-listing' THEN 'paused' ELSE 'closed' END,
    order_progress=0,changed_at=now(),revision=revision+1 WHERE id=l.id;
  END IF;
  result:=result||jsonb_build_object('listingId',listing);
 ELSIF p_action='upgrade-site' THEN
  code:=p_payload->>'tier'; spec:=public.kq_online_site_catalog(code);
  IF spec IS NULL THEN RAISE EXCEPTION 'online_tier_unknown'; END IF;
  IF NOT a.computer_owned THEN RAISE EXCEPTION 'online_computer_required'; END IF;
  IF o.total_packets<(spec->>'requiredPackets')::INTEGER OR o.confidence<(spec->>'requiredConfidence')::NUMERIC THEN RAISE EXCEPTION 'online_progression_required'; END IF;
  existing_cost:=COALESCE((public.kq_online_site_catalog(o.site_tier)->>'costCents')::INTEGER,0);
  IF o.site_tier<>'none' AND (spec->>'costCents')::INTEGER<=existing_cost THEN RAISE EXCEPTION 'online_progression_required'; END IF;
  cost:=(spec->>'costCents')::INTEGER-existing_cost;
  label:=COALESCE(p_payload->>'name',a.shop_name,'Mon shop');
  label:=normalize(trim(regexp_replace(label,'[[:space:]]+',' ','g')),NFC);
  IF char_length(label) NOT BETWEEN 3 AND 40 OR label~'[[:cntrl:]<>]' THEN RAISE EXCEPTION 'commerce_shop_name'; END IF;
  UPDATE public.kq_online_accounts SET site_tier=code WHERE user_id=p_user_id;
  UPDATE public.kq_commerce_accounts SET shop_name=label,shop_created_at=COALESCE(shop_created_at,now()),shop_suspended=false,
   shop_paid_until=CASE WHEN code='basic' THEN NULL ELSE GREATEST(COALESCE(shop_paid_until,now()),now()+interval '120 hours') END,
   shop_renew=code<>'basic',internet_renew=code<>'basic' WHERE user_id=p_user_id;
 ELSIF p_action='buy-upgrade' THEN
  code:=p_payload->>'code';
  IF o.site_tier='none' THEN RAISE EXCEPTION 'online_site_required'; END IF;
  IF code='photography' AND NOT o.photography THEN cost:=30000; UPDATE public.kq_online_accounts SET photography=true WHERE user_id=p_user_id;
  ELSIF code='branding' AND NOT o.branding THEN cost:=70000; UPDATE public.kq_online_accounts SET branding=true WHERE user_id=p_user_id;
  ELSE RAISE EXCEPTION 'online_invalid_request'; END IF;
 ELSIF p_action='start-marketing' THEN
  code:=p_payload->>'code'; angle:=p_payload->>'angle'; spec:=public.kq_online_marketing_catalog(code);
  IF spec IS NULL OR angle IS NULL OR angle NOT IN ('value','craft','premium') THEN RAISE EXCEPTION 'online_marketing_unknown'; END IF;
  IF o.site_tier='none' OR (o.site_tier<>'basic' AND (a.shop_suspended OR a.shop_paid_until<=now())) THEN RAISE EXCEPTION 'online_site_required'; END IF;
  IF o.marketing IS NOT NULL THEN RAISE EXCEPTION 'online_marketing_active'; END IF;
  IF (code='feedback' AND o.total_packets<5) OR EXISTS(SELECT 1 FROM jsonb_array_elements(o.marketing_history) e WHERE e->>'code'=code AND
   ((spec->>'once')::BOOLEAN OR (e->>'startedAt')::TIMESTAMPTZ+(spec->>'cooldownHours')::INTEGER*interval '1 hour'>now())) THEN RAISE EXCEPTION 'online_progression_required'; END IF;
  IF code='harvest' THEN
   SELECT * INTO s FROM public.kq_commerce_stock WHERE id=(p_payload->>'stockId')::UUID AND user_id=p_user_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'online_stock_unavailable'; END IF;
   SELECT * INTO lot FROM public.kq_storage_lots WHERE flower_id=s.flower_id;
   IF lot.flower_id IS NULL OR (lot.state->>'readyAt') IS NULL OR now()<(lot.state->>'readyAt')::TIMESTAMPTZ THEN RAISE EXCEPTION 'online_storage_not_ready'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(o.marketing_history) e WHERE e->>'flowerId'=s.flower_id::TEXT) THEN RAISE EXCEPTION 'online_progression_required'; END IF;
   source_flower:=s.flower_id;
  END IF;
  UPDATE public.kq_online_accounts SET marketing=jsonb_build_object('id',gen_random_uuid(),'code',code,'angle',angle,'stockId',p_payload->>'stockId','flowerId',source_flower,
   'startedAt',now(),'endsAt',now()+(spec->>'durationHours')::INTEGER*interval '1 hour') WHERE user_id=p_user_id;
 ELSE RAISE EXCEPTION 'online_invalid_request'; END IF;
 IF cost>0 THEN
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-cost::INTEGER,updated_at=now() WHERE user_id=p_user_id AND cash_cents>=cost;
  IF NOT FOUND THEN RAISE EXCEPTION 'online_cash'; END IF;
  INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents) VALUES(p_user_id,'online-'||p_action,cost);
 END IF;
 UPDATE public.kq_online_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 result:=result||jsonb_build_object('action',p_action,'paidCents',cost,'cashAfterCents',(SELECT cash_cents FROM public.kq_equipment_wallets WHERE user_id=p_user_id),'replayed',false);
 INSERT INTO public.kq_online_requests(user_id,request_key,action,payload,receipt) VALUES(p_user_id,p_request_key,p_action,p_payload,result);
 RETURN result;
END $$;

ALTER FUNCTION public.kq_business_snapshot(UUID) RENAME TO kq_online_previous_business_snapshot;
CREATE FUNCTION public.kq_business_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_set(public.kq_online_previous_business_snapshot(p_user),'{shop}',
  (public.kq_online_previous_business_snapshot(p_user)->'shop')||jsonb_build_object(
   'tier',CASE WHEN o.site_tier='none' THEN 'basic' ELSE o.site_tier END,'monthlyCents',public.kq_online_monthly(p_user),
   'active',a.shop_created_at IS NOT NULL AND (o.site_tier='basic' OR (NOT a.shop_suspended AND a.shop_paid_until>now()))))
 FROM public.kq_online_accounts o JOIN public.kq_commerce_accounts a USING(user_id) WHERE o.user_id=p_user;
$$;

ALTER FUNCTION public.rpc_kq_commerce_state(UUID) RENAME TO kq_online_previous_commerce_state;
CREATE FUNCTION public.rpc_kq_commerce_state(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result JSONB;
BEGIN
 result:=public.kq_online_previous_commerce_state(p_user_id);
 RETURN result||jsonb_build_object('online',public.kq_online_snapshot(p_user_id));
END $$;

CREATE FUNCTION public.kq_online_raw_professional_price(p_channel TEXT,p_quality NUMERIC,p_event TEXT,p_base NUMERIC,p_multiplier NUMERIC) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT round(CASE WHEN p_channel='cbd-shop' THEN 50+100*GREATEST(0,LEAST(1,(p_quality-6.5)/3)) ELSE
  LEAST((50+100*GREATEST(0,LEAST(1,(p_quality-6.5)/3)))*.6,p_base*p_multiplier*
   CASE WHEN p_quality>=6.5 THEN CASE p_event WHEN 'promotion' THEN .35 WHEN 'restock' THEN .39 ELSE .38 END
    ELSE CASE p_event WHEN 'promotion' THEN .25 WHEN 'restock' THEN .33 ELSE .30 END END) END,6);
$$;

-- Retire instant online settlement even for an old, valid stored quote. Keep
-- old request replays, professional settlement and all existing safety checks.
DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure) INTO body;
 fragment:='offer:=q.offer; units:=(offer->>''units'')::INTEGER; channel:=offer->>''channel''; payout:=(offer->>''payoutCents'')::INTEGER;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'online_commerce_sale_anchor_changed'; END IF;
 body:=replace(body,fragment,fragment||E'\n  IF channel=''online'' THEN RAISE EXCEPTION ''online_legacy_sale''; END IF;');
 fragment:='storage_jury_score:=public.kq_storage_check_offer(p_user_id,s.flower_id,l.jury_score,q.storage_revision,q.expires_at,channel);';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'online_professional_quality_anchor_changed'; END IF;
 body:=replace(body,fragment,fragment||E'\n IF s.route=''raw'' AND channel IN (''cbd-shop'',''wholesale'') AND round((offer->>''unitCents'')::NUMERIC,6) IS DISTINCT FROM public.kq_online_raw_professional_price(channel,storage_jury_score,c.event,s.base_unit_cents,CASE WHEN EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength=''merchant'') THEN 1.5 ELSE 1 END) THEN RAISE EXCEPTION ''commerce_offer_changed''; END IF;');
 fragment:='SELECT * INTO c FROM public.kq_commerce_campaigns WHERE run_id=a.current_run_id FOR UPDATE;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'online_commerce_command_anchor_changed'; END IF;
 body:=replace(body,fragment,E'IF p_action=''create-shop'' THEN RETURN public.rpc_kq_online_command(p_user_id,''upgrade-site'',p_payload||jsonb_build_object(''tier'',''basic''),p_request_key); END IF;\n '||fragment);
 fragment:='IF NOT EXISTS(SELECT 1 FROM public.kq_commerce_stock WHERE flower_id=s.flower_id AND remaining_units>0) THEN';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'online_commerce_completion_anchor_changed'; END IF;
 body:=replace(body,fragment,'IF NOT EXISTS(SELECT 1 FROM public.kq_commerce_stock WHERE flower_id=s.flower_id AND remaining_units>0) AND NOT EXISTS(SELECT 1 FROM public.kq_online_listings x JOIN public.kq_commerce_stock z ON z.id=x.stock_id WHERE z.flower_id=s.flower_id AND x.remaining_packets>0) THEN');
 EXECUTE body;
 SELECT pg_get_functiondef('public.kq_business_command(uuid,text,jsonb)'::regprocedure) INTO body;
 body:=replace(body,'cost:=10000;','cost:=public.kq_online_monthly(p_user);');
 body:=replace(body,'IF NOT a.shop_suspended AND a.shop_paid_until>now() THEN','IF (SELECT site_tier=''basic'' FROM public.kq_online_accounts WHERE user_id=p_user) OR (NOT a.shop_suspended AND a.shop_paid_until>now()) THEN');
 body:=replace(body,'x.shop_created_at IS NOT NULL AND NOT x.shop_suspended AND x.shop_paid_until>now()','x.shop_created_at IS NOT NULL AND ((SELECT site_tier=''basic'' FROM public.kq_online_accounts WHERE user_id=p_user) OR (NOT x.shop_suspended AND x.shop_paid_until>now()))');
 EXECUTE body;
 SELECT pg_get_functiondef('public.kq_commerce_open_cycle(uuid,uuid)'::regprocedure) INTO body;
 fragment:='paid:=a.shop_created_at IS NOT NULL AND NOT a.shop_suspended AND a.shop_paid_until>now();';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'online_cycle_subscription_anchor_changed'; END IF;
 body:=replace(body,fragment,'paid:=a.shop_created_at IS NOT NULL AND ((SELECT site_tier=''basic'' FROM public.kq_online_accounts WHERE user_id=p_user) OR (NOT a.shop_suspended AND a.shop_paid_until>now()));');
 EXECUTE body;
END $$;

-- The existing accounting stock calculation sees prepared packages as unsold
-- production as well. Packaging purchases are charged once and expensed when
-- shipped, with unused and prepared packs remaining valued as inventory.
DO $$ DECLARE body TEXT; BEGIN
 IF to_regprocedure('public.kq_treasury_stock_cost(uuid)') IS NOT NULL THEN
  SELECT pg_get_functiondef('public.kq_treasury_stock_cost(uuid)'::regprocedure) INTO body;
  IF strpos(body,'s.remaining_units::NUMERIC*s.equivalent_units/s.initial_units')=0 THEN RAISE EXCEPTION 'online_stock_valuation_anchor_changed'; END IF;
  body:=replace(body,'s.remaining_units::NUMERIC*s.equivalent_units/s.initial_units',
   '(s.remaining_units+COALESCE((SELECT sum(x.remaining_packets*x.format_grams*10) FROM public.kq_online_listings x WHERE x.stock_id=s.id),0))::NUMERIC*s.equivalent_units/s.initial_units');
  IF strpos(body,'SELECT COALESCE(SUM(ROUND(')=0 THEN RAISE EXCEPTION 'online_packaging_valuation_anchor_changed'; END IF;
  body:=replace(body,'SELECT COALESCE(SUM(ROUND(',
   'SELECT COALESCE((SELECT sum(cost_cents) FROM public.kq_online_packaging WHERE user_id=p_user),0)+COALESCE((SELECT sum(packaging_cost_cents-packaging_cost_sold_cents) FROM public.kq_online_listings WHERE user_id=p_user AND status<>''discarded''),0)+COALESCE(SUM(ROUND(');
  EXECUTE body;
 END IF;
END $$;

CREATE FUNCTION public.kq_online_observe_cost() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cost BIGINT; code TEXT; account TEXT;
BEGIN
 IF to_regprocedure('public.kq_treasury_pair(uuid,text,text,timestamptz,text,text,bigint,text)') IS NULL THEN RETURN NEW; END IF;
 cost:=NEW.amount_cents;
 IF NEW.kind='online-fee' THEN account:='expense_other';
 -- The stock valuation includes all unused/prepared packaging; stock_variation
 -- offsets this purchase expense until the inventory is actually consumed.
 ELSIF NEW.kind='online-buy-packaging' THEN account:='expense_other';
 ELSIF NEW.kind IN ('online-buy-upgrade','online-upgrade-site') THEN account:='expense_advertising';
 ELSE RETURN NEW; END IF;
 PERFORM public.kq_treasury_pair(NEW.user_id,NEW.kind,'online-ledger:'||NEW.id::TEXT,NEW.occurred_at,account,'suspense',cost,'Commerce en ligne');
 RETURN NEW;
END $$;
CREATE TRIGGER kq_online_cost_ledger AFTER INSERT ON public.kq_business_ledger FOR EACH ROW EXECUTE FUNCTION public.kq_online_observe_cost();

CREATE FUNCTION public.rpc_kq_online_settle_due(p_limit INTEGER DEFAULT 100) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner UUID; processed INTEGER:=0; failed INTEGER:=0; deferred INTEGER:=0;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'online_invalid_request'; END IF;
 FOR owner IN SELECT user_id FROM public.kq_online_accounts WHERE settled_until<now()-interval '1 minute'
  AND (marketing IS NOT NULL OR EXISTS(SELECT 1 FROM public.kq_online_listings l WHERE l.user_id=kq_online_accounts.user_id AND l.status='active' AND l.remaining_packets>0))
  ORDER BY settled_until,user_id LIMIT p_limit LOOP
  BEGIN
   IF NOT pg_try_advisory_xact_lock(hashtextextended('kq-equipment:'||owner::TEXT,0)) THEN deferred:=deferred+1; CONTINUE; END IF;
   PERFORM public.kq_business_settle(owner); processed:=processed+1;
  EXCEPTION WHEN OTHERS THEN failed:=failed+1; RAISE WARNING 'online_settlement_failed (%)',SQLSTATE;
  END;
 END LOOP;
 RETURN jsonb_build_object('processedUsers',processed,'failedUsers',failed,'deferredUsers',deferred);
END $$;

-- Milestones read fresh automatic customer counts and share the financial lock
-- order before the existing per-mission lock and receipt uniqueness checks.
DO $$ DECLARE body TEXT; BEGIN
 IF to_regprocedure('public.rpc_kq_claim_mission(uuid,text)') IS NOT NULL THEN
  SELECT pg_get_functiondef('public.rpc_kq_claim_mission(uuid,text)'::regprocedure) INTO body;
  EXECUTE replace(body,'  IF p_user_id IS NULL THEN','  PERFORM public.kq_business_settle(p_user_id); IF p_user_id IS NULL THEN');
 END IF;
END $$;

REVOKE ALL ON FUNCTION public.kq_online_packaging_catalog(TEXT),public.kq_online_site_catalog(TEXT),public.kq_online_marketing_catalog(TEXT),
 public.kq_online_monthly(UUID),public.kq_online_initialize(UUID),public.kq_online_business_at(UUID,TIMESTAMPTZ),public.kq_online_bank_at(UUID,TIMESTAMPTZ),public.kq_online_next_bank_event(UUID,TIMESTAMPTZ),
 public.kq_online_collect(UUID,INTEGER,TIMESTAMPTZ),public.kq_online_quality(public.kq_online_listings,TIMESTAMPTZ),
 public.kq_online_offer(UUID,public.kq_online_listings,TIMESTAMPTZ),public.kq_online_dispatch(UUID,UUID,TIMESTAMPTZ),public.kq_online_settle_until(UUID,TIMESTAMPTZ),
 public.kq_online_snapshot(UUID),public.kq_online_integer(JSONB,INTEGER,INTEGER),public.kq_online_observe_cost(),
 public.kq_online_raw_professional_price(TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC),
 public.kq_online_previous_business_snapshot(UUID),public.kq_online_previous_commerce_state(UUID),
 public.rpc_kq_online_state(UUID),public.rpc_kq_online_command(UUID,TEXT,JSONB,UUID),public.rpc_kq_online_settle_due(INTEGER),
 public.rpc_kq_commerce_state(UUID),public.kq_business_snapshot(UUID),public.kq_business_settle(UUID)
FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_online_state(UUID),public.rpc_kq_online_command(UUID,TEXT,JSONB,UUID),public.rpc_kq_online_settle_due(INTEGER),
 public.rpc_kq_commerce_state(UUID),public.kq_business_snapshot(UUID),public.kq_business_settle(UUID) TO service_role;

COMMIT;
