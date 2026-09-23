BEGIN;

-- One fleet entry describes identical equipment in every production unit.
-- Existing players and immutable historical cultures keep their original unit.
ALTER TABLE public.kq_equipment_wallets ADD COLUMN production_units INTEGER NOT NULL DEFAULT 1
  CHECK (production_units IN (1,2,3,4,8));
COMMENT ON COLUMN public.kq_equipment_wallets.production_units IS
  '1 to 4 identical tents; 8 is two warehouses of four tents. Levels and condition are shared across the fleet.';

CREATE TABLE public.kq_production_expansions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_key UUID NOT NULL,
  previous_units INTEGER NOT NULL CHECK (previous_units IN (1,2,3,4)),
  production_units INTEGER NOT NULL CHECK (production_units=CASE WHEN previous_units=4 THEN 8 ELSE previous_units+1 END),
  price_cents INTEGER NOT NULL CHECK (price_cents>0),
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,request_key)
);
ALTER TABLE public.kq_production_expansions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_production_expansions FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_run_production_units(p_state JSONB) RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE WHEN p_state->'equipment'->>'productionUnits' IN ('1','2','3','4','8')
    THEN (p_state->'equipment'->>'productionUnits')::INTEGER ELSE 1 END;
$$;

CREATE FUNCTION public.rpc_kq_expand_production(
  p_user_id UUID,p_request_key UUID,p_expected_units INTEGER,p_expected_cost_cents INTEGER
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  old public.kq_production_expansions%ROWTYPE; units INTEGER; target INTEGER; added INTEGER;
  cash INTEGER; starter INTEGER:=30000; replicas BIGINT:=0; property_cost INTEGER:=0; cost BIGINT;
  gear RECORD; result JSONB;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL OR p_expected_units IS NULL
    OR p_expected_units NOT IN (1,2,3,4,8) OR p_expected_cost_cents IS NULL OR p_expected_cost_cents<=0 THEN
    RAISE EXCEPTION 'production_invalid_request';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  SELECT * INTO old FROM public.kq_production_expansions WHERE user_id=p_user_id AND request_key=p_request_key;
  IF FOUND THEN
    IF old.previous_units<>p_expected_units OR old.price_cents<>p_expected_cost_cents THEN
      RAISE EXCEPTION 'production_request_mismatch';
    END IF;
    RETURN old.receipt||'{"replayed":true}'::JSONB;
  END IF;
  PERFORM public.kq_business_settle(p_user_id);
  SELECT production_units,cash_cents INTO units,cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'production_invalid_request'; END IF;
  IF units<>p_expected_units THEN RAISE EXCEPTION 'production_units_changed'; END IF;
  IF units=8 THEN RAISE EXCEPTION 'production_max_units'; END IF;
  IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='active') THEN
    RAISE EXCEPTION 'production_active_run';
  END IF;
  -- Shared condition is retained, including wear and version counters. An expansion
  -- cannot bypass overdue maintenance or buy unusable copies.
  IF EXISTS(SELECT 1 FROM public.kq_player_equipment e JOIN public.kq_equipment_catalog c ON c.code=e.equipment_code
    WHERE e.user_id=p_user_id AND e.purchase_price_cents>0 AND c.is_active AND
      ((e.culture_wear_percent=100 AND public.kq_culture_equipment_wear_delta(e.equipment_code,'balanced',0)>0)
       OR (c.category='processing' AND c.code<>'SIFT-TRAY' AND e.wear_cycles>=public.kq_machine_interval(e.equipment_code,e.level)))) THEN
    RAISE EXCEPTION 'production_equipment_maintenance';
  END IF;
  target:=CASE WHEN units=4 THEN 8 ELSE units+1 END;
  added:=target-units;
  IF target=8 THEN property_cost:=2000000; END IF;
  SELECT 30000-COALESCE(SUM(base.cost),0)::INTEGER INTO starter
  FROM (VALUES('tent',12000),('lighting',12000),('air',6000)) base(slot,cost)
  WHERE EXISTS(SELECT 1 FROM public.kq_player_equipment e JOIN public.kq_equipment_catalog c ON c.code=e.equipment_code
    WHERE e.user_id=p_user_id AND e.purchase_price_cents>0 AND c.is_active AND c.slot=base.slot);
  SELECT COALESCE(SUM(c.price_cents + COALESCE((SELECT SUM(CEIL(c.price_cents::NUMERIC * step / 10))
    FROM generate_series(1,e.level-1) step),0)),0)::BIGINT INTO replicas
  FROM public.kq_player_equipment e JOIN public.kq_equipment_catalog c ON c.code=e.equipment_code
  WHERE e.user_id=p_user_id AND e.purchase_price_cents>0 AND c.is_active;
  cost:=property_cost+(starter+replicas)*added;
  IF cost<>p_expected_cost_cents THEN RAISE EXCEPTION 'production_price_changed'; END IF;
  IF cash<cost THEN RAISE EXCEPTION 'production_insufficient_cash'; END IF;
  UPDATE public.kq_equipment_wallets SET production_units=target,cash_cents=cash_cents-cost,updated_at=now() WHERE user_id=p_user_id;
  -- Record each cloned asset against its equipment code so later replacement
  -- retires every copy in the existing treasury accounting.
  FOR gear IN SELECT e.equipment_code,c.price_cents,
    c.price_cents+COALESCE((SELECT SUM(CEIL(c.price_cents::NUMERIC * step / 10)) FROM generate_series(1,e.level-1) step),0) AS cost
    FROM public.kq_player_equipment e JOIN public.kq_equipment_catalog c ON c.code=e.equipment_code
    WHERE e.user_id=p_user_id AND e.purchase_price_cents>0 AND c.is_active ORDER BY e.equipment_code
  LOOP
    UPDATE public.kq_player_equipment SET purchase_price_cents=purchase_price_cents+gear.price_cents*added
      WHERE user_id=p_user_id AND equipment_code=gear.equipment_code;
    PERFORM public.kq_treasury_add_asset(p_user_id,'production:'||p_request_key::TEXT||':'||gear.equipment_code,
      'equipment','expense_depreciation',(gear.cost*added)::BIGINT,now(),4320,gear.equipment_code);
  END LOOP;
  IF starter>0 THEN
    PERFORM public.kq_treasury_add_asset(p_user_id,'production:'||p_request_key::TEXT||':starter',
      'equipment','expense_depreciation',(starter*added)::BIGINT,now(),4320,'STARTER-KIT');
  END IF;
  IF property_cost>0 THEN
    PERFORM public.kq_treasury_add_asset(p_user_id,'production:'||p_request_key::TEXT||':warehouse',
      'equipment','expense_depreciation',property_cost::BIGINT,now(),4320,'WAREHOUSE-EXTENSION');
  END IF;
  UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
  result:=jsonb_build_object('productionUnits',target,'previousUnits',units,'addedUnits',added,
    'priceCents',cost,'cashAfterCents',cash-cost,'replayed',false);
  INSERT INTO public.kq_production_expansions(user_id,request_key,previous_units,production_units,price_cents,receipt)
    VALUES(p_user_id,p_request_key,units,target,cost,result);
  RETURN result;
