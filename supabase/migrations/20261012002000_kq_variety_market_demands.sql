BEGIN;

-- One quota per account, real 72-hour period and channel. Splitting stock or
-- recreating listings cannot reset it. Only SECURITY DEFINER settlement writes.
CREATE TABLE public.kq_customer_demand_usage (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 period BIGINT NOT NULL,
 channel TEXT NOT NULL CHECK(channel IN ('online','cbd-shop','wholesale')),
 consumed_units INTEGER NOT NULL DEFAULT 0 CHECK(consumed_units>=0),
 PRIMARY KEY(user_id,period,channel)
);
ALTER TABLE public.kq_customer_demand_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_customer_demand_usage FROM PUBLIC,anon,authenticated,service_role;

-- Reviewed game flavor profiles; parity with the TypeScript catalogue is tested.
CREATE FUNCTION public.kq_customer_demand_flavors(p_variety TEXT) RETURNS TEXT[]
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE p_variety
 WHEN 'HH2026-001' THEN ARRAY['pin','terre']
 WHEN 'HH2026-002' THEN ARRAY['pin','floral']
 WHEN 'HH2026-003' THEN ARRAY['terre','bois']
 WHEN 'HH2026-004' THEN ARRAY['mangue','terre']
 WHEN 'HH2026-005' THEN ARRAY['citron','diesel']
 WHEN 'HH2026-006' THEN ARRAY['pomme-confite','cerise']
 WHEN 'HH2026-007' THEN ARRAY['ananas','floral']
 WHEN 'HH2026-008' THEN ARRAY['myrtille','fromage']
 WHEN 'HH2026-009' THEN ARRAY['orange','chocolat']
 WHEN 'HH2026-010' THEN ARRAY['pomme-verte','poivre']
 WHEN 'HH2026-011' THEN ARRAY['cerise','pin']
 WHEN 'HH2026-012' THEN ARRAY['agrumes','fruits-tropicaux']
 WHEN 'HH2026-013' THEN ARRAY['citron','pin']
 WHEN 'HH2026-014' THEN ARRAY['agrumes','diesel']
 WHEN 'HH2026-015' THEN ARRAY['bois','epices']
 WHEN 'HH2026-016' THEN ARRAY['cerise','menthe']
 WHEN 'HH2026-017' THEN ARRAY['cafe','poivre']
 WHEN 'HH2026-018' THEN ARRAY['oignon','musque']
 WHEN 'HH2026-019' THEN ARRAY['baies','floral']
 WHEN 'HH2026-020' THEN ARRAY['fraise','epices']
 WHEN 'HH2026-021' THEN ARRAY['citron','encens']
 WHEN 'HH2026-022' THEN ARRAY['bois','poivre']
 WHEN 'HH2026-023' THEN ARRAY['terre','bois']
 WHEN 'HH2026-024' THEN ARRAY['cafe','terre']
 WHEN 'HH2026-025' THEN ARRAY['citron','diesel']
 WHEN 'HH2026-026' THEN ARRAY['creme','fruite']
 WHEN 'HH2026-027' THEN ARRAY['diesel','chocolat']
 WHEN 'HH2026-028' THEN ARRAY['baies','agrumes']
 WHEN 'HH2026-029' THEN ARRAY['ananas','agrumes']
 WHEN 'HH2026-030' THEN ARRAY['citron','pin']
 WHEN 'HH2026-031' THEN ARRAY['miel','floral']
 WHEN 'HH2026-032' THEN ARRAY['citron','bois']
 WHEN 'HH2026-033' THEN ARRAY['terre','floral']
 WHEN 'HH2026-034' THEN ARRAY['terre','cafe']
 WHEN 'HH2026-035' THEN ARRAY['fromage','floral']
 WHEN 'HH2026-036' THEN ARRAY['mangue','poivre']
 WHEN 'HH2026-037' THEN ARRAY['orange','raisin']
 WHEN 'HH2026-038' THEN ARRAY['pin','encens']
 WHEN 'HH2026-039' THEN ARRAY['baies','floral']
 WHEN 'HH2026-040' THEN ARRAY['kiwi','floral']
 WHEN 'HH2026-041' THEN ARRAY['fruits','truffe']
 WHEN 'HH2026-042' THEN ARRAY['sous-bois','encens']
 WHEN 'HH2026-043' THEN ARRAY['bois','terre']
 WHEN 'HH2026-044' THEN ARRAY['terre','pin']
 WHEN 'HH2026-045' THEN ARRAY['agrumes','pin']
 WHEN 'HH2026-046' THEN ARRAY['cerise','fruits-des-bois']
 WHEN 'HH2026-047' THEN ARRAY['mangue','poivre']
 WHEN 'HH2026-048' THEN ARRAY['mandarine','pin']
 WHEN 'HH2026-049' THEN ARRAY['diesel','gingembre']
 WHEN 'HH2026-050' THEN ARRAY['myrtille','citron']
 WHEN 'HH2026-051' THEN ARRAY['terre','anis']
 WHEN 'HH2026-052' THEN ARRAY['diesel','agrumes']
 ELSE ARRAY[]::TEXT[] END;
