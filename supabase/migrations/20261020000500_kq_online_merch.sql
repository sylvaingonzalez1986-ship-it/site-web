BEGIN;

-- Merchandise has its own physical inventory and results. It never grants
-- flower orders, quality, reputation, followers or cultivation milestones.
CREATE TABLE public.kq_online_merch_modules (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 code TEXT NOT NULL CHECK(code IN ('paper','textile','objects')),
 cost_cents INTEGER NOT NULL CHECK(cost_cents>0),
 acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,code)
);
CREATE TABLE public.kq_online_merch_inventory (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 code TEXT NOT NULL CHECK(code IN ('stickers','poster','tote','tshirt','mug','cap')),
 quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity BETWEEN 0 AND 500),
 price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 1 AND 100000),
 active BOOLEAN NOT NULL DEFAULT false,
 sold INTEGER NOT NULL DEFAULT 0 CHECK(sold>=0),
 progress NUMERIC(30,15) NOT NULL DEFAULT 0 CHECK(progress>=0),
 purchased_cost_cents BIGINT NOT NULL DEFAULT 0 CHECK(purchased_cost_cents>=0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,code),
 CHECK(NOT active OR quantity>0)
);
CREATE TABLE public.kq_online_merch_sales (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 code TEXT NOT NULL,
 unit_number INTEGER NOT NULL CHECK(unit_number>0),
 occurred_at TIMESTAMPTZ NOT NULL,
 price_cents INTEGER NOT NULL CHECK(price_cents>0),
 net_payout_cents INTEGER NOT NULL CHECK(net_payout_cents>=0),
 fee_cents INTEGER NOT NULL CHECK(fee_cents>=0),
 vat_cents INTEGER NOT NULL CHECK(vat_cents>=0),
 cost_cents INTEGER NOT NULL CHECK(cost_cents>0),
 lab_paid_cents INTEGER NOT NULL CHECK(lab_paid_cents>=0),
 electricity_paid_cents INTEGER NOT NULL CHECK(electricity_paid_cents>=0),
 FOREIGN KEY(user_id,code) REFERENCES public.kq_online_merch_inventory(user_id,code),
 UNIQUE(user_id,code,unit_number)
);
CREATE INDEX kq_online_merch_sales_user ON public.kq_online_merch_sales(user_id,occurred_at DESC,id);
ALTER TABLE public.kq_online_merch_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_online_merch_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_online_merch_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_online_merch_modules,public.kq_online_merch_inventory,public.kq_online_merch_sales
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_online_merch_module_catalog(p_code TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE p_code
  WHEN 'paper' THEN jsonb_build_object('code',p_code,'costCents',12000,'minimumLevel',2,'minimumOrders',5,'minimumConfidence',45)
  WHEN 'textile' THEN jsonb_build_object('code',p_code,'costCents',65000,'minimumLevel',3,'minimumOrders',30,'minimumConfidence',60)
  WHEN 'objects' THEN jsonb_build_object('code',p_code,'costCents',95000,'minimumLevel',4,'minimumOrders',80,'minimumConfidence',70)
 END;
$$;
CREATE FUNCTION public.kq_online_merch_catalog(p_code TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE p_code
  WHEN 'stickers' THEN jsonb_build_object('code',p_code,'module','paper','unitCostCents',80,'referencePriceCents',400,'demandMultiplier',3)
  WHEN 'poster' THEN jsonb_build_object('code',p_code,'module','paper','unitCostCents',300,'referencePriceCents',1200,'demandMultiplier',1.2)
  WHEN 'tote' THEN jsonb_build_object('code',p_code,'module','textile','unitCostCents',650,'referencePriceCents',1800,'demandMultiplier',.9)
  WHEN 'tshirt' THEN jsonb_build_object('code',p_code,'module','textile','unitCostCents',1100,'referencePriceCents',2800,'demandMultiplier',.65)
  WHEN 'mug' THEN jsonb_build_object('code',p_code,'module','objects','unitCostCents',550,'referencePriceCents',1600,'demandMultiplier',1)
  WHEN 'cap' THEN jsonb_build_object('code',p_code,'module','objects','unitCostCents',850,'referencePriceCents',2200,'demandMultiplier',.8)
 END;
$$;

CREATE FUNCTION public.kq_online_merch_command(p_user UUID,p_action TEXT,p_payload JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.kq_online_accounts%ROWTYPE; a public.kq_commerce_accounts%ROWTYPE;
 item public.kq_online_merch_inventory%ROWTYPE; spec JSONB; code TEXT:=p_payload->>'code';
 qty INTEGER; price INTEGER; enabled BOOLEAN; level INTEGER; slots INTEGER; cost INTEGER:=0; site_active BOOLEAN;
BEGIN
 SELECT * INTO o FROM public.kq_online_accounts WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user FOR UPDATE;
 level:=COALESCE((public.kq_online_site_catalog(o.site_tier)->>'level')::INTEGER,0);
 site_active:=COALESCE(a.computer_owned AND a.shop_created_at IS NOT NULL AND
  (o.site_tier='basic' OR (NOT a.shop_suspended AND a.shop_paid_until>now())),false);
 IF p_action='buy-merch-module' THEN
  spec:=public.kq_online_merch_module_catalog(code);
  IF spec IS NULL THEN RAISE EXCEPTION 'online_merch_unknown'; END IF;
  IF EXISTS(SELECT 1 FROM public.kq_online_merch_modules m WHERE m.user_id=p_user AND m.code=spec->>'code') THEN RAISE EXCEPTION 'online_merch_module_owned'; END IF;
  IF NOT site_active THEN RAISE EXCEPTION 'online_site_required'; END IF;
  IF NOT o.branding THEN RAISE EXCEPTION 'online_branding_required'; END IF;
  IF level<(spec->>'minimumLevel')::INTEGER OR o.total_packets<(spec->>'minimumOrders')::INTEGER
   OR o.confidence<(spec->>'minimumConfidence')::NUMERIC THEN RAISE EXCEPTION 'online_merch_progression_required'; END IF;
  cost:=(spec->>'costCents')::INTEGER;
  INSERT INTO public.kq_online_merch_modules(user_id,code,cost_cents) VALUES(p_user,code,cost);
 ELSIF p_action='buy-merch-stock' THEN
  spec:=public.kq_online_merch_catalog(code);
  IF spec IS NULL THEN RAISE EXCEPTION 'online_merch_unknown'; END IF;
  IF NOT site_active THEN RAISE EXCEPTION 'online_site_required'; END IF;
  IF NOT o.branding THEN RAISE EXCEPTION 'online_branding_required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.kq_online_merch_modules m WHERE m.user_id=p_user AND m.code=spec->>'module') THEN RAISE EXCEPTION 'online_merch_module_required'; END IF;
  qty:=public.kq_online_integer(p_payload->'quantity',1,500);
  SELECT * INTO item FROM public.kq_online_merch_inventory i WHERE i.user_id=p_user AND i.code=spec->>'code' FOR UPDATE;
  IF COALESCE(item.quantity,0)+qty>500 THEN RAISE EXCEPTION 'online_merch_stock_limit'; END IF;
  cost:=qty*(spec->>'unitCostCents')::INTEGER;
  INSERT INTO public.kq_online_merch_inventory(user_id,code,quantity,price_cents,purchased_cost_cents)
   VALUES(p_user,code,qty,(spec->>'referencePriceCents')::INTEGER,cost)
  ON CONFLICT ON CONSTRAINT kq_online_merch_inventory_pkey DO UPDATE
   SET quantity=public.kq_online_merch_inventory.quantity+qty,purchased_cost_cents=public.kq_online_merch_inventory.purchased_cost_cents+cost,changed_at=now();
 ELSIF p_action='update-merch' THEN
  spec:=public.kq_online_merch_catalog(code);
  IF spec IS NULL THEN RAISE EXCEPTION 'online_merch_unknown'; END IF;
  price:=public.kq_online_integer(p_payload->'priceCents',1,100000);
  IF jsonb_typeof(p_payload->'active') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'online_invalid_request'; END IF;
  enabled:=(p_payload->>'active')::BOOLEAN;
  SELECT * INTO item FROM public.kq_online_merch_inventory i WHERE i.user_id=p_user AND i.code=spec->>'code' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'online_merch_stock_required'; END IF;
  IF enabled THEN
   IF NOT site_active THEN RAISE EXCEPTION 'online_site_required'; END IF;
   IF NOT o.branding THEN RAISE EXCEPTION 'online_branding_required'; END IF;
   IF item.quantity=0 THEN RAISE EXCEPTION 'online_merch_stock_required'; END IF;
   slots:=CASE WHEN level>=2 THEN level ELSE 0 END;
   IF (SELECT count(*) FROM public.kq_online_merch_inventory i WHERE i.user_id=p_user AND i.active AND i.quantity>0 AND i.code<>spec->>'code')>=slots THEN RAISE EXCEPTION 'online_merch_slots'; END IF;
  END IF;
  UPDATE public.kq_online_merch_inventory i SET price_cents=price,active=enabled,
   progress=CASE WHEN item.price_cents<>price OR item.active IS DISTINCT FROM enabled THEN 0 ELSE i.progress END,changed_at=now()
   WHERE i.user_id=p_user AND i.code=spec->>'code';
 ELSE RAISE EXCEPTION 'online_invalid_request'; END IF;
 RETURN jsonb_build_object('code',code,'paidCents',cost);
END $$;

-- Only organic discovery serves this separate range. Flower campaign budgets,
-- advertising and article count cannot multiply the same merch audience.
CREATE FUNCTION public.kq_online_merch_rate(p_user UUID,p_code TEXT,p_price INTEGER,p_at TIMESTAMPTZ) RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.kq_online_accounts%ROWTYPE; a public.kq_commerce_accounts%ROWTYPE;
 spec JSONB; tier JSONB; ratio NUMERIC; acceptance NUMERIC; audience NUMERIC; rep INTEGER; competing INTEGER;
BEGIN
 SELECT * INTO o FROM public.kq_online_accounts WHERE user_id=p_user;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user;
 spec:=public.kq_online_merch_catalog(p_code); tier:=public.kq_online_site_catalog(o.site_tier);
 IF spec IS NULL OR NOT COALESCE(o.branding,false) OR COALESCE((tier->>'level')::INTEGER,0)<2
  OR NOT EXISTS(SELECT 1 FROM public.kq_online_merch_modules WHERE user_id=p_user AND code=spec->>'module')
  OR NOT a.computer_owned OR a.shop_created_at IS NULL OR
  o.site_tier='none' OR (o.site_tier<>'basic' AND (a.shop_suspended OR a.shop_paid_until<=p_at)) THEN RETURN 0; END IF;
 SELECT reputation INTO rep FROM public.kq_equipment_wallets WHERE user_id=p_user;
 SELECT count(*) INTO competing FROM public.kq_online_merch_inventory WHERE user_id=p_user AND active AND quantity>0;
 ratio:=p_price::NUMERIC/(spec->>'referencePriceCents')::NUMERIC;
 acceptance:=CASE WHEN ratio<=1 THEN LEAST(1.35,1+.35*(1-ratio)) WHEN ratio<=1.25 THEN 1-.7*(ratio-1)
  WHEN ratio<2.5 THEN .825*power((2.5-ratio)/1.25,2) ELSE 0 END;
 audience:=(24+LEAST(o.followers,5000)*.12)*(1+GREATEST(0,LEAST(.25,rep::NUMERIC/6000)))+GREATEST(0,a.clients)*2.4;
 RETURN audience*.04*(tier->>'conversion')::NUMERIC*(.25+.75*GREATEST(0,LEAST(100,o.confidence))/100)
  *(spec->>'demandMultiplier')::NUMERIC*acceptance/GREATEST(1,competing);
END $$;

CREATE FUNCTION public.kq_online_merch_dispatch(p_user UUID,p_code TEXT,p_at TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item public.kq_online_merch_inventory%ROWTYPE; charges JSONB; spec JSONB; receipt UUID:=gen_random_uuid(); tax INTEGER;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 SELECT * INTO item FROM public.kq_online_merch_inventory WHERE user_id=p_user AND code=p_code FOR UPDATE;
 IF NOT FOUND OR NOT item.active OR item.quantity<=0 OR item.progress<1 THEN RETURN; END IF;
 IF public.kq_online_merch_rate(p_user,p_code,item.price_cents,p_at)<=0 THEN RETURN; END IF;
 spec:=public.kq_online_merch_catalog(p_code);
 charges:=public.kq_online_collect(p_user,item.price_cents,p_at); tax:=(charges->>'vatCents')::INTEGER;
 UPDATE public.kq_online_merch_inventory SET quantity=quantity-1,sold=sold+1,
  active=CASE WHEN quantity=1 THEN false ELSE active END,
  progress=CASE WHEN quantity=1 THEN 0 ELSE GREATEST(0,progress-1) END,changed_at=p_at WHERE user_id=p_user AND code=p_code;
 INSERT INTO public.kq_online_merch_sales(id,user_id,code,unit_number,occurred_at,price_cents,net_payout_cents,fee_cents,vat_cents,cost_cents,lab_paid_cents,electricity_paid_cents)
  VALUES(receipt,p_user,p_code,item.sold+1,p_at,item.price_cents,(charges->>'netPayoutCents')::INTEGER,(charges->>'feesCents')::INTEGER,tax,
   (spec->>'unitCostCents')::INTEGER,(charges->>'labPaidCents')::INTEGER,(charges->>'electricityPaidCents')::INTEGER);
 IF to_regprocedure('public.kq_treasury_pair(uuid,text,text,timestamptz,text,text,bigint,text)') IS NOT NULL THEN
  PERFORM public.kq_treasury_pair(p_user,'merch-sale','merch-sale:'||receipt::TEXT,p_at,'suspense','revenue_online',(item.price_cents-tax)::BIGINT,'Merch · '||p_code);
  IF tax>0 THEN PERFORM public.kq_treasury_pair(p_user,'merch-vat','merch-vat:'||receipt::TEXT,p_at,'suspense','vat_payable',tax::BIGINT,'TVA du merch'); END IF;
 END IF;
 UPDATE public.kq_online_accounts SET revision=revision+1 WHERE user_id=p_user;
END $$;

CREATE FUNCTION public.kq_online_merch_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('version',1,
  'modules',COALESCE((SELECT jsonb_agg(code ORDER BY acquired_at,code) FROM public.kq_online_merch_modules WHERE user_id=p_user),'[]'::JSONB),
  'inventory',COALESCE((SELECT jsonb_agg(jsonb_build_object('code',code,'quantity',quantity,'priceCents',price_cents,'active',active,'sold',sold,'progress',progress) ORDER BY created_at,code)
   FROM public.kq_online_merch_inventory WHERE user_id=p_user),'[]'::JSONB),
  'stats',jsonb_build_object('unitsSold',(SELECT count(*) FROM public.kq_online_merch_sales WHERE user_id=p_user),
   'revenueCents',COALESCE((SELECT sum(price_cents) FROM public.kq_online_merch_sales WHERE user_id=p_user),0),
   'netRevenueCents',COALESCE((SELECT sum(net_payout_cents) FROM public.kq_online_merch_sales WHERE user_id=p_user),0),
   'feesCents',COALESCE((SELECT sum(fee_cents) FROM public.kq_online_merch_sales WHERE user_id=p_user),0),
   'stockCostCents',COALESCE((SELECT sum(purchased_cost_cents) FROM public.kq_online_merch_inventory WHERE user_id=p_user),0),
   'costOfGoodsSoldCents',COALESCE((SELECT sum(cost_cents) FROM public.kq_online_merch_sales WHERE user_id=p_user),0),
   'moduleCostCents',COALESCE((SELECT sum(cost_cents) FROM public.kq_online_merch_modules WHERE user_id=p_user),0)),
  'recentSales',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'code',code,'quantity',1,'soldAt',occurred_at,'priceCents',price_cents,'netPayoutCents',net_payout_cents,'feesCents',fee_cents,'costCents',cost_cents) ORDER BY occurred_at DESC,id)
   FROM (SELECT * FROM public.kq_online_merch_sales WHERE user_id=p_user ORDER BY occurred_at DESC,id LIMIT 20) x),'[]'::JSONB));
