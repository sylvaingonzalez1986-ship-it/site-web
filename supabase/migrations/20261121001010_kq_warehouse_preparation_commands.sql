BEGIN;

CREATE FUNCTION public.kq_warehouse_consume_inputs(p_user UUID,p_run UUID,p_quantities JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE input RECORD;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::text,0));
 PERFORM 1 FROM public.kq_runs WHERE id=p_run AND user_id=p_user AND status='active'
  AND state->'cultureDead' IS DISTINCT FROM 'true'::jsonb AND state->>'phase' IS DISTINCT FROM 'complete'
  AND COALESCE((state->>'stageIndex')::int,0)<5
  AND NOT (COALESCE((state->>'stageIndex')::int,0)=4 AND state->>'phase'='resolved') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'kq_preparation_run'; END IF;
 FOR input IN SELECT key,value::int AS amount FROM jsonb_each(public.kq_warehouse_quantities(p_quantities)) ORDER BY key LOOP
  UPDATE public.kq_warehouse_run_inputs i SET reserved=i.reserved-input.amount,consumed=i.consumed+input.amount
   WHERE i.run_id=p_run AND i.code=input.key AND i.reserved>=input.amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_preparation_reserved'; END IF;
  UPDATE public.kq_warehouse_input_stock s SET quantity=s.quantity-input.amount
   WHERE s.user_id=p_user AND s.code=input.key AND s.quantity>=input.amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_preparation_stock'; END IF;
 END LOOP;
END $$;

