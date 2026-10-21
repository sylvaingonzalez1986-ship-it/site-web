BEGIN;

-- The original welcome claim did not record which ordinary ticket it created.
-- Only new, explicitly linked tickets use the guaranteed starter opening.
ALTER TABLE public.lottery_welcome_pack_claims
  ADD COLUMN ticket_id UUID UNIQUE REFERENCES public.lottery_tickets(id) ON DELETE RESTRICT,
  ADD COLUMN opening_result JSONB,
  ADD CONSTRAINT lottery_welcome_opening_result_check CHECK (
    opening_result IS NULL OR (ticket_id IS NOT NULL AND jsonb_typeof(opening_result)='object')
  );
REVOKE ALL ON TABLE public.lottery_welcome_pack_claims FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.lottery_welcome_pack_claims TO service_role;

-- The playable catalogue currently contains HH2026-001 through HH2026-052.
-- Its commons are 020 through 052 (KQ_BUDDIES in kanab-quest-game.ts).
-- An unrelated active collection or an arbitrary future HH code is not eligible.
CREATE FUNCTION public.kq_starter_buddie_catalog()
RETURNS SETOF public.lottery_card_definitions
LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT d.* FROM public.lottery_card_definitions d
  JOIN public.lottery_card_collections c ON c.id=d.collection_id
  WHERE c.code='HEMP_HEROES_2026' AND c.is_active AND d.is_active
    AND d.rarity='common' AND d.card_number BETWEEN 20 AND 52
    AND d.code='HH2026-'||lpad(d.card_number::TEXT,3,'0')
