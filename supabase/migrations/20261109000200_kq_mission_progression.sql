BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Keep earned rewards and their exact inventory sources. XP belongs to the
-- immutable receipt, never to the current wallet, season or card balance.
ALTER TABLE public.kq_mission_reward_receipts
 ADD COLUMN xp_awarded INTEGER CHECK(xp_awarded BETWEEN 0 AND 300 AND xp_awarded%50=0);
UPDATE public.kq_mission_reward_receipts r SET xp_awarded=d.step*50
 FROM public.kq_mission_definitions() d WHERE d.code=r.mission_code;
ALTER TABLE public.kq_mission_reward_receipts DROP CONSTRAINT kq_mission_reward_receipts_reward_check;
ALTER TABLE public.kq_mission_reward_receipts ADD CONSTRAINT kq_mission_reward_receipts_reward_check
 CHECK(jsonb_typeof(reward)='object' AND reward->>'kind' IN ('cash','card','pack','buddie'));
REVOKE ALL ON TABLE public.kq_mission_reward_receipts FROM PUBLIC,anon,authenticated,service_role;

-- Preserve the existing quality-tier compatibility, curing mass evidence and
-- historical commerce calculations without copying or resetting them.
ALTER FUNCTION public.kq_mission_metrics(UUID) RENAME TO kq_mission_metrics_before_progression;
REVOKE ALL ON FUNCTION public.kq_mission_metrics_before_progression(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_mission_metrics(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH tasks AS MATERIALIZED (
  SELECT employee_id,payload FROM public.kq_staff_archive
  WHERE user_id=p_user AND kind='task' AND payload->>'status'='completed'
 ), choices AS (
  SELECT request_key FROM public.kq_social_requests WHERE user_id=p_user AND command->>'action'='choose'
  UNION
  SELECT request_key FROM public.kq_social_v2_receipts WHERE user_id=p_user AND command->>'action'='choose'
 ), jury AS (
  SELECT flower_id FROM public.kq_bot_battles WHERE user_id=p_user AND verdict_at IS NOT NULL
  UNION
  SELECT flower_one_id FROM public.kq_battles WHERE player_one_id=p_user AND status::TEXT='verdict' AND verdict_at IS NOT NULL
  UNION
  SELECT flower_two_id FROM public.kq_battles WHERE player_two_id=p_user AND status::TEXT='verdict' AND verdict_at IS NOT NULL
 )
 SELECT public.kq_mission_metrics_before_progression(p_user)||jsonb_build_object(
  'trimmed_lots',(SELECT count(*) FROM public.kq_staff_trim_lots WHERE user_id=p_user AND completed_at IS NOT NULL AND total_grams>0),
  'employee_tasks',(SELECT count(*) FROM tasks WHERE employee_id<>'player'),
  'prospecting_tasks',(SELECT count(*) FROM tasks WHERE payload->>'kind'='sales'),
  'social_choices',(SELECT count(*) FROM choices),
  'collection_buddies',(SELECT count(DISTINCT d.id) FROM public.lottery_card_instances i
   JOIN public.lottery_card_definitions d ON d.id=i.card_definition_id
   JOIN public.lottery_card_collections c ON c.id=d.collection_id
   WHERE i.user_id=p_user AND c.code='HEMP_HEROES_2026' AND d.card_number BETWEEN 1 AND 52
    AND d.code='HH2026-'||lpad(d.card_number::TEXT,3,'0')),
  'jury_flowers',(SELECT count(*) FROM jury j JOIN public.kq_flowers f ON f.id=j.flower_id WHERE f.owner_id=p_user),
  'supplier_invoices_paid',(SELECT count(*) FROM public.kq_supplier_invoices
   WHERE user_id=p_user AND amount_cents>0 AND remaining_cents=0)
 );
$$;
REVOKE ALL ON FUNCTION public.kq_mission_metrics(UUID) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.kq_mission_definitions() RENAME TO kq_mission_definitions_before_progression;
REVOKE ALL ON FUNCTION public.kq_mission_definitions_before_progression() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_mission_definitions()
RETURNS TABLE(code TEXT,track TEXT,step INTEGER,metric TEXT,target INTEGER,reward JSONB)
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT * FROM public.kq_mission_definitions_before_progression()
 UNION ALL
 SELECT d.code,d.track,d.step,d.metric,d.target,
  CASE d.step WHEN 1 THEN '{"kind":"cash","amountCents":5000}'::JSONB
   WHEN 2 THEN '{"kind":"cash","amountCents":10000}'::JSONB
   WHEN 3 THEN '{"kind":"card","code":"BOTTE-006","name":"Deuxième chance","rarity":"gold"}'::JSONB
   WHEN 4 THEN '{"kind":"card","code":"BOTTE-032","name":"Loupe à trichomes","rarity":"gold"}'::JSONB
   WHEN 5 THEN '{"kind":"pack","cardCount":3}'::JSONB
   ELSE '{"kind":"pack","cardCount":10}'::JSONB END
 FROM (VALUES
  ('trim-one','trim',1,'trimmed_lots',1),('trim-three','trim',2,'trimmed_lots',3),
  ('trim-ten','trim',3,'trimmed_lots',10),('trim-twenty-five','trim',4,'trimmed_lots',25),
  ('trim-fifty','trim',5,'trimmed_lots',50),('trim-hundred','trim',6,'trimmed_lots',100),
  ('staff-first-task','staff',1,'employee_tasks',1),('staff-five-tasks','staff',2,'employee_tasks',5),
  ('staff-fifteen-tasks','staff',3,'employee_tasks',15),('staff-thirty-tasks','staff',4,'employee_tasks',30),
  ('staff-sixty-tasks','staff',5,'employee_tasks',60),('staff-hundred-twenty-tasks','staff',6,'employee_tasks',120),
  ('social-three-choices','social',1,'social_choices',3),('social-ten-choices','social',2,'social_choices',10),
  ('social-twenty-five-choices','social',3,'social_choices',25),('social-fifty-choices','social',4,'social_choices',50),
  ('social-hundred-choices','social',5,'social_choices',100),('social-two-hundred-choices','social',6,'social_choices',200),
  ('collection-five','collection',1,'collection_buddies',5),('collection-ten','collection',2,'collection_buddies',10),
  ('collection-fifteen','collection',3,'collection_buddies',15),('collection-twenty-five','collection',4,'collection_buddies',25),
  ('collection-thirty-five','collection',5,'collection_buddies',35),('collection-fifty','collection',6,'collection_buddies',50),
  ('jury-one','jury',1,'jury_flowers',1),('jury-five','jury',2,'jury_flowers',5),
  ('jury-fifteen','jury',3,'jury_flowers',15),('jury-thirty','jury',4,'jury_flowers',30),
  ('jury-sixty','jury',5,'jury_flowers',60),('jury-hundred','jury',6,'jury_flowers',100),
  ('finance-one','finance',1,'supplier_invoices_paid',1),('finance-three','finance',2,'supplier_invoices_paid',3),
  ('finance-ten','finance',3,'supplier_invoices_paid',10),('finance-twenty-five','finance',4,'supplier_invoices_paid',25),
  ('finance-fifty','finance',5,'supplier_invoices_paid',50),('finance-hundred','finance',6,'supplier_invoices_paid',100),
  ('prospecting-one','prospecting',1,'prospecting_tasks',1),('prospecting-five','prospecting',2,'prospecting_tasks',5),
  ('prospecting-fifteen','prospecting',3,'prospecting_tasks',15),('prospecting-thirty','prospecting',4,'prospecting_tasks',30),
  ('prospecting-sixty','prospecting',5,'prospecting_tasks',60),('prospecting-hundred','prospecting',6,'prospecting_tasks',100)
 ) d(code,track,step,metric,target);
$$;
REVOKE ALL ON FUNCTION public.kq_mission_definitions() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_mission_level_definitions()
RETURNS TABLE(code TEXT,level INTEGER,required_xp INTEGER,reward JSONB)
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT 'level-'||v.level,v.level,(v.level-1)*(v.level+2)*25,v.reward
 FROM (VALUES
  (2,'{"kind":"buddie","rarity":"common"}'::JSONB),
  (3,'{"kind":"pack","cardCount":3}'::JSONB),
  (4,'{"kind":"card","code":"BOTTE-006","name":"Deuxième chance","rarity":"gold"}'::JSONB),
  (5,'{"kind":"buddie","rarity":"silver"}'::JSONB),
  (6,'{"kind":"cash","amountCents":15000}'::JSONB),
  (7,'{"kind":"pack","cardCount":3}'::JSONB),
  (8,'{"kind":"card","code":"BOTTE-032","name":"Loupe à trichomes","rarity":"gold"}'::JSONB),
  (9,'{"kind":"pack","cardCount":10}'::JSONB),
  (10,'{"kind":"buddie","rarity":"gold"}'::JSONB),
  (11,'{"kind":"cash","amountCents":25000}'::JSONB),
  (12,'{"kind":"pack","cardCount":3}'::JSONB),
  (13,'{"kind":"card","code":"BOTTE-021","name":"Diagnostic croisé","rarity":"gold"}'::JSONB),
  (14,'{"kind":"pack","cardCount":10}'::JSONB),
  (15,'{"kind":"buddie","rarity":"epic"}'::JSONB),
  (16,'{"kind":"cash","amountCents":35000}'::JSONB),
  (17,'{"kind":"card","code":"BOTTE-030","name":"Sonde d’humidité","rarity":"gold"}'::JSONB),
  (18,'{"kind":"pack","cardCount":10}'::JSONB),
  (19,'{"kind":"cash","amountCents":50000}'::JSONB),
  (20,'{"kind":"buddie","rarity":"legendary"}'::JSONB)
 ) v(level,reward);
$$;
REVOKE ALL ON FUNCTION public.kq_mission_level_definitions() FROM PUBLIC,anon,authenticated,service_role;

-- Null XP is reserved for an older RPC finishing across deployment. Its code
-- still has exactly one historical receipt and the fixed catalogue award.
CREATE FUNCTION public.kq_mission_total_xp(p_user UUID) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(sum(COALESCE(r.xp_awarded,d.step*50,0)),0)::INTEGER
 FROM public.kq_mission_reward_history(p_user) h
 LEFT JOIN public.kq_mission_reward_receipts r ON r.user_id=p_user AND r.mission_code=h.mission_code
 LEFT JOIN public.kq_mission_definitions() d ON d.code=h.mission_code;
$$;
REVOKE ALL ON FUNCTION public.kq_mission_total_xp(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_mission_buddie_catalog(p_rarity TEXT)
RETURNS SETOF public.lottery_card_definitions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT d.* FROM public.lottery_card_definitions d JOIN public.lottery_card_collections c ON c.id=d.collection_id
 WHERE c.code='HEMP_HEROES_2026' AND c.is_active AND d.is_active AND d.rarity::TEXT=p_rarity
  AND d.card_number BETWEEN 1 AND 52 AND d.code='HH2026-'||lpad(d.card_number::TEXT,3,'0')
  AND p_rarity=CASE WHEN d.card_number=1 THEN 'legendary' WHEN d.card_number<=4 THEN 'epic'
   WHEN d.card_number<=9 THEN 'gold' WHEN d.card_number<=19 THEN 'silver' ELSE 'common' END;
$$;
REVOKE ALL ON FUNCTION public.kq_mission_buddie_catalog(TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_mission_reward_offer(p_user UUID,p_reward JSONB) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH chosen AS (
  SELECT d.id,d.code,d.name FROM public.kq_mission_buddie_catalog(p_reward->>'rarity') d
  WHERE p_reward->>'kind'='buddie'
  ORDER BY EXISTS(SELECT 1 FROM public.lottery_card_instances i WHERE i.user_id=p_user AND i.card_definition_id=d.id),d.card_number,d.id LIMIT 1
 ), card AS (
  SELECT d.id,d.name FROM public.lottery_card_definitions d JOIN public.lottery_card_collections c ON c.id=d.collection_id
  WHERE p_reward->>'kind'='card' AND d.code=p_reward->>'code' AND d.is_active AND d.rarity::TEXT='gold'
   AND c.code='BOTTE_DU_CHANVRIER_2026' AND c.is_active
 )
 SELECT jsonb_build_object('reward',CASE
  WHEN p_reward->>'kind'='buddie' AND EXISTS(SELECT 1 FROM chosen)
   THEN p_reward||(SELECT jsonb_build_object('code',code,'name',name) FROM chosen)
  WHEN p_reward->>'kind'='card' AND EXISTS(SELECT 1 FROM card)
   THEN p_reward||(SELECT jsonb_build_object('name',name) FROM card)
  ELSE p_reward END,
  'rewardAvailable',CASE p_reward->>'kind' WHEN 'cash' THEN true
   WHEN 'pack' THEN EXISTS(SELECT 1 FROM public.lottery_card_collections WHERE code='BOTTE_DU_CHANVRIER_2026' AND is_active)
   WHEN 'card' THEN EXISTS(SELECT 1 FROM card) WHEN 'buddie' THEN EXISTS(SELECT 1 FROM chosen) ELSE false END,
  'cardCount',CASE p_reward->>'kind' WHEN 'pack' THEN (p_reward->>'cardCount')::INTEGER WHEN 'cash' THEN 0 ELSE 1 END);
$$;
REVOKE ALL ON FUNCTION public.kq_mission_reward_offer(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_mission_state(p_user_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH metrics AS MATERIALIZED (SELECT public.kq_mission_metrics(p_user_id) AS value),
 definitions AS MATERIALIZED (SELECT * FROM public.kq_mission_definitions()),
 receipts AS MATERIALIZED (SELECT * FROM public.kq_mission_reward_history(p_user_id)),
 experience AS MATERIALIZED (SELECT public.kq_mission_total_xp(p_user_id) AS xp),
 level_state AS (SELECT xp,COALESCE((SELECT max(level) FROM public.kq_mission_level_definitions() WHERE required_xp<=xp),1) AS level FROM experience),
 progress AS (
  SELECT d.*,r.id AS receipt_id,r.result,COALESCE(r.reward,o.offer->'reward') AS effective_reward,
   (o.offer->>'rewardAvailable')::BOOLEAN AS reward_available,
   LEAST(d.target,GREATEST(0,COALESCE((m.value->>d.metric)::NUMERIC,0))) AS current,
   r.id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM definitions previous WHERE previous.track=d.track AND previous.step<d.step
    AND NOT EXISTS(SELECT 1 FROM receipts predecessor WHERE predecessor.mission_code=previous.code)) AS unlocked
  FROM definitions d CROSS JOIN metrics m LEFT JOIN receipts r ON r.mission_code=d.code
  CROSS JOIN LATERAL (SELECT public.kq_mission_reward_offer(p_user_id,d.reward) AS offer) o
 ), levels AS (
  SELECT d.*,r.id AS receipt_id,r.result,COALESCE(r.reward,o.offer->'reward') AS effective_reward,
   (o.offer->>'rewardAvailable')::BOOLEAN AS reward_available,x.xp
  FROM public.kq_mission_level_definitions() d CROSS JOIN experience x LEFT JOIN receipts r ON r.mission_code=d.code
  CROSS JOIN LATERAL (SELECT public.kq_mission_reward_offer(p_user_id,d.reward) AS offer) o
 )
 SELECT jsonb_build_object(
  'collectionActive',EXISTS(SELECT 1 FROM public.lottery_card_collections WHERE code='BOTTE_DU_CHANVRIER_2026' AND is_active),
  'missions',(SELECT jsonb_agg(jsonb_build_object('code',code,'track',track,'step',step,'target',target,'xp',step*50,
   'reward',effective_reward,'rewardAvailable',reward_available,
   'cardCount',CASE effective_reward->>'kind' WHEN 'pack' THEN (effective_reward->>'cardCount')::INTEGER WHEN 'cash' THEN 0 ELSE 1 END,
   'progress',CASE WHEN receipt_id IS NOT NULL THEN target ELSE current END,'claimed',receipt_id IS NOT NULL,'unlocked',unlocked,
   'claimable',receipt_id IS NULL AND unlocked AND current>=target,'entitlementId',result->'entitlementId',
   'packAvailable',EXISTS(SELECT 1 FROM public.kq_support_booster_entitlements e WHERE e.id=(result->>'entitlementId')::UUID AND e.user_id=p_user_id AND e.status='available'))
   ORDER BY array_position(ARRAY['culture','quality','preparation','online','shops','trim','staff','social','collection','jury','finance','prospecting'],track),step) FROM progress),
  'progression',jsonb_build_object('totalXp',s.xp,'level',s.level,'levelXp',s.xp-((s.level-1)*(s.level+2)*25),
   'nextLevelXp',CASE WHEN s.level<20 THEN 100+50*(s.level-1) ELSE NULL END,
   'rewards',(SELECT jsonb_agg(jsonb_build_object('code',code,'level',level,'requiredXp',required_xp,
    'reward',effective_reward,'rewardAvailable',reward_available,'claimed',receipt_id IS NOT NULL,
    'claimable',receipt_id IS NULL AND xp>=required_xp,'entitlementId',result->'entitlementId',
    'cardCount',CASE effective_reward->>'kind' WHEN 'pack' THEN (effective_reward->>'cardCount')::INTEGER WHEN 'cash' THEN 0 ELSE 1 END,
    'packAvailable',EXISTS(SELECT 1 FROM public.kq_support_booster_entitlements e WHERE e.id=(result->>'entitlementId')::UUID AND e.user_id=p_user_id AND e.status='available')) ORDER BY level) FROM levels))
 ) FROM level_state s;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_claim_mission(p_user_id UUID,p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<claim>>
DECLARE snapshot JSONB; mission JSONB; reward JSONB; result JSONB; receipt UUID;
 entitlement UUID; instance UUID; card UUID; card_name TEXT; wallet INTEGER; amount INTEGER; cards INTEGER; xp INTEGER;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'mission_invalid_user'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-missions:'||p_user_id::TEXT,0));
 SELECT h.result INTO result FROM public.kq_mission_reward_history(p_user_id) h WHERE h.mission_code=p_code;
 IF FOUND THEN RETURN result||jsonb_build_object('replayed',true,'xpAwarded',0); END IF;
 PERFORM public.kq_business_settle(p_user_id);
 PERFORM 1 FROM public.kq_commerce_accounts WHERE user_id=p_user_id FOR SHARE;
 snapshot:=public.rpc_kq_mission_state(p_user_id);
 SELECT item INTO mission FROM jsonb_array_elements((snapshot->'missions')||(snapshot->'progression'->'rewards')) item WHERE item->>'code'=p_code;
 IF mission IS NULL THEN RAISE EXCEPTION 'mission_unknown'; END IF;
 IF NOT (mission->>'claimable')::BOOLEAN THEN RAISE EXCEPTION 'mission_not_ready'; END IF;
 reward:=mission->'reward'; cards:=(mission->>'cardCount')::INTEGER; xp:=COALESCE((mission->>'xp')::INTEGER,0);
 IF reward->>'kind' IN ('card','pack','buddie') THEN
  PERFORM 1 FROM public.lottery_card_collections WHERE code=CASE WHEN reward->>'kind'='buddie' THEN 'HEMP_HEROES_2026' ELSE 'BOTTE_DU_CHANVRIER_2026' END AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission_collection_inactive'; END IF;
 END IF;
 IF reward->>'kind' IN ('card','buddie') THEN
  SELECT d.id,d.name INTO card,card_name FROM public.lottery_card_definitions d JOIN public.lottery_card_collections c ON c.id=d.collection_id
   WHERE d.code=reward->>'code' AND d.is_active AND c.is_active AND (
    (reward->>'kind'='card' AND c.code='BOTTE_DU_CHANVRIER_2026' AND d.rarity::TEXT='gold') OR
    (reward->>'kind'='buddie' AND c.code='HEMP_HEROES_2026' AND d.rarity::TEXT=reward->>'rarity'
     AND d.card_number BETWEEN 1 AND 52 AND d.code='HH2026-'||lpad(d.card_number::TEXT,3,'0')
     AND d.rarity::TEXT=CASE WHEN d.card_number=1 THEN 'legendary' WHEN d.card_number<=4 THEN 'epic'
      WHEN d.card_number<=9 THEN 'gold' WHEN d.card_number<=19 THEN 'silver' ELSE 'common' END))
   FOR SHARE OF d,c;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission_card_unavailable'; END IF;
  reward:=reward||jsonb_build_object('name',card_name);
 END IF;
 INSERT INTO public.kq_mission_reward_receipts(user_id,mission_code,reward,result,xp_awarded)
  VALUES(p_user_id,p_code,reward,'{}',xp) RETURNING id INTO receipt;
 CASE reward->>'kind'
  WHEN 'cash' THEN
   amount:=(reward->>'amountCents')::INTEGER;
   INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
   SELECT cash_cents INTO wallet FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
   IF wallet::BIGINT+amount>2147483647 THEN RAISE EXCEPTION 'mission_wallet_limit'; END IF;
   PERFORM public.kq_treasury_initialize(p_user_id);
   UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+amount,updated_at=now() WHERE user_id=p_user_id RETURNING cash_cents INTO wallet;
   PERFORM public.kq_treasury_pair(p_user_id,'reward','kq-mission:v2:'||receipt::TEXT,now(),'suspense','revenue_rewards',amount,'Mission : '||p_code);
  WHEN 'card','buddie' THEN
   INSERT INTO public.lottery_card_instances(user_id,card_definition_id,pack_slot,game_mission_reward_id)
    VALUES(p_user_id,card,1,receipt) RETURNING id INTO instance;
  WHEN 'pack' THEN
   INSERT INTO public.kq_support_booster_entitlements(user_id,source,reward_key,card_count)
    VALUES(p_user_id,'mission','kq-mission:v2:'||p_user_id::TEXT||':'||p_code,cards) RETURNING id INTO entitlement;
  ELSE RAISE EXCEPTION 'mission_invalid_reward';
 END CASE;
 result:=jsonb_build_object('reward',reward,'entitlementId',entitlement,'cardCount',cards,'cardInstanceId',instance,
  'cashAfterCents',wallet,'replayed',false,'xpAwarded',xp);
 UPDATE public.kq_mission_reward_receipts SET reward=claim.reward,result=claim.result WHERE id=receipt;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_mission_state(UUID),public.rpc_kq_claim_mission(UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_mission_state(UUID),public.rpc_kq_claim_mission(UUID,TEXT) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
