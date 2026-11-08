BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Prospective evidence only: previous missions and invoices are never inferred.
ALTER TABLE public.kq_staff_accounts ADD COLUMN benefits_started_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE TABLE public.kq_staff_benefit_events (
 user_id UUID NOT NULL REFERENCES public.kq_staff_accounts(user_id) ON DELETE CASCADE,
 event_key TEXT NOT NULL CHECK(length(event_key) BETWEEN 1 AND 500),
 kind TEXT NOT NULL CHECK(kind IN ('supplier-saving','communication','sales','supplier-payment','payroll-payment','culture','processing','processing-time','trim','administration-task')),
 amount_cents BIGINT NOT NULL DEFAULT 0 CHECK(amount_cents>=0),
 base_cents BIGINT NOT NULL DEFAULT 0 CHECK(base_cents>=0),
 units NUMERIC NOT NULL DEFAULT 0 CHECK(units>=0),
 game_day INTEGER CHECK(game_day>=1),
 details JSONB NOT NULL DEFAULT '{}'::JSONB CHECK(jsonb_typeof(details)='object'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,event_key)
);
CREATE INDEX kq_staff_benefit_events_daily ON public.kq_staff_benefit_events(user_id,game_day)
 WHERE kind IN ('supplier-payment','payroll-payment');
ALTER TABLE public.kq_staff_benefit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_staff_benefit_events FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_staff_benefit_record(p_user UUID,p_key TEXT,p_kind TEXT,p_amount BIGINT DEFAULT 0,
 p_units NUMERIC DEFAULT 0,p_base BIGINT DEFAULT 0,p_day INTEGER DEFAULT NULL) RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 INSERT INTO public.kq_staff_benefit_events(user_id,event_key,kind,amount_cents,units,base_cents,game_day)
 VALUES(p_user,p_key,p_kind,p_amount,p_units,p_base,p_day) ON CONFLICT(user_id,event_key) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.kq_staff_benefit_record(UUID,TEXT,TEXT,BIGINT,NUMERIC,BIGINT,INTEGER) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_staff_benefits_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('trackedSince',a.benefits_started_at,'lastBenefitAt',max(e.created_at) FILTER(WHERE e.kind<>'administration-task'),
 'supplierSavingsCents',COALESCE(sum(e.amount_cents) FILTER(WHERE e.kind='supplier-saving'),0),
 'supplierBaseCents',COALESCE(sum(e.base_cents) FILTER(WHERE e.kind='supplier-saving'),0),
 'supplierNetCents',COALESCE(sum(e.base_cents-e.amount_cents) FILTER(WHERE e.kind='supplier-saving'),0),
 'discountedInvoices',count(*) FILTER(WHERE e.kind='supplier-saving'),
 'followersGained',COALESCE(sum(e.units) FILTER(WHERE e.kind='communication'),0),
 'partnersGained',COALESCE(sum(e.units) FILTER(WHERE e.kind='sales'),0),
 'invoicesPaidCount',count(*) FILTER(WHERE e.kind='supplier-payment'),
 'invoicesPaidCents',COALESCE(sum(e.amount_cents) FILTER(WHERE e.kind='supplier-payment'),0),
 'payrollPaidCount',count(*) FILTER(WHERE e.kind='payroll-payment'),
 'payrollPaidCents',COALESCE(sum(e.amount_cents) FILTER(WHERE e.kind='payroll-payment'),0),
 'cultureHoursDelegated',COALESCE(sum(e.units) FILTER(WHERE e.kind='culture'),0),
 'processingHoursDelegated',COALESCE(sum(e.units) FILTER(WHERE e.kind='processing'),0),
 'processingSecondsSaved',COALESCE(sum(e.units) FILTER(WHERE e.kind='processing-time'),0),
 'trimGrams',COALESCE(sum(e.units) FILTER(WHERE e.kind='trim'),0),
 'lastAdministration',(SELECT b.details||jsonb_build_object('at',b.created_at) FROM public.kq_staff_benefit_events b
   WHERE b.user_id=p_user AND b.kind='administration-task' ORDER BY b.created_at DESC,b.event_key DESC LIMIT 1))
 FROM public.kq_staff_accounts a LEFT JOIN public.kq_staff_benefit_events e USING(user_id)
 WHERE a.user_id=p_user GROUP BY a.benefits_started_at;
