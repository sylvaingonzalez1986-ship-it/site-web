BEGIN;

-- The shared fixtures use the existing funded option units at their original
-- prices. This migration does not rewrite saved layouts or historical runs.
CREATE FUNCTION public.kq_warehouse_station_service(plan jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE
 cols int := coalesce((plan#>>'{floor,columns}')::int,40);
 rows int := coalesce((plan#>>'{floor,rows}')::int,25);
 station jsonb; result jsonb; owners text[] := '{}'; hosts text[] := '{}';
 water_cells int[] := '{}'; hygiene_cells int[] := '{}';
 code text; family text; field text; sx int; sy int; cap int; reach int; position int;
 served record;
BEGIN
 IF cols NOT BETWEEN 1 AND 40 OR rows NOT BETWEEN 1 AND 25
  OR jsonb_typeof(plan->'stationPlacements') IS DISTINCT FROM 'array'
  OR jsonb_array_length(plan->'stationPlacements')>cols*rows
 THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(plan->'zones') z
  WHERE z->'optionCodes' ?| ARRAY['SIM-WATER-03','SIM-HYGIENE-03'])
 THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
 SELECT coalesce(jsonb_object_agg(z->>'id','{"waterAreaM2":0,"hygieneAreaM2":0}'::jsonb),'{}'::jsonb) INTO result
 FROM jsonb_array_elements(plan->'zones') z;
 FOR station IN SELECT value FROM jsonb_array_elements(plan->'stationPlacements')
  ORDER BY (value->>'y')::numeric,(value->>'x')::numeric LOOP
  code := station->>'code'; sx := (station->>'x')::int; sy := (station->>'y')::int;
  IF code IS NULL OR code NOT IN ('SIM-WATER-03','SIM-HYGIENE-03')
   OR jsonb_typeof(station->'id') IS DISTINCT FROM 'string' OR length(trim(station->>'id')) NOT BETWEEN 1 AND 80
   OR jsonb_typeof(station->'x') IS DISTINCT FROM 'number' OR jsonb_typeof(station->'y') IS DISTINCT FROM 'number'
   OR (station->>'x')::numeric<>sx OR (station->>'y')::numeric<>sy
   OR sx NOT BETWEEN 0 AND cols-1 OR sy NOT BETWEEN 0 AND rows-1
   OR station->>'id'=ANY(owners) OR (sx::text||','||sy::text)=ANY(hosts)
   OR (code='SIM-HYGIENE-03' AND (sx<>cols/2 OR sy<>rows-1))
  THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
  owners := array_append(owners,station->>'id'); hosts := array_append(hosts,sx::text||','||sy::text);

  IF EXISTS(SELECT 1 FROM jsonb_array_elements(plan->'zones'||coalesce(plan->'serviceZones','[]'::jsonb)) z
   WHERE z->>'id'=station->>'id' OR
    (sx BETWEEN (z->>'x')::int AND (z->>'x')::int+(z->>'width')::int-1
    AND sy BETWEEN (z->>'y')::int AND (z->>'y')::int+(z->>'height')::int-1))
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(plan->'airPlacements','[]'::jsonb)) a
    WHERE a->>'id'=station->>'id' OR NOT(a ? 'mount') AND (a->>'x')::int=sx AND (a->>'y')::int=sy)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(plan->'partitions','[]'::jsonb)) w
    WHERE w->>'id'=station->>'id' OR CASE w->>'axis' WHEN 'x'
     THEN sy=(w->>'y')::int AND sx BETWEEN (w->>'x')::int AND (w->>'x')::int+(w->>'length')::int-1
     ELSE sx=(w->>'x')::int AND sy BETWEEN (w->>'y')::int AND (w->>'y')::int+(w->>'length')::int-1 END)
  THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;

  IF code='SIM-WATER-03' THEN cap:=20; reach:=6; family:='SIM-WATER-%'; field:='waterAreaM2';
  ELSE cap:=24; reach:=8; family:='SIM-HYGIENE-%'; field:='hygieneAreaM2'; END IF;
  FOR served IN
   SELECT z->>'id' AS zid, y*cols+x AS cell
   FROM jsonb_array_elements(plan->'zones') z
   CROSS JOIN LATERAL generate_series((z->>'x')::int,(z->>'x')::int+(z->>'width')::int-1) x
   CROSS JOIN LATERAL generate_series((z->>'y')::int,(z->>'y')::int+(z->>'height')::int-1) y
   WHERE abs(x-sx)+abs(y-sy)<=reach
    AND NOT(y*cols+x=ANY(CASE code WHEN 'SIM-WATER-03' THEN water_cells ELSE hygiene_cells END))
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(z->'optionCodes','[]'::jsonb)) c WHERE c LIKE family)
    AND NOT EXISTS(
     SELECT 1 FROM jsonb_array_elements(coalesce(plan->'partitions','[]'::jsonb)) w
     CROSS JOIN LATERAL (SELECT w->>'axis'='x' horizontal,(w->>'x')::int wx,(w->>'y')::int wy,(w->>'length')::int len) v
     WHERE CASE WHEN horizontal AND y=sy THEN sy=wy AND least(x,sx)+0.5<=wx+len AND greatest(x,sx)+0.5>=wx
      WHEN NOT horizontal AND x=sx THEN sx=wx AND least(y,sy)+0.5<=wy+len AND greatest(y,sy)+0.5>=wy
      WHEN horizontal THEN wy BETWEEN least(y,sy) AND greatest(y,sy) AND
       sx+0.5+(x-sx)*(wy-sy)::numeric/nullif(y-sy,0) BETWEEN wx AND wx+len
      ELSE wx BETWEEN least(x,sx) AND greatest(x,sx) AND
       sy+0.5+(y-sy)*(wx-sx)::numeric/nullif(x-sx,0) BETWEEN wy AND wy+len END
    )
   ORDER BY (z->>'active')::boolean DESC, abs(x-sx)+abs(y-sy), y, x LIMIT cap
  LOOP
   position := served.cell;
   IF code='SIM-WATER-03' THEN water_cells:=array_append(water_cells,position);
   ELSE hygiene_cells:=array_append(hygiene_cells,position); END IF;
   result:=jsonb_set(result,ARRAY[served.zid,field],to_jsonb((result->served.zid->>field)::int+1));
  END LOOP;
 END LOOP;
 RETURN result;
