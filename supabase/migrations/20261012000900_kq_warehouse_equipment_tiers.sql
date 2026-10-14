BEGIN;

-- Fictional tiers only. Existing codes, acquisition prices, loads, coverage and
-- container mappings stay intact. No inventory, receipt, wallet, lot or saved
-- run is rewritten. The retired lamp remains usable from its owned reserve.
CREATE FUNCTION public.kq_warehouse_device(p_code TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT jsonb_build_object('code',code,'kind',kind,'tier',tier,'priceCents',price,
  'watts',watts,'purchasable',purchasable,
  'gameCapacity',jsonb_build_object('unit',capacity_unit,'value',capacity))
  || CASE WHEN units_per_m2>0 THEN jsonb_build_object('zoneLayout',
   jsonb_build_object('unitsPerM2',units_per_m2,'capacityGramsPerUnit',grams_per_unit)) ELSE '{}'::JSONB END
 FROM (VALUES
  ('MH-TS1000','lighting','economy',14900,150,true,'m2',1,0,0),
  ('SIM-LIGHT-02','lighting','standard',32900,240,true,'m2',2,0,0),
  ('SIM-LIGHT-03','lighting','premium',74900,400,true,'m2',4,0,0),
  ('MH-FCE3000','lighting','standard',19900,300,false,'m2',2,0,0),
  ('SIM-AIR-01','air','economy',4900,20,true,'m2',8,0,0),
  ('SJ-DF16E350','air','standard',14900,35,true,'m2',20,0,0),
  ('SIM-AIR-03','air','premium',44900,55,true,'m2',50,0,0),
  ('SJ-DRYIT90','drying','economy',3990,0,true,'g',5000,1,1000),
  ('SIM-DRYING-02','drying','standard',9990,0,true,'g',2500,1,2500),
  ('SIM-DRYING-03','drying','premium',19990,0,true,'g',6000,1,6000),
  ('LP-SUPER-1L','storage','economy',2090,0,true,'g',300,4,300),
  ('BROR-JARS-48','storage','standard',25720,0,true,'g',2400,1,2400),
  ('CURTEC-60L','storage','premium',8550,0,true,'g',3000,4,3000),
  ('GV-GP50-7','processing','standard',36999,500,true,'g/batch',80,0,0),
  ('GV-WASHER-36L','processing','standard',12799,250,true,'g/batch',500,0,0)
 ) AS catalog(code,kind,tier,price,watts,purchasable,capacity_unit,capacity,units_per_m2,grams_per_unit)
 WHERE code=p_code;
$$;

CREATE OR REPLACE FUNCTION public.kq_warehouse_drying_capacity_grams(p_state JSONB) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN p_state ? 'serviceZones' THEN
  COALESCE((SELECT sum((z->>'width')::NUMERIC*(z->>'height')::NUMERIC
   *(public.kq_warehouse_device(z->>'deviceCode')->'zoneLayout'->>'unitsPerM2')::NUMERIC
   *(public.kq_warehouse_device(z->>'deviceCode')->'zoneLayout'->>'capacityGramsPerUnit')::NUMERIC)
   FROM jsonb_array_elements(p_state->'serviceZones') z WHERE z->>'kind'='drying'
    AND public.kq_warehouse_device(z->>'deviceCode')->>'kind'='drying'),0)
 ELSE COALESCE((SELECT sum((e->>'quantity')::NUMERIC
   *(public.kq_warehouse_device(e->>'code')->'gameCapacity'->>'value')::NUMERIC)
   FROM jsonb_array_elements(p_state->'equipment') e
   WHERE public.kq_warehouse_device(e->>'code')->>'kind'='drying'),0) END;
$$;

-- Mirrors per-zone whole-device rounding and fictional energy from TypeScript.
-- It runs only on new changes/starts, never against immutable historical runs.
CREATE FUNCTION public.kq_warehouse_catalog_projection(p_state JSONB) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE zone JSONB; item JSONB; device JSONB; code TEXT; kind TEXT; seen TEXT[]:='{}';
 demand JSONB:='{}'; area NUMERIC; amount NUMERIC; zone_energy NUMERIC; zone_power NUMERIC;
 power NUMERIC:=0; energy NUMERIC:=0; energy_cost BIGINT:=0; allocated NUMERIC:=0; inventory JSONB:=p_state->'equipment';
BEGIN
 IF jsonb_typeof(inventory) IS DISTINCT FROM 'array' OR jsonb_typeof(p_state->'zones') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(inventory) LOOP
  code:=item->>'code'; device:=public.kq_warehouse_device(code);
  IF device IS NULL OR code=ANY(seen) OR jsonb_typeof(item->'quantity') IS DISTINCT FROM 'number'
  THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
  amount:=(item->>'quantity')::NUMERIC;
  IF amount NOT BETWEEN 0 AND 100000 OR trunc(amount)<>amount THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
  seen:=array_append(seen,code);
 END LOOP;
 FOR zone IN SELECT * FROM jsonb_array_elements((p_state->'zones')||COALESCE(p_state->'serviceZones','[]'::JSONB)) LOOP
  IF jsonb_typeof(zone->'width') IS DISTINCT FROM 'number' OR jsonb_typeof(zone->'height') IS DISTINCT FROM 'number'
   OR (zone->>'width')::NUMERIC NOT BETWEEN 1 AND 40 OR (zone->>'height')::NUMERIC NOT BETWEEN 1 AND 25
   OR trunc((zone->>'width')::NUMERIC)<>(zone->>'width')::NUMERIC OR trunc((zone->>'height')::NUMERIC)<>(zone->>'height')::NUMERIC
  THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
  area:=(zone->>'width')::NUMERIC*(zone->>'height')::NUMERIC; allocated:=allocated+area;
 END LOOP;
 FOR zone IN SELECT * FROM jsonb_array_elements(p_state->'zones') LOOP
  IF jsonb_typeof(zone->'active') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
  area:=(zone->>'width')::NUMERIC*(zone->>'height')::NUMERIC; zone_power:=0; zone_energy:=0;
  FOREACH kind IN ARRAY ARRAY['lighting','air'] LOOP
   code:=zone->>(CASE kind WHEN 'lighting' THEN 'lightingCode' ELSE 'airCode' END);
   device:=public.kq_warehouse_device(code);
   IF device IS NULL OR device->>'kind'<>kind THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
   amount:=ceil(area/(device->'gameCapacity'->>'value')::NUMERIC);
   demand:=jsonb_set(demand,ARRAY[code],to_jsonb(COALESCE((demand->>code)::NUMERIC,0)+amount));
   zone_power:=zone_power+amount*(device->>'watts')::NUMERIC;
   zone_energy:=zone_energy+amount*(device->>'watts')::NUMERIC*(CASE kind WHEN 'lighting' THEN 1000 ELSE 1440 END)/1000;
  END LOOP;
  IF (zone->>'active')::BOOLEAN THEN
   power:=power+zone_power; energy:=energy+round(zone_energy,3); energy_cost:=energy_cost+round(round(zone_energy,3)*25);
  END IF;
 END LOOP;
 FOR zone IN SELECT * FROM jsonb_array_elements(COALESCE(p_state->'serviceZones','[]'::JSONB)) LOOP
  code:=zone->>'deviceCode'; device:=public.kq_warehouse_device(code);
  IF device IS NULL OR device->>'kind' IS DISTINCT FROM zone->>'kind' OR NOT(device ? 'zoneLayout')
  THEN RAISE EXCEPTION 'warehouse_service_layout_invalid'; END IF;
  amount:=(zone->>'width')::NUMERIC*(zone->>'height')::NUMERIC*(device->'zoneLayout'->>'unitsPerM2')::NUMERIC;
  demand:=jsonb_set(demand,ARRAY[code],to_jsonb(COALESCE((demand->>code)::NUMERIC,0)+amount));
 END LOOP;
 FOR code,item IN SELECT key,value FROM jsonb_each(demand) LOOP
  SELECT COALESCE(sum((entry->>'quantity')::NUMERIC),0) INTO amount FROM jsonb_array_elements(inventory) entry WHERE entry->>'code'=code;
  IF amount<(item#>>'{}')::NUMERIC THEN RAISE EXCEPTION 'warehouse_equipment_missing'; END IF;
 END LOOP;
 RETURN jsonb_build_object('allocatedAreaM2',allocated,'powerWatts',power,'energyKwh',round(energy,3),'energyCostCents',energy_cost);
END $$;

CREATE FUNCTION public.kq_warehouse_validate_catalog_change(p_previous JSONB,p_next JSONB,p_cost INTEGER) RETURNS VOID
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE projection JSONB:=public.kq_warehouse_catalog_projection(p_next); item JSONB; device JSONB;
 old_quantity NUMERIC; added NUMERIC; equipment_cost NUMERIC:=0; expected_cost NUMERIC; prepared NUMERIC;
BEGIN
 prepared:=GREATEST((p_previous->>'preparedAreaM2')::NUMERIC,(projection->>'allocatedAreaM2')::NUMERIC);
 IF prepared>1000 OR jsonb_typeof(p_next->'preparedAreaM2') IS DISTINCT FROM 'number'
  OR (p_next->>'preparedAreaM2')::NUMERIC IS DISTINCT FROM prepared THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_next->'equipment') LOOP
  device:=public.kq_warehouse_device(item->>'code');
  SELECT COALESCE(sum((entry->>'quantity')::NUMERIC),0) INTO old_quantity
   FROM jsonb_array_elements(p_previous->'equipment') entry WHERE entry->>'code'=item->>'code';
  added:=GREATEST(0,(item->>'quantity')::NUMERIC-old_quantity);
  IF added>0 AND NOT(device->>'purchasable')::BOOLEAN THEN RAISE EXCEPTION 'warehouse_device_retired'; END IF;
  IF added>0 AND device->>'kind' IN ('drying','storage') AND NOT(p_next ? 'serviceZones')
  THEN RAISE EXCEPTION 'warehouse_service_plan_required'; END IF;
  equipment_cost:=equipment_cost+added*(device->>'priceCents')::NUMERIC;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_next->'optionInventory','[]'::JSONB)) LOOP
  SELECT COALESCE(sum((entry->>'quantity')::NUMERIC),0) INTO old_quantity
   FROM jsonb_array_elements(COALESCE(p_previous->'optionInventory','[]'::JSONB)) entry WHERE entry->>'code'=item->>'code';
  equipment_cost:=equipment_cost+GREATEST(0,(item->>'quantity')::NUMERIC-old_quantity)
   *(public.kq_warehouse_option(item->>'code')->>'equipmentCentsPerM2')::NUMERIC;
 END LOOP;
 expected_cost:=equipment_cost+round(equipment_cost*0.15)+(prepared-(p_previous->>'preparedAreaM2')::NUMERIC)*12000;
 IF p_cost IS DISTINCT FROM expected_cost THEN RAISE EXCEPTION 'warehouse_price_changed'; END IF;
