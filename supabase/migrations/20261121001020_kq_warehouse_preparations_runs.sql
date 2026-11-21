BEGIN;

-- The legacy calculation remains available to historical snapshots. Pass the
-- run's rule marker only to option projections, never into the stored floor.
CREATE FUNCTION pg_temp.kq_preparation_patch(p_function REGPROCEDURE,p_anchor TEXT,p_change TEXT,
 p_second_anchor TEXT DEFAULT NULL,p_second_change TEXT DEFAULT NULL) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE body TEXT:=pg_get_functiondef(p_function);
BEGIN
 IF (length(body)-length(replace(body,p_anchor,'')))/length(p_anchor)<>1
  THEN RAISE EXCEPTION 'warehouse_preparation_migration_anchor % %',p_function,p_anchor; END IF;
 body:=replace(body,p_anchor,p_change);
 IF p_second_anchor IS NOT NULL THEN
  IF (length(body)-length(replace(body,p_second_anchor,'')))/length(p_second_anchor)<>1
   THEN RAISE EXCEPTION 'warehouse_preparation_migration_anchor % %',p_function,p_second_anchor; END IF;
  body:=replace(body,p_second_anchor,p_second_change);
 END IF;
 EXECUTE body;
END $$;

SELECT pg_temp.kq_preparation_patch('public.kq_warehouse_options_projection(jsonb)',
 'station_cents:=station_cents+240*(station->>''waterAreaM2'')::int+260*(station->>''hygieneAreaM2'')::int;',
 $change$IF p_state->'preparationVersion'='1'::jsonb THEN
    yield_bonus:=0; module_quality:=0;
  ELSE station_cents:=station_cents+240*(station->>'waterAreaM2')::int+260*(station->>'hygieneAreaM2')::int; END IF;$change$);
SELECT pg_temp.kq_preparation_patch('public.kq_warehouse_options_projection(jsonb)',
 'option:=public.kq_warehouse_option(code);',
 $change$option:=public.kq_warehouse_option(code);
   IF p_state->'preparationVersion'='1'::jsonb AND (option->>'family' IN ('nutrition','hygiene') OR code='SIM-WATER-03') THEN
    saving_cents:=saving_cents+area*(option->>'consumablesCentsPerM2')::int;
    CONTINUE;
   END IF;$change$);
SELECT pg_temp.kq_preparation_patch('public.kq_warehouse_condition_projection(jsonb)',
 'source JSONB:=p_warehouse->''sourceState'';',
 $change$source JSONB:=(p_warehouse->'sourceState')||CASE WHEN p_warehouse->'preparationVersion'='1'::jsonb
  THEN '{"preparationVersion":1}'::jsonb ELSE '{}'::jsonb END;$change$);
SELECT pg_temp.kq_preparation_patch('public.kq_warehouse_validate_options_before_condition(jsonb)',
 'expected:=CASE WHEN modern THEN public.kq_warehouse_options_projection(p_warehouse->''sourceState'')',
 $change$IF p_warehouse ? 'preparationVersion' AND (NOT modern OR p_warehouse->'preparationVersion'<>'1'::jsonb)
  THEN RAISE EXCEPTION 'warehouse_balance_version_invalid'; END IF;
 expected:=CASE WHEN modern THEN public.kq_warehouse_options_projection((p_warehouse->'sourceState')||
  CASE WHEN p_warehouse->'preparationVersion'='1'::jsonb THEN '{"preparationVersion":1}'::jsonb ELSE '{}'::jsonb END)$change$);

