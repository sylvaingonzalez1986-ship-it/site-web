BEGIN;

-- A transformed stock keeps the flower_id of the harvested source. Resolve
-- aromas through that authoritative link for flowers, hashes and rosins alike;
-- display names, processing equipment and payloads never supply provenance.
CREATE OR REPLACE FUNCTION public.kq_customer_demand_match(p_user UUID,p_stock UUID,p_channel TEXT,p_quality NUMERIC,p_units INTEGER,p_at TIMESTAMPTZ,p_whole_packet BOOLEAN DEFAULT false) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE demand JSONB; units INTEGER; variety TEXT; route_code TEXT; ready TIMESTAMPTZ; processing_ready TIMESTAMPTZ; flavor_count INTEGER;
BEGIN
 SELECT f.variety_code,s.route,(storage.state->>'readyAt')::TIMESTAMPTZ,
  CASE WHEN s.route=b.route THEN b.processing_ready_at ELSE NULL END
 INTO variety,route_code,ready,processing_ready
 FROM public.kq_commerce_stock s
 JOIN public.kq_flowers f ON f.id=s.flower_id AND f.owner_id=s.user_id
 JOIN public.kq_commerce_batches b ON b.flower_id=s.flower_id AND b.user_id=s.user_id
 JOIN public.kq_storage_lots storage ON storage.flower_id=s.flower_id AND storage.user_id=s.user_id
 WHERE s.id=p_stock AND s.user_id=p_user;
 IF route_code IS NULL OR route_code NOT IN ('raw','dry-sift','static-sift','ice-water-hash',
  'rosin-trial','rosin-selection','rosin-premium','rosin-signature','hash-signature')
  OR ready IS NULL OR ready>p_at OR processing_ready>p_at OR p_at IS NULL
  OR p_quality IS NULL OR p_units IS NULL OR p_units<=0 THEN RETURN NULL; END IF;
 demand:=public.kq_customer_demand_remaining(p_user,p_channel,p_at);
 IF demand IS NULL OR p_quality<(demand->>'minimumQuality')::NUMERIC THEN RETURN NULL; END IF;
 SELECT count(DISTINCT flavor) INTO flavor_count FROM unnest(public.kq_customer_demand_flavors(variety)) AS f(flavor)
 WHERE demand->'flavorCodes' ? flavor;
 IF flavor_count=0 THEN RETURN NULL; END IF;
 units:=LEAST(p_units,(demand->>'remainingUnits')::INTEGER);
 IF units<=0 OR (p_whole_packet AND units<p_units) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',demand->>'id','period',(demand->>'period')::BIGINT,
  'bonusPercent',(demand->>'bonusPercent')::NUMERIC*flavor_count/2,'matchedFlavorCount',flavor_count,'units',units);
END $$;

-- Recompute both the existing product base tariff and its premium inside the
-- existing locked payment. A quote cannot invent aromas, quality, a network
-- price, demand capacity, cumulative rounding or the amount paid.
CREATE OR REPLACE FUNCTION public.kq_customer_demand_validate_sale(p_user UUID,p_stock public.kq_commerce_stock,p_offer JSONB,p_quality NUMERIC,p_event TEXT,p_multiplier NUMERIC) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE matched JSONB; base NUMERIC; tariff NUMERIC; exact NUMERIC; units INTEGER:=(p_offer->>'units')::INTEGER;
 channel TEXT:=p_offer->>'channel'; partners INTEGER; percent NUMERIC;
