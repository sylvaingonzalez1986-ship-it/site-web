BEGIN;

-- Old quantities are complete historical applications, preserved without a
-- conversion or a second charge. New stock is separately measured in m².
ALTER TABLE public.kq_care_inventory ADD COLUMN area_quantity INTEGER NOT NULL DEFAULT 0 CHECK (area_quantity >= 0);
ALTER TABLE public.kq_care_purchases
  ADD COLUMN run_id UUID REFERENCES public.kq_runs(id),
  ADD COLUMN area_m2 INTEGER CHECK (area_m2 > 0),
  ADD COLUMN pricing_units INTEGER CHECK (pricing_units > 0);
ALTER TABLE public.kq_care_interventions
  ADD COLUMN area_m2 INTEGER CHECK (area_m2 > 0),
  ADD COLUMN pricing_units INTEGER CHECK (pricing_units > 0);
REVOKE ALL ON TABLE public.kq_care_inventory, public.kq_care_purchases, public.kq_care_interventions FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX kq_care_purchases_register_idx ON public.kq_care_purchases(user_id, created_at DESC, request_key DESC);
CREATE INDEX kq_care_interventions_register_idx ON public.kq_care_interventions(user_id, created_at DESC, request_key DESC) WHERE product_code IS NULL AND charged_cents > 0;

CREATE FUNCTION public.kq_care_pricing(p_state JSONB) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE area INTEGER; units INTEGER;
BEGIN
 IF p_state IS NULL THEN area:=1;
 ELSIF p_state->'campaign' IS NOT NULL THEN
  IF jsonb_typeof(p_state->'campaign'->'members') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_state->'campaign'->'members')=0 THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_state->'campaign'->'members') member
    WHERE jsonb_typeof(member->'warehouse'->'activeAreaM2') IS DISTINCT FROM 'number'
      OR (member->'warehouse'->>'activeAreaM2')::NUMERIC<=0
      OR (member->'warehouse'->>'activeAreaM2')::NUMERIC<>trunc((member->'warehouse'->>'activeAreaM2')::NUMERIC)) THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
  SELECT sum((member->'warehouse'->>'activeAreaM2')::INTEGER) INTO area FROM jsonb_array_elements(p_state->'campaign'->'members') member;
 ELSE area:=(p_state->'warehouse'->>'activeAreaM2')::INTEGER;
 END IF;
 units:=COALESCE(area,(p_state->'equipment'->>'productionUnits')::INTEGER,1);
 IF units NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
 RETURN jsonb_build_object('areaM2',area,'pricingUnits',units,'basicCarePriceCents',public.kq_basic_care_price()*units);
END $$;
REVOKE ALL ON FUNCTION public.kq_care_pricing(JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_care_inventory_for_scope(p_user UUID,p_units INTEGER) RETURNS JSONB
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('productCode',product_code,
  'quantity',quantity+area_quantity/p_units,'legacyQuantity',quantity,'areaQuantity',area_quantity) ORDER BY product_code),'[]'::JSONB)
 FROM public.kq_care_inventory WHERE user_id=p_user
