BEGIN;

-- Fictional economy. Existing inventory, supplier receipts and immutable
-- culture quotes retain their original price. Only additional units change.
ALTER FUNCTION public.kq_warehouse_device(TEXT) RENAME TO kq_warehouse_device_before_climate_billing;
CREATE FUNCTION public.kq_warehouse_device(p_code TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT spec||CASE WHEN price IS NULL THEN '{}'::JSONB ELSE jsonb_build_object('priceCents',price) END
 FROM (SELECT public.kq_warehouse_device_before_climate_billing(p_code) spec) s
 LEFT JOIN (VALUES ('SJ-DRYIT90',14900),('SIM-DRYING-02',69900),('SIM-DRYING-03',249900),
  ('LP-SUPER-1L',2990),('BROR-JARS-48',64900),('CURTEC-60L',89900),
  ('SIM-STORAGE-CLIMATE-01',49900),('SIM-STORAGE-CLIMATE-02',179900),('SIM-STORAGE-CLIMATE-03',499900)) p(code,price)
 ON p.code=p_code;
$$;

-- Installed storage area is billed even when no culture is running. Devices
-- held in reserve consume nothing. One game month is 120 real hours.
CREATE FUNCTION public.kq_storage_climate_quote(p_state JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 WITH rated AS (SELECT CASE p_state->>'storageClimateCode'
  WHEN 'SIM-STORAGE-CLIMATE-01' THEN 6 WHEN 'SIM-STORAGE-CLIMATE-02' THEN 12
  WHEN 'SIM-STORAGE-CLIMATE-03' THEN 24 ELSE 0 END kwh),
 area AS (SELECT COALESCE(sum((z->>'width')::NUMERIC*(z->>'height')::NUMERIC),0) m2
  FROM jsonb_array_elements(COALESCE(p_state->'serviceZones','[]'::JSONB)) z WHERE z->>'kind'='storage')
 SELECT jsonb_build_object('code',CASE WHEN kwh>0 AND m2>0 THEN p_state->>'storageClimateCode' END,
  'areaM2',CASE WHEN kwh>0 THEN m2 ELSE 0 END,'kwhPerM2Month',kwh,'tariffCentsPerKwh',25,
  'monthlyKwh',m2*kwh,'monthlyCostCents',round(m2*kwh*25)) FROM rated CROSS JOIN area;
$$;

-- Future cultures exclude this monthly utility. Preserve the historical
-- validator for already quoted cultures; version 2 has no climate surcharge.
ALTER FUNCTION public.kq_warehouse_catalog_projection(JSONB) RENAME TO kq_warehouse_catalog_before_monthly_climate;
CREATE FUNCTION public.kq_warehouse_catalog_projection(p_state JSONB) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
BEGIN
 PERFORM public.kq_warehouse_catalog_before_monthly_climate(p_state);
 RETURN public.kq_warehouse_catalog_before_postharvest(p_state);
END $$;
ALTER FUNCTION public.kq_warehouse_validate_postharvest_run(JSONB) RENAME TO kq_warehouse_validate_before_monthly_climate;
CREATE FUNCTION public.kq_warehouse_validate_postharvest_run(p_warehouse JSONB) RETURNS VOID
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE selected JSONB; expected JSONB; field TEXT;
BEGIN
 IF NOT(p_warehouse ? 'climateBillingVersion') THEN
  PERFORM public.kq_warehouse_validate_before_monthly_climate(p_warehouse); RETURN;
 END IF;
 IF p_warehouse->'climateBillingVersion' IS DISTINCT FROM '2'::JSONB THEN RAISE EXCEPTION 'warehouse_climate_billing_version_invalid'; END IF;
 PERFORM public.kq_warehouse_catalog_projection(p_warehouse->'sourceState');
 selected:=jsonb_set((p_warehouse->'sourceState')-'storageClimateCode','{zones}',p_warehouse->'zones')||'{"serviceZones":[]}'::JSONB;
 expected:=public.kq_warehouse_catalog_before_postharvest(selected);
 FOREACH field IN ARRAY ARRAY['powerWatts','energyKwh','energyCostCents'] LOOP
  IF p_warehouse->field IS DISTINCT FROM expected->field THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.kq_warehouse_validate_catalog_run(p_warehouse JSONB) RETURNS VOID
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE expected JSONB; field TEXT;
BEGIN
 IF p_warehouse ? 'climateBillingVersion' AND p_warehouse->'climateBillingVersion' IS DISTINCT FROM '2'::JSONB
 THEN RAISE EXCEPTION 'warehouse_climate_billing_version_invalid'; END IF;
 expected:=CASE WHEN p_warehouse ? 'climateBillingVersion' THEN public.kq_warehouse_catalog_projection(p_warehouse->'sourceState')
  ELSE public.kq_warehouse_catalog_before_monthly_climate(p_warehouse->'sourceState') END;
 IF (p_warehouse->'sourceState'->>'preparedAreaM2')::NUMERIC<(expected->>'allocatedAreaM2')::NUMERIC THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 FOREACH field IN ARRAY ARRAY['powerWatts','energyKwh','energyCostCents'] LOOP
  IF p_warehouse->field IS DISTINCT FROM expected->field THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 END LOOP;
END $$;

CREATE TABLE public.kq_storage_climate_accounts (
 user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 code TEXT CHECK(code IS NULL OR code IN ('SIM-STORAGE-CLIMATE-01','SIM-STORAGE-CLIMATE-02','SIM-STORAGE-CLIMATE-03')),
 area_m2 NUMERIC NOT NULL DEFAULT 0 CHECK(area_m2 BETWEEN 0 AND 1000),
 monthly_cents NUMERIC NOT NULL DEFAULT 0 CHECK(monthly_cents BETWEEN 0 AND 600000),
 period_started_at TIMESTAMPTZ NOT NULL,
 next_billing_at TIMESTAMPTZ NOT NULL,
 settled_at TIMESTAMPTZ NOT NULL,
 accrued_cents NUMERIC NOT NULL DEFAULT 0 CHECK(accrued_cents>=0),
 transition_credit_cents INTEGER NOT NULL DEFAULT 0 CHECK(transition_credit_cents>=0),
 initial_transition_credit_cents INTEGER NOT NULL DEFAULT 0 CHECK(initial_transition_credit_cents>=transition_credit_cents),
 CHECK(next_billing_at=period_started_at+interval '120 hours'),
 CHECK(settled_at>=period_started_at AND settled_at<=next_billing_at)
);
CREATE TABLE public.kq_storage_climate_invoices (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 period_started_at TIMESTAMPTZ NOT NULL,
 period_ended_at TIMESTAMPTZ NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 remaining_cents INTEGER NOT NULL CHECK(remaining_cents BETWEEN 0 AND amount_cents),
 last_paid_at TIMESTAMPTZ,
 UNIQUE(user_id,period_started_at),
 CHECK(period_ended_at=period_started_at+interval '120 hours')
);
CREATE INDEX kq_storage_climate_unpaid ON public.kq_storage_climate_invoices(user_id,period_ended_at,id) WHERE remaining_cents>0;
ALTER TABLE public.kq_storage_climate_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_storage_climate_invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_storage_climate_accounts,public.kq_storage_climate_invoices FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_storage_climate_invoice_accounting() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM public.kq_treasury_initialize(NEW.user_id);
  PERFORM public.kq_treasury_pair(NEW.user_id,'storage-climate-issued','storage-climate-issued:'||NEW.id,NEW.period_ended_at,
   'expense_energy','energy_payable',NEW.amount_cents,'Climatisation du stockage');
 ELSIF NEW.remaining_cents<OLD.remaining_cents THEN
  PERFORM public.kq_treasury_pair(NEW.user_id,'storage-climate-paid','storage-climate-paid:'||NEW.id||':'||NEW.remaining_cents,
   COALESCE(NEW.last_paid_at,now()),'energy_payable','suspense',OLD.remaining_cents-NEW.remaining_cents,'Climatisation du stockage');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_storage_climate_invoice_accounting BEFORE INSERT OR UPDATE OF remaining_cents ON public.kq_storage_climate_invoices
 FOR EACH ROW EXECUTE FUNCTION public.kq_storage_climate_invoice_accounting();

-- Common collector for monthly due dates, the existing electricity payment,
-- and sale deductions. Online sales already own the eventual wallet update.
CREATE FUNCTION public.kq_storage_climate_collect(p_user UUID,p_budget INTEGER,p_at TIMESTAMPTZ,p_debit BOOLEAN DEFAULT true) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE budget INTEGER:=GREATEST(0,COALESCE(p_budget,0)); paid INTEGER:=0; part INTEGER; cash INTEGER; invoice RECORD;
BEGIN
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 IF p_debit THEN budget:=LEAST(budget,GREATEST(0,COALESCE(cash,0))); END IF;
 FOR invoice IN SELECT * FROM public.kq_storage_climate_invoices WHERE user_id=p_user AND remaining_cents>0 AND period_ended_at<=p_at
  ORDER BY period_ended_at,id FOR UPDATE LOOP
  EXIT WHEN budget<=0;
  part:=LEAST(budget,invoice.remaining_cents); budget:=budget-part; paid:=paid+part;
  UPDATE public.kq_storage_climate_invoices SET remaining_cents=remaining_cents-part,last_paid_at=p_at WHERE id=invoice.id;
 END LOOP;
 IF paid>0 THEN
  IF p_debit THEN UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-paid,updated_at=p_at WHERE user_id=p_user; END IF;
  INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user,'storage-climate-paid',paid,p_at);
 END IF;
 RETURN paid;
END $$;

CREATE FUNCTION public.kq_storage_climate_settle_until(p_user UUID,p_until TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_storage_climate_accounts%ROWTYPE; stop_at TIMESTAMPTZ; amount INTEGER; elapsed NUMERIC; credit INTEGER;
BEGIN
 IF p_until IS NULL OR p_until>now() THEN RAISE EXCEPTION 'storage_climate_invalid_time'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO a FROM public.kq_storage_climate_accounts WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND OR p_until<=a.settled_at THEN RETURN; END IF;
 LOOP
  stop_at:=LEAST(p_until,a.next_billing_at);
  elapsed:=GREATEST(0,EXTRACT(EPOCH FROM(stop_at-a.settled_at)));
  a.accrued_cents:=a.accrued_cents+a.monthly_cents*elapsed/432000;
  a.settled_at:=stop_at;
  IF stop_at=a.next_billing_at THEN
   -- Carry fractional cents forward. Frequent reads and partial month
   -- changes therefore cannot erase or multiply the actual consumption.
   a.accrued_cents:=round(a.accrued_cents,8); amount:=floor(a.accrued_cents); a.accrued_cents:=a.accrued_cents-amount;
   credit:=LEAST(amount,a.transition_credit_cents); amount:=amount-credit; a.transition_credit_cents:=a.transition_credit_cents-credit;
   IF credit>0 THEN INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at)
    VALUES(p_user,'storage-climate-credit',credit,a.next_billing_at); END IF;
   IF amount>0 THEN
    INSERT INTO public.kq_storage_climate_invoices(user_id,period_started_at,period_ended_at,amount_cents,remaining_cents)
     VALUES(p_user,a.period_started_at,a.next_billing_at,amount,amount);
    INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user,'storage-climate-issued',amount,a.next_billing_at);
    PERFORM public.kq_storage_climate_collect(p_user,2147483647,a.next_billing_at);
   END IF;
   a.period_started_at:=a.next_billing_at; a.next_billing_at:=a.next_billing_at+interval '120 hours';
  END IF;
  EXIT WHEN stop_at>=p_until;
  -- A disabled room has no further consumption. Skip empty months without
  -- changing unpaid invoices or forgiving sub-cent residual consumption.
  IF a.monthly_cents=0 AND a.accrued_cents<1 THEN
   elapsed:=floor(EXTRACT(EPOCH FROM(p_until-a.period_started_at))/432000);
   a.period_started_at:=a.period_started_at+elapsed*interval '120 hours';
   a.next_billing_at:=a.period_started_at+interval '120 hours'; a.settled_at:=p_until; EXIT;
  END IF;
 END LOOP;
 UPDATE public.kq_storage_climate_accounts SET period_started_at=a.period_started_at,next_billing_at=a.next_billing_at,
  settled_at=a.settled_at,accrued_cents=a.accrued_cents,transition_credit_cents=a.transition_credit_cents WHERE user_id=p_user;
