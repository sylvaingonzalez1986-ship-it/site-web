-- Synthetic accounts only. All writes are rolled back, including the migration in rehearsal.
BEGIN;
SET LOCAL lock_timeout='4s'; SET LOCAL statement_timeout='25s';
DO $$
DECLARE player UUID:=gen_random_uuid(); first_run UUID; next_run UUID; before_debt NUMERIC; snapshot JSONB; capacity JSONB;
BEGIN
 INSERT INTO auth.users(id,email) VALUES(player,'commerce-time-'||player||'@example.invalid');
 PERFORM public.rpc_kq_ensure_equipment_profile(player);
 UPDATE public.kq_equipment_wallets SET reputation=312 WHERE user_id=player;
 INSERT INTO public.kq_runs(user_id,buddie_card_definition_id,seed,deck_codes,scenario_codes,status,completed_at)
 SELECT player,id,123,ARRAY[]::TEXT[],ARRAY['SIT-001','SIT-002','SIT-003','SIT-004','SIT-005','SIT-006'],'completed',now()
 FROM public.lottery_card_definitions WHERE code='HH2026-001' RETURNING id INTO first_run;
 snapshot:=public.rpc_kq_commerce_state(player);
 ASSERT snapshot->'demand'->>'serverNow' IS NOT NULL,'snapshot includes authoritative server time';
 UPDATE public.kq_commerce_campaigns SET event='normal' WHERE run_id=first_run;
 capacity:=public.kq_commerce_capacity(player);
 ASSERT (capacity->>'online')::NUMERIC=900 AND (capacity->>'cbd-shop')::NUMERIC=4000,'312 rep: 90g online and 400g shops';
 PERFORM public.kq_commerce_consume_demand(player,'{"channel":"online","directCost":900,"shopCost":0}');
 ASSERT (SELECT online_demand_debt=1 AND shop_demand_debt=0 FROM public.kq_commerce_accounts WHERE user_id=player),'separate channels';
 BEGIN
  PERFORM public.kq_commerce_consume_demand(player,'{"channel":"online","directCost":1,"shopCost":0}');
  RAISE EXCEPTION 'overspend accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'commerce_demand_exhausted' THEN RAISE; END IF; END;
 UPDATE public.kq_commerce_accounts SET demand_updated_at=now()-interval '1 hour' WHERE user_id=player;
 PERFORM public.kq_commerce_consume_demand(player,'{"channel":"online","directCost":225,"shopCost":0}');
 ASSERT (SELECT online_demand_debt=1 FROM public.kq_commerce_accounts WHERE user_id=player),'one hour restores exactly 22.5g';
 PERFORM public.kq_commerce_consume_demand(player,'{"channel":"cbd-shop","directCost":0,"shopCost":4000}');
 UPDATE public.kq_commerce_accounts SET demand_updated_at=now()-interval '6 hours' WHERE user_id=player;
 PERFORM public.kq_commerce_consume_demand(player,'{"channel":"cbd-shop","directCost":0,"shopCost":2000}');
 ASSERT (SELECT shop_demand_debt=1 AND online_demand_debt=0 FROM public.kq_commerce_accounts WHERE user_id=player),'half a day for shops, independently full online';
 -- Starting a different culture carries recruitment counters; it cannot reroll the event.
 UPDATE public.kq_commerce_accounts SET clients=5,shop_partners=1 WHERE user_id=player;
 UPDATE public.kq_commerce_campaigns SET good_units=900,shop_good_units=6000 WHERE run_id=first_run;
 INSERT INTO public.kq_runs(user_id,buddie_card_definition_id,seed,deck_codes,scenario_codes,status,completed_at)
 SELECT player,id,124,ARRAY[]::TEXT[],ARRAY['SIT-001','SIT-002','SIT-003','SIT-004','SIT-005','SIT-006'],'completed',now()
 FROM public.lottery_card_definitions WHERE code='HH2026-001' RETURNING id INTO next_run;
 PERFORM public.kq_commerce_open_cycle(player,next_run);
 ASSERT (SELECT good_units=900 AND shop_good_units=6000 AND clients_start=0 AND shop_partners_start=0 AND event='normal' FROM public.kq_commerce_campaigns WHERE run_id=next_run),'culture cannot reset growth or prices';
 ASSERT (SELECT shop_demand_debt=1 FROM public.kq_commerce_accounts WHERE user_id=player),'culture cannot restore buying demand';
 -- Twenty-four hours advances growth once, but never resets purchasing balances.
 UPDATE public.kq_commerce_campaigns SET growth_started_at=now()-interval '25 hours' WHERE run_id=next_run;
 snapshot:=public.rpc_kq_commerce_state(player);
 ASSERT (snapshot->'campaign'->>'goodUnits')::NUMERIC=0 AND (snapshot->'campaign'->>'clientsStart')::INTEGER=5,'new growth period uses current clients';
 ASSERT (snapshot->'campaign'->>'shopPartnersStart')::INTEGER=1,'new period uses earned shops';
 ASSERT (snapshot->'demand'->>'shopDebt')::NUMERIC=1,'growth reset does not grant demand';
 ASSERT (snapshot->'demand'->>'growthResetsAt')::TIMESTAMPTZ=now()+interval '24 hours','offline periods do not accumulate';
 -- Huge offline intervals still grant at most one full balance.
 UPDATE public.kq_commerce_accounts SET demand_updated_at=now()-interval '30 days' WHERE user_id=player;
 capacity:=public.kq_commerce_capacity(player);
 PERFORM public.kq_commerce_consume_demand(player,jsonb_build_object('channel','cbd-shop','directCost',0,'shopCost',(capacity->>'cbd-shop')::NUMERIC));
 ASSERT (SELECT shop_demand_debt=1 FROM public.kq_commerce_accounts WHERE user_id=player),'offline accumulation capped';
 -- A transaction started earlier than the last debit must never move its clock backwards.
 UPDATE public.kq_commerce_accounts SET online_demand_debt=0,demand_updated_at=now()+interval '1 minute' WHERE user_id=player;
 PERFORM public.kq_commerce_consume_demand(player,'{"channel":"online","directCost":1,"shopCost":0}');
 ASSERT (SELECT demand_updated_at=now()+interval '1 minute' FROM public.kq_commerce_accounts WHERE user_id=player),'monotonic timestamp under lock contention';
 -- Wholesale consumes no demand and works even while both circuits are empty.
 SELECT shop_demand_debt INTO before_debt FROM public.kq_commerce_accounts WHERE user_id=player;
 PERFORM public.kq_commerce_consume_demand(player,'{"channel":"wholesale","directCost":0,"shopCost":0}');
 ASSERT (SELECT shop_demand_debt=before_debt FROM public.kq_commerce_accounts WHERE user_id=player),'wholesale always available';
 BEGIN
  PERFORM public.kq_commerce_consume_demand(player,'{"channel":"online","directCost":-1,"shopCost":0}');
  RAISE EXCEPTION 'negative cost accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'commerce_invalid_quote' THEN RAISE; END IF; END;
 ASSERT NOT has_function_privilege('authenticated','public.kq_commerce_consume_demand(uuid,jsonb)','EXECUTE'),'clients cannot set their clock or balance';
END $$;
SELECT 'PASS: real-time budgets, offline caps, independent channels, culture carry, 24h growth and private writes' AS result;
ROLLBACK;