END $$;

-- Re-declare the current equipment routines with explicit fleet pricing. Keep
-- business settlement before spending, as installed by the business calendar.

CREATE OR REPLACE FUNCTION public.rpc_kq_purchase_equipment(
  p_user_id UUID,
  p_request_key UUID,
  p_equipment_codes TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codes TEXT[] := COALESCE(p_equipment_codes, ARRAY[]::TEXT[]);
  v_count INTEGER;
  v_valid_count INTEGER;
  v_distinct_count INTEGER;
  v_owned_count INTEGER;
  v_total INTEGER;
  v_cash INTEGER;
  v_units INTEGER;
  v_purchase_id UUID := gen_random_uuid();
  v_existing public.kq_equipment_purchase_receipts%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL THEN RAISE EXCEPTION 'invalid_equipment_purchase'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || p_user_id::TEXT, 0));
  PERFORM public.kq_business_settle(p_user_id);

  SELECT * INTO v_existing
  FROM public.kq_equipment_purchase_receipts
  WHERE user_id = p_user_id AND request_key = p_request_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'purchaseId', v_existing.id,
      'equipmentCodes', to_jsonb(v_existing.equipment_codes),
      'totalPriceCents', v_existing.total_price_cents,
      'cashAfterCents', v_existing.cash_after_cents,
      'replayed', TRUE
    );
  END IF;

  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
  v_count := cardinality(v_codes);
  IF v_count < 1 OR v_count > 8 THEN RAISE EXCEPTION 'invalid_equipment_count'; END IF;

  SELECT COUNT(DISTINCT item.code)
  INTO v_distinct_count
  FROM unnest(v_codes) AS item(code);
  IF v_distinct_count <> v_count THEN RAISE EXCEPTION 'duplicate_equipment'; END IF;

  SELECT COUNT(*), COALESCE(SUM(price_cents), 0)
  INTO v_valid_count, v_total
  FROM public.kq_equipment_catalog
  WHERE code = ANY(v_codes) AND is_active = TRUE AND is_purchasable = TRUE;
  IF v_valid_count <> v_count OR v_total <= 0 THEN RAISE EXCEPTION 'equipment_unavailable'; END IF;

  SELECT COUNT(*) INTO v_owned_count
  FROM public.kq_player_equipment
  WHERE user_id = p_user_id AND equipment_code = ANY(v_codes);
  IF v_owned_count > 0 THEN RAISE EXCEPTION 'equipment_already_owned'; END IF;

  SELECT cash_cents,production_units INTO v_cash,v_units
  FROM public.kq_equipment_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  v_total := v_total * v_units;
  IF v_cash < v_total THEN RAISE EXCEPTION 'insufficient_equipment_cash'; END IF;

  UPDATE public.kq_equipment_wallets
  SET cash_cents = cash_cents - v_total, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.kq_player_equipment(user_id, equipment_code, purchase_price_cents)
  SELECT p_user_id, code, price_cents * v_units
  FROM public.kq_equipment_catalog
  WHERE code = ANY(v_codes);

  INSERT INTO public.kq_equipment_purchase_receipts(
    id, request_key, user_id, equipment_codes, total_price_cents, cash_after_cents
  ) VALUES (
    v_purchase_id, p_request_key, p_user_id, v_codes, v_total, v_cash - v_total
  );

  RETURN jsonb_build_object(
    'purchaseId', v_purchase_id,
    'equipmentCodes', to_jsonb(v_codes),
    'totalPriceCents', v_total,
    'cashAfterCents', v_cash - v_total,
    'replayed', FALSE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_upgrade_equipment(
  p_user_id UUID, p_request_key UUID, p_equipment_code TEXT, p_expected_level INTEGER
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing public.kq_equipment_upgrade_receipts%ROWTYPE;
  v_level INTEGER;
  v_price INTEGER;
  v_cash INTEGER;
  v_units INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL OR p_equipment_code IS NULL
    OR p_expected_level IS NULL OR p_expected_level NOT BETWEEN 1 AND 9 THEN
    RAISE EXCEPTION 'invalid_equipment_upgrade';
  END IF;
  -- Same lock as purchases and installation; the wallet row also serializes sales.
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || p_user_id::TEXT, 0));
  PERFORM public.kq_business_settle(p_user_id);
  SELECT * INTO v_existing FROM public.kq_equipment_upgrade_receipts
    WHERE user_id = p_user_id AND request_key = p_request_key;
  IF FOUND THEN
    IF v_existing.equipment_code <> p_equipment_code OR v_existing.previous_level <> p_expected_level THEN
      RAISE EXCEPTION 'equipment_upgrade_request_mismatch';
    END IF;
    RETURN jsonb_build_object('equipmentCode',v_existing.equipment_code,'level',v_existing.level,
      'priceCents',v_existing.price_cents,'cashAfterCents',v_existing.cash_after_cents,'replayed',TRUE);
  END IF;
  SELECT cash_cents,production_units INTO v_cash,v_units FROM public.kq_equipment_wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment_not_purchased'; END IF;
  SELECT owned.level, CEIL(catalog.price_cents::NUMERIC * owned.level / 10)::INTEGER * v_units INTO v_level,v_price
  FROM public.kq_player_equipment owned JOIN public.kq_equipment_catalog catalog ON catalog.code = owned.equipment_code
  WHERE owned.user_id = p_user_id AND owned.equipment_code = p_equipment_code
    AND owned.purchase_price_cents > 0 AND catalog.is_active AND catalog.is_purchasable
  FOR UPDATE OF owned;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment_not_purchased'; END IF;
  IF v_level >= 10 THEN RAISE EXCEPTION 'equipment_max_level'; END IF;
  IF v_level <> p_expected_level THEN RAISE EXCEPTION 'equipment_level_changed'; END IF;
  IF v_cash < v_price THEN RAISE EXCEPTION 'insufficient_equipment_cash'; END IF;
  UPDATE public.kq_equipment_wallets SET cash_cents = cash_cents - v_price, updated_at = now() WHERE user_id = p_user_id;
  UPDATE public.kq_player_equipment SET level = level + 1 WHERE user_id = p_user_id AND equipment_code = p_equipment_code;
  INSERT INTO public.kq_equipment_upgrade_receipts(user_id,request_key,equipment_code,previous_level,level,price_cents,cash_after_cents)
    VALUES(p_user_id,p_request_key,p_equipment_code,v_level,v_level+1,v_price,v_cash-v_price);
  RETURN jsonb_build_object('equipmentCode',p_equipment_code,'level',v_level+1,
    'priceCents',v_price,'cashAfterCents',v_cash-v_price,'replayed',FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_repair_machine(p_user_id UUID,p_equipment_code TEXT,p_expected_version INTEGER,p_expected_cost_cents INTEGER,p_request_key UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE gear public.kq_player_equipment%ROWTYPE; catalog public.kq_equipment_catalog%ROWTYPE;
 old public.kq_machine_repairs%ROWTYPE; cash INTEGER; cost INTEGER; units INTEGER; result JSONB;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR p_expected_version IS NULL OR p_expected_cost_cents IS NULL THEN RAISE EXCEPTION 'machine_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM public.kq_business_settle(p_user_id);
 SELECT cash_cents,production_units INTO cash,units FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'machine_not_owned'; END IF;
 SELECT * INTO old FROM public.kq_machine_repairs WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF old.equipment_code<>p_equipment_code OR old.expected_version<>p_expected_version OR (old.receipt->>'paidCents')::INTEGER<>p_expected_cost_cents THEN RAISE EXCEPTION 'machine_request_mismatch'; END IF;
  RETURN old.receipt||'{"replayed":true}'::JSONB;
 END IF;
 SELECT * INTO gear FROM public.kq_player_equipment WHERE user_id=p_user_id AND equipment_code=p_equipment_code FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'machine_not_owned'; END IF;
 SELECT * INTO catalog FROM public.kq_equipment_catalog WHERE code=p_equipment_code AND category='processing' AND code<>'SIFT-TRAY' AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'machine_unavailable'; END IF;
 IF gear.maintenance_version<>p_expected_version THEN RAISE EXCEPTION 'machine_condition_changed'; END IF;
 IF gear.wear_cycles<public.kq_machine_interval(gear.equipment_code,gear.level) THEN RAISE EXCEPTION 'machine_not_due'; END IF;
 cost:=CASE WHEN EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength='handyperson') THEN 0
  ELSE LEAST(20000,GREATEST(1000,CEIL(catalog.price_cents*.06*(1+(gear.level-1)*.05)))) END;
 cost:=cost*units;
 IF cost<>p_expected_cost_cents THEN RAISE EXCEPTION 'machine_condition_changed'; END IF;
 IF cash<cost THEN RAISE EXCEPTION 'machine_insufficient_cash'; END IF;
 UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-cost,updated_at=now() WHERE user_id=p_user_id;
 UPDATE public.kq_player_equipment SET wear_cycles=0,maintenance_version=maintenance_version+1 WHERE user_id=p_user_id AND equipment_code=p_equipment_code;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 result:=jsonb_build_object('equipmentCode',p_equipment_code,'paidCents',cost,'cashAfterCents',cash-cost,'version',gear.maintenance_version+1,'replayed',false);
 INSERT INTO public.kq_machine_repairs(user_id,request_key,equipment_code,expected_version,receipt) VALUES(p_user_id,p_request_key,p_equipment_code,p_expected_version,result);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_replace_culture_equipment(
  p_user_id UUID,p_equipment_code TEXT,p_expected_version INTEGER,p_expected_cost_cents INTEGER,p_request_key UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE gear public.kq_player_equipment%ROWTYPE; catalog public.kq_equipment_catalog%ROWTYPE;
  old public.kq_culture_equipment_replacements%ROWTYPE; cash INTEGER; cost INTEGER; units INTEGER; result JSONB;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL OR NULLIF(BTRIM(p_equipment_code),'') IS NULL
    OR p_expected_version IS NULL OR p_expected_version<0
    OR p_expected_cost_cents IS NULL OR p_expected_cost_cents<=0 THEN
    RAISE EXCEPTION 'culture_equipment_invalid_request';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || p_user_id::TEXT,0));
  PERFORM public.kq_business_settle(p_user_id);
  SELECT cash_cents,production_units INTO cash,units FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'culture_equipment_not_owned'; END IF;
  SELECT * INTO old FROM public.kq_culture_equipment_replacements WHERE user_id=p_user_id AND request_key=p_request_key;
  IF FOUND THEN
    IF old.equipment_code<>p_equipment_code OR old.expected_version<>p_expected_version
      OR (old.receipt->>'paidCents')::INTEGER<>p_expected_cost_cents THEN
      RAISE EXCEPTION 'culture_equipment_request_mismatch';
    END IF;
    RETURN old.receipt || '{"replayed":true}'::JSONB;
  END IF;
  IF EXISTS (SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='active') THEN
    RAISE EXCEPTION 'culture_equipment_active_run';
  END IF;
  SELECT * INTO gear FROM public.kq_player_equipment WHERE user_id=p_user_id AND equipment_code=p_equipment_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'culture_equipment_not_owned'; END IF;
  SELECT * INTO catalog FROM public.kq_equipment_catalog WHERE code=p_equipment_code AND is_active AND is_purchasable;
  IF NOT FOUND OR gear.purchase_price_cents<=0 OR public.kq_culture_equipment_wear_delta(p_equipment_code,'balanced',0)=0 THEN
    RAISE EXCEPTION 'culture_equipment_unavailable';
  END IF;
  IF gear.culture_wear_version<>p_expected_version THEN RAISE EXCEPTION 'culture_equipment_condition_changed'; END IF;
  IF gear.culture_wear_percent<100 THEN RAISE EXCEPTION 'culture_equipment_not_due'; END IF;
  cost := CEIL(catalog.price_cents::NUMERIC*(100+(gear.level-1)*10)/100)::INTEGER;
  cost:=cost*units;
  IF cost<>p_expected_cost_cents THEN RAISE EXCEPTION 'culture_equipment_condition_changed'; END IF;
  IF cash<cost THEN RAISE EXCEPTION 'culture_equipment_insufficient_cash'; END IF;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-cost,updated_at=now() WHERE user_id=p_user_id;
  UPDATE public.kq_player_equipment SET culture_wear_percent=0,culture_wear_version=culture_wear_version+1
    WHERE user_id=p_user_id AND equipment_code=p_equipment_code;
  IF to_regclass('public.kq_commerce_accounts') IS NOT NULL THEN
    UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
  END IF;
  result := jsonb_build_object('equipmentCode',p_equipment_code,'paidCents',cost,'cashAfterCents',cash-cost,
    'version',gear.culture_wear_version+1,'level',gear.level,'replayed',false);
  INSERT INTO public.kq_culture_equipment_replacements(user_id,request_key,equipment_code,expected_version,receipt)
    VALUES(p_user_id,p_request_key,p_equipment_code,p_expected_version,result);
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.kq_guard_culture_equipment_start() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE requested TEXT[]; expected TEXT[]; units INTEGER;
BEGIN
  IF NEW.status::TEXT<>'active' THEN RETURN NEW; END IF;
  -- Same order as purchases/upgrades/replacements. Recheck the snapshot while locked.
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || NEW.user_id::TEXT,0));
  PERFORM public.rpc_kq_ensure_equipment_profile(NEW.user_id);
  SELECT production_units INTO units FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
  IF COALESCE(NEW.state->'equipment'->'productionUnits','1'::JSONB) IS DISTINCT FROM to_jsonb(units) THEN
    RAISE EXCEPTION 'kq_production_units_changed';
  END IF;
  IF jsonb_typeof(NEW.state->'equipment'->'codes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'kq_culture_equipment_changed';
  END IF;
  SELECT COALESCE(array_agg(code ORDER BY code),ARRAY[]::TEXT[]) INTO requested
    FROM jsonb_array_elements_text(NEW.state->'equipment'->'codes') item(code);
  IF EXISTS (SELECT 1 FROM public.kq_player_equipment WHERE user_id=NEW.user_id
    AND equipment_code=ANY(requested) AND culture_wear_percent=100
    AND public.kq_culture_equipment_wear_delta(equipment_code,'balanced',0)>0) THEN
    RAISE EXCEPTION 'kq_culture_equipment_broken';
  END IF;
  WITH usable AS (
    SELECT e.equipment_code,c.slot FROM public.kq_equipment_loadouts l
    JOIN public.kq_player_equipment e ON e.user_id=l.user_id AND e.equipment_code=l.equipment_code
    JOIN public.kq_equipment_catalog c ON c.code=e.equipment_code
    WHERE l.user_id=NEW.user_id AND c.is_active AND (NOT c.is_purchasable OR e.purchase_price_cents>0)
      AND (public.kq_culture_equipment_wear_delta(e.equipment_code,'balanced',0)=0 OR e.culture_wear_percent<100)
  ), effective AS (
    SELECT equipment_code FROM usable
    UNION ALL
    SELECT starter.code FROM (VALUES ('tent','TENT-080-STARTER'),('lighting','LED-150-STARTER'),('air','AIR-STARTER')) starter(slot,code)
      WHERE NOT EXISTS (SELECT 1 FROM usable WHERE usable.slot=starter.slot)
  ) SELECT array_agg(equipment_code ORDER BY equipment_code) INTO expected FROM effective;
  IF requested IS DISTINCT FROM expected THEN RAISE EXCEPTION 'kq_culture_equipment_changed'; END IF;
  IF EXISTS (SELECT 1 FROM public.kq_player_equipment e WHERE e.user_id=NEW.user_id
    AND e.equipment_code=ANY(requested)
    AND COALESCE(NEW.state->'equipment'->'levels'->e.equipment_code,'1'::JSONB) IS DISTINCT FROM to_jsonb(e.level)) THEN
    RAISE EXCEPTION 'kq_culture_equipment_changed';
  END IF;
  RETURN NEW;
END $$;

-- The capacity snapshot stays immutable even on a legacy run without energy.
CREATE OR REPLACE FUNCTION public.kq_lock_run_energy() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.state->'energy' IS DISTINCT FROM OLD.state->'energy'
    OR (OLD.state ? 'energy' AND NEW.state->'equipment' IS DISTINCT FROM OLD.state->'equipment')
    OR NEW.state->'equipment'->'productionUnits' IS DISTINCT FROM OLD.state->'equipment'->'productionUnits'
  THEN RAISE EXCEPTION 'kq_energy_quote_immutable'; END IF;
  RETURN NEW;
END $$;

ALTER TABLE public.kq_lab_invoices DROP CONSTRAINT kq_lab_invoices_amount_cents_check;
ALTER TABLE public.kq_lab_invoices ADD CONSTRAINT kq_lab_invoices_amount_cents_check
  CHECK(amount_cents IN (4500,9000,13500,18000,36000));

CREATE OR REPLACE FUNCTION public.kq_invoice_completed_lab() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cost INTEGER;
BEGIN
 IF NEW.status::TEXT='completed' AND OLD.status::TEXT<>'completed' THEN
  PERFORM public.kq_business_settle(NEW.user_id);
  cost:=4500*public.kq_run_production_units(NEW.state);
  INSERT INTO public.kq_lab_invoices(run_id,user_id,amount_cents,remaining_cents) VALUES(NEW.id,NEW.user_id,cost,cost) ON CONFLICT(run_id) DO NOTHING;
  IF FOUND THEN
   INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents) VALUES(NEW.user_id,'lab-issued',cost);
   UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=NEW.user_id;
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.kq_invoice_completed_cycle() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_energy INTEGER := 0; v_care INTEGER := 0; v_paid INTEGER := 0;
  v_units INTEGER; v_cycle INTEGER; v_vet INTEGER; v_cash INTEGER; v_dog JSONB; v_quote JSONB;
