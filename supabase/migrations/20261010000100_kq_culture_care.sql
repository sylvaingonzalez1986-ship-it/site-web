BEGIN;

-- Prices and quantities are game units. No physical dosage or real performance
-- claim is encoded here. All writes go through service-only transactional RPCs.
CREATE TABLE public.kq_care_inventory (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_code)
);
CREATE TABLE public.kq_care_purchases (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_key UUID NOT NULL,
  product_code TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  total_price_cents INTEGER NOT NULL CHECK (total_price_cents > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_key)
);
CREATE TABLE public.kq_care_interventions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_key UUID NOT NULL,
  run_id UUID NOT NULL REFERENCES public.kq_runs(id),
  product_code TEXT,
  stage_index SMALLINT NOT NULL CHECK (stage_index BETWEEN 0 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_key)
);
ALTER TABLE public.kq_care_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_care_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_care_interventions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_care_inventory FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.kq_care_purchases FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.kq_care_interventions FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.kq_care_price(p_code TEXT) RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE p_code
    WHEN 'CARE-COMPOST-TEA' THEN 900 WHEN 'CARE-VERMICOMPOST' THEN 1400
    WHEN 'CARE-ORGANIC-FEED' THEN 1600 WHEN 'CARE-SEAWEED' THEN 1200
    WHEN 'CARE-APHIDIUS' THEN 1200 WHEN 'CARE-PHYTOSEIULUS' THEN 1400
    WHEN 'CARE-SWIRSKII' THEN 1100 WHEN 'CARE-ORIUS' THEN 1800
    WHEN 'CARE-CHRYSOPERLA' THEN 1400 WHEN 'CARE-COCCINELLA' THEN 1600 END
$$;
REVOKE ALL ON FUNCTION public.kq_care_price(TEXT) FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.kq_care_inventory ADD CONSTRAINT kq_care_product_known CHECK (public.kq_care_price(product_code) IS NOT NULL);

CREATE FUNCTION public.kq_care_inventory_json(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('productCode',product_code,'quantity',quantity) ORDER BY product_code),'[]'::JSONB)
  FROM public.kq_care_inventory WHERE user_id=p_user
