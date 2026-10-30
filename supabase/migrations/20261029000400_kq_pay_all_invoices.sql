BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Preserve every existing commerce path and receipt. The batch action pays
-- only issued invoices, in one transaction, from the confirmed current cash.
ALTER FUNCTION public.rpc_kq_commerce_command(UUID,TEXT,JSONB,UUID)
 RENAME TO kq_commerce_command_before_invoice_batch;
REVOKE ALL ON FUNCTION public.kq_commerce_command_before_invoice_batch(UUID,TEXT,JSONB,UUID)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_commerce_command(p_user_id UUID,p_action TEXT,p_payload JSONB,p_request_key UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.kq_commerce_requests%ROWTYPE; expected NUMERIC; total BIGINT; cash INTEGER;
 supplier_total BIGINT:=0; lab_total BIGINT:=0; energy_total BIGINT:=0; climate_total BIGINT:=0;
 invoice RECORD; invoice_count INTEGER:=0; paid_energy INTEGER:=0; paid_climate INTEGER:=0;
 at TIMESTAMPTZ:=now(); result JSONB;
BEGIN
 IF p_action IS DISTINCT FROM 'pay-all-invoices' THEN
  RETURN public.kq_commerce_command_before_invoice_batch(p_user_id,p_action,p_payload,p_request_key);
 END IF;
 IF p_user_id IS NULL OR p_request_key IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_payload->'expectedCents') IS DISTINCT FROM 'number'
 THEN RAISE EXCEPTION 'commerce_invalid_request'; END IF;
 expected:=(p_payload->>'expectedCents')::NUMERIC;
 IF expected<>trunc(expected) OR expected NOT BETWEEN 1 AND 2147483647 THEN RAISE EXCEPTION 'commerce_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 SELECT * INTO old FROM public.kq_commerce_requests WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF old.action IS DISTINCT FROM p_action OR old.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'commerce_request_mismatch'; END IF;
  RETURN old.receipt||jsonb_build_object('replayed',true);
 END IF;
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'commerce_invoices_cash'; END IF;

 -- Do not call business_settle here: its timeline can remit VAT, renew a
 -- subscription or issue the next bill. The confirmation covers issued bills
 -- only. Normal snapshot/clock settlement continues through its own entrypoints.
 -- Wallet-before-invoices is also the ordering used by the existing collectors.
 FOR invoice IN SELECT remaining_cents FROM public.kq_supplier_invoices
  WHERE user_id=p_user_id AND remaining_cents>0 AND issued_at<=at ORDER BY due_at,id FOR UPDATE LOOP
  supplier_total:=supplier_total+invoice.remaining_cents; invoice_count:=invoice_count+1;
 END LOOP;
 FOR invoice IN SELECT remaining_cents FROM public.kq_lab_invoices
  WHERE user_id=p_user_id AND remaining_cents>0 AND issued_at<=at ORDER BY due_at,id FOR UPDATE LOOP
  lab_total:=lab_total+invoice.remaining_cents; invoice_count:=invoice_count+1;
 END LOOP;
 FOR invoice IN SELECT remaining_cents FROM public.kq_energy_invoices
  WHERE user_id=p_user_id AND remaining_cents>0 AND created_at<=at ORDER BY created_at,run_id FOR UPDATE LOOP
  energy_total:=energy_total+invoice.remaining_cents; invoice_count:=invoice_count+1;
 END LOOP;
 FOR invoice IN SELECT remaining_cents FROM public.kq_storage_climate_invoices
  WHERE user_id=p_user_id AND remaining_cents>0 AND period_ended_at<=at ORDER BY period_ended_at,id FOR UPDATE LOOP
  climate_total:=climate_total+invoice.remaining_cents; invoice_count:=invoice_count+1;
 END LOOP;
 total:=supplier_total+lab_total+energy_total+climate_total;
 IF total<>expected THEN RAISE EXCEPTION 'commerce_invoices_changed'; END IF;
 IF cash<total THEN RAISE EXCEPTION 'commerce_invoices_cash'; END IF;

 PERFORM public.kq_treasury_initialize(p_user_id);
 -- This collector orders by creation date. The exact issued-only budget stops
 -- before any future-dated row. Care charges already belong to these invoices.
 IF energy_total>0 THEN paid_energy:=public.kq_settle_cycle_energy(p_user_id,energy_total::INTEGER); END IF;
 IF climate_total>0 THEN paid_climate:=public.kq_storage_climate_collect(p_user_id,climate_total::INTEGER,at); END IF;
 IF paid_energy<>energy_total OR paid_climate<>climate_total THEN RAISE EXCEPTION 'commerce_invoices_changed'; END IF;
 UPDATE public.kq_supplier_invoices SET remaining_cents=0,last_paid_at=at
  WHERE user_id=p_user_id AND remaining_cents>0 AND issued_at<=at;
 UPDATE public.kq_lab_invoices SET remaining_cents=0
  WHERE user_id=p_user_id AND remaining_cents>0 AND issued_at<=at;
 IF supplier_total+lab_total>0 THEN
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-(supplier_total+lab_total)::INTEGER,updated_at=at WHERE user_id=p_user_id;
 END IF;
 -- Invoice observers settle each payable; wallet observers settle cash. These
 -- familiar business rows describe the payment without booking a second cost.
 IF supplier_total>0 THEN INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user_id,'supplier-paid',supplier_total,at); END IF;
 IF lab_total>0 THEN INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user_id,'lab-paid',lab_total,at); END IF;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
 result:=jsonb_build_object('action',p_action,'paidCents',total,'supplierPaidCents',supplier_total,'labPaidCents',lab_total,
  'electricityPaidCents',energy_total+climate_total,'storageClimatePaidCents',climate_total,'invoiceCount',invoice_count,
  'cashAfterCents',cash,'replayed',false);
 INSERT INTO public.kq_commerce_requests(user_id,request_key,action,payload,receipt)
  VALUES(p_user_id,p_request_key,p_action,p_payload,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_commerce_command(UUID,TEXT,JSONB,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_commerce_command(UUID,TEXT,JSONB,UUID) TO service_role;

COMMIT;