BEGIN
  IF NEW.status::TEXT <> 'completed' OR OLD.status::TEXT = 'completed' THEN RETURN NEW; END IF;
  PERFORM public.rpc_kq_ensure_equipment_profile(NEW.user_id);
  SELECT cash_cents INTO v_cash FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.kq_energy_invoices WHERE run_id=NEW.id) THEN RETURN NEW; END IF;

  v_units := public.kq_run_production_units(NEW.state);
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
    v_vet := CASE WHEN v_cycle % 10 = 0 THEN 4000*v_units ELSE 0 END;
    v_care := 800*v_units + v_vet;
    v_paid := LEAST(v_cash,v_care);
    v_dog := jsonb_build_object('cycle',v_cycle,'foodCents',800*v_units,'vetCents',v_vet,'totalCents',v_care,'paidCents',v_paid);
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
  WITH care AS (SELECT COUNT(*)::INTEGER AS cycles FROM public.kq_energy_invoices WHERE user_id=p_user_id AND dog_care IS NOT NULL),
  fleet AS (SELECT COALESCE((SELECT production_units FROM public.kq_equipment_wallets WHERE user_id=p_user_id),1) AS units)
  SELECT jsonb_build_object(
    'outstandingCents',COALESCE(SUM(remaining_cents),0),
    'invoiceCount',COUNT(*),
    'bestGramsPerKwh',MAX(CASE WHEN (quote->>'totalWattHours')::NUMERIC>0 THEN ROUND(harvest_grams*1000/(quote->>'totalWattHours')::NUMERIC,2) ELSE NULL END),
    'dogCare',CASE WHEN EXISTS(SELECT 1 FROM public.kq_player_equipment WHERE user_id=p_user_id AND equipment_code='SECURITY-DOG') THEN
      (SELECT jsonb_build_object('completedCycles',cycles,'nextCycle',cycles+1,'cyclesUntilVet',10-cycles%10,
        'foodCents',800*units,'vetCents',4000*units,'nextTotalCents',(800+CASE WHEN (cycles+1)%10=0 THEN 4000 ELSE 0 END)*units) FROM care CROSS JOIN fleet)
      ELSE NULL END,
    'invoices',COALESCE((SELECT jsonb_agg(jsonb_build_object('runId',i.run_id,'createdAt',i.created_at,
      'totalCents',i.total_cents,'remainingCents',i.remaining_cents,'harvestGrams',i.harvest_grams,'quote',i.quote,'dogCare',i.dog_care) ORDER BY i.created_at DESC,i.run_id)
      FROM (SELECT * FROM public.kq_energy_invoices WHERE user_id=p_user_id ORDER BY created_at DESC,run_id LIMIT 20) i),'[]'::JSONB)
  ) FROM public.kq_energy_invoices WHERE user_id=p_user_id;
