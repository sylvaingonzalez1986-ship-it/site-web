BEGIN;

CREATE FUNCTION public.kq_korrigan_odds()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT '{"loss":8500,"x5":320,"x10":80,"x50":3,"epic":2,"botte":1000,"buddie":95}'::jsonb;
$$;

CREATE TABLE public.kq_korrigan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  lot_id uuid NOT NULL,
  grams integer NOT NULL CHECK (grams > 0),
  value_cents bigint NOT NULL CHECK (value_cents > 0),
  odds jsonb NOT NULL DEFAULT public.kq_korrigan_odds(),
  offered_at timestamptz NOT NULL,
  next_offer_at timestamptz NOT NULL CHECK (next_offer_at > offered_at),
  UNIQUE (user_id, request_id)
);
CREATE INDEX kq_korrigan_sessions_latest ON public.kq_korrigan_sessions(user_id, offered_at DESC, id DESC);
ALTER TABLE public.kq_korrigan_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_korrigan_sessions FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.kq_korrigan_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.kq_korrigan_sessions(id) ON DELETE CASCADE,
  draw_index smallint NOT NULL CHECK (draw_index BETWEEN 1 AND 3),
  kind text NOT NULL CHECK (kind IN ('loss', 'x5', 'x10', 'x50', 'epic', 'botte', 'buddie')),
  money_cents bigint NOT NULL CHECK (money_cents >= 0),
  item_label text,
  card_definition_id uuid REFERENCES public.lottery_card_definitions(id),
  awarded_at timestamptz,
  UNIQUE (session_id, draw_index)
);
CREATE INDEX kq_korrigan_draws_pending ON public.kq_korrigan_draws(session_id, draw_index) WHERE awarded_at IS NULL;
ALTER TABLE public.kq_korrigan_draws ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_korrigan_draws FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.lottery_card_instances ADD COLUMN korrigan_draw_id uuid
  REFERENCES public.kq_korrigan_draws(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX lottery_card_instances_korrigan_draw
  ON public.lottery_card_instances(korrigan_draw_id) WHERE korrigan_draw_id IS NOT NULL;
ALTER TABLE public.lottery_card_instances DROP CONSTRAINT lottery_card_instances_source_required;
ALTER TABLE public.lottery_card_instances ADD CONSTRAINT lottery_card_instances_source_required CHECK (
  ticket_id IS NOT NULL OR kq_support_entitlement_id IS NOT NULL OR source_bot_battle_id IS NOT NULL
  OR pioneer_grant_id IS NOT NULL OR producer_purchase_buddie_grant_id IS NOT NULL
  OR community_mission_reward_id IS NOT NULL OR contest_bundle_order_id IS NOT NULL
  OR game_mission_reward_id IS NOT NULL OR starter_buddie_recovery_id IS NOT NULL OR korrigan_draw_id IS NOT NULL
);

ALTER TABLE public.kq_support_booster_entitlements DROP CONSTRAINT kq_support_booster_entitlements_source_check;
ALTER TABLE public.kq_support_booster_entitlements ADD CONSTRAINT kq_support_booster_entitlements_source_check CHECK (
  source IN ('ticket','arena_streak','notebook_badge','season_reward','points_purchase','welcome_pack',
    'pvp_win','notebook_flower','mission','achievement','pioneer_pack','contest_bundle','arena_feedback','korrigan_market')
);

-- The normal sale validates the same tariff, aroma premium and cumulative rounding.
CREATE FUNCTION public.kq_customer_demand_professional_quote(
  p_user uuid, p_stock public.kq_commerce_stock, p_channel text, p_quality numeric,
  p_event text, p_multiplier numeric, p_units integer, p_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE matched jsonb; base numeric; tariff numeric; exact numeric; partners integer; percent numeric;
BEGIN
  matched := public.kq_customer_demand_match(p_user,p_stock.id,p_channel,p_quality,p_units,p_at);
  IF p_stock.route='raw' THEN
    base := public.kq_online_raw_professional_price(p_channel,p_quality,p_event,p_stock.base_unit_cents,p_multiplier);
  ELSE
    IF p_channel='cbd-shop' THEN
      SELECT COALESCE(c.shop_partners_start,0) INTO partners FROM public.kq_commerce_accounts a
      LEFT JOIN public.kq_commerce_campaigns c ON c.run_id=a.current_run_id AND c.user_id=a.user_id WHERE a.user_id=p_user;
      percent := CASE WHEN p_quality>=9.5 THEN 55 WHEN p_quality>=9 THEN 50 WHEN p_quality>=8 THEN 45 ELSE 40 END
        + CASE WHEN partners>=12 THEN 4 WHEN partners>=8 THEN 3 WHEN partners>=4 THEN 2 WHEN partners>=1 THEN 1 ELSE 0 END;
    ELSE
      percent := CASE p_event WHEN 'promotion' THEN 25 WHEN 'restock' THEN 33 ELSE 30 END;
    END IF;
    base := round(p_stock.base_unit_cents*p_multiplier*percent/100,6);
  END IF;
  tariff := round(base*(1+COALESCE((matched->>'bonusPercent')::numeric*(matched->>'units')::numeric/NULLIF(p_units,0)/100,0)),6);
  exact := round(p_stock.payout_exact+p_units*tariff/10,6);
  RETURN jsonb_build_object('customerDemand',matched,'unitCents',tariff,'payoutExactAfter',exact,
    'payoutRoundedAfter',round(exact),'payoutCents',round(exact)-p_stock.payout_rounded);
END $$;

CREATE OR REPLACE FUNCTION public.kq_customer_demand_validate_sale(
  p_user uuid, p_stock public.kq_commerce_stock, p_offer jsonb,
  p_quality numeric, p_event text, p_multiplier numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE units integer := (p_offer->>'units')::integer; channel text := p_offer->>'channel'; quote jsonb;
BEGIN
  IF p_stock.route='biomass' OR channel NOT IN ('cbd-shop','wholesale') THEN RETURN; END IF;
  quote := public.kq_customer_demand_professional_quote(p_user,p_stock,channel,p_quality,p_event,p_multiplier,units,now());
  IF units IS NULL OR units<=0
    OR NULLIF(p_offer->'customerDemand','null'::jsonb) IS DISTINCT FROM NULLIF(quote->'customerDemand','null'::jsonb)
    OR round((p_offer->>'unitCents')::numeric,6) IS DISTINCT FROM (quote->>'unitCents')::numeric
    OR (p_offer->>'payoutExactAfter')::numeric IS DISTINCT FROM (quote->>'payoutExactAfter')::numeric
    OR (p_offer->>'payoutRoundedAfter')::numeric IS DISTINCT FROM (quote->>'payoutRoundedAfter')::numeric
    OR (p_offer->>'payoutCents')::numeric IS DISTINCT FROM (quote->>'payoutCents')::numeric
  THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
  PERFORM public.kq_customer_demand_consume(p_user,channel,NULLIF(quote->'customerDemand','null'::jsonb));
END $$;

CREATE FUNCTION public.kq_korrigan_clock(p_origin timestamptz, p_at timestamptz, p_clock jsonb)
RETURNS TABLE(is_night boolean,next_open_at timestamptz)
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  day_ms integer := (p_clock->>'dayMs')::integer;
  dawn_minute integer := (p_clock->>'dawn')::integer;
  night_minute integer := (p_clock->>'night')::integer;
  elapsed_ms numeric;
  day_base_ms numeric;
  minute_of_day numeric;
BEGIN
  IF day_ms IS NULL OR day_ms<=0 OR dawn_minute IS NULL OR night_minute IS NULL
    OR dawn_minute<0 OR night_minute<=dawn_minute OR night_minute>=1440
  THEN RAISE EXCEPTION 'korrigan_invalid'; END IF;
  IF p_origin IS NULL THEN
    RETURN QUERY SELECT false, NULL::timestamptz;
    RETURN;
  END IF;
  elapsed_ms := GREATEST(0,extract(epoch FROM (p_at-p_origin))*1000);
  day_base_ms := floor(elapsed_ms/day_ms)*day_ms;
  minute_of_day := floor((elapsed_ms-day_base_ms)*1440/day_ms);
  RETURN QUERY SELECT minute_of_day<dawn_minute OR minute_of_day>=night_minute,
    p_origin + (day_base_ms + CASE WHEN minute_of_day>=night_minute THEN day_ms ELSE 0 END
      + day_ms::numeric*night_minute/1440) * interval '1 millisecond';
END $$;

CREATE FUNCTION public.kq_korrigan_lots(p_user uuid, p_at timestamptz)
RETURNS TABLE(stock_id uuid,label text,available_grams integer,quality numeric,event text,multiplier numeric)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT stock.id, flower.variety_name, available.grams, projected.quality, campaign.event,
    CASE WHEN profile.strength='merchant' THEN 1.5 ELSE 1 END
  FROM public.kq_commerce_accounts account
  JOIN public.kq_commerce_campaigns campaign ON campaign.run_id=account.current_run_id AND campaign.user_id=account.user_id
  JOIN public.kq_commerce_stock stock ON stock.user_id=account.user_id
  JOIN public.kq_flowers flower ON flower.id=stock.flower_id AND flower.owner_id=stock.user_id
  JOIN public.kq_market_lots lot ON lot.flower_id=stock.flower_id AND lot.owner_id=stock.user_id
  JOIN public.kq_commerce_batches batch ON batch.flower_id=stock.flower_id AND batch.user_id=stock.user_id
  JOIN public.kq_storage_lots storage ON storage.flower_id=stock.flower_id AND storage.user_id=stock.user_id
  LEFT JOIN public.arena_chanvrier_profiles profile ON profile.user_id=account.user_id
  CROSS JOIN LATERAL (
    SELECT (public.kq_storage_condition(storage.state,lot.jury_score,p_at)->>'conditionScore')::numeric AS quality
  ) projected
  CROSS JOIN LATERAL (
    SELECT (public.kq_commerce_capacity(p_user)->>'cbd-shop')::numeric *
      (1-GREATEST(0,account.shop_demand_debt-GREATEST(0,extract(epoch FROM p_at-account.demand_updated_at))/43200)) AS capacity
  ) orders
  CROSS JOIN LATERAL (
    SELECT (LEAST(stock.remaining_units,floor(orders.capacity*stock.initial_units/stock.equivalent_units+0.00000001))::integer/10) AS grams
  ) available
  -- The online pack preparation subtracts its reserved quantities from remaining_units.
  WHERE account.user_id=p_user AND stock.route='raw' AND stock.remaining_units>=10
    AND flower.status::text='burned' AND (storage.state->>'readyAt')::timestamptz<=p_at
    AND (stock.route<>batch.route OR batch.processing_ready_at IS NULL OR batch.processing_ready_at<=p_at)
    AND (storage.state#>>'{capacity,totalUnits}')::integer <= COALESCE((
      SELECT sum((allocation->>'storedUnits')::integer)
      FROM jsonb_array_elements(storage.state#>'{capacity,allocations}') allocation
    ),0)
    AND projected.quality>=6.5 AND orders.capacity IS NOT NULL AND available.grams>0;
$$;

CREATE FUNCTION public.kq_korrigan_draw_kind(p_roll integer, p_odds jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT kind FROM (
    SELECT kind,position,sum((p_odds->>kind)::integer) OVER (ORDER BY position) AS upper_bound
    FROM unnest(ARRAY['loss','x5','x10','x50','epic','botte','buddie']) WITH ORDINALITY AS draw(kind,position)
  ) bounds WHERE p_roll BETWEEN 1 AND upper_bound ORDER BY position LIMIT 1;
$$;

CREATE FUNCTION public.kq_korrigan_award(p_user uuid, p_draw_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  prize public.kq_korrigan_draws%ROWTYPE;
  card_ids uuid[];
  card_id uuid;
  source_key text := 'korrigan:'||p_draw_id::text;
BEGIN
  SELECT draw.* INTO prize
  FROM public.kq_korrigan_draws draw
  JOIN public.kq_korrigan_sessions session ON session.id=draw.session_id
  WHERE draw.id=p_draw_id AND session.user_id=p_user AND draw.awarded_at IS NULL
  FOR UPDATE OF draw;
  IF NOT FOUND THEN RETURN; END IF;

  IF prize.kind='epic' AND prize.card_definition_id IS NULL THEN
    SELECT array_agg(card.id ORDER BY card.id) INTO card_ids
    FROM public.lottery_card_definitions card
    JOIN public.lottery_card_collections collection ON collection.id=card.collection_id
    WHERE collection.code='HEMP_HEROES_2026' AND collection.is_active
      AND card.is_active AND card.rarity='epic' AND card.card_number BETWEEN 1 AND 52
      AND card.code='HH2026-'||lpad(card.card_number::text,3,'0');
    IF COALESCE(cardinality(card_ids),0)=0 THEN RETURN; END IF;
    card_id := card_ids[public.lottery_secure_random_int(1,cardinality(card_ids))];
    UPDATE public.kq_korrigan_draws draw SET card_definition_id=card.id,item_label=card.name
    FROM public.lottery_card_definitions card
    WHERE draw.id=prize.id AND card.id=card_id
    RETURNING draw.* INTO prize;
  END IF;

  -- The decided draw and any selected epic survive a failed award. Only the
  -- delivery writes are rolled back together, so a retry never rolls again.
  BEGIN
    CASE prize.kind
      WHEN 'loss' THEN NULL;
      WHEN 'epic' THEN
        INSERT INTO public.lottery_card_instances(user_id,card_definition_id,pack_slot,korrigan_draw_id)
          VALUES(p_user,prize.card_definition_id,1,prize.id);
      WHEN 'botte' THEN
        INSERT INTO public.kq_support_booster_entitlements(user_id,source,reward_key,card_count)
          VALUES(p_user,'korrigan_market',source_key,10);
      WHEN 'buddie' THEN
        IF NOT EXISTS(SELECT 1 FROM public.lottery_game_config WHERE id=1 AND is_active)
          OR (SELECT code FROM public.lottery_card_collections WHERE is_active ORDER BY created_at LIMIT 1)
            IS DISTINCT FROM 'HEMP_HEROES_2026'
        THEN RETURN; END IF;
        IF public.rpc_admin_grant_lottery_tickets(p_user,1,'Marché des korrigans - '||prize.id,'korrigans@system.local')<>1
        THEN RAISE EXCEPTION 'korrigan_buddie_grant_failed'; END IF;
      ELSE
        PERFORM public.kq_treasury_initialize(p_user);
        UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+prize.money_cents,updated_at=clock_timestamp()
        WHERE user_id=p_user;
        IF NOT FOUND THEN RAISE EXCEPTION 'korrigan_wallet_unavailable'; END IF;
        PERFORM public.kq_treasury_pair(p_user,'reward',source_key,clock_timestamp(),
          'suspense','revenue_rewards',prize.money_cents,'Marché des korrigans');
    END CASE;
    UPDATE public.kq_korrigan_draws SET awarded_at=clock_timestamp() WHERE id=prize.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Marché des korrigans : attribution différée pour le tirage % (%): %',prize.id,SQLSTATE,SQLERRM;
  END;
END $$;

CREATE FUNCTION public.kq_korrigan_market(
  p_user_id uuid, p_action text, p_clock jsonb, p_lot_id uuid DEFAULT NULL, p_grams integer DEFAULT NULL,
  p_request_id uuid DEFAULT NULL, p_session_id uuid DEFAULT NULL, p_draw integer DEFAULT NULL,
  p_expected_value_cents bigint DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  minimum_value_cents constant bigint := 10000;
  session public.kq_korrigan_sessions%ROWTYPE;
  latest public.kq_korrigan_sessions%ROWTYPE;
  stock public.kq_commerce_stock%ROWTYPE;
  prize public.kq_korrigan_draws%ROWTYPE;
  selected record;
  pending_id uuid;
  origin timestamptz;
  moment timestamptz;
  night boolean;
  next_open_at timestamptz;
  draw_kind text;
  lots jsonb;
  quote jsonb;
  value_cents bigint;
  response jsonb;
BEGIN
  IF p_user_id IS NULL OR p_action IS NULL OR p_action NOT IN ('state','quote','offer','draw')
    OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id)
    OR (p_action IN ('quote','offer') AND (p_lot_id IS NULL OR p_grams IS NULL OR p_grams NOT BETWEEN 1 AND 214748364))
    OR (p_action='offer' AND (p_request_id IS NULL OR p_expected_value_cents IS NULL))
    OR (p_action='draw' AND (p_session_id IS NULL OR p_draw IS NULL OR p_draw NOT BETWEEN 1 AND 3))
  THEN RAISE EXCEPTION 'korrigan_invalid'; END IF;

  -- All commerce, online listings and warehouse stock changes share this lock.
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::text,0));
  SELECT * INTO latest FROM public.kq_korrigan_sessions WHERE user_id=p_user_id
    ORDER BY offered_at DESC,id DESC LIMIT 1;
  IF p_action='offer' THEN
    SELECT * INTO session FROM public.kq_korrigan_sessions WHERE user_id=p_user_id AND request_id=p_request_id;
    IF FOUND AND (session.lot_id<>p_lot_id OR session.grams<>p_grams OR session.value_cents<>p_expected_value_cents)
    THEN RAISE EXCEPTION 'korrigan_request_conflict'; END IF;
  ELSIF p_action='draw' THEN
    SELECT * INTO session FROM public.kq_korrigan_sessions WHERE id=p_session_id AND user_id=p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'korrigan_session_not_found'; END IF;
  ELSE
    session := latest;
  END IF;

  IF p_action='quote' OR (p_action='offer' AND session.id IS NULL) THEN
    PERFORM public.kq_storage_prepare_state(p_user_id);
  END IF;
  SELECT COALESCE(account.business_started_at,wallet.created_at) INTO origin
  FROM public.kq_equipment_wallets wallet LEFT JOIN public.kq_commerce_accounts account USING(user_id)
  WHERE wallet.user_id=p_user_id;
  -- A request waiting on another transaction is checked against the actual time
  -- it can act. Replaying a committed offer or draw bypasses the phase gate.
  moment := clock_timestamp();
  SELECT c.is_night,c.next_open_at INTO night,next_open_at FROM public.kq_korrigan_clock(origin,moment,p_clock) c;

  IF p_action='quote' OR (p_action='offer' AND session.id IS NULL) THEN
    IF p_action='offer' THEN
      IF NOT night THEN RAISE EXCEPTION 'korrigan_closed'; END IF;
      IF latest.id IS NOT NULL AND (SELECT count(*) FROM public.kq_korrigan_draws
        WHERE session_id=latest.id AND awarded_at IS NOT NULL)<3
      THEN RAISE EXCEPTION 'korrigan_session_active'; END IF;
      IF latest.next_offer_at>moment THEN RAISE EXCEPTION 'korrigan_cooldown'; END IF;
      SELECT * INTO stock FROM public.kq_commerce_stock WHERE id=p_lot_id AND user_id=p_user_id FOR UPDATE;
    ELSE
      SELECT * INTO stock FROM public.kq_commerce_stock WHERE id=p_lot_id AND user_id=p_user_id;
    END IF;
    SELECT * INTO selected FROM public.kq_korrigan_lots(p_user_id,moment) WHERE stock_id=stock.id;
    IF NOT FOUND OR selected.available_grams<p_grams THEN RAISE EXCEPTION 'korrigan_lot_unavailable'; END IF;
    value_cents := (public.kq_customer_demand_professional_quote(p_user_id,stock,'cbd-shop',selected.quality,
      selected.event,selected.multiplier,p_grams*10,moment)->>'payoutCents')::bigint;

    IF p_action='quote' THEN
      quote := jsonb_build_object('valueCents',value_cents,'eligible',value_cents>=minimum_value_cents);
    ELSE
      IF value_cents IS DISTINCT FROM p_expected_value_cents THEN RAISE EXCEPTION 'korrigan_offer_changed'; END IF;
      IF value_cents<minimum_value_cents THEN RAISE EXCEPTION 'korrigan_minimum'; END IF;
      INSERT INTO public.kq_korrigan_sessions(user_id,request_id,lot_id,grams,value_cents,offered_at,next_offer_at)
        VALUES(p_user_id,p_request_id,stock.id,p_grams,value_cents,moment,moment+interval '168 hours') RETURNING * INTO session;
      latest := session;
      UPDATE public.kq_commerce_stock SET remaining_units=remaining_units-p_grams*10 WHERE id=stock.id;
      PERFORM public.kq_storage_allocate(stock.flower_id);
      PERFORM public.kq_storage_fill_user(p_user_id);
    END IF;
  ELSIF p_action='draw' THEN
    SELECT * INTO prize FROM public.kq_korrigan_draws WHERE session_id=session.id AND draw_index=p_draw;
    IF NOT FOUND THEN
      IF NOT night THEN RAISE EXCEPTION 'korrigan_closed'; END IF;
      IF p_draw<>(SELECT count(*)+1 FROM public.kq_korrigan_draws WHERE session_id=session.id)
      THEN RAISE EXCEPTION 'korrigan_draw_order'; END IF;
      IF EXISTS(SELECT 1 FROM public.kq_korrigan_draws WHERE session_id=session.id AND awarded_at IS NULL)
      THEN RAISE EXCEPTION 'korrigan_reward_pending'; END IF;
      draw_kind := public.kq_korrigan_draw_kind(public.lottery_secure_random_int(1,10000),session.odds);
      INSERT INTO public.kq_korrigan_draws(session_id,draw_index,kind,money_cents,item_label)
      VALUES(session.id,p_draw,draw_kind,session.value_cents *
        CASE draw_kind WHEN 'x5' THEN 5 WHEN 'x10' THEN 10 WHEN 'x50' THEN 50 ELSE 0 END,
        CASE draw_kind WHEN 'epic' THEN 'Carte Buddie épique' WHEN 'botte' THEN 'Pack Botte du Chanvrier'
          WHEN 'buddie' THEN 'Pack Buddies' END)
      RETURNING * INTO prize;
    END IF;
    PERFORM public.kq_korrigan_award(p_user_id,prize.id);
  END IF;

  IF p_action='state' OR (p_action='offer' AND session.id IS NOT NULL) THEN
    FOR pending_id IN
      SELECT draw.id FROM public.kq_korrigan_draws draw
      JOIN public.kq_korrigan_sessions prior ON prior.id=draw.session_id
      WHERE prior.user_id=p_user_id AND draw.awarded_at IS NULL
      ORDER BY prior.offered_at,draw.draw_index
    LOOP
      PERFORM public.kq_korrigan_award(p_user_id,pending_id);
    END LOOP;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',l.stock_id,'label',l.label,'availableGrams',l.available_grams)
    ORDER BY l.label,l.stock_id),'[]'::jsonb) INTO lots FROM public.kq_korrigan_lots(p_user_id,moment) l;
  response := jsonb_build_object('isNight',night,'serverNow',moment,'nextOfferAt',latest.next_offer_at,'nextNightAt',next_open_at,
    'minimumValueCents',minimum_value_cents,'lots',lots,
    'session',CASE WHEN session.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',session.id,'requestId',session.request_id,'lotId',session.lot_id,'grams',session.grams,
      'valueCents',session.value_cents,'nextOfferAt',session.next_offer_at,'odds',session.odds,
      'draws',(SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'index',draw.draw_index,'kind',draw.kind,'moneyCents',draw.money_cents,'itemLabel',draw.item_label,
        'pending',CASE WHEN draw.awarded_at IS NULL THEN true END)) ORDER BY draw.draw_index),'[]'::jsonb)
        FROM public.kq_korrigan_draws draw WHERE draw.session_id=session.id)) END);
  RETURN CASE WHEN quote IS NULL THEN response ELSE response||jsonb_build_object('quote',quote) END;
END $$;

REVOKE ALL ON FUNCTION public.kq_customer_demand_professional_quote(uuid,public.kq_commerce_stock,text,numeric,text,numeric,integer,timestamptz),
  public.kq_customer_demand_validate_sale(uuid,public.kq_commerce_stock,jsonb,numeric,text,numeric),
  public.kq_korrigan_clock(timestamptz,timestamptz,jsonb), public.kq_korrigan_draw_kind(integer,jsonb), public.kq_korrigan_odds(),
  public.kq_korrigan_lots(uuid,timestamptz), public.kq_korrigan_award(uuid,uuid),
  public.kq_korrigan_market(uuid,text,jsonb,uuid,integer,uuid,uuid,integer,bigint)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kq_korrigan_market(uuid,text,jsonb,uuid,integer,uuid,uuid,integer,bigint) TO service_role;

COMMIT;
