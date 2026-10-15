BEGIN;

-- Development combines settled turnover, installed culture area and the net
-- value of all company assets, including financial holdings, less debt.
-- Private relations remain inaccessible through the Data API.
CREATE FUNCTION public.kq_business_development_score(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH layout AS (
  SELECT state FROM public.kq_warehouse_layouts WHERE user_id=p_user_id
 ), footprints AS (
  SELECT z AS zone,true AS culture
  FROM layout CROSS JOIN LATERAL jsonb_array_elements(COALESCE(state->'zones','[]'::JSONB)) z
  UNION ALL
  SELECT z,false
  FROM layout CROSS JOIN LATERAL jsonb_array_elements(COALESCE(state->'serviceZones','[]'::JSONB)) z
 ), dimensions AS (
  SELECT zone,culture,
   CASE WHEN jsonb_typeof(zone->'width')='number' THEN (zone->>'width')::NUMERIC ELSE 0 END AS width,
   CASE WHEN jsonb_typeof(zone->'height')='number' THEN (zone->>'height')::NUMERIC ELSE 0 END AS height
  FROM footprints
 ), allocation AS (
  SELECT COALESCE(SUM(width*height),0) AS allocated_area,
   COALESCE(SUM(width*height) FILTER(WHERE culture),0) AS production_area,
   COALESCE(BOOL_AND(width>0 AND height>0 AND trunc(width)=width AND trunc(height)=height),true) AS valid
  FROM dimensions
 ), culture_devices AS (
  SELECT zone->>'lightingCode' AS code,'lighting'::TEXT AS kind,width*height AS area
  FROM dimensions WHERE culture
  UNION ALL
  SELECT zone->>'airCode','air',width*height FROM dimensions WHERE culture
 ), device_requirements AS (
  SELECT code,
   SUM(CEIL(area/NULLIF((public.kq_warehouse_device(code)->'gameCapacity'->>'value')::NUMERIC,0))) AS quantity,
   BOOL_AND(COALESCE(public.kq_warehouse_device(code)->>'kind'=kind
    AND (public.kq_warehouse_device(code)->'gameCapacity'->>'value')::NUMERIC>0,false)) AS valid
  FROM culture_devices GROUP BY code
 ), warehouse_inventory AS (
  SELECT e->>'code' AS code,SUM(CASE WHEN jsonb_typeof(e->'quantity')='number'
   THEN GREATEST(0,(e->>'quantity')::NUMERIC) ELSE 0 END) AS quantity
  FROM layout CROSS JOIN LATERAL jsonb_array_elements(COALESCE(state->'equipment','[]'::JSONB)) e
  GROUP BY e->>'code'
 ), warehouse_area AS (
  SELECT CASE WHEN allocation.valid AND
    CASE WHEN jsonb_typeof(state->'preparedAreaM2')='number'
     THEN (state->>'preparedAreaM2')::NUMERIC ELSE 0 END >= allocation.allocated_area
    AND NOT EXISTS(SELECT 1 FROM device_requirements r LEFT JOIN warehouse_inventory i USING(code)
     WHERE NOT r.valid OR COALESCE(i.quantity,0)<r.quantity)
   THEN allocation.production_area ELSE 0 END AS area
  FROM layout CROSS JOIN allocation
 ), installed_legacy AS (
  SELECT l.tent_number,l.slot,l.equipment_code
  FROM public.kq_equipment_loadouts l
  JOIN public.kq_player_equipment e USING(user_id,tent_number,equipment_code)
  JOIN public.kq_equipment_catalog c ON c.code=l.equipment_code AND c.slot=l.slot AND c.is_active
  JOIN public.kq_equipment_wallets w ON w.user_id=l.user_id
  WHERE l.user_id=p_user_id AND l.tent_number BETWEEN 1 AND w.production_units
   AND l.slot IN ('tent','lighting','air') AND NOT EXISTS(SELECT 1 FROM layout)
 ), legacy_tents AS (
  SELECT tent_number,CASE WHEN BOOL_OR(slot='lighting') AND BOOL_OR(slot='air') THEN
   MAX(CASE WHEN slot='tent' THEN CASE equipment_code
    WHEN 'TENT-080-STARTER' THEN 0.81 WHEN 'TENT-120' THEN 1.44 WHEN 'TENT-150' THEN 2.25 ELSE 0 END
    ELSE 0 END) ELSE 0 END AS area
  FROM installed_legacy GROUP BY tent_number
 ), production_area AS (
  SELECT CASE WHEN EXISTS(SELECT 1 FROM layout) THEN COALESCE((SELECT area FROM warehouse_area),0)
   ELSE COALESCE((SELECT SUM(area) FROM legacy_tents),0) END AS area
 ), valuation AS MATERIALIZED (
  SELECT public.kq_company_net_value(p_user_id) AS value_cents
 ), components AS (
  SELECT area,value_cents,LEAST(60,FLOOR(area*6/5))::INTEGER AS production,
   LEAST(80,FLOOR(SQRT(GREATEST(0,COALESCE((SELECT vat_sales_ttc_cents FROM public.kq_commerce_accounts
    WHERE user_id=p_user_id),0))::NUMERIC/100)*4/5))::INTEGER AS sales,
   LEAST(60,FLOOR(SQRT(GREATEST(0,value_cents)/100)*3/5))::INTEGER AS company_value
  FROM production_area CROSS JOIN valuation
 ) SELECT jsonb_build_object('score',production+sales+company_value,'production',production,'sales',sales,
   'companyValue',company_value,'productionAreaM2',area,'companyValueCents',value_cents) FROM components;
$$;
REVOKE ALL ON FUNCTION public.kq_business_development_score(UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.kq_business_development_score(UUID) TO service_role;

COMMIT;
