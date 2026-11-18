BEGIN;

-- The application coordinates refer to the rotated footprint frozen at launch.
-- Campaigns use each participant's own zone, never the player's current plan.
CREATE FUNCTION public.kq_care_crop_zones(p_state JSONB) RETURNS SETOF JSONB
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT z FROM jsonb_array_elements(p_state->'warehouse'->'zones') z
 WHERE NOT (p_state ? 'campaign') AND z->'active'='true'::JSONB
   AND z->>'id' IS DISTINCT FROM p_state->'warehouse'->>'productionReservedZoneId'
   AND (p_state->'warehouse'->>'zoneId' IS NULL OR z->>'id'=p_state->'warehouse'->>'zoneId')
 UNION ALL
 SELECT z FROM jsonb_array_elements(p_state->'campaign'->'members') m
 CROSS JOIN LATERAL jsonb_array_elements(m->'warehouse'->'zones') z
 WHERE z->'active'='true'::JSONB AND z->>'id'=m->>'zoneId'
$$;
REVOKE ALL ON FUNCTION public.kq_care_crop_zones(JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_care_sector_shape(p_target JSONB) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN jsonb_typeof(p_target)='object'
   AND jsonb_typeof(p_target->'zoneId')='string' AND length(p_target->>'zoneId') BETWEEN 1 AND 128
   AND jsonb_typeof(p_target->'x')='number' AND p_target->>'x' ~ '^[0-9]{1,2}$'
   AND jsonb_typeof(p_target->'y')='number' AND p_target->>'y' ~ '^[0-9]{1,2}$'
   THEN (p_target->>'x')::INTEGER<40 AND (p_target->>'y')::INTEGER<40
     AND p_target-'zoneId'-'x'-'y'='{}'::JSONB ELSE FALSE END
$$;
REVOKE ALL ON FUNCTION public.kq_care_sector_shape(JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_care_pbi_pests(p_code TEXT) RETURNS TEXT[]
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT CASE p_code WHEN 'CARE-APHIDIUS' THEN ARRAY['APHIDS'] WHEN 'CARE-COCCINELLA' THEN ARRAY['APHIDS']
   WHEN 'CARE-ORIUS' THEN ARRAY['THRIPS'] WHEN 'CARE-SWIRSKII' THEN ARRAY['THRIPS']
   WHEN 'CARE-CHRYSOPERLA' THEN ARRAY['APHIDS','THRIPS'] WHEN 'CARE-PHYTOSEIULUS' THEN ARRAY['MITES']
   ELSE ARRAY[]::TEXT[] END
$$;
REVOKE ALL ON FUNCTION public.kq_care_pbi_pests(TEXT) FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.kq_care_interventions ADD COLUMN target JSONB,
 ADD CONSTRAINT kq_care_intervention_target CHECK(target IS NULL OR
   (public.kq_care_sector_shape(target) AND cardinality(public.kq_care_pbi_pests(product_code))>0
   AND area_m2 IS NOT DISTINCT FROM 1 AND pricing_units IS NOT DISTINCT FROM 1));
REVOKE ALL ON TABLE public.kq_care_interventions FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_care_inventory_for_run(p_user UUID,p_state JSONB) RETURNS JSONB
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 WITH scope AS (SELECT (public.kq_care_pricing(p_state)->>'pricingUnits')::INTEGER AS units,
   EXISTS(SELECT FROM public.kq_care_crop_zones(p_state)) AS spatial)
 SELECT COALESCE(jsonb_agg(jsonb_build_object('productCode',i.product_code,
   'quantity',CASE WHEN spatial AND cardinality(public.kq_care_pbi_pests(i.product_code))>0
     THEN i.quantity::BIGINT*units+i.area_quantity ELSE i.quantity::BIGINT+i.area_quantity/units END,
   'legacyQuantity',i.quantity,'areaQuantity',i.area_quantity) ORDER BY i.product_code),'[]'::JSONB)
 FROM public.kq_care_inventory i CROSS JOIN scope WHERE i.user_id=p_user
$$;
REVOKE ALL ON FUNCTION public.kq_care_inventory_for_run(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;

-- Keep the existing quote, wallet, work and replay logic. Only the inventory
-- representation depends on whether the selected run supports a one-cell PBI.
DO $$ DECLARE body TEXT; old TEXT; BEGIN
 body:=pg_get_functiondef('public.rpc_kq_care_shop_v2(uuid,uuid)'::regprocedure);
 old:='public.kq_care_inventory_for_scope(p_user_id,(pricing->>''pricingUnits'')::INTEGER)';
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'kq_care_shop_inventory_drift'; END IF;
 EXECUTE replace(body,old,'public.kq_care_inventory_for_run(p_user_id,run.state)');
 body:=pg_get_functiondef('public.rpc_kq_purchase_care_v2(uuid,text,integer,uuid,uuid,integer)'::regprocedure);
 old:='public.kq_care_inventory_for_scope(p_user_id,COALESCE(old.pricing_units,1))';
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'kq_care_purchase_replay_drift'; END IF;
 body:=replace(body,old,'public.kq_care_inventory_for_run(p_user_id,(SELECT r.state FROM public.kq_runs r WHERE r.id=old.run_id AND r.user_id=p_user_id))');
 old:='public.kq_care_inventory_for_scope(p_user_id,units)';
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'kq_care_purchase_inventory_drift'; END IF;
 EXECUTE replace(body,old,'public.kq_care_inventory_for_run(p_user_id,run.state)');
END $$;

DROP FUNCTION public.rpc_kq_care_intervention_receipt(UUID,UUID,UUID,TEXT);
CREATE FUNCTION public.rpc_kq_care_intervention_receipt(
 p_user_id UUID,p_run_id UUID,p_request_key UUID,p_product_code TEXT,p_target JSONB DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE receipt public.kq_care_interventions%ROWTYPE; run public.kq_runs%ROWTYPE; cash INTEGER;
BEGIN
 SELECT * INTO receipt FROM public.kq_care_interventions WHERE user_id=p_user_id AND request_key=p_request_key;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF receipt.run_id IS DISTINCT FROM p_run_id OR receipt.product_code IS DISTINCT FROM p_product_code
   OR receipt.target IS DISTINCT FROM p_target THEN RAISE EXCEPTION 'kq_care_request_mismatch'; END IF;
 SELECT * INTO run FROM public.kq_runs WHERE id=p_run_id AND user_id=p_user_id;
 PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
 RETURN jsonb_build_object('state',run.state,'updatedAt',run.updated_at,'inventory',public.kq_care_inventory_for_run(p_user_id,run.state),
   'cashCents',cash,'chargedCents',receipt.charged_cents,'replayed',TRUE);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_care_intervention_receipt(UUID,UUID,UUID,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_care_intervention_receipt(UUID,UUID,UUID,TEXT,JSONB) TO service_role;

-- The public workday wrapper charges once after this transaction succeeds.
-- Its signature stays compatible. The last appended application carries the
-- target computed by the server and verified against the locked save below.
CREATE OR REPLACE FUNCTION public.kq_work_inner_apply_care(
 p_user_id UUID,p_run_id UUID,p_product_code TEXT,p_request_key UUID,p_expected_updated_at TIMESTAMPTZ,
 p_next_state JSONB,p_basic_price_cents INTEGER DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE run public.kq_runs%ROWTYPE; replay JSONB; step INTEGER; updated TIMESTAMPTZ;
 cash INTEGER; charge INTEGER:=0; pricing JSONB; units INTEGER; area INTEGER; care JSONB; next_care JSONB;
 target JSONB; pests TEXT[]:=public.kq_care_pbi_pests(p_product_code); application JSONB; intervention JSONB;
BEGIN
 IF p_user_id IS NULL OR p_run_id IS NULL OR p_request_key IS NULL OR p_expected_updated_at IS NULL OR p_next_state IS NULL
   OR (p_product_code IS NOT NULL AND public.kq_care_price(p_product_code) IS NULL) THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM public.kq_campaign_assert_leader(p_user_id,p_run_id,p_next_state);
 PERFORM public.kq_business_settle(p_user_id);
 PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO run FROM public.kq_runs WHERE id=p_run_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
 next_care:=p_next_state->'care';
 IF p_product_code IS NOT NULL THEN target:=next_care->'applications'->-1->'target'; END IF;
 replay:=public.rpc_kq_care_intervention_receipt(p_user_id,p_run_id,p_request_key,p_product_code,target);
 IF replay IS NOT NULL THEN RETURN replay; END IF;
 IF run.status<>'active' THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
 IF run.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'kq_stale_run'; END IF;
 IF run.state->'rulesVersion' IS DISTINCT FROM '3'::JSONB THEN RAISE EXCEPTION 'kq_care_legacy_run'; END IF;
 step:=(run.state->>'stageIndex')::INTEGER+CASE WHEN run.state->>'phase'='resolved' THEN 1 ELSE 0 END;
 care:=run.state->'care'; pricing:=public.kq_care_pricing(run.state);
 units:=(pricing->>'pricingUnits')::INTEGER; area:=(pricing->>'areaM2')::INTEGER;
 IF run.state->>'phase' NOT IN ('prepare','rolled','resolved') OR step NOT BETWEEN 0 AND 4
   OR (p_next_state-'care') IS DISTINCT FROM (run.state-'care') OR NOT public.kq_care_state_valid(next_care)
   OR next_care IS NOT DISTINCT FROM care THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
 IF p_product_code IS NULL THEN
   charge:=(pricing->>'basicCarePriceCents')::INTEGER;
   IF p_basic_price_cents IS DISTINCT FROM charge THEN RAISE EXCEPTION 'kq_care_price_changed'; END IF;
   IF care->'lastBasicCareStage'=to_jsonb(step) OR next_care->'lastBasicCareStage' IS DISTINCT FROM to_jsonb(step)
     OR (next_care-'lastBasicCareStage'-'history') IS DISTINCT FROM (care-'lastBasicCareStage'-'history')
     THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
   IF cash<charge THEN RAISE EXCEPTION 'kq_care_basic_insufficient_cash'; END IF;
   PERFORM public.kq_treasury_initialize(p_user_id);
   UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-charge,updated_at=now() WHERE user_id=p_user_id;
   PERFORM public.kq_treasury_pair(p_user_id,'culture-care','culture-care:'||p_request_key::TEXT,
     now(),'expense_maintenance','suspense',charge,'Entretien de culture · étape '||(step+1)::TEXT);
 ELSE
   IF cardinality(pests)>0 AND EXISTS(SELECT FROM public.kq_care_crop_zones(run.state)) THEN
     IF NOT public.kq_care_sector_shape(target) THEN RAISE EXCEPTION 'kq_care_invalid_target'; END IF;
     IF NOT EXISTS(SELECT FROM public.kq_care_crop_zones(run.state) z WHERE z->>'id'=target->>'zoneId'
       AND (target->>'x')::INTEGER<(z->>'width')::INTEGER AND (target->>'y')::INTEGER<(z->>'height')::INTEGER)
       THEN RAISE EXCEPTION 'kq_care_invalid_target'; END IF;
   ELSIF target IS NOT NULL THEN RAISE EXCEPTION 'kq_care_invalid_target'; END IF;
   application:=jsonb_build_object('productCode',p_product_code,'stageIndex',step);
   IF target IS NOT NULL THEN application:=application||jsonb_build_object('target',target); END IF;
   intervention:=application||jsonb_build_object('status','installing','remainingSteps',
     CASE WHEN cardinality(pests)>0 OR p_product_code='CARE-VERMICOMPOST' THEN 2 ELSE 1 END);
   IF next_care->'applications' IS DISTINCT FROM ((care->'applications')||jsonb_build_array(application))
     OR next_care->'interventions' IS DISTINCT FROM ((care->'interventions')||jsonb_build_array(intervention))
     OR (next_care-'applications'-'interventions'-'history') IS DISTINCT FROM (care-'applications'-'interventions'-'history')
     OR jsonb_array_length(next_care->'applications')>12 OR jsonb_array_length(next_care->'interventions')>4
     OR EXISTS(SELECT FROM jsonb_array_elements(care->'applications') a WHERE a->>'productCode'=p_product_code
       AND a->'stageIndex'=to_jsonb(step) AND (target IS NULL OR NOT a ? 'target' OR a->'target'=target))
     OR EXISTS(SELECT FROM jsonb_array_elements(care->'interventions') i WHERE
       (i->>'productCode'=p_product_code OR public.kq_care_pbi_pests(i->>'productCode') && pests)
       AND (target IS NULL OR NOT i ? 'target' OR i->'target'=target))
     THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
   IF cardinality(pests)>0 AND (step>=4 OR NOT EXISTS(SELECT FROM jsonb_array_elements(care->'problems') p WHERE p->>'code'=ANY(pests))
     OR (p_product_code='CARE-PHYTOSEIULUS' AND care->'problems' @> '[{"code":"HEAT"}]'::JSONB))
     THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
   IF target IS NOT NULL THEN
     UPDATE public.kq_care_inventory SET quantity=quantity-CASE WHEN area_quantity=0 THEN 1 ELSE 0 END,
       area_quantity=CASE WHEN area_quantity>0 THEN area_quantity-1 ELSE units-1 END,updated_at=now()
       WHERE user_id=p_user_id AND product_code=p_product_code AND (area_quantity>0 OR quantity>0);
     units:=1; area:=1;
   ELSE
     UPDATE public.kq_care_inventory SET quantity=quantity-CASE WHEN quantity>0 THEN 1 ELSE 0 END,
       area_quantity=area_quantity-CASE WHEN quantity>0 THEN 0 ELSE units END,updated_at=now()
       WHERE user_id=p_user_id AND product_code=p_product_code AND (quantity>0 OR area_quantity>=units);
   END IF;
   IF NOT FOUND THEN RAISE EXCEPTION 'kq_care_stock_unavailable'; END IF;
 END IF;
 updated:=GREATEST(clock_timestamp(),run.updated_at+interval '1 microsecond');
 UPDATE public.kq_runs SET state=p_next_state,updated_at=updated WHERE id=p_run_id;
 INSERT INTO public.kq_care_interventions(user_id,request_key,run_id,product_code,stage_index,charged_cents,area_m2,pricing_units,target)
   VALUES(p_user_id,p_request_key,p_run_id,p_product_code,step,charge,area,units,target);
 RETURN jsonb_build_object('state',p_next_state,'updatedAt',updated,'inventory',public.kq_care_inventory_for_run(p_user_id,run.state),
   'cashCents',cash-charge,'chargedCents',charge,'replayed',FALSE);
END $$;
REVOKE ALL ON FUNCTION public.kq_work_inner_apply_care(UUID,UUID,TEXT,UUID,TIMESTAMPTZ,JSONB,INTEGER) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
