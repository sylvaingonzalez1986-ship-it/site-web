BEGIN;

-- A commemorative collection stays outside random booster pools and Buddies completion pages.
INSERT INTO public.lottery_card_collections(code,title,is_active)
VALUES('PIONEERS_2026','Les Pionniers - Edition limitee 2026',false)
ON CONFLICT(code) DO NOTHING;
INSERT INTO public.lottery_card_definitions(collection_id,code,card_number,name,rarity,description,image_url,is_active)
SELECT id,'PIONEER-2026-001',1,'Les Pionniers','legendary',
  'Carte souvenir exclusive du Pack des Pionniers 2026. Merci de faire grandir l''aventure.',
  '/contest/rewards/pioneers-2026-v1.png',false
FROM public.lottery_card_collections WHERE code='PIONEERS_2026'
ON CONFLICT(code) DO NOTHING;

CREATE TABLE public.kq_pioneer_pack_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  qualifying_order_id TEXT UNIQUE REFERENCES public.orders(id) ON DELETE SET NULL,
  gold_card_id UUID NOT NULL REFERENCES public.lottery_card_definitions(id) ON DELETE RESTRICT,
  special_card_id UUID NOT NULL REFERENCES public.lottery_card_definitions(id) ON DELETE RESTRICT,
  cash_cents INTEGER NOT NULL DEFAULT 100000 CHECK(cash_cents=100000),
  pack_count INTEGER NOT NULL DEFAULT 10 CHECK(pack_count=10),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kq_pioneer_pack_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY pioneer_grants_read_own ON public.kq_pioneer_pack_grants FOR SELECT USING(auth.uid()=user_id);
REVOKE ALL ON public.kq_pioneer_pack_grants FROM anon,authenticated;
GRANT SELECT ON public.kq_pioneer_pack_grants TO authenticated;
GRANT ALL ON public.kq_pioneer_pack_grants TO service_role;

ALTER TABLE public.lottery_card_instances ADD COLUMN pioneer_grant_id UUID
  REFERENCES public.kq_pioneer_pack_grants(id) ON DELETE CASCADE;
ALTER TABLE public.lottery_card_instances DROP CONSTRAINT lottery_card_instances_source_required;
ALTER TABLE public.lottery_card_instances ADD CONSTRAINT lottery_card_instances_source_required
  CHECK(ticket_id IS NOT NULL OR kq_support_entitlement_id IS NOT NULL
    OR source_bot_battle_id IS NOT NULL OR pioneer_grant_id IS NOT NULL);
CREATE UNIQUE INDEX pioneer_card_once ON public.lottery_card_instances(pioneer_grant_id,card_definition_id)
  WHERE pioneer_grant_id IS NOT NULL;

ALTER TABLE public.kq_support_booster_entitlements DROP CONSTRAINT kq_support_booster_entitlements_source_check;
ALTER TABLE public.kq_support_booster_entitlements ADD CONSTRAINT kq_support_booster_entitlements_source_check
  CHECK(source IN ('ticket','arena_streak','notebook_badge','season_reward','points_purchase','welcome_pack',
    'pvp_win','notebook_flower','mission','achievement','pioneer_pack'));
-- The existing source_shape_check requires a non-null reward_key for every non-ticket grant.

CREATE INDEX IF NOT EXISTS pioneer_paid_order_lookup ON public.orders(customer_id,created_at,id)
  WHERE payment_state='paid' AND status<>'cancelled';
CREATE INDEX IF NOT EXISTS pioneer_guest_order_lookup ON public.orders(lower(btrim(customer_email)),created_at,id)
  WHERE customer_id IS NULL AND payment_state='paid' AND status<>'cancelled';

