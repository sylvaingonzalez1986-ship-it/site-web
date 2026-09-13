BEGIN;

-- Independent retail relationships; existing players start with prospecting, not invented partners.
ALTER TABLE public.kq_commerce_accounts
 ADD COLUMN shop_partners INTEGER NOT NULL DEFAULT 0 CHECK(shop_partners BETWEEN 0 AND 20),
 ADD COLUMN shop_recruitment NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK(shop_recruitment>=0 AND shop_recruitment<6000),
 ADD COLUMN shop_churn NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK(shop_churn>=0 AND shop_churn<6000);
ALTER TABLE public.kq_commerce_campaigns
 ADD COLUMN shop_partners_start INTEGER NOT NULL DEFAULT 0 CHECK(shop_partners_start BETWEEN 0 AND 20),
 ADD COLUMN shop_recruitment_start NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK(shop_recruitment_start>=0 AND shop_recruitment_start<6000),
 ADD COLUMN shop_churn_start NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK(shop_churn_start>=0 AND shop_churn_start<6000),
 ADD COLUMN shop_good_units NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK(shop_good_units>=0),
 ADD COLUMN shop_bad_units NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK(shop_bad_units>=0);
-- All previously authored offers must be refreshed against the new rates.
UPDATE public.kq_commerce_accounts SET revision=revision+1;

