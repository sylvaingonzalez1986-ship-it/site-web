BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- A stage is paid once for the canonical culture/campaign, independently of
-- the current day or staff retention. Existing runs and receipts are untouched.
CREATE TABLE public.kq_culture_work_steps (
 run_id UUID NOT NULL REFERENCES public.kq_runs(id) ON DELETE CASCADE,
 stage_index INTEGER NOT NULL CHECK(stage_index BETWEEN 0 AND 5),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 expected_updated_at TIMESTAMPTZ NOT NULL,
 request_hash TEXT NOT NULL CHECK(length(request_hash)=32),
 work JSONB NOT NULL CHECK(jsonb_typeof(work)='object' AND work->'paid'='true'::JSONB),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(run_id,stage_index)
);
CREATE INDEX kq_culture_work_steps_owner ON public.kq_culture_work_steps(user_id,created_at DESC);
ALTER TABLE public.kq_culture_work_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_culture_work_steps FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX kq_staff_archive_culture_day ON public.kq_staff_archive(user_id,((payload->>'day')::INTEGER))
 WHERE kind='task' AND payload->'cultureShift'='true'::JSONB;

-- Cumulative differences preserve the historical rounding and caps, including
-- meticulous/grower bonuses. They do not add a second passive mission reward.
CREATE FUNCTION public.kq_culture_work_totals(p_hours NUMERIC,p_level INTEGER,p_trait TEXT,p_role TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object(
  'vitality',LEAST(10,ceil(p_hours)),
  'terpenes',LEAST(5,round(p_hours*p_level*.12*CASE WHEN p_trait='meticulous' THEN 1.2 ELSE 1 END)),
  'yieldPercent',LEAST(2,round(p_hours*p_level*CASE WHEN p_role='grower' THEN .045 ELSE .015 END)),
  'cannabinoids',LEAST(5,round(p_hours*p_level*CASE WHEN p_role='grower' THEN .10 ELSE .03 END)),
  'xp',round(p_hours*12*CASE WHEN p_trait='learner' THEN 1.25 ELSE 1 END));
$$;
REVOKE ALL ON FUNCTION public.kq_culture_work_totals(NUMERIC,INTEGER,TEXT,TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_culture_work_preview(p_user UUID,p_run UUID,p_choice TEXT DEFAULT 'auto') RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE run public.kq_runs%ROWTYPE; staff JSONB; task JSONB; employee JSONB; actor JSONB; receipt JSONB;
 current_day INTEGER; remaining NUMERIC; used NUMERIC; hours NUMERIC; before_bonus JSONB; after_bonus JSONB;
 bonus JSONB:='{"vitality":0,"terpenes":0,"yieldPercent":0,"cannabinoids":0}';
 source TEXT:='player'; reason TEXT; available BOOLEAN; stage INTEGER;
BEGIN
 IF p_choice IS DISTINCT FROM 'auto' THEN RAISE EXCEPTION 'culture_work_changed'; END IF;
 SELECT * INTO run FROM public.kq_runs WHERE id=p_run AND user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
 IF run.campaign_id IS NOT NULL AND run.id::TEXT IS DISTINCT FROM run.state#>>'{campaign,leaderRunId}' THEN
  SELECT * INTO run FROM public.kq_runs WHERE id=(run.state#>>'{campaign,leaderRunId}')::UUID AND user_id=p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_campaign_unavailable'; END IF;
 END IF;
 current_day:=public.kq_player_work_day(p_user);
 IF current_day IS NULL THEN RAISE EXCEPTION 'staff_profile'; END IF;
 stage:=(run.state->>'stageIndex')::INTEGER;
 SELECT state INTO staff FROM public.kq_staff_accounts WHERE user_id=p_user;
 remaining:=GREATEST(0,12-COALESCE((staff->'playerWorkDays'->current_day::TEXT->>'usedHours')::NUMERIC,0));
 SELECT work INTO receipt FROM public.kq_culture_work_steps WHERE run_id=run.id AND stage_index=stage AND user_id=p_user;
 IF FOUND THEN RETURN receipt||jsonb_build_object('phase',run.state->>'phase','playerRemainingHours',remaining); END IF;
 IF run.state->>'phase'<>'prepare' THEN
  reason:='Étape déjà engagée avant ce suivi : aucun nouveau débit.';
 ELSIF run.status<>'active' THEN
  source:='blocked'; reason:='Cette culture est terminée.';
 ELSIF p_choice='auto' THEN
  -- A retained or archived exhausted reservation prevents an implicit switch to
  -- player hours. Another eligible reservation may take over automatically.
  WITH candidates AS (
   SELECT t FROM jsonb_array_elements(COALESCE(staff->'tasks','[]'::JSONB)) t
    WHERE t->'cultureShift'='true'::JSONB AND ((t->>'day')::INTEGER=current_day OR t->>'targetId'=run.id::TEXT)
   UNION ALL
   SELECT h.payload FROM public.kq_staff_archive h WHERE h.user_id=p_user AND h.kind='task'
    AND h.payload->'cultureShift'='true'::JSONB AND ((h.payload->>'day')::INTEGER=current_day OR h.payload->>'targetId'=run.id::TEXT)
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(staff->'tasks','[]'::JSONB)) t WHERE t->>'id'=h.record_id)
  ), actors AS (
   SELECT t,COALESCE((SELECT e FROM jsonb_array_elements(COALESCE(staff->'employees','[]'::JSONB)) e WHERE e->>'id'=t->>'employeeId'),
    (SELECT h.payload FROM public.kq_staff_archive h WHERE h.user_id=p_user AND h.kind='contract' AND h.record_id=t->>'employeeId')) e
   FROM candidates WHERE t->>'targetId' IS NULL OR t->>'targetId'=run.id::TEXT
  ), choices AS (
   SELECT t,e,COALESCE((t->>'day')::INTEGER=current_day AND t->>'status'='running' AND (t->>'cultureUsedHours')::NUMERIC+.5<=(t->>'hours')::NUMERIC
    AND (t->>'startedAt')::TIMESTAMPTZ<=now() AND (t->>'completesAt')::TIMESTAMPTZ>now()
    AND e->>'status'='active' AND (e->>'hiredAt')::TIMESTAMPTZ<=now()
    AND ((e->>'endsAt') IS NULL OR (e->>'endsAt')::TIMESTAMPTZ>now())
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(e->'leave','[]'::JSONB)) l
     WHERE current_day BETWEEN (l->>'startDay')::INTEGER AND (l->>'endDay')::INTEGER),false) eligible
   FROM actors
  ) SELECT t,e,eligible INTO task,employee,available FROM choices
   ORDER BY eligible DESC,(t->>'targetId' IS NOT NULL) DESC,(t->>'startedAt')::TIMESTAMPTZ,t->>'id' LIMIT 1;
  IF task IS NOT NULL THEN
   used:=(task->>'cultureUsedHours')::NUMERIC; hours:=(task->>'hours')::NUMERIC;
   actor:=jsonb_strip_nulls(jsonb_build_object('id',task->>'employeeId','name',COALESCE(employee->>'name','Employé'),
    'code',COALESCE(employee->>'code','employee'),'portraitCode',employee->>'portraitCode',
    'level',(task->>'skillLevel')::INTEGER,'role',COALESCE(employee->>'role','worker'),'taskId',task->>'id',
    'allocatedHours',hours,'usedHours',used,'remainingHours',GREATEST(0,hours-used)));
   IF NOT available THEN source:='blocked'; reason:='La réservation Culture est épuisée ou indisponible. Ajoute des heures ou attends le prochain jour travaillé.';
   ELSIF (employee->>'nextPayrollAt')::TIMESTAMPTZ<=now() OR EXISTS(
    SELECT 1 FROM jsonb_array_elements(COALESCE(staff->'payroll','[]'::JSONB)) p
     WHERE (p->>'paidCents')::BIGINT<(p->>'totalCents')::BIGINT AND (p->>'dueAt')::TIMESTAMPTZ<=now())
   THEN source:='blocked'; reason:='Une paie est échue. Règle-la pour reprendre le travail délégué.';
   ELSE
    source:='employee';
    before_bonus:=public.kq_culture_work_totals(used,(task->>'skillLevel')::INTEGER,employee->>'trait',employee->>'role');
    after_bonus:=public.kq_culture_work_totals(used+.5,(task->>'skillLevel')::INTEGER,employee->>'trait',employee->>'role');
    SELECT jsonb_object_agg(key,GREATEST(0,LEAST(cap-COALESCE((run.state->'care'->>field)::INTEGER,cap),
     (after_bonus->>key)::INTEGER-(before_bonus->>key)::INTEGER))) INTO bonus
    FROM (VALUES ('vitality','vitality',100),('terpenes','terpenes',99),('yieldPercent','yieldBonusPercent',10),
     ('cannabinoids','cannabinoidExpression',99)) b(key,field,cap);
   END IF;
  ELSE
   SELECT work->'employee' INTO actor FROM public.kq_culture_work_steps
    WHERE run_id=run.id AND user_id=p_user AND work->>'source'='employee' ORDER BY stage_index DESC LIMIT 1;
   IF FOUND THEN source:='blocked'; reason:='Cette culture est déléguée. Ajoute des heures Culture ou attends le prochain jour travaillé.'; END IF;
  END IF;
 END IF;
 IF run.state->>'phase'='prepare' AND source='player' AND remaining<.5 THEN source:='blocked'; reason:='La journée du joueur est complète.'; END IF;
 RETURN jsonb_build_object('version',1,'runId',run.id,'stageIndex',stage,'day',current_day,'phase',run.state->>'phase',
  'source',source,'paid',false,'stepHours',.5,'playerRemainingHours',remaining,'employee',actor,'bonus',bonus,'reason',reason);