END $$;

CREATE FUNCTION public.kq_storage_climate_change(p_user UUID,p_state JSONB,p_at TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q JSONB:=public.kq_storage_climate_quote(p_state);
BEGIN
 PERFORM public.kq_storage_climate_settle_until(p_user,p_at);
 IF (q->>'monthlyCostCents')::NUMERIC>0 THEN
  INSERT INTO public.kq_storage_climate_accounts(user_id,code,area_m2,monthly_cents,period_started_at,next_billing_at,settled_at)
   VALUES(p_user,q->>'code',(q->>'areaM2')::NUMERIC,(q->>'monthlyCostCents')::NUMERIC,p_at,p_at+interval '120 hours',p_at)
   ON CONFLICT(user_id) DO NOTHING;
 END IF;
 UPDATE public.kq_storage_climate_accounts SET code=q->>'code',area_m2=(q->>'areaM2')::NUMERIC,
  monthly_cents=(q->>'monthlyCostCents')::NUMERIC WHERE user_id=p_user;
END $$;
CREATE FUNCTION public.kq_storage_climate_layout_changed() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' OR public.kq_storage_climate_quote(OLD.state) IS DISTINCT FROM public.kq_storage_climate_quote(NEW.state) THEN
  PERFORM public.kq_storage_climate_change(NEW.user_id,NEW.state,now());
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_warehouse_storage_climate_billing AFTER INSERT OR UPDATE OF state ON public.kq_warehouse_layouts
 FOR EACH ROW EXECUTE FUNCTION public.kq_storage_climate_layout_changed();

-- An active legacy culture will still issue its immutable electricity quote.
-- Offset only its already committed climate surcharge against future monthly
-- bills. The credit is never cash, cannot be replayed, and leaves that culture
-- and its eventual invoice unchanged. Completed old cycles earn no credit.
CREATE FUNCTION public.kq_storage_climate_legacy_credit(p_state JSONB) RETURNS INTEGER
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE w JSONB:=p_state->'warehouse'; selected JSONB; baseline JSONB;
BEGIN
 IF w IS NULL OR w ? 'climateBillingVersion' OR NOT(w->'sourceState' ? 'storageClimateCode') THEN RETURN 0; END IF;
 selected:=jsonb_set((w->'sourceState')-'storageClimateCode','{zones}',w->'zones')||'{"serviceZones":[]}'::JSONB;
 baseline:=public.kq_warehouse_catalog_before_postharvest(selected);
 RETURN GREATEST(0,(w->>'energyCostCents')::INTEGER-(baseline->>'energyCostCents')::INTEGER);
END $$;
INSERT INTO public.kq_storage_climate_accounts(user_id,code,area_m2,monthly_cents,period_started_at,next_billing_at,settled_at,
 transition_credit_cents,initial_transition_credit_cents)
 SELECT l.user_id,q->>'code',(q->>'areaM2')::NUMERIC,(q->>'monthlyCostCents')::NUMERIC,now(),now()+interval '120 hours',now(),
 COALESCE(credit.cents,0),COALESCE(credit.cents,0)
 FROM public.kq_warehouse_layouts l CROSS JOIN LATERAL public.kq_storage_climate_quote(l.state) q
 LEFT JOIN (SELECT user_id,sum(public.kq_storage_climate_legacy_credit(state))::INTEGER cents FROM public.kq_runs WHERE status::TEXT='active' GROUP BY user_id) credit USING(user_id)
 WHERE (q->>'monthlyCostCents')::NUMERIC>0 OR COALESCE(credit.cents,0)>0;

CREATE FUNCTION public.kq_storage_climate_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.kq_storage_climate_quote(l.state)||jsonb_build_object('version',1,
  'periodStartedAt',a.period_started_at,'nextBillingAt',CASE WHEN a.monthly_cents>0 OR a.accrued_cents>=1 THEN a.next_billing_at END,
  'accruedCents',floor(COALESCE(a.accrued_cents,0)+COALESCE(a.monthly_cents,0)*GREATEST(0,EXTRACT(EPOCH FROM(LEAST(now(),a.next_billing_at)-a.settled_at)))/432000),
  'outstandingCents',COALESCE((SELECT sum(remaining_cents) FROM public.kq_storage_climate_invoices WHERE user_id=p_user),0),
  'transitionCreditCents',COALESCE(a.transition_credit_cents,0),
  'invoices',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'periodStartedAt',i.period_started_at,'periodEndedAt',i.period_ended_at,
   'amountCents',i.amount_cents,'remainingCents',i.remaining_cents) ORDER BY i.period_ended_at DESC,i.id)
   FROM (SELECT * FROM public.kq_storage_climate_invoices WHERE user_id=p_user AND remaining_cents>0
    UNION ALL (SELECT * FROM public.kq_storage_climate_invoices WHERE user_id=p_user AND remaining_cents=0 ORDER BY period_ended_at DESC,id LIMIT 12)) i),'[]'::JSONB))
 FROM (SELECT p_user user_id) u LEFT JOIN public.kq_warehouse_layouts l USING(user_id) LEFT JOIN public.kq_storage_climate_accounts a USING(user_id);