CREATE OR REPLACE FUNCTION public.kq_commerce_open_cycle(p_user UUID,p_run UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_commerce_accounts%ROWTYPE; w public.kq_equipment_wallets%ROWTYPE; draw INTEGER; ev TEXT; paid BOOLEAN;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.kq_runs WHERE id=p_run AND user_id=p_user AND status::TEXT='completed') THEN RAISE EXCEPTION 'commerce_cycle_invalid'; END IF;
 PERFORM public.rpc_kq_ensure_equipment_profile(p_user);
 SELECT * INTO w FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 INSERT INTO public.kq_commerce_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.kq_commerce_campaigns WHERE run_id=p_run) THEN RETURN; END IF;
 draw:=floor(random()*100);
 ev:=CASE WHEN draw<60 THEN 'normal' WHEN draw<65 THEN 'spot-flower' WHEN draw<70 THEN 'spot-hash' WHEN draw<75 THEN 'spot-rosin' WHEN draw<90 THEN 'promotion' ELSE 'restock' END;
 paid:=a.computer_owned AND a.internet_renew AND w.cash_cents>=1500;
 IF paid THEN UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-1500 WHERE user_id=p_user; END IF;
 INSERT INTO public.kq_commerce_campaigns(run_id,user_id,reputation,clients_start,event,internet_paid,shop_partners_start,shop_recruitment_start,shop_churn_start) VALUES(p_run,p_user,w.reputation,a.clients,ev,paid,a.shop_partners,a.shop_recruitment,a.shop_churn);
 UPDATE public.kq_commerce_accounts SET current_run_id=p_run,revision=revision+1 WHERE user_id=p_user;
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_commerce_state(p_user_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_commerce_accounts%ROWTYPE; w public.kq_equipment_wallets%ROWTYPE; c public.kq_commerce_campaigns%ROWTYPE; latest UUID;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'commerce_user_invalid'; END IF;
 PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 INSERT INTO public.kq_commerce_accounts(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user_id FOR UPDATE;
 IF a.current_run_id IS NULL THEN
  SELECT id INTO latest FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='completed' ORDER BY completed_at DESC NULLS LAST,started_at DESC,id LIMIT 1;
  IF latest IS NOT NULL THEN PERFORM public.kq_commerce_open_cycle(p_user_id,latest); END IF;
 END IF;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user_id;
 SELECT * INTO w FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
 SELECT * INTO c FROM public.kq_commerce_campaigns WHERE run_id=a.current_run_id;
 RETURN jsonb_build_object('revision',a.revision,'cashCents',w.cash_cents,'reputation',w.reputation,'clients',a.clients,
 'shopPartners',a.shop_partners,'shopRecruitment',a.shop_recruitment,'shopChurn',a.shop_churn,'computerOwned',a.computer_owned,'internetRenew',a.internet_renew,
 'campaign',CASE WHEN c.run_id IS NULL THEN NULL ELSE jsonb_build_object('shopPartnersStart',c.shop_partners_start,'shopRecruitmentStart',c.shop_recruitment_start,'shopChurnStart',c.shop_churn_start,'shopGoodUnits',c.shop_good_units,'shopBadUnits',c.shop_bad_units,'id',c.run_id,'revision',c.revision,'reputation',c.reputation,'clientsStart',c.clients_start,'event',c.event,'internetPaid',c.internet_paid,'directUsed',c.direct_used,'shopUsed',c.shop_used,'goodUnits',c.good_units,'disappointmentUnits',c.disappointment_units) END,
 'rawFlowerIds',COALESCE((SELECT jsonb_agg(f.id) FROM public.kq_flowers f WHERE f.owner_id=p_user_id AND f.status::TEXT='burned' AND NOT EXISTS(SELECT 1 FROM public.kq_market_lots l WHERE l.flower_id=f.id AND l.status<>'ready')),'[]'::JSONB),
 'stocks',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'flowerId',s.flower_id,'name',f.variety_name,'route',s.route,'batchRoute',b.route,'juryScore',l.jury_score,
 'initialUnits',s.initial_units,'remainingUnits',s.remaining_units,'equivalentUnits',s.equivalent_units,'originalUnits',b.original_units,'baseUnitCents',s.base_unit_cents,
 'payoutExact',s.payout_exact,'payoutRounded',s.payout_rounded,'repExact',b.rep_exact,'repRounded',b.rep_rounded,'professionalUnits',b.professional_units,'counted',b.counted) ORDER BY b.created_at,s.id)
 FROM public.kq_commerce_stock s JOIN public.kq_commerce_batches b ON b.flower_id=s.flower_id JOIN public.kq_market_lots l ON l.flower_id=s.flower_id JOIN public.kq_flowers f ON f.id=s.flower_id WHERE s.user_id=p_user_id AND s.remaining_units>0),'[]'::JSONB),
 'receipts',COALESCE((SELECT jsonb_agg(r.receipt ORDER BY r.created_at DESC) FROM (SELECT receipt,created_at FROM public.kq_commerce_requests WHERE user_id=p_user_id ORDER BY created_at DESC LIMIT 20) r),'[]'::JSONB),
 'routeSales',COALESCE((SELECT jsonb_object_agg(route,sale_count) FROM public.kq_player_route_masteries WHERE user_id=p_user_id),'{}'::JSONB),
 'marketVolumes',COALESCE((SELECT jsonb_object_agg(route,grams) FROM (SELECT route,SUM(harvest_grams) grams FROM public.kq_market_sale_receipts WHERE created_at>=now()-interval '24 hours' AND route<>'biomass' GROUP BY route) x),'{}'::JSONB),
 'ownVolumes',COALESCE((SELECT jsonb_object_agg(route,grams) FROM (SELECT route,SUM(harvest_grams) grams FROM public.kq_market_sale_receipts WHERE owner_id=p_user_id AND created_at>=now()-interval '24 hours' GROUP BY route) x),'{}'::JSONB));
END $$;


