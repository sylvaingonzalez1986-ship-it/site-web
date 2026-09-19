-- Run in a transaction, after all chanvrier migrations. Always roll back fixtures.
DO $$
DECLARE treasury UUID:=gen_random_uuid(); grower UUID:=gen_random_uuid(); handy UUID:=gen_random_uuid(); merchant UUID:=gen_random_uuid();
 buddy UUID; run UUID; flower UUID; entitlement UUID; key UUID:=gen_random_uuid(); value JSONB; cash INTEGER; price INTEGER; cost INTEGER;
 scenario TEXT[]:=ARRAY['SIT-001','SIT-002','SIT-003','SIT-004','SIT-005','SIT-006'];
 initial JSONB:='{"xp":7,"deckCodes":[],"usedCards":[],"playedThisStage":[],"equipment":{"codes":["PRESS-0600"]}}';
BEGIN
 INSERT INTO auth.users(id,email) SELECT id,'chanvrier-test-'||id||'@example.invalid' FROM unnest(ARRAY[treasury,grower,handy,merchant]) id;
 value:=public.rpc_arena_save_chanvrier(treasury,jsonb_build_object('nickname','T-'||left(treasury::TEXT,12),'gender','male','clothing','teal','skin','peach','strength','treasurer'));
 ASSERT (value->>'startingBonusCents')::INTEGER=65000, 'first treasury bonus';
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=treasury;
 ASSERT cash=100000, '1000 euro starting capital';
 value:=public.rpc_arena_save_chanvrier(treasury,value->'profile'||'{"clothing":"blue"}'::JSONB);
 ASSERT (value->>'startingBonusCents')::INTEGER=0, 'bonus must not replay';
 ASSERT (SELECT cash_cents=100000 FROM public.kq_equipment_wallets WHERE user_id=treasury), 'no repeated credit';
 BEGIN
  PERFORM public.rpc_arena_save_chanvrier(treasury,value->'profile'||'{"strength":"green-thumb"}'::JSONB);
  RAISE EXCEPTION 'expected locked specialty';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'chanvrier_strength_locked' THEN RAISE; END IF; END;
 PERFORM public.rpc_arena_save_chanvrier(grower,jsonb_build_object('nickname','G-'||left(grower::TEXT,12),'gender','female','clothing','berry','skin','brown','strength','green-thumb'));
 PERFORM public.rpc_arena_save_chanvrier(handy,jsonb_build_object('nickname','H-'||left(handy::TEXT,12),'gender','male','clothing','ochre','skin','ivory','strength','handyperson'));
 PERFORM public.rpc_arena_save_chanvrier(merchant,jsonb_build_object('nickname','M-'||left(merchant::TEXT,12),'gender','female','clothing','sage','skin','ebony','strength','merchant'));
 ASSERT public.rpc_kq_commerce_state(merchant)->>'strength'='merchant', 'commerce reads authoritative specialty';
 UPDATE public.contest_profiles SET pseudo='Renamed-'||left(grower::TEXT,10) WHERE customer_id=grower;
 ASSERT (SELECT nickname='Renamed-'||left(grower::TEXT,10) FROM public.arena_chanvrier_profiles WHERE user_id=grower), 'nickname synchronization';
 SELECT id INTO buddy FROM public.lottery_card_definitions WHERE code='HH2026-001';
 ASSERT buddy IS NOT NULL, 'legendary Buddie fixture';
 INSERT INTO public.kq_support_booster_entitlements(user_id,source,reward_key) VALUES(grower,'arena_streak','chanvrier-test:'||grower) RETURNING id INTO entitlement;
 INSERT INTO public.lottery_card_instances(user_id,card_definition_id,pack_slot,kq_support_entitlement_id) VALUES(grower,buddy,1,entitlement);
 SELECT price_cents INTO price FROM public.kq_equipment_catalog WHERE code='PRESS-0600';
 cost:=LEAST(20000,GREATEST(1000,CEIL(price*.06)));
 INSERT INTO public.kq_player_equipment(user_id,equipment_code,purchase_price_cents,wear_cycles) VALUES(grower,'PRESS-0600',price,9),(handy,'PRESS-0600',price,10);
 INSERT INTO public.kq_equipment_loadouts(user_id,slot,equipment_code) VALUES(grower,'press','PRESS-0600');
 BEGIN
  PERFORM public.rpc_kq_start_run_with_heritage(grower,'HH2026-001',123,ARRAY[]::TEXT[],scenario,jsonb_set(initial,'{xp}','10'),0,NULL);
  RAISE EXCEPTION 'expected forged XP rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'kq_heritage_state_mismatch' THEN RAISE; END IF; END;
 value:=public.rpc_kq_start_run_with_heritage(grower,'HH2026-001',123,ARRAY[]::TEXT[],scenario,initial,0,NULL);
 run:=(value->'run'->>'id')::UUID;
 ASSERT (value->'run'->'state'->>'xp')::INTEGER=7, 'base 1 + legendary 4 + Main Verte 2';
 UPDATE public.kq_runs SET status='completed',completed_at=now() WHERE id=run;
 ASSERT (SELECT wear_cycles=10 AND maintenance_version=1 FROM public.kq_player_equipment WHERE user_id=grower AND equipment_code='PRESS-0600'), 'completion wears snapshotted machine once';
 UPDATE public.kq_runs SET status='completed' WHERE id=run;
 ASSERT (SELECT maintenance_version=1 FROM public.kq_player_equipment WHERE user_id=grower AND equipment_code='PRESS-0600'), 'replayed completion has no wear';
 INSERT INTO public.kq_flowers(run_id,owner_id,variety_code,variety_name,quality,status,locked_at,burned_at)
 VALUES(run,grower,'HH2026-001','Fixture',9,'burned',now(),now()) RETURNING id INTO flower;
 INSERT INTO public.kq_market_lots(flower_id,owner_id,harvest_grams,jury_score,quality_band,equipment_codes,options)
 VALUES(flower,grower,100,9,'signature',ARRAY['PRESS-0600'],'[]');
 BEGIN
  INSERT INTO public.kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES(flower,grower,'rosin-trial',1000,0);
  RAISE EXCEPTION 'expected worn machine rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'commerce_machine_maintenance' THEN RAISE; END IF; END;
 BEGIN
  INSERT INTO public.kq_market_sale_receipts(request_key,flower_id,owner_id,route,jury_score,harvest_grams,payout_cents,reputation_gain,cash_after_cents,reputation_after)
  VALUES(gen_random_uuid(),flower,grower,'rosin-trial',9,100,100,0,35100,0);
  RAISE EXCEPTION 'expected legacy transformation rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'commerce_machine_maintenance' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.rpc_kq_repair_machine(treasury,'PRESS-0600',1,cost,gen_random_uuid());
  RAISE EXCEPTION 'expected equipment ownership rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'machine_not_owned' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.rpc_kq_repair_machine(grower,'PRESS-0600',0,cost,key);
  RAISE EXCEPTION 'expected outdated repair rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'machine_condition_changed' THEN RAISE; END IF; END;
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=grower;
 value:=public.rpc_kq_repair_machine(grower,'PRESS-0600',1,cost,key);
 ASSERT (value->>'paidCents')::INTEGER=cost, 'paid repair';
 value:=public.rpc_kq_repair_machine(grower,'PRESS-0600',1,cost,key);
 ASSERT (value->>'replayed')::BOOLEAN, 'repair request idempotency';
 ASSERT (SELECT cash_cents=cash-cost FROM public.kq_equipment_wallets WHERE user_id=grower), 'single debit';
 INSERT INTO public.kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES(flower,grower,'rosin-trial',1000,0);
 value:=public.rpc_kq_repair_machine(handy,'PRESS-0600',0,0,gen_random_uuid());
 ASSERT (value->>'paidCents')::INTEGER=0, 'handyperson free repair';
 ASSERT (SELECT wear_cycles=0 FROM public.kq_player_equipment WHERE user_id=handy AND equipment_code='PRESS-0600'), 'free repair restores machine';
 ASSERT NOT has_function_privilege('authenticated','public.rpc_arena_save_chanvrier(uuid,jsonb)','EXECUTE'), 'profile RPC service only';
 ASSERT NOT has_function_privilege('authenticated','public.rpc_kq_repair_machine(uuid,text,integer,integer,uuid)','EXECUTE'), 'repair RPC service only';
 ASSERT NOT has_table_privilege('authenticated','public.arena_chanvrier_profiles','UPDATE'), 'no direct bonus changes';
END $$;
SELECT 'Profiles, XP, maintenance and permissions: PASS (fixtures rolled back)' AS result;
