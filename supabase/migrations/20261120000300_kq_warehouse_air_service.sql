BEGIN;

-- Confirm the server's cached allocation on writes. A zone run subsequently
-- reads its original share even when its validator narrows the floor to one zone.
CREATE FUNCTION public.kq_warehouse_air_service(plan jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE
 cols int := coalesce((plan#>>'{floor,columns}')::int,40);
 rows int := coalesce((plan#>>'{floor,rows}')::int,25);
 fan jsonb; spec jsonb; z jsonb; wall jsonb; result jsonb := '{}';
 owners text[]; active boolean[]; served boolean[]; hosts int[] := '{}'; ids text[] := '{}';
 fx int; fy int; x int; y int; pos int; cells int[]; n int; i int; zid text;
 cap int; reach int; quality int; mw int; watts_share int; zinfo jsonb;
BEGIN
 IF cols NOT BETWEEN 1 AND 40 OR rows NOT BETWEEN 1 AND 25 OR
  jsonb_typeof(plan->'airPlacements') IS DISTINCT FROM 'array' OR
  jsonb_array_length(plan->'airPlacements') > cols*rows THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
 owners := array_fill(NULL::text,ARRAY[cols*rows]);
 active := array_fill(false,ARRAY[cols*rows]);
 served := active;
 FOR z IN SELECT value FROM jsonb_array_elements(plan->'zones') LOOP
  zid := z->>'id';
  result := result || jsonb_build_object(zid,jsonb_build_object('coveredAreaM2',0,'qualityPoints',0,'powerMilliWatts',0));
  FOR y IN (z->>'y')::int .. (z->>'y')::int+(z->>'height')::int-1 LOOP
   FOR x IN (z->>'x')::int .. (z->>'x')::int+(z->>'width')::int-1 LOOP
    IF x NOT BETWEEN 0 AND cols-1 OR y NOT BETWEEN 0 AND rows-1 THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
    pos := 1+y*cols+x; owners[pos] := zid; active[pos] := (z->>'active')::boolean;
   END LOOP;
  END LOOP;
 END LOOP;
 FOR fan IN SELECT value FROM jsonb_array_elements(plan->'airPlacements')
  ORDER BY public.kq_warehouse_device_quality(value->>'code') DESC,(value->>'y')::int,(value->>'x')::int LOOP
  spec := public.kq_warehouse_device(fan->>'code');
  fx := (fan->>'x')::int; fy := (fan->>'y')::int; pos := 1+fy*cols+fx;
  IF spec->>'kind' IS DISTINCT FROM 'air' OR jsonb_typeof(fan->'x') IS DISTINCT FROM 'number'
   OR jsonb_typeof(fan->'y') IS DISTINCT FROM 'number' OR fx NOT BETWEEN 0 AND cols-1 OR fy NOT BETWEEN 0 AND rows-1
   OR jsonb_typeof(fan->'id') IS DISTINCT FROM 'string' OR length(trim(fan->>'id')) NOT BETWEEN 1 AND 80
   OR fan->>'id'=ANY(ids) OR pos=ANY(hosts) THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
  ids := array_append(ids,fan->>'id'); hosts := array_append(hosts,pos);
  FOR wall IN SELECT value FROM jsonb_array_elements(coalesce(plan->'partitions','[]'::jsonb)) LOOP
   IF (CASE wall->>'axis' WHEN 'x' THEN fy=(wall->>'y')::int AND fx BETWEEN (wall->>'x')::int AND (wall->>'x')::int+(wall->>'length')::int-1
    ELSE fx=(wall->>'x')::int AND fy BETWEEN (wall->>'y')::int AND (wall->>'y')::int+(wall->>'length')::int-1 END)
   THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
  END LOOP;
  cap := (spec#>>'{gameCapacity,value}')::int; reach := ceil(sqrt(cap)); mw := (spec->>'watts')::int*1000;
  quality := public.kq_warehouse_device_quality(fan->>'code');
  SELECT array_agg(cell ORDER BY live DESC, dist, cell), count(*) FILTER(WHERE live)
   INTO cells,n FROM (
    SELECT cell, active[cell] live, abs(cx-fx)+abs(cy-fy) dist
    FROM generate_series(1,cols*rows) cell CROSS JOIN LATERAL (SELECT (cell-1)%cols cx,(cell-1)/cols cy) xy
    WHERE owners[cell] IS NOT NULL AND NOT served[cell] AND abs(cx-fx)+abs(cy-fy)<=reach
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(plan->'partitions','[]'::jsonb)) w
     CROSS JOIN LATERAL (SELECT w->>'axis'='x' horizontal,(w->>'x')::int wx,(w->>'y')::int wy,(w->>'length')::int len) v
     WHERE CASE WHEN horizontal AND cy=fy THEN fy=wy AND least(cx,fx)+0.5<=wx+len AND greatest(cx,fx)+0.5>=wx
      WHEN NOT horizontal AND cx=fx THEN fx=wx AND least(cy,fy)+0.5<=wy+len AND greatest(cy,fy)+0.5>=wy
      WHEN horizontal THEN wy BETWEEN least(cy,fy) AND greatest(cy,fy) AND
      fx+0.5+(cx-fx)*(wy-fy)::numeric/nullif(cy-fy,0) BETWEEN wx AND wx+len
      ELSE wx BETWEEN least(cx,fx) AND greatest(cx,fx) AND
      fy+0.5+(cy-fy)*(wx-fx)::numeric/nullif(cx-fx,0) BETWEEN wy AND wy+len END)
    ORDER BY live DESC, dist, cell LIMIT cap
   ) nearest;
  FOR i IN 1 .. coalesce(cardinality(cells),0) LOOP
   pos := cells[i]; served[pos] := true; zid := owners[pos]; zinfo := result->zid;
   watts_share := CASE WHEN active[pos] THEN mw/n + CASE WHEN i<=mw%n THEN 1 ELSE 0 END ELSE 0 END;
   result := jsonb_set(result,ARRAY[zid],jsonb_build_object('coveredAreaM2',(zinfo->>'coveredAreaM2')::int+1,
    'qualityPoints',(zinfo->>'qualityPoints')::int+quality,'powerMilliWatts',(zinfo->>'powerMilliWatts')::int+watts_share));
  END LOOP;
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_air_service(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_warehouse_check_air_service() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.state ? 'airPlacements' THEN
  IF NEW.state->'airService' IS DISTINCT FROM public.kq_warehouse_air_service(NEW.state)
  THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 ELSIF NEW.state ? 'airService' OR TG_OP='UPDATE' AND OLD.state ? 'airPlacements' THEN
  RAISE EXCEPTION 'warehouse_layout_changed';
 END IF;
 IF TG_OP='UPDATE' AND OLD.state->'airService' IS DISTINCT FROM NEW.state->'airService' THEN
  IF EXISTS(SELECT 1 FROM public.kq_runs r WHERE r.user_id=OLD.user_id AND r.status='active'
    AND (r.warehouse_zone_id IS NULL OR OLD.state->'airService'->r.warehouse_zone_id
     IS DISTINCT FROM NEW.state->'airService'->r.warehouse_zone_id))
  THEN RAISE EXCEPTION 'warehouse_zone_in_use'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_check_air_service() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_warehouse_check_air_service BEFORE INSERT OR UPDATE OF state ON public.kq_warehouse_layouts
 FOR EACH ROW EXECUTE FUNCTION public.kq_warehouse_check_air_service();

-- Patch the existing validators at their original arithmetic. This preserves
-- the subsequent billing, staff, wear and per-zone wrappers and their grants.
CREATE FUNCTION pg_temp.kq_air_patch(target regprocedure, needle text, replacement text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE def text := pg_get_functiondef(target);
BEGIN
 IF strpos(def,needle)=0 THEN RAISE EXCEPTION 'warehouse_air_anchor_missing % %',target,needle; END IF;
 EXECUTE replace(def,needle,replacement);
END $$;
SELECT pg_temp.kq_air_patch('public.kq_warehouse_catalog_before_postharvest(jsonb)',
 'amount:=ceil(area/', $patch$IF kind='air' AND p_state ? 'airPlacements' THEN
    amount:=(p_state->'airService'->(zone->>'id')->>'powerMilliWatts')::numeric/1000;
    IF amount IS NULL THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
    zone_power:=zone_power+amount; zone_energy:=zone_energy+amount*1440/1000;
    CONTINUE;
   END IF;
   amount:=ceil(area/$patch$);
SELECT pg_temp.kq_air_patch('public.kq_warehouse_catalog_before_postharvest(jsonb)',
 'FOR code,item IN SELECT key,value FROM jsonb_each(demand)', $patch$IF p_state ? 'airPlacements' THEN
   FOR code,amount IN SELECT f->>'code',count(*) FROM jsonb_array_elements(p_state->'airPlacements') f GROUP BY 1 LOOP
    demand:=jsonb_set(demand,ARRAY[code],to_jsonb(amount));
   END LOOP;
   energy_cost:=round(energy*25);
  END IF;
  FOR code,item IN SELECT key,value FROM jsonb_each(demand)$patch$);
SELECT pg_temp.kq_air_patch('public.kq_warehouse_options_projection(jsonb)',
 'potential NUMERIC:=0;', 'potential NUMERIC:=0; saving_cents INTEGER:=0;');
SELECT pg_temp.kq_air_patch('public.kq_warehouse_options_projection(jsonb)',
 'yield_bonus:=yield_bonus+(option->>''yieldBonusPercent'')::INTEGER;', $patch$IF p_state ? 'airPlacements' AND option->>'family' IN ('logistics','security','hygiene') THEN
    IF option->>'family'='hygiene' THEN module_quality:=module_quality+right(code,2)::int;
    ELSE
     saving_cents:=saving_cents+area*(CASE code
      WHEN 'SIM-LOGISTICS-01' THEN 110 WHEN 'SIM-LOGISTICS-03' THEN 310
      WHEN 'SIM-SECURITY-01' THEN 125 WHEN 'SIM-SECURITY-02' THEN 250 WHEN 'SIM-SECURITY-03' THEN 400 ELSE 0 END);
    END IF;
    CONTINUE;
   END IF;
   yield_bonus:=yield_bonus+(option->>'yieldBonusPercent')::INTEGER;$patch$);
SELECT pg_temp.kq_air_patch('public.kq_warehouse_options_projection(jsonb)',
 'RETURN result||jsonb_build_object(''estimatedHarvestGrams'',potential,',
 'RETURN result||jsonb_build_object(''consumablesCostCents'',(result->>''consumablesCostCents'')::bigint-saving_cents,''estimatedHarvestGrams'',potential,');
SELECT pg_temp.kq_air_patch('public.kq_warehouse_options_projection(jsonb)',
 'device_quality:=public.kq_warehouse_device_quality', $patch$IF p_state ? 'airPlacements' THEN
   quality_sum:=quality_sum+area*(LEAST(4,module_quality)+public.kq_warehouse_device_quality(zone->>'lightingCode'))
    +(p_state->'airService'->(zone->>'id')->>'qualityPoints')::integer;
   potential:=potential+round(250::numeric*(100+LEAST(24,yield_bonus))/100*
    (area*0.75+(p_state->'airService'->(zone->>'id')->>'coveredAreaM2')::integer*0.25),3);
   CONTINUE;
  END IF;
  device_quality:=public.kq_warehouse_device_quality$patch$);
SELECT pg_temp.kq_air_patch('public.kq_warehouse_validate_assets(jsonb,jsonb)',
 'expected:=ceil(', $patch$IF p_state ? 'airPlacements' AND code=zone->>'airCode' THEN
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_assets) a WHERE a->>'code'=code AND a->>'zoneId'=zone->>'id')
    THEN RAISE EXCEPTION 'warehouse_condition_invalid'; END IF;
    CONTINUE;
   END IF;
   expected:=ceil($patch$);
SELECT pg_temp.kq_air_patch('public.kq_staff_production_layout_guard()',
 'IF before_zone IS DISTINCT FROM after_zone THEN',
 'IF before_zone IS DISTINCT FROM after_zone OR OLD.state->''airService''->zone_id IS DISTINCT FROM NEW.state->''airService''->zone_id THEN');
-- The deletion RPC recomputes the cache after deleting a zone; the trigger
-- validates it while the existing transaction protects paid assets and retries.
DO $$
DECLARE target regprocedure;
BEGIN
 SELECT p.oid::regprocedure INTO STRICT target FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
  AND p.prosrc LIKE '%p_next_state-''zones''-''equipment''-''optionInventory'' IS DISTINCT FROM p_previous_state%';
 PERFORM pg_temp.kq_air_patch(target,
  'p_next_state-''zones''-''equipment''-''optionInventory'' IS DISTINCT FROM p_previous_state-''zones''-''equipment''-''optionInventory''',
  'p_next_state-''airService''-''zones''-''equipment''-''optionInventory'' IS DISTINCT FROM p_previous_state-''airService''-''zones''-''equipment''-''optionInventory''');
END $$;
COMMIT;