$$;

CREATE FUNCTION public.kq_customer_demand_request(p_period BIGINT,p_channel TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 WITH inputs AS (SELECT CASE p_channel WHEN 'online' THEN 0 WHEN 'cbd-shop' THEN 1 WHEN 'wholesale' THEN 2 END AS idx)
 SELECT jsonb_build_object('id',p_period::TEXT||':'||p_channel,'period',p_period,'channel',p_channel,
  'varietyCode','HH2026-'||lpad((2+mod(mod(p_period*7+idx*17,51)+51,51))::TEXT,3,'0'),
  'flavorCodes',public.kq_customer_demand_flavors('HH2026-'||lpad((2+mod(mod(p_period*7+idx*17,51)+51,51))::TEXT,3,'0')),
  'bonusPercent',(ARRAY[10,15,20,25])[1+mod(mod(p_period+idx,4)+4,4)::INTEGER],
  'minimumQuality',(ARRAY[8,7.5,7])[idx+1],
  'capacityUnits',(ARRAY[300,2000,5000])[idx+1],
  'remainingUnits',(ARRAY[300,2000,5000])[idx+1]) FROM inputs WHERE idx IS NOT NULL;
$$;

CREATE FUNCTION public.kq_customer_demand_remaining(p_user UUID,p_channel TEXT,p_at TIMESTAMPTZ) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH demand AS (SELECT public.kq_customer_demand_request(floor(extract(epoch FROM p_at)/259200)::BIGINT,p_channel) AS item)
 SELECT item||jsonb_build_object('remainingUnits',GREATEST(0,(item->>'capacityUnits')::INTEGER-COALESCE((
  SELECT consumed_units FROM public.kq_customer_demand_usage
  WHERE user_id=p_user AND channel=p_channel AND period=(item->>'period')::BIGINT),0))) FROM demand;
$$;

CREATE FUNCTION public.kq_customer_demand_snapshot(p_user UUID,p_at TIMESTAMPTZ) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH moment AS (SELECT floor(extract(epoch FROM p_at)/259200)::BIGINT AS period)
 SELECT jsonb_build_object('version',1,'serverNow',p_at,'period',period,
  'startsAt',to_timestamp(period*259200),'endsAt',to_timestamp((period+1)*259200),
  'requests',(SELECT jsonb_agg(public.kq_customer_demand_remaining(p_user,channel,p_at) ORDER BY ord)
    FROM unnest(ARRAY['online','cbd-shop','wholesale']) WITH ORDINALITY AS c(channel,ord)),
  'upcoming',CASE WHEN p_at>=to_timestamp((period+1)*259200)-interval '24 hours' THEN
   (SELECT jsonb_agg(public.kq_customer_demand_request(period+1,channel) ORDER BY ord)
    FROM unnest(ARRAY['online','cbd-shop','wholesale']) WITH ORDINALITY AS c(channel,ord)) ELSE '[]'::JSONB END) FROM moment;
$$;

-- The flower owns its identity; names and player-provided profiles are ignored.
CREATE FUNCTION public.kq_customer_demand_match(p_user UUID,p_stock UUID,p_channel TEXT,p_quality NUMERIC,p_units INTEGER,p_at TIMESTAMPTZ,p_whole_packet BOOLEAN DEFAULT false) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE demand JSONB; units INTEGER; variety TEXT; route_code TEXT; ready TIMESTAMPTZ; flavor_count INTEGER;
BEGIN
 SELECT f.variety_code,s.route,(storage.state->>'readyAt')::TIMESTAMPTZ INTO variety,route_code,ready
 FROM public.kq_commerce_stock s JOIN public.kq_flowers f ON f.id=s.flower_id
 JOIN public.kq_storage_lots storage ON storage.flower_id=s.flower_id AND storage.user_id=s.user_id
 WHERE s.id=p_stock AND s.user_id=p_user;
 demand:=public.kq_customer_demand_remaining(p_user,p_channel,p_at);
 SELECT count(DISTINCT flavor) INTO flavor_count FROM unnest(public.kq_customer_demand_flavors(variety)) AS f(flavor)
 WHERE demand->'flavorCodes' ? flavor;
 IF route_code IS DISTINCT FROM 'raw' OR flavor_count=0
  OR ready IS NULL OR ready>p_at OR p_quality IS NULL OR p_quality<(demand->>'minimumQuality')::NUMERIC
  OR p_units IS NULL OR p_units<=0 THEN RETURN NULL; END IF;
 units:=LEAST(p_units,(demand->>'remainingUnits')::INTEGER);
 IF units<=0 OR (p_whole_packet AND units<p_units) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',demand->>'id','period',(demand->>'period')::BIGINT,
  'bonusPercent',(demand->>'bonusPercent')::NUMERIC*flavor_count/2,'matchedFlavorCount',flavor_count,'units',units);