$$;

CREATE FUNCTION pg_temp.kq_climate_patch(p_signature TEXT,p_before TEXT,p_after TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE body TEXT;
BEGIN
 SELECT replace(pg_get_functiondef(p_signature::regprocedure),E'\r\n',E'\n') INTO body;
 IF strpos(body,p_before)=0 THEN RAISE EXCEPTION 'climate_patch_drift: %: %',p_signature,p_before; END IF;
 EXECUTE replace(body,p_before,p_after);
END $$;

-- Monthly deadlines participate in the same deterministic timeline as VAT,
-- hosting, supplier invoices and online sales. A read is never the clock.
-- Reject a stale pre-migration client at the mutation boundary. Accepting its
-- old per-cycle quote here would add that surcharge to new monthly bills.
SELECT pg_temp.kq_climate_patch('public.kq_validate_warehouse_run_start(uuid,uuid,jsonb)',
 ' IF w->>''version'' IS DISTINCT FROM ''2'' THEN',
 ' IF w->''sourceState'' ? ''storageClimateCode'' AND w->''climateBillingVersion'' IS DISTINCT FROM ''2''::JSONB THEN RAISE EXCEPTION ''warehouse_layout_changed''; END IF; IF w->>''version'' IS DISTINCT FROM ''2'' THEN');
SELECT pg_temp.kq_climate_patch('public.kq_online_settle_until(uuid,timestamptz)',
 '  PERFORM public.kq_online_business_at(p_user,cursor_at);',
 '  PERFORM public.kq_online_business_at(p_user,cursor_at); PERFORM public.kq_storage_climate_settle_until(p_user,cursor_at);');
SELECT pg_temp.kq_climate_patch('public.kq_online_settle_until(uuid,timestamptz)',
 'public.kq_online_next_bank_event(p_user,cursor_at));',
 '(SELECT next_billing_at FROM public.kq_storage_climate_accounts WHERE user_id=p_user AND (monthly_cents>0 OR accrued_cents>=1)),public.kq_online_next_bank_event(p_user,cursor_at));');

ALTER FUNCTION public.kq_settle_energy(UUID,INTEGER) RENAME TO kq_settle_cycle_energy;
CREATE FUNCTION public.kq_settle_energy(p_user_id UUID,p_budget INTEGER) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE paid INTEGER;
BEGIN
 paid:=public.kq_settle_cycle_energy(p_user_id,p_budget);
 RETURN paid+public.kq_storage_climate_collect(p_user_id,GREATEST(0,p_budget-paid),now());
END $$;
SELECT pg_temp.kq_climate_patch('public.rpc_kq_pay_energy(uuid,uuid,integer)',
 'SELECT COALESCE(SUM(remaining_cents),0) INTO v_due FROM public.kq_energy_invoices WHERE user_id=p_user_id;',
 'SELECT COALESCE(SUM(remaining_cents),0)+(SELECT COALESCE(SUM(remaining_cents),0) FROM public.kq_storage_climate_invoices WHERE user_id=p_user_id) INTO v_due FROM public.kq_energy_invoices WHERE user_id=p_user_id;');
SELECT pg_temp.kq_climate_patch('public.kq_business_sale_preview(uuid,integer)',
 'FROM public.kq_energy_invoices WHERE user_id=p_user),0)',
 'FROM public.kq_energy_invoices WHERE user_id=p_user),0)+COALESCE((SELECT SUM(remaining_cents) FROM public.kq_storage_climate_invoices WHERE user_id=p_user),0)');
SELECT pg_temp.kq_climate_patch('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)',
 'q.energy_outstanding_cents<>(SELECT COALESCE(SUM(remaining_cents),0) FROM public.kq_energy_invoices WHERE user_id=p_user_id)',
 'q.energy_outstanding_cents<>(SELECT COALESCE(SUM(remaining_cents),0)+(SELECT COALESCE(SUM(remaining_cents),0) FROM public.kq_storage_climate_invoices WHERE user_id=p_user_id) FROM public.kq_energy_invoices WHERE user_id=p_user_id)');
SELECT pg_temp.kq_climate_patch('public.kq_online_collect(uuid,integer,timestamptz)',
 ' FOR inv IN SELECT id,remaining_cents FROM public.kq_supplier_invoices',
 ' part:=public.kq_storage_climate_collect(p_user,budget,p_at,false); budget:=budget-part; paid_energy:=paid_energy+part; FOR inv IN SELECT id,remaining_cents FROM public.kq_supplier_invoices');
SELECT pg_temp.kq_climate_patch('public.rpc_kq_treasury_snapshot(uuid,text,integer,integer)',
 '''energyDebtCents'',COALESCE((SELECT SUM(remaining_cents) FROM public.kq_energy_invoices WHERE user_id=p_user_id),0)',
 '''energyDebtCents'',COALESCE((SELECT SUM(remaining_cents) FROM public.kq_energy_invoices WHERE user_id=p_user_id),0)+COALESCE((SELECT SUM(remaining_cents) FROM public.kq_storage_climate_invoices WHERE user_id=p_user_id),0)');

ALTER FUNCTION public.rpc_kq_energy_snapshot(UUID) RENAME TO kq_energy_snapshot_before_storage_climate;
CREATE FUNCTION public.rpc_kq_energy_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous JSONB; climate JSONB;
BEGIN
 PERFORM public.kq_business_settle(p_user_id);
 previous:=public.kq_energy_snapshot_before_storage_climate(p_user_id); climate:=public.kq_storage_climate_snapshot(p_user_id);
 RETURN previous||jsonb_build_object('outstandingCents',(previous->>'outstandingCents')::BIGINT+(climate->>'outstandingCents')::BIGINT,
  'storageClimate',climate);
END $$;
ALTER FUNCTION public.kq_business_snapshot(UUID) RENAME TO kq_business_snapshot_before_storage_climate;
CREATE FUNCTION public.kq_business_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT prior||jsonb_build_object('storageClimate',climate,'nextEventAt',LEAST((prior->>'nextEventAt')::TIMESTAMPTZ,(climate->>'nextBillingAt')::TIMESTAMPTZ))
 FROM (SELECT public.kq_business_snapshot_before_storage_climate(p_user) prior,public.kq_storage_climate_snapshot(p_user) climate) x;
$$;
ALTER FUNCTION public.kq_warehouse_snapshot(UUID) RENAME TO kq_warehouse_snapshot_before_storage_climate;
CREATE FUNCTION public.kq_warehouse_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.kq_warehouse_snapshot_before_storage_climate(p_user_id)||jsonb_build_object('storageClimateBilling',public.kq_storage_climate_snapshot(p_user_id));
$$;
SELECT pg_temp.kq_climate_patch('public.rpc_kq_warehouse_snapshot(uuid)',
 '  RETURN public.kq_warehouse_snapshot(p_user_id);',
 '  PERFORM public.kq_business_settle(p_user_id); RETURN public.kq_warehouse_snapshot(p_user_id);');

REVOKE ALL ON FUNCTION public.kq_warehouse_device_before_climate_billing(TEXT),public.kq_warehouse_device(TEXT),
 public.kq_storage_climate_quote(JSONB),public.kq_warehouse_catalog_before_monthly_climate(JSONB),
 public.kq_warehouse_catalog_projection(JSONB),public.kq_warehouse_validate_before_monthly_climate(JSONB),
 public.kq_warehouse_validate_postharvest_run(JSONB),public.kq_warehouse_validate_catalog_run(JSONB),
 public.kq_storage_climate_invoice_accounting(),public.kq_storage_climate_collect(UUID,INTEGER,TIMESTAMPTZ,BOOLEAN),
 public.kq_storage_climate_settle_until(UUID,TIMESTAMPTZ),public.kq_storage_climate_change(UUID,JSONB,TIMESTAMPTZ),
 public.kq_storage_climate_layout_changed(),public.kq_storage_climate_snapshot(UUID),public.kq_settle_cycle_energy(UUID,INTEGER),
 public.kq_storage_climate_legacy_credit(JSONB),
 public.kq_settle_energy(UUID,INTEGER),public.kq_energy_snapshot_before_storage_climate(UUID),
 public.rpc_kq_energy_snapshot(UUID),public.kq_business_snapshot_before_storage_climate(UUID),public.kq_business_snapshot(UUID),
 public.kq_warehouse_snapshot_before_storage_climate(UUID),public.kq_warehouse_snapshot(UUID)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_energy_snapshot(UUID) TO service_role;
DROP FUNCTION pg_temp.kq_climate_patch(TEXT,TEXT,TEXT);
COMMIT;
