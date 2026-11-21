BEGIN;

-- Keep the existing projection entry point, grants and active-run trigger.
-- Historical floor placements use the same allocation and obstacle tests.
DO $$
DECLARE
 def text := pg_get_functiondef('public.kq_warehouse_air_service(jsonb)'::regprocedure);
 old_host constant text := $anchor$  FOR wall IN SELECT value FROM jsonb_array_elements(coalesce(plan->'partitions','[]'::jsonb)) LOOP
   IF (CASE wall->>'axis' WHEN 'x' THEN fy=(wall->>'y')::int AND fx BETWEEN (wall->>'x')::int AND (wall->>'x')::int+(wall->>'length')::int-1
    ELSE fx=(wall->>'x')::int AND fy BETWEEN (wall->>'y')::int AND (wall->>'y')::int+(wall->>'length')::int-1 END)
   THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
  END LOOP;$anchor$;
 old_ray constant text := $anchor$    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(plan->'partitions','[]'::jsonb)) w
     CROSS JOIN LATERAL (SELECT w->>'axis'='x' horizontal,(w->>'x')::int wx,(w->>'y')::int wy,(w->>'length')::int len) v
     WHERE CASE WHEN horizontal AND cy=fy$anchor$;
BEGIN
 IF strpos(def,old_host)=0 OR strpos(def,old_ray)=0 OR strpos(def,'wall jsonb; result jsonb')=0
 THEN RAISE EXCEPTION 'warehouse_wall_extraction_anchor_missing'; END IF;
 def:=replace(def,'wall jsonb; result jsonb',
  'mount jsonb; wall jsonb; host jsonb; face text; host_id text; touching int; nx int; ny int; result jsonb');
 def:=replace(def,old_host,$mount$  mount:=fan->'mount'; face:=mount->>'face'; host_id:=mount->>'partitionId';
  touching:=0; host:=NULL;
  FOR wall IN SELECT value FROM jsonb_array_elements(coalesce(plan->'partitions','[]'::jsonb)) LOOP
   IF (CASE wall->>'axis' WHEN 'x' THEN fy=(wall->>'y')::int AND fx BETWEEN (wall->>'x')::int AND (wall->>'x')::int+(wall->>'length')::int-1
    ELSE fx=(wall->>'x')::int AND fy BETWEEN (wall->>'y')::int AND (wall->>'y')::int+(wall->>'length')::int-1 END)
   THEN touching:=touching+1; host:=wall; END IF;
  END LOOP;
  IF mount IS NULL THEN
   IF touching<>0 THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
  ELSIF jsonb_typeof(mount) IS DISTINCT FROM 'object' OR mount->>'kind' IS DISTINCT FROM 'wall'
   OR face IS NULL OR face NOT IN ('north','east','south','west')
  THEN RAISE EXCEPTION 'warehouse_invalid_request';
  ELSIF NOT(mount ? 'partitionId') THEN
   IF touching<>0 OR NOT(CASE face WHEN 'north' THEN fy=rows-1 WHEN 'east' THEN fx=0
    WHEN 'south' THEN fy=0 WHEN 'west' THEN fx=cols-1 END)
   THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
  ELSE
   IF jsonb_typeof(mount->'partitionId') IS DISTINCT FROM 'string' OR touching<>1 OR host->>'id' IS DISTINCT FROM host_id
    OR (host->>'axis'='x') IS DISTINCT FROM (face IN ('north','south'))
   THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
   nx:=fx+CASE face WHEN 'east' THEN 1 WHEN 'west' THEN -1 ELSE 0 END;
   ny:=fy+CASE face WHEN 'south' THEN 1 WHEN 'north' THEN -1 ELSE 0 END;
   IF nx NOT BETWEEN 0 AND cols-1 OR ny NOT BETWEEN 0 AND rows-1
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(plan->'partitions','[]'::jsonb)) w WHERE
    CASE w->>'axis' WHEN 'x' THEN ny=(w->>'y')::int AND nx BETWEEN (w->>'x')::int AND (w->>'x')::int+(w->>'length')::int-1
    ELSE nx=(w->>'x')::int AND ny BETWEEN (w->>'y')::int AND (w->>'y')::int+(w->>'length')::int-1 END)
   THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
  END IF;$mount$);
 def:=replace(def,old_ray,$ray$    AND (mount IS NULL OR
     (CASE face WHEN 'north' THEN fy-cy WHEN 'east' THEN cx-fx WHEN 'south' THEN cy-fy WHEN 'west' THEN fx-cx END)
      >= CASE WHEN host_id IS NULL THEN 0 ELSE 1 END)
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(plan->'partitions','[]'::jsonb)) w
     CROSS JOIN LATERAL (SELECT w->>'axis'='x' horizontal,(w->>'x')::int wx,(w->>'y')::int wy,(w->>'length')::int len) v
     WHERE (host_id IS NULL OR w->>'id' IS DISTINCT FROM host_id)
     AND CASE WHEN horizontal AND cy=fy$ray$);
 EXECUTE def;
END $$;

COMMIT;