$$;
REVOKE ALL ON FUNCTION public.kq_staff_benefits_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.kq_staff_snapshot(UUID) RENAME TO kq_staff_snapshot_before_benefits;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot_before_benefits(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_staff_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_set(public.kq_staff_snapshot_before_benefits(p_user),'{context,staffBenefitsVersion}','1'::JSONB)
  ||jsonb_build_object('benefits',public.kq_staff_benefits_snapshot(p_user));
$$;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

-- Keep the original discount and accounting order; remember its real base/net.
ALTER TABLE public.kq_supplier_invoices ADD COLUMN staff_discount_base_cents INTEGER
 CHECK(staff_discount_base_cents IS NULL OR staff_discount_base_cents>amount_cents);
CREATE OR REPLACE FUNCTION public.kq_staff_supplier_discount() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE staff JSONB; discount INTEGER; base INTEGER:=NEW.amount_cents;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||NEW.user_id::TEXT,0));
 SELECT state INTO staff FROM public.kq_staff_accounts WHERE user_id=NEW.user_id;
 IF staff IS NULL OR NEW.remaining_cents<>NEW.amount_cents
  OR COALESCE((staff->>'supplierDiscountUntil')::TIMESTAMPTZ<=now(),true) THEN RETURN NEW; END IF;
 discount:=LEAST(10,GREATEST(0,COALESCE((staff->>'supplierDiscountPercent')::INTEGER,0)));
 NEW.amount_cents:=GREATEST(1,base-floor(base::NUMERIC*discount/100)::INTEGER);
 NEW.remaining_cents:=NEW.amount_cents;
 IF NEW.amount_cents<base THEN
  NEW.staff_discount_base_cents:=base;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_supplier_discount() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_staff_benefit_work() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item JSONB; position INTEGER; previous_count INTEGER;
BEGIN
 IF TG_TABLE_NAME='kq_supplier_invoices' THEN
  IF NEW.staff_discount_base_cents IS NOT NULL THEN
   PERFORM public.kq_staff_benefit_record(NEW.user_id,'supplier-saving:'||NEW.id,'supplier-saving',NEW.staff_discount_base_cents-NEW.amount_cents,0,NEW.staff_discount_base_cents);
  END IF;
 ELSIF TG_TABLE_NAME='kq_culture_work_steps' THEN
  IF NEW.work->>'source'='employee' THEN
   PERFORM public.kq_staff_benefit_record(NEW.user_id,'culture:'||NEW.run_id||':'||NEW.stage_index,'culture',0,(NEW.work->>'stepHours')::NUMERIC);
  END IF;
 ELSIF TG_TABLE_NAME='kq_processing_jobs' THEN
  previous_count:=CASE WHEN TG_OP='UPDATE' THEN jsonb_array_length(OLD.segments) ELSE 0 END;
  FOR item,position IN SELECT value,ordinality::INTEGER FROM jsonb_array_elements(NEW.segments) WITH ORDINALITY
   WHERE ordinality>previous_count LOOP
   IF item->>'source'='employee' THEN
    PERFORM public.kq_staff_benefit_record(NEW.user_id,'processing:'||NEW.flower_id||':'||position,'processing',0,(item->>'bookedHours')::NUMERIC);
   END IF;
  END LOOP;
 ELSIF TG_TABLE_NAME='kq_staff_trim_lots' AND NEW.completed_grams>OLD.completed_grams THEN
  PERFORM public.kq_staff_benefit_record(NEW.user_id,'trim:'||NEW.flower_id||':'||NEW.completed_grams,'trim',0,NEW.completed_grams-OLD.completed_grams);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_benefit_work() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_staff_benefit_supplier AFTER INSERT ON public.kq_supplier_invoices
 FOR EACH ROW EXECUTE FUNCTION public.kq_staff_benefit_work();
CREATE TRIGGER kq_staff_benefit_culture AFTER INSERT ON public.kq_culture_work_steps
 FOR EACH ROW EXECUTE FUNCTION public.kq_staff_benefit_work();
CREATE TRIGGER kq_staff_benefit_processing AFTER INSERT OR UPDATE OF segments ON public.kq_processing_jobs
 FOR EACH ROW EXECUTE FUNCTION public.kq_staff_benefit_work();
CREATE TRIGGER kq_staff_benefit_trim AFTER UPDATE OF completed_grams ON public.kq_staff_trim_lots
 FOR EACH ROW EXECUTE FUNCTION public.kq_staff_benefit_work();

