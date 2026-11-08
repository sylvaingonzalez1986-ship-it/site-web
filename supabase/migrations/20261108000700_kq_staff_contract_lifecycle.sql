BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Contract IDs remain immutable archive keys. personId links later contracts
-- without resurrecting, editing or deleting an earlier employment record.
CREATE FUNCTION public.kq_staff_contract_rows(p_user UUID) RETURNS SETOF JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT e FROM public.kq_staff_accounts a CROSS JOIN LATERAL jsonb_array_elements(a.state->'employees') e WHERE a.user_id=p_user
 UNION ALL
 SELECT h.payload FROM public.kq_staff_archive h WHERE h.user_id=p_user AND h.kind='contract'
  AND NOT EXISTS(SELECT 1 FROM public.kq_staff_accounts a CROSS JOIN LATERAL jsonb_array_elements(a.state->'employees') e
   WHERE a.user_id=p_user AND e->>'id'=h.record_id);
$$;
REVOKE ALL ON FUNCTION public.kq_staff_contract_rows(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_staff_contract_source(p_user UUID,p_contract TEXT) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE requested JSONB; latest JSONB; person TEXT;
BEGIN
 SELECT e INTO requested FROM public.kq_staff_contract_rows(p_user) e WHERE e->>'id'=p_contract;
 IF requested IS NULL THEN RAISE EXCEPTION 'staff_contract_unavailable'; END IF;
 person:=COALESCE(requested->>'personId',requested->>'id');
 SELECT e INTO latest FROM public.kq_staff_contract_rows(p_user) e WHERE COALESCE(e->>'personId',e->>'id')=person
  ORDER BY (e->>'hiredAt')::TIMESTAMPTZ DESC,e->>'id' DESC LIMIT 1;
 RETURN latest;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_contract_source(UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_staff_contract_source(p_user_id UUID,p_contract_id TEXT) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.kq_staff_contract_source(p_user_id,p_contract_id);
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_staff_contract_source(UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_staff_contract_source(UUID,TEXT) TO service_role;

-- Game months are thirty four-real-hour days. Employment-post waiting periods
-- use the role as a conservative game abstraction and only Mon-Fri openings.
-- endsAt is exclusive: an exact boundary starts waiting on that new game day;
-- a partial day is skipped. Match JavaScript Date's millisecond precision.
CREATE FUNCTION public.kq_staff_contract_available_at(p_started TIMESTAMPTZ,p_employee JSONB) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE started TIMESTAMPTZ:=date_trunc('milliseconds',p_started);
 hired TIMESTAMPTZ:=date_trunc('milliseconds',(p_employee->>'hiredAt')::TIMESTAMPTZ);
 ended TIMESTAMPTZ:=date_trunc('milliseconds',(p_employee->>'endsAt')::TIMESTAMPTZ);
 duration_days INTEGER; waiting INTEGER; day_index INTEGER;
BEGIN
 IF p_employee->>'contract' IS DISTINCT FROM 'cdd' OR ended IS NULL OR started IS NULL OR hired IS NULL THEN RETURN NULL; END IF;
 IF NOT isfinite(started) OR NOT isfinite(hired) OR NOT isfinite(ended) OR ended<=hired OR hired<started THEN RETURN NULL; END IF;
 duration_days:=ceil(extract(epoch FROM ended-hired)/14400)::INTEGER;
 waiting:=ceil(duration_days::NUMERIC/CASE WHEN duration_days<14 THEN 2 ELSE 3 END)::INTEGER;
 day_index:=GREATEST(0,ceil(extract(epoch FROM ended-started)/14400)::INTEGER);
 WHILE waiting>0 LOOP
  IF mod(day_index,7)<5 THEN waiting:=waiting-1; END IF;
  day_index:=day_index+1;
 END LOOP;
 RETURN started+day_index*interval '4 hours';
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_contract_available_at(TIMESTAMPTZ,JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_staff_contract_cooldowns(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH origin AS (SELECT COALESCE(c.business_started_at,w.created_at) AS started FROM public.kq_equipment_wallets w
  LEFT JOIN public.kq_commerce_accounts c USING(user_id) WHERE w.user_id=p_user), periods AS (
  SELECT e->>'role' AS role,public.kq_staff_contract_available_at(origin.started,e) AS available
  FROM public.kq_staff_contract_rows(p_user) e CROSS JOIN origin
  WHERE e->>'contract'='cdd' AND (e->>'endsAt')::TIMESTAMPTZ<=now()
   AND e->>'role' IN ('worker','grower','processor','commercial','administrator')
 ), latest AS (SELECT role,max(available) AS available FROM periods WHERE available IS NOT NULL GROUP BY role)
 SELECT COALESCE(jsonb_object_agg(role,available),'{}'::JSONB) FROM latest;
$$;
REVOKE ALL ON FUNCTION public.kq_staff_contract_cooldowns(UUID) FROM PUBLIC,anon,authenticated,service_role;

-- Keep existing salary quotes byte-for-byte compatible with the engine's
-- Math.round(gross * 0.35), including its binary floating-point boundary cases.
-- This validates an offered quote; it does not recalculate historical payroll.
CREATE FUNCTION public.kq_staff_contract_monthly_cost(p_hourly INTEGER,p_hours INTEGER) RETURNS BIGINT
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH salary AS (SELECT round(p_hourly::NUMERIC*p_hours*52/12)::BIGINT AS gross),
 charges AS (SELECT gross,gross::DOUBLE PRECISION*0.35::DOUBLE PRECISION AS employer FROM salary)
 SELECT gross+floor(employer)::BIGINT+CASE WHEN employer-floor(employer)>=0.5::DOUBLE PRECISION THEN 1 ELSE 0 END FROM charges;
$$;
REVOKE ALL ON FUNCTION public.kq_staff_contract_monthly_cost(INTEGER,INTEGER) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_staff_validate_contract_lifecycle(p_user UUID,p_command JSONB,p_state JSONB,p_debit INTEGER,p_effects JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous JSONB; employee JSONB; old_employee JSONB; source JSONB; expected JSONB; profile JSONB; days JSONB;
 action TEXT:=p_command->>'action'; target TEXT:=p_command->>'employeeId'; person TEXT; field TEXT;
 lifecycle BOOLEAN:=action IN ('renew-contract','convert-cdi','rehire'); added INTEGER:=0;
 changed_at TIMESTAMPTZ:=date_trunc('milliseconds',(p_state->>'lastSettledAt')::TIMESTAMPTZ);
 new_end TIMESTAMPTZ; months INTEGER; monthly BIGINT; current_week INTEGER; available TIMESTAMPTZ;
BEGIN
 SELECT state INTO previous FROM public.kq_staff_accounts WHERE user_id=p_user;
 -- The backend persists settlement first. Lifecycle actions cannot hide XP,
 -- payroll, work, rewards or other simulation changes in a contract amendment.
 IF lifecycle AND (p_debit<>0 OR p_effects<>'[]'::JSONB
  OR (p_state-'employees'-'lastSettledAt') IS DISTINCT FROM (previous-'employees'-'lastSettledAt'))
 THEN RAISE EXCEPTION 'staff_changed'; END IF;
 -- A payday/expiry can cross between the persisted settlement and this CAS.
 -- Ask the backend to settle again; freezing the amendment must not postpone
 -- due pay or extend a contract whose real server deadline has already passed.
 IF lifecycle AND EXISTS(SELECT 1 FROM jsonb_array_elements(previous->'employees') e WHERE e->>'status'='active'
  AND ((e->>'nextPayrollAt')::TIMESTAMPTZ<=now() OR (e->>'endsAt')::TIMESTAMPTZ<=now()))
 THEN RAISE EXCEPTION 'staff_changed'; END IF;
 FOR employee IN SELECT e FROM jsonb_array_elements(p_state->'employees') e LOOP
  SELECT e INTO old_employee FROM jsonb_array_elements(previous->'employees') e WHERE e->>'id'=employee->>'id';
  IF old_employee IS NOT NULL THEN
   -- These fields can never be changed through an unrelated command, including
   -- settle. This also prevents erasing a renewal count or a person's lineage.
   FOREACH field IN ARRAY ARRAY['personId','previousContractId','code','name','role','trait','biography','portraitCode','hourlyCents','classification','contracts','hiredAt'] LOOP
    IF employee->field IS DISTINCT FROM old_employee->field THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
   END LOOP;
   IF action IN ('renew-contract','convert-cdi') AND employee->>'id'=target THEN CONTINUE; END IF;
   FOREACH field IN ARRAY ARRAY['contract','reason','endsAt','renewals','convertedToCdiAt'] LOOP
    IF employee->field IS DISTINCT FROM old_employee->field THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
   END LOOP;
   IF lifecycle AND employee IS DISTINCT FROM old_employee THEN RAISE EXCEPTION 'staff_changed'; END IF;
  ELSE
   added:=added+1;
   IF action NOT IN ('hire','rehire') THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
  END IF;
 END LOOP;
 IF action NOT IN ('hire','rehire','renew-contract','convert-cdi') THEN RETURN; END IF;
 IF p_debit<>0 THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
 IF action IN ('renew-contract','convert-cdi') THEN
  IF added<>0 OR jsonb_array_length(p_state->'employees') IS DISTINCT FROM jsonb_array_length(previous->'employees') THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
  SELECT e INTO old_employee FROM jsonb_array_elements(previous->'employees') e WHERE e->>'id'=target;
  SELECT e INTO employee FROM jsonb_array_elements(p_state->'employees') e WHERE e->>'id'=target;
  IF old_employee IS NULL OR employee IS NULL OR old_employee->>'status' IS DISTINCT FROM 'active'
   OR old_employee->>'contract' NOT IN ('cdd','seasonal') OR old_employee->'finalPaid' IS DISTINCT FROM 'false'::JSONB
   OR (old_employee->>'hiredAt')::TIMESTAMPTZ>now()
   OR old_employee->>'endsAt' IS NULL OR (old_employee->>'endsAt')::TIMESTAMPTZ<=now()
   OR p_command->'expectedEndsAt' IS DISTINCT FROM old_employee->'endsAt'
  THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
  monthly:=public.kq_staff_contract_monthly_cost((old_employee->>'hourlyCents')::INTEGER,(old_employee->>'weeklyHours')::INTEGER);
  IF p_command->'expectedMonthlyCostCents' IS DISTINCT FROM to_jsonb(monthly) THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
  IF action='renew-contract' THEN
   IF jsonb_typeof(p_command->'months') IS DISTINCT FROM 'number' OR COALESCE(p_command->>'months','') !~ '^[0-9]{1,2}$'
    OR (p_command->>'months')::INTEGER NOT BETWEEN 1 AND 18
    OR jsonb_typeof(COALESCE(old_employee->'renewals','[]'::JSONB)) IS DISTINCT FROM 'array'
    OR jsonb_array_length(COALESCE(old_employee->'renewals','[]'::JSONB))>=2 THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
   months:=(p_command->>'months')::INTEGER;
   new_end:=date_trunc('milliseconds',(old_employee->>'endsAt')::TIMESTAMPTZ)+months*interval '120 hours';
   IF new_end>date_trunc('milliseconds',(old_employee->>'hiredAt')::TIMESTAMPTZ)
      +(CASE WHEN old_employee->>'contract'='seasonal' THEN 6 ELSE 18 END)*interval '120 hours'
    OR (employee->>'endsAt')::TIMESTAMPTZ IS DISTINCT FROM new_end THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
   expected:=old_employee||jsonb_build_object('endsAt',employee->'endsAt','renewals',
    COALESCE(old_employee->'renewals','[]'::JSONB)||jsonb_build_array(jsonb_build_object(
     'at',p_state->'lastSettledAt','previousEndsAt',old_employee->'endsAt','endsAt',employee->'endsAt')));
  ELSE
   IF NOT COALESCE(old_employee->'contracts' ? 'cdi',false) THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
   expected:=old_employee||jsonb_build_object('contract','cdi','reason','permanent','endsAt',NULL,'convertedToCdiAt',p_state->'lastSettledAt');
  END IF;
  IF employee IS DISTINCT FROM expected THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
  RETURN;
 END IF;

 IF added<>1 OR public.kq_staff_debt(p_user)>0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_state->'payroll') p
   WHERE (p->>'paidCents')::BIGINT<(p->>'totalCents')::BIGINT)
 THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
 SELECT e INTO employee FROM jsonb_array_elements(p_state->'employees') e WHERE NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(previous->'employees') old WHERE old->>'id'=e->>'id');
 IF COALESCE(employee->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  OR employee->'contract' IS DISTINCT FROM p_command->'contract' OR employee->'weeklyHours' IS DISTINCT FROM p_command->'weeklyHours'
  OR employee->'reason' IS DISTINCT FROM p_command->'reason' OR employee->'hiredAt' IS DISTINCT FROM p_state->'lastSettledAt'
  OR employee->>'status' IS DISTINCT FROM 'active' OR employee->'finalPaid' IS DISTINCT FROM 'false'::JSONB
  OR jsonb_typeof(p_command->'weeklyHours') IS DISTINCT FROM 'number'
  OR jsonb_typeof(p_command->'expectedMonthlyCostCents') IS DISTINCT FROM 'number'
  OR COALESCE(employee->>'role','') NOT IN ('worker','grower','processor','commercial','administrator')
  OR jsonb_typeof(employee->'hourlyCents') IS DISTINCT FROM 'number' OR COALESCE(employee->>'hourlyCents','') !~ '^[0-9]{1,7}$'
  OR COALESCE(p_command->>'weeklyHours','') NOT IN ('7','14','21','28','35')
  OR NOT COALESCE(employee->'contracts' ? (p_command->>'contract'),false)
  OR (employee->>'role'='grower' AND (p_command->>'contract'<>'cdi' OR p_command->>'weeklyHours'<>'35'))
  OR NOT COALESCE(CASE p_command->>'contract'
   WHEN 'cdi' THEN p_command->>'reason'='permanent' AND p_command->'durationMonths'='0'::JSONB
   WHEN 'cdd' THEN p_command->>'reason' IN ('replacement','temporary-increase') AND p_command->'durationMonths' IN ('3'::JSONB,'6'::JSONB,'12'::JSONB)
   WHEN 'seasonal' THEN p_command->>'reason'='harvest' AND p_command->'durationMonths' IN ('1'::JSONB,'2'::JSONB,'3'::JSONB,'6'::JSONB)
   ELSE false END,false)
 THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
 new_end:=CASE WHEN p_command->>'contract'='cdi' THEN NULL ELSE changed_at+(p_command->>'durationMonths')::INTEGER*interval '120 hours' END;
 IF (employee->>'endsAt')::TIMESTAMPTZ IS DISTINCT FROM new_end THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
 monthly:=public.kq_staff_contract_monthly_cost((employee->>'hourlyCents')::INTEGER,(employee->>'weeklyHours')::INTEGER);
 IF p_command->'expectedMonthlyCostCents' IS DISTINCT FROM to_jsonb(monthly) THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
 available:=(public.kq_staff_contract_cooldowns(p_user)->>(employee->>'role'))::TIMESTAMPTZ;
 IF p_command->>'contract'<>'cdi' AND available IS NOT NULL AND (changed_at<available OR now()<available)
 THEN RAISE EXCEPTION 'staff_contract_cooldown'; END IF;
 IF action='hire' THEN
  IF employee->'code' IS DISTINCT FROM p_command->'candidateCode' OR employee ? 'previousContractId'
   OR (employee ? 'personId' AND employee->'personId' IS DISTINCT FROM employee->'id')
   OR (employee ? 'renewals' AND employee->'renewals' IS DISTINCT FROM '[]'::JSONB)
   OR employee ? 'convertedToCdiAt' THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
  RETURN;
 END IF;

 source:=public.kq_staff_contract_source(p_user,p_command->>'sourceContractId');
 person:=COALESCE(source->>'personId',source->>'id');
 IF source->>'id' IS DISTINCT FROM p_command->>'sourceContractId' OR source->>'status' IS DISTINCT FROM 'ended'
  OR source->'finalPaid' IS DISTINCT FROM 'true'::JSONB OR (source->>'endsAt')::TIMESTAMPTZ>now()
  OR (source->>'hiredAt')::TIMESTAMPTZ>now() OR (source->>'contract'<>'cdi' AND source->>'endsAt' IS NULL)
  OR employee->>'id'=source->>'id'
  OR EXISTS(SELECT 1 FROM public.kq_staff_contract_rows(p_user) e WHERE COALESCE(e->>'personId',e->>'id')=person AND e->>'status'='active')
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(previous->'tasks') t WHERE t->>'employeeId'=source->>'id' AND t->>'status'='running')
 THEN RAISE EXCEPTION 'staff_contract_unavailable'; END IF;
 SELECT COALESCE(jsonb_object_agg(key,value),'{}'::JSONB) INTO profile FROM jsonb_each(source)
  WHERE key IN ('code','name','role','trait','biography','portraitCode','hourlyCents','classification','skills','contracts');
 current_week:=floor((public.kq_player_work_day(p_user)-1)::NUMERIC/7)::INTEGER;
 SELECT COALESCE(jsonb_object_agg(key,value),'{}'::JSONB) INTO days FROM jsonb_each(COALESCE(source->'workDays','{}'::JSONB))
  WHERE floor((key::INTEGER-1)::NUMERIC/7)>=current_week-11;
 expected:=profile||jsonb_build_object('id',employee->'id','personId',person,'previousContractId',source->'id','renewals','[]'::JSONB,
  'contract',p_command->'contract','weeklyHours',p_command->'weeklyHours','reason',p_command->'reason',
  'hiredAt',p_state->'lastSettledAt','endsAt',employee->'endsAt','status','active','nextPayrollAt',employee->'nextPayrollAt',
  'paidUntil',p_state->'lastSettledAt','grossEarnedCents',0,'overtimeGrossCents',0,'finalPaid',false,'workDays',days,'leave','[]'::JSONB,'completedTasks',0);
 IF employee IS DISTINCT FROM expected OR (employee->>'nextPayrollAt')::TIMESTAMPTZ IS DISTINCT FROM changed_at+interval '120 hours'
 THEN RAISE EXCEPTION 'staff_contract_changed'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_validate_contract_lifecycle(UUID,JSONB,JSONB,INTEGER,JSONB) FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 body:=pg_get_functiondef('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure);
 anchor:='''hire'',''assign''';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'staff_contract_whitelist_drift'; END IF;
 body:=replace(body,anchor,'''hire'',''renew-contract'',''convert-cdi'',''rehire'',''assign''');
 anchor:='IF account.revision<>p_expected_revision THEN RAISE EXCEPTION ''staff_changed''; END IF;';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'staff_contract_guard_drift'; END IF;
 EXECUTE replace(body,anchor,anchor||E'\n PERFORM public.kq_staff_validate_contract_lifecycle(p_user_id,p_command,p_state,p_debit_cents,p_effects);');
END $$;

ALTER FUNCTION public.kq_staff_snapshot(UUID) RENAME TO kq_staff_snapshot_before_contract_lifecycle;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot_before_contract_lifecycle(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_staff_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH snapshot AS (SELECT public.kq_staff_snapshot_before_contract_lifecycle(p_user) AS value)
 SELECT jsonb_set(value,'{context}',value->'context'||jsonb_build_object('contractLifecycleVersion',1,
  'contractCooldowns',public.kq_staff_contract_cooldowns(p_user))) FROM snapshot;
$$;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
