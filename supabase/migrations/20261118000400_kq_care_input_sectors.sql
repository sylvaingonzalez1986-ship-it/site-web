BEGIN;

-- A receipt fixes the consumed unit, independently of the area of the lot
-- bought at the retailer. Older full-pass receipts have no target.
ALTER TABLE public.kq_care_interventions DROP CONSTRAINT kq_care_intervention_target,
 ADD CONSTRAINT kq_care_intervention_target CHECK(target IS NULL OR
   (public.kq_care_sector_shape(target) AND product_code IS NOT NULL
    AND public.kq_care_price(product_code) IS NOT NULL
    AND area_m2 IS NOT DISTINCT FROM 1 AND pricing_units IS NOT DISTINCT FROM 1));

CREATE OR REPLACE FUNCTION public.kq_care_inventory_for_run(p_user UUID,p_state JSONB) RETURNS JSONB
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 WITH scope AS (SELECT (public.kq_care_pricing(p_state)->>'pricingUnits')::INTEGER AS units,
   EXISTS(SELECT FROM public.kq_care_crop_zones(p_state)) AS spatial)
 SELECT COALESCE(jsonb_agg(jsonb_build_object('productCode',i.product_code,
   'quantity',CASE WHEN spatial THEN i.quantity::BIGINT*units+i.area_quantity
     ELSE i.quantity::BIGINT+i.area_quantity/units END,
   'legacyQuantity',i.quantity,'areaQuantity',i.area_quantity) ORDER BY i.product_code),'[]'::JSONB)
 FROM public.kq_care_inventory i CROSS JOIN scope WHERE i.user_id=p_user
$$;
REVOKE ALL ON FUNCTION public.kq_care_inventory_for_run(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;

-- One input at one stage can cover several separately purchased square
-- metres. Each PBI cell continues to occupy one intervention slot.
CREATE FUNCTION public.kq_care_treatment_count(p_entries JSONB) RETURNS BIGINT
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT count(*) FILTER (WHERE cardinality(public.kq_care_pbi_pests(a->>'productCode'))>0)
      + count(DISTINCT (a->>'productCode',a->>'stageIndex'))
        FILTER (WHERE cardinality(public.kq_care_pbi_pests(a->>'productCode'))=0)
 FROM jsonb_array_elements(p_entries) a
$$;
REVOKE ALL ON FUNCTION public.kq_care_treatment_count(JSONB) FROM PUBLIC,anon,authenticated,service_role;

-- Keep the existing replay, frozen footprint, workday, treasury and stock
-- operations within the same locked transaction. Only change which products
-- require a cell, and the application limits for distributing an input.
DO $migration$
DECLARE body TEXT; old_guard TEXT; new_guard TEXT;
BEGIN
 body:=pg_get_functiondef('public.kq_work_inner_apply_care(uuid,uuid,text,uuid,timestamptz,jsonb,integer)'::regprocedure);
 old_guard:='IF cardinality(pests)>0 AND EXISTS(SELECT FROM public.kq_care_crop_zones(run.state)) THEN';
 IF strpos(body,old_guard)=0 THEN RAISE EXCEPTION 'kq_care_sector_guard_drift'; END IF;
 body:=replace(body,old_guard,'IF EXISTS(SELECT FROM public.kq_care_crop_zones(run.state)) THEN');
 old_guard:='OR jsonb_array_length(next_care->''applications'')>12 OR jsonb_array_length(next_care->''interventions'')>4';
 IF strpos(body,old_guard)=0 THEN RAISE EXCEPTION 'kq_care_treatment_limit_drift'; END IF;
 new_guard:=$guard$OR jsonb_array_length(next_care->'applications')>2012 OR jsonb_array_length(next_care->'interventions')>2012
     OR public.kq_care_treatment_count(next_care->'applications')>12
     OR public.kq_care_treatment_count(next_care->'interventions')>4
     OR (cardinality(pests)=0 AND (
       (p_product_code='CARE-ORGANIC-FEED' AND care->'problems' @> '[{"code":"SALTS"}]'::JSONB)
       OR EXISTS(SELECT FROM jsonb_array_elements(care->'applications') a
         WHERE cardinality(public.kq_care_pbi_pests(a->>'productCode'))=0
           AND ((a->>'productCode'=p_product_code) IS DISTINCT FROM (a->'stageIndex'=to_jsonb(step))))
       OR (SELECT count(DISTINCT (a->>'productCode',a->>'stageIndex'))
           FROM jsonb_array_elements(next_care->'applications') a
           WHERE cardinality(public.kq_care_pbi_pests(a->>'productCode'))=0)>2))$guard$;
 EXECUTE replace(body,old_guard,new_guard);
END
$migration$;
REVOKE ALL ON FUNCTION public.kq_work_inner_apply_care(UUID,UUID,TEXT,UUID,TIMESTAMPTZ,JSONB,INTEGER) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
