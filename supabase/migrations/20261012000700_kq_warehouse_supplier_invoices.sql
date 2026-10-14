BEGIN;

-- Consumables are delivered when a new warehouse campaign starts. Payment is
-- due after 30 game days (120 real hours), independently of its later outcome.
CREATE TABLE public.kq_supplier_invoices (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 run_id UUID NOT NULL UNIQUE REFERENCES public.kq_runs(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 due_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '120 hours',
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 remaining_cents INTEGER NOT NULL CHECK(remaining_cents BETWEEN 0 AND amount_cents),
 due_processed_at TIMESTAMPTZ,
 last_paid_at TIMESTAMPTZ,
 CHECK(due_at>=issued_at)
);
CREATE INDEX kq_supplier_due ON public.kq_supplier_invoices(user_id,due_at,id) WHERE remaining_cents>0;
ALTER TABLE public.kq_supplier_invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_supplier_invoices FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.kq_market_sale_receipts ADD COLUMN supplier_paid_cents INTEGER NOT NULL DEFAULT 0 CHECK(supplier_paid_cents>=0);
ALTER TABLE public.kq_online_sales ADD COLUMN supplier_paid_cents INTEGER NOT NULL DEFAULT 0 CHECK(supplier_paid_cents>=0);

-- Every source edit checks its anchor. Preserve all previous run, storage,
-- maintenance and commerce guards, including historical idempotent receipts.
CREATE FUNCTION pg_temp.kq_supplier_patch(p_signature TEXT,p_before TEXT,p_after TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE body TEXT;
BEGIN
 SELECT replace(pg_get_functiondef(p_signature::regprocedure),E'\r\n',E'\n') INTO body;
 IF strpos(body,p_before)=0 THEN RAISE EXCEPTION 'supplier_patch_drift: %: %',p_signature,p_before; END IF;
 EXECUTE replace(body,p_before,p_after);
END $$;

SELECT pg_temp.kq_supplier_patch('public.kq_treasury_post(uuid,text,text,timestamptz,jsonb,text)',
 '''lab_payable'',''energy_payable''','''lab_payable'',''supplier_payable'',''energy_payable''');
-- Do not add a zero-valued, unknown account to old clients with no supplier
-- invoice. Once used, the account remains visible even when fully settled.
SELECT pg_temp.kq_supplier_patch('public.kq_treasury_balances_at(uuid,timestamptz,boolean)',
 'FROM names LEFT JOIN',
 'FROM (SELECT account FROM names UNION ALL SELECT ''supplier_payable'' WHERE EXISTS(SELECT 1 FROM public.kq_supplier_invoices WHERE user_id=p_user)) names LEFT JOIN');
SELECT pg_temp.kq_supplier_patch('public.rpc_kq_treasury_snapshot(uuid,text,integer,integer)',
 '''labDebtCents'',COALESCE',
 '''supplierDebtCents'',COALESCE((SELECT SUM(remaining_cents) FROM public.kq_supplier_invoices WHERE user_id=p_user_id),0),''labDebtCents'',COALESCE');
SELECT pg_temp.kq_supplier_patch('public.kq_treasury_stock_cost(uuid)',
 'LEFT JOIN public.kq_lab_invoices lab ON lab.run_id=f.run_id',
 'LEFT JOIN public.kq_supplier_invoices supplier ON supplier.run_id=f.run_id LEFT JOIN public.kq_lab_invoices lab ON lab.run_id=f.run_id');
SELECT pg_temp.kq_supplier_patch('public.kq_treasury_stock_cost(uuid)',
 'COALESCE(lab.amount_cents,0)+COALESCE(energy.total_cents,0)',
 'COALESCE(supplier.amount_cents,0)+COALESCE(lab.amount_cents,0)+COALESCE(energy.total_cents,0)');

CREATE FUNCTION public.kq_supplier_invoice_accounting() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  -- Initialize before the debt exists: opening balances must not double count
  -- this first invoice. This trigger and the delivery are one transaction.
  PERFORM public.kq_treasury_initialize(NEW.user_id);
  PERFORM public.kq_treasury_pair(NEW.user_id,'supplier-issued','supplier-issued:'||NEW.run_id,NEW.issued_at,
   'expense_other','supplier_payable',NEW.amount_cents,NEW.id::TEXT);
 ELSIF NEW.remaining_cents<OLD.remaining_cents THEN
  -- Wallet observers already record cash against suspense. Settle only the
  -- payable counterpart here, never another expense or another cash entry.
  PERFORM public.kq_treasury_pair(NEW.user_id,'supplier-paid','supplier-paid:'||NEW.id||':'||NEW.remaining_cents,
   COALESCE(NEW.last_paid_at,now()),'supplier_payable','suspense',OLD.remaining_cents-NEW.remaining_cents,NEW.id::TEXT);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_supplier_invoice_accounting BEFORE INSERT OR UPDATE OF remaining_cents ON public.kq_supplier_invoices
 FOR EACH ROW EXECUTE FUNCTION public.kq_supplier_invoice_accounting();

CREATE FUNCTION public.kq_invoice_warehouse_consumables() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cost INTEGER;
BEGIN
 IF NEW.status::TEXT<>'active' OR NOT (NEW.state ? 'warehouse') THEN RETURN NEW; END IF;
 cost:=(NEW.state->'warehouse'->>'consumablesCostCents')::INTEGER;
 IF cost>0 THEN
  INSERT INTO public.kq_supplier_invoices(run_id,user_id,amount_cents,remaining_cents)
  VALUES(NEW.id,NEW.user_id,cost,cost) ON CONFLICT(run_id) DO NOTHING;
  IF FOUND THEN
   INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents) VALUES(NEW.user_id,'supplier-issued',cost);
   UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=NEW.user_id;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_invoice_warehouse_consumables AFTER INSERT ON public.kq_runs
 FOR EACH ROW EXECUTE FUNCTION public.kq_invoice_warehouse_consumables();
SELECT pg_temp.kq_supplier_patch('public.kq_validate_warehouse_run_start(uuid,uuid,jsonb)',
 $old$ IF consumables>cash THEN RAISE EXCEPTION 'warehouse_consumables_cash'; END IF;
 IF consumables>0 THEN
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-consumables,updated_at=now() WHERE user_id=p_user;
  PERFORM public.kq_treasury_pair(p_user,'warehouse-consumables','warehouse-consumables:'||p_run::TEXT,now(),'expense_other','suspense',consumables,p_run::TEXT);
 END IF;$old$,
 ' -- The AFTER INSERT trigger invoices validated inputs; no cash or debt gate.');

CREATE FUNCTION public.kq_supplier_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH visible AS (
  SELECT * FROM public.kq_supplier_invoices WHERE user_id=p_user AND remaining_cents>0
  UNION ALL
  (SELECT * FROM public.kq_supplier_invoices WHERE user_id=p_user AND remaining_cents=0 ORDER BY last_paid_at DESC NULLS LAST,id LIMIT 30)
 ) SELECT jsonb_build_object('outstandingCents',COALESCE(sum(remaining_cents),0),
  'overdueCents',COALESCE(sum(remaining_cents) FILTER(WHERE due_at<=now()),0),
  'invoices',COALESCE(jsonb_agg(jsonb_build_object('id',id,'runId',run_id,'issuedAt',issued_at,'dueAt',due_at,
   'amountCents',amount_cents,'remainingCents',remaining_cents) ORDER BY due_at,id),'[]'::JSONB)) FROM visible;
$$;
ALTER FUNCTION public.kq_business_snapshot(UUID) RENAME TO kq_supplier_previous_business_snapshot;
CREATE FUNCTION public.kq_business_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT prior||jsonb_build_object('suppliers',public.kq_supplier_snapshot(p_user),'nextEventAt',LEAST((prior->>'nextEventAt')::TIMESTAMPTZ,
  (SELECT min(due_at) FROM public.kq_supplier_invoices WHERE user_id=p_user AND remaining_cents>0 AND due_processed_at IS NULL)))
 FROM (SELECT public.kq_supplier_previous_business_snapshot(p_user) prior) x;
$$;
SELECT pg_temp.kq_supplier_patch('public.rpc_kq_energy_snapshot(uuid)',
 '''outstandingCents'',COALESCE',
 $new$'supplierInvoice',(SELECT jsonb_build_object('id',s.id,'runId',s.run_id,'issuedAt',s.issued_at,'dueAt',s.due_at,
 'amountCents',s.amount_cents,'remainingCents',s.remaining_cents) FROM public.kq_supplier_invoices s
 JOIN public.kq_runs r ON r.id=s.run_id WHERE s.user_id=p_user_id AND r.status::TEXT='active' ORDER BY s.issued_at DESC,s.id LIMIT 1),
 'outstandingCents',COALESCE$new$);

-- One due-date attempt uses the cash actually available at that instant. The
-- unpaid balance is marked processed, then awaits manual payment or sales;
-- ordinary polling cannot repeatedly drain a player's wallet.
SELECT pg_temp.kq_supplier_patch('public.kq_online_business_at(uuid,timestamptz)',
 'lab_at TIMESTAMPTZ;', 'lab_at TIMESTAMPTZ; supplier_at TIMESTAMPTZ; supplier RECORD; supplier_part INTEGER;');
SELECT pg_temp.kq_supplier_patch('public.kq_online_business_at(uuid,timestamptz)',
 'event_at:=LEAST(a.vat_next_settlement_at,',
 'SELECT min(due_at) INTO supplier_at FROM public.kq_supplier_invoices WHERE user_id=p_user AND remaining_cents>0 AND due_processed_at IS NULL; event_at:=LEAST(supplier_at,a.vat_next_settlement_at,');
SELECT pg_temp.kq_supplier_patch('public.kq_online_business_at(uuid,timestamptz)',
 '  IF NOT a.shop_suspended AND a.shop_paid_until=event_at THEN',
 $new$  FOR supplier IN SELECT * FROM public.kq_supplier_invoices WHERE user_id=p_user AND due_at=event_at AND remaining_cents>0 AND due_processed_at IS NULL ORDER BY id FOR UPDATE LOOP
   supplier_part:=LEAST(GREATEST(0,cash),supplier.remaining_cents); cash:=cash-supplier_part;
   UPDATE public.kq_supplier_invoices SET remaining_cents=remaining_cents-supplier_part,due_processed_at=event_at,
    last_paid_at=CASE WHEN supplier_part>0 THEN event_at ELSE last_paid_at END WHERE id=supplier.id;
   IF supplier_part>0 THEN INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user,'supplier-paid',supplier_part,event_at); END IF;
  END LOOP;
  IF NOT a.shop_suspended AND a.shop_paid_until=event_at THEN$new$);
SELECT pg_temp.kq_supplier_patch('public.kq_online_settle_until(uuid,timestamptz)',
 '   public.kq_online_next_bank_event(p_user,cursor_at));',
 '   (SELECT min(due_at) FROM public.kq_supplier_invoices WHERE user_id=p_user AND remaining_cents>0 AND due_processed_at IS NULL),public.kq_online_next_bank_event(p_user,cursor_at));');

CREATE OR REPLACE FUNCTION public.kq_business_sale_preview(p_user UUID,p_payout INTEGER) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH tax AS (SELECT (ROUND((vat_sales_ttc_cents+p_payout)::NUMERIC/6)-ROUND(vat_sales_ttc_cents::NUMERIC/6))::INTEGER vat FROM public.kq_commerce_accounts WHERE user_id=p_user),
 lab AS (SELECT vat,LEAST((p_payout-vat)/2,COALESCE((SELECT SUM(remaining_cents) FROM public.kq_lab_invoices WHERE user_id=p_user AND due_at<=now()),0))::INTEGER paid FROM tax),
 energy AS (SELECT vat,paid,LEAST((p_payout-vat)/2-paid,COALESCE((SELECT SUM(remaining_cents) FROM public.kq_energy_invoices WHERE user_id=p_user),0))::INTEGER paid_energy FROM lab),
 supplier AS (SELECT *,LEAST((p_payout-vat)/2-paid-paid_energy,COALESCE((SELECT SUM(remaining_cents) FROM public.kq_supplier_invoices WHERE user_id=p_user AND due_at<=now()),0))::INTEGER paid_supplier FROM energy)
 SELECT jsonb_build_object('vatCents',vat,'labPaidCents',paid,'electricityPaidCents',paid_energy,'supplierPaidCents',paid_supplier,
  'netPayoutCents',p_payout-vat-paid-paid_energy-paid_supplier) FROM supplier;
$$;
SELECT pg_temp.kq_supplier_patch('public.kq_business_collect_sale(uuid,integer)',
 ' RETURN amounts;',
 $new$ budget:=(amounts->>'supplierPaidCents')::INTEGER;
 UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-budget WHERE user_id=p_user;
 FOR invoice IN SELECT id,remaining_cents FROM public.kq_supplier_invoices WHERE user_id=p_user AND due_at<=now() AND remaining_cents>0 ORDER BY due_at,id FOR UPDATE LOOP
  EXIT WHEN budget<=0; part:=LEAST(budget,invoice.remaining_cents); budget:=budget-part;
  UPDATE public.kq_supplier_invoices SET remaining_cents=remaining_cents-part,last_paid_at=now() WHERE id=invoice.id;
 END LOOP;
 IF budget<>0 THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
 IF (amounts->>'supplierPaidCents')::INTEGER>0 THEN INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents) VALUES(p_user,'supplier-paid',(amounts->>'supplierPaidCents')::INTEGER); END IF;
 RETURN amounts;$new$);
SELECT pg_temp.kq_supplier_patch('public.kq_online_collect(uuid,integer,timestamptz)',
 'paid_energy INTEGER:=0;', 'paid_energy INTEGER:=0; paid_supplier INTEGER:=0;');
SELECT pg_temp.kq_supplier_patch('public.kq_online_collect(uuid,integer,timestamptz)',
 ' UPDATE public.kq_commerce_accounts SET vat_sales_ttc_cents=',
 $new$ FOR inv IN SELECT id,remaining_cents FROM public.kq_supplier_invoices WHERE user_id=p_user AND due_at<=p_at AND remaining_cents>0 ORDER BY due_at,id FOR UPDATE LOOP
  EXIT WHEN budget=0; part:=LEAST(budget,inv.remaining_cents); budget:=budget-part; paid_supplier:=paid_supplier+part;
  UPDATE public.kq_supplier_invoices SET remaining_cents=remaining_cents-part,last_paid_at=p_at WHERE id=inv.id;
 END LOOP;
 IF paid_supplier>0 THEN INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user,'supplier-paid',paid_supplier,p_at); END IF;
 UPDATE public.kq_commerce_accounts SET vat_sales_ttc_cents=$new$);
SELECT pg_temp.kq_supplier_patch('public.kq_online_collect(uuid,integer,timestamptz)',
 'p_payout-tax-fee-paid_lab-paid_energy', 'p_payout-tax-fee-paid_lab-paid_energy-paid_supplier');
SELECT pg_temp.kq_supplier_patch('public.kq_online_collect(uuid,integer,timestamptz)',
 '''electricityPaidCents'',paid_energy', '''electricityPaidCents'',paid_energy,''supplierPaidCents'',paid_supplier');

SELECT pg_temp.kq_supplier_patch('public.kq_business_command(uuid,text,jsonb)',
 'ad JSONB;', 'ad JSONB; supplier public.kq_supplier_invoices%ROWTYPE;');
SELECT pg_temp.kq_supplier_patch('public.kq_business_command(uuid,text,jsonb)',
 ' ELSIF p_action=''pay-lab'' THEN',
 $new$ ELSIF p_action='pay-supplier' THEN
  SELECT * INTO supplier FROM public.kq_supplier_invoices WHERE id=(p_payload->>'invoiceId')::UUID AND user_id=p_user FOR UPDATE;
  IF NOT FOUND OR supplier.remaining_cents=0 THEN RAISE EXCEPTION 'commerce_supplier_unavailable'; END IF;
  cost:=supplier.remaining_cents;
  IF cash<cost THEN RAISE EXCEPTION 'commerce_supplier_cash'; END IF;
  UPDATE public.kq_supplier_invoices SET remaining_cents=0,last_paid_at=now() WHERE id=supplier.id;
 ELSIF p_action='pay-lab' THEN$new$);
SELECT pg_temp.kq_supplier_patch('public.kq_business_command(uuid,text,jsonb)',
 'WHEN ''pay-lab'' THEN ''lab-paid''', 'WHEN ''pay-supplier'' THEN ''supplier-paid'' WHEN ''pay-lab'' THEN ''lab-paid''');
SELECT pg_temp.kq_supplier_patch('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)',
 '''advertise'',''pay-lab'',''domiciliation''', '''advertise'',''pay-lab'',''pay-supplier'',''domiciliation''');
SELECT pg_temp.kq_supplier_patch('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)',
 'lab INTEGER:=0;', 'lab INTEGER:=0; supplier INTEGER:=0;');
SELECT pg_temp.kq_supplier_patch('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)',
 '   OR (offer->>''netPayoutCents'')::INTEGER IS DISTINCT FROM',
 '   OR COALESCE((offer->>''supplierPaidCents'')::INTEGER,0) IS DISTINCT FROM (charges->>''supplierPaidCents'')::INTEGER OR (offer->>''netPayoutCents'')::INTEGER IS DISTINCT FROM');
SELECT pg_temp.kq_supplier_patch('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)',
 '  vat:=(charges->>''vatCents'')::INTEGER;', '  supplier:=(charges->>''supplierPaidCents'')::INTEGER; vat:=(charges->>''vatCents'')::INTEGER;');
SELECT pg_temp.kq_supplier_patch('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)',
 'w.cash_cents-vat-lab-energy', 'w.cash_cents-vat-lab-energy-supplier');
SELECT pg_temp.kq_supplier_patch('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)',
 'payout-vat-lab-energy', 'payout-vat-lab-energy-supplier');
SELECT pg_temp.kq_supplier_patch('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)',
 '''electricityPaidCents'',energy,', '''electricityPaidCents'',energy,''supplierPaidCents'',supplier,');
SELECT pg_temp.kq_supplier_patch('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)',
 'vat_cents,lab_paid_cents,sales_channel', 'vat_cents,lab_paid_cents,supplier_paid_cents,sales_channel');
SELECT pg_temp.kq_supplier_patch('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)',
 'sale_count_now,bonus,energy,vat,lab,channel', 'sale_count_now,bonus,energy,vat,lab,supplier,channel');

SELECT pg_temp.kq_supplier_patch('public.kq_online_dispatch(uuid,uuid,timestamptz)',
 'electricity_paid_cents,net_payout_cents', 'electricity_paid_cents,supplier_paid_cents,net_payout_cents');
SELECT pg_temp.kq_supplier_patch('public.kq_online_dispatch(uuid,uuid,timestamptz)',
 '(charges->>''electricityPaidCents'')::INTEGER,(charges->>''netPayoutCents'')::INTEGER',
 '(charges->>''electricityPaidCents'')::INTEGER,(charges->>''supplierPaidCents'')::INTEGER,(charges->>''netPayoutCents'')::INTEGER');
SELECT pg_temp.kq_supplier_patch('public.kq_online_dispatch(uuid,uuid,timestamptz)',
 'vat_cents,lab_paid_cents,sales_channel', 'vat_cents,lab_paid_cents,supplier_paid_cents,sales_channel');
SELECT pg_temp.kq_supplier_patch('public.kq_online_dispatch(uuid,uuid,timestamptz)',
 '(charges->>''labPaidCents'')::INTEGER,''online''', '(charges->>''labPaidCents'')::INTEGER,(charges->>''supplierPaidCents'')::INTEGER,''online''');
SELECT pg_temp.kq_supplier_patch('public.kq_storage_sell_overflow(uuid,boolean)',
 'vat_cents,lab_paid_cents,sales_channel', 'vat_cents,lab_paid_cents,supplier_paid_cents,sales_channel');
SELECT pg_temp.kq_supplier_patch('public.kq_storage_sell_overflow(uuid,boolean)',
 '(charges->>''labPaidCents'')::INTEGER,''wholesale''', '(charges->>''labPaidCents'')::INTEGER,(charges->>''supplierPaidCents'')::INTEGER,''wholesale''');

REVOKE ALL ON FUNCTION public.kq_supplier_invoice_accounting(),public.kq_invoice_warehouse_consumables(),
 public.kq_supplier_snapshot(UUID),public.kq_supplier_previous_business_snapshot(UUID),public.kq_business_snapshot(UUID)
 FROM PUBLIC,anon,authenticated,service_role;
DROP FUNCTION pg_temp.kq_supplier_patch(TEXT,TEXT,TEXT);
COMMIT;
