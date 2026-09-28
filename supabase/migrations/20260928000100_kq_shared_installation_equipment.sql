BEGIN;

-- Every acquired model belongs to the installation. Physical tents add capacity;
-- their selected number no longer identifies a separate copy of any equipment.
-- Historical receipts, wallets and frozen runs are never rewritten.
LOCK TABLE public.kq_equipment_wallets,public.kq_player_equipment,
 public.kq_equipment_loadouts,public.kq_treasury_assets IN SHARE ROW EXCLUSIVE MODE;

-- Keep the processing-only predicate unchanged: old frozen shared snapshots use it.
CREATE OR REPLACE FUNCTION public.kq_equipment_storage_tent(p_code TEXT,p_tent INTEGER) RETURNS INTEGER
LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM public.kq_equipment_catalog WHERE code=p_code) THEN 1 ELSE p_tent END;
$$;

-- Prefer a paid installed model over a free starter, then the first tent, then
-- the highest original installed level and lowest source tent. Reserve models
-- remain acquired without silently replacing the player's installed choice.
CREATE TEMP TABLE kq_installation_installed ON COMMIT DROP AS
 SELECT DISTINCT ON(l.user_id,l.slot) l.user_id,l.slot,l.equipment_code,l.equipped_at
 FROM public.kq_equipment_loadouts l JOIN public.kq_player_equipment e USING(user_id,tent_number,equipment_code)
 ORDER BY l.user_id,l.slot,(e.purchase_price_cents>0) DESC,(l.tent_number=1) DESC,
  e.level DESC,l.tent_number,l.equipment_code;
CREATE TEMP TABLE kq_installation_owned ON COMMIT DROP AS
 SELECT user_id,equipment_code,SUM(purchase_price_cents)::INTEGER purchase_price_cents,
  MIN(acquired_at) acquired_at,MAX(level) level,MAX(wear_cycles) wear_cycles,
  MAX(maintenance_version) maintenance_version,MAX(culture_wear_percent) culture_wear_percent,
  MAX(culture_wear_version) culture_wear_version
 FROM public.kq_player_equipment GROUP BY user_id,equipment_code;

-- Restoring a previously installed broken model must preserve its condition.
-- The normal guard is restored before this transaction becomes visible.
ALTER TABLE public.kq_equipment_loadouts DISABLE TRIGGER kq_guard_culture_equipment_loadout;
DELETE FROM public.kq_equipment_loadouts;
INSERT INTO public.kq_player_equipment(user_id,tent_number,equipment_code,purchase_price_cents,acquired_at,
 level,wear_cycles,maintenance_version,culture_wear_percent,culture_wear_version)
 SELECT user_id,1,equipment_code,purchase_price_cents,acquired_at,level,wear_cycles,maintenance_version,culture_wear_percent,culture_wear_version
 FROM kq_installation_owned
 ON CONFLICT(user_id,tent_number,equipment_code) DO UPDATE SET
  purchase_price_cents=EXCLUDED.purchase_price_cents,acquired_at=EXCLUDED.acquired_at,level=EXCLUDED.level,
  wear_cycles=EXCLUDED.wear_cycles,maintenance_version=EXCLUDED.maintenance_version,
  culture_wear_percent=EXCLUDED.culture_wear_percent,culture_wear_version=EXCLUDED.culture_wear_version;
DELETE FROM public.kq_player_equipment WHERE tent_number<>1;
INSERT INTO public.kq_equipment_loadouts(user_id,tent_number,slot,equipment_code,equipped_at)
 SELECT user_id,1,slot,equipment_code,equipped_at FROM kq_installation_installed;
ALTER TABLE public.kq_equipment_loadouts ENABLE TRIGGER kq_guard_culture_equipment_loadout;
-- Preserve every separate amortization schedule and its remaining value.
-- Physical expansion/warehouse assets and retired assets retain their history.
UPDATE public.kq_treasury_assets a SET tent_number=1
 WHERE a.retired_at IS NULL AND EXISTS(SELECT 1 FROM public.kq_equipment_catalog c WHERE c.code=a.equipment_code);