CREATE FUNCTION public.kq_staff_validate_administration(p_user UUID,p_command JSONB,p_state JSONB,p_debit INTEGER) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous JSONB; rules JSONB:=p_state->'administrationRules'; old_rules JSONB; field TEXT;
BEGIN
 SELECT state INTO previous FROM public.kq_staff_accounts WHERE user_id=p_user;
 old_rules:=previous->'administrationRules';
 IF p_command->>'action'<>'set-administration-rules' THEN
  IF rules IS DISTINCT FROM old_rules THEN RAISE EXCEPTION 'staff_administration_changed'; END IF;
  RETURN;
 END IF;
 IF p_debit<>0 OR jsonb_typeof(rules) IS DISTINCT FROM 'object'
  OR jsonb_typeof(rules->'enabled') IS DISTINCT FROM 'boolean'
  OR jsonb_typeof(rules->'paySuppliers') IS DISTINCT FROM 'boolean'
  OR jsonb_typeof(rules->'payPayroll') IS DISTINCT FROM 'boolean'
  OR COALESCE(jsonb_typeof(rules->'employeeId'),'missing') NOT IN ('null','string')
  OR jsonb_typeof(rules->'updatedAt') IS DISTINCT FROM 'string'
  OR NOT isfinite((rules->>'updatedAt')::TIMESTAMPTZ)
  OR (rules IS DISTINCT FROM old_rules AND (rules->'updatedAt' IS DISTINCT FROM p_state->'lastSettledAt'
   OR (rules->>'updatedAt')::TIMESTAMPTZ<now()-interval '5 minutes'
   OR (rules->>'updatedAt')::TIMESTAMPTZ>now()+interval '1 second'
   OR (old_rules IS NOT NULL AND (rules->>'updatedAt')::TIMESTAMPTZ<=(old_rules->>'updatedAt')::TIMESTAMPTZ)))
 THEN RAISE EXCEPTION 'staff_administration_invalid'; END IF;
 FOREACH field IN ARRAY ARRAY['enabled','employeeId','paySuppliers','payPayroll','maxDailyCents','cashReserveCents','supplierDueDays'] LOOP
  IF rules->field IS DISTINCT FROM p_command->field THEN RAISE EXCEPTION 'staff_administration_changed'; END IF;
 END LOOP;
 FOREACH field IN ARRAY ARRAY['maxDailyCents','cashReserveCents','supplierDueDays'] LOOP
  IF jsonb_typeof(rules->field) IS DISTINCT FROM 'number' OR COALESCE(rules->>field,'') !~ '^[0-9]{1,9}$'
   OR (rules->>field)::BIGINT>(CASE WHEN field='supplierDueDays' THEN 7 ELSE 100000000 END)
  THEN RAISE EXCEPTION 'staff_administration_invalid'; END IF;
 END LOOP;
 IF rules->>'employeeId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(previous->'employees') e
  WHERE e->>'id'=rules->>'employeeId' AND e->>'status'='active') THEN RAISE EXCEPTION 'staff_administration_invalid'; END IF;
 IF rules->'enabled'='true'::JSONB AND (rules->>'employeeId' IS NULL
  OR (rules->>'maxDailyCents')::BIGINT=0 OR (rules->'paySuppliers'<>'true'::JSONB AND rules->'payPayroll'<>'true'::JSONB))
 THEN RAISE EXCEPTION 'staff_administration_invalid'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_validate_administration(UUID,JSONB,JSONB,INTEGER) FROM PUBLIC,anon,authenticated,service_role;

