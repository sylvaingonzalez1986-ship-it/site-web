BEGIN;

-- Accrual accounts for the simulation: gross salary, employer charges and
-- contract-end indemnities become an expense when the payroll falls due.
CREATE FUNCTION pg_temp.kq_staff_accounting_patch(p_signature TEXT,p_before TEXT,p_after TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE body TEXT;
BEGIN
 SELECT replace(pg_get_functiondef(p_signature::regprocedure),E'\r\n',E'\n') INTO body;
 IF (length(body)-length(replace(body,p_before,'')))/length(p_before)<>1 THEN RAISE EXCEPTION 'staff_accounting_patch_drift: %',p_signature; END IF;
 EXECUTE replace(body,p_before,p_after);
END $$;
SELECT pg_temp.kq_staff_accounting_patch('public.kq_treasury_post(uuid,text,text,timestamptz,jsonb,text)',
 '''supplier_payable''','''supplier_payable'',''staff_payable''');
SELECT pg_temp.kq_staff_accounting_patch('public.kq_treasury_balances_at(uuid,timestamptz,boolean)',
 '''lab_payable'',''energy_payable''','''lab_payable'',''staff_payable'',''energy_payable''');

CREATE FUNCTION public.kq_staff_debt(p_user UUID) RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT COALESCE(SUM((item->>'totalCents')::BIGINT-(item->>'paidCents')::BIGINT),0)::BIGINT
 FROM public.kq_staff_accounts a CROSS JOIN LATERAL jsonb_array_elements(a.state->'payroll') item WHERE a.user_id=p_user;
$$;
REVOKE ALL ON FUNCTION public.kq_staff_debt(UUID) FROM PUBLIC,anon,authenticated,service_role;
SELECT pg_temp.kq_staff_accounting_patch('public.rpc_kq_treasury_snapshot(uuid,text,integer,integer)',
 '''labDebtCents'',COALESCE','''staffDebtCents'',public.kq_staff_debt(p_user_id),''labDebtCents'',COALESCE');

CREATE FUNCTION public.kq_staff_payroll_accounting() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE row JSONB; previous JSONB; old_rows JSONB; current_rows JSONB; field TEXT;
 amount BIGINT; paid BIGINT; old_paid BIGINT; due TIMESTAMPTZ; started TIMESTAMPTZ;
BEGIN
 IF NEW.state IS NULL THEN RETURN NEW; END IF;
 SELECT COALESCE(jsonb_object_agg(item->>'id',item),'{}'::JSONB) INTO current_rows FROM jsonb_array_elements(NEW.state->'payroll') item;
 IF (SELECT count(*) FROM jsonb_object_keys(current_rows))<>jsonb_array_length(NEW.state->'payroll') THEN RAISE EXCEPTION 'staff_payroll_invalid'; END IF;
 IF TG_OP='UPDATE' THEN
  SELECT COALESCE(jsonb_object_agg(item->>'id',item),'{}'::JSONB) INTO old_rows FROM jsonb_array_elements(OLD.state->'payroll') item;
 ELSE old_rows:='{}'::JSONB; END IF;
 -- Paid history can be compacted by the engine; an outstanding debt cannot.
 IF EXISTS(SELECT 1 FROM jsonb_each(old_rows) prior WHERE (prior.value->>'paidCents')::BIGINT<(prior.value->>'totalCents')::BIGINT
  AND NOT current_rows ? prior.key) THEN RAISE EXCEPTION 'staff_payroll_changed'; END IF;
 PERFORM public.kq_treasury_initialize(NEW.user_id);
 SELECT started_at INTO started FROM public.kq_treasury_accounts WHERE user_id=NEW.user_id;
 FOR row IN SELECT value FROM jsonb_each(current_rows) LOOP
  IF length(COALESCE(row->>'id','')) NOT BETWEEN 1 AND 200 OR jsonb_typeof(row->'dueAt') IS DISTINCT FROM 'string'
   OR (row->>'dueAt')::TIMESTAMPTZ>now()+interval '1 second' THEN RAISE EXCEPTION 'staff_payroll_invalid'; END IF;
  FOREACH field IN ARRAY ARRAY['grossCents','employerCents','indemnityCents','totalCents','paidCents'] LOOP
   IF jsonb_typeof(row->field) IS DISTINCT FROM 'number' OR COALESCE(row->>field,'') !~ '^[0-9]{1,13}$'
   THEN RAISE EXCEPTION 'staff_payroll_invalid'; END IF;
  END LOOP;
  amount:=(row->>'totalCents')::BIGINT; paid:=(row->>'paidCents')::BIGINT;
  IF amount<>(row->>'grossCents')::BIGINT+(row->>'employerCents')::BIGINT+(row->>'indemnityCents')::BIGINT
   OR paid>amount THEN RAISE EXCEPTION 'staff_payroll_invalid'; END IF;
  previous:=old_rows->(row->>'id'); old_paid:=COALESCE((previous->>'paidCents')::BIGINT,0);
  IF previous IS NOT NULL AND (previous-'paidCents' IS DISTINCT FROM row-'paidCents' OR paid<old_paid)
   THEN RAISE EXCEPTION 'staff_payroll_changed'; END IF;
  IF previous IS NULL THEN
   due:=GREATEST(started,(row->>'dueAt')::TIMESTAMPTZ);
   PERFORM public.kq_treasury_pair(NEW.user_id,'staff-issued','staff-issued:'||(row->>'id'),due,
    'expense_other','staff_payable',amount,'Salaires, charges et indemnités · '||(row->>'id'));
  END IF;
  IF paid>old_paid THEN
   -- The wallet observer is the only cash posting. This clears its suspense.
   PERFORM public.kq_treasury_pair(NEW.user_id,'staff-paid','staff-paid:'||(row->>'id')||':'||paid,now(),
    'staff_payable','suspense',paid-old_paid,'Paie réglée · '||(row->>'id'));
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_payroll_accounting() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_staff_payroll_accounting BEFORE INSERT OR UPDATE OF state ON public.kq_staff_accounts
 FOR EACH ROW EXECUTE FUNCTION public.kq_staff_payroll_accounting();

-- A payroll payment must match the exact increase in paid payroll. Other staff
-- commands may accrue new debt, but cannot silently settle it without cash.
CREATE FUNCTION public.kq_staff_paid_delta(p_before JSONB,p_after JSONB) RETURNS BIGINT
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT COALESCE(SUM((next->>'paidCents')::BIGINT-COALESCE((previous->>'paidCents')::BIGINT,0)),0)::BIGINT
 FROM jsonb_array_elements(p_after->'payroll') next
 LEFT JOIN LATERAL (SELECT old AS previous FROM jsonb_array_elements(p_before->'payroll') old WHERE old->>'id'=next->>'id') old ON true;
$$;
REVOKE ALL ON FUNCTION public.kq_staff_paid_delta(JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;
SELECT pg_temp.kq_staff_accounting_patch('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)',
 'IF cash<p_debit_cents THEN RAISE EXCEPTION ''staff_cash''; END IF;',
 $patch$IF (p_command->>'action'='payroll' AND (p_command->'expectedCents' IS DISTINCT FROM to_jsonb(p_debit_cents)
  OR public.kq_staff_paid_delta(account.state,p_state)<>p_debit_cents))
  OR (p_command->>'action'<>'payroll' AND public.kq_staff_paid_delta(account.state,p_state)<>0)
 THEN RAISE EXCEPTION 'staff_payroll_changed'; END IF;
 IF cash<p_debit_cents THEN RAISE EXCEPTION 'staff_cash'; END IF;$patch$);
SELECT pg_temp.kq_staff_accounting_patch('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)',
 $patch$PERFORM public.kq_treasury_pair(p_user_id,'staff-cost','staff-cost:'||p_request_key::TEXT,now(),
   'expense_other','suspense',p_debit_cents,'Personnel · '||(p_command->>'action'));$patch$,
 $patch$IF p_command->>'action'<>'payroll' THEN
  PERFORM public.kq_treasury_pair(p_user_id,'staff-cost','staff-cost:'||p_request_key::TEXT,now(),
   'expense_other','suspense',p_debit_cents,'Personnel · '||(p_command->>'action')); END IF;$patch$);

-- If this extension follows already-used Personnel, only still-unpaid amounts
-- become new expenses. Past paid payroll was already expensed by staff-cost.
DO $$ DECLARE account RECORD; row JSONB; BEGIN
 FOR account IN SELECT user_id,state FROM public.kq_staff_accounts WHERE state IS NOT NULL LOOP
  PERFORM public.kq_treasury_initialize(account.user_id);
  FOR row IN SELECT value FROM jsonb_array_elements(account.state->'payroll') LOOP
   PERFORM public.kq_treasury_pair(account.user_id,'staff-issued','staff-issued:'||(row->>'id'),now(),
    'expense_other','staff_payable',(row->>'totalCents')::BIGINT-(row->>'paidCents')::BIGINT,
    'Salaires restant dus à l’ouverture · '||(row->>'id'));
  END LOOP;
 END LOOP;
END $$;
DROP FUNCTION pg_temp.kq_staff_accounting_patch(TEXT,TEXT,TEXT);
COMMIT;