$$;

-- Harvest ceilings apply per tent; stored historical lots retain their quantities.
ALTER TABLE public.kq_market_lots DROP CONSTRAINT kq_market_lots_harvest_grams_check;
ALTER TABLE public.kq_market_lots ADD CONSTRAINT kq_market_lots_harvest_grams_check CHECK(harvest_grams BETWEEN 20 AND 4000);

CREATE OR REPLACE FUNCTION public.rpc_kq_prepare_market_lot(
  p_user_id UUID,
  p_flower_id UUID,
  p_harvest_grams NUMERIC,
  p_jury_score NUMERIC,
  p_quality_band TEXT,
  p_equipment_codes TEXT[],
  p_options JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot public.kq_market_lots%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_flower_id IS NULL
    OR p_harvest_grams IS NULL OR p_harvest_grams NOT BETWEEN 20 AND 4000
    OR p_jury_score NOT BETWEEN 0 AND 10
    OR p_quality_band NOT IN ('biomass', 'standard', 'selection', 'premium', 'signature')
    OR p_options IS NULL OR jsonb_typeof(p_options) <> 'array'
  THEN RAISE EXCEPTION 'invalid_market_lot'; END IF;

  PERFORM id FROM public.kq_flowers
  WHERE id = p_flower_id AND owner_id = p_user_id AND status = 'burned';
  IF NOT FOUND THEN RAISE EXCEPTION 'market_flower_not_burned'; END IF;

  INSERT INTO public.kq_market_lots(
    flower_id, owner_id, harvest_grams, jury_score, quality_band,
    equipment_codes, options
  ) VALUES (
    p_flower_id, p_user_id, ROUND(p_harvest_grams, 1), ROUND(p_jury_score, 1),
    p_quality_band, COALESCE(p_equipment_codes, ARRAY[]::TEXT[]), p_options
  )
  ON CONFLICT (flower_id) DO UPDATE SET
    equipment_codes = EXCLUDED.equipment_codes,
    options = EXCLUDED.options,
    updated_at = now()
  WHERE public.kq_market_lots.owner_id = p_user_id
    AND public.kq_market_lots.status = 'ready'
  RETURNING * INTO v_lot;

  IF NOT FOUND THEN
    SELECT * INTO v_lot FROM public.kq_market_lots
    WHERE flower_id = p_flower_id AND owner_id = p_user_id;
  END IF;

  RETURN to_jsonb(v_lot);
END;
$$;

-- The displayed fleet size is part of a fresh purchase/upgrade quote. A receipt
-- replay remains valid after later expansions, without charging a second time.
CREATE FUNCTION public.rpc_kq_purchase_production_equipment(
  p_user_id UUID,p_request_key UUID,p_equipment_codes TEXT[],p_expected_units INTEGER DEFAULT 1
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE units INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL OR p_expected_units IS NULL OR p_expected_units NOT IN (1,2,3,4,8) THEN
    RAISE EXCEPTION 'production_invalid_request';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  IF NOT EXISTS(SELECT 1 FROM public.kq_equipment_purchase_receipts WHERE user_id=p_user_id AND request_key=p_request_key) THEN
    PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
    SELECT production_units INTO units FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
    IF units<>p_expected_units THEN RAISE EXCEPTION 'production_units_changed'; END IF;
  END IF;
  RETURN public.rpc_kq_purchase_equipment(p_user_id,p_request_key,p_equipment_codes);
END $$;

CREATE FUNCTION public.rpc_kq_upgrade_production_equipment(
  p_user_id UUID,p_request_key UUID,p_equipment_code TEXT,p_expected_level INTEGER,p_expected_units INTEGER DEFAULT 1
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE units INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL OR p_expected_units IS NULL OR p_expected_units NOT IN (1,2,3,4,8) THEN
    RAISE EXCEPTION 'production_invalid_request';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  IF NOT EXISTS(SELECT 1 FROM public.kq_equipment_upgrade_receipts WHERE user_id=p_user_id AND request_key=p_request_key) THEN
    PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
    SELECT production_units INTO units FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
    IF units<>p_expected_units THEN RAISE EXCEPTION 'production_units_changed'; END IF;
  END IF;
  RETURN public.rpc_kq_upgrade_equipment(p_user_id,p_request_key,p_equipment_code,p_expected_level);
END $$;

REVOKE ALL ON FUNCTION public.rpc_kq_purchase_production_equipment(UUID,UUID,TEXT[],INTEGER),
  public.rpc_kq_upgrade_production_equipment(UUID,UUID,TEXT,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_purchase_production_equipment(UUID,UUID,TEXT[],INTEGER),
  public.rpc_kq_upgrade_production_equipment(UUID,UUID,TEXT,INTEGER,INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.kq_run_production_units(JSONB),
  public.rpc_kq_expand_production(UUID,UUID,INTEGER,INTEGER),
  public.rpc_kq_purchase_equipment(UUID,UUID,TEXT[]),public.rpc_kq_upgrade_equipment(UUID,UUID,TEXT,INTEGER),
  public.rpc_kq_repair_machine(UUID,TEXT,INTEGER,INTEGER,UUID),public.rpc_kq_replace_culture_equipment(UUID,TEXT,INTEGER,INTEGER,UUID),
  public.kq_guard_culture_equipment_start(),public.kq_lock_run_energy(),public.kq_invoice_completed_lab(),public.kq_invoice_completed_cycle(),
  public.rpc_kq_energy_snapshot(UUID),public.rpc_kq_prepare_market_lot(UUID,UUID,NUMERIC,NUMERIC,TEXT,TEXT[],JSONB)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_expand_production(UUID,UUID,INTEGER,INTEGER),
  public.rpc_kq_purchase_equipment(UUID,UUID,TEXT[]),public.rpc_kq_upgrade_equipment(UUID,UUID,TEXT,INTEGER),
  public.rpc_kq_repair_machine(UUID,TEXT,INTEGER,INTEGER,UUID),public.rpc_kq_replace_culture_equipment(UUID,TEXT,INTEGER,INTEGER,UUID),
  public.rpc_kq_energy_snapshot(UUID),public.rpc_kq_prepare_market_lot(UUID,UUID,NUMERIC,NUMERIC,TEXT,TEXT[],JSONB)
  TO service_role;

COMMIT;
