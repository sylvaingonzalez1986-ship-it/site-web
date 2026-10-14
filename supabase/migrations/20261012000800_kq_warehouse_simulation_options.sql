BEGIN;

-- Fictional game balance only. No product specifications, recipes or schedules.
-- Kept in lockstep with kanab-quest-warehouse-options.ts by executable SQL tests.
CREATE FUNCTION public.kq_warehouse_option(p_code TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT jsonb_build_object('code',code,'family',family,'equipmentCentsPerM2',price,
  'consumablesCentsPerM2',recurring,'yieldBonusPercent',yield_bonus,'qualityBonus',quality_bonus)
 FROM (VALUES
 ('SIM-WATER-01','water',900,70,1,0),('SIM-WATER-02','water',1900,140,2,0),('SIM-WATER-03','water',3200,240,3,0),
 ('SIM-CLIMATE-01','climate',1400,90,1,0),('SIM-CLIMATE-02','climate',2800,190,0,1),('SIM-CLIMATE-03','climate',4600,340,2,1),
 ('SIM-CONTROL-01','control',600,40,1,0),('SIM-CONTROL-02','control',1500,100,2,0),('SIM-CONTROL-03','control',2900,180,1,1),
 ('SIM-HYGIENE-01','hygiene',400,80,1,0),('SIM-HYGIENE-02','hygiene',1100,160,0,1),('SIM-HYGIENE-03','hygiene',2000,260,1,1),
 ('SIM-LOGISTICS-01','logistics',700,35,1,0),('SIM-LOGISTICS-02','logistics',1600,80,2,0),('SIM-LOGISTICS-03','logistics',2800,150,3,0),
 ('SIM-SECURITY-01','security',800,50,1,0),('SIM-SECURITY-02','security',1800,110,2,0),('SIM-SECURITY-03','security',3000,180,1,1),
 ('SIM-SUBSTRATE-01','substrate',300,160,1,0),('SIM-SUBSTRATE-02','substrate',650,290,0,1),('SIM-SUBSTRATE-03','substrate',1000,460,2,1),
 ('SIM-NUTRITION-01','nutrition',250,180,1,0),('SIM-NUTRITION-02','nutrition',500,320,2,0),('SIM-NUTRITION-03','nutrition',900,520,1,1)
 ) AS catalog(code,family,price,recurring,yield_bonus,quality_bonus) WHERE code=p_code;
$$;

CREATE FUNCTION public.kq_warehouse_options_projection(p_state JSONB) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE zone JSONB; item JSONB; option JSONB; code TEXT; family TEXT; families TEXT[];
 inventory JSONB:=COALESCE(p_state->'optionInventory','[]'::JSONB); demand JSONB:='{}'::JSONB;
 seen TEXT[]:='{}'; area INTEGER; active_area INTEGER:=0; yield_bonus INTEGER; quality_bonus INTEGER;
 recurring BIGINT:=0; potential NUMERIC:=0; quality_sum BIGINT:=0; amount INTEGER;
BEGIN
 IF jsonb_typeof(inventory) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
 IF jsonb_array_length(inventory)>24 THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(inventory) LOOP
  code:=item->>'code'; option:=public.kq_warehouse_option(code);
  IF option IS NULL OR code=ANY(seen) OR jsonb_typeof(item->'quantity') IS DISTINCT FROM 'number'
   THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
  IF (item->>'quantity')::NUMERIC NOT BETWEEN 0 AND 100000 OR trunc((item->>'quantity')::NUMERIC)<>(item->>'quantity')::NUMERIC
   THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
  seen:=array_append(seen,code);
 END LOOP;
 IF jsonb_typeof(p_state->'zones') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
 FOR zone IN SELECT * FROM jsonb_array_elements(p_state->'zones') LOOP
  IF jsonb_typeof(zone->'width') IS DISTINCT FROM 'number' OR jsonb_typeof(zone->'height') IS DISTINCT FROM 'number'
   OR jsonb_typeof(zone->'active') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
  IF (zone->>'width')::NUMERIC NOT BETWEEN 1 AND 40 OR (zone->>'height')::NUMERIC NOT BETWEEN 1 AND 25
   OR trunc((zone->>'width')::NUMERIC)<>(zone->>'width')::NUMERIC OR trunc((zone->>'height')::NUMERIC)<>(zone->>'height')::NUMERIC
   THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
  area:=(zone->>'width')::INTEGER*(zone->>'height')::INTEGER;
  families:='{}'; yield_bonus:=0; quality_bonus:=0;
  IF zone ? 'optionCodes' THEN
   IF jsonb_typeof(zone->'optionCodes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
   IF jsonb_array_length(zone->'optionCodes')>8 THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
   FOR item IN SELECT * FROM jsonb_array_elements(zone->'optionCodes') LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
    code:=item#>>'{}'; option:=public.kq_warehouse_option(code); family:=option->>'family';
    IF option IS NULL OR family=ANY(families) THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
    families:=array_append(families,family);
    demand:=jsonb_set(demand,ARRAY[code],to_jsonb(COALESCE((demand->>code)::INTEGER,0)+area));
    yield_bonus:=yield_bonus+(option->>'yieldBonusPercent')::INTEGER;
    quality_bonus:=quality_bonus+(option->>'qualityBonus')::INTEGER;
    IF (zone->>'active')::BOOLEAN THEN recurring:=recurring+area*(option->>'consumablesCentsPerM2')::INTEGER; END IF;
   END LOOP;
  END IF;
  IF (zone->>'active')::BOOLEAN THEN
   active_area:=active_area+area;
   potential:=potential+area*250::NUMERIC*(100+LEAST(20,yield_bonus))/100;
   quality_sum:=quality_sum+area*LEAST(4,quality_bonus);
  END IF;
 END LOOP;
 FOR code, item IN SELECT key,value FROM jsonb_each(demand) LOOP
  SELECT COALESCE(sum((entry->>'quantity')::INTEGER),0) INTO amount FROM jsonb_array_elements(inventory) entry WHERE entry->>'code'=code;
  IF amount<(item#>>'{}')::INTEGER THEN RAISE EXCEPTION 'warehouse_options_missing'; END IF;
 END LOOP;
 RETURN jsonb_build_object('activeAreaM2',active_area,'estimatedHarvestGrams',potential,
  'consumablesCostCents',active_area*2200+recurring,'qualityBonus',CASE WHEN active_area>0 THEN quality_sum/active_area ELSE 0 END,
  'hasOptions',demand<>'{}'::JSONB);
END $$;

CREATE FUNCTION public.kq_warehouse_validate_options_change(p_previous JSONB,p_next JSONB,p_cost INTEGER) RETURNS VOID
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE item JSONB; old_quantity INTEGER; new_quantity INTEGER; module_cost BIGINT:=0;
BEGIN
 PERFORM public.kq_warehouse_options_projection(p_next);
 FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_previous->'optionInventory','[]'::JSONB)) LOOP
  SELECT COALESCE(sum((entry->>'quantity')::INTEGER),0) INTO new_quantity
   FROM jsonb_array_elements(COALESCE(p_next->'optionInventory','[]'::JSONB)) entry WHERE entry->>'code'=item->>'code';
  IF new_quantity<(item->>'quantity')::INTEGER THEN RAISE EXCEPTION 'warehouse_inventory_loss'; END IF;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_next->'optionInventory','[]'::JSONB)) LOOP
  SELECT COALESCE(sum((entry->>'quantity')::INTEGER),0) INTO old_quantity
   FROM jsonb_array_elements(COALESCE(p_previous->'optionInventory','[]'::JSONB)) entry WHERE entry->>'code'=item->>'code';
  module_cost:=module_cost+GREATEST(0,(item->>'quantity')::INTEGER-old_quantity)*(public.kq_warehouse_option(item->>'code')->>'equipmentCentsPerM2')::BIGINT;
 END LOOP;
 -- The service validates the complete device/preparation quote. This guard also
 -- prevents a module purchase below its independently computed game price.
 IF p_cost<round(module_cost*1.15) THEN RAISE EXCEPTION 'warehouse_price_changed'; END IF;
