BEGIN;

-- Preserve any historical gifts without topping them up or granting a second pack.
ALTER TABLE public.kq_pioneer_pack_grants
  DROP CONSTRAINT kq_pioneer_pack_grants_cash_cents_check,
  ALTER COLUMN cash_cents SET DEFAULT 500000,
  ADD CONSTRAINT kq_pioneer_pack_grants_cash_cents_check
    CHECK (cash_cents IN (100000, 500000));

UPDATE public.lottery_card_definitions
SET description = 'Carte souvenir holographique exclusive du Pack des Pionniers 2026. Merci de faire grandir l''aventure.'
WHERE code = 'PIONEER-2026-001';

CREATE OR REPLACE FUNCTION public.rpc_kq_pioneer_pack_state(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE g public.kq_pioneer_pack_grants%ROWTYPE; buddie JSONB; ready BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN
    RAISE EXCEPTION 'pioneer_invalid_user';
  END IF;
  SELECT * INTO g FROM public.kq_pioneer_pack_grants WHERE user_id=p_user_id;
  IF FOUND THEN
    SELECT jsonb_build_object('code',code,'name',name,'imageUrl',image_url,'rarity',rarity) INTO buddie
      FROM public.lottery_card_definitions WHERE id=g.gold_card_id;
    -- The legacy goldCard key and gold_card_id column also carry epic Buddies.
    RETURN jsonb_build_object('eligible',true,'claimed',true,'available',true,
      'grantedAt',g.granted_at,'cashCents',g.cash_cents,'packCount',g.pack_count,'goldCard',buddie);
  END IF;
  ready := EXISTS(SELECT 1 FROM public.lottery_card_collections WHERE code='BOTTE_DU_CHANVRIER_2026' AND is_active)
    AND EXISTS(SELECT 1 FROM public.lottery_card_definitions d JOIN public.lottery_card_collections c ON c.id=d.collection_id
      WHERE c.code='HEMP_HEROES_2026' AND c.is_active AND d.is_active AND d.rarity='gold')
    AND EXISTS(SELECT 1 FROM public.lottery_card_definitions d JOIN public.lottery_card_collections c ON c.id=d.collection_id
      WHERE c.code='HEMP_HEROES_2026' AND c.is_active AND d.is_active AND d.rarity='epic')
    AND EXISTS(SELECT 1 FROM public.lottery_card_definitions WHERE code='PIONEER-2026-001');
  RETURN jsonb_build_object('eligible',public.kq_pioneer_qualifying_order(p_user_id) IS NOT NULL,
    'claimed',false,'available',ready,'grantedAt',NULL,'cashCents',500000,'packCount',10,'goldCard',NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_claim_pioneer_pack(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE order_id TEXT; buddie_id UUID; special_id UUID; grant_id UUID;
  buddie_count INTEGER; buddie_offset INTEGER; buddie_rarity public.lottery_card_rarity; state JSONB;
BEGIN
  IF now() < TIMESTAMPTZ '2026-10-15 00:00:00 Europe/Paris' THEN
    RAISE EXCEPTION 'pioneer_not_open';
  END IF;
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

  -- Choose the rarity first so catalogue sizes cannot alter the 90% / 10% split.
  buddie_rarity := CASE WHEN public.lottery_secure_random_int(1,10) <= 9
    THEN 'gold'::public.lottery_card_rarity ELSE 'epic'::public.lottery_card_rarity END;
  SELECT count(*) INTO buddie_count FROM public.lottery_card_definitions d
    JOIN public.lottery_card_collections c ON c.id=d.collection_id
    WHERE c.code='HEMP_HEROES_2026' AND c.is_active AND d.is_active AND d.rarity=buddie_rarity;
  IF buddie_count=0 THEN RAISE EXCEPTION 'pioneer_unavailable'; END IF;
  buddie_offset := public.lottery_secure_random_int(0,buddie_count-1);
  SELECT d.id INTO buddie_id FROM public.lottery_card_definitions d
    JOIN public.lottery_card_collections c ON c.id=d.collection_id
    WHERE c.code='HEMP_HEROES_2026' AND c.is_active AND d.is_active AND d.rarity=buddie_rarity
    ORDER BY d.card_number,d.id LIMIT 1 OFFSET buddie_offset;
  SELECT id INTO special_id FROM public.lottery_card_definitions WHERE code='PIONEER-2026-001';
  IF buddie_id IS NULL OR special_id IS NULL THEN RAISE EXCEPTION 'pioneer_unavailable'; END IF;

  INSERT INTO public.kq_pioneer_pack_grants(user_id,qualifying_order_id,gold_card_id,special_card_id,cash_cents)
    VALUES(p_user_id,order_id,buddie_id,special_id,500000) RETURNING id INTO grant_id;
  INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+500000,updated_at=now() WHERE user_id=p_user_id;
  INSERT INTO public.lottery_card_instances(user_id,card_definition_id,pack_slot,pioneer_grant_id)
    VALUES(p_user_id,buddie_id,1,grant_id),(p_user_id,special_id,2,grant_id);
  INSERT INTO public.kq_support_booster_entitlements(user_id,source,reward_key,card_count)
    SELECT p_user_id,'pioneer_pack','kq-pioneer:2026:'||p_user_id::TEXT||':'||n,10 FROM generate_series(1,10) n;
  RETURN public.rpc_kq_pioneer_pack_state(p_user_id)||jsonb_build_object('replayed',false);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_pioneer_pack_state(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.rpc_kq_claim_pioneer_pack(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_pioneer_pack_state(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_claim_pioneer_pack(UUID) TO service_role;

COMMIT;
