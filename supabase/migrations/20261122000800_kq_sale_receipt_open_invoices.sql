BEGIN;

-- Freeze the unpaid invoice balance with a new sale receipt after collection.
-- The existing request replay returns the same receipt, including this amount.
DO $$
DECLARE
 body TEXT;
 anchor TEXT := 'INSERT INTO public.kq_commerce_requests(user_id,request_key,action,payload,receipt)';
BEGIN
 SELECT pg_get_functiondef('public.kq_commerce_command_before_invoice_batch(uuid,text,jsonb,uuid)'::regprocedure) INTO body;
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN
  RAISE EXCEPTION 'sale_receipt_open_invoices_anchor_changed';
 END IF;
 EXECUTE replace(body,anchor,$patch$IF p_action='sell' THEN
  result:=result||jsonb_build_object('lotName',(SELECT variety_name FROM public.kq_flowers WHERE id=s.flower_id),
   'remainingInvoiceCents',
    COALESCE((SELECT sum(remaining_cents) FROM public.kq_lab_invoices WHERE user_id=p_user_id),0)
   +COALESCE((SELECT sum(remaining_cents) FROM public.kq_energy_invoices WHERE user_id=p_user_id),0)
   +COALESCE((SELECT sum(remaining_cents) FROM public.kq_storage_climate_invoices WHERE user_id=p_user_id),0)
   +COALESCE((SELECT sum(remaining_cents) FROM public.kq_supplier_invoices WHERE user_id=p_user_id),0));
 END IF;
 INSERT INTO public.kq_commerce_requests(user_id,request_key,action,payload,receipt)$patch$);
END $$;

REVOKE ALL ON FUNCTION public.kq_commerce_command_before_invoice_batch(UUID,TEXT,JSONB,UUID)
 FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