END $$;

CREATE FUNCTION public.kq_warehouse_validate_options_run(p_warehouse JSONB) RETURNS VOID
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE expected JSONB:=public.kq_warehouse_options_projection(p_warehouse->'sourceState'); field TEXT;
BEGIN
 FOREACH field IN ARRAY ARRAY['activeAreaM2','estimatedHarvestGrams','consumablesCostCents'] LOOP
  IF p_warehouse->field IS DISTINCT FROM expected->field THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 END LOOP;
 IF (expected->>'hasOptions')::BOOLEAN THEN
  IF p_warehouse->'qualityBonus' IS DISTINCT FROM expected->'qualityBonus' THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 ELSIF p_warehouse ? 'qualityBonus' THEN RAISE EXCEPTION 'warehouse_layout_changed';
 END IF;
END $$;

-- Add guards inside the existing transactions; receipt replay, wallet locks,
-- historical runs and the 120-hour supplier invoice lifecycle stay unchanged.
DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 SELECT replace(pg_get_functiondef('public.rpc_kq_warehouse_save(uuid,uuid,jsonb,integer,jsonb,jsonb,integer)'::regprocedure),E'\r\n',E'\n') INTO body;
 anchor:='credit_used:=LEAST(layout.migration_credit_cents,p_cost_cents);';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'warehouse_options_save_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,'PERFORM public.kq_warehouse_validate_options_change(layout.state,p_next_state,p_cost_cents);'||E'\n  '||anchor);
 SELECT replace(pg_get_functiondef('public.kq_validate_warehouse_run_start(uuid,uuid,jsonb)'::regprocedure),E'\r\n',E'\n') INTO body;
 anchor:='potential:=(warehouse->>''estimatedHarvestGrams'')::NUMERIC;';
 IF strpos(body,anchor)=0 OR strpos(body,'NOT BETWEEN 0.1 AND 250000')=0 THEN RAISE EXCEPTION 'warehouse_options_run_anchor_changed'; END IF;
 body:=replace(body,'NOT BETWEEN 0.1 AND 250000','NOT BETWEEN 0.1 AND 300000');
 EXECUTE replace(body,anchor,'PERFORM public.kq_warehouse_validate_options_run(warehouse);'||E'\n '||anchor);
END $$;

REVOKE ALL ON FUNCTION public.kq_warehouse_option(TEXT),public.kq_warehouse_options_projection(JSONB),
 public.kq_warehouse_validate_options_change(JSONB,JSONB,INTEGER),public.kq_warehouse_validate_options_run(JSONB)
 FROM PUBLIC,anon,authenticated,service_role;
-- The named RPC keeps its existing service_role-only EXECUTE grant. No new
-- table, broad grant or new direct Data API write path is introduced.
COMMIT;
