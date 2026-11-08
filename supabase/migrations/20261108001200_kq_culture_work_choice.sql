BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Selecting the actor only affects an unpaid stage. Keep automatic allocation,
-- historical receipts and every consumption/XP rule from the existing engine.
ALTER FUNCTION public.kq_culture_work_preview(UUID,UUID,TEXT) RENAME TO kq_culture_work_preview_before_actor_choice;
REVOKE ALL ON FUNCTION public.kq_culture_work_preview_before_actor_choice(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_culture_work_preview(p_user UUID,p_run UUID,p_choice TEXT DEFAULT 'auto') RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE quote JSONB; run public.kq_runs%ROWTYPE; staff JSONB; task JSONB; employee JSONB; actor JSONB;
 current_day INTEGER; available BOOLEAN; used NUMERIC; hours NUMERIC; before_bonus JSONB; after_bonus JSONB;
 bonus JSONB:='{"vitality":0,"terpenes":0,"yieldPercent":0,"cannabinoids":0}'; reason TEXT; source TEXT;
BEGIN
 IF p_choice IS NULL OR (p_choice NOT IN ('auto','player') AND p_choice !~ '^employee:[a-zA-Z0-9_-]{1,128}$')
  THEN RAISE EXCEPTION 'culture_work_changed'; END IF;
 quote:=public.kq_culture_work_preview_before_actor_choice(p_user,p_run,'auto');
 -- A quote may inspect an already paid stage, but cannot rewrite its actor.
 IF p_choice='auto' OR quote->'paid'='true'::JSONB OR quote->>'phase'<>'prepare' THEN RETURN quote; END IF;
 SELECT * INTO run FROM public.kq_runs WHERE id=(quote->>'runId')::UUID AND user_id=p_user;
 IF run.status<>'active' THEN RETURN quote; END IF;
 IF p_choice='player' THEN
  source:='player';
  IF (quote->>'playerRemainingHours')::NUMERIC<.5 THEN source:='blocked'; reason:='La journée du joueur est complète.'; END IF;
  RETURN quote||jsonb_build_object('source',source,'employee',NULL,'bonus',bonus,'reason',reason);
 END IF;
 current_day:=(quote->>'day')::INTEGER;
 SELECT state INTO staff FROM public.kq_staff_accounts WHERE user_id=p_user;
 -- The selected employee must belong to this account and have a Culture
 -- reservation usable by this culture. Another employee never substitutes.
 WITH candidates AS (
  SELECT t FROM jsonb_array_elements(COALESCE(staff->'tasks','[]'::JSONB)) t
   WHERE t->'cultureShift'='true'::JSONB AND t->>'kind'='culture'
    AND ((t->>'day')::INTEGER=current_day OR t->>'targetId'=run.id::TEXT)
  UNION ALL
  SELECT h.payload FROM public.kq_staff_archive h WHERE h.user_id=p_user AND h.kind='task'
   AND h.payload->'cultureShift'='true'::JSONB AND h.payload->>'kind'='culture'
   AND ((h.payload->>'day')::INTEGER=current_day OR h.payload->>'targetId'=run.id::TEXT)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(staff->'tasks','[]'::JSONB)) t WHERE t->>'id'=h.record_id)
 ), actors AS (
  SELECT t,(SELECT e FROM jsonb_array_elements(COALESCE(staff->'employees','[]'::JSONB)) e WHERE e->>'id'=t->>'employeeId') e
  FROM candidates WHERE t->>'employeeId'=substring(p_choice FROM 10) AND (t->>'targetId' IS NULL OR t->>'targetId'=run.id::TEXT)
 ), choices AS (
  SELECT t,e,COALESCE((t->>'day')::INTEGER=current_day AND t->>'status'='running'
   AND (t->>'cultureUsedHours')::NUMERIC+.5<=(t->>'hours')::NUMERIC
   AND (t->>'startedAt')::TIMESTAMPTZ<=now() AND (t->>'completesAt')::TIMESTAMPTZ>now()
   AND e->>'status'='active' AND (e->>'hiredAt')::TIMESTAMPTZ<=now()
   AND ((e->>'endsAt') IS NULL OR (e->>'endsAt')::TIMESTAMPTZ>now())
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(e->'leave','[]'::JSONB)) l
    WHERE current_day BETWEEN (l->>'startDay')::INTEGER AND (l->>'endDay')::INTEGER),false) eligible
  FROM actors
 ) SELECT t,e,eligible INTO task,employee,available FROM choices
  ORDER BY eligible DESC,(t->>'targetId' IS NOT NULL) DESC,(t->>'startedAt')::TIMESTAMPTZ,t->>'id' LIMIT 1;
 IF task IS NULL OR employee IS NULL THEN
  RETURN quote||jsonb_build_object('source','blocked','employee',NULL,'bonus',bonus,
   'reason','Ce salarié ne dispose pas d’une affectation Culture pour cette étape.');
 END IF;
 used:=(task->>'cultureUsedHours')::NUMERIC; hours:=(task->>'hours')::NUMERIC;
 actor:=jsonb_strip_nulls(jsonb_build_object('id',task->>'employeeId','name',employee->>'name',
  'code',employee->>'code','portraitCode',employee->>'portraitCode','level',(task->>'skillLevel')::INTEGER,
  'role',employee->>'role','taskId',task->>'id','allocatedHours',hours,'usedHours',used,'remainingHours',GREATEST(0,hours-used)));
 IF NOT available THEN
  source:='blocked'; reason:='La réservation Culture de ce salarié est épuisée ou indisponible.';
 ELSIF (employee->>'nextPayrollAt')::TIMESTAMPTZ<=now() OR EXISTS(
  SELECT 1 FROM jsonb_array_elements(COALESCE(staff->'payroll','[]'::JSONB)) p
   WHERE (p->>'paidCents')::BIGINT<(p->>'totalCents')::BIGINT AND (p->>'dueAt')::TIMESTAMPTZ<=now()) THEN
  source:='blocked'; reason:='Une paie est échue. Règle-la pour reprendre le travail délégué.';
 ELSE
  source:='employee';
  before_bonus:=public.kq_culture_work_totals(used,(task->>'skillLevel')::INTEGER,employee->>'trait',employee->>'role');
  after_bonus:=public.kq_culture_work_totals(used+.5,(task->>'skillLevel')::INTEGER,employee->>'trait',employee->>'role');
  SELECT jsonb_object_agg(key,GREATEST(0,LEAST(cap-COALESCE((run.state->'care'->>field)::INTEGER,cap),
   (after_bonus->>key)::INTEGER-(before_bonus->>key)::INTEGER))) INTO bonus
  FROM (VALUES ('vitality','vitality',100),('terpenes','terpenes',99),('yieldPercent','yieldBonusPercent',10),
   ('cannabinoids','cannabinoidExpression',99)) b(key,field,cap);
 END IF;
 RETURN quote||jsonb_build_object('source',source,'employee',actor,'bonus',bonus,'reason',reason);