-- No lower date bound: the entire history of the site qualifies.
-- 11 October 00:00 Europe/Paris is the EXCLUSIVE upper bound (10 October included).
-- Linked orders are matched only by customer_id. Unlinked guest orders require verified email.
CREATE FUNCTION public.kq_pioneer_qualifying_order(p_user_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT o.id FROM public.orders o JOIN auth.users u ON u.id=p_user_id
  WHERE o.payment_state='paid' AND o.status<>'cancelled'
    AND o.created_at < TIMESTAMPTZ '2026-10-11 00:00:00 Europe/Paris'
    AND o.created_at <= now()
    AND (o.customer_id=p_user_id OR (o.customer_id IS NULL AND u.email_confirmed_at IS NOT NULL
      AND lower(btrim(o.customer_email))=lower(btrim(u.email))))
    AND NOT EXISTS(SELECT 1 FROM public.kq_pioneer_pack_grants g
      WHERE g.qualifying_order_id=o.id AND g.user_id<>p_user_id)
  ORDER BY o.created_at,o.id LIMIT 1;
$$;

CREATE FUNCTION public.rpc_kq_pioneer_pack_state(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE g public.kq_pioneer_pack_grants%ROWTYPE; gold JSONB; ready BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN
    RAISE EXCEPTION 'pioneer_invalid_user';
  END IF;
  SELECT * INTO g FROM public.kq_pioneer_pack_grants WHERE user_id=p_user_id;
  IF FOUND THEN
    SELECT jsonb_build_object('code',code,'name',name,'imageUrl',image_url) INTO gold
      FROM public.lottery_card_definitions WHERE id=g.gold_card_id;
    RETURN jsonb_build_object('eligible',true,'claimed',true,'available',true,
      'grantedAt',g.granted_at,'cashCents',g.cash_cents,'packCount',g.pack_count,'goldCard',gold);
  END IF;
  ready := EXISTS(SELECT 1 FROM public.lottery_card_collections WHERE code='BOTTE_DU_CHANVRIER_2026' AND is_active)
    AND EXISTS(SELECT 1 FROM public.lottery_card_definitions d JOIN public.lottery_card_collections c ON c.id=d.collection_id
      WHERE c.code='HEMP_HEROES_2026' AND c.is_active AND d.is_active AND d.rarity='gold')
    AND EXISTS(SELECT 1 FROM public.lottery_card_definitions WHERE code='PIONEER-2026-001');
  RETURN jsonb_build_object('eligible',public.kq_pioneer_qualifying_order(p_user_id) IS NOT NULL,
    'claimed',false,'available',ready,'grantedAt',NULL,'cashCents',100000,'packCount',10,'goldCard',NULL);
END;
$$;

CREATE FUNCTION public.rpc_kq_claim_pioneer_pack(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE order_id TEXT; gold_id UUID; special_id UUID; grant_id UUID; gold_count INTEGER; gold_offset INTEGER; state JSONB;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'pioneer_invalid_user'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-pioneer-2026:'||p_user_id::TEXT,0));
  IF EXISTS(SELECT 1 FROM public.kq_pioneer_pack_grants WHERE user_id=p_user_id) THEN
    RETURN public.rpc_kq_pioneer_pack_state(p_user_id)||jsonb_build_object('replayed',true);
  END IF;
  order_id := public.kq_pioneer_qualifying_order(p_user_id);
  IF order_id IS NULL THEN RAISE EXCEPTION 'pioneer_not_eligible'; END IF;
  -- Prevent the qualifying order from being changed while its gift is credited.
  PERFORM 1 FROM public.orders WHERE id=order_id FOR SHARE;
  IF public.kq_pioneer_qualifying_order(p_user_id) IS DISTINCT FROM order_id THEN
    RAISE EXCEPTION 'pioneer_not_eligible';
  END IF;
  state := public.rpc_kq_pioneer_pack_state(p_user_id);
  IF NOT (state->>'available')::BOOLEAN THEN RAISE EXCEPTION 'pioneer_unavailable'; END IF;
  SELECT count(*) INTO gold_count FROM public.lottery_card_definitions d
    JOIN public.lottery_card_collections c ON c.id=d.collection_id
    WHERE c.code='HEMP_HEROES_2026' AND c.is_active AND d.is_active AND d.rarity='gold';
  gold_offset := public.lottery_secure_random_int(0,gold_count-1);
  SELECT d.id INTO gold_id FROM public.lottery_card_definitions d
    JOIN public.lottery_card_collections c ON c.id=d.collection_id
    WHERE c.code='HEMP_HEROES_2026' AND c.is_active AND d.is_active AND d.rarity='gold'
    ORDER BY d.card_number,d.id LIMIT 1 OFFSET gold_offset;
  SELECT id INTO special_id FROM public.lottery_card_definitions WHERE code='PIONEER-2026-001';
  IF gold_id IS NULL OR special_id IS NULL THEN RAISE EXCEPTION 'pioneer_unavailable'; END IF;
  INSERT INTO public.kq_pioneer_pack_grants(user_id,qualifying_order_id,gold_card_id,special_card_id)
    VALUES(p_user_id,order_id,gold_id,special_id) RETURNING id INTO grant_id;
  INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+100000,updated_at=now() WHERE user_id=p_user_id;
  INSERT INTO public.lottery_card_instances(user_id,card_definition_id,pack_slot,pioneer_grant_id)
    VALUES(p_user_id,gold_id,1,grant_id),(p_user_id,special_id,2,grant_id);
  INSERT INTO public.kq_support_booster_entitlements(user_id,source,reward_key,card_count)
    SELECT p_user_id,'pioneer_pack','kq-pioneer:2026:'||p_user_id::TEXT||':'||n,10 FROM generate_series(1,10) n;
  RETURN public.rpc_kq_pioneer_pack_state(p_user_id)||jsonb_build_object('replayed',false);
END;
$$;

-- Bounded resumable backfill. Preview is the default. Re-running cannot duplicate gifts.
CREATE FUNCTION public.rpc_kq_pioneer_pack_batch(p_after UUID DEFAULT NULL,p_limit INTEGER DEFAULT 100,p_apply BOOLEAN DEFAULT false)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u RECORD; state JSONB; processed INTEGER:=0; eligible INTEGER:=0; granted INTEGER:=0;
  already_granted INTEGER:=0; unavailable INTEGER:=0; cursor_id UUID; more BOOLEAN;
BEGIN
  IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'pioneer_invalid_limit'; END IF;
  FOR u IN SELECT id FROM auth.users WHERE p_after IS NULL OR id>p_after ORDER BY id LIMIT p_limit LOOP
    processed:=processed+1; cursor_id:=u.id;
    state:=public.rpc_kq_pioneer_pack_state(u.id);
    IF (state->>'claimed')::BOOLEAN THEN already_granted:=already_granted+1;
    ELSIF (state->>'eligible')::BOOLEAN THEN
      eligible:=eligible+1;
      IF NOT (state->>'available')::BOOLEAN THEN unavailable:=unavailable+1;
      ELSIF p_apply IS TRUE THEN
        state:=public.rpc_kq_claim_pioneer_pack(u.id);
        IF (state->>'replayed')::BOOLEAN THEN already_granted:=already_granted+1;
        ELSE granted:=granted+1; END IF;
      END IF;
    END IF;
  END LOOP;
  more := cursor_id IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users WHERE id>cursor_id);
  RETURN jsonb_build_object('processed',processed,'eligible',eligible,'granted',granted,
    'alreadyGranted',already_granted,'unavailable',unavailable,'nextCursor',CASE WHEN more THEN cursor_id ELSE NULL END);
END;
$$;

REVOKE ALL ON FUNCTION public.kq_pioneer_qualifying_order(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.rpc_kq_pioneer_pack_state(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.rpc_kq_claim_pioneer_pack(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.rpc_kq_pioneer_pack_batch(UUID,INTEGER,BOOLEAN) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kq_pioneer_qualifying_order(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_pioneer_pack_state(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_claim_pioneer_pack(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_pioneer_pack_batch(UUID,INTEGER,BOOLEAN) TO service_role;
COMMIT;