CREATE FUNCTION public.kq_warehouse_book_cleaning(p_user UUID,p_key UUID,p_step TEXT,p_choice TEXT,p_origin TIMESTAMPTZ,p_at TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
 hours NUMERIC; finish TIMESTAMPTZ; game_day INTEGER; staff JSONB; worker JSONB; worker_index INTEGER;
 day_record JSONB; actor TEXT; tool TEXT;
BEGIN
 IF p_step IS NULL OR p_step NOT IN ('vacuum','mop') OR p_choice IS NULL
  OR p_choice !~ '^(player|auto|employee:[a-zA-Z0-9_-]{1,128})$' THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
 hours:=CASE p_step WHEN 'vacuum' THEN .5 ELSE 1 END;
 tool:=CASE p_step WHEN 'vacuum' THEN 'WAREHOUSE-VACUUM' ELSE 'WAREHOUSE-MOP' END;
 finish:=p_at+hours*interval '10 minutes';
 game_day:=public.kq_player_work_day(p_user,p_at);
 IF NOT EXISTS(SELECT 1 FROM public.kq_warehouse_input_stock s WHERE s.user_id=p_user AND s.code=tool AND s.quantity=1)
  THEN RAISE EXCEPTION 'kq_preparation_tool'; END IF;
 IF EXISTS(SELECT 1 FROM public.kq_warehouse_cleaning_work WHERE user_id=p_user AND ends_at>p_at)
  THEN RAISE EXCEPTION 'kq_preparation_clean_running'; END IF;
 IF p_step='mop' AND NOT EXISTS(SELECT 1 FROM public.kq_warehouse_cleaning_work
  WHERE user_id=p_user AND step='vacuum' AND ends_at<=p_at AND ends_at+interval '28 hours'>=finish)
  THEN RAISE EXCEPTION 'kq_preparation_clean_order'; END IF;
 IF finish>p_origin+game_day*interval '4 hours' THEN RAISE EXCEPTION 'kq_preparation_actor'; END IF;

 SELECT state INTO staff FROM public.kq_staff_accounts WHERE user_id=p_user FOR UPDATE;
 IF p_choice<>'player' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(staff->'payroll') p
  WHERE (p->>'dueAt')::timestamptz<=p_at AND (p->>'paidCents')::bigint<(p->>'totalCents')::bigint) THEN
  SELECT e,(n-1)::int INTO worker,worker_index
  FROM jsonb_array_elements(staff->'employees') WITH ORDINALITY employees(e,n)
  WHERE (p_choice='auto' OR 'employee:'||(e->>'id')=p_choice) AND e->>'status'='active'
   AND (e->>'hiredAt')::timestamptz<=p_at AND coalesce((e->>'endsAt')::timestamptz,finish)>=finish
   AND (game_day-1)%7<least(5,(e->>'weeklyHours')::int/7)
   AND coalesce((e->>'nextPayrollAt')::timestamptz,p_at)>p_at
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(e->'leave') l
    WHERE game_day BETWEEN (l->>'startDay')::int AND (l->>'endDay')::int)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(staff->'tasks') t WHERE t->>'employeeId'=e->>'id' AND t->>'status'='running'
    AND (t->>'completesAt')::timestamptz>p_at AND (t->>'startedAt')::timestamptz<finish
    AND t->'cultureShift' IS DISTINCT FROM 'true'::jsonb AND t->'processingShift' IS DISTINCT FROM 'true'::jsonb)
   AND NOT EXISTS(SELECT 1 FROM public.kq_processing_jobs j WHERE j.user_id=p_user AND j.segments->-1#>>'{actor,id}'=e->>'id'
    AND (j.segments->-1->>'readyAt')::timestamptz>p_at AND (j.segments->-1->>'startedAt')::timestamptz<finish)
   AND 7+coalesce((e->'workDays'->game_day::text->>'extraHours')::numeric,0)
    >=hours+coalesce((e->'workDays'->game_day::text->>'usedHours')::numeric,0)
     +coalesce((SELECT sum((d#>>'{assignment,hours}')::numeric) FROM jsonb_array_elements(staff->'dayPlans') d
      WHERE d->>'assigneeId'=e->>'id' AND (d->>'day')::int=game_day),0)
  ORDER BY e->>'id' LIMIT 1;
 END IF;
 IF worker IS NOT NULL THEN
  day_record:=coalesce(worker->'workDays'->game_day::text,'{"usedHours":0,"extraHours":0}'::jsonb);
  day_record:=day_record||jsonb_build_object('usedHours',(day_record->>'usedHours')::numeric+hours);
  worker:=jsonb_set(worker,'{workDays}',worker->'workDays'||jsonb_build_object(game_day::text,day_record));
  UPDATE public.kq_staff_accounts SET state=jsonb_set(staff,ARRAY['employees',worker_index::text],worker),
   revision=revision+1,updated_at=p_at WHERE user_id=p_user;
  actor:='employee:'||(worker->>'id');
 ELSE
  IF p_choice LIKE 'employee:%' THEN RAISE EXCEPTION 'kq_preparation_actor'; END IF;
  IF EXISTS(SELECT 1 FROM public.kq_processing_jobs j WHERE j.user_id=p_user AND coalesce(j.segments->-1#>>'{actor,id}','player')='player'
   AND (j.segments->-1->>'readyAt')::timestamptz>p_at AND (j.segments->-1->>'startedAt')::timestamptz<finish)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(staff->'tasks') t WHERE t->>'employeeId'='player' AND t->>'status'='running'
    AND (t->>'completesAt')::timestamptz>p_at AND (t->>'startedAt')::timestamptz<finish)
  THEN RAISE EXCEPTION 'kq_preparation_operator_busy'; END IF;
  PERFORM public.kq_player_work_charge(p_user,hours);
  actor:='player';
 END IF;
 INSERT INTO public.kq_warehouse_cleaning_work VALUES(p_user,p_key,p_step,actor,p_at,finish);
END $$;

CREATE FUNCTION public.kq_warehouse_prepare_irrigation(p_user UUID,p_station TEXT,p_zone TEXT,p_quantities JSONB,p_plan JSONB,p_at TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE selected JSONB; coverage JSONB; input RECORD; base INTEGER; supplement INTEGER;
BEGIN
 IF p_station IS NULL OR length(btrim(p_station)) NOT BETWEEN 1 AND 80 OR p_zone IS NULL OR length(btrim(p_zone)) NOT BETWEEN 1 AND 80
  THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
 IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user AND status='active' AND (warehouse_zone_id=p_zone OR warehouse_zone_id IS NULL))
  THEN RAISE EXCEPTION 'kq_preparation_zone_busy'; END IF;
 p_quantities:=public.kq_warehouse_quantities(p_quantities);
 DELETE FROM public.kq_warehouse_irrigation_programs WHERE user_id=p_user AND station_id=p_station AND zone_id=p_zone;
 IF p_quantities='{}'::jsonb THEN RETURN; END IF;
 IF p_quantities-ARRAY['WAREHOUSE-NUTRITION-BASE','WAREHOUSE-NUTRITION-SUPPLEMENT']<>'{}'::jsonb
  THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
 SELECT s INTO selected FROM jsonb_array_elements(p_plan->'stationPlacements') s WHERE s->>'id'=p_station AND s->>'code'='SIM-WATER-03';
 IF NOT FOUND THEN RAISE EXCEPTION 'kq_preparation_coverage'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_plan->'zones') z WHERE z->>'id'=p_zone AND z->'active'='true'::jsonb)
  THEN RAISE EXCEPTION 'kq_preparation_zone'; END IF;
 coverage:=public.kq_warehouse_preparation_station_coverage(p_plan);
 base:=coalesce((p_quantities->>'WAREHOUSE-NUTRITION-BASE')::int,0);
 supplement:=coalesce((p_quantities->>'WAREHOUSE-NUTRITION-SUPPLEMENT')::int,0);
 IF base<1 OR supplement>base THEN RAISE EXCEPTION 'kq_preparation_nutrition'; END IF;
 IF base>coalesce((coverage->p_zone->>p_station)::int,0) THEN RAISE EXCEPTION 'kq_preparation_coverage'; END IF;
 FOR input IN SELECT i.available,e.value::int AS amount FROM jsonb_each(p_quantities) e
  JOIN public.kq_warehouse_preparation_inventory(p_user,p_plan,coverage,p_at) i ON i.code=e.key LOOP
  IF input.amount>input.available THEN RAISE EXCEPTION 'kq_preparation_stock'; END IF;
 END LOOP;
 INSERT INTO public.kq_warehouse_irrigation_programs VALUES(p_user,p_station,p_zone,selected,p_quantities,p_at,p_at+interval '28 hours');
