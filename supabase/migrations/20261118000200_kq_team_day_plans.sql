BEGIN;
SET LOCAL lock_timeout = '5s';

-- One-off reservations live in the existing, owner-locked staff document.
-- All running work, receipts, payments and effects keep their original paths.
ALTER FUNCTION public.kq_staff_snapshot(UUID) RENAME TO kq_staff_snapshot_before_day_plans;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot_before_day_plans(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_staff_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_set(public.kq_staff_snapshot_before_day_plans(p_user),'{context,dayPlanVersion}','1');
$$;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_team_day_transition(p_user UUID,p_old JSONB,p_next JSONB,p_command JSONB,p_debit INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE today INTEGER:=public.kq_player_work_day(p_user);
 action TEXT:=p_command->>'action'; is_edit BOOLEAN:=action IN ('save-day-plan','remove-day-plan','start-day-plan','start-team-task');
 version INTEGER:=COALESCE((p_old->>'dayPlanVersion')::INTEGER,0);
 previous JSONB; next_plans JSONB:=COALESCE(p_next->'dayPlans','[]'); target JSONB; next_target JSONB; assignment JSONB;
 unchanged JSONB; other_plans JSONB; row JSONB; group_row RECORD; employee JSONB; capacity NUMERIC; used NUMERIC; owner_id TEXT; target_index INTEGER;
BEGIN
 IF today IS NULL THEN RAISE EXCEPTION 'staff_profile'; END IF;
 SELECT COALESCE(jsonb_agg(e ORDER BY n),'[]') INTO previous
 FROM jsonb_array_elements(COALESCE(p_old->'dayPlans','[]')) WITH ORDINALITY a(e,n) WHERE (e->>'day')::INTEGER>=today
 AND (e->>'assigneeId'='player' OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_old->'employees') member
  WHERE member->>'id'=e->>'assigneeId' AND member->>'status'='active'
  AND (member->>'endsAt' IS NULL OR (member->>'endsAt')::TIMESTAMPTZ>(p_next->>'lastSettledAt')::TIMESTAMPTZ)));
 IF jsonb_typeof(next_plans) IS DISTINCT FROM 'array' OR jsonb_array_length(next_plans)>128
  OR (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(next_plans) e)<>jsonb_array_length(next_plans)
  OR COALESCE((p_next->>'dayPlanVersion')::INTEGER,0) IS DISTINCT FROM version+(CASE WHEN is_edit THEN 1 ELSE 0 END)
 THEN RAISE EXCEPTION 'team_plan_changed'; END IF;
 IF is_edit THEN
  IF (p_command->>'expectedDay')::INTEGER IS DISTINCT FROM today OR (p_command->>'expectedVersion')::INTEGER IS DISTINCT FROM version
   THEN RAISE EXCEPTION 'team_plan_changed'; END IF;
  SELECT e INTO target FROM jsonb_array_elements(previous) e WHERE e->>'id'=p_command->>'planId';
  IF (p_command ? 'planId' OR action IN ('start-day-plan','remove-day-plan')) AND target IS NULL
   THEN RAISE EXCEPTION 'team_plan_changed'; END IF;
 END IF;
 SELECT COALESCE(jsonb_agg(e ORDER BY n),'[]') INTO unchanged
 FROM jsonb_array_elements(previous) WITH ORDINALITY a(e,n) WHERE e IS DISTINCT FROM target;
 IF action='save-day-plan' THEN
  SELECT e INTO STRICT next_target FROM jsonb_array_elements(next_plans) e
   WHERE CASE WHEN target IS NOT NULL THEN e->>'id'=target->>'id'
    ELSE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(previous) o WHERE o->>'id'=e->>'id') END;
  assignment:=p_command->'assignment';
  owner_id:=CASE WHEN assignment->>'action'='player-assign' OR (assignment->>'action'='trim' AND assignment->'employeeId'='null'::JSONB)
   THEN 'player' ELSE assignment->>'employeeId' END;
  IF COALESCE(assignment->>'action','') NOT IN ('assign','train','assign-production','trim','player-assign')
   OR COALESCE(length(next_target->>'id'),0) NOT BETWEEN 1 AND 100 OR owner_id IS NULL
   OR next_target IS DISTINCT FROM jsonb_build_object('id',next_target->'id','assigneeId',owner_id,'day',p_command->'day','assignment',assignment)
   OR jsonb_typeof(assignment->'hours') IS DISTINCT FROM 'number' OR (assignment->>'hours')::NUMERIC NOT BETWEEN 0.5 AND 12
   OR mod((assignment->>'hours')::NUMERIC,0.5)<>0 OR (next_target->>'day')::INTEGER NOT BETWEEN today AND today+7
   OR p_debit<>0 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
  SELECT COALESCE(jsonb_agg(e ORDER BY n),'[]') INTO other_plans
   FROM jsonb_array_elements(next_plans) WITH ORDINALITY a(e,n) WHERE e<>next_target;
  IF unchanged<>other_plans THEN RAISE EXCEPTION 'team_plan_changed'; END IF;
  IF target IS NOT NULL AND NOT(p_command ? 'beforeId') AND target->'day'=next_target->'day' AND target->'assigneeId'=next_target->'assigneeId' THEN
   SELECT n-1 INTO target_index FROM jsonb_array_elements(previous) WITH ORDINALITY a(e,n) WHERE e=target;
  ELSIF p_command->>'beforeId' IS NOT NULL THEN
   SELECT n-1 INTO target_index FROM jsonb_array_elements(unchanged) WITH ORDINALITY a(e,n)
    WHERE e->>'id'=p_command->>'beforeId' AND e->'day'=next_target->'day' AND e->'assigneeId'=next_target->'assigneeId';
  ELSE target_index:=jsonb_array_length(unchanged); END IF;
  IF target_index IS NULL OR next_plans->target_index IS DISTINCT FROM next_target THEN RAISE EXCEPTION 'team_plan_changed'; END IF;
 ELSIF next_plans IS DISTINCT FROM unchanged OR (action='remove-day-plan' AND p_debit<>0) THEN
  RAISE EXCEPTION 'team_plan_changed';
 END IF;
 IF action IN ('save-day-plan','remove-day-plan') AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_next->'tasks') n
  WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_old->'tasks','[]')) o WHERE o->>'id'=n->>'id'))
 THEN RAISE EXCEPTION 'team_plan_changed'; END IF;
 FOR group_row IN SELECT e->>'assigneeId' assignee,(e->>'day')::INTEGER AS plan_day,sum((e#>>'{assignment,hours}')::NUMERIC) reserved
  FROM jsonb_array_elements(next_plans) e GROUP BY 1,2 LOOP
  IF group_row.assignee='player' THEN
   used:=COALESCE((p_next#>>ARRAY['playerWorkDays',group_row.plan_day::TEXT,'usedHours'])::NUMERIC,0);
   capacity:=12;
  ELSE
   SELECT e INTO employee FROM jsonb_array_elements(p_next->'employees') e WHERE e->>'id'=group_row.assignee;
   IF employee IS NULL OR employee->>'status'<>'active'
    OR mod(group_row.plan_day-1,7)>=(employee->>'weeklyHours')::INTEGER/7
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(employee->'leave') l WHERE group_row.plan_day BETWEEN (l->>'startDay')::INTEGER AND (l->>'endDay')::INTEGER)
   THEN RAISE EXCEPTION 'team_plan_changed'; END IF;
   capacity:=7+COALESCE((employee#>>ARRAY['workDays',group_row.plan_day::TEXT,'extraHours'])::NUMERIC,0);
   used:=COALESCE((employee#>>ARRAY['workDays',group_row.plan_day::TEXT,'usedHours'])::NUMERIC,0);
  END IF;
  IF group_row.reserved+used>capacity THEN RAISE EXCEPTION 'team_plan_changed'; END IF;
 END LOOP;
 IF action IN ('start-team-task','start-day-plan') THEN
  IF action='start-day-plan' THEN
   IF (target->>'day')::INTEGER<>today OR target IS DISTINCT FROM (SELECT e FROM jsonb_array_elements(previous) WITH ORDINALITY a(e,n)
    WHERE e->'assigneeId'=target->'assigneeId' AND e->'day'=target->'day' ORDER BY n LIMIT 1)
    THEN RAISE EXCEPTION 'team_plan_changed'; END IF;
   assignment:=target->'assignment';
  ELSE assignment:=p_command->'assignment'; END IF;
  IF COALESCE(assignment->>'action','') NOT IN ('assign','train','assign-production','trim','player-assign') THEN RAISE EXCEPTION 'staff_invalid'; END IF;
  SELECT e INTO STRICT row FROM jsonb_array_elements(p_next->'tasks') e
   WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_old->'tasks','[]')) t WHERE e->>'id'=t->>'id');
  IF row->>'status' IS DISTINCT FROM 'running' OR row->'hours' IS DISTINCT FROM assignment->'hours'
   OR row->>'employeeId' IS DISTINCT FROM COALESCE(assignment->>'employeeId','player')
   OR row->>'kind' IS DISTINCT FROM (CASE assignment->>'action' WHEN 'assign-production' THEN 'production' WHEN 'train' THEN 'training' WHEN 'trim' THEN 'trim' ELSE assignment->>'kind' END)
   OR (row->>'startedAt')::TIMESTAMPTZ>(p_next->>'lastSettledAt')::TIMESTAMPTZ+interval '1 millisecond'
   OR (target IS NOT NULL AND row->'id' IS DISTINCT FROM target->'id')
   THEN RAISE EXCEPTION 'team_plan_changed'; END IF;
  RETURN assignment;
 END IF;
 RETURN p_command;
END $$;
REVOKE ALL ON FUNCTION public.kq_team_day_transition(UUID,JSONB,JSONB,JSONB,INTEGER) FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 body:=pg_get_functiondef('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure);
 anchor:='''assign-production'',''settle''';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'team_plan_whitelist_drift'; END IF;
 body:=replace(body,anchor,'''assign-production'',''save-day-plan'',''remove-day-plan'',''start-day-plan'',''start-team-task'',''settle''');
 anchor:='DECLARE account public.kq_staff_accounts%ROWTYPE;';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'team_plan_declaration_drift'; END IF;
 body:=replace(body,anchor,anchor||' submitted_command JSONB:=p_command;');
 anchor:='IF account.revision<>p_expected_revision THEN RAISE EXCEPTION ''staff_changed''; END IF;';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'team_plan_revision_drift'; END IF;
 body:=replace(body,anchor,anchor||E'\n p_command:=public.kq_team_day_transition(p_user_id,account.state,p_state,p_command,p_debit_cents);');
 anchor:='VALUES(p_user_id,p_request_key,p_command,result)';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'team_plan_receipt_drift'; END IF;
 EXECUTE replace(body,anchor,'VALUES(p_user_id,p_request_key,submitted_command,result)');
END $$;
COMMIT;
