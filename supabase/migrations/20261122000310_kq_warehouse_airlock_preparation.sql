BEGIN;

CREATE FUNCTION public.kq_warehouse_entrance_airlock(p_plan jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT EXISTS (
    SELECT FROM jsonb_array_elements(p_plan->'stationPlacements') s
    WHERE s->>'code'='SIM-HYGIENE-03'
      AND s->'x'=to_jsonb(coalesce((p_plan#>>'{floor,columns}')::integer,40)/2)
      AND s->'y'=to_jsonb(coalesce((p_plan#>>'{floor,rows}')::integer,25)-1)
  );
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_entrance_airlock(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- The preview and launch use the same plan and the same quote predicate.
-- Preserve the existing launch transaction, including its plan lock and stock reservations.
DO $migration$
DECLARE step record; body text;
BEGIN
  FOR step IN SELECT * FROM (VALUES
    ('public.kq_warehouse_preparation_quote_key(uuid,jsonb,jsonb,timestamptz)'::regprocedure,
      'jsonb_build_object(''programs'',',
      'jsonb_build_object(''entranceAirlock'',public.kq_warehouse_entrance_airlock(p_plan),''programs'','),
    ('public.kq_warehouse_launch_preparations(uuid,uuid,uuid[],jsonb,text)'::regprocedure,
      'vacuum BOOLEAN; mop BOOLEAN;', 'airlock BOOLEAN; vacuum BOOLEAN; mop BOOLEAN;'),
    ('public.kq_warehouse_launch_preparations(uuid,uuid,uuid[],jsonb,text)'::regprocedure,
      'vacuum:=COALESCE(', 'airlock:=public.kq_warehouse_entrance_airlock(plan); vacuum:=COALESCE('),
    ('public.kq_warehouse_launch_preparations(uuid,uuid,uuid[],jsonb,text)'::regprocedure,
      '''hygieneM2'',COALESCE(', '''entranceAirlock'',airlock,''hygieneM2'',COALESCE(')
  ) changes(signature,anchor,replacement) LOOP
    body:=pg_get_functiondef(step.signature);
    IF length(body)-length(replace(body,step.anchor,''))<>length(step.anchor) THEN
      RAISE EXCEPTION 'warehouse_airlock_preparation_definition_changed: %',step.signature;
    END IF;
    EXECUTE replace(body,step.anchor,step.replacement);
  END LOOP;
END $migration$;

ALTER FUNCTION public.rpc_kq_warehouse_preparations(uuid) RENAME TO kq_warehouse_preparations_before_airlock;
REVOKE ALL ON FUNCTION public.kq_warehouse_preparations_before_airlock(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.rpc_kq_warehouse_preparations(p_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.kq_warehouse_preparations_before_airlock(p_user_id)
    || jsonb_build_object('entranceAirlock',public.kq_warehouse_entrance_airlock(
      (SELECT state FROM public.kq_warehouse_layouts WHERE user_id=p_user_id)));
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_preparations(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_preparations(uuid) TO service_role;

COMMIT;
