-- Distribution starts at the game opening, including service-role batch calls.
BEGIN;
CREATE OR REPLACE FUNCTION public.rpc_kq_claim_pioneer_pack(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE order_id TEXT; gold_id UUID; special_id UUID; grant_id UUID; gold_count INTEGER; gold_offset INTEGER; state JSONB;
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

COMMIT;