END $$;
REVOKE ALL ON FUNCTION public.kq_culture_work_preview(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_culture_work_quote(p_user_id UUID,p_run_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.kq_culture_work_preview(p_user_id,p_run_id,'auto');
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_culture_work_quote(UUID,UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_culture_work_quote(UUID,UUID) TO service_role;

CREATE FUNCTION public.kq_culture_work_roll(p_user UUID,p_run UUID,p_expected TIMESTAMPTZ,p_next JSONB,p_members JSONB,p_choice TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE run public.kq_runs%ROWTYPE; receipt public.kq_culture_work_steps%ROWTYPE; account public.kq_staff_accounts%ROWTYPE;
 quote JSONB; task JSONB; employee JSONB; before_bonus JSONB; after_bonus JSONB; next_state JSONB; next_members JSONB;
 result JSONB; care JSONB; task_index INTEGER; employee_index INTEGER; used NUMERIC; xp INTEGER; stage INTEGER; request_hash TEXT;
BEGIN
 IF p_choice IS DISTINCT FROM 'auto' OR p_expected IS NULL
  OR jsonb_typeof(p_next) IS DISTINCT FROM 'object' OR p_next->>'phase' IS DISTINCT FROM 'rolled'
  OR COALESCE(p_next->>'stageIndex','') !~ '^[0-5]$' THEN RAISE EXCEPTION 'culture_work_changed'; END IF;
 stage:=(p_next->>'stageIndex')::INTEGER;
 request_hash:=md5(jsonb_build_object('state',p_next,'members',p_members,'choice',p_choice)::TEXT);
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 -- Resolve replay before business settlement, staff eligibility or CAS. Nothing
 -- can re-award care/XP after the worker has ended or their task is archived.
 SELECT * INTO run FROM public.kq_runs WHERE id=p_run AND user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
 IF run.campaign_id IS NOT NULL AND run.id::TEXT IS DISTINCT FROM run.state#>>'{campaign,leaderRunId}' THEN RAISE EXCEPTION 'kq_campaign_leader_required'; END IF;
 SELECT * INTO receipt FROM public.kq_culture_work_steps WHERE run_id=p_run AND stage_index=stage;
 IF FOUND THEN
  IF receipt.user_id<>p_user OR receipt.expected_updated_at IS DISTINCT FROM p_expected OR receipt.request_hash IS DISTINCT FROM request_hash
   THEN RAISE EXCEPTION 'culture_work_changed'; END IF;
  RETURN jsonb_build_object('state',run.state,'updatedAt',run.updated_at,'replayed',true,'cultureWork',receipt.work,
   'flower',(SELECT to_jsonb(f) FROM public.kq_flowers f WHERE f.run_id=run.id),
   'flowers',COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.run_id) FROM public.kq_flowers f JOIN public.kq_runs r ON r.id=f.run_id
    WHERE r.id=run.id OR (run.campaign_id IS NOT NULL AND r.campaign_id=run.campaign_id)),'[]'::JSONB));
 END IF;
 -- All writers use user advisory -> wallet -> staff -> culture rows. Errors in
 -- the original culture guards roll back hours, XP, ledger and every projection.
 PERFORM public.kq_business_settle(p_user);
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'staff_profile'; END IF;
 INSERT INTO public.kq_staff_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
 SELECT * INTO account FROM public.kq_staff_accounts WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO run FROM public.kq_runs WHERE id=p_run AND user_id=p_user FOR UPDATE;
 IF run.status<>'active' THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
 IF run.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'kq_stale_run'; END IF;
 IF run.state->>'phase'<>'prepare' OR run.state->'stageIndex' IS DISTINCT FROM p_next->'stageIndex'
  OR run.state->'care' IS DISTINCT FROM p_next->'care' THEN RAISE EXCEPTION 'culture_work_changed'; END IF;
 quote:=public.kq_culture_work_preview(p_user,p_run,p_choice);
 IF quote->>'source'='blocked' OR quote->'paid'='true'::JSONB THEN RAISE EXCEPTION 'culture_work_exhausted'; END IF;
 next_state:=p_next;
 IF quote->>'source'='player' THEN
  PERFORM public.kq_player_work_charge(p_user,.5);
  quote:=jsonb_set(quote,'{playerRemainingHours}',to_jsonb((quote->>'playerRemainingHours')::NUMERIC-.5));
 ELSE
  SELECT t,(n-1)::INTEGER INTO task,task_index FROM jsonb_array_elements(account.state->'tasks') WITH ORDINALITY a(t,n)
   WHERE t->>'id'=quote#>>'{employee,taskId}';
  SELECT e,(n-1)::INTEGER INTO employee,employee_index FROM jsonb_array_elements(account.state->'employees') WITH ORDINALITY a(e,n)
   WHERE e->>'id'=task->>'employeeId';
  IF task IS NULL OR employee IS NULL THEN RAISE EXCEPTION 'culture_work_changed'; END IF;
  used:=(task->>'cultureUsedHours')::NUMERIC;
  before_bonus:=public.kq_culture_work_totals(used,(task->>'skillLevel')::INTEGER,employee->>'trait',employee->>'role');
  after_bonus:=public.kq_culture_work_totals(used+.5,(task->>'skillLevel')::INTEGER,employee->>'trait',employee->>'role');
  xp:=(after_bonus->>'xp')::INTEGER-(before_bonus->>'xp')::INTEGER;
  task:=jsonb_set(task,'{cultureUsedHours}',to_jsonb(used+.5));
  IF used+.5=(task->>'hours')::NUMERIC THEN
   task:=task||jsonb_build_object('status','completed','completesAt',now(),
    'outcome','Culture : '||(used+.5)::TEXT||' h utilisées, soit '||((used+.5)*2)::INTEGER::TEXT||' étapes accompagnées. Réservation épuisée.');
   employee:=jsonb_set(employee,'{completedTasks}',to_jsonb(COALESCE((employee->>'completedTasks')::INTEGER,0)+1));
  END IF;
  employee:=jsonb_set(employee,'{skills,culture}',to_jsonb(LEAST(8100,COALESCE((employee#>>'{skills,culture}')::INTEGER,0)+xp)));
  UPDATE public.kq_staff_accounts SET state=jsonb_set(jsonb_set(account.state,ARRAY['tasks',task_index::TEXT],task),
   ARRAY['employees',employee_index::TEXT],employee),revision=revision+1,updated_at=now() WHERE user_id=p_user;
  care:=p_next->'care';
  IF jsonb_typeof(care)='object' THEN
   SELECT care||jsonb_object_agg(field,COALESCE((care->>field)::INTEGER,0)+(quote->'bonus'->>key)::INTEGER) INTO care
    FROM (VALUES ('vitality','vitality'),('terpenes','terpenes'),('yieldPercent','yieldBonusPercent'),
     ('cannabinoids','cannabinoidExpression')) b(key,field);
   next_state:=jsonb_set(p_next,'{care}',care);
  END IF;
  quote:=jsonb_set(jsonb_set(quote,'{employee,usedHours}',to_jsonb(used+.5)),'{employee,remainingHours}',
   to_jsonb((task->>'hours')::NUMERIC-used-.5));
 END IF;
 IF run.campaign_id IS NULL THEN
  IF p_members IS NOT NULL AND p_members<>'null'::JSONB THEN RAISE EXCEPTION 'kq_campaign_members_changed'; END IF;
  result:=public.kq_work_inner_update_run_state(p_user,p_run,p_expected,'roll',next_state,NULL);
 ELSE
  -- Validate the caller's original projection first, then project the enriched
  -- shared care. This never hides omitted, foreign or tampered campaign members.
  IF jsonb_typeof(p_members) IS DISTINCT FROM 'array' OR jsonb_array_length(p_members)<>(SELECT count(*) FROM public.kq_runs WHERE campaign_id=run.campaign_id)
   OR (SELECT count(DISTINCT m->>'runId') FROM jsonb_array_elements(p_members) m)<>jsonb_array_length(p_members)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_members) m LEFT JOIN public.kq_runs r ON r.id::TEXT=m->>'runId'
    WHERE r.id IS NULL OR r.campaign_id IS DISTINCT FROM run.campaign_id OR r.user_id<>p_user
     OR m->'state' IS DISTINCT FROM public.kq_campaign_project_state(p_next,r.state) OR m->'flower' IS DISTINCT FROM 'null'::JSONB)
  THEN RAISE EXCEPTION 'kq_campaign_members_changed'; END IF;
  SELECT jsonb_agg(m||jsonb_build_object('state',public.kq_campaign_project_state(next_state,r.state)) ORDER BY n) INTO next_members
   FROM jsonb_array_elements(p_members) WITH ORDINALITY a(m,n) JOIN public.kq_runs r ON r.id::TEXT=m->>'runId';
  result:=public.kq_work_inner_update_campaign_state(p_user,p_run,p_expected,'roll',next_state,next_members);
 END IF;
 quote:=quote||jsonb_build_object('paid',true,'phase','rolled');
 INSERT INTO public.kq_culture_work_steps(run_id,stage_index,user_id,expected_updated_at,request_hash,work)
  VALUES(p_run,stage,p_user,p_expected,request_hash,quote);
 RETURN result||jsonb_build_object('cultureWork',quote,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.kq_culture_work_roll(UUID,UUID,TIMESTAMPTZ,JSONB,JSONB,TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_roll_culture_step(p_user_id UUID,p_run_id UUID,p_expected_updated_at TIMESTAMPTZ,
 p_next_state JSONB,p_members JSONB,p_work_choice TEXT DEFAULT 'auto') RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.kq_culture_work_roll(p_user_id,p_run_id,p_expected_updated_at,p_next_state,p_members,p_work_choice);
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_roll_culture_step(UUID,UUID,TIMESTAMPTZ,JSONB,JSONB,TEXT) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_roll_culture_step(UUID,UUID,TIMESTAMPTZ,JSONB,JSONB,TEXT) TO service_role;

-- Engine CAS may reserve/expire shifts, never consume them or rewrite their
-- booked terms. Weekly guards, payroll accounting and archival remain in place.
CREATE FUNCTION public.kq_culture_work_validate_staff(p_user UUID,p_state JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous JSONB; task JSONB; old_task JSONB;
BEGIN
 SELECT state INTO previous FROM public.kq_staff_accounts WHERE user_id=p_user;
 FOR task IN SELECT t FROM jsonb_array_elements(p_state->'tasks') t LOOP
  SELECT t INTO old_task FROM jsonb_array_elements(previous->'tasks') t WHERE t->>'id'=task->>'id';
  IF NOT (task ?| ARRAY['cultureShift','cultureUsedHours']) AND NOT COALESCE(old_task ?| ARRAY['cultureShift','cultureUsedHours'],false) THEN CONTINUE; END IF;
  IF task->'cultureShift' IS DISTINCT FROM 'true'::JSONB OR task->>'kind' IS DISTINCT FROM 'culture'
   OR task->>'skill' IS DISTINCT FROM 'culture' OR task->>'employeeId'='player'
   OR jsonb_typeof(task->'cultureUsedHours') IS DISTINCT FROM 'number'
   OR jsonb_typeof(task->'hours') IS DISTINCT FROM 'number' OR (task->>'hours')::NUMERIC NOT BETWEEN .5 AND 10
   OR mod((task->>'hours')::NUMERIC,.5)<>0 OR (task->>'cultureUsedHours')::NUMERIC NOT BETWEEN 0 AND (task->>'hours')::NUMERIC
   OR mod((task->>'cultureUsedHours')::NUMERIC,.5)<>0
   OR COALESCE(task->>'skillLevel','') !~ '^(10|[1-9])$' OR COALESCE(task->>'day','') !~ '^[1-9][0-9]{0,8}$'
  THEN RAISE EXCEPTION 'culture_work_changed'; END IF;
  IF old_task IS NULL THEN
   IF (task->>'cultureUsedHours')::NUMERIC<>0 THEN RAISE EXCEPTION 'culture_work_changed'; END IF;
  ELSIF (task-'status'-'outcome') IS DISTINCT FROM (old_task-'status'-'outcome') THEN RAISE EXCEPTION 'culture_work_changed';
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.kq_culture_work_validate_staff(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE body TEXT; anchor TEXT; spec RECORD; BEGIN
 body:=pg_get_functiondef('public.kq_player_work_cost(text,text)'::regprocedure);
 anchor:=E'WHEN p_domain=''culture'' AND p_action=''start'' THEN 1\n WHEN p_domain=''culture'' AND p_action IN (''roll'',''resolve'',''advance'',''redraw'',''heritage'',''card'',''heritage-swap'',''care'',''buy-care'') THEN 0.5';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'culture_work_cost_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,'WHEN p_domain=''culture'' AND p_action IN (''roll'',''buy-care'') THEN 0.5');
 FOR spec IN SELECT * FROM (VALUES
  ('public.rpc_kq_update_run_state(uuid,uuid,timestamptz,text,jsonb,jsonb)','NULL','IF p_flower IS NOT NULL THEN RAISE EXCEPTION ''kq_flower_before_completion''; END IF;'),
  ('public.rpc_kq_update_campaign_state(uuid,uuid,timestamptz,text,jsonb,jsonb)','p_members','')) s(signature,members,guard) LOOP
  body:=pg_get_functiondef(spec.signature::regprocedure);
  anchor:='  no_work:=(false);';
  IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'culture_work_wrapper_anchor_changed'; END IF;
  EXECUTE replace(body,anchor,format(E'  IF p_action=''roll'' THEN %s RETURN public.kq_culture_work_roll(p_user_id,p_run_id,p_expected_updated_at,p_next_state,%s,''auto''); END IF;\n%s',spec.guard,spec.members,anchor));
 END LOOP;
 body:=pg_get_functiondef('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure);
 anchor:='PERFORM public.kq_staff_validate_weekly_plan(p_user_id,p_command,p_state,p_debit_cents);';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'culture_work_staff_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,anchor||E'\n PERFORM public.kq_culture_work_validate_staff(p_user_id,p_state);');
END $$;

ALTER FUNCTION public.kq_staff_snapshot(UUID) RENAME TO kq_staff_snapshot_before_culture_work;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot_before_culture_work(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_staff_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_set(public.kq_staff_snapshot_before_culture_work(p_user),'{context,cultureWorkVersion}','1'::JSONB);
$$;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
