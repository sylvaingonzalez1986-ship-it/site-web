BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Commercial material has no kq_runs/kq_flowers/market receipt identity.
-- The server engine supplies the transition; the existing staff CAS, owner
-- lock and idempotency receipt commit its work and money atomically.
CREATE TABLE public.kq_staff_production_events (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 event_id TEXT NOT NULL CHECK(length(event_id) BETWEEN 1 AND 200),
 occurred_at TIMESTAMPTZ NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('cost','sale')),
 lot_id TEXT NOT NULL, task_id TEXT NOT NULL, employee_id TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 0 AND 100000000),
 vat_cents INTEGER NOT NULL CHECK(vat_cents BETWEEN 0 AND amount_cents),
 grams NUMERIC NOT NULL CHECK(grams BETWEEN 0 AND 1000000),
 PRIMARY KEY(user_id,event_id)
);
CREATE INDEX kq_staff_production_events_history ON public.kq_staff_production_events(user_id,occurred_at DESC,event_id);
ALTER TABLE public.kq_staff_production_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_staff_production_events FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_staff_production_reservation(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT state->'production' FROM public.kq_staff_accounts WHERE user_id=p_user
 AND state#>'{production,facility}' IS DISTINCT FROM 'null'::JSONB
 AND (state#>'{production,settings,enabled}'='true'::JSONB
  OR jsonb_array_length(COALESCE(state#>'{production,lots}','[]'))>0
  OR jsonb_array_length(COALESCE(state#>'{production,jobs}','[]'))>0);
$$;
REVOKE ALL ON FUNCTION public.kq_staff_production_reservation(UUID) FROM PUBLIC,anon,authenticated,service_role;

-- Capacity is occupied, not removed from the installed catalogue. Existing
-- storage guards consequently see it while quoted physical capacities stay exact.
ALTER FUNCTION public.kq_warehouse_reserved_storage_units(UUID,UUID) RENAME TO kq_warehouse_reserved_storage_before_production;
REVOKE ALL ON FUNCTION public.kq_warehouse_reserved_storage_before_production(UUID,UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_warehouse_reserved_storage_units(p_user UUID,p_except UUID DEFAULT NULL) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.kq_warehouse_reserved_storage_before_production(p_user,p_except)
  +COALESCE((public.kq_staff_production_reservation(p_user)#>>'{facility,storageCapacityGrams}')::NUMERIC,0)*10;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_reserved_storage_units(UUID,UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_staff_production_facility(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('warehouseState',l.state,'warehouseRevision',COALESCE(l.revision,0),
  'busyZoneIds',COALESCE((SELECT jsonb_agg(r.warehouse_zone_id) FROM public.kq_runs r WHERE r.user_id=p_user AND r.status::TEXT='active'),'[]'),
  'usedStorageGrams',GREATEST(public.kq_warehouse_stock_units(p_user),
   public.kq_warehouse_reserved_storage_before_production(p_user)+public.kq_warehouse_packed_stock_units(p_user))/10+public.kq_zone_reserved_harvest(p_user),
  'reservedDryingGrams',public.kq_zone_reserved_harvest(p_user)+COALESCE((SELECT sum(public.kq_storage_remaining(s.flower_id)::NUMERIC/10)
    FROM public.kq_storage_lots s WHERE s.user_id=p_user AND (s.state->>'readyAt')::TIMESTAMPTZ>now()),0),
  'equipment',COALESCE((SELECT jsonb_agg(jsonb_build_object('code',e.equipment_code,'level',e.level))
   FROM public.kq_player_equipment e WHERE e.user_id=p_user AND e.equipment_code='SIFT-TRAY'
    AND public.kq_processing_machine_available(p_user,ARRAY['SIFT-TRAY'])<=now()),'[]'))
 FROM (SELECT 1) seed LEFT JOIN public.kq_warehouse_layouts l ON l.user_id=p_user;
$$;
REVOKE ALL ON FUNCTION public.kq_staff_production_facility(UUID) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.kq_staff_snapshot(UUID) RENAME TO kq_staff_snapshot_before_production;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot_before_production(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_staff_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_set(jsonb_set(public.kq_staff_snapshot_before_production(p_user),'{context,productionVersion}','1'),
  '{context,productionFacility}',public.kq_staff_production_facility(p_user));
$$;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_staff_production_validate(p_user UUID,p_command JSONB,p_next JSONB,p_effects JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous JSONB; before_production JSONB; production JSONB:=p_next->'production';
 settings JSONB; old_settings JSONB; facility JSONB; input JSONB; zone JSONB;
 task JSONB; old_task JSONB; employee JSONB; event JSONB; item JSONB; field TEXT;
 cost BIGINT:=0; revenue BIGINT:=0; vat BIGINT:=0; salary BIGINT:=0; expected_salary BIGINT;
 duration NUMERIC; task_day INTEGER; starts TIMESTAMPTZ; finishes TIMESTAMPTZ; through TIMESTAMPTZ;
 warehouse public.kq_warehouse_layouts%ROWTYPE;
BEGIN
 SELECT state INTO previous FROM public.kq_staff_accounts WHERE user_id=p_user;
 before_production:=previous->'production'; settings:=production->'settings'; old_settings:=before_production->'settings';
 IF production IS NULL THEN
  IF before_production IS NOT NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_effects) e WHERE e->>'kind'='production')
   OR p_command->>'action' IN ('set-production-rules','assign-production') THEN RAISE EXCEPTION 'staff_production_invalid'; END IF;
  RETURN;
 END IF;
 through:=(p_next->>'lastSettledAt')::TIMESTAMPTZ;
 IF production->'version' IS DISTINCT FROM '1'::JSONB OR jsonb_typeof(settings) IS DISTINCT FROM 'object'
  OR jsonb_typeof(settings->'enabled') IS DISTINCT FROM 'boolean'
  OR settings->>'route' NOT IN ('flower','dry-sift')
  OR jsonb_typeof(production->'lots') IS DISTINCT FROM 'array' OR jsonb_array_length(production->'lots')>100
  OR jsonb_typeof(production->'jobs') IS DISTINCT FROM 'array' OR jsonb_array_length(production->'jobs')>24
  OR jsonb_typeof(production->'stats') IS DISTINCT FROM 'object'
  OR (production->>'advancedAt')::TIMESTAMPTZ>through
  OR (production->>'advancedAt')::TIMESTAMPTZ<COALESCE((before_production->>'advancedAt')::TIMESTAMPTZ,through)
 THEN RAISE EXCEPTION 'staff_production_invalid'; END IF;
 FOREACH field IN ARRAY ARRAY['maxDailyCostCents','cashReserveCents','expectedRevision'] LOOP
  IF jsonb_typeof(settings->field) IS DISTINCT FROM 'number' OR (settings->>field) !~ '^[0-9]{1,9}$'
   OR (settings->>field)::BIGINT>100000000 THEN RAISE EXCEPTION 'staff_production_invalid'; END IF;
 END LOOP;
 IF settings IS DISTINCT FROM old_settings THEN
  IF p_command->>'action' IS DISTINCT FROM 'set-production-rules'
   OR settings-'updatedAt' IS DISTINCT FROM (CASE
    WHEN p_command->'enabled'='false'::JSONB AND p_command->'zoneId'='null'::JSONB
     AND (jsonb_array_length(before_production->'lots')>0 OR jsonb_array_length(before_production->'jobs')>0)
    THEN jsonb_set(p_command-'action','{zoneId}',old_settings->'zoneId') ELSE p_command-'action' END)
   OR settings->'updatedAt' IS DISTINCT FROM p_next->'lastSettledAt'
  THEN RAISE EXCEPTION 'staff_production_changed'; END IF;
  IF before_production IS NOT NULL AND (jsonb_array_length(before_production->'lots')>0 OR jsonb_array_length(before_production->'jobs')>0)
   AND (settings->'zoneId' IS DISTINCT FROM old_settings->'zoneId' OR settings->'route' IS DISTINCT FROM old_settings->'route')
  THEN RAISE EXCEPTION 'staff_production_occupied'; END IF;
 END IF;
 facility:=production->'facility';
 IF facility IS DISTINCT FROM before_production->'facility' AND facility IS DISTINCT FROM 'null'::JSONB THEN
  IF p_command->>'action' IS DISTINCT FROM 'set-production-rules' THEN RAISE EXCEPTION 'staff_production_changed'; END IF;
  SELECT * INTO warehouse FROM public.kq_warehouse_layouts WHERE user_id=p_user;
  IF NOT FOUND OR warehouse.revision IS DISTINCT FROM (settings->>'expectedRevision')::INTEGER THEN RAISE EXCEPTION 'staff_production_changed'; END IF;
  SELECT z INTO zone FROM jsonb_array_elements(warehouse.state->'zones') z WHERE z->>'id'=settings->>'zoneId' AND z->'active'='true';
  IF zone IS NULL OR facility->'zoneId' IS DISTINCT FROM settings->'zoneId'
   OR (facility->>'areaM2')::NUMERIC IS DISTINCT FROM (zone->>'width')::NUMERIC*(zone->>'height')::NUMERIC
   OR EXISTS(SELECT 1 FROM public.kq_runs r WHERE r.user_id=p_user AND r.status::TEXT='active'
    AND (r.warehouse_zone_id IS NULL OR r.warehouse_zone_id=zone->>'id'))
  THEN RAISE EXCEPTION 'staff_production_occupied'; END IF;
  input:=public.kq_staff_production_facility(p_user);
  IF (facility->>'harvestGrams')::NUMERIC NOT BETWEEN 1 AND 1000000
   OR (facility->>'cycleCostCents')::BIGINT NOT BETWEEN 1 AND 100000000
   OR (facility->>'dryingCapacityGrams')::NUMERIC<(facility->>'harvestGrams')::NUMERIC
   OR (facility->>'storageCapacityGrams')::NUMERIC<(facility->>'harvestGrams')::NUMERIC
   OR (facility->>'dryingCapacityGrams')::NUMERIC+(input->>'reservedDryingGrams')::NUMERIC>public.kq_warehouse_drying_capacity_grams(warehouse.state)
   OR (facility->>'storageCapacityGrams')::NUMERIC+(input->>'usedStorageGrams')::NUMERIC>public.kq_warehouse_storage_capacity_units(p_user,warehouse.state)/10
   OR (settings->>'route'='dry-sift' AND (jsonb_array_length(input->'equipment')=0 OR facility->'processingAvailable' IS DISTINCT FROM 'true'::JSONB))
  THEN RAISE EXCEPTION 'staff_production_capacity'; END IF;
 END IF;
 IF facility='null'::JSONB AND (settings->'enabled'='true'::JSONB OR jsonb_array_length(production->'lots')>0 OR jsonb_array_length(production->'jobs')>0)
 THEN RAISE EXCEPTION 'staff_production_occupied'; END IF;

 FOR task IN SELECT t FROM jsonb_array_elements(p_next->'tasks') t WHERE t->>'kind'='production' LOOP
  SELECT t INTO old_task FROM jsonb_array_elements(previous->'tasks') t WHERE t->>'id'=task->>'id';
  duration:=(task->>'hours')::NUMERIC; starts:=(task->>'startedAt')::TIMESTAMPTZ; finishes:=(task->>'completesAt')::TIMESTAMPTZ;
  task_day:=(task->>'day')::INTEGER;
  IF duration NOT BETWEEN .5 AND 7 OR mod(duration,.5)<>0 OR finishes-starts<>duration*interval '10 minutes'
   OR task->>'employeeId'='player' OR task->>'productionStep' NOT IN ('auto','culture','trim','processing','sell')
   OR task ?| ARRAY['cultureShift','processingShift','trimQueue','result']
   OR (task->>'productionWorkedHours')::NUMERIC NOT BETWEEN 0 AND duration+.000001
   OR starts<COALESCE((old_settings->>'updatedAt')::TIMESTAMPTZ,(settings->>'updatedAt')::TIMESTAMPTZ) AND old_task IS NULL
  THEN RAISE EXCEPTION 'staff_production_hours'; END IF;
  IF old_task IS NOT NULL THEN
   IF task-'status'-'outcome'-'productionWorkedHours'-'productionReason' IS DISTINCT FROM old_task-'status'-'outcome'-'productionWorkedHours'-'productionReason'
    OR (task->>'productionWorkedHours')::NUMERIC<(old_task->>'productionWorkedHours')::NUMERIC
    OR old_task->>'status'='completed' AND task IS DISTINCT FROM old_task THEN RAISE EXCEPTION 'staff_production_changed'; END IF;
  ELSE
   SELECT e INTO employee FROM jsonb_array_elements(p_next->'employees') e WHERE e->>'id'=task->>'employeeId';
   IF employee IS NULL OR p_command->>'action' NOT IN ('assign-production','settle')
    OR (p_command->>'action'='assign-production' AND (task->'employeeId' IS DISTINCT FROM p_command->'employeeId'
      OR task->'hours' IS DISTINCT FROM p_command->'hours' OR task->'productionStep' IS DISTINCT FROM p_command->'productionStep'))
    OR (p_command->>'action'='settle' AND NOT(task ? 'weeklyPlanAt'))
    OR task_day<>public.kq_player_work_day(p_user,starts) OR task_day<>public.kq_player_work_day(p_user,finishes-interval '1 microsecond')
    OR (task_day-1)%7>=LEAST(5,(employee->>'weeklyHours')::NUMERIC/7)
    OR starts<(employee->>'hiredAt')::TIMESTAMPTZ OR finishes>COALESCE((employee->>'endsAt')::TIMESTAMPTZ,'infinity')
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(employee->'leave') leave_row WHERE task_day BETWEEN (leave_row->>'startDay')::INTEGER AND (leave_row->>'endDay')::INTEGER)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_next->'payroll') pay WHERE (pay->>'dueAt')::TIMESTAMPTZ<=starts AND (pay->>'paidCents')::BIGINT<(pay->>'totalCents')::BIGINT)
    OR (employee->'workDays'->task_day::TEXT->>'usedHours')::NUMERIC>7+COALESCE((employee->'workDays'->task_day::TEXT->>'extraHours')::NUMERIC,0)
   THEN RAISE EXCEPTION 'staff_production_hours'; END IF;
   FOREACH field IN ARRAY ARRAY['culture','processing','sales'] LOOP
    IF jsonb_typeof(task->'productionSkills'->field) IS DISTINCT FROM 'number'
     OR (task->'productionSkills'->>field)::INTEGER NOT BETWEEN 1 AND LEAST(10,1+floor(sqrt((employee->'skills'->>field)::NUMERIC/100))::INTEGER+CASE WHEN employee->>'trait'='versatile' THEN 1 ELSE 0 END)
    THEN RAISE EXCEPTION 'staff_production_changed'; END IF;
   END LOOP;
   expected_salary:=round(round(round((employee->>'hourlyCents')::NUMERIC*(employee->>'weeklyHours')::NUMERIC*52/12)*.35)
    +round((employee->>'hourlyCents')::NUMERIC*(employee->>'weeklyHours')::NUMERIC*52/12));
   expected_salary:=round(expected_salary::NUMERIC*7/(30*(employee->>'weeklyHours')::NUMERIC)*duration);
   IF (task->>'productionSalaryCents')::BIGINT IS DISTINCT FROM expected_salary THEN RAISE EXCEPTION 'staff_production_changed'; END IF;
   salary:=salary+expected_salary;
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_next->'tasks') other WHERE other->>'id'<>task->>'id' AND other->>'employeeId'=task->>'employeeId'
   AND (other->>'day')::INTEGER=task_day AND (other->'cultureShift'='true' OR other->'processingShift'='true'
    OR (other->>'startedAt')::TIMESTAMPTZ<finishes AND (other->>'completesAt')::TIMESTAMPTZ>starts))
  THEN RAISE EXCEPTION 'staff_production_hours'; END IF;
 END LOOP;

 FOR item IN SELECT e FROM jsonb_array_elements(p_effects) e WHERE e->>'kind'='production' LOOP
  event:=item->'event';
  SELECT t INTO task FROM jsonb_array_elements(p_next->'tasks') t WHERE t->>'id'=event->>'taskId' AND t->>'kind'='production';
  IF task IS NULL OR event->'employeeId' IS DISTINCT FROM task->'employeeId'
   OR event->>'type' NOT IN ('cost','sale') OR length(event->>'id') NOT BETWEEN 1 AND 200
   OR (event->>'at')::TIMESTAMPTZ>through OR (event->>'at')::TIMESTAMPTZ<(task->>'startedAt')::TIMESTAMPTZ
   OR (event->>'at')::TIMESTAMPTZ>(task->>'completesAt')::TIMESTAMPTZ
   OR (event->>'at')::TIMESTAMPTZ<COALESCE((before_production->>'advancedAt')::TIMESTAMPTZ,through)
  THEN RAISE EXCEPTION 'staff_production_invalid'; END IF;
  FOREACH field IN ARRAY ARRAY['amountCents','vatCents'] LOOP
   IF jsonb_typeof(event->field) IS DISTINCT FROM 'number' OR (event->>field) !~ '^[0-9]{1,9}$' OR (event->>field)::BIGINT>100000000
   THEN RAISE EXCEPTION 'staff_production_invalid'; END IF;
  END LOOP;
  IF (event->>'grams')::NUMERIC NOT BETWEEN 0 AND 1000000 OR (event->>'vatCents')::BIGINT>(event->>'amountCents')::BIGINT
   OR event->>'type'='cost' AND (event->>'vatCents')::BIGINT<>0 THEN RAISE EXCEPTION 'staff_production_invalid'; END IF;
  IF event->>'type'='cost' THEN cost:=cost+(event->>'amountCents')::BIGINT;
  ELSE
   IF (event->>'amountCents')::BIGINT>ceil((event->>'grams')::NUMERIC*1600)+1 THEN RAISE EXCEPTION 'staff_production_invalid'; END IF;
   revenue:=revenue+(event->>'amountCents')::BIGINT; vat:=vat+(event->>'vatCents')::BIGINT;
  END IF;
 END LOOP;
 IF (production#>>'{stats,costCents}')::BIGINT IS DISTINCT FROM COALESCE((before_production#>>'{stats,costCents}')::BIGINT,0)+cost
  OR (production#>>'{stats,salesCents}')::BIGINT IS DISTINCT FROM COALESCE((before_production#>>'{stats,salesCents}')::BIGINT,0)+revenue
  OR (production#>>'{stats,vatCents}')::BIGINT IS DISTINCT FROM COALESCE((before_production#>>'{stats,vatCents}')::BIGINT,0)+vat
  OR (production#>>'{stats,salaryCostCents}')::BIGINT IS DISTINCT FROM COALESCE((before_production#>>'{stats,salaryCostCents}')::BIGINT,0)+salary
  OR (production#>>'{stats,vatCents}')::BIGINT IS DISTINCT FROM round((production#>>'{stats,salesCents}')::NUMERIC/6)::BIGINT
 THEN RAISE EXCEPTION 'staff_production_changed'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_production_validate(UUID,JSONB,JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_staff_production_event(p_user UUID,p_event JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE amount INTEGER:=(p_event->>'amountCents')::INTEGER; tax INTEGER:=(p_event->>'vatCents')::INTEGER;
 stamp TIMESTAMPTZ:=(p_event->>'at')::TIMESTAMPTZ; key TEXT:='production:'||(p_event->>'id'); cash BIGINT;
BEGIN
 INSERT INTO public.kq_staff_production_events(user_id,event_id,occurred_at,kind,lot_id,task_id,employee_id,amount_cents,vat_cents,grams)
 VALUES(p_user,p_event->>'id',stamp,p_event->>'type',p_event->>'lotId',p_event->>'taskId',p_event->>'employeeId',amount,tax,(p_event->>'grams')::NUMERIC);
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 IF p_event->>'type'='cost' THEN
  IF cash<amount THEN RAISE EXCEPTION 'staff_cash'; END IF;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-amount,updated_at=now() WHERE user_id=p_user;
  PERFORM public.kq_treasury_pair(p_user,'production-cost',key,stamp,'expense_other','suspense',amount,'Production autonome · '||(p_event->>'lotId'));
 ELSE
  IF cash+amount-tax>2147483647 THEN RAISE EXCEPTION 'staff_production_invalid'; END IF;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+amount-tax,updated_at=now() WHERE user_id=p_user;
  UPDATE public.kq_commerce_accounts SET vat_reserved_cents=vat_reserved_cents+tax WHERE user_id=p_user;
  PERFORM public.kq_treasury_pair(p_user,'production-sale',key,stamp,'suspense','revenue_wholesale',amount-tax,'Vente autonome · '||(p_event->>'lotId'));
  IF tax>0 THEN PERFORM public.kq_treasury_pair(p_user,'production-vat',key||':vat',stamp,'suspense','vat_payable',tax,'TVA · production autonome'); END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_production_event(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;

-- The staff migration chain remains the single transaction entry point.
DO $$ DECLARE body TEXT; before TEXT; BEGIN
 body:=pg_get_functiondef('public.kq_staff_validate_weekly_plan(uuid,jsonb,jsonb,integer)'::regprocedure);
 before:='''administration'',''training'',''trim'')';
 IF strpos(body,before)=0 THEN RAISE EXCEPTION 'production_weekly_kind_anchor'; END IF;
 body:=replace(body,before,'''administration'',''training'',''trim'',''production'')');
 before:='-''status''-''outcome''';
 body:=replace(body,before,before||'-''productionWorkedHours''-''productionReason''');
 before:='OR (planned ? ''targetId''';
 IF strpos(body,before)=0 THEN RAISE EXCEPTION 'production_weekly_step_anchor'; END IF;
 body:=replace(body,before,'OR (planned->>''kind''=''production'' AND task->''productionStep'' IS DISTINCT FROM planned->''productionStep'') '||before);
 EXECUTE body;
 body:=pg_get_functiondef('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure);
 before:='''set-administration-rules'',''settle''';
 IF strpos(body,before)=0 THEN RAISE EXCEPTION 'production_command_anchor'; END IF;
 body:=replace(body,before,'''set-administration-rules'',''set-production-rules'',''assign-production'',''settle''');
 before:='PERFORM public.kq_staff_validate_task_results(p_user_id,p_state);';
 IF strpos(body,before)=0 THEN RAISE EXCEPTION 'production_validation_anchor'; END IF;
 body:=replace(body,before,before||E'\n PERFORM public.kq_staff_production_validate(p_user_id,p_command,p_state,p_effects);');
 before:='IF cash<p_debit_cents THEN RAISE EXCEPTION ''staff_cash''; END IF;';
 IF strpos(body,before)=0 THEN RAISE EXCEPTION 'production_cash_anchor'; END IF;
 body:=replace(body,before,'IF cash+COALESCE((SELECT sum(CASE WHEN e#>>''{event,type}''=''sale'' THEN (e#>>''{event,amountCents}'')::BIGINT-(e#>>''{event,vatCents}'')::BIGINT ELSE -(e#>>''{event,amountCents}'')::BIGINT END) FROM jsonb_array_elements(p_effects) e WHERE e->>''kind''=''production''),0)<p_debit_cents THEN RAISE EXCEPTION ''staff_cash''; END IF;');
 before:='UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-p_debit_cents,updated_at=now() WHERE user_id=p_user_id;';
 IF strpos(body,before)=0 THEN RAISE EXCEPTION 'production_debit_anchor'; END IF;
 body:=replace(body,before,'-- Staff fixed costs are posted after chronological production cash movements.');
 before:='IF effect_kind=''culture'' THEN';
 IF strpos(body,before)=0 THEN RAISE EXCEPTION 'production_effect_anchor'; END IF;
 body:=replace(body,before,'IF effect_kind=''production'' THEN PERFORM public.kq_staff_production_event(p_user_id,effect->''event''); ELSIF effect_kind=''culture'' THEN');
 before:='UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;';
 IF strpos(body,before)=0 THEN RAISE EXCEPTION 'production_final_debit_anchor'; END IF;
 body:=replace(body,before,'IF p_debit_cents>0 THEN UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-p_debit_cents,updated_at=now() WHERE user_id=p_user_id; END IF; '||before);
 EXECUTE body;
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_staff_commit(UUID,INTEGER,UUID,JSONB,JSONB,INTEGER,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_staff_commit(UUID,INTEGER,UUID,JSONB,JSONB,INTEGER,JSONB) TO service_role;

-- New kinds are excluded explicitly, even though production uses no flowers,
-- trimming rows, market receipts, reputation or player skill updates.
DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 body:=pg_get_functiondef('public.kq_mission_metrics(uuid)'::regprocedure);
 anchor:='payload->>''status''=''completed''';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'production_missions_anchor'; END IF;
 EXECUTE replace(body,anchor,anchor||' AND payload->>''kind'' IS DISTINCT FROM ''production''');
END $$;

CREATE FUNCTION public.kq_staff_production_run_guard() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE production JSONB; drying NUMERIC; pending NUMERIC; layout JSONB; zone_id TEXT;
BEGIN
 IF NEW.status::TEXT<>'active' OR TG_OP='UPDATE' AND OLD.status::TEXT='active' THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||NEW.user_id::TEXT,0));
 production:=public.kq_staff_production_reservation(NEW.user_id);
 IF production IS NULL THEN RETURN NEW; END IF;
 zone_id:=COALESCE(NEW.warehouse_zone_id,NEW.state#>>'{warehouse,zoneId}');
 IF zone_id IS NULL OR zone_id=production#>>'{facility,zoneId}' THEN RAISE EXCEPTION 'staff_production_occupied'; END IF;
 SELECT state INTO layout FROM public.kq_warehouse_layouts WHERE user_id=NEW.user_id;
 SELECT COALESCE(sum(public.kq_storage_remaining(s.flower_id)::NUMERIC/10),0) INTO drying
 FROM public.kq_storage_lots s WHERE s.user_id=NEW.user_id AND (s.state->>'readyAt')::TIMESTAMPTZ>now();
 pending:=public.kq_zone_reserved_harvest(NEW.user_id);
 IF COALESCE((NEW.state#>>'{warehouse,estimatedHarvestGrams}')::NUMERIC,0)+pending+drying+(production#>>'{facility,dryingCapacityGrams}')::NUMERIC>public.kq_warehouse_drying_capacity_grams(layout)
 THEN RAISE EXCEPTION 'staff_production_capacity'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_production_run_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER aaa_staff_production_run_guard BEFORE INSERT OR UPDATE OF status ON public.kq_runs FOR EACH ROW EXECUTE FUNCTION public.kq_staff_production_run_guard();

CREATE FUNCTION public.kq_staff_production_layout_guard() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE production JSONB; zone_id TEXT;
BEGIN
 production:=public.kq_staff_production_reservation(OLD.user_id);
 IF production IS NULL THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END IF;
 zone_id:=production#>>'{facility,zoneId}';
 IF TG_OP='DELETE' OR (SELECT z FROM jsonb_array_elements(OLD.state->'zones') z WHERE z->>'id'=zone_id)
   IS DISTINCT FROM (SELECT z FROM jsonb_array_elements(NEW.state->'zones') z WHERE z->>'id'=zone_id)
  OR OLD.state->'serviceZones' IS DISTINCT FROM NEW.state->'serviceZones'
 THEN RAISE EXCEPTION 'staff_production_occupied'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_production_layout_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER aaa_staff_production_layout_guard BEFORE UPDATE OR DELETE ON public.kq_warehouse_layouts FOR EACH ROW EXECUTE FUNCTION public.kq_staff_production_layout_guard();

ALTER FUNCTION public.kq_processing_machine_available(UUID,TEXT[],UUID) RENAME TO kq_processing_machine_before_production;
REVOKE ALL ON FUNCTION public.kq_processing_machine_before_production(UUID,TEXT[],UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_processing_machine_available(p_user UUID,p_codes TEXT[],p_flower UUID DEFAULT NULL) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_codes&&ARRAY['SIFT-TRAY'] AND public.kq_staff_production_reservation(p_user)#>>'{settings,route}'='dry-sift'
 THEN RAISE EXCEPTION 'staff_production_machine_reserved'; END IF;
 RETURN public.kq_processing_machine_before_production(p_user,p_codes,p_flower);
END $$;
REVOKE ALL ON FUNCTION public.kq_processing_machine_available(UUID,TEXT[],UUID) FROM PUBLIC,anon,authenticated,service_role;
-- Snapshot eligibility checks the ordinary workshop, never its own reservation.
DO $$ DECLARE body TEXT; BEGIN
 body:=pg_get_functiondef('public.kq_staff_production_facility(uuid)'::regprocedure);
 EXECUTE replace(body,'public.kq_processing_machine_available(p_user,','public.kq_processing_machine_before_production(p_user,');
END $$;

CREATE FUNCTION public.kq_staff_production_equipment_guard() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.equipment_code='SIFT-TRAY' AND public.kq_staff_production_reservation(OLD.user_id)#>>'{settings,route}'='dry-sift'
 THEN RAISE EXCEPTION 'staff_production_machine_reserved'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_production_equipment_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER aaa_staff_production_equipment_guard BEFORE UPDATE OR DELETE ON public.kq_player_equipment FOR EACH ROW EXECUTE FUNCTION public.kq_staff_production_equipment_guard();

COMMIT;