END $$;

CREATE FUNCTION public.kq_warehouse_validate_catalog_run(p_warehouse JSONB) RETURNS VOID
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE expected JSONB:=public.kq_warehouse_catalog_projection(p_warehouse->'sourceState'); field TEXT;
BEGIN
 IF (p_warehouse->'sourceState'->>'preparedAreaM2')::NUMERIC<(expected->>'allocatedAreaM2')::NUMERIC
 THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 FOREACH field IN ARRAY ARRAY['powerWatts','energyKwh','energyCostCents'] LOOP
  IF p_warehouse->field IS DISTINCT FROM expected->field THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 END LOOP;
END $$;

DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 SELECT pg_get_functiondef('public.kq_warehouse_option(text)'::regprocedure) INTO body;
 anchor:='''code'',code,''family'',family,';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'warehouse_tiers_option_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,anchor||'''tier'',CASE right(code,2) WHEN ''01'' THEN ''economy'' WHEN ''02'' THEN ''standard'' ELSE ''premium'' END,');
 SELECT pg_get_functiondef('public.kq_warehouse_validate_service_change(uuid,jsonb,jsonb)'::regprocedure) INTO body;
 anchor:='OR (zone->>''kind'',zone->>''deviceCode'') NOT IN ((''drying'',''SJ-DRYIT90''),(''storage'',''LP-SUPER-1L''),(''storage'',''BROR-JARS-48''),(''storage'',''CURTEC-60L''))';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'warehouse_tiers_service_anchor_changed'; END IF;
 body:=replace(body,anchor,'OR public.kq_warehouse_device(zone->>''deviceCode'')->>''kind'' IS DISTINCT FROM zone->>''kind'' OR NOT(COALESCE(public.kq_warehouse_device(zone->>''deviceCode'') ? ''zoneLayout'',false))');
 anchor:='CASE z->>''deviceCode'' WHEN ''LP-SUPER-1L'' THEN 4 WHEN ''CURTEC-60L'' THEN 4 ELSE 1 END';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'warehouse_tiers_service_demand_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,'(public.kq_warehouse_device(z->>''deviceCode'')->''zoneLayout''->>''unitsPerM2'')::INTEGER');
 SELECT pg_get_functiondef('public.rpc_kq_warehouse_save(uuid,uuid,jsonb,integer,jsonb,jsonb,integer)'::regprocedure) INTO body;
 anchor:='credit_used:=LEAST(layout.migration_credit_cents,p_cost_cents);';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'warehouse_tiers_save_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,'PERFORM public.kq_warehouse_validate_catalog_change(layout.state,p_next_state,p_cost_cents);'||E'\n  '||anchor);
 SELECT pg_get_functiondef('public.kq_validate_warehouse_run_start(uuid,uuid,jsonb)'::regprocedure) INTO body;
 anchor:='potential:=(warehouse->>''estimatedHarvestGrams'')::NUMERIC;';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'warehouse_tiers_run_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,'PERFORM public.kq_warehouse_validate_catalog_run(warehouse);'||E'\n '||anchor);
END $$;

REVOKE ALL ON FUNCTION public.kq_warehouse_device(TEXT),public.kq_warehouse_drying_capacity_grams(JSONB),
 public.kq_warehouse_catalog_projection(JSONB),public.kq_warehouse_validate_catalog_change(JSONB,JSONB,INTEGER),
 public.kq_warehouse_validate_catalog_run(JSONB) FROM PUBLIC,anon,authenticated,service_role;
-- Existing private RPC grants are preserved by CREATE OR REPLACE. No new table,
-- direct write privilege or broad grant is introduced.
COMMIT;