-- The existing two storage triggers now protect every slot, not just processing.
CREATE OR REPLACE FUNCTION public.kq_guard_shared_workshop_storage() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.tent_number IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'equipment_shared_installation_only'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_ensure_equipment_profile(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'invalid_equipment_user'; END IF;
 INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
 INSERT INTO public.kq_player_equipment(user_id,tent_number,equipment_code,purchase_price_cents)
 SELECT p_user_id,1,code,0 FROM (VALUES('TENT-080-STARTER'),('LED-150-STARTER'),('AIR-STARTER')) starter(code)
 ON CONFLICT(user_id,tent_number,equipment_code) DO NOTHING;
 INSERT INTO public.kq_equipment_loadouts(user_id,tent_number,slot,equipment_code)
 SELECT p_user_id,1,slot,code
 FROM (VALUES('tent','TENT-080-STARTER'),('lighting','LED-150-STARTER'),('air','AIR-STARTER')) starter(slot,code)
 ON CONFLICT(user_id,tent_number,slot) DO NOTHING;
 RETURN jsonb_build_object('ready',true);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_purchase_tent_equipment(
  p_user_id UUID,
  p_request_key UUID,
  p_equipment_codes TEXT[], p_tent_number INTEGER
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
    IF v_existing.equipment_codes IS DISTINCT FROM v_codes THEN RAISE EXCEPTION 'equipment_purchase_request_mismatch'; END IF;
    RETURN jsonb_build_object(
      'tentNumber',1,'purchaseId', v_existing.id,
      'equipmentCodes', to_jsonb(v_existing.equipment_codes),
      'totalPriceCents', v_existing.total_price_cents,
      'cashAfterCents', v_existing.cash_after_cents,
      'replayed', TRUE
    );
  END IF;

  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
  PERFORM public.kq_assert_owned_tent(p_user_id,p_tent_number);
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
  WHERE user_id = p_user_id AND tent_number=public.kq_equipment_storage_tent(equipment_code,p_tent_number) AND equipment_code = ANY(v_codes);
  IF v_owned_count > 0 THEN RAISE EXCEPTION 'equipment_already_owned'; END IF;

  SELECT cash_cents,production_units INTO v_cash,v_units
  FROM public.kq_equipment_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  -- One debit and one receipt cover the complete mixed basket atomically.
  IF v_cash < v_total THEN RAISE EXCEPTION 'insufficient_equipment_cash'; END IF;

  UPDATE public.kq_equipment_wallets
  SET cash_cents = cash_cents - v_total, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.kq_player_equipment(user_id, tent_number, equipment_code, purchase_price_cents)
  SELECT p_user_id, public.kq_equipment_storage_tent(code,p_tent_number), code, price_cents
  FROM public.kq_equipment_catalog
  WHERE code = ANY(v_codes);

  INSERT INTO public.kq_equipment_purchase_receipts(
    id, request_key, user_id, equipment_codes, total_price_cents, cash_after_cents, tent_number
  ) VALUES (
    v_purchase_id, p_request_key, p_user_id, v_codes, v_total, v_cash - v_total, 1
  );

  RETURN jsonb_build_object(
    'tentNumber',1,'purchaseId', v_purchase_id,
    'equipmentCodes', to_jsonb(v_codes),
    'totalPriceCents', v_total,
    'cashAfterCents', v_cash - v_total,
    'replayed', FALSE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_replace_tent_culture_equipment(
  p_user_id UUID,p_equipment_code TEXT,p_expected_version INTEGER,p_expected_cost_cents INTEGER,p_request_key UUID,p_tent_number INTEGER
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_storage_tent INTEGER:=public.kq_equipment_storage_tent(p_equipment_code,p_tent_number); gear public.kq_player_equipment%ROWTYPE; catalog public.kq_equipment_catalog%ROWTYPE;
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
    IF public.kq_equipment_storage_tent(old.equipment_code,old.tent_number) IS DISTINCT FROM v_storage_tent OR old.equipment_code<>p_equipment_code OR old.expected_version<>p_expected_version
      OR (old.receipt->>'paidCents')::INTEGER<>p_expected_cost_cents THEN
      RAISE EXCEPTION 'culture_equipment_request_mismatch';
    END IF;
    RETURN old.receipt || '{"replayed":true}'::JSONB;
  END IF;
  IF EXISTS (SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='active') THEN
    RAISE EXCEPTION 'culture_equipment_active_run';
  END IF;
  PERFORM public.kq_assert_owned_tent(p_user_id,p_tent_number);
  SELECT * INTO gear FROM public.kq_player_equipment WHERE user_id=p_user_id AND tent_number=v_storage_tent AND equipment_code=p_equipment_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'culture_equipment_not_owned'; END IF;
  SELECT * INTO catalog FROM public.kq_equipment_catalog WHERE code=p_equipment_code AND is_active AND is_purchasable;
  IF NOT FOUND OR gear.purchase_price_cents<=0 OR public.kq_culture_equipment_wear_delta(p_equipment_code,'balanced',0)=0 THEN
    RAISE EXCEPTION 'culture_equipment_unavailable';
  END IF;
  IF gear.culture_wear_version<>p_expected_version THEN RAISE EXCEPTION 'culture_equipment_condition_changed'; END IF;
  IF gear.culture_wear_percent<100 THEN RAISE EXCEPTION 'culture_equipment_not_due'; END IF;
  cost := CEIL(catalog.price_cents::NUMERIC*(100+(gear.level-1)*10)/100)::INTEGER;
  -- Replace the installation model once, retaining its acquired level.
  IF cost<>p_expected_cost_cents THEN RAISE EXCEPTION 'culture_equipment_condition_changed'; END IF;
  IF cash<cost THEN RAISE EXCEPTION 'culture_equipment_insufficient_cash'; END IF;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-cost,updated_at=now() WHERE user_id=p_user_id;
  UPDATE public.kq_player_equipment SET culture_wear_percent=0,culture_wear_version=culture_wear_version+1
    WHERE user_id=p_user_id AND tent_number=v_storage_tent AND equipment_code=p_equipment_code;
  IF to_regclass('public.kq_commerce_accounts') IS NOT NULL THEN
    UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
  END IF;
  result := jsonb_build_object('tentNumber',v_storage_tent,'equipmentCode',p_equipment_code,'paidCents',cost,'cashAfterCents',cash-cost,
    'version',gear.culture_wear_version+1,'level',gear.level,'replayed',false);
  INSERT INTO public.kq_culture_equipment_replacements(user_id,request_key,equipment_code,expected_version,receipt,tent_number)
    VALUES(p_user_id,p_request_key,p_equipment_code,p_expected_version,result,v_storage_tent);
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_purchase_equipment(p_user_id UUID,p_request_key UUID,p_equipment_codes TEXT[]) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.kq_equipment_purchase_receipts%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 SELECT * INTO old FROM public.kq_equipment_purchase_receipts WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND AND old.tent_number IS NULL THEN
  IF old.equipment_codes IS DISTINCT FROM p_equipment_codes THEN RAISE EXCEPTION 'equipment_purchase_request_mismatch'; END IF;
  RETURN jsonb_build_object('purchaseId',old.id,'equipmentCodes',old.equipment_codes,'totalPriceCents',old.total_price_cents,'cashAfterCents',old.cash_after_cents,'replayed',true);
 END IF;
 RETURN public.rpc_kq_purchase_tent_equipment(p_user_id,p_request_key,p_equipment_codes,1);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_upgrade_equipment(p_user_id UUID,p_request_key UUID,p_equipment_code TEXT,p_expected_level INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.kq_equipment_upgrade_receipts%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 SELECT * INTO old FROM public.kq_equipment_upgrade_receipts WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND AND old.tent_number IS NULL THEN
  IF old.equipment_code IS DISTINCT FROM p_equipment_code OR old.previous_level IS DISTINCT FROM p_expected_level THEN RAISE EXCEPTION 'equipment_upgrade_request_mismatch'; END IF;
  RETURN jsonb_build_object('equipmentCode',old.equipment_code,'level',old.level,'priceCents',old.price_cents,'cashAfterCents',old.cash_after_cents,'replayed',true);
 END IF;
 RETURN public.rpc_kq_upgrade_tent_equipment(p_user_id,p_request_key,p_equipment_code,p_expected_level,1);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_equip_durable(p_user_id UUID,p_equipment_code TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 RETURN public.rpc_kq_equip_tent_equipment(p_user_id,p_equipment_code,1);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_repair_machine(p_user_id UUID,p_equipment_code TEXT,p_expected_version INTEGER,p_expected_cost_cents INTEGER,p_request_key UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.kq_machine_repairs%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 SELECT * INTO old FROM public.kq_machine_repairs WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND AND old.tent_number IS NULL THEN
  IF old.equipment_code IS DISTINCT FROM p_equipment_code OR old.expected_version IS DISTINCT FROM p_expected_version OR (old.receipt->>'paidCents')::INTEGER IS DISTINCT FROM p_expected_cost_cents THEN RAISE EXCEPTION 'machine_request_mismatch'; END IF;
  RETURN old.receipt||'{"replayed":true}'::JSONB;
 END IF;
 RETURN public.rpc_kq_repair_tent_machine(p_user_id,p_equipment_code,p_expected_version,p_expected_cost_cents,p_request_key,1);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_replace_culture_equipment(p_user_id UUID,p_equipment_code TEXT,p_expected_version INTEGER,p_expected_cost_cents INTEGER,p_request_key UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.kq_culture_equipment_replacements%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 SELECT * INTO old FROM public.kq_culture_equipment_replacements WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND AND old.tent_number IS NULL THEN
  IF old.equipment_code IS DISTINCT FROM p_equipment_code OR old.expected_version IS DISTINCT FROM p_expected_version OR (old.receipt->>'paidCents')::INTEGER IS DISTINCT FROM p_expected_cost_cents THEN RAISE EXCEPTION 'culture_equipment_request_mismatch'; END IF;
  RETURN old.receipt||'{"replayed":true}'::JSONB;
 END IF;
 RETURN public.rpc_kq_replace_tent_culture_equipment(p_user_id,p_equipment_code,p_expected_version,p_expected_cost_cents,p_request_key,1);
END $$;

-- Expansion prices and receipts are unchanged; only capacity is added.
CREATE OR REPLACE FUNCTION public.rpc_kq_expand_production(p_user_id UUID,p_request_key UUID,p_expected_units INTEGER,p_expected_cost_cents INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.kq_production_expansions%ROWTYPE; units INTEGER; target INTEGER; cash INTEGER; cost INTEGER; n INTEGER; result JSONB;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR p_expected_units IS NULL OR p_expected_units NOT IN (1,2,3,4,8)
 OR p_expected_cost_cents IS NULL OR p_expected_cost_cents<=0 THEN RAISE EXCEPTION 'production_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 SELECT * INTO old FROM public.kq_production_expansions WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF old.previous_units<>p_expected_units OR old.price_cents<>p_expected_cost_cents THEN RAISE EXCEPTION 'production_request_mismatch'; END IF;
  RETURN old.receipt||'{"replayed":true}'::JSONB;
 END IF;
 PERFORM public.kq_business_settle(p_user_id);
 SELECT production_units,cash_cents INTO units,cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF units IS NULL THEN RAISE EXCEPTION 'production_invalid_request'; END IF;
 IF units<>p_expected_units THEN RAISE EXCEPTION 'production_units_changed'; END IF;
 IF units=8 THEN RAISE EXCEPTION 'production_max_units'; END IF;
 IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='active') THEN RAISE EXCEPTION 'production_active_run'; END IF;
 target:=CASE WHEN units=4 THEN 8 ELSE units+1 END;
 cost:=30000*(target-units)+CASE WHEN target=8 THEN 2000000 ELSE 0 END;
 IF cost<>p_expected_cost_cents THEN RAISE EXCEPTION 'production_price_changed'; END IF;
 IF cash<cost THEN RAISE EXCEPTION 'production_insufficient_cash'; END IF;
 UPDATE public.kq_equipment_wallets SET production_units=target,cash_cents=cash_cents-cost,updated_at=now() WHERE user_id=p_user_id;
 PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
 FOR n IN units+1..target LOOP
  PERFORM public.kq_treasury_add_tent_asset(p_user_id,'production:'||p_request_key::TEXT||':tent:'||n,30000,now(),'TENT-CAPACITY',n);
 END LOOP;
 IF target=8 THEN PERFORM public.kq_treasury_add_asset(p_user_id,'production:'||p_request_key::TEXT||':warehouse','equipment','expense_depreciation',2000000,now(),4320,'WAREHOUSE-EXTENSION'); END IF;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 result:=jsonb_build_object('productionUnits',target,'previousUnits',units,'addedUnits',target-units,'priceCents',cost,'cashAfterCents',cash-cost,'replayed',false);
 INSERT INTO public.kq_production_expansions(user_id,request_key,previous_units,production_units,price_cents,receipt)
 VALUES(p_user_id,p_request_key,units,target,cost,result);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.kq_guard_culture_equipment_start() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE units INTEGER; tent RECORD; requested TEXT[]; expected TEXT[]; numbers INTEGER[];
BEGIN
 IF NEW.status::TEXT<>'active' THEN RETURN NEW; END IF;
 IF NEW.state->'equipment'->>'scope' IS DISTINCT FROM 'installation' THEN RAISE EXCEPTION 'kq_culture_equipment_changed'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||NEW.user_id::TEXT,0));
 PERFORM public.rpc_kq_ensure_equipment_profile(NEW.user_id);
 SELECT production_units INTO units FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
 IF COALESCE(NEW.state->'equipment'->'productionUnits','1'::JSONB) IS DISTINCT FROM to_jsonb(units) THEN RAISE EXCEPTION 'kq_production_units_changed'; END IF;
 SELECT array_agg(tent_number ORDER BY tent_number) INTO numbers FROM public.kq_run_tents(NEW.state);
 IF numbers IS DISTINCT FROM ARRAY(SELECT generate_series(1,units)) THEN RAISE EXCEPTION 'kq_culture_equipment_changed'; END IF;
 FOR tent IN SELECT * FROM public.kq_run_tents(NEW.state) LOOP
  IF jsonb_typeof(tent.codes) IS DISTINCT FROM 'array' OR jsonb_typeof(tent.levels) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'kq_culture_equipment_changed'; END IF;
  SELECT COALESCE(array_agg(code ORDER BY code),ARRAY[]::TEXT[]) INTO requested FROM jsonb_array_elements_text(tent.codes) item(code);
  IF EXISTS(SELECT 1 FROM public.kq_player_equipment WHERE user_id=NEW.user_id AND tent_number=1
   AND equipment_code=ANY(requested) AND culture_wear_percent=100 AND public.kq_culture_equipment_wear_delta(equipment_code,'balanced',0)>0) THEN RAISE EXCEPTION 'kq_culture_equipment_broken'; END IF;
  WITH usable AS (
   SELECT e.equipment_code,c.slot FROM public.kq_equipment_loadouts l
   JOIN public.kq_player_equipment e ON e.user_id=l.user_id AND e.tent_number=l.tent_number AND e.equipment_code=l.equipment_code
   JOIN public.kq_equipment_catalog c ON c.code=e.equipment_code
   WHERE l.user_id=NEW.user_id AND l.tent_number=1 AND NOT public.kq_is_shared_processing_equipment(c.code) AND c.is_active AND (NOT c.is_purchasable OR e.purchase_price_cents>0)
   AND (public.kq_culture_equipment_wear_delta(e.equipment_code,'balanced',0)=0 OR e.culture_wear_percent<100)
  ), effective AS (
   SELECT equipment_code FROM usable UNION ALL
   SELECT starter.code FROM (VALUES('tent','TENT-080-STARTER'),('lighting','LED-150-STARTER'),('air','AIR-STARTER')) starter(slot,code)
   WHERE NOT EXISTS(SELECT 1 FROM usable WHERE usable.slot=starter.slot)
  ) SELECT array_agg(equipment_code ORDER BY equipment_code) INTO expected FROM effective;
  IF requested IS DISTINCT FROM expected THEN RAISE EXCEPTION 'kq_culture_equipment_changed'; END IF;
  IF EXISTS(SELECT 1 FROM public.kq_player_equipment e WHERE e.user_id=NEW.user_id AND e.tent_number=1
   AND e.equipment_code=ANY(requested) AND COALESCE(tent.levels->e.equipment_code,'1'::JSONB) IS DISTINCT FROM to_jsonb(e.level)) THEN RAISE EXCEPTION 'kq_culture_equipment_changed'; END IF;
 END LOOP;
 IF jsonb_typeof(NEW.state->'equipment'->'shared') IS DISTINCT FROM 'object'
  OR jsonb_typeof(NEW.state->'equipment'->'shared'->'codes') IS DISTINCT FROM 'array'
  OR jsonb_typeof(NEW.state->'equipment'->'shared'->'levels') IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'kq_shared_equipment_changed';
 END IF;
 SELECT COALESCE(array_agg(code ORDER BY code),ARRAY[]::TEXT[]) INTO requested
 FROM jsonb_array_elements_text(NEW.state->'equipment'->'shared'->'codes') item(code);
 SELECT COALESCE(array_agg(l.equipment_code ORDER BY l.equipment_code),ARRAY[]::TEXT[]) INTO expected
 FROM public.kq_equipment_loadouts l JOIN public.kq_player_equipment e USING(user_id,tent_number,equipment_code)
 JOIN public.kq_equipment_catalog c ON c.code=l.equipment_code
 WHERE l.user_id=NEW.user_id AND l.tent_number=1 AND public.kq_is_shared_processing_equipment(c.code)
  AND c.is_active AND (NOT c.is_purchasable OR e.purchase_price_cents>0);
 IF requested IS DISTINCT FROM expected THEN RAISE EXCEPTION 'kq_shared_equipment_changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.kq_player_equipment e WHERE e.user_id=NEW.user_id AND e.tent_number=1
  AND e.equipment_code=ANY(requested)
  AND COALESCE(NEW.state->'equipment'->'shared'->'levels'->e.equipment_code,'1'::JSONB) IS DISTINCT FROM to_jsonb(e.level)) THEN
  RAISE EXCEPTION 'kq_shared_equipment_changed';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.kq_lock_run_energy() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.state->'energy' IS DISTINCT FROM OLD.state->'energy'
 OR (OLD.state ? 'energy' AND NEW.state->'equipment' IS DISTINCT FROM OLD.state->'equipment')
 OR NEW.state->'equipment'->'productionUnits' IS DISTINCT FROM OLD.state->'equipment'->'productionUnits'
 OR NEW.state->'equipment'->'tents' IS DISTINCT FROM OLD.state->'equipment'->'tents'
 OR NEW.state->'equipment'->'shared' IS DISTINCT FROM OLD.state->'equipment'->'shared'
 OR NEW.state->'equipment'->'scope' IS DISTINCT FROM OLD.state->'equipment'->'scope'
 THEN RAISE EXCEPTION 'kq_energy_quote_immutable'; END IF;
 RETURN NEW;
END $$;

-- EXISTS charges each model once, including old snapshots with multiple copies.
CREATE OR REPLACE FUNCTION public.kq_wear_culture_equipment_on_completion() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mode TEXT; gear RECORD; after_wear INTEGER; changes JSONB:='[]'::JSONB;
BEGIN
 IF NEW.status::TEXT<>'completed' OR OLD.status::TEXT='completed' THEN RETURN NEW; END IF;
 PERFORM public.rpc_kq_ensure_equipment_profile(NEW.user_id);
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
 mode:=CASE WHEN NEW.state->'energy'->>'mode' IN ('eco','intensive') THEN NEW.state->'energy'->>'mode' ELSE 'balanced' END;
 INSERT INTO public.kq_culture_equipment_wear_receipts(run_id,user_id,energy_mode) VALUES(NEW.id,NEW.user_id,mode) ON CONFLICT(run_id) DO NOTHING;
 IF NOT FOUND THEN RETURN NEW; END IF;
 FOR gear IN SELECT e.* FROM public.kq_player_equipment e
  WHERE e.user_id=NEW.user_id AND e.tent_number=1
  AND EXISTS(SELECT 1 FROM public.kq_run_tents(NEW.state) t WHERE t.codes ? e.equipment_code)
  AND public.kq_culture_equipment_wear_delta(e.equipment_code,mode,e.culture_wear_percent)>0
  ORDER BY e.tent_number,e.equipment_code FOR UPDATE OF e LOOP
  after_wear:=LEAST(100,gear.culture_wear_percent+public.kq_culture_equipment_wear_delta(gear.equipment_code,mode,gear.culture_wear_percent));
  UPDATE public.kq_player_equipment SET culture_wear_percent=after_wear,culture_wear_version=culture_wear_version+1
   WHERE user_id=NEW.user_id AND tent_number=gear.tent_number AND equipment_code=gear.equipment_code;
  changes:=changes||jsonb_build_array(jsonb_build_object('tentNumber',gear.tent_number,'equipmentCode',gear.equipment_code,'wearBefore',gear.culture_wear_percent,'wearAfter',after_wear,'version',gear.culture_wear_version+1));
 END LOOP;
 UPDATE public.kq_culture_equipment_wear_receipts SET equipment=changes WHERE run_id=NEW.id;
 RETURN NEW;
END $$;

-- Frozen electricity totals and legacy dog charges stay unchanged. New shared
-- installation cycles care for one owned dog, including while a camera is
-- installed, independent of physical tent capacity. Legacy branches stay frozen.
CREATE OR REPLACE FUNCTION public.kq_invoice_completed_cycle() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_energy INTEGER := 0; v_care INTEGER := 0; v_paid INTEGER := 0;
  v_dogs INTEGER; v_units INTEGER; v_cycle INTEGER; v_vet INTEGER; v_cash INTEGER; v_dog JSONB; v_quote JSONB;
BEGIN
  IF NEW.status::TEXT <> 'completed' OR OLD.status::TEXT = 'completed' THEN RETURN NEW; END IF;
  PERFORM public.rpc_kq_ensure_equipment_profile(NEW.user_id);
  SELECT cash_cents INTO v_cash FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.kq_energy_invoices WHERE run_id=NEW.id) THEN RETURN NEW; END IF;

  v_units := public.kq_run_production_units(NEW.state);
  SELECT CASE WHEN NEW.state->'equipment'->>'scope'='installation' THEN
    CASE WHEN EXISTS(SELECT 1 FROM public.kq_player_equipment
      WHERE user_id=NEW.user_id AND tent_number=1 AND equipment_code='SECURITY-DOG') THEN 1 ELSE 0 END
    WHEN NEW.state->'equipment' ? 'tents' THEN
    (SELECT COUNT(*)::INTEGER FROM public.kq_run_tents(NEW.state) t WHERE t.codes ? 'SECURITY-DOG')
    WHEN EXISTS(SELECT 1 FROM public.kq_player_equipment WHERE user_id=NEW.user_id AND equipment_code='SECURITY-DOG') THEN v_units ELSE 0 END INTO v_dogs;
  v_quote := NEW.state->'energy';
  IF v_quote->>'version' = '1' THEN
    v_energy := (v_quote->>'totalCents')::INTEGER;
    IF v_energy IS NULL OR v_energy < 0 THEN RAISE EXCEPTION 'kq_invalid_energy_quote'; END IF;
  ELSIF v_dogs>0 THEN
    -- A legacy run has no electricity quote, but an adopted dog still needs care.
    v_quote := '{"version":1,"mode":"balanced","lines":[],"totalWattHours":0,"solarPercent":0,"tariffCentsPerKwh":30,"totalCents":0,"savingsCents":0}'::JSONB;
  ELSE RETURN NEW;
  END IF;

  IF v_dogs>0 THEN
    SELECT COUNT(*)::INTEGER+1 INTO v_cycle FROM public.kq_energy_invoices WHERE user_id=NEW.user_id AND dog_care IS NOT NULL;
    v_vet := CASE WHEN v_cycle % 10 = 0 THEN 4000*v_dogs ELSE 0 END;
    v_care := 800*v_dogs + v_vet;
    v_paid := LEAST(v_cash,v_care);
    v_dog := jsonb_build_object('cycle',v_cycle,'foodCents',800*v_dogs,'vetCents',v_vet,'totalCents',v_care,'paidCents',v_paid);
  END IF;

  INSERT INTO public.kq_energy_invoices(run_id,user_id,total_cents,remaining_cents,quote,harvest_grams,dog_care)
    VALUES(NEW.id,NEW.user_id,v_energy+v_care,v_energy+v_care-v_paid,v_quote,COALESCE((NEW.state->>'harvestGrams')::NUMERIC,0),v_dog);
  IF v_paid > 0 THEN
    UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-v_paid,updated_at=now() WHERE user_id=NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Care follows adoption, not the selected protection. There is only one dog
-- in the global inventory; this preview agrees with new installation invoices.
CREATE OR REPLACE FUNCTION public.rpc_kq_energy_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH care AS (SELECT COUNT(*)::INTEGER AS cycles FROM public.kq_energy_invoices WHERE user_id=p_user_id AND dog_care IS NOT NULL),
  fleet AS (SELECT COUNT(*)::INTEGER AS units FROM public.kq_player_equipment WHERE user_id=p_user_id AND tent_number=1 AND equipment_code='SECURITY-DOG')
  SELECT jsonb_build_object(
    'outstandingCents',COALESCE(SUM(remaining_cents),0),
    'invoiceCount',COUNT(*),
    'bestGramsPerKwh',MAX(CASE WHEN (quote->>'totalWattHours')::NUMERIC>0 THEN ROUND(harvest_grams*1000/(quote->>'totalWattHours')::NUMERIC,2) ELSE NULL END),
    'dogCare',CASE WHEN (SELECT units FROM fleet)>0 THEN
      (SELECT jsonb_build_object('completedCycles',cycles,'nextCycle',cycles+1,'cyclesUntilVet',10-cycles%10,
        'foodCents',800*units,'vetCents',4000*units,'nextTotalCents',(800+CASE WHEN (cycles+1)%10=0 THEN 4000 ELSE 0 END)*units) FROM care CROSS JOIN fleet)
      ELSE NULL END,
    'invoices',COALESCE((SELECT jsonb_agg(jsonb_build_object('runId',i.run_id,'createdAt',i.created_at,
      'totalCents',i.total_cents,'remainingCents',i.remaining_cents,'harvestGrams',i.harvest_grams,'quote',i.quote,'dogCare',i.dog_care) ORDER BY i.created_at DESC,i.run_id)
      FROM (SELECT * FROM public.kq_energy_invoices WHERE user_id=p_user_id ORDER BY created_at DESC,run_id LIMIT 20) i),'[]'::JSONB)
  ) FROM public.kq_energy_invoices WHERE user_id=p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.kq_treasury_initialize(p_user UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_commerce_accounts%ROWTYPE; gear RECORD; upgrade RECORD; paid RECORD; replacement RECORD;
 started TIMESTAMPTZ; acquired TIMESTAMPTZ; basis BIGINT; equipment BIGINT:=0; website BIGINT:=0; prepaid BIGINT:=0;
 cash BIGINT; saving BIGINT; reserve BIGINT; lab BIGINT; energy BIGINT; stock BIGINT; net BIGINT;
BEGIN
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 INSERT INTO public.kq_treasury_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING RETURNING started_at INTO started;
 IF started IS NULL THEN RETURN; END IF;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user;
 FOR gear IN SELECT * FROM public.kq_player_equipment WHERE user_id=p_user AND purchase_price_cents>0 LOOP
  SELECT created_at,(receipt->>'paidCents')::BIGINT amount INTO replacement FROM public.kq_culture_equipment_replacements
   WHERE user_id=p_user AND equipment_code=gear.equipment_code AND tent_number=gear.tent_number ORDER BY created_at DESC,request_key DESC LIMIT 1;
  basis:=COALESCE(replacement.amount,gear.purchase_price_cents); acquired:=COALESCE(replacement.created_at,gear.acquired_at,started);
  equipment:=equipment+public.kq_treasury_add_tent_asset(p_user,'opening-equipment:'||gear.equipment_code||':tent:'||gear.tent_number,basis,acquired,gear.equipment_code,gear.tent_number,true);
  FOR upgrade IN SELECT * FROM public.kq_equipment_upgrade_receipts WHERE user_id=p_user AND equipment_code=gear.equipment_code AND created_at>=acquired LOOP
   equipment:=equipment+public.kq_treasury_add_tent_asset(p_user,'opening-upgrade:'||upgrade.id,upgrade.price_cents,upgrade.created_at,gear.equipment_code,gear.tent_number,true);
  END LOOP;
 END LOOP;
 IF a.computer_owned THEN
  SELECT MIN(created_at) INTO acquired FROM public.kq_commerce_requests WHERE user_id=p_user AND action='buy-computer';
  equipment:=equipment+public.kq_treasury_add_asset(p_user,'opening-computer','equipment','expense_depreciation',45000,COALESCE(acquired,started),4320,'COMPUTER',true);
 END IF;
 IF a.shop_created_at IS NOT NULL THEN
  website:=public.kq_treasury_add_asset(p_user,'opening-website','website','expense_depreciation',100000,a.shop_created_at,1440,NULL,true);
 END IF;
 FOR paid IN SELECT * FROM public.kq_business_ledger WHERE user_id=p_user AND amount_cents>0
  AND kind IN ('shop-renewed','domicile-paid','advertising-started') AND occurred_at>started-interval '120 hours' LOOP
  prepaid:=prepaid+public.kq_treasury_add_asset(p_user,'opening-prepaid:'||paid.id,'prepaid',
   CASE paid.kind WHEN 'shop-renewed' THEN 'expense_hosting' WHEN 'domicile-paid' THEN 'expense_domiciliation' ELSE 'expense_advertising' END,
   paid.amount_cents,paid.occurred_at,CASE WHEN paid.kind<>'advertising-started' THEN 120 WHEN paid.amount_cents=6000 THEN 40 WHEN paid.amount_cents=15000 THEN 28 ELSE 20 END,NULL,true);
 END LOOP;
 SELECT COALESCE(SUM(balance_cents),0) INTO saving FROM public.arena_chanvrier_savings_deposits WHERE user_id=p_user;
 SELECT COALESCE(SUM(remaining_cents),0) INTO lab FROM public.kq_lab_invoices WHERE user_id=p_user;
 SELECT COALESCE(SUM(remaining_cents),0) INTO energy FROM public.kq_energy_invoices WHERE user_id=p_user;
 reserve:=COALESCE(a.vat_reserved_cents,0); stock:=public.kq_treasury_stock_cost(p_user);
 net:=cash+saving+equipment+website+prepaid+stock-lab-energy;
 PERFORM public.kq_treasury_post(p_user,'opening','opening',started,jsonb_build_array(
  jsonb_build_object('account','cash','deltaCents',cash),jsonb_build_object('account','savings','deltaCents',saving),
  jsonb_build_object('account','vat_reserve','deltaCents',reserve),jsonb_build_object('account','vat_payable','deltaCents',-reserve),
  jsonb_build_object('account','equipment','deltaCents',equipment),jsonb_build_object('account','website','deltaCents',website),
  jsonb_build_object('account','prepaid','deltaCents',prepaid),jsonb_build_object('account','stock','deltaCents',stock),
  jsonb_build_object('account','lab_payable','deltaCents',-lab),jsonb_build_object('account','energy_payable','deltaCents',-energy),
  jsonb_build_object('account','opening_equity','deltaCents',-net)),'Position à l’ouverture du suivi comptable');
END $$;

REVOKE ALL ON FUNCTION public.kq_equipment_storage_tent(TEXT,INTEGER),
 public.kq_guard_shared_workshop_storage(),public.kq_guard_culture_equipment_start(),
 public.kq_lock_run_energy(),public.kq_wear_culture_equipment_on_completion(),
 public.kq_invoice_completed_cycle(),public.kq_treasury_initialize(UUID)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_ensure_equipment_profile(UUID),
 public.rpc_kq_energy_snapshot(UUID),
 public.rpc_kq_purchase_tent_equipment(UUID,UUID,TEXT[],INTEGER),
 public.rpc_kq_replace_tent_culture_equipment(UUID,TEXT,INTEGER,INTEGER,UUID,INTEGER),
 public.rpc_kq_purchase_equipment(UUID,UUID,TEXT[]),public.rpc_kq_upgrade_equipment(UUID,UUID,TEXT,INTEGER),
 public.rpc_kq_equip_durable(UUID,TEXT),public.rpc_kq_repair_machine(UUID,TEXT,INTEGER,INTEGER,UUID),
 public.rpc_kq_replace_culture_equipment(UUID,TEXT,INTEGER,INTEGER,UUID),
 public.rpc_kq_expand_production(UUID,UUID,INTEGER,INTEGER)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_ensure_equipment_profile(UUID),
 public.rpc_kq_energy_snapshot(UUID),
 public.rpc_kq_purchase_tent_equipment(UUID,UUID,TEXT[],INTEGER),
 public.rpc_kq_replace_tent_culture_equipment(UUID,TEXT,INTEGER,INTEGER,UUID,INTEGER),
 public.rpc_kq_purchase_equipment(UUID,UUID,TEXT[]),public.rpc_kq_upgrade_equipment(UUID,UUID,TEXT,INTEGER),
 public.rpc_kq_equip_durable(UUID,TEXT),public.rpc_kq_repair_machine(UUID,TEXT,INTEGER,INTEGER,UUID),
 public.rpc_kq_replace_culture_equipment(UUID,TEXT,INTEGER,INTEGER,UUID),
 public.rpc_kq_expand_production(UUID,UUID,INTEGER,INTEGER)
 TO service_role;
COMMENT ON COLUMN public.kq_equipment_wallets.production_units IS
 'Physical tent capacity using one shared installation equipment profile (canonical tent 1), including the shared processing workshop.';
COMMIT;