END $$;

CREATE FUNCTION public.kq_customer_demand_consume(p_user UUID,p_channel TEXT,p_match JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE capacity INTEGER;
BEGIN
 IF p_match IS NULL THEN RETURN; END IF;
 capacity:=(public.kq_customer_demand_request((p_match->>'period')::BIGINT,p_channel)->>'capacityUnits')::INTEGER;
 INSERT INTO public.kq_customer_demand_usage(user_id,period,channel,consumed_units)
 VALUES(p_user,(p_match->>'period')::BIGINT,p_channel,(p_match->>'units')::INTEGER)
 ON CONFLICT(user_id,period,channel) DO UPDATE
  SET consumed_units=public.kq_customer_demand_usage.consumed_units+EXCLUDED.consumed_units
  WHERE public.kq_customer_demand_usage.consumed_units+EXCLUDED.consumed_units<=capacity;
 IF NOT FOUND OR (p_match->>'units')::INTEGER>capacity THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
END $$;

-- Indoor commercial flowers have a fixed professional base. The historical
-- poor-quality clearance and transformed-product tariffs remain unchanged.
CREATE OR REPLACE FUNCTION public.kq_online_raw_professional_price(p_channel TEXT,p_quality NUMERIC,p_event TEXT,p_base NUMERIC,p_multiplier NUMERIC) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN p_quality>=6.5 THEN CASE WHEN p_channel='cbd-shop' THEN 300 ELSE 210 END ELSE
 round(CASE WHEN p_channel='cbd-shop' THEN 50+100*GREATEST(0,LEAST(1,(p_quality-6.5)/3)) ELSE
  LEAST((50+100*GREATEST(0,LEAST(1,(p_quality-6.5)/3)))*.6,p_base*p_multiplier*
   CASE p_event WHEN 'promotion' THEN .25 WHEN 'restock' THEN .33 ELSE .30 END) END,6) END;
$$;

CREATE FUNCTION public.kq_customer_demand_validate_sale(p_user UUID,p_stock public.kq_commerce_stock,p_offer JSONB,p_quality NUMERIC,p_event TEXT,p_multiplier NUMERIC) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE matched JSONB; base NUMERIC; tariff NUMERIC; exact NUMERIC; units INTEGER:=(p_offer->>'units')::INTEGER;
 channel TEXT:=p_offer->>'channel';
BEGIN
 IF p_stock.route<>'raw' OR channel NOT IN ('cbd-shop','wholesale') THEN RETURN; END IF;
 matched:=public.kq_customer_demand_match(p_user,p_stock.id,channel,p_quality,units,now());
 IF NULLIF(p_offer->'customerDemand','null'::JSONB) IS DISTINCT FROM matched THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
 base:=public.kq_online_raw_professional_price(channel,p_quality,p_event,p_stock.base_unit_cents,p_multiplier);
 tariff:=round(base*(1+COALESCE((matched->>'bonusPercent')::NUMERIC*(matched->>'units')::NUMERIC/NULLIF(units,0)/100,0)),6);
 exact:=round(p_stock.payout_exact+units*tariff/10,6);
 IF units IS NULL OR units<=0 OR round((p_offer->>'unitCents')::NUMERIC,6) IS DISTINCT FROM tariff
  OR (p_offer->>'payoutExactAfter')::NUMERIC IS DISTINCT FROM exact
  OR (p_offer->>'payoutRoundedAfter')::NUMERIC IS DISTINCT FROM round(exact)
  OR (p_offer->>'payoutCents')::NUMERIC IS DISTINCT FROM round(exact)-p_stock.payout_rounded
 THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
 PERFORM public.kq_customer_demand_consume(p_user,channel,matched);
END $$;

-- Preserve all existing account, storage, warehouse, VAT, debt and replay
-- validation. This replacement happens inside the existing financial lock.
DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure) INTO body;
 fragment:='IF s.route=''raw'' AND channel IN (''cbd-shop'',''wholesale'') AND round((offer->>''unitCents'')::NUMERIC,6) IS DISTINCT FROM public.kq_online_raw_professional_price(channel,storage_jury_score,c.event,s.base_unit_cents,CASE WHEN EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength=''merchant'') THEN 1.5 ELSE 1 END) THEN RAISE EXCEPTION ''commerce_offer_changed''; END IF;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'customer_demand_professional_anchor_changed'; END IF;
 body:=replace(body,fragment,'PERFORM public.kq_customer_demand_validate_sale(p_user_id,s,offer,storage_jury_score,c.event,CASE WHEN EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength=''merchant'') THEN 1.5 ELSE 1 END);');
 EXECUTE body;