CREATE OR REPLACE FUNCTION public.rpc_kq_commerce_command(p_user_id UUID,p_action TEXT,p_payload JSONB,p_request_key UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_commerce_accounts%ROWTYPE; w public.kq_equipment_wallets%ROWTYPE; c public.kq_commerce_campaigns%ROWTYPE;
 l public.kq_market_lots%ROWTYPE; b public.kq_commerce_batches%ROWTYPE; s public.kq_commerce_stock%ROWTYPE; q public.kq_commerce_quotes%ROWTYPE;
 old public.kq_commerce_requests%ROWTYPE; result JSONB; opt JSONB; offer JSONB; cost INTEGER; units INTEGER; original INTEGER; processed INTEGER;
 remainder INTEGER; product INTEGER; batch_payout BIGINT; batch_rep INTEGER; delta INTEGER; bonus INTEGER:=0; energy INTEGER:=0; payout INTEGER; sale_count_now INTEGER; newly_counted BOOLEAN:=false;
 fid UUID; sid UUID; receipt_id UUID:=gen_random_uuid(); route_code TEXT; channel TEXT; countable NUMERIC; enabled BOOLEAN;
 shop_good NUMERIC; shop_bad NUMERIC; shop_recruit NUMERIC; shop_churn_value NUMERIC; equivalent_qty NUMERIC;
 shop_after INTEGER; shop_price INTEGER;
BEGIN
 IF p_request_key IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'commerce_invalid_request'; END IF;
 PERFORM public.rpc_kq_commerce_state(p_user_id);
 SELECT * INTO w FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO old FROM public.kq_commerce_requests WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF old.action<>p_action OR old.payload<>p_payload THEN RAISE EXCEPTION 'commerce_request_mismatch'; END IF;
  RETURN old.receipt || jsonb_build_object('replayed',true);
 END IF;
 SELECT * INTO c FROM public.kq_commerce_campaigns WHERE run_id=a.current_run_id FOR UPDATE;
 IF p_action='buy-computer' THEN
  IF a.computer_owned THEN RAISE EXCEPTION 'commerce_computer_owned'; END IF;
  IF w.cash_cents<45000 THEN RAISE EXCEPTION 'commerce_cash'; END IF;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-45000 WHERE user_id=p_user_id;
  UPDATE public.kq_commerce_accounts SET computer_owned=true WHERE user_id=p_user_id;
  result:=jsonb_build_object('action',p_action,'paidCents',45000);
 ELSIF p_action='internet' THEN
  IF NOT a.computer_owned THEN RAISE EXCEPTION 'commerce_computer_required'; END IF;
  IF jsonb_typeof(p_payload->'enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'commerce_invalid_request'; END IF;
  enabled:=(p_payload->>'enabled')::BOOLEAN;
  IF enabled AND c.run_id IS NULL THEN RAISE EXCEPTION 'commerce_cycle_required'; END IF;
  cost:=0;
  IF enabled AND NOT c.internet_paid THEN
   IF w.cash_cents<1500 THEN RAISE EXCEPTION 'commerce_cash'; END IF;
   cost:=1500;
   UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-cost WHERE user_id=p_user_id;
   UPDATE public.kq_commerce_campaigns SET internet_paid=true,revision=revision+1 WHERE run_id=c.run_id;
  END IF;
  UPDATE public.kq_commerce_accounts SET internet_renew=enabled WHERE user_id=p_user_id;
  result:=jsonb_build_object('action',p_action,'paidCents',cost,'internetRenew',enabled);
 ELSIF p_action='prepare' THEN
  fid:=(p_payload->>'flowerId')::UUID; route_code:=p_payload->>'route';
  SELECT * INTO l FROM public.kq_market_lots WHERE flower_id=fid AND owner_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR l.status<>'ready' THEN RAISE EXCEPTION 'commerce_lot_unavailable'; END IF;
  SELECT value INTO opt FROM jsonb_array_elements(l.options) WHERE value->>'route'=route_code;
  IF opt IS NULL OR (route_code NOT IN ('raw','biomass') AND NOT COALESCE((opt->>'available')::BOOLEAN,false)) THEN RAISE EXCEPTION 'commerce_route_unavailable'; END IF;
  IF route_code NOT IN ('raw','biomass') AND
   (SELECT COALESCE(array_agg(equipment_code ORDER BY equipment_code),ARRAY[]::TEXT[]) FROM public.kq_equipment_loadouts WHERE user_id=p_user_id)
   IS DISTINCT FROM (SELECT COALESCE(array_agg(code ORDER BY code),ARRAY[]::TEXT[]) FROM unnest(l.equipment_codes) code)
  THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
  IF route_code NOT IN ('raw','biomass') AND (
   COALESCE((opt->'market'->>'reputation')::INTEGER,-1)<>w.reputation
   OR COALESCE((opt->'market'->>'salesCount')::BIGINT,-1)<>(SELECT COALESCE(SUM(sale_count),0) FROM public.kq_player_route_masteries WHERE user_id=p_user_id)
  ) THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
  IF opt->>'productBaseUnitCents' IS NULL THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
  cost:=CASE WHEN route_code IN ('raw','biomass') THEN 0 ELSE (opt->'market'->>'processingCostCents')::INTEGER END;
  IF cost IS NULL OR cost IS DISTINCT FROM (p_payload->>'expectedCostCents')::INTEGER THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
  IF w.cash_cents<cost THEN RAISE EXCEPTION 'commerce_cash'; END IF;
  original:=ROUND(l.harvest_grams*10); processed:=ROUND((opt->>'processedInputGrams')::NUMERIC*10);
  product:=ROUND((opt->>'productGrams')::NUMERIC*10); remainder:=original-processed;
  IF product<=0 OR processed<=0 OR remainder<0 THEN RAISE EXCEPTION 'commerce_invalid_stock'; END IF;
  INSERT INTO public.kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES(fid,p_user_id,route_code,original,cost);
  INSERT INTO public.kq_commerce_stock(flower_id,user_id,route,initial_units,remaining_units,equivalent_units,base_unit_cents)
   VALUES(fid,p_user_id,route_code,product,product,processed,(opt->>'productBaseUnitCents')::NUMERIC) RETURNING id INTO sid;
  IF remainder>0 THEN
   INSERT INTO public.kq_commerce_stock(flower_id,user_id,route,initial_units,remaining_units,equivalent_units,base_unit_cents)
   VALUES(fid,p_user_id,CASE WHEN l.jury_score>=5.8 THEN 'raw' ELSE 'biomass' END,remainder,remainder,remainder,CASE WHEN l.jury_score>=5.8 THEN 180 ELSE 30 END);
  END IF;
  UPDATE public.kq_market_lots SET status='stocked',selected_route=route_code WHERE flower_id=fid;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-cost WHERE user_id=p_user_id;
  result:=jsonb_build_object('action',p_action,'stockId',sid,'flowerId',fid,'paidCents',cost);
 ELSIF p_action='sell' THEN
  SELECT * INTO q FROM public.kq_commerce_quotes WHERE id=(p_payload->>'quoteId')::UUID AND user_id=p_user_id;
  IF NOT FOUND OR q.expires_at<now() OR q.account_revision<>a.revision OR q.campaign_id IS DISTINCT FROM a.current_run_id
   OR q.campaign_revision IS DISTINCT FROM c.revision OR q.reputation<>w.reputation THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
  IF q.energy_outstanding_cents<>(SELECT COALESCE(SUM(remaining_cents),0) FROM public.kq_energy_invoices WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
  SELECT * INTO s FROM public.kq_commerce_stock WHERE id=q.stock_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR s.remaining_units<>q.stock_units THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
  SELECT * INTO b FROM public.kq_commerce_batches WHERE flower_id=s.flower_id FOR UPDATE;
  SELECT * INTO l FROM public.kq_market_lots WHERE flower_id=s.flower_id FOR UPDATE;
  offer:=q.offer; units:=(offer->>'units')::INTEGER; channel:=offer->>'channel'; payout:=(offer->>'payoutCents')::INTEGER;
  IF units IS NULL OR units<=0 OR units>s.remaining_units OR channel IS NULL OR channel NOT IN ('online','cbd-shop','wholesale') OR payout IS NULL OR payout<0 THEN RAISE EXCEPTION 'commerce_invalid_quote'; END IF;
  IF payout IS DISTINCT FROM (p_payload->>'expectedPayoutCents')::INTEGER THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
  IF channel='online' AND (NOT a.computer_owned OR NOT COALESCE(c.internet_paid,false)) THEN RAISE EXCEPTION 'commerce_internet_required'; END IF;
  IF channel<>'wholesale' AND c.run_id IS NULL THEN RAISE EXCEPTION 'commerce_cycle_required'; END IF;
  IF channel='cbd-shop' THEN
   IF s.route='biomass' OR l.jury_score<(CASE WHEN s.route='raw' THEN 6.5 ELSE 7.5 END) THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
   equivalent_qty:=ROUND(units::NUMERIC*s.equivalent_units/s.initial_units,6);
   shop_good:=c.shop_good_units+equivalent_qty*CASE WHEN l.jury_score>=(CASE WHEN s.route='raw' THEN 9 ELSE 9.5 END) THEN 4 WHEN l.jury_score>=(CASE WHEN s.route='raw' THEN 8 ELSE 9 END) THEN 3 ELSE 0 END;
   shop_bad:=c.shop_bad_units+equivalent_qty*CASE WHEN l.jury_score<(CASE WHEN s.route='raw' THEN 7 ELSE 8 END) THEN 6 ELSE 0 END;
   shop_recruit:=c.shop_recruitment_start+LEAST(6000,shop_good);
   shop_churn_value:=c.shop_churn_start+LEAST(GREATEST(1,CEIL(c.shop_partners_start::NUMERIC/4))*6000,shop_bad);
   shop_after:=GREATEST(0,LEAST(20,c.shop_partners_start+FLOOR(shop_recruit/6000)-FLOOR(shop_churn_value/6000)));
   shop_price:=CASE WHEN l.jury_score>=(CASE WHEN s.route='raw' THEN 9 ELSE 9.5 END) THEN 55 WHEN l.jury_score>=(CASE WHEN s.route='raw' THEN 8 ELSE 9 END) THEN 50 WHEN l.jury_score>=(CASE WHEN s.route='raw' THEN 7 ELSE 8 END) THEN 45 ELSE 40 END
    +CASE WHEN c.shop_partners_start>=12 THEN 4 WHEN c.shop_partners_start>=8 THEN 3 WHEN c.shop_partners_start>=4 THEN 2 WHEN c.shop_partners_start>=1 THEN 1 ELSE 0 END;
   IF (offer->>'shopPartnersBefore')::INTEGER IS DISTINCT FROM a.shop_partners
    OR (offer->>'shopPartnersAfter')::INTEGER IS DISTINCT FROM shop_after
    OR (offer->>'shopGoodUnitsAfter')::NUMERIC IS DISTINCT FROM shop_good
    OR (offer->>'shopBadUnitsAfter')::NUMERIC IS DISTINCT FROM shop_bad
    OR (offer->>'shopRecruitmentAfter')::NUMERIC IS DISTINCT FROM MOD(shop_recruit,6000)
    OR (offer->>'shopChurnAfter')::NUMERIC IS DISTINCT FROM MOD(shop_churn_value,6000)
    OR (offer->>'shopPricePercent')::INTEGER IS DISTINCT FROM shop_price THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
   UPDATE public.kq_commerce_accounts SET shop_partners=shop_after,shop_recruitment=MOD(shop_recruit,6000),shop_churn=MOD(shop_churn_value,6000) WHERE user_id=p_user_id;
   UPDATE public.kq_commerce_campaigns SET shop_good_units=shop_good,shop_bad_units=shop_bad WHERE run_id=c.run_id;
  END IF;
  delta:=(offer->>'reputationDelta')::INTEGER;
  countable:=b.professional_units+CASE WHEN channel='wholesale' OR s.route<>b.route THEN 0 ELSE (offer->>'equivalentSold')::NUMERIC END;
  SELECT sale_count INTO sale_count_now FROM public.kq_player_route_masteries WHERE user_id=p_user_id AND route=b.route FOR UPDATE;
  sale_count_now:=COALESCE(sale_count_now,0);
  newly_counted:=NOT b.counted AND s.route=b.route AND countable>=(SELECT SUM(equivalent_units)*.5 FROM public.kq_commerce_stock WHERE flower_id=b.flower_id AND route=b.route) AND public.kq_market_reputation_delta(b.route,l.jury_score)>0;
  IF newly_counted THEN
   sale_count_now:=sale_count_now+1;
   IF b.route NOT IN ('raw','biomass') THEN bonus:=CASE sale_count_now WHEN 3 THEN 5 WHEN 6 THEN 12 WHEN 10 THEN 25 ELSE 0 END; END IF;
  END IF;
  delta:=GREATEST(-w.reputation,delta+bonus);
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+payout,reputation=reputation+delta WHERE user_id=p_user_id RETURNING * INTO w;
  energy:=public.kq_settle_energy(p_user_id,payout/2);
  UPDATE public.kq_commerce_stock SET remaining_units=remaining_units-units,payout_exact=(offer->>'payoutExactAfter')::NUMERIC,payout_rounded=(offer->>'payoutRoundedAfter')::INTEGER WHERE id=s.id;
  UPDATE public.kq_commerce_batches SET rep_exact=(offer->>'repExactAfter')::NUMERIC,rep_rounded=(offer->>'repRoundedAfter')::INTEGER,
   professional_units=countable,counted=counted OR newly_counted WHERE flower_id=b.flower_id;
  IF c.run_id IS NOT NULL THEN
   UPDATE public.kq_commerce_campaigns SET direct_used=direct_used+(offer->>'directCost')::NUMERIC,
    shop_used=shop_used+(offer->>'shopCost')::NUMERIC,good_units=(offer->>'goodUnitsAfter')::NUMERIC,
    disappointment_units=(offer->>'disappointmentAfter')::NUMERIC,revision=revision+1 WHERE run_id=c.run_id;
  END IF;
  UPDATE public.kq_commerce_accounts SET clients=(offer->>'clientsAfter')::INTEGER WHERE user_id=p_user_id;
  INSERT INTO public.kq_market_sale_receipts(id,request_key,flower_id,owner_id,route,jury_score,harvest_grams,payout_cents,reputation_gain,cash_after_cents,reputation_after,
   route_sale_count,expertise_bonus_reputation,electricity_paid_cents,sales_channel,first_route_mastery,matched_route_plan)
   VALUES(receipt_id,p_request_key,s.flower_id,p_user_id,s.route,l.jury_score,(offer->>'equivalentSold')::NUMERIC/10,payout,delta,w.cash_cents-energy,w.reputation,sale_count_now,bonus,energy,channel,newly_counted AND sale_count_now=1,newly_counted AND COALESCE(w.planned_route_code=b.route,false));
  IF newly_counted AND w.planned_route_code=b.route THEN
   UPDATE public.kq_equipment_wallets SET planned_route_code=NULL,planned_equipment_code=NULL WHERE user_id=p_user_id;
  END IF;
  IF newly_counted THEN
   SELECT SUM(payout_cents),SUM(reputation_gain) INTO batch_payout,batch_rep FROM public.kq_market_sale_receipts WHERE flower_id=s.flower_id;
   INSERT INTO public.kq_player_route_masteries(user_id,route,first_sale_receipt_id,last_sale_receipt_id,first_jury_score,best_jury_score,sale_count,total_payout_cents,total_reputation)
    VALUES(p_user_id,b.route,receipt_id,receipt_id,l.jury_score,l.jury_score,1,batch_payout,batch_rep)
    ON CONFLICT(user_id,route) DO UPDATE SET sale_count=public.kq_player_route_masteries.sale_count+1,last_sale_receipt_id=receipt_id,
     best_jury_score=GREATEST(public.kq_player_route_masteries.best_jury_score,l.jury_score),total_payout_cents=public.kq_player_route_masteries.total_payout_cents+batch_payout,
     total_reputation=public.kq_player_route_masteries.total_reputation+batch_rep,updated_at=now();
  ELSIF b.counted THEN
   UPDATE public.kq_player_route_masteries SET last_sale_receipt_id=receipt_id,total_payout_cents=total_payout_cents+payout,total_reputation=total_reputation+delta,updated_at=now() WHERE user_id=p_user_id AND route=b.route;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.kq_commerce_stock WHERE flower_id=s.flower_id AND remaining_units>0) THEN
   UPDATE public.kq_market_lots SET status='sold',payout_cents=(SELECT SUM(payout_cents) FROM public.kq_market_sale_receipts WHERE flower_id=s.flower_id),
    reputation_gain=(SELECT SUM(reputation_gain) FROM public.kq_market_sale_receipts WHERE flower_id=s.flower_id),settled_at=now() WHERE flower_id=s.flower_id;
  END IF;
  result:=jsonb_build_object('action',p_action,'stockId',s.id,'flowerId',s.flower_id,'channel',channel,'units',units,'payoutCents',payout,
   'shopPartnersBefore',a.shop_partners,'shopPartnersAfter',COALESCE(shop_after,a.shop_partners),'shopPartnersDelta',COALESCE(shop_after,a.shop_partners)-a.shop_partners,'shopPricePercent',shop_price,'satisfaction',offer->>'satisfaction','clientsBefore',a.clients,'electricityPaidCents',energy,'netPayoutCents',payout-energy,'reputationGain',delta,'expertiseBonus',bonus,'clientsAfter',(offer->>'clientsAfter')::INTEGER,'remainingUnits',s.remaining_units-units);
 ELSE RAISE EXCEPTION 'commerce_invalid_action'; END IF;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 SELECT * INTO w FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
 result:=result||jsonb_build_object('cashAfterCents',w.cash_cents,'replayed',false);
 INSERT INTO public.kq_commerce_requests(user_id,request_key,action,payload,receipt) VALUES(p_user_id,p_request_key,p_action,p_payload,result);
 RETURN result;
END $$;

COMMIT;
