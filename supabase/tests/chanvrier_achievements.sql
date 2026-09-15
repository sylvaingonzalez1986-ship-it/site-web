-- Synthetic accounts only. Run standalone after migration, or inside its rollback rehearsal.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='40s';
DO $$
DECLARE player UUID:=gen_random_uuid(); opponent UUID:=gen_random_uuid(); run_id UUID; m JSONB; state JSONB;
  r public.kq_runs; b public.kq_battles; s public.kq_market_sale_receipts; n INTEGER; flower UUID:=gen_random_uuid(); snapshot JSONB;
BEGIN
  INSERT INTO auth.users(id,email) VALUES(player,'palmares-'||player||'@example.invalid'),(opponent,'palmares-'||opponent||'@example.invalid');
  state:=jsonb_build_object('pressure',0,'combos','[]'::JSONB,'history',(SELECT jsonb_agg(jsonb_build_object('stage',stage_n,'dice','[4,5,4]'::JSONB,'outcome','critical')) FROM generate_series(1,6) stage_n));
  INSERT INTO public.kq_runs(user_id,buddie_card_definition_id,seed,deck_codes,scenario_codes,state,status)
  SELECT player,id,123,ARRAY[]::TEXT[],ARRAY['SIT-001','SIT-002','SIT-003','SIT-004','SIT-005','SIT-006'],state,'active'
  FROM public.lottery_card_definitions WHERE code='HH2026-001' RETURNING id INTO run_id;
  ASSERT run_id IS NOT NULL,'fixture card available';
  ASSERT NOT EXISTS(SELECT 1 FROM public.chanvrier_progress WHERE user_id=player),'active cultures do not count';
  UPDATE public.kq_runs SET status='completed',completed_at=now() WHERE id=run_id RETURNING * INTO r;
  SELECT metrics INTO m FROM public.chanvrier_progress WHERE user_id=player;
  ASSERT (m->>'cultures')::INTEGER=1,'completed trigger';
  ASSERT (m->>'triple-spark')::INTEGER=0,'critical 4/5/4 is not a triple six';
  ASSERT (m->>'spark-collector')::INTEGER=0,'only final sixes count';
  PERFORM public.kq_progress_run(r);
  ASSERT (SELECT (metrics->>'cultures')::INTEGER=1 FROM public.chanvrier_progress WHERE user_id=player),'run replay idempotent';
  r.state:=jsonb_set(jsonb_set(state,'{history,0,dice}','[6,6,6]'),'{combos}','["PBI ciblée"]');
  r.status:='abandoned';r.id:=gen_random_uuid();
  PERFORM public.kq_progress_run(r);
  ASSERT (SELECT (metrics->>'cultures')::INTEGER=1 FROM public.chanvrier_progress WHERE user_id=player),'abandoned triple six excluded';
  r.status:='completed';
  FOR n IN 1..9 LOOP r.id:=gen_random_uuid(); PERFORM public.kq_progress_run(r); END LOOP;
  SELECT metrics INTO m FROM public.chanvrier_progress WHERE user_id=player;
  ASSERT (m->>'triple-spark')::INTEGER=9 AND (m->>'spark-collector')::INTEGER=27,'final dice aggregates';
  ASSERT (m->>'natural-defense')::INTEGER=9,'real PBI combo';
  ASSERT (SELECT count(*)=1 FROM public.kq_support_booster_entitlements WHERE user_id=player AND source='achievement'),'five families, exactly one pack';
  ASSERT NOT EXISTS(SELECT 1 FROM public.contest_profile_badges WHERE customer_id=player AND reward_pack_count<>0),'no duplicate Carnet packs';
  PERFORM public.kq_progress_jury(player,flower,'[{"playerScore":89},{"playerScore":89},{"playerScore":89}]','playerScore',now());
  ASSERT NOT EXISTS(SELECT 1 FROM public.contest_profile_badges WHERE customer_id=player AND badge_id='kq-ach-jury-favorite-1'),'8.9 is below threshold';
  PERFORM public.kq_progress_jury(player,flower,'[{"playerScore":90},{"playerScore":90},{"playerScore":90}]','playerScore',now());
  PERFORM public.kq_progress_jury(player,flower,'[{"playerScore":95},{"playerScore":95},{"playerScore":95}]','playerScore',now());
  ASSERT (SELECT (metrics->>'jury-favorite')::INTEGER=1 AND (metrics->>'bestJury')::NUMERIC=9.5 FROM public.chanvrier_progress WHERE user_id=player),'distinct flower and best jury';
  ASSERT NOT EXISTS(SELECT 1 FROM public.contest_profile_badges WHERE customer_id=player AND badge_id='kq-ach-perfect-victory-1'),'jury including bots does not award PVP wins';
  s.owner_id:=player;s.harvest_grams:=100;s.payout_cents:=100;s.created_at:=now();
  s.route:='raw';PERFORM public.kq_progress_sale(s);s.route:='biomass';PERFORM public.kq_progress_sale(s);
  s.route:='dry-sift';PERFORM public.kq_progress_sale(s);PERFORM public.kq_progress_sale(s);
  s.route:='static-sift';PERFORM public.kq_progress_sale(s);s.route:='ice-water-hash';PERFORM public.kq_progress_sale(s);
  ASSERT (SELECT (metrics->>'versatile-artisan')::INTEGER=3 FROM public.chanvrier_progress WHERE user_id=player),'three distinct processing routes, partial sales deduplicated';
  b.id:=gen_random_uuid();b.status:='verdict';b.player_one_id:=opponent;b.player_two_id:=player;b.flower_one_id:=gen_random_uuid();b.flower_two_id:=flower;b.winner_id:=player;b.verdict_at:=now();
  b.rounds:='[{"winner":"opponent","playerScore":50,"opponentScore":95},{"winner":"opponent","playerScore":50,"opponentScore":95},{"winner":"opponent","playerScore":50,"opponentScore":95}]';
  PERFORM public.kq_progress_battle(b);PERFORM public.kq_progress_battle(b);
  ASSERT (SELECT (metrics->>'wins')::INTEGER=1 AND (metrics->>'perfect-victory')::INTEGER=1 FROM public.chanvrier_progress WHERE user_id=player),'second participant perfect victory and replay';
  ASSERT (SELECT (metrics->>'losses')::INTEGER=1 AND (metrics->>'perfect-victory')::INTEGER=0 FROM public.chanvrier_progress WHERE user_id=opponent),'loser has no perfect victory';
  ASSERT (SELECT count(*)=2 AND sum(card_count)=20 FROM public.kq_support_booster_entitlements WHERE user_id=player AND source='achievement'),'eight families, bounded two packs';
  BEGIN
    PERFORM public.rpc_chanvrier_showcase(player,'{"badges":["kq-ach-perfect-victory-3"],"title":null,"tracked":null}');
    RAISE EXCEPTION 'expected ownership rejection';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'showcase_not_owned' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.rpc_chanvrier_showcase(player,'{"badges":[],"title":"perfect-victory","tracked":null}');
    RAISE EXCEPTION 'expected title rejection';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'showcase_not_owned' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.rpc_chanvrier_showcase(player,'{"badges":["a","b","c","d"],"title":null,"tracked":null}');
    RAISE EXCEPTION 'expected max 3 rejection';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'showcase_invalid' THEN RAISE; END IF; END;
  PERFORM public.rpc_chanvrier_showcase(player,'{"badges":["kq-ach-triple-spark-1"],"title":null,"tracked":"perfect-victory"}',0);
  snapshot:=public.rpc_chanvrier_progress(player);
  ASSERT snapshot->'showcase'->'badges'='["kq-ach-triple-spark-1"]','pinned owned badge';
  ASSERT (snapshot->>'unlockedFamilies')::INTEGER=8,'snapshot families';
  ASSERT (snapshot->>'newBadgeCount')::INTEGER>0,'unseen awards';
  PERFORM public.rpc_chanvrier_showcase(player,NULL,(snapshot->>'badgeCount')::INTEGER);
  ASSERT (public.rpc_chanvrier_progress(player)->>'newBadgeCount')::INTEGER=0,'acknowledged awards';
  ASSERT NOT has_function_privilege('authenticated','public.kq_apply_progress(uuid,text,jsonb,timestamptz,numeric)','EXECUTE'),'clients cannot fabricate progress';
  ASSERT NOT has_function_privilege('authenticated','public.rpc_chanvrier_progress(uuid)','EXECUTE'),'private read only through authenticated API';
END;
$$;
SELECT 'PASS: completed trigger, final dice, abandonment, replay, PBI, jury, distinct routes, PVP orientation, bounded packs, ownership and access' AS result;
ROLLBACK;
