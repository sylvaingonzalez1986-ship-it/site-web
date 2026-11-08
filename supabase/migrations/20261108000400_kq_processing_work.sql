BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- No historical batch, purchase, receipt or employee is rewritten. New jobs
-- keep their quoted profile and finance bounded pieces of work independently.
CREATE TABLE public.kq_processing_jobs (
 flower_id UUID PRIMARY KEY REFERENCES public.kq_flowers(id),
 user_id UUID NOT NULL REFERENCES auth.users(id),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version=1),
 route TEXT NOT NULL,
 input_grams NUMERIC NOT NULL CHECK(input_grams>0 AND input_grams<=1000000),
 nominal_hours NUMERIC NOT NULL CHECK(nominal_hours>0 AND nominal_hours<=1000000),
 passive_hours NUMERIC NOT NULL CHECK(passive_hours>=0 AND passive_hours<=10000),
 nominal_done NUMERIC NOT NULL DEFAULT 0 CHECK(nominal_done>=0 AND nominal_done<=nominal_hours),
 delegated BOOLEAN NOT NULL DEFAULT false,
 work JSONB NOT NULL CHECK(jsonb_typeof(work)='object'),
 equipment_codes TEXT[] NOT NULL,
 segments JSONB NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(segments)='array'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kq_processing_jobs_owner ON public.kq_processing_jobs(user_id,created_at DESC);
ALTER TABLE public.kq_processing_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_processing_jobs FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX kq_staff_archive_processing_day ON public.kq_staff_archive(user_id,((payload->>'day')::INTEGER))
 WHERE kind='task' AND payload->'processingShift'='true'::JSONB;

CREATE FUNCTION public.kq_processing_machine_available(p_user UUID,p_codes TEXT[],p_flower UUID DEFAULT NULL) RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT GREATEST(now(),COALESCE(max(until_at),now())) FROM (
  SELECT b.processing_ready_at until_at FROM public.kq_commerce_batches b
   WHERE b.user_id=p_user AND b.flower_id IS DISTINCT FROM p_flower AND b.processing_equipment_codes&&p_codes
    AND NOT EXISTS(SELECT 1 FROM public.kq_processing_jobs j WHERE j.flower_id=b.flower_id)
  UNION ALL
  SELECT (j.segments->-1->>'machineReadyAt')::TIMESTAMPTZ FROM public.kq_processing_jobs j
   WHERE j.user_id=p_user AND j.flower_id IS DISTINCT FROM p_flower AND j.equipment_codes&&p_codes
 ) reservations;