-- Called after the ordinary commit: its paid-delta guard remains unchanged.
-- One permanent task receipt consumes capacity even if no document can be paid.
CREATE FUNCTION public.kq_staff_process_administration(p_user UUID,p_before JSONB,p_after JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE account public.kq_staff_accounts%ROWTYPE; rules JSONB; task JSONB; employee JSONB; prior JSONB;
 current_day INTEGER; spent BIGINT; budget BIGINT; cash BIGINT; capacity INTEGER; document RECORD;
 amount BIGINT; updated_payroll JSONB; payment JSONB; changed BOOLEAN:=false;
 task_paid BIGINT; task_count INTEGER; eligible_count INTEGER; blocked BOOLEAN;
BEGIN
 SELECT * INTO account FROM public.kq_staff_accounts WHERE user_id=p_user FOR UPDATE;
 rules:=account.state->'administrationRules';
 IF rules->'enabled' IS DISTINCT FROM 'true'::JSONB THEN RETURN; END IF;
 SELECT e INTO employee FROM jsonb_array_elements(account.state->'employees') e WHERE e->>'id'=rules->>'employeeId';
 IF employee IS NULL OR employee->>'status'<>'active' THEN RETURN; END IF;
 current_day:=public.kq_player_work_day(p_user);
 SELECT COALESCE(sum(amount_cents),0) INTO spent FROM public.kq_staff_benefit_events
  WHERE user_id=p_user AND game_day=current_day AND kind IN ('supplier-payment','payroll-payment');
 budget:=GREATEST(0,(rules->>'maxDailyCents')::BIGINT-spent);
 -- The archive may compact a large catch-up during the ordinary state update.
 -- The validated submitted tasks still include those just-completed records.
 FOR task IN SELECT t FROM jsonb_array_elements(p_after->'tasks') t
  WHERE t->>'kind'='administration' AND t->>'employeeId'=rules->>'employeeId' AND t->>'status'='completed'
  ORDER BY (t->>'completesAt')::TIMESTAMPTZ,t->>'id' LOOP
  SELECT t INTO prior FROM jsonb_array_elements(p_before->'tasks') t WHERE t->>'id'=task->>'id';
  IF prior->>'status'='completed' OR (task->>'startedAt')::TIMESTAMPTZ<(rules->>'updatedAt')::TIMESTAMPTZ
   OR (task->>'startedAt')::TIMESTAMPTZ<account.benefits_started_at
   OR (task->>'completesAt')::TIMESTAMPTZ>now() OR (task->>'completesAt')::TIMESTAMPTZ<(task->>'startedAt')::TIMESTAMPTZ
   OR jsonb_typeof(task->'hours') IS DISTINCT FROM 'number' OR (task->>'hours')::NUMERIC NOT BETWEEN .5 AND 10
   OR mod((task->>'hours')::NUMERIC,.5)<>0 OR length(COALESCE(task->>'id','')) NOT BETWEEN 1 AND 200
  THEN CONTINUE; END IF;
  -- A manually paid invoice also creates a completed Administration task; it
  -- must never become a second payment authorization.
  IF prior IS NULL AND NOT (task ? 'weeklyPlanAt') THEN CONTINUE; END IF;
  IF prior IS NOT NULL AND (prior->>'kind'<>'administration' OR prior->>'status'<>'running'
   OR prior->'employeeId' IS DISTINCT FROM task->'employeeId' OR prior->'startedAt' IS DISTINCT FROM task->'startedAt'
   OR prior->'completesAt' IS DISTINCT FROM task->'completesAt' OR prior->'hours' IS DISTINCT FROM task->'hours') THEN CONTINUE; END IF;
  INSERT INTO public.kq_staff_benefit_events(user_id,event_key,kind,game_day)
   VALUES(p_user,'administration-task:'||(task->>'id'),'administration-task',current_day) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN CONTINUE; END IF;
  capacity:=floor((task->>'hours')::NUMERIC/.5)::INTEGER;
  task_paid:=0; task_count:=0; eligible_count:=0; blocked:=false;
  -- Both classes use one due-date ordering and whole-document payments. A large
  -- document is skipped; smaller eligible documents can still fit the budget.
  FOR document IN
   SELECT 'supplier'::TEXT AS kind,i.id::TEXT AS id,i.due_at AS due_at,i.remaining_cents::BIGINT AS amount
    FROM public.kq_supplier_invoices i WHERE i.user_id=p_user AND i.remaining_cents>0
     AND rules->'paySuppliers'='true'::JSONB AND i.due_at<=now()+(rules->>'supplierDueDays')::INTEGER*interval '4 hours'
   UNION ALL
   SELECT 'payroll',p->>'id',(p->>'dueAt')::TIMESTAMPTZ,(p->>'totalCents')::BIGINT-(p->>'paidCents')::BIGINT
    FROM jsonb_array_elements(account.state->'payroll') p WHERE rules->'payPayroll'='true'::JSONB
     AND (p->>'dueAt')::TIMESTAMPTZ<=now() AND (p->>'totalCents')::BIGINT>(p->>'paidCents')::BIGINT
   ORDER BY due_at,kind,id LOOP
   eligible_count:=eligible_count+1;
   EXIT WHEN capacity<=0;
   SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
   amount:=document.amount;
   IF amount>budget OR amount>cash-(rules->>'cashReserveCents')::BIGINT OR amount>100000000 THEN blocked:=true; CONTINUE; END IF;
   IF document.kind='supplier' THEN
    PERFORM 1 FROM public.kq_supplier_invoices WHERE id=document.id::UUID AND user_id=p_user AND remaining_cents=amount FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    payment:=public.kq_business_command(p_user,'pay-supplier',jsonb_build_object('invoiceId',document.id));
    IF (payment->>'paidCents')::BIGINT IS DISTINCT FROM amount THEN RAISE EXCEPTION 'staff_changed'; END IF;
    PERFORM public.kq_staff_benefit_record(p_user,'delegated-supplier:'||document.id,'supplier-payment',amount,0,0,current_day);
   ELSE
    SELECT jsonb_agg(CASE WHEN p->>'id'=document.id THEN jsonb_set(p,'{paidCents}',p->'totalCents') ELSE p END ORDER BY n)
     INTO updated_payroll FROM jsonb_array_elements(account.state->'payroll') WITH ORDINALITY a(p,n);
    UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-amount,updated_at=now() WHERE user_id=p_user;
    account.state:=jsonb_set(account.state,'{payroll}',updated_payroll);
    -- Existing payroll trigger posts only payable/suspense; wallet observers
    -- remain the only cash postings and no expense is duplicated.
    UPDATE public.kq_staff_accounts SET state=account.state,updated_at=now() WHERE user_id=p_user RETURNING state INTO account.state;
    PERFORM public.kq_staff_benefit_record(p_user,'delegated-payroll:'||document.id,'payroll-payment',amount,0,0,current_day);
   END IF;
   capacity:=capacity-1; budget:=budget-amount; changed:=true; task_paid:=task_paid+amount; task_count:=task_count+1;
  END LOOP;
  UPDATE public.kq_staff_benefit_events SET details=jsonb_build_object('taskId',task->>'id','paidCents',task_paid,'paidCount',task_count,
   'skippedReason',CASE WHEN eligible_count=0 THEN 'no-eligible-documents' WHEN blocked THEN 'budget-or-reserve'
    WHEN eligible_count>task_count AND capacity=0 THEN 'capacity-reached' ELSE NULL END)
   WHERE user_id=p_user AND event_key='administration-task:'||(task->>'id');
 END LOOP;
 IF changed THEN UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user; END IF;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_process_administration(UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;

-- Completion evidence is new; booked work and already recorded results remain
-- immutable. The three existing reservation guards keep every other term.
CREATE FUNCTION public.kq_staff_validate_task_results(p_user UUID,p_state JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous JSONB; task JSONB; old_task JSONB;
BEGIN
 SELECT state INTO previous FROM public.kq_staff_accounts WHERE user_id=p_user;
 FOR task IN SELECT t FROM jsonb_array_elements(p_state->'tasks') t LOOP
  SELECT t INTO old_task FROM jsonb_array_elements(previous->'tasks') t WHERE t->>'id'=task->>'id';
  IF task ? 'result' AND (jsonb_typeof(task->'result') IS DISTINCT FROM 'object'
   OR task#>'{result,version}' IS DISTINCT FROM '1'::JSONB OR task->>'status' IS DISTINCT FROM 'completed')
  THEN RAISE EXCEPTION 'staff_changed'; END IF;
  IF old_task IS NOT NULL AND task->'result' IS DISTINCT FROM old_task->'result'
   AND (old_task->>'status' IS DISTINCT FROM 'running' OR task->>'status' IS DISTINCT FROM 'completed')
  THEN RAISE EXCEPTION 'staff_changed'; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_validate_task_results(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE body TEXT; signature TEXT; anchor TEXT:='-''status''-''outcome'''; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.kq_staff_validate_weekly_plan(uuid,jsonb,jsonb,integer)',
  'public.kq_culture_work_validate_staff(uuid,jsonb)','public.kq_processing_work_validate_staff(uuid,jsonb)'] LOOP
  body:=pg_get_functiondef(signature::regprocedure);
  IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>2 THEN RAISE EXCEPTION 'staff_result_guard_drift: %',signature; END IF;
  EXECUTE replace(body,anchor,anchor||'-''result''');
 END LOOP;
END $$;

-- Patch only known anchors in the complete current implementation, preserving
-- contract lifecycle, archives, weekly plans, work ledgers and receipt replay.
CREATE FUNCTION pg_temp.kq_staff_benefit_patch(p_before TEXT,p_after TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE body TEXT;
BEGIN
 body:=replace(pg_get_functiondef('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure),E'\r\n',E'\n');
 IF (length(body)-length(replace(body,p_before,'')))/length(p_before)<>1 THEN RAISE EXCEPTION 'staff_benefit_patch_drift: %',p_before; END IF;
 EXECUTE replace(body,p_before,p_after);
END $$;
SELECT pg_temp.kq_staff_benefit_patch('''set-weekly-plan'',''settle''','''set-weekly-plan'',''set-administration-rules'',''settle''');
SELECT pg_temp.kq_staff_benefit_patch('IF account.revision<>p_expected_revision THEN RAISE EXCEPTION ''staff_changed''; END IF;',
 'IF account.revision<>p_expected_revision THEN RAISE EXCEPTION ''staff_changed''; END IF;'||E'\n PERFORM public.kq_staff_validate_administration(p_user_id,p_command,p_state,p_debit_cents);\n PERFORM public.kq_staff_validate_task_results(p_user_id,p_state);');
SELECT pg_temp.kq_staff_benefit_patch('UPDATE public.kq_social_platforms SET followers=instagram_count+delta',
 'PERFORM public.kq_staff_benefit_record(p_user_id,''communication:''||p_request_key||'':''||gen_random_uuid(),''communication'',0,GREATEST(0,delta));'||E'\n    UPDATE public.kq_social_platforms SET followers=instagram_count+delta');
SELECT pg_temp.kq_staff_benefit_patch('UPDATE public.kq_commerce_accounts SET shop_partners=shop_partners+delta',
 'PERFORM public.kq_staff_benefit_record(p_user_id,''sales:''||p_request_key||'':''||gen_random_uuid(),''sales'',0,GREATEST(0,delta));'||E'\n    UPDATE public.kq_commerce_accounts SET shop_partners=shop_partners+delta');
SELECT pg_temp.kq_staff_benefit_patch('UPDATE public.kq_commerce_batches SET processing_ready_at=GREATEST(now(),processing_ready_at-(effect->>''secondsSaved'')::INTEGER*interval ''1 second'')',
 $patch$PERFORM public.kq_staff_benefit_record(p_user_id,'processing-time:'||p_request_key||':'||gen_random_uuid(),'processing-time',0,
    LEAST((effect->>'secondsSaved')::NUMERIC,extract(epoch FROM b.processing_ready_at-now())))
    FROM public.kq_commerce_batches b WHERE b.flower_id=(effect->>'flowerId')::UUID AND b.user_id=p_user_id
     AND b.processing_started_at<=now() AND b.processing_ready_at>now()
     AND NOT EXISTS(SELECT 1 FROM public.kq_processing_jobs j WHERE j.flower_id=b.flower_id);
   UPDATE public.kq_commerce_batches SET processing_ready_at=GREATEST(now(),processing_ready_at-(effect->>'secondsSaved')::INTEGER*interval '1 second')$patch$);
SELECT pg_temp.kq_staff_benefit_patch('IF (payment->>''paidCents'')::INTEGER IS DISTINCT FROM invoice.remaining_cents THEN RAISE EXCEPTION ''staff_changed''; END IF;',
 'IF (payment->>''paidCents'')::INTEGER IS DISTINCT FROM invoice.remaining_cents THEN RAISE EXCEPTION ''staff_changed''; END IF;'||E'\n   PERFORM public.kq_staff_benefit_record(p_user_id,''manual-supplier:''||p_request_key,''supplier-payment'',invoice.remaining_cents);');
SELECT pg_temp.kq_staff_benefit_patch('result:=public.kq_staff_snapshot(p_user_id)||jsonb_build_object(''replayed'',false);',
 'PERFORM public.kq_staff_process_administration(p_user_id,account.state,p_state);'||E'\n result:=public.kq_staff_snapshot(p_user_id)||jsonb_build_object(''replayed'',false);');
DROP FUNCTION pg_temp.kq_staff_benefit_patch(TEXT,TEXT);
REVOKE ALL ON FUNCTION public.rpc_kq_staff_commit(UUID,INTEGER,UUID,JSONB,JSONB,INTEGER,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_staff_commit(UUID,INTEGER,UUID,JSONB,JSONB,INTEGER,JSONB) TO service_role;

COMMIT;