END $$;

CREATE FUNCTION public.kq_warehouse_station_metrics(plan jsonb, zone_id text) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(plan->'stationService'->zone_id,'{"waterAreaM2":0,"hygieneAreaM2":0}'::jsonb);
$$;

CREATE FUNCTION public.kq_warehouse_check_stations() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.state ? 'stationPlacements' THEN
  IF NEW.state->'stationService' IS DISTINCT FROM public.kq_warehouse_station_service(NEW.state)
  THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 ELSIF NEW.state ? 'stationService' OR TG_OP='UPDATE' AND OLD.state ? 'stationPlacements' THEN
  RAISE EXCEPTION 'warehouse_layout_changed';
 END IF;
 IF TG_OP='UPDATE' AND OLD.state->'stationService' IS DISTINCT FROM NEW.state->'stationService'
  AND EXISTS(SELECT 1 FROM public.kq_runs r WHERE r.user_id=OLD.user_id AND r.status='active'
   AND (r.warehouse_zone_id IS NULL OR public.kq_warehouse_station_metrics(OLD.state,r.warehouse_zone_id)
    IS DISTINCT FROM public.kq_warehouse_station_metrics(NEW.state,r.warehouse_zone_id)))
 THEN RAISE EXCEPTION 'warehouse_zone_in_use'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_warehouse_check_stations BEFORE INSERT OR UPDATE OF state ON public.kq_warehouse_layouts
 FOR EACH ROW EXECUTE FUNCTION public.kq_warehouse_check_stations();