$$;
REVOKE ALL ON FUNCTION public.kq_processing_machine_available(UUID,TEXT[],UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_processing_work_preview(p_user UUID,p_flower UUID,p_work JSONB) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE job public.kq_processing_jobs%ROWTYPE; staff JSONB; task JSONB; employee JSONB; actor JSONB;
 current_day INTEGER; player_remaining NUMERIC; available_hours NUMERIC; remaining NUMERIC; booked NUMERIC:=0;
 nominal NUMERIC:=0; efficiency NUMERIC; active_hours NUMERIC:=0; input_grams NUMERIC; passive NUMERIC:=0;
 source TEXT:='player'; reason TEXT; eligible BOOLEAN; level INTEGER; codes TEXT[]; last_segment JSONB;
 starts TIMESTAMPTZ; deadline TIMESTAMPTZ; employee_until TIMESTAMPTZ; result JSONB; delegated BOOLEAN:=false;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.kq_flowers WHERE id=p_flower AND owner_id=p_user) THEN RAISE EXCEPTION 'processing_work_unavailable'; END IF;
 SELECT * INTO job FROM public.kq_processing_jobs WHERE flower_id=p_flower AND user_id=p_user;
 IF FOUND THEN p_work:=job.work; delegated:=job.delegated; END IF;
 p_work:=p_work-'quote';
 IF jsonb_typeof(p_work) IS DISTINCT FROM 'object' OR p_work->'version' IS DISTINCT FROM '1'::JSONB
  OR p_work->'profileVersion' IS DISTINCT FROM '1'::JSONB
  OR jsonb_typeof(p_work->'nominalHours') IS DISTINCT FROM 'number' OR (p_work->>'nominalHours')::NUMERIC NOT BETWEEN .000000001 AND 1000000
  OR jsonb_typeof(p_work->'passiveHours') IS DISTINCT FROM 'number' OR (p_work->>'passiveHours')::NUMERIC NOT BETWEEN 0 AND 10000
  OR jsonb_typeof(p_work->'inputGrams') IS DISTINCT FROM 'number' OR (p_work->>'inputGrams')::NUMERIC NOT BETWEEN .000001 AND 1000000
  OR jsonb_typeof(p_work->'machines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_work->'machines') NOT BETWEEN 1 AND 12
  OR jsonb_typeof(p_work->'sources') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_work->'estimated') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'processing_work_changed'; END IF;
 current_day:=public.kq_player_work_day(p_user);
 SELECT state INTO staff FROM public.kq_staff_accounts WHERE user_id=p_user;
 player_remaining:=GREATEST(0,12-COALESCE((staff->'playerWorkDays'->current_day::TEXT->>'usedHours')::NUMERIC,0));
 input_grams:=(p_work->>'inputGrams')::NUMERIC;
 remaining:=(p_work->>'nominalHours')::NUMERIC-COALESCE(job.nominal_done,0);
 last_segment:=job.segments->-1;
 codes:=COALESCE(job.equipment_codes,ARRAY(SELECT DISTINCT m->>'code' FROM jsonb_array_elements(p_work->'machines') m WHERE m->>'code' IS NOT NULL ORDER BY m->>'code'));
 SELECT COALESCE(c.business_started_at,w.created_at)+current_day*interval '4 hours' INTO deadline
  FROM public.kq_equipment_wallets w LEFT JOIN public.kq_commerce_accounts c USING(user_id) WHERE w.user_id=p_user;
 starts:=public.kq_processing_machine_available(p_user,codes,p_flower);
 WITH candidates AS (
  SELECT t FROM jsonb_array_elements(COALESCE(staff->'tasks','[]'::JSONB)) t WHERE t->'processingShift'='true'::JSONB
   AND ((t->>'day')::INTEGER=current_day OR t->>'targetId'=p_flower::TEXT)
  UNION ALL
  SELECT h.payload FROM public.kq_staff_archive h WHERE h.user_id=p_user AND h.kind='task' AND h.payload->'processingShift'='true'::JSONB
   AND ((h.payload->>'day')::INTEGER=current_day OR h.payload->>'targetId'=p_flower::TEXT)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(staff->'tasks','[]'::JSONB)) t WHERE t->>'id'=h.record_id)
 ), actors AS (
  SELECT t,COALESCE((SELECT e FROM jsonb_array_elements(COALESCE(staff->'employees','[]'::JSONB)) e WHERE e->>'id'=t->>'employeeId'),
   (SELECT h.payload FROM public.kq_staff_archive h WHERE h.user_id=p_user AND h.kind='contract' AND h.record_id=t->>'employeeId')) e
  FROM candidates WHERE t->>'targetId' IS NULL OR t->>'targetId'=p_flower::TEXT
 ), choices AS (
  SELECT t,e,COALESCE((t->>'day')::INTEGER=current_day AND t->>'status'='running'
   AND (t->>'processingUsedHours')::NUMERIC+.5<=(t->>'hours')::NUMERIC
   AND (t->>'startedAt')::TIMESTAMPTZ<=now() AND (t->>'completesAt')::TIMESTAMPTZ>now()
   AND e->>'status'='active' AND (e->>'hiredAt')::TIMESTAMPTZ<=now()
   AND ((e->>'endsAt') IS NULL OR (e->>'endsAt')::TIMESTAMPTZ>now())
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(e->'leave','[]'::JSONB)) l
    WHERE current_day BETWEEN (l->>'startDay')::INTEGER AND (l->>'endDay')::INTEGER),false) usable FROM actors
 ) SELECT t,e,usable INTO task,employee,eligible FROM choices
 ORDER BY usable DESC,(t->>'targetId' IS NOT NULL) DESC,(t->>'startedAt')::TIMESTAMPTZ,t->>'id' LIMIT 1;
 IF task IS NOT NULL THEN
  level:=(task->>'skillLevel')::INTEGER;
  available_hours:=GREATEST(0,(task->>'hours')::NUMERIC-(task->>'processingUsedHours')::NUMERIC);
  actor:=jsonb_strip_nulls(jsonb_build_object('id',task->>'employeeId','name',COALESCE(employee->>'name','Salarié'),
   'code',COALESCE(employee->>'code','employee'),'portraitCode',employee->>'portraitCode','level',level,
   'role',COALESCE(employee->>'role','worker'),'taskId',task->>'id','allocatedHours',(task->>'hours')::NUMERIC,
   'usedHours',(task->>'processingUsedHours')::NUMERIC,'remainingHours',available_hours));
  source:='employee';
  IF NOT eligible THEN reason:='La réserve Transformation est épuisée ou indisponible. Ajoute des heures ou attends le prochain jour travaillé.';
  ELSIF (employee->>'nextPayrollAt')::TIMESTAMPTZ<=now() OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(staff->'payroll','[]'::JSONB)) p
   WHERE (p->>'paidCents')::BIGINT<(p->>'totalCents')::BIGINT AND (p->>'dueAt')::TIMESTAMPTZ<=now())
   THEN reason:='Règle les salaires échus pour reprendre le travail délégué.';
  END IF;
  deadline:=LEAST(deadline,(task->>'completesAt')::TIMESTAMPTZ,COALESCE((employee->>'endsAt')::TIMESTAMPTZ,deadline));
 ELSE
  available_hours:=player_remaining;
  level:=LEAST(10,1+floor(sqrt(GREATEST(0,COALESCE((staff#>>'{playerSkills,processing}')::NUMERIC,0),COALESCE((staff->>'playerProcessingXp')::NUMERIC,0))/100)))::INTEGER;
  IF delegated THEN reason:='Ce lot est délégué. Ajoute des heures Transformation ou attends le prochain jour travaillé.'; actor:=last_segment->'actor'; END IF;
 END IF;
 efficiency:=LEAST(1,(.55+(level-1)*.05)*CASE WHEN employee->>'trait'='quick' THEN 1.15 WHEN employee->>'trait'='meticulous' THEN 1/1.10 ELSE 1 END);
 -- Other financed work by the same person is serialized, including work on
 -- independent machines. The shift itself is a budget, not a timed mission.
 SELECT max(until_at) INTO employee_until FROM (
  SELECT (j.segments->-1->>'readyAt')::TIMESTAMPTZ until_at FROM public.kq_processing_jobs j WHERE j.user_id=p_user
   AND COALESCE(j.segments->-1#>>'{actor,id}','player')=COALESCE(actor->>'id','player')
  UNION ALL
  SELECT (t->>'completesAt')::TIMESTAMPTZ FROM jsonb_array_elements(COALESCE(staff->'tasks','[]'::JSONB)) t
   WHERE t->>'employeeId'=COALESCE(actor->>'id','player') AND t->>'status'='running'
    AND t->'processingShift' IS DISTINCT FROM 'true'::JSONB AND t->'cultureShift' IS DISTINCT FROM 'true'::JSONB
 ) occupied;
 starts:=GREATEST(starts,COALESCE(employee_until,now()));
 IF remaining<=0 THEN reason:='Tout le volume est déjà pris en charge.';
 ELSIF (last_segment->>'readyAt')::TIMESTAMPTZ>now() THEN reason:='Une tranche de travail est déjà en cours sur ce lot.';
 END IF;
 available_hours:=LEAST(available_hours,GREATEST(0,floor(extract(epoch FROM deadline-starts)/300)/2));
 IF reason IS NULL AND available_hours<.5 THEN reason:='Il ne reste pas de créneau de 30 min aujourd’hui. Ajoute des heures ou reprends au prochain jour disponible.'; END IF;
 IF reason IS NULL THEN
  booked:=LEAST(available_hours,ceil(remaining/efficiency*2)/2);
  nominal:=LEAST(remaining,booked*efficiency); active_hours:=nominal/efficiency;
  IF nominal=remaining THEN passive:=(p_work->>'passiveHours')::NUMERIC; END IF;
 ELSE source:='blocked'; END IF;
 result:=jsonb_build_object('version',1,'flowerId',p_flower,'inputGrams',input_grams,'day',current_day,'source',source,
  'employee',actor,'efficiency',efficiency,'playerRemainingHours',player_remaining,'bookedHours',booked,'activeHours',active_hours,
  'nominalHours',nominal,'remainingNominalHours',remaining,'fundedGrams',input_grams*nominal/(p_work->>'nominalHours')::NUMERIC,
  'passiveHours',passive,'blockedReason',reason,'startedAt',CASE WHEN reason IS NULL THEN starts ELSE NULL END,
  'readyAt',CASE WHEN reason IS NULL THEN starts+active_hours*interval '600 seconds' ELSE NULL END);
 RETURN result||jsonb_build_object('token',md5((result-'startedAt'-'readyAt')::TEXT||p_work::TEXT||COALESCE(job.nominal_done,0)::TEXT));
END $$;
REVOKE ALL ON FUNCTION public.kq_processing_work_preview(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_processing_work_quote(p_user_id UUID,p_flower_id UUID,p_work JSONB) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.kq_processing_work_preview(p_user_id,p_flower_id,p_work);
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_processing_work_quote(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_processing_work_quote(UUID,UUID,JSONB) TO service_role;

CREATE FUNCTION public.kq_processing_work_start(p_user UUID,p_flower UUID,p_expected TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE job public.kq_processing_jobs%ROWTYPE; account public.kq_staff_accounts%ROWTYPE; quote JSONB; task JSONB; employee JSONB;
 task_index INTEGER; employee_index INTEGER; booked NUMERIC; used NUMERIC; xp INTEGER; actor JSONB; segment JSONB;
 starts TIMESTAMPTZ; ready TIMESTAMPTZ; final_ready TIMESTAMPTZ; next_state JSONB;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 INSERT INTO public.kq_staff_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
 SELECT * INTO account FROM public.kq_staff_accounts WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO job FROM public.kq_processing_jobs WHERE flower_id=p_flower AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'processing_work_unavailable'; END IF;
 quote:=public.kq_processing_work_preview(p_user,p_flower,job.work);
 IF quote->>'source'='blocked' THEN RAISE EXCEPTION 'processing_work_exhausted'; END IF;
 IF p_expected IS DISTINCT FROM quote->>'token' THEN RAISE EXCEPTION 'processing_work_changed'; END IF;
 booked:=(quote->>'bookedHours')::NUMERIC; actor:=quote->'employee';
 IF quote->>'source'='player' THEN
  PERFORM public.kq_player_work_charge(p_user,booked);
  SELECT state INTO next_state FROM public.kq_staff_accounts WHERE user_id=p_user;
  xp:=round(booked*12);
  used:=LEAST(8100,GREATEST(COALESCE((next_state#>>'{playerSkills,processing}')::NUMERIC,0),COALESCE((next_state->>'playerProcessingXp')::NUMERIC,0))+xp);
  next_state:=jsonb_set(next_state,'{playerSkills}',COALESCE(next_state->'playerSkills','{"culture":0,"processing":0,"communication":0,"sales":0,"administration":0}'::JSONB)||jsonb_build_object('processing',used));
  UPDATE public.kq_staff_accounts SET state=jsonb_set(next_state,'{playerProcessingXp}',to_jsonb(used)),revision=revision+1,updated_at=now() WHERE user_id=p_user;
 ELSE
  SELECT t,(n-1)::INTEGER INTO task,task_index FROM jsonb_array_elements(account.state->'tasks') WITH ORDINALITY a(t,n) WHERE t->>'id'=actor->>'taskId';
  SELECT e,(n-1)::INTEGER INTO employee,employee_index FROM jsonb_array_elements(account.state->'employees') WITH ORDINALITY a(e,n) WHERE e->>'id'=task->>'employeeId';
  IF task IS NULL OR employee IS NULL THEN RAISE EXCEPTION 'processing_work_changed'; END IF;
  used:=(task->>'processingUsedHours')::NUMERIC;
  xp:=round((used+booked)*12*CASE WHEN employee->>'trait'='learner' THEN 1.25 ELSE 1 END)-round(used*12*CASE WHEN employee->>'trait'='learner' THEN 1.25 ELSE 1 END);
  task:=jsonb_set(task,'{processingUsedHours}',to_jsonb(used+booked));
  IF used+booked=(task->>'hours')::NUMERIC THEN
   task:=task||jsonb_build_object('status','completed','completesAt',now(),'outcome','Transformation : '||(used+booked)::TEXT||' h utilisées. Réserve épuisée.');
   employee:=jsonb_set(employee,'{completedTasks}',to_jsonb(COALESCE((employee->>'completedTasks')::INTEGER,0)+1));
  END IF;
  employee:=jsonb_set(employee,'{skills,processing}',to_jsonb(LEAST(8100,COALESCE((employee#>>'{skills,processing}')::INTEGER,0)+xp)));
  UPDATE public.kq_staff_accounts SET state=jsonb_set(jsonb_set(account.state,ARRAY['tasks',task_index::TEXT],task),ARRAY['employees',employee_index::TEXT],employee),revision=revision+1,updated_at=now() WHERE user_id=p_user;
  actor:=actor||jsonb_build_object('usedHours',used+booked,'remainingHours',(task->>'hours')::NUMERIC-used-booked);
 END IF;
 starts:=(quote->>'startedAt')::TIMESTAMPTZ;
 ready:=starts+(quote->>'activeHours')::NUMERIC*interval '600 seconds';
 IF job.nominal_done+(quote->>'nominalHours')::NUMERIC=job.nominal_hours THEN final_ready:=ready+job.passive_hours*interval '600 seconds'; END IF;
 segment:=jsonb_build_object('day',quote->'day','source',quote->'source','actor',actor,'bookedHours',booked,
  'activeHours',quote->'activeHours','nominalHours',quote->'nominalHours','efficiency',quote->'efficiency','fundedGrams',quote->'fundedGrams',
  'startedAt',starts,'readyAt',ready,'machineReadyAt',COALESCE(final_ready,ready),'finalReadyAt',final_ready,'xp',xp);
 UPDATE public.kq_processing_jobs SET nominal_done=nominal_done+(quote->>'nominalHours')::NUMERIC,
  delegated=delegated OR quote->>'source'='employee',segments=segments||jsonb_build_array(segment),updated_at=now() WHERE flower_id=p_flower;
 -- An unfinished job cannot leak transformed stock through historical sale,
 -- online or mission guards. This sentinel is never used for machine queues.
 UPDATE public.kq_commerce_batches SET processing_started_at=starts,processing_ready_at=COALESCE(final_ready,'9999-01-01'::TIMESTAMPTZ) WHERE flower_id=p_flower;
 RETURN segment;
END $$;
REVOKE ALL ON FUNCTION public.kq_processing_work_start(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_processing_jobs_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',j.flower_id,'version',1,'flowerId',j.flower_id,'route',j.route,
  'inputGrams',j.input_grams,'nominalHours',j.nominal_hours,'remainingNominalHours',j.nominal_hours-j.nominal_done,
  'fundedGrams',j.input_grams*j.nominal_done/j.nominal_hours,
  'completedGrams',j.input_grams*(j.nominal_done-(s->>'nominalHours')::NUMERIC*(1-progress.fraction))/j.nominal_hours,
  'remainingGrams',j.input_grams*(1-(j.nominal_done-(s->>'nominalHours')::NUMERIC*(1-progress.fraction))/j.nominal_hours),
  'status',CASE WHEN (s->>'readyAt')::TIMESTAMPTZ>now() THEN 'running' WHEN j.nominal_done<j.nominal_hours THEN 'blocked'
   WHEN (s->>'finalReadyAt')::TIMESTAMPTZ>now() THEN 'passive' ELSE 'completed' END,
  'startedAt',s->'startedAt','readyAt',s->'readyAt','finalReadyAt',s->'finalReadyAt','createdAt',j.created_at,
  'delegated',j.delegated,'actor',s->'actor','bookedHours',s->'bookedHours','activeHours',s->'activeHours',
  'passiveHours',j.passive_hours,'remainingHours',COALESCE((s#>>'{actor,remainingHours}')::NUMERIC,0),'plan',j.work) ORDER BY j.created_at,j.flower_id),'[]'::JSONB)
 FROM public.kq_processing_jobs j CROSS JOIN LATERAL (SELECT j.segments->-1 s) last
 CROSS JOIN LATERAL (SELECT LEAST(1,GREATEST(0,extract(epoch FROM now()-(s->>'startedAt')::TIMESTAMPTZ)
  /GREATEST(.000001,extract(epoch FROM (s->>'readyAt')::TIMESTAMPTZ-(s->>'startedAt')::TIMESTAMPTZ)))) fraction) progress
 WHERE j.user_id=p_user;
$$;
REVOKE ALL ON FUNCTION public.kq_processing_jobs_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.rpc_kq_processing_work_jobs(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('version',1,'jobs',public.kq_processing_jobs_snapshot(p_user_id));
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_processing_work_jobs(UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_processing_work_jobs(UUID) TO service_role;

-- Retain every readiness, maintenance and snapshot check in the production
-- queue trigger; only replace its reservation calculation and new-job branch.
DO $$ DECLARE body TEXT; anchor TEXT; replacement TEXT; BEGIN
 body:=pg_get_functiondef('public.kq_warehouse_queue_processing()'::regprocedure);
 anchor:=E' NEW.processing_started_at:=GREATEST(now(),COALESCE((SELECT max(processing_ready_at)\n  FROM public.kq_commerce_batches WHERE user_id=NEW.user_id AND processing_equipment_codes&&required_codes),now()));';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'processing_work_queue_anchor'; END IF;
 body:=replace(body,anchor,' NEW.processing_started_at:=public.kq_processing_machine_available(NEW.user_id,required_codes,NEW.flower_id);');
 anchor:=' seconds:=(quote->>''processingDurationSeconds'')::INTEGER;';
 replacement:=$branch$
 IF quote ? 'processingWork' AND quote->'processingWork'->'version' IS DISTINCT FROM '1'::JSONB THEN RAISE EXCEPTION 'processing_work_changed'; END IF;
 IF quote->'processingWork'->'version'='1'::JSONB THEN
  IF (quote->'processingWork'->>'inputGrams')::NUMERIC IS DISTINCT FROM (quote->>'processedInputGrams')::NUMERIC THEN RAISE EXCEPTION 'processing_work_changed'; END IF;
  IF ARRAY(SELECT m->>'code' FROM jsonb_array_elements(quote->'processingWork'->'machines') m ORDER BY m->>'code') IS DISTINCT FROM required_codes
   THEN RAISE EXCEPTION 'processing_work_changed'; END IF;
  INSERT INTO public.kq_processing_jobs(flower_id,user_id,route,input_grams,nominal_hours,passive_hours,work,equipment_codes)
   VALUES(NEW.flower_id,NEW.user_id,NEW.route,(quote->'processingWork'->>'inputGrams')::NUMERIC,
    (quote->'processingWork'->>'nominalHours')::NUMERIC,(quote->'processingWork'->>'passiveHours')::NUMERIC,(quote->'processingWork')-'quote',required_codes);
  quote:=public.kq_processing_work_start(NEW.user_id,NEW.flower_id,current_setting('kq.processing_expected',true));
  NEW.processing_equipment_codes:=required_codes;
  NEW.processing_started_at:=(quote->>'startedAt')::TIMESTAMPTZ;
  NEW.processing_ready_at:=COALESCE((quote->>'finalReadyAt')::TIMESTAMPTZ,'9999-01-01'::TIMESTAMPTZ);
  RETURN NEW;
 END IF;
 seconds:=(quote->>'processingDurationSeconds')::INTEGER;$branch$;
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'processing_work_profile_anchor'; END IF;
 EXECUTE replace(body,anchor,replacement);
END $$;

CREATE FUNCTION public.kq_processing_work_validate_staff(p_user UUID,p_state JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous JSONB; task JSONB; old_task JSONB;
BEGIN
 SELECT state INTO previous FROM public.kq_staff_accounts WHERE user_id=p_user;
 FOR task IN SELECT t FROM jsonb_array_elements(p_state->'tasks') t LOOP
  SELECT t INTO old_task FROM jsonb_array_elements(previous->'tasks') t WHERE t->>'id'=task->>'id';
  IF NOT(task ?| ARRAY['processingShift','processingUsedHours']) AND NOT COALESCE(old_task ?| ARRAY['processingShift','processingUsedHours'],false) THEN CONTINUE; END IF;
  IF task->'processingShift' IS DISTINCT FROM 'true'::JSONB OR task->>'kind' IS DISTINCT FROM 'processing' OR task->>'skill' IS DISTINCT FROM 'processing'
   OR task->>'employeeId'='player' OR jsonb_typeof(task->'processingUsedHours') IS DISTINCT FROM 'number'
   OR jsonb_typeof(task->'hours') IS DISTINCT FROM 'number' OR (task->>'hours')::NUMERIC NOT BETWEEN .5 AND 10
   OR mod((task->>'hours')::NUMERIC,.5)<>0 OR (task->>'processingUsedHours')::NUMERIC NOT BETWEEN 0 AND (task->>'hours')::NUMERIC
   OR mod((task->>'processingUsedHours')::NUMERIC,.5)<>0 OR COALESCE(task->>'skillLevel','') !~ '^(10|[1-9])$'
   OR COALESCE(task->>'day','') !~ '^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION 'processing_work_changed'; END IF;
  IF old_task IS NULL THEN
   IF (task->>'processingUsedHours')::NUMERIC<>0 THEN RAISE EXCEPTION 'processing_work_changed'; END IF;
  ELSIF (task-'status'-'outcome') IS DISTINCT FROM (old_task-'status'-'outcome') THEN RAISE EXCEPTION 'processing_work_changed'; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.kq_processing_work_validate_staff(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 body:=pg_get_functiondef('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure);
 anchor:='PERFORM public.kq_player_work_validate_staff(p_user_id,p_command,p_state);';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'processing_work_staff_anchor'; END IF;
 body:=replace(body,anchor,anchor||E'\n PERFORM public.kq_processing_work_validate_staff(p_user_id,p_state);');
 anchor:='WHERE flower_id=(effect->>''flowerId'')::UUID AND user_id=p_user_id AND processing_started_at<=now() AND processing_ready_at>now();';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'processing_work_acceleration_anchor'; END IF;
 EXECUTE replace(body,anchor,'WHERE flower_id=(effect->>''flowerId'')::UUID AND user_id=p_user_id AND processing_started_at<=now() AND processing_ready_at>now() AND NOT EXISTS(SELECT 1 FROM public.kq_processing_jobs j WHERE j.flower_id=(effect->>''flowerId'')::UUID);');
 -- Only v1 preparation already charged by its job skips the old flat 1 h.
 body:=pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure);
 anchor:='  no_work:=(false);';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'processing_work_commerce_charge_anchor'; END IF;
 EXECUTE replace(body,anchor,$charge$  no_work:=(p_action='prepare' AND EXISTS(SELECT 1 FROM public.kq_market_lots l,
 jsonb_array_elements(l.options) q WHERE l.flower_id=(p_payload->>'flowerId')::UUID AND l.owner_id=p_user_id
 AND q->>'route'=p_payload->>'route' AND q->'processingWork'->'version'='1'::JSONB));$charge$);
END $$;

ALTER FUNCTION public.rpc_kq_commerce_command(UUID,TEXT,JSONB,UUID) RENAME TO kq_commerce_before_processing_work;
REVOKE ALL ON FUNCTION public.kq_commerce_before_processing_work(UUID,TEXT,JSONB,UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.rpc_kq_commerce_command(p_user_id UUID,p_action TEXT,p_payload JSONB,p_request_key UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE old public.kq_commerce_requests%ROWTYPE; result JSONB; fid UUID; job public.kq_processing_jobs%ROWTYPE;
BEGIN
 IF p_action NOT IN ('prepare','processing-work') THEN RETURN public.kq_commerce_before_processing_work(p_user_id,p_action,p_payload,p_request_key); END IF;
 IF p_user_id IS NULL OR p_request_key IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'commerce_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 SELECT * INTO old FROM public.kq_commerce_requests WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF old.action IS DISTINCT FROM p_action OR old.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'commerce_request_mismatch'; END IF;
  RETURN old.receipt||jsonb_build_object('replayed',true,'processingJobs',public.kq_processing_jobs_snapshot(p_user_id));
 END IF;
 fid:=(p_payload->>'flowerId')::UUID;
 IF p_action='prepare' THEN
  IF EXISTS(SELECT 1 FROM public.kq_market_lots l,jsonb_array_elements(l.options) q
   WHERE l.flower_id=fid AND l.owner_id=p_user_id AND q->>'route'=p_payload->>'route' AND q ? 'processingWork')
   AND NOT EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=p_user_id)
   THEN RAISE EXCEPTION 'processing_work_unavailable'; END IF;
  PERFORM set_config('kq.processing_expected',COALESCE(p_payload->>'expectedWork',''),true);
  result:=public.kq_commerce_before_processing_work(p_user_id,p_action,p_payload,p_request_key);
  PERFORM set_config('kq.processing_expected','',true);
 ELSE
  PERFORM public.kq_business_settle(p_user_id);
  SELECT * INTO job FROM public.kq_processing_jobs WHERE flower_id=fid AND user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'processing_work_unavailable'; END IF;
  PERFORM public.kq_assert_processing_maintenance(p_user_id,job.route);
  IF NOT job.equipment_codes<@public.kq_warehouse_processing_codes(p_user_id) THEN RAISE EXCEPTION 'processing_work_changed'; END IF;
  result:=jsonb_build_object('action',p_action,'flowerId',fid,'segment',public.kq_processing_work_start(p_user_id,fid,p_payload->>'expectedWork'),
   'cashAfterCents',(SELECT cash_cents FROM public.kq_equipment_wallets WHERE user_id=p_user_id),'paidCents',0,'replayed',false);
  INSERT INTO public.kq_commerce_requests(user_id,request_key,action,payload,receipt) VALUES(p_user_id,p_request_key,p_action,p_payload,result);
 END IF;
 RETURN result||jsonb_build_object('processingJobs',public.kq_processing_jobs_snapshot(p_user_id));
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_commerce_command(UUID,TEXT,JSONB,UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_commerce_command(UUID,TEXT,JSONB,UUID) TO service_role;

ALTER FUNCTION public.rpc_kq_commerce_state(UUID) RENAME TO kq_commerce_state_before_processing_work;
REVOKE ALL ON FUNCTION public.kq_commerce_state_before_processing_work(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.rpc_kq_commerce_state(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 RETURN public.kq_commerce_state_before_processing_work(p_user_id)||jsonb_build_object('processingWorkVersion',1,'processingJobs',public.kq_processing_jobs_snapshot(p_user_id));
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_commerce_state(UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_commerce_state(UUID) TO service_role;
ALTER FUNCTION public.kq_staff_snapshot(UUID) RENAME TO kq_staff_snapshot_before_processing_work;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot_before_processing_work(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_staff_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_set(s,'{context}',s->'context'||jsonb_build_object('processingWorkVersion',1,'processingJobs',public.kq_processing_jobs_snapshot(p_user),
  'processingBatches',COALESCE((SELECT jsonb_agg(b) FROM jsonb_array_elements(s#>'{context,processingBatches}') b
    WHERE NOT EXISTS(SELECT 1 FROM public.kq_processing_jobs j WHERE j.flower_id=(b->>'flowerId')::UUID)),'[]'::JSONB)))
 FROM (SELECT public.kq_staff_snapshot_before_processing_work(p_user) s) source;
$$;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
