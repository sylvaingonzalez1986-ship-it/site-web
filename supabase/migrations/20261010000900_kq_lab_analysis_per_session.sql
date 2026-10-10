BEGIN;

-- One completed culture produces one analyzed lot, regardless of tent count.
-- The unique run_id remains the billing/idempotency boundary.
CREATE OR REPLACE FUNCTION public.kq_invoice_completed_lab() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status::TEXT='completed' AND OLD.status::TEXT<>'completed' THEN
  PERFORM public.kq_business_settle(NEW.user_id);
  INSERT INTO public.kq_lab_invoices(run_id,user_id,amount_cents,remaining_cents)
   VALUES(NEW.id,NEW.user_id,4500,4500) ON CONFLICT(run_id) DO NOTHING;
  IF FOUND THEN
   INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents) VALUES(NEW.user_id,'lab-issued',4500);
   UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=NEW.user_id;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_invoice_completed_lab() FROM PUBLIC,anon,authenticated,service_role;

-- Correct existing multi-tent invoices, including amounts already collected.
-- Lock in the same order as wallet/commerce operations. Do not run settlement:
-- correction must precede any further payment of the former inflated amount.
DO $$
DECLARE owner UUID; invoice public.kq_lab_invoices%ROWTYPE;
 paid INTEGER; corrected_remaining INTEGER; cancelled INTEGER; refund INTEGER;
 corrected_invoices BIGINT:=0; corrected_players BIGINT:=0; cancelled_total BIGINT:=0; refunded_total BIGINT:=0;
BEGIN
 FOR owner IN SELECT DISTINCT user_id FROM public.kq_lab_invoices WHERE amount_cents>4500 ORDER BY user_id LOOP
  corrected_players:=corrected_players+1;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||owner::TEXT,0));
  PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lab_correction_wallet_missing'; END IF;
  PERFORM 1 FROM public.kq_commerce_accounts WHERE user_id=owner FOR UPDATE;
  FOR invoice IN SELECT * FROM public.kq_lab_invoices WHERE user_id=owner AND amount_cents>4500 ORDER BY id FOR UPDATE LOOP
   paid:=invoice.amount_cents-invoice.remaining_cents;
   corrected_remaining:=GREATEST(0,4500-paid);
   cancelled:=invoice.remaining_cents-corrected_remaining;
   refund:=GREATEST(0,paid-4500);
   corrected_invoices:=corrected_invoices+1;
   cancelled_total:=cancelled_total+cancelled;
   refunded_total:=refunded_total+refund;

   -- Keep invoice identity, issued/due dates and historical payment receipts.
   -- The existing treasury observer reverses expense/debt and records any
   -- refund receivable in suspense; the wallet credit below clears it. Its
   -- deferred stock refresh also removes the overstated production cost.
   UPDATE public.kq_lab_invoices SET amount_cents=4500,remaining_cents=corrected_remaining WHERE id=invoice.id;
   IF cancelled>0 THEN
    INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents) VALUES(owner,'lab-adjusted',cancelled);
   END IF;
   IF refund>0 THEN
    UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+refund,updated_at=now() WHERE user_id=owner;
    INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents) VALUES(owner,'lab-refunded',refund);
   END IF;
  END LOOP;
  -- Even a debt-only correction changes the deductions in existing quotes.
  UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=owner;
 END LOOP;
 RAISE NOTICE 'lab_analysis_per_session: invoices=%, players=%, cancelled_cents=%, refunded_cents=%',
  corrected_invoices,corrected_players,cancelled_total,refunded_total;
END $$;

-- Install the guard after account locks/corrections, preserving normal lock
-- order. amount_cents>4500 above makes reruns refund/adjust each invoice once.
ALTER TABLE public.kq_lab_invoices DROP CONSTRAINT kq_lab_invoices_amount_cents_check;
ALTER TABLE public.kq_lab_invoices ADD CONSTRAINT kq_lab_invoices_amount_cents_check CHECK(amount_cents=4500);

COMMIT;