$$;

DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 -- A one-cent price can coincide with both the cumulative VAT and fee round-up.
 -- Defer only the uncollectable fee cent; fee_exact retains it for the next sale.
 -- This protects the common collection path without forgiving any owed fee.
 SELECT pg_get_functiondef('public.kq_online_collect(uuid,integer,timestamptz)'::regprocedure) INTO body;
 fragment:='fee:=round(o.fee_exact+p_payout*0.025)-o.fee_rounded;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'merch_minimum_price_fee_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'fee:=LEAST(round(o.fee_exact+p_payout*0.025)-o.fee_rounded,GREATEST(0,p_payout-tax));');

 -- Reuse the current mutex, settlement, validation, debit and replay receipt.
 SELECT pg_get_functiondef('public.rpc_kq_online_command(uuid,text,jsonb,uuid)'::regprocedure) INTO body;
 fragment:=' IF p_action=''buy-packaging'' THEN';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'merch_command_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,$patch$ IF p_action IN ('buy-merch-module','buy-merch-stock','update-merch') THEN
  result:=public.kq_online_merch_command(p_user_id,p_action,p_payload); cost:=(result->>'paidCents')::INTEGER;
 ELSIF p_action='buy-packaging' THEN$patch$);

 SELECT pg_get_functiondef('public.kq_online_snapshot(uuid)'::regprocedure) INTO body;
 fragment:='''upgrades'',jsonb_build_object(''photography'',o.photography,';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'merch_snapshot_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'''merch'',public.kq_online_merch_snapshot(p_user),'||fragment);

 -- Merch events share the existing chronological loop. A sale can fund the
 -- next renewal; a sale after suspension cannot retroactively fund it.
 SELECT pg_get_functiondef('public.kq_online_settle_until(uuid,timestamptz)'::regprocedure) INTO body;
 fragment:=' cursor_at TIMESTAMPTZ;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'merch_settlement_declaration_anchor_changed'; END IF;
 body:=replace(body,fragment,' merch_item public.kq_online_merch_inventory%ROWTYPE; merch_rates JSONB;'||fragment);
 fragment:='  PERFORM public.kq_online_bank_at(p_user,cursor_at);';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'merch_settlement_dispatch_anchor_changed'; END IF;
 body:=replace(body,fragment,$patch$  FOR merch_item IN SELECT * FROM public.kq_online_merch_inventory WHERE user_id=p_user AND active AND quantity>0 AND progress>=1 ORDER BY created_at,code LOOP
   PERFORM public.kq_online_merch_dispatch(p_user,merch_item.code,cursor_at);
  END LOOP;
$patch$||fragment);
 fragment:='  -- No physical product can be shipped twice:';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'merch_settlement_rates_anchor_changed'; END IF;
 body:=replace(body,fragment,$patch$  merch_rates:='{}'::JSONB;
  FOR merch_item IN SELECT * FROM public.kq_online_merch_inventory WHERE user_id=p_user AND active AND quantity>0 ORDER BY created_at,code LOOP
   rate:=public.kq_online_merch_rate(p_user,merch_item.code,merch_item.price_cents,cursor_at);
   merch_rates:=merch_rates||jsonb_build_object(merch_item.code,rate);
   IF rate>0 THEN
    elapsed:=GREATEST(1,ceil(GREATEST(0,1-merch_item.progress)*86400*1000000/rate));
    IF elapsed<=extract(epoch FROM(next_at-cursor_at))*1000000 THEN next_at:=cursor_at+elapsed*interval '1 microsecond'; END IF;
   END IF;
  END LOOP;
$patch$||fragment);
 fragment:='  UPDATE public.kq_online_accounts SET settled_until=next_at,';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'merch_settlement_progress_anchor_changed'; END IF;
 body:=replace(body,fragment,$patch$  UPDATE public.kq_online_merch_inventory SET progress=progress+COALESCE((merch_rates->>code)::NUMERIC,0)*elapsed/86400
   WHERE user_id=p_user AND active AND quantity>0;
$patch$||fragment);
 EXECUTE body;

 SELECT pg_get_functiondef('public.rpc_kq_online_settle_due(integer)'::regprocedure) INTO body;
 fragment:='  AND (marketing IS NOT NULL OR EXISTS(';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'merch_cron_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'  AND (EXISTS(SELECT 1 FROM public.kq_online_merch_inventory m WHERE m.user_id=kq_online_accounts.user_id AND m.active AND m.quantity>0) OR marketing IS NOT NULL OR EXISTS(');

 SELECT pg_get_functiondef('public.kq_online_observe_cost()'::regprocedure) INTO body;
 fragment:='NEW.kind=''online-buy-packaging''';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'merch_stock_cost_anchor_changed'; END IF;
 body:=replace(body,fragment,'NEW.kind IN (''online-buy-packaging'',''online-buy-merch-stock'')');
 fragment:='NEW.kind IN (''online-buy-upgrade'',''online-upgrade-site'',''online-start-marketing'')';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'merch_module_cost_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'NEW.kind IN (''online-buy-upgrade'',''online-upgrade-site'',''online-start-marketing'',''online-buy-merch-module'')');

 IF to_regprocedure('public.kq_treasury_stock_cost(uuid)') IS NOT NULL THEN
  SELECT pg_get_functiondef('public.kq_treasury_stock_cost(uuid)'::regprocedure) INTO body;
  fragment:='SELECT COALESCE((SELECT sum(cost_cents) FROM public.kq_online_packaging';
  IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'merch_inventory_valuation_anchor_changed'; END IF;
  EXECUTE replace(body,fragment,'SELECT COALESCE((SELECT sum(quantity*(public.kq_online_merch_catalog(code)->>''unitCostCents'')::BIGINT) FROM public.kq_online_merch_inventory WHERE user_id=p_user),0)+COALESCE((SELECT sum(cost_cents) FROM public.kq_online_packaging');
 END IF;
END $$;

REVOKE ALL ON FUNCTION public.kq_online_merch_module_catalog(TEXT),public.kq_online_merch_catalog(TEXT),
 public.kq_online_merch_command(UUID,TEXT,JSONB),public.kq_online_merch_rate(UUID,TEXT,INTEGER,TIMESTAMPTZ),
 public.kq_online_merch_dispatch(UUID,TEXT,TIMESTAMPTZ),public.kq_online_merch_snapshot(UUID)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_online_command(UUID,TEXT,JSONB,UUID),public.rpc_kq_online_settle_due(INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_online_command(UUID,TEXT,JSONB,UUID),public.rpc_kq_online_settle_due(INTEGER) TO service_role;

COMMIT;