CREATE FUNCTION public.kq_warehouse_launch_preparations(p_user UUID,p_leader UUID,p_runs UUID[],p_selections JSONB,p_expected_key TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 leader public.kq_runs%ROWTYPE; run public.kq_runs%ROWTYPE;
 plan JSONB; coverage JSONB; manual JSONB; treatment JSONB; preparation JSONB:='{}';
 run_selection RECORD; input RECORD; zone TEXT; area INTEGER; programmed_area INTEGER;
 vacuum BOOLEAN; mop BOOLEAN; at TIMESTAMPTZ:=clock_timestamp();
BEGIN
 SELECT * INTO STRICT leader FROM public.kq_runs WHERE id=p_leader AND user_id=p_user;
 IF leader.state#>>'{warehouse,preparationVersion}' IS DISTINCT FROM '1' THEN
  IF p_selections IS NOT NULL OR p_expected_key IS NOT NULL THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
  RETURN leader.state;
 END IF;
 IF p_selections IS NOT NULL AND jsonb_typeof(p_selections) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_selections) z WHERE NOT EXISTS(
  SELECT 1 FROM public.kq_runs r WHERE r.user_id=p_user AND r.id=ANY(p_runs) AND r.warehouse_zone_id=z))
 THEN RAISE EXCEPTION 'kq_preparation_zone'; END IF;
 SELECT state INTO plan FROM public.kq_warehouse_layouts WHERE user_id=p_user FOR UPDATE;
 coverage:=CASE WHEN plan ? 'stationPlacements' THEN public.kq_warehouse_preparation_station_coverage(plan) ELSE '{}'::jsonb END;
 IF p_expected_key IS NOT NULL AND p_expected_key IS DISTINCT FROM public.kq_warehouse_preparation_quote_key(p_user,plan,coverage,at)
  THEN RAISE EXCEPTION 'kq_preparation_quote_changed'; END IF;
 vacuum:=COALESCE((public.kq_warehouse_cleaning_status(p_user,'vacuum',at)->>'expiresAt')::timestamptz>at,false);
 mop:=COALESCE((public.kq_warehouse_cleaning_status(p_user,'mop',at)->>'expiresAt')::timestamptz>at,false);

 FOR run IN SELECT * FROM public.kq_runs r WHERE r.user_id=p_user AND r.id=ANY(p_runs) ORDER BY r.warehouse_zone_id FOR UPDATE LOOP
  zone:=run.warehouse_zone_id;
  area:=(run.state#>>'{warehouse,activeAreaM2}')::int;
  IF run.state#>>'{warehouse,preparationVersion}' IS DISTINCT FROM '1' OR zone IS NULL OR area<1 OR area>1000
   THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
  manual:=public.kq_warehouse_quantities(coalesce(p_selections->zone,'{}'::jsonb));
  SELECT coalesce(jsonb_object_agg(key,amount),'{}'::jsonb) INTO treatment FROM (
   SELECT e.key,sum(e.value::int) amount FROM public.kq_warehouse_live_programs(p_user,plan,coverage,at) p
   CROSS JOIN LATERAL jsonb_each(p.quantities) e WHERE p.zone_id=zone GROUP BY e.key) quantities;
  FOR run_selection IN SELECT c.code,COALESCE((manual->>c.code)::int,0) manual_amount,
   COALESCE((treatment->>c.code)::int,0) treatment_amount
   FROM public.kq_warehouse_preparation_catalog() c WHERE manual ? c.code OR treatment ? c.code ORDER BY c.code LOOP
   IF run_selection.manual_amount+run_selection.treatment_amount>area THEN RAISE EXCEPTION 'kq_preparation_coverage'; END IF;
  END LOOP;
  IF COALESCE((manual->>'WAREHOUSE-NUTRITION-SUPPLEMENT')::int,0)+COALESCE((treatment->>'WAREHOUSE-NUTRITION-SUPPLEMENT')::int,0)
   >COALESCE((manual->>'WAREHOUSE-NUTRITION-BASE')::int,0)+COALESCE((treatment->>'WAREHOUSE-NUTRITION-BASE')::int,0)
   THEN RAISE EXCEPTION 'kq_preparation_nutrition'; END IF;
  FOR input IN SELECT i.code,i.available,e.value::int amount FROM jsonb_each(manual) e
   JOIN public.kq_warehouse_preparation_inventory(p_user,plan,coverage,at) i ON i.code=e.key LOOP
   IF input.amount>input.available THEN RAISE EXCEPTION 'kq_preparation_stock'; END IF;
  END LOOP;
  -- Transfer escrowed doses from the station to this run. Manual doses stay
  -- reserved until applied. Either step shares the enclosing launch transaction.
  DELETE FROM public.kq_warehouse_irrigation_programs WHERE user_id=p_user AND zone_id=zone;
  FOR input IN SELECT key,value::int amount FROM jsonb_each(treatment) LOOP
   UPDATE public.kq_warehouse_input_stock s SET quantity=s.quantity-input.amount
    WHERE s.user_id=p_user AND s.code=input.key AND s.quantity>=input.amount;
   IF NOT FOUND THEN RAISE EXCEPTION 'kq_preparation_stock'; END IF;
  END LOOP;
  INSERT INTO public.kq_warehouse_run_inputs(run_id,code,reserved,consumed)
   SELECT run.id,c.code,COALESCE((manual->>c.code)::int,0),COALESCE((treatment->>c.code)::int,0)
   FROM public.kq_warehouse_preparation_catalog() c WHERE manual ? c.code OR treatment ? c.code;
  programmed_area:=COALESCE((treatment->>'WAREHOUSE-NUTRITION-BASE')::int,0);
  preparation:=preparation||jsonb_build_object(zone,jsonb_build_object('used',treatment,'vacuum',vacuum,'mop',mop,
   'hygieneM2',COALESCE((plan->'stationService'->zone->>'hygieneAreaM2')::int,0),'irrigatedM2',programmed_area));
 END LOOP;
 UPDATE public.kq_runs SET state=state||jsonb_build_object('warehousePreparations',preparation)
  WHERE id=p_leader AND user_id=p_user RETURNING state INTO STRICT leader.state;
 RETURN leader.state;
END $$;

-- The inner functions have already done canonical receipt checks, synchronized
-- the paid layout and created every member. Reserve before returning from the
-- same transaction and before the outer wrapper charges the player's time.
DO $$ DECLARE signature REGPROCEDURE; BEGIN
 FOREACH signature IN ARRAY ARRAY[
  'public.kq_work_inner_start_zone_run(uuid,text,uuid,jsonb,text,integer,text[],text[],jsonb,integer,text)'::regprocedure,
  'public.kq_work_inner_start_campaign(uuid,uuid,jsonb,jsonb,integer,text)'::regprocedure
 ] LOOP
  PERFORM pg_temp.kq_preparation_patch(signature,'p_request IS DISTINCT FROM jsonb_build_object(',
   'p_request IS DISTINCT FROM (jsonb_build_object(',
   $anchor$'expectedEnergyCents',p_request->'expectedEnergyCents')$anchor$,
   $change$'expectedEnergyCents',p_request->'expectedEnergyCents')||CASE WHEN p_request ? 'warehouseInputs'
    THEN jsonb_build_object('warehouseInputs',p_request->'warehouseInputs') ELSE '{}'::jsonb END
    ||CASE WHEN p_request ? 'expectedPreparationKey' THEN jsonb_build_object('expectedPreparationKey',p_request->'expectedPreparationKey') ELSE '{}'::jsonb END)$change$);
 END LOOP;
