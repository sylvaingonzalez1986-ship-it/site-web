BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Weekly plans are part of the existing staff revision. No historical state,
-- receipt, clock, payroll or cash is rewritten by this upgrade. The server
-- catches up chronologically until now, stopping new work at unpaid payroll;
-- this guard protects the saved plan,
-- occurrence identity and automatic expense at the same CAS/receipt boundary.
CREATE FUNCTION public.kq_staff_validate_weekly_plan(p_user UUID,p_command JSONB,p_state JSONB,p_debit INTEGER) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous JSONB; employee JSONB; old_employee JSONB; plan JSONB; old_plan JSONB;
 day_slots JSONB; slot JSONB; entry JSONB; task JSONB; old_task JSONB; planned JSONB;
 current_day INTEGER; day_index INTEGER; slot_index INTEGER; task_day INTEGER;
 total_cost BIGINT; automatic_cost BIGINT:=0; day_hours NUMERIC; plan_changed BOOLEAN;
 action TEXT:=p_command->>'action'; target_employee TEXT:=p_command->>'employeeId';
BEGIN
 SELECT state INTO previous FROM public.kq_staff_accounts WHERE user_id=p_user;
 current_day:=public.kq_player_work_day(p_user);
 IF current_day IS NULL THEN RAISE EXCEPTION 'staff_profile'; END IF;
 IF action='set-weekly-plan' AND (p_debit<>0
  OR jsonb_typeof(p_command->'enabled') IS DISTINCT FROM 'boolean'
  OR jsonb_typeof(p_command->'days') IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_command->'days')<>5
  OR jsonb_typeof(p_command->'expectedWeeklyCostCents') IS DISTINCT FROM 'number'
  OR COALESCE(p_command->>'expectedWeeklyCostCents','') !~ '^[0-9]{1,9}$'
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(previous->'employees') e
   WHERE e->>'id'=target_employee AND e->>'status'='active'))
 THEN RAISE EXCEPTION 'staff_invalid'; END IF;

 FOR employee IN SELECT e FROM jsonb_array_elements(p_state->'employees') e LOOP
  SELECT e INTO old_employee FROM jsonb_array_elements(previous->'employees') e WHERE e->>'id'=employee->>'id';
  plan:=employee->'weeklyPlan'; old_plan:=old_employee->'weeklyPlan';
  IF old_plan IS NOT NULL AND plan IS NULL THEN RAISE EXCEPTION 'staff_weekly_plan_changed'; END IF;
  IF plan IS NULL THEN
   IF action='set-weekly-plan' AND employee->>'id'=target_employee THEN RAISE EXCEPTION 'staff_weekly_plan_changed'; END IF;
   CONTINUE;
  END IF;
  IF jsonb_typeof(plan) IS DISTINCT FROM 'object'
   OR jsonb_typeof(plan->'enabled') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(plan->'days') IS DISTINCT FROM 'array' OR jsonb_array_length(plan->'days')<>5
   OR jsonb_typeof(plan->'nextDay') IS DISTINCT FROM 'number' OR COALESCE(plan->>'nextDay','') !~ '^[1-9][0-9]{0,8}$'
   OR (plan->>'nextDay')::INTEGER>current_day+1
   OR jsonb_typeof(plan->'updatedAt') IS DISTINCT FROM 'string' OR NOT isfinite((plan->>'updatedAt')::TIMESTAMPTZ)
   OR (plan->>'updatedAt')::TIMESTAMPTZ>now()+interval '1 second'
   OR jsonb_typeof(plan->'weeklyCostCents') IS DISTINCT FROM 'number' OR COALESCE(plan->>'weeklyCostCents','') !~ '^[0-9]{1,9}$'
   OR jsonb_typeof(plan->'history') IS DISTINCT FROM 'array' OR jsonb_array_length(plan->'history')>7
  THEN RAISE EXCEPTION 'staff_invalid'; END IF;
  total_cost:=0; day_index:=0;
  FOR day_slots IN SELECT d FROM jsonb_array_elements(plan->'days') d LOOP
   IF jsonb_typeof(day_slots) IS DISTINCT FROM 'array' OR jsonb_array_length(day_slots)>3 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
   day_hours:=0; slot_index:=0;
   FOR slot IN SELECT s FROM jsonb_array_elements(day_slots) s LOOP
    IF jsonb_typeof(slot) IS DISTINCT FROM 'object'
     OR COALESCE(slot->>'kind','') NOT IN ('culture','processing','communication','sales','administration','training','trim')
     OR jsonb_typeof(slot->'hours') IS DISTINCT FROM 'number' OR (slot->>'hours')::NUMERIC NOT BETWEEN .5 AND 7
     OR mod((slot->>'hours')::NUMERIC,.5)<>0
     OR jsonb_typeof(slot->'costCents') IS DISTINCT FROM 'number' OR COALESCE(slot->>'costCents','') !~ '^[0-9]{1,9}$'
     OR (slot->>'kind' NOT IN ('training','sales') AND (slot->>'costCents')::BIGINT<>0)
     OR (slot->>'kind' IN ('training','sales') AND (slot->>'hours')::NUMERIC<2)
     OR (slot->>'kind'='training' AND COALESCE(slot->>'skill','') NOT IN ('culture','processing','communication','sales','administration'))
     OR (slot->>'kind'='trim' AND COALESCE(slot->>'trimMode','') NOT IN ('manual','machine'))
     OR (slot->>'kind'='sales' AND (jsonb_typeof(slot->'cityId') IS DISTINCT FROM 'string' OR length(slot->>'cityId') NOT BETWEEN 1 AND 100))
     OR (slot ? 'targetId' AND (jsonb_typeof(slot->'targetId') IS DISTINCT FROM 'string' OR length(slot->>'targetId') NOT BETWEEN 1 AND 200))
    THEN RAISE EXCEPTION 'staff_invalid'; END IF;
    day_hours:=day_hours+(slot->>'hours')::NUMERIC; total_cost:=total_cost+(slot->>'costCents')::BIGINT;
    IF action='set-weekly-plan' AND employee->>'id'=target_employee
     AND (slot-'costCents') IS DISTINCT FROM p_command->'days'->day_index->slot_index
    THEN RAISE EXCEPTION 'staff_weekly_plan_changed'; END IF;
    slot_index:=slot_index+1;
   END LOOP;
   IF day_hours>7 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
   IF action='set-weekly-plan' AND employee->>'id'=target_employee
    AND (jsonb_typeof(p_command->'days'->day_index) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_command->'days'->day_index)<>slot_index)
   THEN RAISE EXCEPTION 'staff_weekly_plan_changed'; END IF;
   day_index:=day_index+1;
  END LOOP;
  IF total_cost<>(plan->>'weeklyCostCents')::BIGINT THEN RAISE EXCEPTION 'staff_invalid'; END IF;
  FOR entry IN SELECT h FROM jsonb_array_elements(plan->'history') h LOOP
   IF jsonb_typeof(entry) IS DISTINCT FROM 'object'
    OR jsonb_typeof(entry->'day') IS DISTINCT FROM 'number' OR COALESCE(entry->>'day','') !~ '^[1-9][0-9]{0,8}$'
    OR (entry->>'day')::INTEGER>current_day
    OR jsonb_typeof(entry->'started') IS DISTINCT FROM 'number' OR COALESCE(entry->>'started','') !~ '^[0-3]$'
    OR jsonb_typeof(entry->'skipped') IS DISTINCT FROM 'number' OR COALESCE(entry->>'skipped','') !~ '^[0-3]$'
    OR (entry->>'started')::INTEGER+(entry->>'skipped')::INTEGER>3
    OR jsonb_typeof(entry->'reasons') IS DISTINCT FROM 'array' OR jsonb_array_length(entry->'reasons')>3
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(entry->'reasons') r WHERE jsonb_typeof(r) IS DISTINCT FROM 'string' OR length(r#>>'{}')>500)
   THEN RAISE EXCEPTION 'staff_invalid'; END IF;
  END LOOP;
  plan_changed:=action='set-weekly-plan' AND employee->>'id'=target_employee;
  IF plan_changed THEN
   IF employee->>'status'<>'active' OR plan->'enabled' IS DISTINCT FROM p_command->'enabled'
    OR plan->'weeklyCostCents' IS DISTINCT FROM p_command->'expectedWeeklyCostCents'
    OR plan->'updatedAt' IS DISTINCT FROM p_state->'lastSettledAt'
    OR (plan->>'nextDay')::INTEGER<>current_day+1
    OR (old_plan IS NOT NULL AND (plan->>'updatedAt')::TIMESTAMPTZ<=(old_plan->>'updatedAt')::TIMESTAMPTZ)
   THEN RAISE EXCEPTION 'staff_weekly_plan_changed'; END IF;
  ELSE
   IF old_plan IS NULL OR (plan-'nextDay'-'history') IS DISTINCT FROM (old_plan-'nextDay'-'history')
    OR (plan->>'nextDay')::INTEGER<(old_plan->>'nextDay')::INTEGER
    OR (action<>'settle' AND plan IS DISTINCT FROM old_plan)
   THEN RAISE EXCEPTION 'staff_weekly_plan_changed'; END IF;
  END IF;
 END LOOP;

 -- Existing automatic task terms survive completion and plan edits unchanged.
 -- A new occurrence must belong to the old authorized plan and a newly
 -- consumed day. A changed plan can never rewrite or recreate its old tasks.
 FOR task IN SELECT t FROM jsonb_array_elements(p_state->'tasks') t LOOP
  SELECT t INTO old_task FROM jsonb_array_elements(previous->'tasks') t WHERE t->>'id'=task->>'id';
  IF old_task IS NOT NULL AND (task->'weeklyPlanAt' IS DISTINCT FROM old_task->'weeklyPlanAt'
   OR task->'weeklySlot' IS DISTINCT FROM old_task->'weeklySlot'
   OR task->'weeklyCostCents' IS DISTINCT FROM old_task->'weeklyCostCents')
  THEN RAISE EXCEPTION 'staff_weekly_plan_changed'; END IF;
  IF old_task ? 'weeklyPlanAt'
   AND (task-'status'-'outcome'-'trimProgressAt'-'trimGrams'-'trimContributions') IS DISTINCT FROM
    (old_task-'status'-'outcome'-'trimProgressAt'-'trimGrams'-'trimContributions')
  THEN RAISE EXCEPTION 'staff_weekly_plan_changed'; END IF;
  IF NOT (task ?| ARRAY['weeklyPlanAt','weeklySlot','weeklyCostCents']) THEN CONTINUE; END IF;
  IF jsonb_typeof(task->'weeklyPlanAt') IS DISTINCT FROM 'string'
   OR jsonb_typeof(task->'weeklySlot') IS DISTINCT FROM 'number' OR COALESCE(task->>'weeklySlot','') !~ '^[0-2]$'
   OR jsonb_typeof(task->'weeklyCostCents') IS DISTINCT FROM 'number' OR COALESCE(task->>'weeklyCostCents','') !~ '^[0-9]{1,9}$'
   OR jsonb_typeof(task->'day') IS DISTINCT FROM 'number' OR COALESCE(task->>'day','') !~ '^[1-9][0-9]{0,8}$'
   OR task->>'employeeId'='player'
   OR task->>'id' IS DISTINCT FROM 'weekly:'||(task->>'employeeId')||':'||(task->>'weeklyPlanAt')||':'||(task->>'day')||':'||(task->>'weeklySlot')
   OR (SELECT count(*) FROM jsonb_array_elements(p_state->'tasks') t WHERE t->>'id'=task->>'id')<>1
  THEN RAISE EXCEPTION 'staff_invalid'; END IF;
  IF old_task IS NOT NULL THEN CONTINUE; END IF;
  SELECT e INTO old_employee FROM jsonb_array_elements(previous->'employees') e WHERE e->>'id'=task->>'employeeId';
  SELECT e INTO employee FROM jsonb_array_elements(p_state->'employees') e WHERE e->>'id'=task->>'employeeId';
  old_plan:=old_employee->'weeklyPlan'; plan:=employee->'weeklyPlan';
  task_day:=(task->>'day')::INTEGER; slot_index:=(task->>'weeklySlot')::INTEGER;
  planned:=old_plan->'days'->((task_day-1)%7)->slot_index;
  IF action<>'settle' OR old_employee IS NULL OR employee IS NULL OR old_employee->>'status'<>'active'
   OR old_plan->'enabled' IS DISTINCT FROM 'true'::JSONB
   OR task->'weeklyPlanAt' IS DISTINCT FROM old_plan->'updatedAt'
   OR plan->'updatedAt' IS DISTINCT FROM old_plan->'updatedAt'
   OR task_day<(old_plan->>'nextDay')::INTEGER OR task_day>=(plan->>'nextDay')::INTEGER
   OR planned IS NULL OR task->'kind' IS DISTINCT FROM planned->'kind' OR task->'hours' IS DISTINCT FROM planned->'hours'
   OR task->'weeklyCostCents' IS DISTINCT FROM planned->'costCents'
   OR (planned->>'kind'='training' AND task->'skill' IS DISTINCT FROM planned->'skill')
   OR (planned->>'kind'='sales' AND task->'cityId' IS DISTINCT FROM planned->'cityId')
   OR (planned->>'kind'='trim' AND (task->'trimMode' IS DISTINCT FROM planned->'trimMode' OR task->'trimQueue' IS DISTINCT FROM 'true'::JSONB))
   OR (planned ? 'targetId' AND task->'targetId' IS DISTINCT FROM planned->'targetId')
  THEN RAISE EXCEPTION 'staff_weekly_plan_changed'; END IF;
  automatic_cost:=automatic_cost+(task->>'weeklyCostCents')::BIGINT;
 END LOOP;
 IF action='settle' AND automatic_cost<>p_debit THEN RAISE EXCEPTION 'staff_weekly_plan_changed'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_validate_weekly_plan(UUID,JSONB,JSONB,INTEGER) FROM PUBLIC,anon,authenticated,service_role;

-- Patch only known anchors of the fully composed implementation. Keep replay
-- before validation and retain payroll delta, shared hours, trim and archives.
DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 body:=pg_get_functiondef('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure);
 anchor:='''player-assign'',''settle''';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'staff_weekly_plan_whitelist_drift'; END IF;
 body:=replace(body,anchor,'''player-assign'',''set-weekly-plan'',''settle''');
 anchor:='PERFORM public.kq_player_work_validate_staff(p_user_id,p_command,p_state);';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'staff_weekly_plan_guard_drift'; END IF;
 EXECUTE replace(body,anchor,anchor||E'\n PERFORM public.kq_staff_validate_weekly_plan(p_user_id,p_command,p_state,p_debit_cents);');
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_staff_commit(UUID,INTEGER,UUID,JSONB,JSONB,INTEGER,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_staff_commit(UUID,INTEGER,UUID,JSONB,JSONB,INTEGER,JSONB) TO service_role;

ALTER FUNCTION public.kq_staff_snapshot(UUID) RENAME TO kq_staff_snapshot_before_weekly_plan;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot_before_weekly_plan(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_staff_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH snapshot AS (SELECT public.kq_staff_snapshot_before_weekly_plan(p_user) AS value)
 SELECT jsonb_set(jsonb_set(value,'{context,weeklyPlanVersion}','1'::JSONB),'{context,activeRuns}',
  COALESCE((SELECT jsonb_agg(item||jsonb_build_object('startedAt',r.started_at) ORDER BY ordinal)
   FROM jsonb_array_elements(value#>'{context,activeRuns}') WITH ORDINALITY AS runs(item,ordinal)
   JOIN public.kq_runs r ON r.id=(item->>'id')::UUID AND r.user_id=p_user),'[]'::JSONB)) FROM snapshot;
$$;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
