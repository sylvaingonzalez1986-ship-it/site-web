BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- The funding formula and the ranking formula are independent versions.
-- Frozen and settled seasons retain their original eligibility and awards.
ALTER TABLE public.arena_customer_reward_seasons
 ADD COLUMN ranking_formula_version TEXT NOT NULL DEFAULT 'arena-v2-development';
UPDATE public.arena_customer_reward_seasons SET ranking_formula_version='arena-v3-tasting-first'
 WHERE status IN ('planned','active');
ALTER TABLE public.arena_customer_reward_seasons
 ALTER COLUMN ranking_formula_version SET DEFAULT 'arena-v3-tasting-first';
ALTER TABLE public.arena_customer_reward_grants
 ALTER COLUMN score_snapshot TYPE NUMERIC,
 ALTER COLUMN share_bps TYPE NUMERIC(18,8),
 DROP CONSTRAINT arena_customer_reward_grants_share_bps_check,
 ADD CONSTRAINT arena_customer_reward_grants_share_bps_check CHECK(share_bps BETWEEN 0 AND 10000);

CREATE FUNCTION public.kq_arena_reward_current_standings(p_season_code TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE snapshot public.kq_arena_leaderboard_snapshots%ROWTYPE; result JSONB;
BEGIN
 snapshot:=public.rpc_kq_get_arena_leaderboard(p_season_code,false);
 IF snapshot.formula_version<>'arena-v3-tasting-first' THEN RAISE EXCEPTION 'arena_reward_ranking_version_mismatch'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'playerId',entry->'userId','leaderboardRank',entry->'rank','pseudo',entry->'pseudo',
  'score',entry->'score','rating',entry->'rating','wins',entry->'wins','losses',entry->'losses',
  'tastedFlowerCount',COALESCE(entry->'tastedFlowerCount','0'::JSONB),
  'rankingFormulaVersion',snapshot.formula_version) ORDER BY ord),'[]'::JSONB)
 INTO result FROM jsonb_array_elements(snapshot.leaderboard) WITH ORDINALITY entries(entry,ord);
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.kq_arena_reward_current_standings(TEXT) FROM PUBLIC,anon,authenticated,service_role;

-- One authoritative projection for verification, using the same integer-gram
-- largest remainders and lexical identity order as the visible preview.
CREATE FUNCTION public.kq_arena_reward_plan_v3(p_standings JSONB,p_pool_grams NUMERIC,p_min_battles INTEGER)
RETURNS JSONB LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 WITH pool AS (SELECT FLOOR(GREATEST(0,p_pool_grams)) AS grams),
 weights(slot,bps) AS (VALUES (1,2700),(2,1800),(3,1350),(4,675),(5,675),
  (6,360),(7,360),(8,360),(9,360),(10,360),(11,1000)),
 initial AS (SELECT *,FLOOR(pool.grams*bps/10000) AS base,MOD(pool.grams*bps,10000) AS remainder
  FROM weights CROSS JOIN pool),
 allocations AS (SELECT slot,bps,base+CASE WHEN ROW_NUMBER() OVER(ORDER BY remainder DESC,slot)
  <=grams-SUM(base) OVER() THEN 1 ELSE 0 END AS grams FROM initial),
 standings AS (SELECT item, item->>'playerId' AS user_id,(item->>'leaderboardRank')::INTEGER AS rank,
  COUNT(*) OVER(PARTITION BY item->>'leaderboardRank') AS tied_count,
  ROW_NUMBER() OVER(PARTITION BY item->>'leaderboardRank' ORDER BY (item->>'playerId') COLLATE "C") AS tied_index,
  (item->>'wins')::INTEGER+(item->>'losses')::INTEGER>=p_min_battles
    OR COALESCE((item->>'tastedFlowerCount')::INTEGER,0)>=1 AS eligible
  FROM jsonb_array_elements(p_standings) item),
 shares AS (SELECT standing.*,allocation.grams,allocation.bps FROM standings standing
  CROSS JOIN LATERAL(SELECT COALESCE(SUM(grams),0) AS grams,COALESCE(SUM(bps),0) AS bps
   FROM allocations WHERE slot BETWEEN standing.rank AND standing.rank+standing.tied_count-1 AND slot<=10) allocation),
 payloads AS (SELECT *,jsonb_build_object('userId',user_id,'leaderboardRank',rank,
  'score',item->'score','rating',item->'rating','wins',item->'wins','losses',item->'losses',
  'tastedFlowerCount',COALESCE(item->'tastedFlowerCount','0'::JSONB),
  'rankingFormulaVersion','arena-v3-tasting-first') AS value,
  FLOOR(grams/tied_count)+CASE WHEN tied_index<=MOD(grams,tied_count) THEN 1 ELSE 0 END AS award
  FROM shares),
 top AS (SELECT value||jsonb_build_object('rewardRank',rank,'shareBps',ROUND(bps::NUMERIC/tied_count,8),'grams',award) AS value,rank,user_id
  FROM payloads WHERE eligible AND rank BETWEEN 1 AND 10 AND award>0),
 candidates AS (SELECT value,rank,user_id FROM payloads WHERE eligible AND rank>10)
 SELECT jsonb_build_object(
  'topRewards',COALESCE((SELECT jsonb_agg(value ORDER BY rank,user_id COLLATE "C") FROM top),'[]'::JSONB),
  'surpriseCandidates',COALESCE((SELECT jsonb_agg(value ORDER BY rank,user_id COLLATE "C") FROM candidates),'[]'::JSONB),
  'surpriseGrams',(SELECT grams FROM allocations WHERE slot=11),
  'candidateHash',encode(sha256(convert_to(COALESCE((SELECT string_agg(rank::TEXT||':'||user_id,E'\n'
    ORDER BY rank,user_id COLLATE "C") FROM candidates),''),'UTF8')),'hex'));
