BEGIN;

-- Container capacities (tenths of a gram) and prices are game parameters.
-- Containers are reusable and each occupied container belongs to one lot.
CREATE FUNCTION public.kq_storage_container(p_code TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE p_code
 WHEN 'GLASS-1L' THEN '{"methodCode":"STORAGE-GLASS","capacityUnits":500,"priceCents":500}'::JSONB
 WHEN 'GLASS-2L' THEN '{"methodCode":"STORAGE-GLASS","capacityUnits":1000,"priceCents":900}'::JSONB
 WHEN 'GLASS-3L' THEN '{"methodCode":"STORAGE-GLASS","capacityUnits":1500,"priceCents":1200}'::JSONB
 WHEN 'GROVE-1OZ' THEN '{"methodCode":"STORAGE-GROVE","capacityUnits":280,"priceCents":300}'::JSONB
 WHEN 'GROVE-1LB' THEN '{"methodCode":"STORAGE-GROVE","capacityUnits":4540,"priceCents":1500}'::JSONB
 WHEN 'BOVEDA-1L' THEN '{"methodCode":"STORAGE-BOVEDA","capacityUnits":500,"priceCents":900}'::JSONB
 WHEN 'CVAULT-2OZ' THEN '{"methodCode":"STORAGE-CVAULT","capacityUnits":560,"priceCents":3500}'::JSONB
 WHEN 'CVAULT-1LB' THEN '{"methodCode":"STORAGE-CVAULT","capacityUnits":4540,"priceCents":12000}'::JSONB
 WHEN 'CANNATROL' THEN '{"methodCode":"STORAGE-CANNATROL","capacityUnits":20000,"priceCents":180000}'::JSONB END
$$;
REVOKE ALL ON FUNCTION public.kq_storage_container(TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.kq_storage_containers (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 container_code TEXT NOT NULL CHECK(public.kq_storage_container(container_code) IS NOT NULL),
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100000),
 PRIMARY KEY(user_id,container_code)
);
CREATE TABLE public.kq_storage_overflow_sales (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 flower_id UUID NOT NULL REFERENCES public.kq_flowers(id) ON DELETE RESTRICT,
 units INTEGER NOT NULL CHECK(units>0),
 payout_cents INTEGER NOT NULL CHECK(payout_cents>=0),
 net_payout_cents INTEGER NOT NULL CHECK(net_payout_cents>=0),
 automatic BOOLEAN NOT NULL,
 sold_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kq_storage_overflow_sales_owner ON public.kq_storage_overflow_sales(user_id,sold_at DESC);
ALTER TABLE public.kq_storage_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_storage_overflow_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_storage_containers FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON TABLE public.kq_storage_overflow_sales FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.kq_storage_accounts ADD COLUMN capacity_initialized BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.kq_storage_lots
 ADD COLUMN original_units INTEGER NOT NULL DEFAULT 0 CHECK(original_units>=0),
 ADD COLUMN overflow_sold_units INTEGER NOT NULL DEFAULT 0 CHECK(overflow_sold_units>=0 AND overflow_sold_units<=original_units);

CREATE FUNCTION public.kq_storage_initialize(p_user UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_storage_accounts%ROWTYPE; method TEXT; code TEXT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 INSERT INTO public.kq_storage_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM public.kq_storage_accounts WHERE user_id=p_user FOR UPDATE;
 IF a.capacity_initialized THEN RETURN; END IF;
 INSERT INTO public.kq_storage_containers VALUES(p_user,'GLASS-1L',2);
 -- One-time conversion of beta installations; future purchases are quantities.
 FOREACH method IN ARRAY a.owned_method_codes LOOP
  code:=CASE method WHEN 'STORAGE-GROVE' THEN 'GROVE-1LB' WHEN 'STORAGE-BOVEDA' THEN 'BOVEDA-1L'
    WHEN 'STORAGE-CVAULT' THEN 'CVAULT-1LB' WHEN 'STORAGE-CANNATROL' THEN 'CANNATROL' END;
  IF code IS NOT NULL THEN INSERT INTO public.kq_storage_containers VALUES(p_user,code,1); END IF;
 END LOOP;
 UPDATE public.kq_storage_accounts SET capacity_initialized=true WHERE user_id=p_user;
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_initialize(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_storage_remaining(p_flower UUID) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE
  WHEN EXISTS(SELECT 1 FROM public.kq_commerce_batches WHERE flower_id=p_flower)
   THEN COALESCE((SELECT ceil(sum(remaining_units::NUMERIC*equivalent_units/initial_units))::INTEGER FROM public.kq_commerce_stock WHERE flower_id=p_flower),0)
  WHEN EXISTS(SELECT 1 FROM public.kq_market_lots WHERE flower_id=p_flower AND status='sold') THEN 0
  ELSE original_units-overflow_sold_units END FROM public.kq_storage_lots WHERE flower_id=p_flower
$$;
REVOKE ALL ON FUNCTION public.kq_storage_remaining(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.kq_storage_settle(p_state JSONB,p_until TIMESTAMPTZ) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE elapsed NUMERIC; method JSONB; total INTEGER; stored INTEGER; aroma NUMERIC; chemistry NUMERIC;
BEGIN
 elapsed:=GREATEST(0,EXTRACT(EPOCH FROM(p_until-(p_state->>'lastSettledAt')::TIMESTAMPTZ))*1000);
 method:=public.kq_storage_method(p_state->>'methodCode');
 IF method IS NULL THEN RAISE EXCEPTION 'storage_invalid_method'; END IF;
 aroma:=(method->>'aromaRate')::INTEGER; chemistry:=(method->>'chemistryRate')::INTEGER;
 total:=(p_state->'capacity'->>'totalUnits')::INTEGER;
 IF total>0 THEN
  SELECT COALESCE(sum((entry->>'storedUnits')::INTEGER),0),
   COALESCE(sum((entry->>'storedUnits')::NUMERIC*(public.kq_storage_method(public.kq_storage_container(entry->>'containerCode')->>'methodCode')->>'aromaRate')::INTEGER),0),
   COALESCE(sum((entry->>'storedUnits')::NUMERIC*(public.kq_storage_method(public.kq_storage_container(entry->>'containerCode')->>'methodCode')->>'chemistryRate')::INTEGER),0)
   INTO stored,aroma,chemistry FROM jsonb_array_elements(p_state->'capacity'->'allocations') entry;
  aroma:=ceil((aroma+(total-stored)*100)/total); chemistry:=ceil((chemistry+(total-stored)*100)/total);
 END IF;
 RETURN p_state||jsonb_build_object('lastSettledAt',GREATEST(p_until,(p_state->>'lastSettledAt')::TIMESTAMPTZ),
  'exposure',jsonb_build_object('aromaWeightedMs',(p_state->'exposure'->>'aromaWeightedMs')::NUMERIC+elapsed*aroma,
   'chemistryWeightedMs',(p_state->'exposure'->>'chemistryWeightedMs')::NUMERIC+elapsed*chemistry));
END $$;

CREATE FUNCTION public.kq_storage_allocate(p_flower UUID,p_method TEXT DEFAULT NULL,p_repack BOOLEAN DEFAULT false) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lot public.kq_storage_lots%ROWTYPE; entry JSONB; chosen RECORD; allocations JSONB:='[]'; filled JSONB:='[]'; capacity JSONB;
 total INTEGER; remaining INTEGER; qty INTEGER; amount INTEGER; unit_capacity INTEGER; preferred TEXT; deadline TIMESTAMPTZ;
BEGIN
 SELECT * INTO lot FROM public.kq_storage_lots WHERE flower_id=p_flower FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 PERFORM public.kq_storage_initialize(lot.user_id);
 total:=public.kq_storage_remaining(p_flower); remaining:=total;
 preferred:=COALESCE(p_method,lot.state->>'methodCode');
 deadline:=COALESCE((lot.state->'capacity'->>'overflowDeadlineAt')::TIMESTAMPTZ,(lot.state->>'curingStartedAt')::TIMESTAMPTZ+interval '24 hours');
 -- Existing containers remain occupied until their remaining mass is sold.
 IF NOT p_repack THEN FOR entry IN SELECT value FROM jsonb_array_elements(COALESCE(lot.state->'capacity'->'allocations','[]')) LOOP
  EXIT WHEN remaining<=0;
  unit_capacity:=(public.kq_storage_container(entry->>'containerCode')->>'capacityUnits')::INTEGER;
  amount:=LEAST(remaining,(entry->>'storedUnits')::INTEGER);
  qty:=ceil(amount::NUMERIC/unit_capacity);
  allocations:=allocations||jsonb_build_array(jsonb_build_object('containerCode',entry->>'containerCode','quantity',qty,'storedUnits',amount));
  remaining:=remaining-amount;
 END LOOP; END IF;
 -- Only genuinely unprotected mass may fill a retained container's empty room.
 -- Filling during the first pass would silently move protected mass from later
 -- allocations (e.g. inox) into an earlier, partly filled glass container.
 IF remaining>0 THEN
  FOR entry IN SELECT value FROM jsonb_array_elements(allocations) LOOP
   unit_capacity:=(public.kq_storage_container(entry->>'containerCode')->>'capacityUnits')::INTEGER;
   amount:=LEAST(remaining,(entry->>'quantity')::INTEGER*unit_capacity-(entry->>'storedUnits')::INTEGER);
   filled:=filled||jsonb_build_array(jsonb_set(entry,'{storedUnits}',to_jsonb((entry->>'storedUnits')::INTEGER+amount)));
   remaining:=remaining-amount;
  END LOOP;
  allocations:=filled;
 END IF;
 WHILE remaining>0 LOOP
  SELECT available.* INTO chosen FROM (
   SELECT i.container_code,public.kq_storage_container(i.container_code) spec,
    i.quantity-COALESCE((SELECT sum((e->>'quantity')::INTEGER) FROM public.kq_storage_lots other,
      LATERAL jsonb_array_elements(COALESCE(other.state->'capacity'->'allocations','[]')) e
      WHERE other.user_id=lot.user_id AND other.flower_id<>p_flower AND e->>'containerCode'=i.container_code),0)
     -COALESCE((SELECT sum((e->>'quantity')::INTEGER) FROM jsonb_array_elements(allocations) e WHERE e->>'containerCode'=i.container_code),0) free
   FROM public.kq_storage_containers i WHERE i.user_id=lot.user_id
  ) available WHERE free>0
  ORDER BY (spec->>'methodCode'=preferred) DESC,
   (public.kq_storage_method(spec->>'methodCode')->>'aromaRate')::INTEGER,
   CASE WHEN (spec->>'capacityUnits')::INTEGER>=remaining THEN 0 ELSE 1 END,
   CASE WHEN (spec->>'capacityUnits')::INTEGER>=remaining THEN (spec->>'capacityUnits')::INTEGER ELSE -(spec->>'capacityUnits')::INTEGER END,
   container_code LIMIT 1;
  EXIT WHEN NOT FOUND;
  unit_capacity:=(chosen.spec->>'capacityUnits')::INTEGER;
  qty:=LEAST(chosen.free,GREATEST(1,floor(remaining::NUMERIC/unit_capacity)));
  amount:=LEAST(remaining,qty*unit_capacity);
  allocations:=allocations||jsonb_build_array(jsonb_build_object('containerCode',chosen.container_code,'quantity',qty,'storedUnits',amount));
  remaining:=remaining-amount;
 END LOOP;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('containerCode',code,'quantity',quantity,'storedUnits',units) ORDER BY position),'[]') INTO allocations
 FROM (SELECT e->>'containerCode' code,sum((e->>'quantity')::INTEGER) quantity,sum((e->>'storedUnits')::INTEGER) units,min(n) position
  FROM jsonb_array_elements(allocations) WITH ORDINALITY x(e,n) GROUP BY e->>'containerCode') grouped;
 capacity:=jsonb_build_object('totalUnits',total,'allocations',allocations,'overflowDeadlineAt',deadline);
 IF capacity IS DISTINCT FROM lot.state->'capacity' OR preferred IS DISTINCT FROM lot.state->>'methodCode' THEN
  UPDATE public.kq_storage_lots SET state=public.kq_storage_settle(lot.state,date_trunc('milliseconds',now()))
    ||jsonb_build_object('capacity',capacity,'methodCode',preferred),revision=revision+1 WHERE flower_id=p_flower;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_allocate(UUID,TEXT,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_storage_fill_user(p_user UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE flower UUID;
BEGIN
 FOR flower IN SELECT flower_id FROM public.kq_storage_lots WHERE user_id=p_user ORDER BY (state->>'curingStartedAt')::TIMESTAMPTZ,flower_id LOOP
  PERFORM public.kq_storage_allocate(flower);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_fill_user(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_storage_harvest_units(p_flower UUID) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT GREATEST(0,round(COALESCE((r.state->>'harvestGrams')::NUMERIC,m.harvest_grams,
  round(LEAST(500,GREATEST(20,LEAST(160,GREATEST(35,55+
   CASE WHEN jsonb_typeof(r.state->'history')='array' THEN (SELECT count(*)*7 FROM jsonb_array_elements(r.state->'history') h WHERE h->>'outcome' IN ('success','critical')) ELSE 21 END
   +COALESCE((to_jsonb(f)->>'quality')::NUMERIC,0)*3))
   *(1+GREATEST(0,LEAST(250,COALESCE((r.state->'equipment'->>'quantityPercent')::NUMERIC,0)))/100))),1))*10))::INTEGER
 FROM public.kq_flowers f LEFT JOIN public.kq_runs r ON r.id=f.run_id LEFT JOIN public.kq_market_lots m ON m.flower_id=f.id WHERE f.id=p_flower
$$;
REVOKE ALL ON FUNCTION public.kq_storage_harvest_units(UUID) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.kq_storage_create_lot(UUID) RENAME TO kq_storage_create_lot_without_capacity;
CREATE FUNCTION public.kq_storage_create_lot(p_flower UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lot public.kq_storage_lots%ROWTYPE; mass INTEGER; owner UUID;
BEGIN
 SELECT owner_id INTO owner FROM public.kq_flowers WHERE id=p_flower;
 IF owner IS NULL THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||owner::TEXT,0));
 PERFORM public.kq_storage_create_lot_without_capacity(p_flower);
 SELECT * INTO lot FROM public.kq_storage_lots WHERE flower_id=p_flower;
 IF NOT FOUND OR lot.state ? 'capacity' THEN RETURN; END IF;
 PERFORM public.kq_storage_initialize(lot.user_id);
 mass:=public.kq_storage_harvest_units(p_flower);
 UPDATE public.kq_storage_lots SET original_units=mass WHERE flower_id=p_flower;
 PERFORM public.kq_storage_allocate(p_flower);
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_create_lot(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_storage_sell_overflow(p_flower UUID,p_automatic BOOLEAN) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lot public.kq_storage_lots%ROWTYPE; units INTEGER; payout INTEGER; charges JSONB; result JSONB; receipt UUID:=gen_random_uuid();
 cash INTEGER; reputation INTEGER; score NUMERIC; net INTEGER;
BEGIN
 SELECT * INTO lot FROM public.kq_storage_lots WHERE flower_id=p_flower FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 units:=(lot.state->'capacity'->>'totalUnits')::INTEGER-COALESCE((SELECT sum((e->>'storedUnits')::INTEGER) FROM jsonb_array_elements(lot.state->'capacity'->'allocations') e),0);
 IF units<=0 THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.kq_commerce_batches WHERE flower_id=p_flower) THEN RAISE EXCEPTION 'storage_prepared_overflow'; END IF;
 -- Stable wholesale reprise: 30% of the raw 180 cents/g reference, no mastery.
 payout:=round((lot.overflow_sold_units+units)::NUMERIC*54/10)-round(lot.overflow_sold_units::NUMERIC*54/10);
 INSERT INTO public.kq_commerce_accounts(user_id) VALUES(lot.user_id) ON CONFLICT DO NOTHING;
 UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+payout WHERE user_id=lot.user_id;
 charges:=public.kq_business_collect_sale(lot.user_id,payout);
 net:=(charges->>'netPayoutCents')::INTEGER;
 SELECT cash_cents,w.reputation INTO cash,reputation FROM public.kq_equipment_wallets w WHERE user_id=lot.user_id;
 score:=COALESCE(public.kq_storage_verdict_score(p_flower),(lot.state->'baseline'->>'juryScore')::NUMERIC);
 INSERT INTO public.kq_storage_overflow_sales(id,user_id,flower_id,units,payout_cents,net_payout_cents,automatic)
  VALUES(receipt,lot.user_id,p_flower,units,payout,net,p_automatic);
 UPDATE public.kq_storage_lots SET overflow_sold_units=overflow_sold_units+units WHERE flower_id=p_flower;
 PERFORM public.kq_storage_allocate(p_flower);
 -- Full original harvest stays in the run/jury archive; only saleable mass shrinks.
 UPDATE public.kq_market_lots SET harvest_grams=public.kq_storage_remaining(p_flower)::NUMERIC/10,options='[]',updated_at=now(),
  status=CASE WHEN public.kq_storage_remaining(p_flower)=0 THEN 'sold' ELSE status END,
  selected_route=CASE WHEN public.kq_storage_remaining(p_flower)=0 THEN 'raw' ELSE selected_route END,
  payout_cents=CASE WHEN public.kq_storage_remaining(p_flower)=0 THEN payout ELSE payout_cents END,
  reputation_gain=CASE WHEN public.kq_storage_remaining(p_flower)=0 THEN 0 ELSE reputation_gain END,
  settled_at=CASE WHEN public.kq_storage_remaining(p_flower)=0 THEN now() ELSE settled_at END WHERE flower_id=p_flower;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=lot.user_id;
 result:=jsonb_build_object('action','sell-overflow','flowerId',p_flower,'channel','wholesale','units',units,'payoutCents',payout,
  'netPayoutCents',net,'cashAfterCents',cash,'reputationGain',0,'automatic',p_automatic,'soldAt',now())||charges;
 INSERT INTO public.kq_commerce_requests(user_id,request_key,action,payload,receipt)
  VALUES(lot.user_id,receipt,'sell-overflow',jsonb_build_object('flowerId',p_flower),result);
 INSERT INTO public.kq_market_sale_receipts(id,request_key,flower_id,owner_id,route,jury_score,harvest_grams,payout_cents,reputation_gain,
  cash_after_cents,reputation_after,electricity_paid_cents,vat_cents,lab_paid_cents,sales_channel)
  VALUES(receipt,receipt,p_flower,lot.user_id,'raw',score,units::NUMERIC/10,payout,0,cash,reputation,
   (charges->>'electricityPaidCents')::INTEGER,(charges->>'vatCents')::INTEGER,(charges->>'labPaidCents')::INTEGER,'wholesale');
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_sell_overflow(UUID,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_storage_settle_user(p_user UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE flower UUID; count INTEGER:=0; result JSONB;
BEGIN
 PERFORM public.kq_storage_initialize(p_user);
 FOR flower IN SELECT flower_id FROM public.kq_storage_lots WHERE user_id=p_user
  AND (state->'capacity'->>'overflowDeadlineAt')::TIMESTAMPTZ<=now()
  AND (state->'capacity'->>'totalUnits')::INTEGER>COALESCE((SELECT sum((e->>'storedUnits')::INTEGER) FROM jsonb_array_elements(state->'capacity'->'allocations') e),0)
  ORDER BY (state->'capacity'->>'overflowDeadlineAt')::TIMESTAMPTZ,flower_id LOOP
  result:=public.kq_storage_sell_overflow(flower,true);
  IF result IS NOT NULL THEN count:=count+1; END IF;
 END LOOP;
 RETURN count;
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_settle_user(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_storage_settle_due(p_limit INTEGER DEFAULT 100) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner UUID; users INTEGER:=0; sales INTEGER:=0; failed INTEGER:=0; deferred INTEGER:=0;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'storage_invalid_request'; END IF;
 FOR owner IN SELECT user_id FROM public.kq_storage_lots
  WHERE (state->'capacity'->>'overflowDeadlineAt')::TIMESTAMPTZ<=now()
  AND (state->'capacity'->>'totalUnits')::INTEGER>COALESCE((SELECT sum((e->>'storedUnits')::INTEGER) FROM jsonb_array_elements(state->'capacity'->'allocations') e),0)
  GROUP BY user_id ORDER BY min((state->'capacity'->>'overflowDeadlineAt')::TIMESTAMPTZ),user_id LIMIT p_limit LOOP
  BEGIN
   -- Never hold one player's lock while waiting for another player's duel.
   IF NOT pg_try_advisory_xact_lock(hashtextextended('kq-equipment:'||owner::TEXT,0)) THEN deferred:=deferred+1; CONTINUE; END IF;
   PERFORM public.kq_business_settle(owner);
   sales:=sales+public.kq_storage_settle_user(owner); users:=users+1;
  EXCEPTION WHEN OTHERS THEN
   failed:=failed+1;
   RAISE WARNING 'storage_overflow_settlement_failed (%)',SQLSTATE;
  END;
 END LOOP;
 RETURN jsonb_build_object('processedUsers',users,'sales',sales,'failedUsers',failed,'deferredUsers',deferred);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_storage_settle_due(INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_storage_settle_due(INTEGER) TO service_role;

CREATE FUNCTION public.kq_storage_overflow_offer(p_user UUID,p_state JSONB,p_sold INTEGER) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE units INTEGER; payout INTEGER;
BEGIN
 units:=(p_state->'capacity'->>'totalUnits')::INTEGER-COALESCE((SELECT sum((e->>'storedUnits')::INTEGER) FROM jsonb_array_elements(p_state->'capacity'->'allocations') e),0);
 IF units<=0 THEN RETURN NULL; END IF;
 payout:=round((p_sold+units)::NUMERIC*54/10)-round(p_sold::NUMERIC*54/10);
 RETURN jsonb_build_object('units',units,'payoutCents',payout)||public.kq_business_sale_preview(p_user,payout);
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_overflow_offer(UUID,JSONB,INTEGER) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_storage_state(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_storage_accounts%ROWTYPE; cash INTEGER; bought BIGINT; used BIGINT; reserved BIGINT; overflow BIGINT;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'storage_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM public.kq_business_settle(p_user_id);
 PERFORM public.kq_storage_settle_user(p_user_id);
 SELECT * INTO a FROM public.kq_storage_accounts WHERE user_id=p_user_id;
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
 SELECT COALESCE(sum(quantity*(public.kq_storage_container(container_code)->>'capacityUnits')::INTEGER),0) INTO bought FROM public.kq_storage_containers WHERE user_id=p_user_id;
 SELECT COALESCE(sum((e->>'storedUnits')::INTEGER),0),COALESCE(sum((e->>'quantity')::INTEGER*(public.kq_storage_container(e->>'containerCode')->>'capacityUnits')::INTEGER),0)
  INTO used,reserved FROM public.kq_storage_lots,LATERAL jsonb_array_elements(state->'capacity'->'allocations') e WHERE user_id=p_user_id;
 SELECT COALESCE(sum((state->'capacity'->>'totalUnits')::INTEGER),0)-used INTO overflow FROM public.kq_storage_lots WHERE user_id=p_user_id;
 RETURN jsonb_build_object('serverNow',now(),'cashCents',cash,'ownedMethodCodes',a.owned_method_codes,'defaultMethodCode',a.default_method_code,
  'ownedContainers',COALESCE((SELECT jsonb_object_agg(container_code,quantity) FROM public.kq_storage_containers WHERE user_id=p_user_id),'{}'),
  'capacity',jsonb_build_object('totalUnits',bought,'usedUnits',used,'freeUnits',bought-reserved,'reservedUnits',reserved,'overflowUnits',overflow),
  'overflowSales',COALESCE((SELECT jsonb_agg(jsonb_build_object('flowerId',flower_id,'units',units,'payoutCents',payout_cents,'netPayoutCents',net_payout_cents,'automatic',automatic,'soldAt',sold_at) ORDER BY sold_at DESC)
   FROM (SELECT * FROM public.kq_storage_overflow_sales WHERE user_id=p_user_id ORDER BY sold_at DESC LIMIT 20) sales),'[]'),
  'lots',COALESCE((SELECT jsonb_agg(jsonb_build_object('flowerId',s.flower_id,'varietyName',f.variety_name,'flowerStatus',f.status,
   'harvestGrams',s.original_units::NUMERIC/10,'state',s.state,'revision',s.revision,'juryScore',COALESCE(m.jury_score,public.kq_storage_verdict_score(s.flower_id)),
   'overflowOffer',public.kq_storage_overflow_offer(p_user_id,s.state,s.overflow_sold_units),
   'marketStatus',CASE WHEN (s.state->'capacity'->>'totalUnits')::INTEGER=0 THEN 'sold' ELSE m.status END) ORDER BY f.burned_at DESC,s.flower_id)
   FROM public.kq_storage_lots s JOIN public.kq_flowers f ON f.id=s.flower_id LEFT JOIN public.kq_market_lots m ON m.flower_id=s.flower_id WHERE s.user_id=p_user_id),'[]'));
END $$;

-- Retire the old one-installation purchase signature: stale clients must refresh.
REVOKE ALL ON FUNCTION public.rpc_kq_storage_command(UUID,TEXT,TEXT,UUID,UUID) FROM service_role;
CREATE FUNCTION public.rpc_kq_storage_capacity_command(p_user_id UUID,p_action TEXT,p_method_code TEXT,p_container_code TEXT,p_quantity INTEGER,p_flower_id UUID,p_request_key UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE payload JSONB; previous JSONB; item JSONB; price BIGINT; cash INTEGER; flower UUID; method TEXT;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR p_action IS NULL OR p_action NOT IN ('buy','select-default','assign','sell-overflow')
  OR (p_action IN ('assign','sell-overflow')) IS DISTINCT FROM(p_flower_id IS NOT NULL) THEN RAISE EXCEPTION 'storage_invalid_request'; END IF;
 IF p_action='buy' AND (public.kq_storage_container(p_container_code) IS NULL OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 1000 OR p_method_code IS NOT NULL)
  OR p_action IN ('select-default','assign') AND (public.kq_storage_method(p_method_code) IS NULL OR p_container_code IS NOT NULL OR p_quantity IS NOT NULL)
  OR p_action='sell-overflow' AND (p_method_code IS NOT NULL OR p_container_code IS NOT NULL OR p_quantity IS NOT NULL) THEN RAISE EXCEPTION 'storage_invalid_request'; END IF;
 PERFORM public.rpc_kq_storage_state(p_user_id);
 payload:=jsonb_build_object('action',p_action,'methodCode',p_method_code,'containerCode',p_container_code,'quantity',p_quantity,'flowerId',p_flower_id);
 SELECT r.payload INTO previous FROM public.kq_storage_requests r WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF previous IS DISTINCT FROM payload THEN RAISE EXCEPTION 'storage_request_mismatch'; END IF;
  RETURN public.rpc_kq_storage_state(p_user_id)||jsonb_build_object('replayed',true);
 END IF;
 IF p_action='buy' THEN
  item:=public.kq_storage_container(p_container_code); price:=(item->>'priceCents')::INTEGER::BIGINT*p_quantity;
  SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
  IF cash<price THEN RAISE EXCEPTION 'storage_insufficient_cash'; END IF;
  IF COALESCE((SELECT quantity FROM public.kq_storage_containers WHERE user_id=p_user_id AND container_code=p_container_code),0)+p_quantity>100000 THEN RAISE EXCEPTION 'storage_invalid_quantity'; END IF;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-price,updated_at=now() WHERE user_id=p_user_id;
  INSERT INTO public.kq_storage_containers(user_id,container_code,quantity) VALUES(p_user_id,p_container_code,p_quantity)
   ON CONFLICT(user_id,container_code) DO UPDATE SET quantity=public.kq_storage_containers.quantity+EXCLUDED.quantity;
  method:=item->>'methodCode';
  UPDATE public.kq_storage_accounts SET owned_method_codes=CASE WHEN method=ANY(owned_method_codes) THEN owned_method_codes ELSE array_append(owned_method_codes,method) END WHERE user_id=p_user_id;
  PERFORM public.kq_storage_fill_user(p_user_id);
 ELSIF p_action='sell-overflow' THEN
  IF NOT EXISTS(SELECT 1 FROM public.kq_storage_lots WHERE flower_id=p_flower_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'storage_lot_unavailable'; END IF;
  PERFORM public.kq_storage_sell_overflow(p_flower_id,false);
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.kq_storage_containers WHERE user_id=p_user_id AND public.kq_storage_container(container_code)->>'methodCode'=p_method_code) THEN RAISE EXCEPTION 'storage_not_owned'; END IF;
  IF p_action='select-default' THEN UPDATE public.kq_storage_accounts SET default_method_code=p_method_code WHERE user_id=p_user_id;
  ELSE
   IF NOT EXISTS(SELECT 1 FROM public.kq_storage_lots WHERE flower_id=p_flower_id AND user_id=p_user_id AND public.kq_storage_remaining(flower_id)>0) THEN RAISE EXCEPTION 'storage_lot_unavailable'; END IF;
   PERFORM public.kq_storage_allocate(p_flower_id,p_method_code,true);
   PERFORM public.kq_storage_fill_user(p_user_id);
  END IF;
 END IF;
 INSERT INTO public.kq_storage_requests(user_id,request_key,payload) VALUES(p_user_id,p_request_key,payload);
 RETURN public.rpc_kq_storage_state(p_user_id)||jsonb_build_object('replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_storage_capacity_command(UUID,TEXT,TEXT,TEXT,INTEGER,UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_storage_capacity_command(UUID,TEXT,TEXT,TEXT,INTEGER,UUID,UUID) TO service_role;

-- Existing prepared beta stocks receive only the containers necessary to avoid
-- introducing unprotected derivatives. This runs once, never on future sales.
DO $$ DECLARE owner UUID; flower UUID; extra INTEGER; mass INTEGER; BEGIN
 FOR owner IN SELECT user_id FROM public.kq_storage_accounts LOOP PERFORM public.kq_storage_initialize(owner); END LOOP;
 FOR flower IN SELECT flower_id FROM public.kq_storage_lots ORDER BY (state->>'curingStartedAt')::TIMESTAMPTZ,flower_id LOOP
  UPDATE public.kq_storage_lots s SET original_units=public.kq_storage_harvest_units(s.flower_id),
   state=jsonb_set(state,'{capacity}',jsonb_build_object('totalUnits',0,'allocations','[]'::JSONB,'overflowDeadlineAt',now()+interval '24 hours')) WHERE flower_id=flower;
  PERFORM public.kq_storage_allocate(flower);
  IF EXISTS(SELECT 1 FROM public.kq_commerce_batches WHERE flower_id=flower) THEN
   SELECT user_id,(state->'capacity'->>'totalUnits')::INTEGER-COALESCE((SELECT sum((e->>'storedUnits')::INTEGER) FROM jsonb_array_elements(state->'capacity'->'allocations') e),0)
    INTO owner,mass FROM public.kq_storage_lots WHERE flower_id=flower;
   extra:=ceil(mass::NUMERIC/500);
   IF extra>0 THEN
    INSERT INTO public.kq_storage_containers VALUES(owner,'GLASS-1L',extra) ON CONFLICT(user_id,container_code) DO UPDATE SET quantity=public.kq_storage_containers.quantity+EXCLUDED.quantity;
    PERFORM public.kq_storage_allocate(flower);
   END IF;
  END IF;
 END LOOP;
END $$;

-- Partial surplus sales may leave less than the old 20g minimum.
ALTER TABLE public.kq_market_lots DROP CONSTRAINT kq_market_lots_harvest_grams_check;
ALTER TABLE public.kq_market_lots ADD CONSTRAINT kq_market_lots_harvest_grams_check CHECK(harvest_grams BETWEEN 0 AND 4000);
DO $$ DECLARE definition TEXT; fragment TEXT; BEGIN
 definition:=pg_get_functiondef('public.rpc_kq_prepare_market_lot(uuid,uuid,numeric,numeric,text,text[],jsonb)'::regprocedure);
 IF position('p_harvest_grams NOT BETWEEN 20 AND' IN definition)=0 THEN RAISE EXCEPTION 'storage_capacity_market_anchor_missing'; END IF;
 definition:=replace(definition,'p_harvest_grams NOT BETWEEN 20 AND','p_harvest_grams NOT BETWEEN 0.1 AND');
 fragment:='  PERFORM id FROM public.kq_flowers';
 IF position(fragment IN definition)=0 THEN RAISE EXCEPTION 'storage_capacity_market_lock_anchor_missing'; END IF;
 definition:=replace(definition,fragment,E'  PERFORM pg_advisory_xact_lock(hashtextextended(''kq-equipment:''||p_user_id::TEXT,0));\n  PERFORM public.kq_business_settle(p_user_id);\n  PERFORM public.kq_storage_settle_user(p_user_id);\n  IF round(p_harvest_grams*10) IS DISTINCT FROM public.kq_storage_remaining(p_flower_id) THEN RAISE EXCEPTION ''commerce_storage_changed''; END IF;\n'||fragment);
 fragment:='    equipment_codes = EXCLUDED.equipment_codes,';
 IF position(fragment IN definition)=0 THEN RAISE EXCEPTION 'storage_capacity_market_mass_anchor_missing'; END IF;
 definition:=replace(definition,fragment,E'    harvest_grams = EXCLUDED.harvest_grams,\n'||fragment);
 EXECUTE definition;
 definition:=pg_get_functiondef('public.rpc_kq_commerce_state(uuid)'::regprocedure);
 fragment:=' IF p_user_id IS NULL THEN';
 IF position(fragment IN definition)=0 THEN RAISE EXCEPTION 'storage_capacity_state_anchor_missing'; END IF;
 definition:=replace(definition,fragment,E' PERFORM pg_advisory_xact_lock(hashtextextended(''kq-equipment:''||p_user_id::TEXT,0));\n PERFORM public.kq_business_settle(p_user_id);\n PERFORM public.kq_storage_settle_user(p_user_id);\n'||fragment);
 fragment:='f.status::TEXT=''burned'' AND NOT EXISTS';
 IF position(fragment IN definition)=0 THEN RAISE EXCEPTION 'storage_capacity_raw_anchor_missing'; END IF;
 definition:=replace(definition,fragment,'f.status::TEXT=''burned'' AND public.kq_storage_remaining(f.id)>0 AND NOT EXISTS');
 EXECUTE definition;
 definition:=pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure);
 fragment:='SELECT value INTO opt FROM jsonb_array_elements(l.options) WHERE value->>''route''=route_code;';
 IF position(fragment IN definition)=0 THEN RAISE EXCEPTION 'storage_capacity_prepare_anchor_missing'; END IF;
 definition:=replace(definition,fragment,E'IF EXISTS(SELECT 1 FROM public.kq_storage_lots WHERE flower_id=fid AND (state->''capacity''->>''totalUnits'')::INTEGER>COALESCE((SELECT sum((e->>''storedUnits'')::INTEGER) FROM jsonb_array_elements(state->''capacity''->''allocations'') e),0)) THEN RAISE EXCEPTION ''commerce_storage_overflow''; END IF;\n IF round(l.harvest_grams*10) IS DISTINCT FROM public.kq_storage_remaining(fid) THEN RAISE EXCEPTION ''commerce_storage_changed''; END IF;\n '||fragment);
 fragment:='UPDATE public.kq_commerce_stock SET remaining_units=remaining_units-units';
 IF position(fragment IN definition)=0 THEN RAISE EXCEPTION 'storage_capacity_sale_anchor_missing'; END IF;
 -- Reservation release follows the whole command, after all stock mutations.
 fragment:='  UPDATE public.kq_commerce_batches SET rep_exact=';
 IF position(fragment IN definition)=0 THEN RAISE EXCEPTION 'storage_capacity_release_anchor_missing'; END IF;
 definition:=replace(definition,fragment,E'  PERFORM public.kq_storage_allocate(s.flower_id);\n  PERFORM public.kq_storage_fill_user(p_user_id);\n'||fragment);
 EXECUTE definition;
END $$;

COMMIT;
