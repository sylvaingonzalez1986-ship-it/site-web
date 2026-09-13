BEGIN;

ALTER TABLE public.kq_support_booster_entitlements
  DROP CONSTRAINT kq_support_booster_entitlements_source_check,
  DROP CONSTRAINT kq_support_booster_entitlements_source_shape_check;
ALTER TABLE public.kq_support_booster_entitlements
  ADD CONSTRAINT kq_support_booster_entitlements_source_check CHECK (source IN
    ('ticket','arena_streak','notebook_badge','season_reward','points_purchase','welcome_pack','pvp_win','notebook_flower','mission')),
  ADD CONSTRAINT kq_support_booster_entitlements_source_shape_check CHECK (
    (source='ticket' AND ticket_id IS NOT NULL AND reward_key IS NULL) OR
    (source IN ('arena_streak','notebook_badge','season_reward','points_purchase','welcome_pack','pvp_win','notebook_flower','mission')
      AND ticket_id IS NULL AND reward_key IS NOT NULL));

-- Permanent account milestones. Completed official cultures count even after
-- the flower is sold or burned. Commercial goals use the current net audience,
-- never gross client gains that could be farmed by losing/regaining customers.
CREATE FUNCTION public.rpc_kq_mission_state(p_user_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH metrics AS (
    SELECT count(*) AS harvests, count(DISTINCT f.variety_code) AS varieties,
      count(*) FILTER (WHERE f.quality >= 10) AS contest_flowers,
      COALESCE((SELECT clients FROM public.kq_commerce_accounts WHERE user_id=p_user_id),0) AS clients,
      COALESCE((SELECT shop_partners FROM public.kq_commerce_accounts WHERE user_id=p_user_id),0) AS partners
    FROM public.kq_flowers f JOIN public.kq_runs r ON r.id=f.run_id
    WHERE f.owner_id=p_user_id AND r.user_id=p_user_id AND r.status::TEXT='completed'
  ), definitions(code,track,step,metric,target,card_count,previous) AS (VALUES
    ('first-harvest','culture',1,'harvests',1,3,NULL::TEXT),
    ('three-varieties','culture',2,'varieties',3,3,'first-harvest'),
    ('contest-flower','culture',3,'contest_flowers',1,10,'three-varieties'),
    ('online-two','online',1,'clients',2,3,NULL::TEXT),
    ('online-five','online',2,'clients',5,3,'online-two'),
    ('online-ten','online',3,'clients',10,10,'online-five'),
    ('shop-one','shops',1,'partners',1,3,NULL::TEXT),
    ('shop-three','shops',2,'partners',3,3,'shop-one'),
    ('shop-six','shops',3,'partners',6,10,'shop-three')
  ), progress AS (
    SELECT d.*, LEAST(d.target,CASE metric
      WHEN 'harvests' THEN m.harvests WHEN 'varieties' THEN m.varieties
      WHEN 'contest_flowers' THEN m.contest_flowers WHEN 'clients' THEN m.clients
      ELSE m.partners END) AS current,
      e.id AS entitlement_id, e.status AS entitlement_status,
      (d.previous IS NULL OR EXISTS(SELECT 1 FROM public.kq_support_booster_entitlements predecessor
        WHERE predecessor.user_id=p_user_id AND predecessor.source='mission'
        AND predecessor.reward_key='kq-mission:v1:'||p_user_id::TEXT||':'||d.previous)) AS unlocked
    FROM definitions d CROSS JOIN metrics m
    LEFT JOIN public.kq_support_booster_entitlements e ON e.user_id=p_user_id AND e.source='mission'
      AND e.reward_key='kq-mission:v1:'||p_user_id::TEXT||':'||d.code
  )
  SELECT jsonb_build_object(
    'collectionActive',EXISTS(SELECT 1 FROM public.lottery_card_collections WHERE code='BOTTE_DU_CHANVRIER_2026' AND is_active),
    'missions',jsonb_agg(jsonb_build_object(
      'code',code,'track',track,'step',step,'target',target,'cardCount',card_count,
      'progress',CASE WHEN entitlement_id IS NOT NULL THEN target ELSE current END,
      'claimed',entitlement_id IS NOT NULL,'unlocked',unlocked,
      'claimable',entitlement_id IS NULL AND unlocked AND current>=target,
      'entitlementId',entitlement_id,'packAvailable',entitlement_status='available'
    ) ORDER BY track,step)) FROM progress;
$$;

CREATE FUNCTION public.rpc_kq_claim_mission(p_user_id UUID, p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  snapshot JSONB; mission JSONB; entitlement UUID; reward TEXT;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'mission_invalid_user'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-missions:'||p_user_id::TEXT,0));
  -- Serialize reward validation against audience updates during sales.
  PERFORM 1 FROM public.kq_commerce_accounts WHERE user_id=p_user_id FOR SHARE;
  snapshot := public.rpc_kq_mission_state(p_user_id);
  SELECT item INTO mission FROM jsonb_array_elements(snapshot->'missions') item WHERE item->>'code'=p_code;
  IF mission IS NULL THEN RAISE EXCEPTION 'mission_unknown'; END IF;
  IF (mission->>'claimed')::BOOLEAN THEN
    RETURN jsonb_build_object('entitlementId',mission->>'entitlementId','cardCount',(mission->>'cardCount')::INTEGER,'replayed',true);
  END IF;
  IF NOT (snapshot->>'collectionActive')::BOOLEAN THEN RAISE EXCEPTION 'mission_collection_inactive'; END IF;
  IF NOT (mission->>'claimable')::BOOLEAN THEN RAISE EXCEPTION 'mission_not_ready'; END IF;
  reward := 'kq-mission:v1:'||p_user_id::TEXT||':'||p_code;
  INSERT INTO public.kq_support_booster_entitlements(user_id,source,reward_key,card_count)
    VALUES(p_user_id,'mission',reward,(mission->>'cardCount')::INTEGER)
    RETURNING id INTO entitlement;
  RETURN jsonb_build_object('entitlementId',entitlement,'cardCount',(mission->>'cardCount')::INTEGER,'replayed',false);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_mission_state(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.rpc_kq_claim_mission(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_mission_state(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_claim_mission(UUID,TEXT) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
