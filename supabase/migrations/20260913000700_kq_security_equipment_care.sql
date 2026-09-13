BEGIN;

INSERT INTO public.kq_equipment_catalog(code,category,slot,price_cents,is_purchasable,is_active,sort_order,metadata)
VALUES
  ('SECURITY-DOG','security','security',100000,TRUE,TRUE,230,'{"name":"Chien de garde","food_cents":800,"vet_cents":4000,"vet_every_cycles":10}'::JSONB),
  ('SECURITY-FENCE','security','security',18000,TRUE,TRUE,240,'{"name":"Clôture électrique","game_power_watts":35}'::JSONB)
ON CONFLICT(code) DO UPDATE SET category=EXCLUDED.category,slot=EXCLUDED.slot,price_cents=EXCLUDED.price_cents,
  is_purchasable=TRUE,is_active=TRUE,sort_order=EXCLUDED.sort_order,metadata=EXCLUDED.metadata,updated_at=now();
UPDATE public.kq_equipment_catalog SET metadata=metadata || '{"name":"Caméra de surveillance"}'::JSONB,
  updated_at=now() WHERE code='SECURITY-CAMERA';

ALTER TABLE public.kq_energy_invoices ADD COLUMN dog_care JSONB;
COMMENT ON COLUMN public.kq_energy_invoices.dog_care IS 'Server-calculated care at completion; paidCents is the immediate wallet debit, not later settlements. Invoice total includes energy and care; quote remains energy only.';

-- Existing invoice/payment RPC names remain compatible. They now settle all cycle charges.
-- Wallet lock serializes completions, purchases, sales and manual settlements per player.
CREATE OR REPLACE FUNCTION public.kq_invoice_completed_cycle() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_energy INTEGER := 0; v_care INTEGER := 0; v_paid INTEGER := 0;
  v_cycle INTEGER; v_vet INTEGER; v_cash INTEGER; v_dog JSONB; v_quote JSONB;
BEGIN
  IF NEW.status::TEXT <> 'completed' OR OLD.status::TEXT = 'completed' THEN RETURN NEW; END IF;
  PERFORM public.rpc_kq_ensure_equipment_profile(NEW.user_id);
  SELECT cash_cents INTO v_cash FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.kq_energy_invoices WHERE run_id=NEW.id) THEN RETURN NEW; END IF;

  v_quote := NEW.state->'energy';
  IF v_quote->>'version' = '1' THEN
    v_energy := (v_quote->>'totalCents')::INTEGER;
    IF v_energy IS NULL OR v_energy < 0 THEN RAISE EXCEPTION 'kq_invalid_energy_quote'; END IF;
  ELSIF EXISTS(SELECT 1 FROM public.kq_player_equipment WHERE user_id=NEW.user_id AND equipment_code='SECURITY-DOG') THEN
    -- A legacy run has no electricity quote, but an adopted dog still needs care.
    v_quote := '{"version":1,"mode":"balanced","lines":[],"totalWattHours":0,"solarPercent":0,"tariffCentsPerKwh":30,"totalCents":0,"savingsCents":0}'::JSONB;
  ELSE RETURN NEW;
  END IF;

  IF EXISTS(SELECT 1 FROM public.kq_player_equipment WHERE user_id=NEW.user_id AND equipment_code='SECURITY-DOG') THEN
    SELECT COUNT(*)::INTEGER+1 INTO v_cycle FROM public.kq_energy_invoices WHERE user_id=NEW.user_id AND dog_care IS NOT NULL;
    v_vet := CASE WHEN v_cycle % 10 = 0 THEN 4000 ELSE 0 END;
    v_care := 800 + v_vet;
    v_paid := LEAST(v_cash,v_care);
    v_dog := jsonb_build_object('cycle',v_cycle,'foodCents',800,'vetCents',v_vet,'totalCents',v_care,'paidCents',v_paid);
  END IF;

  INSERT INTO public.kq_energy_invoices(run_id,user_id,total_cents,remaining_cents,quote,harvest_grams,dog_care)
    VALUES(NEW.id,NEW.user_id,v_energy+v_care,v_energy+v_care-v_paid,v_quote,COALESCE((NEW.state->>'harvestGrams')::NUMERIC,0),v_dog);
  IF v_paid > 0 THEN
    UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-v_paid,updated_at=now() WHERE user_id=NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_energy_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH care AS (SELECT COUNT(*)::INTEGER AS cycles FROM public.kq_energy_invoices WHERE user_id=p_user_id AND dog_care IS NOT NULL)
  SELECT jsonb_build_object(
    'outstandingCents',COALESCE(SUM(remaining_cents),0),
    'invoiceCount',COUNT(*),
    'bestGramsPerKwh',MAX(CASE WHEN (quote->>'totalWattHours')::NUMERIC>0 THEN ROUND(harvest_grams*1000/(quote->>'totalWattHours')::NUMERIC,2) ELSE NULL END),
    'dogCare',CASE WHEN EXISTS(SELECT 1 FROM public.kq_player_equipment WHERE user_id=p_user_id AND equipment_code='SECURITY-DOG') THEN
      (SELECT jsonb_build_object('completedCycles',cycles,'nextCycle',cycles+1,'cyclesUntilVet',10-cycles%10,
        'foodCents',800,'vetCents',4000,'nextTotalCents',800+CASE WHEN (cycles+1)%10=0 THEN 4000 ELSE 0 END) FROM care)
      ELSE NULL END,
    'invoices',COALESCE((SELECT jsonb_agg(jsonb_build_object('runId',i.run_id,'createdAt',i.created_at,
      'totalCents',i.total_cents,'remainingCents',i.remaining_cents,'harvestGrams',i.harvest_grams,'quote',i.quote,'dogCare',i.dog_care) ORDER BY i.created_at DESC,i.run_id)
      FROM (SELECT * FROM public.kq_energy_invoices WHERE user_id=p_user_id ORDER BY created_at DESC,run_id LIMIT 20) i),'[]'::JSONB)
  ) FROM public.kq_energy_invoices WHERE user_id=p_user_id;
$$;
REVOKE ALL ON FUNCTION public.kq_invoice_completed_cycle(),public.rpc_kq_energy_snapshot(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_energy_snapshot(UUID) TO service_role;
COMMIT;
