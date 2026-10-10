BEGIN;

-- Keep historical free interventions truthful. Future receipts record the
-- amount actually charged, independently of later catalogue price changes.
ALTER TABLE public.kq_care_interventions
  ADD COLUMN charged_cents INTEGER NOT NULL DEFAULT 0
  CHECK (charged_cents >= 0 AND (product_code IS NULL OR charged_cents = 0));
REVOKE ALL ON TABLE public.kq_care_interventions FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.kq_basic_care_price() RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT 500 $$;
REVOKE ALL ON FUNCTION public.kq_basic_care_price() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_care_shop(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cash INTEGER;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  PERFORM public.kq_business_settle(p_user_id);
  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
  SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
  RETURN jsonb_build_object('cashCents',cash,'inventory',public.kq_care_inventory_json(p_user_id),
    'basicCarePriceCents',public.kq_basic_care_price());
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_care_shop(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_care_shop(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_care_intervention_receipt(
  p_user_id UUID,p_run_id UUID,p_request_key UUID,p_product_code TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.kq_care_interventions%ROWTYPE; run public.kq_runs%ROWTYPE; cash INTEGER;
BEGIN
  SELECT * INTO old FROM public.kq_care_interventions WHERE user_id=p_user_id AND request_key=p_request_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF old.run_id IS DISTINCT FROM p_run_id OR old.product_code IS DISTINCT FROM p_product_code THEN
    RAISE EXCEPTION 'kq_care_request_mismatch';
  END IF;
  SELECT * INTO run FROM public.kq_runs WHERE id=p_run_id AND user_id=p_user_id;
  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
  SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
  -- A delayed retry returns current state and cash, with the original charge.
  RETURN jsonb_build_object('state',run.state,'updatedAt',run.updated_at,
    'inventory',public.kq_care_inventory_json(p_user_id),'cashCents',cash,
    'chargedCents',old.charged_cents,'replayed',TRUE);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_care_intervention_receipt(UUID,UUID,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_care_intervention_receipt(UUID,UUID,UUID,TEXT) TO service_role;

-- Old clients still send six arguments. Their product applications remain
-- compatible, but a formerly free basic-care button must never debit silently.
DROP FUNCTION public.rpc_kq_apply_care(UUID,UUID,TEXT,UUID,TIMESTAMPTZ,JSONB);
CREATE FUNCTION public.rpc_kq_apply_care(
  p_user_id UUID,p_run_id UUID,p_product_code TEXT,p_request_key UUID,
  p_expected_updated_at TIMESTAMPTZ,p_next_state JSONB,p_basic_price_cents INTEGER DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run public.kq_runs%ROWTYPE; replay JSONB; step INTEGER; updated TIMESTAMPTZ;
  cash INTEGER; charge INTEGER := 0;
BEGIN
  IF p_user_id IS NULL OR p_run_id IS NULL OR p_request_key IS NULL OR p_expected_updated_at IS NULL OR p_next_state IS NULL
    OR (p_product_code IS NOT NULL AND public.kq_care_price(p_product_code) IS NULL) THEN
    RAISE EXCEPTION 'kq_care_invalid_request';
  END IF;
  -- Same acquisition order as purchases: player advisory lock, settlement,
  -- wallet row, then culture row. All changes and accounting share this tx.
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  PERFORM public.kq_business_settle(p_user_id);
  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
  SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
  SELECT * INTO run FROM public.kq_runs WHERE id=p_run_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
  replay := public.rpc_kq_care_intervention_receipt(p_user_id,p_run_id,p_request_key,p_product_code);
  IF replay IS NOT NULL THEN RETURN replay; END IF;
  IF p_product_code IS NULL AND p_basic_price_cents IS DISTINCT FROM public.kq_basic_care_price() THEN
    RAISE EXCEPTION 'kq_care_price_changed';
  END IF;
  IF run.status<>'active' THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
  IF run.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'kq_stale_run'; END IF;
  IF run.state->'rulesVersion' IS DISTINCT FROM '3'::JSONB THEN RAISE EXCEPTION 'kq_care_legacy_run'; END IF;
  step := (run.state->>'stageIndex')::INTEGER + CASE WHEN run.state->>'phase'='resolved' THEN 1 ELSE 0 END;
  IF run.state->>'phase' NOT IN ('prepare','rolled','resolved') OR step NOT BETWEEN 0 AND 4
    OR (p_next_state-'care') IS DISTINCT FROM (run.state-'care') OR NOT public.kq_care_state_valid(p_next_state->'care')
    OR p_next_state->'care' IS NOT DISTINCT FROM run.state->'care' THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
  IF p_product_code IS NULL THEN
    IF run.state->'care'->'lastBasicCareStage' = to_jsonb(step)
      OR p_next_state->'care'->'lastBasicCareStage' IS DISTINCT FROM to_jsonb(step)
      OR ((p_next_state->'care')-'lastBasicCareStage'-'history') IS DISTINCT FROM
        ((run.state->'care')-'lastBasicCareStage'-'history') THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
    charge := public.kq_basic_care_price();
    IF cash < charge THEN RAISE EXCEPTION 'kq_care_basic_insufficient_cash'; END IF;
    PERFORM public.kq_treasury_initialize(p_user_id);
    UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-charge,updated_at=now() WHERE user_id=p_user_id;
    -- The established wallet trigger posts cash/suspense. This pair supplies
    -- the actual expense, leaving no artificial revenue or suspense balance.
    PERFORM public.kq_treasury_pair(p_user_id,'culture-care','culture-care:'||p_request_key::TEXT,
      now(),'expense_maintenance','suspense',charge,'Entretien de culture · étape '||(step+1)::TEXT);
  ELSE
    IF p_next_state->'care'->'applications' IS DISTINCT FROM
      ((run.state->'care'->'applications') || jsonb_build_array(jsonb_build_object('productCode',p_product_code,'stageIndex',step)))
      OR p_next_state->'care'->'lastBasicCareStage' IS DISTINCT FROM run.state->'care'->'lastBasicCareStage' THEN
      RAISE EXCEPTION 'kq_care_invalid_request';
    END IF;
    UPDATE public.kq_care_inventory SET quantity=quantity-1,updated_at=now()
      WHERE user_id=p_user_id AND product_code=p_product_code AND quantity>0;
    IF NOT FOUND THEN RAISE EXCEPTION 'kq_care_stock_unavailable'; END IF;
  END IF;
  updated := GREATEST(clock_timestamp(),run.updated_at+interval '1 microsecond');
  UPDATE public.kq_runs SET state=p_next_state,updated_at=updated WHERE id=p_run_id;
  INSERT INTO public.kq_care_interventions(user_id,request_key,run_id,product_code,stage_index,charged_cents)
    VALUES(p_user_id,p_request_key,p_run_id,p_product_code,step,charge);
  RETURN jsonb_build_object('state',p_next_state,'updatedAt',updated,'inventory',public.kq_care_inventory_json(p_user_id),
    'cashCents',cash-charge,'chargedCents',charge,'replayed',FALSE);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_apply_care(UUID,UUID,TEXT,UUID,TIMESTAMPTZ,JSONB,INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_apply_care(UUID,UUID,TEXT,UUID,TIMESTAMPTZ,JSONB,INTEGER) TO service_role;

COMMIT;