$$;
REVOKE ALL ON FUNCTION public.kq_care_inventory_for_scope(UUID,INTEGER) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.kq_care_inventory_json(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$ SELECT public.kq_care_inventory_for_scope(p_user,1) $$;
REVOKE ALL ON FUNCTION public.kq_care_inventory_json(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_care_shop_v2(p_user_id UUID,p_run_id UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE cash INTEGER; run public.kq_runs%ROWTYPE; pricing JSONB; prices JSONB;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM public.kq_business_settle(p_user_id);
 PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
 IF p_run_id IS NOT NULL THEN
  SELECT * INTO run FROM public.kq_runs WHERE id=p_run_id AND user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
  IF run.state->'campaign' IS NOT NULL AND run.state->'campaign'->>'leaderRunId' IS DISTINCT FROM p_run_id::TEXT THEN RAISE EXCEPTION 'kq_campaign_action_required'; END IF;
 END IF;
 pricing:=public.kq_care_pricing(run.state);
 SELECT jsonb_object_agg(code,public.kq_care_price(code)*(pricing->>'pricingUnits')::INTEGER) INTO prices
 FROM unnest(ARRAY['CARE-COMPOST-TEA','CARE-VERMICOMPOST','CARE-ORGANIC-FEED','CARE-SEAWEED','CARE-APHIDIUS','CARE-PHYTOSEIULUS','CARE-SWIRSKII','CARE-ORIUS','CARE-CHRYSOPERLA','CARE-COCCINELLA']) code;
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
 RETURN pricing||jsonb_build_object('cashCents',cash,'runId',p_run_id,'prices',prices,
  'inventory',public.kq_care_inventory_for_scope(p_user_id,(pricing->>'pricingUnits')::INTEGER));
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_care_shop_v2(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_care_shop_v2(UUID,UUID) TO service_role;

CREATE FUNCTION public.rpc_kq_purchase_care_v2(p_user_id UUID,p_product_code TEXT,p_quantity INTEGER,p_request_key UUID,
 p_run_id UUID,p_expected_price_cents INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE cash INTEGER; total INTEGER; units INTEGER; pricing JSONB; old public.kq_care_purchases%ROWTYPE; run public.kq_runs%ROWTYPE;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR public.kq_care_price(p_product_code) IS NULL
  OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM public.kq_business_settle(p_user_id);
 PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO old FROM public.kq_care_purchases WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF old.product_code IS DISTINCT FROM p_product_code OR old.quantity IS DISTINCT FROM p_quantity
   OR (old.pricing_units IS NOT NULL AND old.run_id IS DISTINCT FROM p_run_id) THEN RAISE EXCEPTION 'kq_care_request_mismatch'; END IF;
  RETURN jsonb_build_object('cashCents',cash,'inventory',public.kq_care_inventory_for_scope(p_user_id,COALESCE(old.pricing_units,1)),
   'totalPriceCents',old.total_price_cents,'replayed',TRUE);
 END IF;
 IF p_run_id IS NOT NULL THEN
  SELECT * INTO run FROM public.kq_runs WHERE id=p_run_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR run.status<>'active' THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
  PERFORM public.kq_campaign_assert_leader(p_user_id,p_run_id,run.state);
 END IF;
 pricing:=public.kq_care_pricing(run.state); units:=(pricing->>'pricingUnits')::INTEGER;
 total:=public.kq_care_price(p_product_code)*units*p_quantity;
 IF p_expected_price_cents IS DISTINCT FROM total THEN RAISE EXCEPTION 'kq_care_price_changed'; END IF;
 IF cash<total THEN RAISE EXCEPTION 'kq_care_insufficient_cash'; END IF;
 PERFORM public.kq_treasury_initialize(p_user_id);
 UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-total,updated_at=now() WHERE user_id=p_user_id;
 INSERT INTO public.kq_care_inventory(user_id,product_code,quantity,area_quantity) VALUES(p_user_id,p_product_code,0,units*p_quantity)
  ON CONFLICT(user_id,product_code) DO UPDATE SET area_quantity=kq_care_inventory.area_quantity+excluded.area_quantity,updated_at=now();
 INSERT INTO public.kq_care_purchases(user_id,request_key,product_code,quantity,total_price_cents,run_id,area_m2,pricing_units)
  VALUES(p_user_id,p_request_key,p_product_code,p_quantity,total,p_run_id,(pricing->>'areaM2')::INTEGER,units);
 PERFORM public.kq_treasury_pair(p_user_id,'culture-input','culture-input:'||p_request_key::TEXT,
  now(),'expense_other','suspense',total,'Intrant de culture · '||p_product_code);
 PERFORM public.kq_player_work_charge(p_user_id,public.kq_player_work_cost('culture','buy-care'));
 RETURN jsonb_build_object('cashCents',cash-total,'inventory',public.kq_care_inventory_for_scope(p_user_id,units),
  'totalPriceCents',total,'replayed',FALSE);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_purchase_care_v2(UUID,TEXT,INTEGER,UUID,UUID,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_purchase_care_v2(UUID,TEXT,INTEGER,UUID,UUID,INTEGER) TO service_role;
-- Old clients cannot issue an unquoted flat-price purchase after this change.
REVOKE ALL ON FUNCTION public.rpc_kq_purchase_care(UUID,TEXT,INTEGER,UUID) FROM PUBLIC,anon,authenticated,service_role;

-- Keep the campaign guard and workday wrapper intact. Only the exact monetary
-- and inventory operations inside the existing transaction are replaced.
DO $$ DECLARE body TEXT; anchor TEXT; replacement TEXT; BEGIN
 body:=replace(pg_get_functiondef('public.kq_work_inner_apply_care(uuid,uuid,text,uuid,timestamptz,jsonb,integer)'::regprocedure),chr(13),'');
 anchor:='p_basic_price_cents IS DISTINCT FROM public.kq_basic_care_price()';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'care_surface_quote_drift'; END IF;
 body:=replace(body,anchor,'p_basic_price_cents IS DISTINCT FROM (public.kq_care_pricing(run.state)->>''basicCarePriceCents'')::INTEGER');
 anchor:='charge := public.kq_basic_care_price();';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'care_surface_charge_drift'; END IF;
 body:=replace(body,anchor,'charge := (public.kq_care_pricing(run.state)->>''basicCarePriceCents'')::INTEGER;');
 anchor:=E'    UPDATE public.kq_care_inventory SET quantity=quantity-1,updated_at=now()\n      WHERE user_id=p_user_id AND product_code=p_product_code AND quantity>0;';
 replacement:=E'    UPDATE public.kq_care_inventory SET\n      quantity=quantity-CASE WHEN quantity>0 THEN 1 ELSE 0 END,\n      area_quantity=area_quantity-CASE WHEN quantity>0 THEN 0 ELSE (public.kq_care_pricing(run.state)->>''pricingUnits'')::INTEGER END,updated_at=now()\n      WHERE user_id=p_user_id AND product_code=p_product_code\n        AND (quantity>0 OR area_quantity>=(public.kq_care_pricing(run.state)->>''pricingUnits'')::INTEGER);';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'care_surface_inventory_drift'; END IF;
 body:=replace(body,anchor,replacement);
 anchor:=E'  INSERT INTO public.kq_care_interventions(user_id,request_key,run_id,product_code,stage_index,charged_cents)\n    VALUES(p_user_id,p_request_key,p_run_id,p_product_code,step,charge);';
 replacement:=E'  INSERT INTO public.kq_care_interventions(user_id,request_key,run_id,product_code,stage_index,charged_cents,area_m2,pricing_units)\n    VALUES(p_user_id,p_request_key,p_run_id,p_product_code,step,charge,(public.kq_care_pricing(run.state)->>''areaM2'')::INTEGER,(public.kq_care_pricing(run.state)->>''pricingUnits'')::INTEGER);';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'care_surface_receipt_drift'; END IF;
 EXECUTE replace(body,anchor,replacement);
END $$;
REVOKE ALL ON FUNCTION public.kq_work_inner_apply_care(UUID,UUID,TEXT,UUID,TIMESTAMPTZ,JSONB,INTEGER) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_care_purchase_register(p_user_id UUID,p_before_at TIMESTAMPTZ DEFAULT NULL,p_before_id TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH events AS (
  SELECT 'purchase:'||request_key::TEXT id,CASE WHEN product_code IN ('CARE-COMPOST-TEA','CARE-VERMICOMPOST','CARE-ORGANIC-FEED','CARE-SEAWEED') THEN 'input' ELSE 'pbi' END kind,
   product_code,quantity,total_price_cents amount_cents,created_at,run_id,area_m2,NULL::SMALLINT stage_index
  FROM public.kq_care_purchases WHERE user_id=p_user_id
  UNION ALL
  SELECT 'basic:'||request_key::TEXT,'basic',NULL,1,charged_cents,created_at,run_id,area_m2,stage_index
  FROM public.kq_care_interventions WHERE user_id=p_user_id AND product_code IS NULL AND charged_cents>0
 ), page AS (
  SELECT * FROM events WHERE p_before_at IS NULL OR (created_at,id)<(p_before_at,p_before_id)
  ORDER BY created_at DESC,id DESC LIMIT 26
 ), shown AS (SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 25)
 SELECT jsonb_build_object('serverNow',now(),'totalPaidCents',(SELECT COALESCE(sum(amount_cents),0) FROM events),
  'totalCount',(SELECT count(*) FROM events),'items',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id',id,'kind',kind,'productCode',product_code,'quantity',quantity,'amountCents',amount_cents,'createdAt',created_at,
   'runId',run_id,'areaM2',area_m2,'stageIndex',stage_index) ORDER BY created_at DESC,id DESC) FROM shown),'[]'::JSONB),
  'nextCursor',CASE WHEN (SELECT count(*) FROM page)>25 THEN (SELECT created_at::TEXT||'|'||id FROM shown ORDER BY created_at,id LIMIT 1) END)
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_care_purchase_register(UUID,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_care_purchase_register(UUID,TIMESTAMPTZ,TEXT) TO service_role;

COMMIT;