END $$;

CREATE FUNCTION public.kq_warehouse_clear_moved_programs() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE coverage JSONB;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.kq_warehouse_irrigation_programs WHERE user_id=NEW.user_id) THEN RETURN NEW; END IF;
 coverage:=CASE WHEN NEW.state ? 'stationPlacements' THEN public.kq_warehouse_preparation_station_coverage(NEW.state) ELSE '{}'::jsonb END;
 DELETE FROM public.kq_warehouse_irrigation_programs p WHERE p.user_id=NEW.user_id AND NOT EXISTS(
  SELECT 1 FROM public.kq_warehouse_live_programs(NEW.user_id,NEW.state,coverage,now()) live
   WHERE live.station_id=p.station_id AND live.zone_id=p.zone_id);
 RETURN NEW;
END $$;
CREATE TRIGGER kq_warehouse_clear_moved_programs AFTER UPDATE OF state ON public.kq_warehouse_layouts
 FOR EACH ROW WHEN (OLD.state IS DISTINCT FROM NEW.state) EXECUTE FUNCTION public.kq_warehouse_clear_moved_programs();

CREATE FUNCTION public.rpc_kq_warehouse_preparation_command(p_user_id UUID,p_request_key UUID,p_command JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 previous JSONB; plan JSONB; quantities JSONB; used JSONB;
 run public.kq_runs%ROWTYPE; leader UUID; item RECORD; p_code TEXT;
 amount INTEGER; cash BIGINT; total INTEGER; origin TIMESTAMPTZ; at TIMESTAMPTZ:=now();
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::text,0));
 SELECT command INTO previous FROM public.kq_warehouse_preparation_receipts WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF previous IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'kq_preparation_request_mismatch'; END IF;
  RETURN public.rpc_kq_warehouse_preparations(p_user_id);
 END IF;
 SELECT w.cash_cents,coalesce(c.business_started_at,w.created_at) INTO cash,origin
 FROM public.kq_equipment_wallets w LEFT JOIN public.kq_commerce_accounts c USING(user_id) WHERE w.user_id=p_user_id FOR UPDATE OF w;
 IF NOT FOUND THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
 CASE p_command->>'action'
 WHEN 'purchase' THEN
  IF jsonb_typeof(p_command->'quantity') IS DISTINCT FROM 'number' OR (p_command->>'quantity')::numeric NOT BETWEEN 1 AND 100
   OR (p_command->>'quantity')::numeric<>trunc((p_command->>'quantity')::numeric) THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
  p_code:=p_command->>'code'; amount:=(p_command->>'quantity')::int;
  SELECT * INTO item FROM public.kq_warehouse_preparation_catalog() c WHERE c.code=p_code;
  IF NOT FOUND OR item.kind='equipment' AND amount<>1 THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
  IF item.kind='equipment' AND EXISTS(SELECT 1 FROM public.kq_warehouse_input_stock WHERE user_id=p_user_id AND code=p_code AND quantity>0)
   THEN RAISE EXCEPTION 'kq_preparation_owned'; END IF;
  total:=item.price_cents*amount;
  IF cash<total THEN RAISE EXCEPTION 'kq_preparation_cash'; END IF;
  PERFORM public.kq_treasury_initialize(p_user_id);
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-total,updated_at=at WHERE user_id=p_user_id;
  INSERT INTO public.kq_warehouse_input_stock AS s VALUES(p_user_id,p_code,amount)
   ON CONFLICT(user_id,code) DO UPDATE SET quantity=s.quantity+excluded.quantity;
  PERFORM public.kq_treasury_pair(p_user_id,'culture-input','warehouse-input:'||p_request_key::text,
   at,'expense_other','suspense',total,item.name);
 WHEN 'clean' THEN PERFORM public.kq_warehouse_book_cleaning(p_user_id,p_request_key,p_command->>'step',p_command->>'workChoice',origin,at);
 WHEN 'program' THEN
  SELECT state INTO plan FROM public.kq_warehouse_layouts WHERE user_id=p_user_id FOR UPDATE;
  PERFORM public.kq_warehouse_prepare_irrigation(p_user_id,p_command->>'stationId',p_command->>'zoneId',p_command->'quantities',plan,at);
 WHEN 'use' THEN
  quantities:=public.kq_warehouse_quantities(p_command->'quantities');
  IF quantities='{}'::jsonb OR EXISTS(SELECT 1 FROM jsonb_object_keys(quantities) k WHERE k LIKE 'CARE-%')
   THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
  SELECT * INTO run FROM public.kq_runs WHERE id=(p_command->>'runId')::uuid AND user_id=p_user_id AND status='active' FOR UPDATE;
  IF NOT FOUND OR NOT(run.state ? 'warehousePreparations') THEN RAISE EXCEPTION 'kq_preparation_run'; END IF;
  PERFORM public.kq_warehouse_consume_inputs(p_user_id,run.id,quantities);
  SELECT coalesce(jsonb_object_agg(i.code,i.consumed),'{}'::jsonb) INTO used FROM public.kq_warehouse_run_inputs i
   WHERE i.run_id=run.id AND i.consumed>0 AND i.code NOT LIKE 'CARE-%';
  IF coalesce((used->>'WAREHOUSE-NUTRITION-SUPPLEMENT')::int,0)>coalesce((used->>'WAREHOUSE-NUTRITION-BASE')::int,0)
   THEN RAISE EXCEPTION 'kq_preparation_nutrition'; END IF;
  leader:=coalesce((run.state#>>'{campaign,leaderRunId}')::uuid,run.id);
  UPDATE public.kq_runs SET state=jsonb_set(state,ARRAY['warehousePreparations',run.warehouse_zone_id,'used'],used),
   updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond') WHERE id=leader AND user_id=p_user_id AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_preparation_run'; END IF;
 ELSE RAISE EXCEPTION 'kq_preparation_invalid';
 END CASE;
 INSERT INTO public.kq_warehouse_preparation_receipts VALUES(p_user_id,p_request_key,p_command);
 RETURN public.rpc_kq_warehouse_preparations(p_user_id);
END $$;

REVOKE ALL ON FUNCTION public.kq_warehouse_consume_inputs(UUID,UUID,JSONB),
 public.kq_warehouse_book_cleaning(UUID,UUID,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ),
 public.kq_warehouse_prepare_irrigation(UUID,TEXT,TEXT,JSONB,JSONB,TIMESTAMPTZ),public.kq_warehouse_clear_moved_programs(),
 public.rpc_kq_warehouse_preparation_command(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_preparation_command(UUID,UUID,JSONB) TO service_role;

COMMIT;
