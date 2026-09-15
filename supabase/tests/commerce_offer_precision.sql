-- Transactional regression: synthetic player only; always rolls back.
BEGIN;
SET LOCAL lock_timeout='4s'; SET LOCAL statement_timeout='25s';
CREATE TEMP TABLE precision_fixture(quote_id UUID,user_id UUID,stock_id UUID,stock_units INTEGER,offer JSONB,payload JSONB,request_key UUID);
DO $$
DECLARE player UUID:=gen_random_uuid(); run UUID; flower UUID; stock UUID; quote UUID:=gen_random_uuid(); offer JSONB;
BEGIN
 INSERT INTO auth.users(id,email) VALUES(player,'commerce-precision-'||player||'@example.invalid');
 PERFORM public.rpc_kq_ensure_equipment_profile(player);
 INSERT INTO public.kq_runs(user_id,buddie_card_definition_id,seed,deck_codes,scenario_codes,status,completed_at)
 SELECT player,id,123,ARRAY[]::TEXT[],ARRAY['SIT-001','SIT-002','SIT-003','SIT-004','SIT-005','SIT-006'],'completed',now()
 FROM public.lottery_card_definitions WHERE code='HH2026-001' RETURNING id INTO run;
 PERFORM public.rpc_kq_commerce_state(player);
 UPDATE public.kq_commerce_accounts SET shop_recruitment=1000.1 WHERE user_id=player;
 UPDATE public.kq_commerce_campaigns SET shop_recruitment_start=1000.1,event='normal' WHERE run_id=run;
 INSERT INTO public.kq_flowers(run_id,owner_id,variety_code,variety_name,quality,status,locked_at,burned_at)
 VALUES(run,player,'HH2026-001','Precision fixture',9,'burned',now(),now()) RETURNING id INTO flower;
 INSERT INTO public.kq_market_lots(flower_id,owner_id,harvest_grams,jury_score,quality_band,equipment_codes,options,status,selected_route)
 VALUES(flower,player,400,9,'signature',ARRAY[]::TEXT[],'[]','stocked','raw');
 INSERT INTO public.kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES(flower,player,'raw',4000,0);
 INSERT INTO public.kq_commerce_stock(flower_id,user_id,route,initial_units,remaining_units,equivalent_units,base_unit_cents)
 VALUES(flower,player,'raw',4000,4000,4000,180) RETURNING id INTO stock;
 offer:='{"channel":"cbd-shop","policy":"advised","units":1500,"payoutCents":14850,"equivalentSold":1500,"reputationDelta":0,"payoutExactAfter":14850,"payoutRoundedAfter":14850,"repExactAfter":0,"repRoundedAfter":0,"directCost":0,"shopCost":1500,"goodUnitsAfter":0,"disappointmentAfter":0,"clientsAfter":0,"shopPartnersBefore":0,"shopPartnersAfter":1,"shopGoodUnitsAfter":6000,"shopBadUnitsAfter":0,"shopRecruitmentAfter":1000.1000000000004,"shopChurnAfter":0,"shopPricePercent":55,"satisfaction":"satisfied"}';
 INSERT INTO public.kq_commerce_quotes(id,user_id,stock_id,account_revision,campaign_id,campaign_revision,stock_units,reputation,offer,expires_at)
 SELECT quote,player,stock,a.revision,run,c.revision,4000,w.reputation,offer,now()+interval '5 minutes'
 FROM public.kq_commerce_accounts a JOIN public.kq_equipment_wallets w ON w.user_id=a.user_id JOIN public.kq_commerce_campaigns c ON c.run_id=run WHERE a.user_id=player;
 INSERT INTO precision_fixture VALUES(quote,player,stock,4000,offer,jsonb_build_object('quoteId',quote,'expectedPayoutCents',14850),gen_random_uuid());
END $$;
DO $$ DECLARE f RECORD; result JSONB; BEGIN
 SELECT * INTO f FROM precision_fixture;
 -- A meaningful mismatch still fails: only sub-millionth representation noise is normalized.
 BEGIN
  UPDATE public.kq_commerce_quotes SET offer=jsonb_set(offer,'{shopRecruitmentAfter}',to_jsonb(ROUND((offer->>'shopRecruitmentAfter')::NUMERIC,6)+.000001)) WHERE id=f.quote_id;
  PERFORM public.rpc_kq_commerce_command(f.user_id,'sell',f.payload,f.request_key);
  RAISE EXCEPTION 'expected modified progress rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'commerce_offer_changed' THEN RAISE; END IF; END;
 result:=public.rpc_kq_commerce_command(f.user_id,'sell',f.payload,f.request_key);
 ASSERT result->>'action'='sell','fixed offer completes';
 ASSERT (result->>'payoutCents')::INTEGER=(f.offer->>'payoutCents')::INTEGER,'original price preserved';
 ASSERT (SELECT remaining_units=f.stock_units-(f.offer->>'units')::INTEGER FROM public.kq_commerce_stock WHERE id=f.stock_id),'one stock deduction';
 result:=public.rpc_kq_commerce_command(f.user_id,'sell',f.payload,f.request_key);
 ASSERT (result->>'replayed')::BOOLEAN,'sale remains idempotent';
 ASSERT (SELECT remaining_units=f.stock_units-(f.offer->>'units')::INTEGER FROM public.kq_commerce_stock WHERE id=f.stock_id),'no duplicate stock deduction';
END $$;
SELECT 'PASS: fixed sale accepted at original price, altered progress rejected, retry idempotent; all test transactions rolled back' AS result;
ROLLBACK;