END $$;
SELECT pg_temp.kq_preparation_patch('public.kq_work_inner_start_zone_run(uuid,text,uuid,jsonb,text,integer,text[],text[],jsonb,integer,text)',
 $anchor$RETURN result||jsonb_build_object('replayed',false);$anchor$,
 $change$RETURN jsonb_set(result,'{run,state}',public.kq_warehouse_launch_preparations(p_user_id,(result#>>'{run,id}')::uuid,
  ARRAY[(result#>>'{run,id}')::uuid],CASE WHEN p_request ? 'warehouseInputs' THEN jsonb_build_object(p_zone_id,p_request->'warehouseInputs') END,
  p_request->>'expectedPreparationKey'))
  ||jsonb_build_object('replayed',false);$change$);
SELECT pg_temp.kq_preparation_patch('public.kq_work_inner_start_campaign(uuid,uuid,jsonb,jsonb,integer,text)',
 $anchor$RETURN result||jsonb_build_object('replayed',false);$anchor$,
 $change$RETURN jsonb_set(result,'{run,state}',public.kq_warehouse_launch_preparations(p_user_id,leader_row.id,
  ARRAY(SELECT (m->>'runId')::uuid FROM jsonb_array_elements(p_members) m),p_request->'warehouseInputs',p_request->>'expectedPreparationKey'))
  ||jsonb_build_object('replayed',false);$change$);

REVOKE ALL ON FUNCTION public.kq_warehouse_launch_preparations(UUID,UUID,UUID[],JSONB,TEXT) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