$$;
REVOKE ALL ON FUNCTION public.kq_arena_reward_plan_v3(JSONB,NUMERIC,INTEGER) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.rpc_arena_freeze_customer_reward_snapshot(TEXT,JSONB,BOOLEAN)
 RENAME TO kq_arena_freeze_customer_reward_snapshot_legacy;
REVOKE ALL ON FUNCTION public.kq_arena_freeze_customer_reward_snapshot_legacy(TEXT,JSONB,BOOLEAN)
 FROM PUBLIC,anon,authenticated,service_role;
-- All external freezes must pass the validated snapshot entry point. Its
-- owner can still call this historical pool-freeze helper internally.
REVOKE ALL ON FUNCTION public.rpc_arena_freeze_customer_reward_season(TEXT,BOOLEAN)
 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.rpc_arena_freeze_customer_reward_snapshot(
 p_season_code TEXT,p_standings JSONB,p_execute BOOLEAN DEFAULT false
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE season public.arena_customer_reward_seasons%ROWTYPE;
BEGIN
 p_execute:=COALESCE(p_execute,false);
 PERFORM pg_advisory_xact_lock(hashtextextended('arena-customer-reward:'||p_season_code,0));
 SELECT * INTO season FROM public.arena_customer_reward_seasons WHERE season_code=p_season_code FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'arena_customer_reward_season_not_found'; END IF;
 IF season.ranking_formula_version='arena-v3-tasting-first' AND season.status='active'
  AND p_standings IS DISTINCT FROM public.kq_arena_reward_current_standings(p_season_code)
 THEN RAISE EXCEPTION 'arena_customer_reward_standings_changed'; END IF;
 RETURN public.kq_arena_freeze_customer_reward_snapshot_legacy(p_season_code,p_standings,p_execute);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_arena_freeze_customer_reward_snapshot(TEXT,JSONB,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_arena_freeze_customer_reward_snapshot(TEXT,JSONB,BOOLEAN) TO service_role;

-- Preserve the original writer for legacy frozen seasons. The v3 private
-- writer retains claim creation/idempotence and accepts only the independently
-- verified allocation from the public entry point below.
ALTER FUNCTION public.rpc_arena_settle_customer_rewards(TEXT,JSONB,JSONB,TEXT,INTEGER,BOOLEAN)
 RENAME TO kq_arena_settle_customer_rewards_legacy;
REVOKE ALL ON FUNCTION public.kq_arena_settle_customer_rewards_legacy(TEXT,JSONB,JSONB,TEXT,INTEGER,BOOLEAN)
 FROM PUBLIC,anon,authenticated,service_role;
DO $$
DECLARE body TEXT; anchor TEXT; target TEXT;
BEGIN
 body:=pg_get_functiondef('public.kq_arena_settle_customer_rewards_legacy(text,jsonb,jsonb,text,integer,boolean)'::REGPROCEDURE);
 body:=replace(body,'public.kq_arena_settle_customer_rewards_legacy(','public.kq_arena_settle_customer_rewards_v3(');
 anchor:='jsonb_array_length(p_top_rewards) > 10';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'arena_reward_top_guard_changed'; END IF;
 body:=replace(body,anchor,'false');
 FOREACH target IN ARRAY ARRAY['v_reward','v_candidate'] LOOP
  anchor:='IF NOT EXISTS ('||E'\n'||'      SELECT 1 FROM public.kq_rank_profiles profile'||E'\n'||
   '      WHERE profile.user_id = ('||target||'->>''userId'')::UUID'||E'\n'||
   '        AND profile.season_code = p_season_code'||E'\n'||
   '        AND profile.wins + profile.losses >= v_season.min_human_battles'||E'\n'||'    ) THEN';
  -- pg_get_functiondef retains CRLF when the historical file was applied with it.
  body:=replace(body,E'\r\n',E'\n');
  IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'arena_reward_eligibility_guard_changed: %',target; END IF;
  body:=replace(body,anchor,'IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_season.standings_snapshot) standing
    WHERE standing->>''playerId''='||target||'->>''userId'' AND
    (COALESCE((standing->>''tastedFlowerCount'')::INTEGER,0)>=1 OR
     (standing->>''wins'')::INTEGER+(standing->>''losses'')::INTEGER>=v_season.min_human_battles)) THEN');
  body:=replace(body,'('||target||'->>''score'')::INTEGER','('||target||'->>''score'')::NUMERIC');
 END LOOP;
 body:=replace(body,'(v_reward->>''shareBps'')::INTEGER','(v_reward->>''shareBps'')::NUMERIC');
 EXECUTE body;
END;
$$;
REVOKE ALL ON FUNCTION public.kq_arena_settle_customer_rewards_v3(TEXT,JSONB,JSONB,TEXT,INTEGER,BOOLEAN)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_arena_settle_customer_rewards(
 p_season_code TEXT,p_top_rewards JSONB,p_surprise_candidates JSONB,p_candidate_hash TEXT,
 p_surprise_grams INTEGER,p_execute BOOLEAN DEFAULT false
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE season public.arena_customer_reward_seasons%ROWTYPE; standings JSONB; plan JSONB; pool NUMERIC;
BEGIN
 p_execute:=COALESCE(p_execute,false);
 PERFORM pg_advisory_xact_lock(hashtextextended('arena-customer-reward:'||p_season_code,0));
 SELECT * INTO season FROM public.arena_customer_reward_seasons WHERE season_code=p_season_code FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'arena_customer_reward_season_not_found'; END IF;
 IF season.ranking_formula_version<>'arena-v3-tasting-first' THEN
  RETURN public.kq_arena_settle_customer_rewards_legacy(p_season_code,p_top_rewards,p_surprise_candidates,p_candidate_hash,p_surprise_grams,p_execute);
 END IF;
 IF season.status='settled' THEN RETURN jsonb_build_object('executed',false,'alreadySettled',true); END IF;
 IF COALESCE(p_execute,false) AND season.status<>'frozen' THEN RAISE EXCEPTION 'arena_customer_reward_season_must_be_frozen'; END IF;
 standings:=CASE WHEN season.status='active' AND NOT COALESCE(p_execute,false)
  THEN public.kq_arena_reward_current_standings(p_season_code) ELSE season.standings_snapshot END;
 IF jsonb_typeof(standings) IS DISTINCT FROM 'array'
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(standings) item
   WHERE item->>'rankingFormulaVersion' IS DISTINCT FROM 'arena-v3-tasting-first')
 THEN RAISE EXCEPTION 'arena_customer_reward_invalid_standings'; END IF;
 SELECT GREATEST(0,COALESCE((SELECT SUM(contribution_grams) FROM public.arena_customer_reward_weeks WHERE season_code=p_season_code),0)
  +COALESCE((SELECT SUM(grams) FROM public.arena_customer_reward_adjustments WHERE season_code=p_season_code),0)) INTO pool;
 plan:=public.kq_arena_reward_plan_v3(standings,pool,season.min_human_battles);
 IF p_top_rewards IS DISTINCT FROM plan->'topRewards'
  OR p_surprise_candidates IS DISTINCT FROM plan->'surpriseCandidates'
  OR p_surprise_grams IS DISTINCT FROM (plan->>'surpriseGrams')::INTEGER
  OR p_candidate_hash IS DISTINCT FROM plan->>'candidateHash'
 THEN RAISE EXCEPTION 'arena_customer_reward_allocation_changed'; END IF;
 RETURN public.kq_arena_settle_customer_rewards_v3(p_season_code,p_top_rewards,p_surprise_candidates,p_candidate_hash,p_surprise_grams,p_execute);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_arena_settle_customer_rewards(TEXT,JSONB,JSONB,TEXT,INTEGER,BOOLEAN)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_arena_settle_customer_rewards(TEXT,JSONB,JSONB,TEXT,INTEGER,BOOLEAN) TO service_role;

COMMIT;