END $$;

ALTER FUNCTION public.rpc_kq_commerce_state(UUID) RENAME TO kq_customer_demand_previous_commerce_state;
CREATE FUNCTION public.rpc_kq_commerce_state(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result JSONB;
BEGIN
 result:=public.kq_customer_demand_previous_commerce_state(p_user_id);
 result:=jsonb_set(result,'{stocks}',COALESCE((SELECT jsonb_agg(item||jsonb_build_object('varietyCode',f.variety_code) ORDER BY ord)
  FROM jsonb_array_elements(result->'stocks') WITH ORDINALITY AS stock(item,ord)
  JOIN public.kq_flowers f ON f.id=(item->>'flowerId')::UUID AND f.owner_id=p_user_id),'[]'::JSONB));
 RETURN result||jsonb_build_object('customerDemand',public.kq_customer_demand_snapshot(p_user_id,now()));
END $$;

-- Free online pricing is unchanged; willingness to pay and satisfaction use
-- 7/8/10 EUR per gram for raw indoor quality, plus the current eligible demand.
DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.kq_online_offer(uuid,public.kq_online_listings,timestamptz)'::regprocedure) INTO body;
 fragment:='quality NUMERIC; reference NUMERIC;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'customer_demand_online_variable_anchor_changed'; END IF;
 body:=replace(body,fragment,'matched JSONB; quality NUMERIC; reference NUMERIC;');
 fragment:='ratio:=p_listing.packet_price_cents/reference;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'customer_demand_online_price_anchor_changed'; END IF;
 body:=replace(body,fragment,$patch$
 IF s.route='raw' THEN
  reference:=(CASE WHEN quality>=9.5 THEN 1000 WHEN quality>=8.5 THEN 800 ELSE 700 END)*p_listing.format_grams;
  matched:=public.kq_customer_demand_match(p_user,s.id,'online',quality,p_listing.format_grams*10,p_at,true);
  reference:=round(reference*(1+COALESCE((matched->>'bonusPercent')::NUMERIC,0)/100));
 END IF;
 ratio:=p_listing.packet_price_cents/reference;
$patch$);
 fragment:='RETURN jsonb_build_object(''qualityScore'',quality,';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'customer_demand_online_offer_anchor_changed'; END IF;
 body:=replace(body,fragment,'RETURN jsonb_build_object(''customerDemand'',matched,''qualityScore'',quality,');
 EXECUTE body;

 SELECT pg_get_functiondef('public.kq_online_dispatch(uuid,uuid,timestamptz)'::regprocedure) INTO body;
 fragment:='SELECT * INTO l FROM public.kq_online_listings WHERE id=p_listing AND user_id=p_user FOR UPDATE;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'customer_demand_dispatch_lock_anchor_changed'; END IF;
 body:=replace(body,fragment,'PERFORM pg_advisory_xact_lock(hashtextextended(''kq-equipment:''||p_user::TEXT,0));'||E'\n '||fragment);
 fragment:='money:=l.packet_price_cents;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'customer_demand_dispatch_consume_anchor_changed'; END IF;
 body:=replace(body,fragment,'PERFORM public.kq_customer_demand_consume(p_user,''online'',NULLIF(offer->''customerDemand'',''null''::JSONB));'||E'\n '||fragment);
 EXECUTE body;

 SELECT pg_get_functiondef('public.kq_online_settle_until(uuid,timestamptz)'::regprocedure) INTO body;
 fragment:='next_at:=LEAST(next_at,day_end);';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'customer_demand_settlement_period_anchor_changed'; END IF;
 body:=replace(body,fragment,fragment||E'\n  next_at:=LEAST(next_at,to_timestamp((floor(extract(epoch FROM cursor_at)/259200)+1)*259200));');
 EXECUTE body;

 SELECT pg_get_functiondef('public.kq_online_snapshot(uuid)'::regprocedure) INTO body;
 fragment:='''name'',f.variety_name,''route'',s.route';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'customer_demand_listing_variety_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'''name'',f.variety_name,''varietyCode'',f.variety_code,''route'',s.route');
END $$;

REVOKE ALL ON FUNCTION public.kq_customer_demand_flavors(TEXT),public.kq_customer_demand_request(BIGINT,TEXT),
 public.kq_customer_demand_remaining(UUID,TEXT,TIMESTAMPTZ),public.kq_customer_demand_snapshot(UUID,TIMESTAMPTZ),
 public.kq_customer_demand_match(UUID,UUID,TEXT,NUMERIC,INTEGER,TIMESTAMPTZ,BOOLEAN),
 public.kq_customer_demand_consume(UUID,TEXT,JSONB),
 public.kq_customer_demand_validate_sale(UUID,public.kq_commerce_stock,JSONB,NUMERIC,TEXT,NUMERIC),
 public.kq_customer_demand_previous_commerce_state(UUID),public.rpc_kq_commerce_state(UUID)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_commerce_state(UUID) TO service_role;

COMMIT;