END $$;
REVOKE ALL ON FUNCTION public.kq_culture_work_preview(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_culture_work_quote(p_user_id UUID,p_run_id UUID,p_work_choice TEXT) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE quote JSONB; option_quote JSONB; choices JSONB:='[]'; actor_choice TEXT; staff JSONB;
BEGIN
 quote:=public.kq_culture_work_preview(p_user_id,p_run_id,p_work_choice);
 IF quote->'paid'='false'::JSONB AND quote->>'phase'='prepare' AND EXISTS(
  SELECT 1 FROM public.kq_runs WHERE id=(quote->>'runId')::UUID AND user_id=p_user_id AND status='active') THEN
  SELECT state INTO staff FROM public.kq_staff_accounts WHERE user_id=p_user_id;
  FOR actor_choice IN
   SELECT 'player'
   UNION ALL
   SELECT 'employee:'||(e->>'id') FROM jsonb_array_elements(COALESCE(staff->'employees','[]'::JSONB)) e
    WHERE e->>'status'='active' AND EXISTS(
     SELECT 1 FROM (
      SELECT t FROM jsonb_array_elements(COALESCE(staff->'tasks','[]'::JSONB)) t
      UNION ALL SELECT h.payload FROM public.kq_staff_archive h WHERE h.user_id=p_user_id AND h.kind='task'
     ) reservations WHERE t->>'employeeId'=e->>'id' AND t->'cultureShift'='true'::JSONB AND t->>'kind'='culture'
      AND (t->>'day')::INTEGER=(quote->>'day')::INTEGER
      AND (t->>'targetId' IS NULL OR t->>'targetId'=quote->>'runId'))
  LOOP
   option_quote:=public.kq_culture_work_preview(p_user_id,p_run_id,actor_choice);
   choices:=choices||jsonb_build_array(jsonb_build_object('choice',actor_choice,
    'source',CASE WHEN actor_choice='player' THEN 'player' ELSE 'employee' END,
    'employee',option_quote->'employee','available',option_quote->>'source'<>'blocked',
    'bonus',option_quote->'bonus','reason',option_quote->'reason'));
  END LOOP;
 END IF;
 RETURN quote||jsonb_build_object('workChoice',p_work_choice,'choices',choices);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_culture_work_quote(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_culture_work_quote(UUID,UUID,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_culture_work_quote(p_user_id UUID,p_run_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.rpc_kq_culture_work_quote(p_user_id,p_run_id,'auto');
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_culture_work_quote(UUID,UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_culture_work_quote(UUID,UUID) TO service_role;

-- Preserve the original lock order, hash (which already includes the actor
-- choice), replay checks, campaign projection and transactional charge.
DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 SELECT pg_get_functiondef('public.kq_culture_work_roll(uuid,uuid,timestamptz,jsonb,jsonb,text)'::regprocedure) INTO body;
 anchor:='IF p_choice IS DISTINCT FROM ''auto'' OR p_expected IS NULL';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'culture_actor_roll_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,'IF p_choice IS NULL OR (p_choice NOT IN (''auto'',''player'') AND p_choice !~ ''^employee:[a-zA-Z0-9_-]{1,128}$'') OR p_expected IS NULL');
END $$;

COMMIT;