$$;
REVOKE ALL ON FUNCTION public.kq_care_inventory_json(UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.rpc_kq_care_shop(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cash INTEGER;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  PERFORM public.kq_business_settle(p_user_id);
  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
  SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
  RETURN jsonb_build_object('cashCents',cash,'inventory',public.kq_care_inventory_json(p_user_id));
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_care_shop(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_care_shop(UUID) TO service_role;

CREATE FUNCTION public.rpc_kq_purchase_care(p_user_id UUID,p_product_code TEXT,p_quantity INTEGER,p_request_key UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cash INTEGER; total INTEGER; old public.kq_care_purchases%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL OR public.kq_care_price(p_product_code) IS NULL
    OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  PERFORM public.kq_business_settle(p_user_id);
  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
  SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
  SELECT * INTO old FROM public.kq_care_purchases WHERE user_id=p_user_id AND request_key=p_request_key;
  IF FOUND THEN
    IF old.product_code IS DISTINCT FROM p_product_code OR old.quantity IS DISTINCT FROM p_quantity THEN RAISE EXCEPTION 'kq_care_request_mismatch'; END IF;
    RETURN jsonb_build_object('cashCents',cash,'inventory',public.kq_care_inventory_json(p_user_id),'totalPriceCents',old.total_price_cents,'replayed',TRUE);
  END IF;
  total := public.kq_care_price(p_product_code)*p_quantity;
  IF cash<total THEN RAISE EXCEPTION 'kq_care_insufficient_cash'; END IF;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-total,updated_at=now() WHERE user_id=p_user_id;
  INSERT INTO public.kq_care_inventory(user_id,product_code,quantity) VALUES(p_user_id,p_product_code,p_quantity)
    ON CONFLICT(user_id,product_code) DO UPDATE SET quantity=kq_care_inventory.quantity+p_quantity,updated_at=now();
  INSERT INTO public.kq_care_purchases(user_id,request_key,product_code,quantity,total_price_cents)
    VALUES(p_user_id,p_request_key,p_product_code,p_quantity,total);
  RETURN jsonb_build_object('cashCents',cash-total,'inventory',public.kq_care_inventory_json(p_user_id),'totalPriceCents',total,'replayed',FALSE);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_purchase_care(UUID,TEXT,INTEGER,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_purchase_care(UUID,TEXT,INTEGER,UUID) TO service_role;

CREATE FUNCTION public.rpc_kq_care_intervention_receipt(p_user_id UUID,p_run_id UUID,p_request_key UUID,p_product_code TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.kq_care_interventions%ROWTYPE; run public.kq_runs%ROWTYPE;
BEGIN
  SELECT * INTO old FROM public.kq_care_interventions WHERE user_id=p_user_id AND request_key=p_request_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF old.run_id IS DISTINCT FROM p_run_id OR old.product_code IS DISTINCT FROM p_product_code THEN RAISE EXCEPTION 'kq_care_request_mismatch'; END IF;
  SELECT * INTO run FROM public.kq_runs WHERE id=p_run_id AND user_id=p_user_id;
  -- Return the current state, not a stale receipt state that could undo a later
  -- operation in the client after a delayed response / retry.
  RETURN jsonb_build_object('state',run.state,'updatedAt',run.updated_at,'inventory',public.kq_care_inventory_json(p_user_id),'replayed',TRUE);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_care_intervention_receipt(UUID,UUID,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_care_intervention_receipt(UUID,UUID,UUID,TEXT) TO service_role;

CREATE FUNCTION public.kq_care_state_valid(care JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
BEGIN
  IF jsonb_typeof(care) IS DISTINCT FROM 'object' OR care->'version' IS DISTINCT FROM '1'::JSONB THEN RETURN FALSE; END IF;
  IF jsonb_typeof(care->'vitality') IS DISTINCT FROM 'number' OR jsonb_typeof(care->'terpenes') IS DISTINCT FROM 'number'
    OR jsonb_typeof(care->'cannabinoidExpression') IS DISTINCT FROM 'number'
    OR jsonb_typeof(care->'cannabinoidConversion') IS DISTINCT FROM 'number'
    OR jsonb_typeof(care->'cannabinoidOxidation') IS DISTINCT FROM 'number'
    OR jsonb_typeof(care->'yieldBonusPercent') IS DISTINCT FROM 'number' OR jsonb_typeof(care->'yieldLossPercent') IS DISTINCT FROM 'number'
    OR jsonb_typeof(care->'problems') IS DISTINCT FROM 'array' OR jsonb_typeof(care->'interventions') IS DISTINCT FROM 'array'
    OR jsonb_typeof(care->'applications') IS DISTINCT FROM 'array' OR jsonb_typeof(care->'history') IS DISTINCT FROM 'array' THEN RETURN FALSE; END IF;
  RETURN (care->>'vitality')::NUMERIC BETWEEN 0 AND 100 AND (care->>'terpenes')::NUMERIC BETWEEN 35 AND 99
    AND (care->>'cannabinoidExpression')::NUMERIC BETWEEN 35 AND 99
    AND (care->>'cannabinoidConversion')::NUMERIC BETWEEN 0 AND 20
    AND (care->>'cannabinoidOxidation')::NUMERIC BETWEEN 0 AND 20
    AND (care->>'yieldBonusPercent')::NUMERIC BETWEEN 0 AND 10 AND (care->>'yieldLossPercent')::NUMERIC BETWEEN 0 AND 40
    AND jsonb_array_length(care->'problems')<=2 AND jsonb_array_length(care->'history')<=48;
END $$;
REVOKE ALL ON FUNCTION public.kq_care_state_valid(JSONB) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.rpc_kq_apply_care(p_user_id UUID,p_run_id UUID,p_product_code TEXT,p_request_key UUID,
  p_expected_updated_at TIMESTAMPTZ,p_next_state JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run public.kq_runs%ROWTYPE; replay JSONB; step INTEGER; updated TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL OR p_run_id IS NULL OR p_request_key IS NULL OR p_expected_updated_at IS NULL OR p_next_state IS NULL
    OR (p_product_code IS NOT NULL AND public.kq_care_price(p_product_code) IS NULL) THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  PERFORM public.kq_business_settle(p_user_id);
  SELECT * INTO run FROM public.kq_runs WHERE id=p_run_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
  replay := public.rpc_kq_care_intervention_receipt(p_user_id,p_run_id,p_request_key,p_product_code);
  IF replay IS NOT NULL THEN RETURN replay; END IF;
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
      OR p_next_state->'care'->'applications' IS DISTINCT FROM run.state->'care'->'applications' THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
  ELSE
    IF p_next_state->'care'->'applications' IS DISTINCT FROM
      ((run.state->'care'->'applications') || jsonb_build_array(jsonb_build_object('productCode',p_product_code,'stageIndex',step))) THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
    UPDATE public.kq_care_inventory SET quantity=quantity-1,updated_at=now()
      WHERE user_id=p_user_id AND product_code=p_product_code AND quantity>0;
    IF NOT FOUND THEN RAISE EXCEPTION 'kq_care_stock_unavailable'; END IF;
  END IF;
  -- clock_timestamp keeps compare-and-swap versions strictly changing even when
  -- more than one operation is performed inside the same database transaction.
  updated := GREATEST(clock_timestamp(),run.updated_at+interval '1 microsecond');
  UPDATE public.kq_runs SET state=p_next_state,updated_at=updated WHERE id=p_run_id;
  INSERT INTO public.kq_care_interventions(user_id,request_key,run_id,product_code,stage_index)
    VALUES(p_user_id,p_request_key,p_run_id,p_product_code,step);
  RETURN jsonb_build_object('state',p_next_state,'updatedAt',updated,'inventory',public.kq_care_inventory_json(p_user_id),'replayed',FALSE);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_apply_care(UUID,UUID,TEXT,UUID,TIMESTAMPTZ,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_apply_care(UUID,UUID,TEXT,UUID,TIMESTAMPTZ,JSONB) TO service_role;

-- Existing flower verdicts retain version 2. The version travels with a flower
-- so a mixed-version duel can use one common historical jury.
ALTER TABLE public.kq_flowers ADD COLUMN rules_version SMALLINT NOT NULL DEFAULT 2 CHECK (rules_version IN (2,3));
ALTER TABLE public.kq_flowers ADD COLUMN cannabinoid_report JSONB;

-- Keep the established settlement and terminal-run pipeline (including its
-- triggers for energy, harvest deliveries and wear), extending only v3 checks.
CREATE OR REPLACE FUNCTION public.rpc_kq_update_run_state(
  p_user_id UUID,p_run_id UUID,p_expected_updated_at TIMESTAMPTZ,p_action TEXT,p_next_state JSONB,p_flower JSONB DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_run public.kq_runs%ROWTYPE; v_flower public.kq_flowers%ROWTYPE;
  v_complete BOOLEAN; v_dead BOOLEAN; v_version INTEGER;
BEGIN
  PERFORM public.kq_business_settle(p_user_id);
  IF p_action NOT IN ('roll','resolve','advance','redraw','heritage') OR p_next_state IS NULL
    OR p_expected_updated_at IS NULL THEN RAISE EXCEPTION 'kq_invalid_action'; END IF;
  SELECT * INTO v_run FROM public.kq_runs WHERE id=p_run_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_run.status<>'active' THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
  IF v_run.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'kq_stale_run'; END IF;
  IF p_next_state->'seed' IS DISTINCT FROM v_run.state->'seed'
    OR p_next_state->'deckCodes' IS DISTINCT FROM v_run.state->'deckCodes'
    OR p_next_state->'situationCodes' IS DISTINCT FROM v_run.state->'situationCodes'
    OR p_next_state->'domiciliation' IS DISTINCT FROM v_run.state->'domiciliation'
    OR p_next_state->'varietyCode' IS DISTINCT FROM v_run.state->'varietyCode'
    OR p_next_state->'heritageCode' IS DISTINCT FROM v_run.state->'heritageCode'
    OR p_next_state->'usedCards' IS DISTINCT FROM v_run.state->'usedCards'
    OR p_next_state->'rulesVersion' IS DISTINCT FROM v_run.state->'rulesVersion'
  THEN RAISE EXCEPTION 'kq_invalid_state_transition'; END IF;
  v_version := COALESCE((v_run.state->>'rulesVersion')::INTEGER,2);
  IF v_version NOT IN (2,3) OR (v_version=3 AND NOT public.kq_care_state_valid(p_next_state->'care'))
  THEN RAISE EXCEPTION 'kq_invalid_state_transition'; END IF;
  v_complete := p_next_state->>'phase'='complete';
  v_dead := COALESCE(p_next_state->'cultureDead'='true'::JSONB,FALSE);
  IF v_dead THEN
    IF v_complete IS NOT TRUE OR p_action NOT IN ('resolve','advance') OR p_flower IS NOT NULL
      OR p_next_state->'harvestGrams' IS DISTINCT FROM '0'::JSONB
      OR jsonb_typeof(p_next_state->'history') IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION 'kq_invalid_culture_death'; END IF;
    IF v_version=3 THEN
      IF p_next_state->'care'->'vitality' IS DISTINCT FROM '0'::JSONB THEN RAISE EXCEPTION 'kq_invalid_culture_death'; END IF;
    ELSIF (SELECT count(*) FROM jsonb_array_elements(p_next_state->'history') AS stage WHERE stage->'total'='0'::JSONB)<2
    THEN RAISE EXCEPTION 'kq_invalid_culture_death'; END IF;
  ELSIF v_complete THEN
    IF p_action<>'advance' OR p_flower IS NULL
      OR p_flower->>'varietyCode' IS DISTINCT FROM p_next_state->>'varietyCode'
      OR p_flower->>'varietyName' IS DISTINCT FROM p_next_state->>'varietyName'
      OR (p_flower->>'quality')::INTEGER IS DISTINCT FROM (p_next_state->>'quality')::INTEGER
      OR jsonb_typeof(p_flower->'traits') IS DISTINCT FROM 'array'
      OR jsonb_typeof(p_flower->'combos') IS DISTINCT FROM 'array'
      OR jsonb_typeof(p_flower->'battleStats') IS DISTINCT FROM 'object'
      OR COALESCE(p_flower->>'integrityCode','') !~ '^KQ-[0-9A-F]{8}$'
    THEN RAISE EXCEPTION 'kq_invalid_flower'; END IF;
    IF v_version=3 AND (jsonb_typeof(p_flower->'cannabinoidReport') IS DISTINCT FROM 'object'
      OR p_flower->'cannabinoidReport'->'simulated' IS DISTINCT FROM 'true'::JSONB
      OR jsonb_typeof(p_flower->'cannabinoidReport'->'profile') IS DISTINCT FROM 'object'
      OR jsonb_typeof(p_flower->'cannabinoidReport'->'rates') IS DISTINCT FROM 'object'
      OR jsonb_typeof(p_flower->'cannabinoidReport'->'totals') IS DISTINCT FROM 'object'
      OR jsonb_typeof(p_flower->'cannabinoidReport'->'score') IS DISTINCT FROM 'number')
    THEN RAISE EXCEPTION 'kq_invalid_cannabinoid_report'; END IF;
    IF v_version=3 THEN
      IF (p_flower->'cannabinoidReport'->>'score')::NUMERIC NOT BETWEEN 35 AND 99
        OR p_flower->'cannabinoidReport'->'score' IS DISTINCT FROM p_next_state->'care'->'cannabinoidExpression'
        OR (SELECT count(*) FROM jsonb_object_keys(p_flower->'cannabinoidReport'->'rates'))<>14
        OR EXISTS(SELECT 1 FROM jsonb_each(p_flower->'cannabinoidReport'->'rates') AS rate(key,value)
          WHERE key NOT IN ('cbd','cbda','cbg','cbga','thc','thca','cbdv','cbdva','thcv','thcva','cbc','cbca','cbn','cbna')
            OR jsonb_typeof(value)<>'number' OR value::TEXT::NUMERIC NOT BETWEEN 0 AND 100)
        OR (SELECT count(*) FROM jsonb_object_keys(p_flower->'cannabinoidReport'->'totals'))<>7
        OR EXISTS(SELECT 1 FROM jsonb_each(p_flower->'cannabinoidReport'->'totals') AS total(key,value)
          WHERE key NOT IN ('cbd','cbg','thc','cbdv','thcv','cbc','cbn')
            OR jsonb_typeof(value)<>'number' OR value::TEXT::NUMERIC NOT BETWEEN 0 AND 100)
      THEN RAISE EXCEPTION 'kq_invalid_cannabinoid_report'; END IF;
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each(p_flower->'battleStats') AS stat(key,value)
      WHERE jsonb_typeof(value)<>'number'
        OR (key NOT IN ('appearance','aroma','vigor','mastery','regularity') AND NOT(v_version=3 AND key='cannabinoids'))
        OR value::TEXT::NUMERIC NOT BETWEEN 35 AND 99)
      OR (SELECT count(*) FROM jsonb_object_keys(p_flower->'battleStats'))<>(CASE WHEN v_version=3 THEN 6 ELSE 5 END)
    THEN RAISE EXCEPTION 'kq_invalid_flower_stats'; END IF;
    IF v_version=3 AND p_flower->'battleStats'->'cannabinoids' IS DISTINCT FROM p_flower->'cannabinoidReport'->'score'
    THEN RAISE EXCEPTION 'kq_invalid_flower_stats'; END IF;
  ELSIF p_flower IS NOT NULL THEN RAISE EXCEPTION 'kq_flower_before_completion'; END IF;
  UPDATE public.kq_runs SET state=p_next_state,
    integrity_code=CASE WHEN v_complete AND NOT v_dead THEN p_flower->>'integrityCode' ELSE integrity_code END,
    status=CASE WHEN v_dead THEN 'abandoned'::public.kq_run_status WHEN v_complete THEN 'completed'::public.kq_run_status ELSE status END,
    completed_at=CASE WHEN v_complete AND NOT v_dead THEN now() ELSE completed_at END,
    updated_at=GREATEST(clock_timestamp(),v_run.updated_at+interval '1 microsecond') WHERE id=p_run_id;
  IF v_complete AND NOT v_dead THEN
    INSERT INTO public.kq_flowers(run_id,owner_id,variety_code,variety_name,quality,traits,combos,battle_stats,rules_version,cannabinoid_report)
    VALUES(p_run_id,p_user_id,p_flower->>'varietyCode',p_flower->>'varietyName',(p_flower->>'quality')::SMALLINT,
      ARRAY(SELECT jsonb_array_elements_text(p_flower->'traits')),ARRAY(SELECT jsonb_array_elements_text(p_flower->'combos')),
      p_flower->'battleStats',v_version,CASE WHEN v_version=3 THEN p_flower->'cannabinoidReport' ELSE NULL END) RETURNING * INTO v_flower;
  END IF;
  RETURN jsonb_build_object('state',p_next_state,'flower',CASE WHEN v_complete AND NOT v_dead THEN to_jsonb(v_flower) ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_update_run_state(UUID,UUID,TIMESTAMPTZ,TEXT,JSONB,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_update_run_state(UUID,UUID,TIMESTAMPTZ,TEXT,JSONB,JSONB) TO service_role;

-- Preserve historical definitions and active v2 decks. Exclude obsolete cards
-- only from future booster draws; existing unopened packs keep their size.
DO $$
DECLARE body TEXT; anchor TEXT; replacement TEXT;
BEGIN
  body:=pg_get_functiondef('public.rpc_kq_open_support_booster(uuid,uuid)'::REGPROCEDURE);
  anchor:='WHERE collection_id = v_collection_id AND rarity = v_rarity AND is_active = TRUE';
  replacement:=anchor||' AND code NOT IN (''BOTTE-002'',''BOTTE-004'',''BOTTE-010'',''BOTTE-011'',''BOTTE-012'',''BOTTE-022'',''BOTTE-023'',''BOTTE-025'')';
  IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>2 THEN RAISE EXCEPTION 'kq_care_booster_patch_mismatch'; END IF;
  EXECUTE replace(body,anchor,replacement);

  body:=pg_get_functiondef('public.rpc_kq_finalize_bot_battle(uuid,uuid,text,jsonb,integer,jsonb,text)'::REGPROCEDURE);
  anchor:='WHERE collection_id = v_collection_id AND is_active = TRUE AND code LIKE ''BOTTE-%''';
  replacement:=anchor||' AND code NOT IN (''BOTTE-002'',''BOTTE-004'',''BOTTE-010'',''BOTTE-011'',''BOTTE-012'',''BOTTE-022'',''BOTTE-023'',''BOTTE-025'')';
  IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>2 THEN RAISE EXCEPTION 'kq_care_bot_reward_patch_mismatch'; END IF;
  EXECUTE replace(body,anchor,replacement);

  -- JSON snapshot payloads do not automatically expose a newly added column.
  body:=pg_get_functiondef('public.rpc_kq_player_core_snapshot(uuid)'::REGPROCEDURE);
  anchor:='''stats'', flower.battle_stats,';
  IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'kq_care_snapshot_patch_mismatch'; END IF;
  body:=replace(body,anchor,anchor||' ''rulesVersion'', flower.rules_version, ''cannabinoidReport'', flower.cannabinoid_report,');
  anchor:='''battle_stats'', flower_one.battle_stats,';
  IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'kq_care_snapshot_patch_mismatch'; END IF;
  body:=replace(body,anchor,anchor||' ''rules_version'', flower_one.rules_version, ''cannabinoid_report'', flower_one.cannabinoid_report,');
  anchor:='''battle_stats'', flower_two.battle_stats,';
  IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'kq_care_snapshot_patch_mismatch'; END IF;
  body:=replace(body,anchor,anchor||' ''rules_version'', flower_two.rules_version, ''cannabinoid_report'', flower_two.cannabinoid_report,');
  anchor:='''battle_stats'', flower.battle_stats,';
  IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'kq_care_snapshot_patch_mismatch'; END IF;
  body:=replace(body,anchor,anchor||' ''rules_version'', flower.rules_version, ''cannabinoid_report'', flower.cannabinoid_report,');
  EXECUTE body;
END $$;

COMMIT;