BEGIN
 IF p_stock.route='biomass' OR channel NOT IN ('cbd-shop','wholesale') THEN RETURN; END IF;
 matched:=public.kq_customer_demand_match(p_user,p_stock.id,channel,p_quality,units,now());
 IF NULLIF(p_offer->'customerDemand','null'::JSONB) IS DISTINCT FROM matched THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
 IF p_stock.route='raw' THEN
  base:=public.kq_online_raw_professional_price(channel,p_quality,p_event,p_stock.base_unit_cents,p_multiplier);
 ELSE
  IF channel='cbd-shop' THEN
   SELECT COALESCE(c.shop_partners_start,0) INTO partners FROM public.kq_commerce_accounts a
   LEFT JOIN public.kq_commerce_campaigns c ON c.run_id=a.current_run_id AND c.user_id=a.user_id WHERE a.user_id=p_user;
   percent:=CASE WHEN p_quality>=9.5 THEN 55 WHEN p_quality>=9 THEN 50 WHEN p_quality>=8 THEN 45 ELSE 40 END
    +CASE WHEN partners>=12 THEN 4 WHEN partners>=8 THEN 3 WHEN partners>=4 THEN 2 WHEN partners>=1 THEN 1 ELSE 0 END;
  ELSE
   percent:=CASE p_event WHEN 'promotion' THEN 25 WHEN 'restock' THEN 33 ELSE 30 END;
  END IF;
  base:=round(p_stock.base_unit_cents*p_multiplier*percent/100,6);
 END IF;
 tariff:=round(base*(1+COALESCE((matched->>'bonusPercent')::NUMERIC*(matched->>'units')::NUMERIC/NULLIF(units,0)/100,0)),6);
 exact:=round(p_stock.payout_exact+units*tariff/10,6);
 IF units IS NULL OR units<=0 OR round((p_offer->>'unitCents')::NUMERIC,6) IS DISTINCT FROM tariff
  OR (p_offer->>'payoutExactAfter')::NUMERIC IS DISTINCT FROM exact
  OR (p_offer->>'payoutRoundedAfter')::NUMERIC IS DISTINCT FROM round(exact)
  OR (p_offer->>'payoutCents')::NUMERIC IS DISTINCT FROM round(exact)-p_stock.payout_rounded
 THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
 PERFORM public.kq_customer_demand_consume(p_user,channel,matched);
END $$;

-- Keep the raw flower reference and transformed reference (including its
-- packaging) intact. Apply the same source-aroma premium to either reference;
-- the player's packet price, dispatch, accounting and replay guards stay put.
DO $$ DECLARE body TEXT; before TEXT; after TEXT; BEGIN
 body:=replace(pg_get_functiondef('public.kq_online_offer(uuid,public.kq_online_listings,timestamptz)'::regprocedure),E'\r\n',E'\n');
 before:=$old$ IF s.route='raw' THEN
  reference:=(CASE WHEN quality>=9.5 THEN 1000 WHEN quality>=8.5 THEN 800 ELSE 700 END)*p_listing.format_grams;
  matched:=public.kq_customer_demand_match(p_user,s.id,'online',quality,p_listing.format_grams*10,p_at,true);
  reference:=round(reference*(1+COALESCE((matched->>'bonusPercent')::NUMERIC,0)/100));
 END IF;$old$;
 after:=$new$ IF s.route='raw' THEN
  reference:=(CASE WHEN quality>=9.5 THEN 1000 WHEN quality>=8.5 THEN 800 ELSE 700 END)*p_listing.format_grams;
 END IF;
 matched:=public.kq_customer_demand_match(p_user,s.id,'online',quality,p_listing.format_grams*10,p_at,true);
 reference:=round(reference*(1+COALESCE((matched->>'bonusPercent')::NUMERIC,0)/100));$new$;
 IF (length(body)-length(replace(body,before,'')))/length(before)<>1 THEN RAISE EXCEPTION 'product_customer_demand_online_anchor_changed'; END IF;
 EXECUTE replace(body,before,after);
END $$;

-- Invalidate pre-migration quotes; retries with an existing receipt retain the
-- original idempotency behavior and never consume the shared quota twice.
UPDATE public.kq_commerce_accounts SET revision=revision+1;

REVOKE ALL ON FUNCTION public.kq_customer_demand_match(UUID,UUID,TEXT,NUMERIC,INTEGER,TIMESTAMPTZ,BOOLEAN),
 public.kq_customer_demand_validate_sale(UUID,public.kq_commerce_stock,JSONB,NUMERIC,TEXT,NUMERIC),
 public.kq_online_offer(UUID,public.kq_online_listings,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
