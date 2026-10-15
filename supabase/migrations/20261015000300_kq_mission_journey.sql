BEGIN;

-- Immutable reward receipts unify cash, guaranteed cards and unopened packs.
-- Claims are only written inside the service RPC; API roles cannot forge them.
CREATE TABLE public.kq_mission_reward_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_code TEXT NOT NULL,
  reward JSONB NOT NULL CHECK (jsonb_typeof(reward)='object' AND reward->>'kind' IN ('cash','card','pack')),
  result JSONB NOT NULL CHECK (jsonb_typeof(result)='object'),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id,mission_code)
);
ALTER TABLE public.kq_mission_reward_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_mission_reward_receipts FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.lottery_card_instances ADD COLUMN game_mission_reward_id UUID
  REFERENCES public.kq_mission_reward_receipts(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX lottery_card_instances_game_mission ON public.lottery_card_instances(game_mission_reward_id)
  WHERE game_mission_reward_id IS NOT NULL;
ALTER TABLE public.lottery_card_instances DROP CONSTRAINT lottery_card_instances_source_required;
ALTER TABLE public.lottery_card_instances ADD CONSTRAINT lottery_card_instances_source_required CHECK (
  ticket_id IS NOT NULL OR kq_support_entitlement_id IS NOT NULL OR source_bot_battle_id IS NOT NULL
  OR pioneer_grant_id IS NOT NULL OR producer_purchase_buddie_grant_id IS NOT NULL
  OR community_mission_reward_id IS NOT NULL OR contest_bundle_order_id IS NOT NULL
  OR game_mission_reward_id IS NOT NULL
);

-- Preserve all nine historical rewards exactly, including already opened packs.
-- No replacement cash/card grant is created for an already completed mission.
INSERT INTO public.kq_mission_reward_receipts(user_id,mission_code,reward,result,claimed_at)
SELECT entitlement.user_id,old.code,jsonb_build_object('kind','pack','cardCount',entitlement.card_count),
  jsonb_build_object('reward',jsonb_build_object('kind','pack','cardCount',entitlement.card_count),
    'entitlementId',entitlement.id,'cardCount',entitlement.card_count,
    'cardInstanceId',NULL,'cashAfterCents',NULL,'replayed',false),entitlement.created_at
FROM public.kq_support_booster_entitlements entitlement
JOIN unnest(ARRAY['first-harvest','three-varieties','contest-flower','online-two','online-five','online-ten',
  'shop-one','shop-three','shop-six']) old(code)
  ON entitlement.reward_key='kq-mission:v1:'||entitlement.user_id::TEXT||':'||old.code
WHERE entitlement.source='mission';

CREATE FUNCTION public.kq_mission_definitions()
RETURNS TABLE(code TEXT,track TEXT,step INTEGER,metric TEXT,target INTEGER,reward JSONB)
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT * FROM (VALUES
    ('first-harvest','culture',1,'harvests',1,'{"kind":"cash","amountCents":5000}'::JSONB),
    ('three-varieties','culture',2,'varieties',3,'{"kind":"cash","amountCents":15000}'::JSONB),
    ('five-varieties','culture',3,'varieties',5,'{"kind":"card","code":"BOTTE-006","name":"Deuxième chance","rarity":"gold"}'::JSONB),
    ('ten-varieties','culture',4,'varieties',10,'{"kind":"card","code":"BOTTE-032","name":"Loupe à trichomes","rarity":"gold"}'::JSONB),
    ('fifteen-varieties','culture',5,'varieties',15,'{"kind":"pack","cardCount":3}'::JSONB),
    ('twenty-varieties','culture',6,'varieties',20,'{"kind":"pack","cardCount":10}'::JSONB),
    ('beautiful-flower','quality',1,'beautiful_flowers',1,'{"kind":"cash","amountCents":7500}'::JSONB),
    ('contest-flower','quality',2,'contest_flowers',1,'{"kind":"cash","amountCents":20000}'::JSONB),
    ('three-contest-flowers','quality',3,'contest_flowers',3,'{"kind":"card","code":"BOTTE-021","name":"Diagnostic croisé","rarity":"gold"}'::JSONB),
    ('five-contest-varieties','quality',4,'contest_varieties',5,'{"kind":"card","code":"BOTTE-030","name":"Sonde d’humidité","rarity":"gold"}'::JSONB),
    ('legendary-flower','quality',5,'legendary_flowers',1,'{"kind":"pack","cardCount":3}'::JSONB),
    ('three-legendary-varieties','quality',6,'legendary_varieties',3,'{"kind":"pack","cardCount":10}'::JSONB),
    ('first-prepared','preparation',1,'prepared_batches',1,'{"kind":"cash","amountCents":5000}'::JSONB),
    ('first-curing','preparation',2,'cured_lots',1,'{"kind":"cash","amountCents":15000}'::JSONB),
    ('first-transformation','preparation',3,'transformed_batches',1,'{"kind":"cash","amountCents":25000}'::JSONB),
    ('five-curings','preparation',4,'cured_lots',5,'{"kind":"card","code":"BOTTE-016","name":"Séchage patient","rarity":"gold"}'::JSONB),
    ('three-transformations','preparation',5,'transformed_routes',3,'{"kind":"card","code":"BOTTE-027","name":"Papiers en règle","rarity":"gold"}'::JSONB),
    ('ten-quality-curings','preparation',6,'quality_cured_lots',10,'{"kind":"pack","cardCount":10}'::JSONB),
    ('first-online-sale','online',1,'online_sales',1,'{"kind":"cash","amountCents":5000}'::JSONB),
    ('online-two','online',2,'clients',2,'{"kind":"cash","amountCents":10000}'::JSONB),
    ('online-aroma-duo','online',3,'online_dual_aroma_sales',1,'{"kind":"card","code":"BOTTE-006","name":"Deuxième chance","rarity":"gold"}'::JSONB),
    ('online-five','online',4,'clients',5,'{"kind":"cash","amountCents":30000}'::JSONB),
    ('online-ten','online',5,'clients',10,'{"kind":"pack","cardCount":3}'::JSONB),
    ('online-aroma-seasons','online',6,'online_satisfied_dual_aroma_periods',3,'{"kind":"pack","cardCount":10}'::JSONB),
    ('shop-one','shops',1,'partners',1,'{"kind":"cash","amountCents":10000}'::JSONB),
    ('shop-three-varieties','shops',2,'shop_varieties',3,'{"kind":"cash","amountCents":20000}'::JSONB),
    ('shop-three','shops',3,'partners',3,'{"kind":"cash","amountCents":35000}'::JSONB),
    ('shop-quality-100','shops',4,'shop_quality_grams',100,'{"kind":"card","code":"BOTTE-034","name":"Gros molosse","rarity":"gold"}'::JSONB),
    ('shop-six','shops',5,'partners',6,'{"kind":"pack","cardCount":3}'::JSONB),
    ('shop-quality-500','shops',6,'shop_quality_grams',500,'{"kind":"pack","cardCount":10}'::JSONB)
  ) AS definitions(code,track,step,metric,target,reward);
$$;

-- An old RPC already in flight during deployment can insert its v1 entitlement
-- after the import above. Read those receipts too, under the same per-user claim
-- lock, so rolling application instances cannot grant both old and new rewards.
CREATE FUNCTION public.kq_mission_reward_history(p_user UUID)
RETURNS TABLE(id UUID,mission_code TEXT,reward JSONB,result JSONB)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT r.id,r.mission_code,r.reward,r.result FROM public.kq_mission_reward_receipts r WHERE r.user_id=p_user
  UNION ALL
  SELECT e.id,old.code,jsonb_build_object('kind','pack','cardCount',e.card_count),
    jsonb_build_object('reward',jsonb_build_object('kind','pack','cardCount',e.card_count),
      'entitlementId',e.id,'cardCount',e.card_count,'cardInstanceId',NULL,'cashAfterCents',NULL,'replayed',false)
  FROM public.kq_support_booster_entitlements e
  JOIN unnest(ARRAY['first-harvest','three-varieties','contest-flower','online-two','online-five','online-ten',
    'shop-one','shop-three','shop-six']) old(code)
    ON e.reward_key='kq-mission:v1:'||p_user::TEXT||':'||old.code
  WHERE e.user_id=p_user AND e.source='mission'
    AND NOT EXISTS(SELECT 1 FROM public.kq_mission_reward_receipts r WHERE r.user_id=p_user AND r.mission_code=old.code);
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_mission_state(p_user_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  WITH metrics AS MATERIALIZED (SELECT public.kq_mission_metrics(p_user_id) AS value),
  collection AS (SELECT EXISTS(SELECT 1 FROM public.lottery_card_collections
    WHERE code='BOTTE_DU_CHANVRIER_2026' AND is_active) AS active),
  definitions AS (SELECT * FROM public.kq_mission_definitions()),
  receipts AS MATERIALIZED (SELECT * FROM public.kq_mission_reward_history(p_user_id)),
  progress AS (
    SELECT d.*,r.id AS receipt_id,r.result,
      COALESCE(r.reward,CASE WHEN d.reward->>'kind'='card' AND card.id IS NOT NULL
        THEN d.reward||jsonb_build_object('name',card.name) ELSE d.reward END) AS effective_reward,
      LEAST(d.target,GREATEST(0,COALESCE((m.value->>d.metric)::NUMERIC,0))) AS current,
      r.id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM definitions previous
        WHERE previous.track=d.track AND previous.step<d.step
          AND NOT EXISTS(SELECT 1 FROM receipts predecessor WHERE predecessor.mission_code=previous.code)) AS unlocked,
      CASE d.reward->>'kind' WHEN 'cash' THEN true WHEN 'pack' THEN c.active
        ELSE c.active AND COALESCE(card.is_active AND card.rarity::TEXT='gold'
          AND card_collection.code='BOTTE_DU_CHANVRIER_2026',false) END AS reward_available
    FROM definitions d CROSS JOIN metrics m CROSS JOIN collection c
    LEFT JOIN receipts r ON r.mission_code=d.code
    LEFT JOIN public.lottery_card_definitions card ON card.code=d.reward->>'code'
    LEFT JOIN public.lottery_card_collections card_collection ON card_collection.id=card.collection_id
  )
  SELECT jsonb_build_object('collectionActive',(SELECT active FROM collection),'missions',jsonb_agg(
    jsonb_build_object('code',code,'track',track,'step',step,'target',target,
      'reward',effective_reward,'rewardAvailable',reward_available,
      'cardCount',CASE effective_reward->>'kind' WHEN 'pack' THEN (effective_reward->>'cardCount')::INTEGER
        WHEN 'card' THEN 1 ELSE 0 END,
      'progress',CASE WHEN receipt_id IS NOT NULL THEN target ELSE current END,
      'claimed',receipt_id IS NOT NULL,'unlocked',unlocked,
      'claimable',receipt_id IS NULL AND unlocked AND current>=target,
      'entitlementId',result->'entitlementId',
      'packAvailable',EXISTS(SELECT 1 FROM public.kq_support_booster_entitlements e
        WHERE e.id=(result->>'entitlementId')::UUID AND e.user_id=p_user_id AND e.status='available'))
    ORDER BY CASE track WHEN 'culture' THEN 1 WHEN 'quality' THEN 2 WHEN 'preparation' THEN 3 WHEN 'online' THEN 4 ELSE 5 END,step))
  FROM progress;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_claim_mission(p_user_id UUID,p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<claim>>
DECLARE
  snapshot JSONB; mission JSONB; reward JSONB; result JSONB; receipt UUID;
  entitlement UUID; instance UUID; card UUID; card_name TEXT; wallet INTEGER; amount INTEGER; cards INTEGER;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'mission_invalid_user'; END IF;
  -- Same financial lock order as sales, then mission serialization and wallet.
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-missions:'||p_user_id::TEXT,0));
  SELECT r.result INTO result FROM public.kq_mission_reward_history(p_user_id) r WHERE r.mission_code=p_code;
  IF FOUND THEN RETURN result||jsonb_build_object('replayed',true); END IF;
  -- Catch up automatic orders, churn and charges before validating the current
  -- audience or paying cash, as the pre-existing online mission RPC did.
  PERFORM public.kq_business_settle(p_user_id);
  PERFORM 1 FROM public.kq_commerce_accounts WHERE user_id=p_user_id FOR SHARE;
  snapshot:=public.rpc_kq_mission_state(p_user_id);
  SELECT item INTO mission FROM jsonb_array_elements(snapshot->'missions') item WHERE item->>'code'=p_code;
  IF mission IS NULL THEN RAISE EXCEPTION 'mission_unknown'; END IF;
  IF NOT (mission->>'claimable')::BOOLEAN THEN RAISE EXCEPTION 'mission_not_ready'; END IF;
  reward:=mission->'reward'; cards:=(mission->>'cardCount')::INTEGER;
  IF reward->>'kind' IN ('card','pack') THEN
    PERFORM 1 FROM public.lottery_card_collections WHERE code='BOTTE_DU_CHANVRIER_2026' AND is_active FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'mission_collection_inactive'; END IF;
  END IF;
  IF reward->>'kind'='card' THEN
    SELECT d.id,d.name INTO card,card_name FROM public.lottery_card_definitions d
      JOIN public.lottery_card_collections c ON c.id=d.collection_id
      WHERE d.code=reward->>'code' AND d.is_active AND d.rarity::TEXT='gold'
        AND c.code='BOTTE_DU_CHANVRIER_2026' AND c.is_active FOR SHARE OF d,c;
    IF NOT FOUND THEN RAISE EXCEPTION 'mission_card_unavailable'; END IF;
    reward:=reward||jsonb_build_object('name',card_name);
  END IF;
  INSERT INTO public.kq_mission_reward_receipts(user_id,mission_code,reward,result)
    VALUES(p_user_id,p_code,reward,'{}') RETURNING id INTO receipt;
  CASE reward->>'kind'
    WHEN 'cash' THEN
      amount:=(reward->>'amountCents')::INTEGER;
      INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
      SELECT cash_cents INTO wallet FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
      IF wallet::BIGINT+amount>2147483647 THEN RAISE EXCEPTION 'mission_wallet_limit'; END IF;
      PERFORM public.kq_treasury_initialize(p_user_id);
      UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+amount,updated_at=now()
        WHERE user_id=p_user_id RETURNING cash_cents INTO wallet;
      PERFORM public.kq_treasury_pair(p_user_id,'reward','kq-mission:v2:'||receipt::TEXT,now(),
        'suspense','revenue_rewards',amount,'Mission : '||p_code);
    WHEN 'card' THEN
      INSERT INTO public.lottery_card_instances(user_id,card_definition_id,pack_slot,game_mission_reward_id)
        VALUES(p_user_id,card,1,receipt) RETURNING id INTO instance;
    WHEN 'pack' THEN
      INSERT INTO public.kq_support_booster_entitlements(user_id,source,reward_key,card_count)
        VALUES(p_user_id,'mission','kq-mission:v2:'||p_user_id::TEXT||':'||p_code,cards)
        RETURNING id INTO entitlement;
    ELSE RAISE EXCEPTION 'mission_invalid_reward';
  END CASE;
  result:=jsonb_build_object('reward',reward,'entitlementId',entitlement,'cardCount',cards,
    'cardInstanceId',instance,'cashAfterCents',wallet,'replayed',false);
  UPDATE public.kq_mission_reward_receipts SET reward=claim.reward,result=claim.result WHERE id=receipt;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.kq_mission_definitions() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_mission_reward_history(UUID) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_mission_state(UUID),public.rpc_kq_claim_mission(UUID,TEXT)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_mission_state(UUID),public.rpc_kq_claim_mission(UUID,TEXT) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