REVOKE ALL ON FUNCTION public.kq_warehouse_station_service(jsonb),public.kq_warehouse_station_metrics(jsonb,text),
 public.kq_warehouse_check_stations() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION pg_temp.kq_station_patch(target regprocedure, needle text, replacement text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE def text := pg_get_functiondef(target);
BEGIN
 IF strpos(def,needle)=0 THEN RAISE EXCEPTION 'warehouse_station_anchor_missing % %',target,needle; END IF;
 EXECUTE replace(def,needle,replacement);
END $$;

SELECT pg_temp.kq_station_patch('public.kq_warehouse_catalog_before_postharvest(jsonb)',
 'RETURN jsonb_build_object(''allocatedAreaM2'',allocated,',
 'RETURN jsonb_build_object(''allocatedAreaM2'',allocated+coalesce(jsonb_array_length(p_state->''stationPlacements''),0),');

-- Preserve the legacy option projection. Modern selected-zone calculations
-- use the original validated shares from the complete layout.
SELECT pg_temp.kq_station_patch('public.kq_warehouse_options_projection(jsonb)',
 'yield_bonus INTEGER; module_quality INTEGER;', 'yield_bonus NUMERIC; module_quality NUMERIC; station JSONB; station_cents BIGINT:=0;');
SELECT pg_temp.kq_station_patch('public.kq_warehouse_options_projection(jsonb)',
 'yield_bonus:=0; module_quality:=0;', $patch$station:=public.kq_warehouse_station_metrics(p_state,zone->>'id');
  yield_bonus:=3*(station->>'waterAreaM2')::numeric/area;
  module_quality:=3*(station->>'hygieneAreaM2')::numeric/area;
  station_cents:=station_cents+240*(station->>'waterAreaM2')::int+260*(station->>'hygieneAreaM2')::int;$patch$);
SELECT pg_temp.kq_station_patch('public.kq_warehouse_options_projection(jsonb)',
 '-saving_cents,''estimatedHarvestGrams''', '-saving_cents+station_cents,''estimatedHarvestGrams''');
SELECT pg_temp.kq_station_patch('public.kq_warehouse_options_projection_v1(jsonb)',
 'FOR code, item IN SELECT key,value FROM jsonb_each(demand) LOOP', $patch$IF p_state ? 'stationPlacements' THEN
  FOR code,amount IN SELECT s->>'code',count(*) FROM jsonb_array_elements(p_state->'stationPlacements') s GROUP BY 1 LOOP
   IF NOT jsonb_path_exists(inventory,'$[*] ? (@.code == $code && @.quantity >= $amount)',
    jsonb_build_object('code',code,'amount',amount))
    THEN RAISE EXCEPTION 'warehouse_options_missing'; END IF;
  END LOOP;
 END IF;
 FOR code, item IN SELECT key,value FROM jsonb_each(demand) LOOP$patch$);

-- A historical assigned module can finish its existing lifecycle. Future
-- purchases of these references are expressed as physical stations.
SELECT pg_temp.kq_station_patch('public.kq_warehouse_validate_options_change(jsonb,jsonb,integer)',
 'PERFORM public.kq_warehouse_options_projection(p_next);', $patch$PERFORM public.kq_warehouse_options_projection(p_next);
 IF NOT(p_next ? 'stationPlacements') AND EXISTS(
  SELECT 1 FROM jsonb_array_elements(p_next->'zones') z
  CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(z->'optionCodes','[]'::jsonb)) c
  WHERE c IN ('SIM-WATER-03','SIM-HYGIENE-03') AND NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(p_previous->'zones') old WHERE old->>'id'=z->>'id' AND old->'optionCodes' ? c
  )
 ) THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
 IF EXISTS(
  SELECT 1 FROM jsonb_array_elements(coalesce(p_next->'optionInventory','[]'::jsonb)) inventory_row
  WHERE inventory_row->>'code' IN ('SIM-WATER-03','SIM-HYGIENE-03') AND (inventory_row->>'quantity')::int>
   GREATEST(
    COALESCE((SELECT (old->>'quantity')::int FROM jsonb_array_elements(coalesce(p_previous->'optionInventory','[]'::jsonb)) old
     WHERE old->>'code'=inventory_row->>'code'),0),
    (SELECT count(*) FROM jsonb_array_elements(coalesce(p_next->'stationPlacements','[]'::jsonb)) s WHERE s->>'code'=inventory_row->>'code')
   )
 ) THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;$patch$);
SELECT pg_temp.kq_station_patch('public.kq_staff_production_layout_guard()',
 'IF before_zone IS DISTINCT FROM after_zone OR ', $patch$IF before_zone IS DISTINCT FROM after_zone
  OR public.kq_warehouse_station_metrics(OLD.state,zone_id) IS DISTINCT FROM public.kq_warehouse_station_metrics(NEW.state,zone_id) OR $patch$);

DO $$
DECLARE target regprocedure;
BEGIN
 SELECT p.oid::regprocedure INTO STRICT target FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
  AND p.prosrc LIKE '%p_next_state-''airService''-''zones''-''equipment''-''optionInventory'' IS DISTINCT FROM p_previous_state%';
 PERFORM pg_temp.kq_station_patch(target,
  'p_next_state-''airService''-''zones''-''equipment''-''optionInventory'' IS DISTINCT FROM p_previous_state-''airService''-''zones''-''equipment''-''optionInventory''',
  'p_next_state-''stationService''-''airService''-''zones''-''equipment''-''optionInventory'' IS DISTINCT FROM p_previous_state-''stationService''-''airService''-''zones''-''equipment''-''optionInventory''');
END $$;

COMMIT;
