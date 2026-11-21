BEGIN;

-- Mobile equipment occupies floor space without construction or installation costs.
-- Each placement references a single paid unit from the plan's existing inventory.
CREATE FUNCTION public.kq_warehouse_check_handling_placements() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
 plan jsonb := NEW.state;
 placements jsonb := coalesce(plan->'handlingPlacements','[]'::jsonb);
 previous jsonb := CASE WHEN TG_OP='UPDATE' THEN OLD.state ELSE '{}'::jsonb END;
 cols integer := coalesce((plan#>>'{floor,columns}')::integer,40);
 rows integer := coalesce((plan#>>'{floor,rows}')::integer,25);
 item jsonb; ref text; sx integer; sy integer;
 codes text[] := '{}'; cells integer[] := '{}';
BEGIN
 IF jsonb_typeof(placements) IS DISTINCT FROM 'array' OR jsonb_array_length(placements)>3
   OR (previous ? 'handlingPlacements' AND NOT plan ? 'handlingPlacements') THEN
   RAISE EXCEPTION 'warehouse_handling_placement_invalid';
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(placements) LOOP
   ref:=item->>'code';
   IF ref IS NULL OR NOT(ref=ANY(public.kq_warehouse_handling_codes())) OR ref=ANY(codes)
     OR jsonb_typeof(item->'x') IS DISTINCT FROM 'number' OR jsonb_typeof(item->'y') IS DISTINCT FROM 'number'
     OR COALESCE(item->>'x','') !~ '^[0-9]{1,2}$' OR COALESCE(item->>'y','') !~ '^[0-9]{1,2}$'
     OR public.kq_warehouse_handling_quantity(plan,ref)<>1
     OR EXISTS(SELECT FROM jsonb_array_elements(plan->'zones') z WHERE z->'optionCodes' ? ref) THEN
     RAISE EXCEPTION 'warehouse_handling_placement_invalid';
   END IF;
   sx:=(item->>'x')::integer; sy:=(item->>'y')::integer;
   IF sx>=cols OR sy>=rows OR (sx=cols/2 AND sy=rows-1) OR (sy*cols+sx)=ANY(cells)
     OR EXISTS(SELECT FROM jsonb_array_elements((plan->'zones')||coalesce(plan->'serviceZones','[]'::jsonb)) z
       WHERE sx BETWEEN (z->>'x')::integer AND (z->>'x')::integer+(z->>'width')::integer-1
         AND sy BETWEEN (z->>'y')::integer AND (z->>'y')::integer+(z->>'height')::integer-1)
     OR EXISTS(SELECT FROM jsonb_array_elements(coalesce(plan->'stationPlacements','[]'::jsonb)) s
       WHERE s->>'x'=sx::text AND s->>'y'=sy::text)
     OR EXISTS(SELECT FROM jsonb_array_elements(coalesce(plan->'airPlacements','[]'::jsonb)) a
       WHERE NOT a ? 'mount' AND a->>'x'=sx::text AND a->>'y'=sy::text)
     OR EXISTS(SELECT FROM jsonb_array_elements(coalesce(plan->'partitions','[]'::jsonb)) w
       WHERE CASE w->>'axis' WHEN 'x' THEN sy=(w->>'y')::integer
         AND sx BETWEEN (w->>'x')::integer AND (w->>'x')::integer+(w->>'length')::integer-1
       ELSE sx=(w->>'x')::integer AND sy BETWEEN (w->>'y')::integer AND (w->>'y')::integer+(w->>'length')::integer-1 END) THEN
     RAISE EXCEPTION 'warehouse_handling_placement_invalid';
   END IF;
   codes:=array_append(codes,ref); cells:=array_append(cells,sy*cols+sx);
 END LOOP;
 FOREACH ref IN ARRAY public.kq_warehouse_handling_codes() LOOP
   IF public.kq_warehouse_handling_quantity(plan,ref)>public.kq_warehouse_handling_quantity(previous,ref) AND NOT(ref=ANY(codes)) THEN
     RAISE EXCEPTION 'warehouse_handling_placement_required';
   END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_check_handling_placements() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_warehouse_check_handling_placements BEFORE INSERT OR UPDATE OF state ON public.kq_warehouse_layouts
FOR EACH ROW EXECUTE FUNCTION public.kq_warehouse_check_handling_placements();

CREATE OR REPLACE FUNCTION public.kq_warehouse_handling_condition(p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_object_agg(asset->>'code',asset->'wearPercent'),'{}'::jsonb)
 FROM public.kq_warehouse_layouts l
 CROSS JOIN LATERAL jsonb_array_elements(l.culture_assets) asset
 WHERE l.user_id=p_user AND asset->>'kind'='option' AND asset->'zoneId'='null'::jsonb
   AND asset->>'code'=ANY(public.kq_warehouse_handling_codes()) AND asset->'quantity'='1'::jsonb
   AND public.kq_warehouse_handling_quantity(l.state,asset->>'code')=1
   AND EXISTS(SELECT FROM jsonb_array_elements(l.state->'handlingPlacements') i WHERE i->>'code'=asset->>'code')
   AND NOT EXISTS(SELECT FROM jsonb_array_elements(l.state->'zones') z WHERE z->'optionCodes' ? (asset->>'code'));
$$;
COMMIT;