$$;
REVOKE ALL ON FUNCTION public.kq_starter_buddie_catalog() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.rpc_claim_welcome_pack(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE claimed UUID; number INTEGER; ticket UUID;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'invalid_user_id'; END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'customer_not_found'; END IF;

  INSERT INTO public.lottery_welcome_pack_claims(user_id) VALUES(p_user_id)
  ON CONFLICT(user_id) DO NOTHING RETURNING user_id INTO claimed;
  IF claimed IS NULL THEN RETURN FALSE; END IF;
  IF (SELECT count(*) FROM public.kq_starter_buddie_catalog())<3 THEN
    RAISE EXCEPTION 'starter_buddies_unavailable';
  END IF;

  -- Same global counter lock as every ordinary ticket grant. Capture the exact
  -- INSERT result; never infer the welcome ticket from timestamps or ordering.
  PERFORM pg_advisory_xact_lock(hashtextextended('lottery_ticket_counter',0));
  INSERT INTO public.lottery_ticket_counter(id,next_number) VALUES(1,1) ON CONFLICT(id) DO NOTHING;
  UPDATE public.lottery_ticket_counter SET next_number=next_number+1 WHERE id=1
    RETURNING next_number-1 INTO number;
  INSERT INTO public.lottery_tickets(user_id,order_id,ticket_number,order_amount,status)
    VALUES(p_user_id,NULL,'TICKET-'||lpad(number::TEXT,8,'0'),0,'available') RETURNING id INTO ticket;
  UPDATE public.lottery_welcome_pack_claims SET ticket_id=ticket WHERE user_id=p_user_id;
  INSERT INTO public.lottery_audit_log(event_type,user_id,ticket_id,details)
    VALUES('welcome_pack_granted',p_user_id,ticket,jsonb_build_object('kind','starter-buddies','cardCount',3));
  RETURN TRUE;
END $$;
REVOKE ALL ON FUNCTION public.rpc_claim_welcome_pack(UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_claim_welcome_pack(UUID) TO service_role;

-- Preserve the ordinary implementation byte for byte, including bonus draws,
-- quotas and errors. Fail the migration if its expected latest shape changed.
DO $$ DECLARE body TEXT; BEGIN
  body:=pg_get_functiondef('public.rpc_scratch_ticket(uuid,uuid)'::regprocedure);
  IF strpos(body,'FOR v_pack_slot IN 1..3 LOOP')=0
    OR strpos(body,'IF v_bonus_won AND v_pack_slot = v_bonus_slot THEN')=0
    OR strpos(body,'UPDATE public.lottery_draw_cycles')=0
    OR strpos(body,'v_primary_owned_count')=0 THEN
    RAISE EXCEPTION 'starter_buddies_scratch_function_drift';
  END IF;
END $$;
ALTER FUNCTION public.rpc_scratch_ticket(UUID,UUID) RENAME TO kq_scratch_ordinary_ticket;
REVOKE ALL ON FUNCTION public.kq_scratch_ordinary_ticket(UUID,UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_scratch_ticket(p_ticket_id UUID,p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  ticket public.lottery_tickets%ROWTYPE;
  collection public.lottery_card_collections%ROWTYPE;
  card public.lottery_card_definitions%ROWTYPE;
  cards JSONB:='[]'; result JSONB; saved JSONB; inventory JSONB;
  slot INTEGER:=0; copies INTEGER; opened_at TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.lottery_welcome_pack_claims
    WHERE user_id=p_user_id AND ticket_id=p_ticket_id) THEN
    RETURN public.kq_scratch_ordinary_ticket(p_ticket_id,p_user_id);
  END IF;
  SELECT * INTO ticket FROM public.lottery_tickets
    WHERE id=p_ticket_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found_or_already_scratched'; END IF;
  SELECT opening_result INTO saved FROM public.lottery_welcome_pack_claims
    WHERE user_id=p_user_id AND ticket_id=p_ticket_id FOR UPDATE;
  IF saved IS NOT NULL THEN RETURN saved; END IF;
  IF ticket.status<>'available' THEN RAISE EXCEPTION 'ticket_not_found_or_already_scratched'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.lottery_game_config WHERE id=1 AND is_active) THEN
    RAISE EXCEPTION 'lottery_inactive';
  END IF;
  SELECT * INTO collection FROM public.lottery_card_collections
    WHERE code='HEMP_HEROES_2026' AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'starter_buddies_unavailable'; END IF;

  -- Sampling definitions without replacement guarantees three varieties. This
  -- pack has no bonus replacement and never reads or mutates an ordinary cycle.
  FOR card IN SELECT * FROM public.kq_starter_buddie_catalog()
    ORDER BY public.lottery_secure_random_int(0,2147483646),code LIMIT 3
  LOOP
    slot:=slot+1;
    INSERT INTO public.lottery_card_instances(user_id,ticket_id,pack_slot,card_definition_id)
      VALUES(p_user_id,ticket.id,slot,card.id);
    SELECT count(*) INTO copies FROM public.lottery_card_instances
      WHERE user_id=p_user_id AND card_definition_id=card.id;
    cards:=cards||jsonb_build_array(jsonb_build_object(
      'id',card.id,'definitionId',card.id,'collectionId',collection.id,
      'collectionCode',collection.code,'collectionTitle',collection.title,
      'code',card.code,'cardNumber',card.card_number,'name',card.name,'rarity',card.rarity,
      'visualPrompt',card.visual_prompt,'description',card.description,'imageUrl',card.image_url,
      'ownedCount',copies,'packSlot',slot,'isBonus',false));
  END LOOP;
  IF slot<>3 THEN RAISE EXCEPTION 'starter_buddies_unavailable'; END IF;

  opened_at:=now();
  UPDATE public.lottery_tickets SET status='scratched',scratched_at=opened_at,
    card_definition_id=(cards->0->>'definitionId')::UUID,card_rarity='common',
    sticker_id=NULL,sticker_rarity=NULL,legendary_reward_claim_id=NULL WHERE id=ticket.id;
  -- Match the existing response's account-wide counts and primary-card shape.
  SELECT jsonb_build_object(
    'totalCards',(SELECT count(*) FROM public.lottery_card_definitions WHERE collection_id=collection.id),
    'uniqueOwned',count(DISTINCT i.card_definition_id),'totalOwnedCopies',count(*),
    'duplicateCopies',count(*)-count(DISTINCT i.card_definition_id),
    'common',count(*) FILTER(WHERE d.rarity='common'),'silver',count(*) FILTER(WHERE d.rarity='silver'),
    'gold',count(*) FILTER(WHERE d.rarity='gold'),'epic',count(*) FILTER(WHERE d.rarity='epic'),
    'legendary',count(*) FILTER(WHERE d.rarity='legendary')) INTO inventory
  FROM public.lottery_card_instances i JOIN public.lottery_card_definitions d ON d.id=i.card_definition_id
  WHERE i.user_id=p_user_id;
  result:=jsonb_build_object('ticketId',ticket.id,'ticketNumber',ticket.ticket_number,'scratchedAt',opened_at,
    'card',(cards->0)-'packSlot','cards',cards,'inventory',inventory,'bonusPrize',NULL);
  UPDATE public.lottery_welcome_pack_claims SET opening_result=result
    WHERE user_id=p_user_id AND ticket_id=ticket.id;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.rpc_scratch_ticket(UUID,UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_scratch_ticket(UUID,UUID) TO service_role;

-- One-time repair of historical welcome claims. Do not manufacture an opened
-- pack or rewrite old draws: these additional commons have their own source.
CREATE TABLE public.kq_starter_buddie_recoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  card_definition_ids UUID[] NOT NULL CHECK(cardinality(card_definition_ids) BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kq_starter_buddie_recoveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_starter_buddie_recoveries FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.lottery_card_instances ADD COLUMN starter_buddie_recovery_id UUID
  REFERENCES public.kq_starter_buddie_recoveries(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX lottery_card_instances_starter_recovery_card
  ON public.lottery_card_instances(starter_buddie_recovery_id,card_definition_id)
  WHERE starter_buddie_recovery_id IS NOT NULL;
ALTER TABLE public.lottery_card_instances DROP CONSTRAINT lottery_card_instances_source_required;
ALTER TABLE public.lottery_card_instances ADD CONSTRAINT lottery_card_instances_source_required CHECK (
  ticket_id IS NOT NULL OR kq_support_entitlement_id IS NOT NULL OR source_bot_battle_id IS NOT NULL
  OR pioneer_grant_id IS NOT NULL OR producer_purchase_buddie_grant_id IS NOT NULL
  OR community_mission_reward_id IS NOT NULL OR contest_bundle_order_id IS NOT NULL
  OR game_mission_reward_id IS NOT NULL OR starter_buddie_recovery_id IS NOT NULL
);

-- DDL already excludes concurrent card writes during this transaction. Keep the
-- repair in the migration only: no repeatable repair RPC or client eligibility.
DO $$
DECLARE claimant RECORD; owned INTEGER; chosen UUID[]; receipt UUID;
BEGIN
  FOR claimant IN SELECT user_id FROM public.lottery_welcome_pack_claims WHERE ticket_id IS NULL LOOP
    SELECT count(DISTINCT d.id) INTO owned FROM public.lottery_card_instances i
    JOIN public.lottery_card_definitions d ON d.id=i.card_definition_id
    JOIN public.lottery_card_collections c ON c.id=d.collection_id
    WHERE i.user_id=claimant.user_id AND c.code='HEMP_HEROES_2026' AND c.is_active AND d.is_active
      AND d.card_number BETWEEN 1 AND 52 AND d.code='HH2026-'||lpad(d.card_number::TEXT,3,'0');
    IF owned>=3 THEN CONTINUE; END IF;
    SELECT array_agg(id ORDER BY code) INTO chosen FROM (
      SELECT d.id,d.code FROM public.kq_starter_buddie_catalog() d
      WHERE NOT EXISTS(SELECT 1 FROM public.lottery_card_instances i
        WHERE i.user_id=claimant.user_id AND i.card_definition_id=d.id)
      ORDER BY d.code LIMIT 3-owned
    ) candidates;
    IF COALESCE(cardinality(chosen),0)<>3-owned THEN RAISE EXCEPTION 'starter_buddies_unavailable'; END IF;
    INSERT INTO public.kq_starter_buddie_recoveries(user_id,card_definition_ids)
      VALUES(claimant.user_id,chosen) ON CONFLICT(user_id) DO NOTHING RETURNING id INTO receipt;
    IF receipt IS NOT NULL THEN
      INSERT INTO public.lottery_card_instances(user_id,pack_slot,card_definition_id,starter_buddie_recovery_id)
        SELECT claimant.user_id,ordinality,id,receipt FROM unnest(chosen) WITH ORDINALITY AS cards(id,ordinality);
    END IF;
  END LOOP;
END $$;

COMMIT;
