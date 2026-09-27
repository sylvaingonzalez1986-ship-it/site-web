BEGIN;

-- Processing is one shared workshop, stored in canonical tent 1. Other slots
-- remain individual. No wallet, receipt, run snapshot or asset value is rewritten.
LOCK TABLE public.kq_equipment_wallets,public.kq_player_equipment,
 public.kq_equipment_loadouts,public.kq_treasury_assets IN SHARE ROW EXCLUSIVE MODE;

CREATE FUNCTION public.kq_is_shared_processing_equipment(p_code TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.kq_equipment_catalog WHERE code=p_code AND category='processing'
  AND slot IN ('sifting','washing','filtration','static-separation','press','drying'));
$$;

CREATE FUNCTION public.kq_equipment_storage_tent(p_code TEXT,p_tent INTEGER) RETURNS INTEGER
LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT CASE WHEN public.kq_is_shared_processing_equipment(p_code) THEN 1 ELSE p_tent END;
$$;

-- Keep the first tent's installed model when present; otherwise choose the
-- highest-level installed copy, breaking ties by original tent and code.
CREATE TEMP TABLE kq_shared_workshop_installed ON COMMIT DROP AS
 SELECT DISTINCT ON(l.user_id,l.slot) l.user_id,l.slot,l.equipment_code,l.equipped_at
 FROM public.kq_equipment_loadouts l JOIN public.kq_player_equipment e USING(user_id,tent_number,equipment_code)
 WHERE public.kq_is_shared_processing_equipment(l.equipment_code)
 ORDER BY l.user_id,l.slot,(l.tent_number=1) DESC,e.level DESC,l.tent_number,l.equipment_code;
CREATE TEMP TABLE kq_shared_workshop_owned ON COMMIT DROP AS
 SELECT user_id,equipment_code,SUM(purchase_price_cents)::INTEGER purchase_price_cents,
  MIN(acquired_at) acquired_at,MAX(level) level,MAX(wear_cycles) wear_cycles,
  MAX(maintenance_version) maintenance_version,MAX(culture_wear_percent) culture_wear_percent,
  MAX(culture_wear_version) culture_wear_version
 FROM public.kq_player_equipment WHERE public.kq_is_shared_processing_equipment(equipment_code)
 GROUP BY user_id,equipment_code;
DELETE FROM public.kq_equipment_loadouts WHERE public.kq_is_shared_processing_equipment(equipment_code);
INSERT INTO public.kq_player_equipment(user_id,tent_number,equipment_code,purchase_price_cents,acquired_at,
 level,wear_cycles,maintenance_version,culture_wear_percent,culture_wear_version)
 SELECT user_id,1,equipment_code,purchase_price_cents,acquired_at,level,wear_cycles,maintenance_version,culture_wear_percent,culture_wear_version
 FROM kq_shared_workshop_owned
 ON CONFLICT(user_id,tent_number,equipment_code) DO UPDATE SET
  purchase_price_cents=EXCLUDED.purchase_price_cents,acquired_at=EXCLUDED.acquired_at,level=EXCLUDED.level,
  wear_cycles=EXCLUDED.wear_cycles,maintenance_version=EXCLUDED.maintenance_version,
  culture_wear_percent=EXCLUDED.culture_wear_percent,culture_wear_version=EXCLUDED.culture_wear_version;
DELETE FROM public.kq_player_equipment WHERE tent_number<>1 AND public.kq_is_shared_processing_equipment(equipment_code);
INSERT INTO public.kq_equipment_loadouts(user_id,tent_number,slot,equipment_code,equipped_at)
 SELECT user_id,1,slot,equipment_code,equipped_at FROM kq_shared_workshop_installed;
UPDATE public.kq_treasury_assets SET tent_number=1
 WHERE retired_at IS NULL AND public.kq_is_shared_processing_equipment(equipment_code);

-- Enforce the invariant even for privileged direct writes outside the RPCs.
CREATE FUNCTION public.kq_guard_shared_workshop_storage() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.tent_number<>1 AND public.kq_is_shared_processing_equipment(NEW.equipment_code) THEN
  RAISE EXCEPTION 'equipment_shared_workshop_only';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_guard_shared_workshop_owned BEFORE INSERT OR UPDATE OF tent_number,equipment_code
 ON public.kq_player_equipment FOR EACH ROW EXECUTE FUNCTION public.kq_guard_shared_workshop_storage();
CREATE TRIGGER kq_guard_shared_workshop_loadout BEFORE INSERT OR UPDATE OF tent_number,equipment_code
 ON public.kq_equipment_loadouts FOR EACH ROW EXECUTE FUNCTION public.kq_guard_shared_workshop_storage();


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
    IF v_existing.equipment_codes IS DISTINCT FROM v_codes OR
      (v_existing.tent_number IS DISTINCT FROM p_tent_number AND EXISTS(
        SELECT 1 FROM unnest(v_codes) code WHERE NOT public.kq_is_shared_processing_equipment(code))) THEN RAISE EXCEPTION 'equipment_purchase_request_mismatch'; END IF;
    RETURN jsonb_build_object(
      'tentNumber',p_tent_number,'purchaseId', v_existing.id,
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
    v_purchase_id, p_request_key, p_user_id, v_codes, v_total, v_cash - v_total, p_tent_number
  );

  RETURN jsonb_build_object(
    'tentNumber',p_tent_number,'purchaseId', v_purchase_id,
    'equipmentCodes', to_jsonb(v_codes),
    'totalPriceCents', v_total,
    'cashAfterCents', v_cash - v_total,
    'replayed', FALSE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_upgrade_tent_equipment(
  p_user_id UUID, p_request_key UUID, p_equipment_code TEXT, p_expected_level INTEGER, p_tent_number INTEGER
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_storage_tent INTEGER:=public.kq_equipment_storage_tent(p_equipment_code,p_tent_number);
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
    IF public.kq_equipment_storage_tent(v_existing.equipment_code,v_existing.tent_number) IS DISTINCT FROM v_storage_tent OR v_existing.equipment_code <> p_equipment_code OR v_existing.previous_level <> p_expected_level THEN
      RAISE EXCEPTION 'equipment_upgrade_request_mismatch';
    END IF;
    RETURN jsonb_build_object('tentNumber',v_storage_tent,'equipmentCode',v_existing.equipment_code,'level',v_existing.level,
      'priceCents',v_existing.price_cents,'cashAfterCents',v_existing.cash_after_cents,'replayed',TRUE);
  END IF;
  PERFORM public.kq_assert_owned_tent(p_user_id,p_tent_number);
  SELECT cash_cents,production_units INTO v_cash,v_units FROM public.kq_equipment_wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment_not_purchased'; END IF;
  SELECT owned.level, CEIL(catalog.price_cents::NUMERIC * owned.level / 10)::INTEGER INTO v_level,v_price
  FROM public.kq_player_equipment owned JOIN public.kq_equipment_catalog catalog ON catalog.code = owned.equipment_code
  WHERE owned.user_id = p_user_id AND owned.tent_number=v_storage_tent AND owned.equipment_code = p_equipment_code
    AND owned.purchase_price_cents > 0 AND catalog.is_active AND catalog.is_purchasable
  FOR UPDATE OF owned;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment_not_purchased'; END IF;
  IF v_level >= 10 THEN RAISE EXCEPTION 'equipment_max_level'; END IF;
  IF v_level <> p_expected_level THEN RAISE EXCEPTION 'equipment_level_changed'; END IF;
  IF v_cash < v_price THEN RAISE EXCEPTION 'insufficient_equipment_cash'; END IF;
  UPDATE public.kq_equipment_wallets SET cash_cents = cash_cents - v_price, updated_at = now() WHERE user_id = p_user_id;
  UPDATE public.kq_player_equipment SET level = level + 1 WHERE user_id = p_user_id AND tent_number=v_storage_tent AND equipment_code = p_equipment_code;
  INSERT INTO public.kq_equipment_upgrade_receipts(user_id,request_key,equipment_code,previous_level,level,price_cents,cash_after_cents,tent_number)
    VALUES(p_user_id,p_request_key,p_equipment_code,v_level,v_level+1,v_price,v_cash-v_price,v_storage_tent);
  RETURN jsonb_build_object('tentNumber',v_storage_tent,'equipmentCode',p_equipment_code,'level',v_level+1,
    'priceCents',v_price,'cashAfterCents',v_cash-v_price,'replayed',FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_repair_tent_machine(p_user_id UUID,p_equipment_code TEXT,p_expected_version INTEGER,p_expected_cost_cents INTEGER,p_request_key UUID,p_tent_number INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_storage_tent INTEGER:=public.kq_equipment_storage_tent(p_equipment_code,p_tent_number); gear public.kq_player_equipment%ROWTYPE; catalog public.kq_equipment_catalog%ROWTYPE;
 old public.kq_machine_repairs%ROWTYPE; cash INTEGER; cost INTEGER; units INTEGER; result JSONB;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR p_expected_version IS NULL OR p_expected_cost_cents IS NULL THEN RAISE EXCEPTION 'machine_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM public.kq_business_settle(p_user_id);
 SELECT cash_cents,production_units INTO cash,units FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'machine_not_owned'; END IF;
 SELECT * INTO old FROM public.kq_machine_repairs WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF public.kq_equipment_storage_tent(old.equipment_code,old.tent_number) IS DISTINCT FROM v_storage_tent OR old.equipment_code<>p_equipment_code OR old.expected_version<>p_expected_version OR (old.receipt->>'paidCents')::INTEGER<>p_expected_cost_cents THEN RAISE EXCEPTION 'machine_request_mismatch'; END IF;
  RETURN old.receipt||'{"replayed":true}'::JSONB;
 END IF;
 PERFORM public.kq_assert_owned_tent(p_user_id,p_tent_number);
  SELECT * INTO gear FROM public.kq_player_equipment WHERE user_id=p_user_id AND tent_number=v_storage_tent AND equipment_code=p_equipment_code FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'machine_not_owned'; END IF;
 SELECT * INTO catalog FROM public.kq_equipment_catalog WHERE code=p_equipment_code AND category='processing' AND code<>'SIFT-TRAY' AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'machine_unavailable'; END IF;
 IF gear.maintenance_version<>p_expected_version THEN RAISE EXCEPTION 'machine_condition_changed'; END IF;
 IF gear.wear_cycles<public.kq_machine_interval(gear.equipment_code,gear.level) THEN RAISE EXCEPTION 'machine_not_due'; END IF;
 cost:=CASE WHEN EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength='handyperson') THEN 0
  ELSE LEAST(20000,GREATEST(1000,CEIL(catalog.price_cents*.06*(1+(gear.level-1)*.05)))) END;
 -- The shared machine is repaired once for the whole workshop.
 IF cost<>p_expected_cost_cents THEN RAISE EXCEPTION 'machine_condition_changed'; END IF;
 IF cash<cost THEN RAISE EXCEPTION 'machine_insufficient_cash'; END IF;
 UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-cost,updated_at=now() WHERE user_id=p_user_id;
 UPDATE public.kq_player_equipment SET wear_cycles=0,maintenance_version=maintenance_version+1 WHERE user_id=p_user_id AND tent_number=v_storage_tent AND equipment_code=p_equipment_code;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 result:=jsonb_build_object('tentNumber',v_storage_tent,'equipmentCode',p_equipment_code,'paidCents',cost,'cashAfterCents',cash-cost,'version',gear.maintenance_version+1,'replayed',false);
 INSERT INTO public.kq_machine_repairs(user_id,request_key,equipment_code,expected_version,receipt,tent_number) VALUES(p_user_id,p_request_key,p_equipment_code,p_expected_version,result,v_storage_tent);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_equip_tent_equipment(p_user_id UUID,p_equipment_code TEXT,p_tent_number INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_storage_tent INTEGER:=public.kq_equipment_storage_tent(p_equipment_code,p_tent_number); equipment_slot TEXT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
 PERFORM public.kq_assert_owned_tent(p_user_id,p_tent_number);
 SELECT c.slot INTO equipment_slot FROM public.kq_player_equipment e JOIN public.kq_equipment_catalog c ON c.code=e.equipment_code
 WHERE e.user_id=p_user_id AND e.tent_number=v_storage_tent AND e.equipment_code=p_equipment_code
 AND c.is_active AND (NOT c.is_purchasable OR e.purchase_price_cents>0);
 IF NOT FOUND THEN RAISE EXCEPTION 'equipment_not_purchased'; END IF;
 INSERT INTO public.kq_equipment_loadouts(user_id,tent_number,slot,equipment_code) VALUES(p_user_id,v_storage_tent,equipment_slot,p_equipment_code)
 ON CONFLICT(user_id,tent_number,slot) DO UPDATE SET equipment_code=EXCLUDED.equipment_code,equipped_at=now();
 RETURN jsonb_build_object('equipmentCode',p_equipment_code,'tentNumber',v_storage_tent,'slot',equipment_slot,'equipped',true);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_purchase_equipment(p_user_id UUID,p_request_key UUID,p_equipment_codes TEXT[]) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.kq_equipment_purchase_receipts%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 SELECT * INTO old FROM public.kq_equipment_purchase_receipts WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND AND old.tent_number IS NULL THEN
  RETURN jsonb_build_object('purchaseId',old.id,'equipmentCodes',old.equipment_codes,'totalPriceCents',old.total_price_cents,'cashAfterCents',old.cash_after_cents,'replayed',true);
 END IF;
 IF NOT FOUND AND EXISTS(SELECT 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id AND production_units>1) AND EXISTS(SELECT 1 FROM unnest(p_equipment_codes) code WHERE NOT public.kq_is_shared_processing_equipment(code)) THEN RAISE EXCEPTION 'production_units_changed'; END IF;
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
 IF NOT FOUND AND EXISTS(SELECT 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id AND production_units>1) AND NOT public.kq_is_shared_processing_equipment(p_equipment_code) THEN RAISE EXCEPTION 'production_units_changed'; END IF;
 RETURN public.rpc_kq_upgrade_tent_equipment(p_user_id,p_request_key,p_equipment_code,p_expected_level,1);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_equip_durable(p_user_id UUID,p_equipment_code TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 IF EXISTS(SELECT 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id AND production_units>1) AND NOT public.kq_is_shared_processing_equipment(p_equipment_code) THEN RAISE EXCEPTION 'production_units_changed'; END IF;
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
 IF NOT FOUND AND EXISTS(SELECT 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id AND production_units>1) AND NOT public.kq_is_shared_processing_equipment(p_equipment_code) THEN RAISE EXCEPTION 'production_units_changed'; END IF;
 RETURN public.rpc_kq_repair_tent_machine(p_user_id,p_equipment_code,p_expected_version,p_expected_cost_cents,p_request_key,1);
END $$;

CREATE OR REPLACE FUNCTION public.kq_guard_culture_equipment_start() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE units INTEGER; tent RECORD; requested TEXT[]; expected TEXT[]; numbers INTEGER[];
BEGIN
 IF NEW.status::TEXT<>'active' THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||NEW.user_id::TEXT,0));
 PERFORM public.rpc_kq_ensure_equipment_profile(NEW.user_id);
 SELECT production_units INTO units FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
 IF COALESCE(NEW.state->'equipment'->'productionUnits','1'::JSONB) IS DISTINCT FROM to_jsonb(units) THEN RAISE EXCEPTION 'kq_production_units_changed'; END IF;
 SELECT array_agg(tent_number ORDER BY tent_number) INTO numbers FROM public.kq_run_tents(NEW.state);
 IF numbers IS DISTINCT FROM ARRAY(SELECT generate_series(1,units)) THEN RAISE EXCEPTION 'kq_culture_equipment_changed'; END IF;
 FOR tent IN SELECT * FROM public.kq_run_tents(NEW.state) LOOP
  IF jsonb_typeof(tent.codes) IS DISTINCT FROM 'array' OR jsonb_typeof(tent.levels) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'kq_culture_equipment_changed'; END IF;
  SELECT COALESCE(array_agg(code ORDER BY code),ARRAY[]::TEXT[]) INTO requested FROM jsonb_array_elements_text(tent.codes) item(code);
  IF EXISTS(SELECT 1 FROM public.kq_player_equipment WHERE user_id=NEW.user_id AND tent_number=tent.tent_number
   AND equipment_code=ANY(requested) AND culture_wear_percent=100 AND public.kq_culture_equipment_wear_delta(equipment_code,'balanced',0)>0) THEN RAISE EXCEPTION 'kq_culture_equipment_broken'; END IF;
  WITH usable AS (
   SELECT e.equipment_code,c.slot FROM public.kq_equipment_loadouts l
   JOIN public.kq_player_equipment e ON e.user_id=l.user_id AND e.tent_number=l.tent_number AND e.equipment_code=l.equipment_code
   JOIN public.kq_equipment_catalog c ON c.code=e.equipment_code
   WHERE l.user_id=NEW.user_id AND l.tent_number=tent.tent_number AND NOT public.kq_is_shared_processing_equipment(c.code) AND c.is_active AND (NOT c.is_purchasable OR e.purchase_price_cents>0)
   AND (public.kq_culture_equipment_wear_delta(e.equipment_code,'balanced',0)=0 OR e.culture_wear_percent<100)
  ), effective AS (
   SELECT equipment_code FROM usable UNION ALL
   SELECT starter.code FROM (VALUES('tent','TENT-080-STARTER'),('lighting','LED-150-STARTER'),('air','AIR-STARTER')) starter(slot,code)
   WHERE NOT EXISTS(SELECT 1 FROM usable WHERE usable.slot=starter.slot)
  ) SELECT array_agg(equipment_code ORDER BY equipment_code) INTO expected FROM effective;
  IF requested IS DISTINCT FROM expected THEN RAISE EXCEPTION 'kq_culture_equipment_changed'; END IF;
  IF EXISTS(SELECT 1 FROM public.kq_player_equipment e WHERE e.user_id=NEW.user_id AND e.tent_number=tent.tent_number
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
 THEN RAISE EXCEPTION 'kq_energy_quote_immutable'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.kq_wear_machines_on_completion() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status::TEXT<>'completed' OR OLD.status::TEXT='completed' THEN RETURN NEW; END IF;
 PERFORM public.rpc_kq_ensure_equipment_profile(NEW.user_id);
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
 UPDATE public.kq_player_equipment e SET wear_cycles=e.wear_cycles+1,maintenance_version=e.maintenance_version+1
 WHERE e.user_id=NEW.user_id AND e.tent_number=1 AND public.kq_is_shared_processing_equipment(e.equipment_code)
  AND e.equipment_code<>'SIFT-TRAY' AND e.wear_cycles<public.kq_machine_interval(e.equipment_code,e.level)
  AND CASE WHEN NEW.state->'equipment' ? 'shared'
    THEN COALESCE(NEW.state->'equipment'->'shared'->'codes','[]'::JSONB) ? e.equipment_code
    ELSE EXISTS(SELECT 1 FROM public.kq_run_tents(NEW.state) t WHERE t.codes ? e.equipment_code) END;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.kq_assert_processing_maintenance(p_user_id UUID,p_route TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(
  SELECT 1 FROM public.kq_player_equipment e JOIN public.kq_equipment_loadouts l USING(user_id,tent_number,equipment_code)
  JOIN public.kq_equipment_catalog c ON c.code=e.equipment_code
  WHERE e.user_id=p_user_id AND e.tent_number=1 AND public.kq_is_shared_processing_equipment(c.code) AND c.code<>'SIFT-TRAY'
  AND e.wear_cycles>=public.kq_machine_interval(e.equipment_code,e.level)
  AND ((p_route LIKE 'rosin-%' AND c.slot='press') OR (p_route IN ('ice-water-hash','hash-signature') AND c.slot='washing')
   OR (p_route='hash-signature' AND c.slot IN ('filtration','drying')) OR (p_route='static-sift' AND c.slot='static-separation'))
  AND NOT EXISTS(SELECT 1 FROM public.kq_player_equipment usable JOIN public.kq_equipment_loadouts installed USING(user_id,tent_number,equipment_code)
   JOIN public.kq_equipment_catalog alternative ON alternative.code=usable.equipment_code
   WHERE usable.user_id=e.user_id AND alternative.is_active AND alternative.slot=c.slot AND usable.wear_cycles<public.kq_machine_interval(usable.equipment_code,usable.level))
 ) THEN RAISE EXCEPTION 'commerce_machine_maintenance'; END IF;
END $$;

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
  FOR upgrade IN SELECT * FROM public.kq_equipment_upgrade_receipts WHERE user_id=p_user AND equipment_code=gear.equipment_code AND (tent_number=gear.tent_number OR public.kq_is_shared_processing_equipment(gear.equipment_code)) AND created_at>=acquired LOOP
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

CREATE OR REPLACE FUNCTION public.kq_treasury_observe() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_row JSONB:=CASE WHEN TG_OP='DELETE' THEN '{}'::JSONB ELSE to_jsonb(NEW) END;
 previous_row JSONB:=CASE WHEN TG_OP='INSERT' THEN '{}'::JSONB ELSE to_jsonb(OLD) END;
 data JSONB; owner UUID; old_owner UUID; source TEXT; at TIMESTAMPTZ; amount BIGINT; delta BIGINT; total_delta BIGINT; debt_delta BIGINT;
 account_name TEXT; expense_name TEXT; code TEXT; asset RECORD; cost BIGINT; ignored BIGINT;
BEGIN
 data:=CASE WHEN TG_OP='DELETE' THEN previous_row ELSE current_row END;
 owner:=COALESCE(data->>'user_id',data->>'owner_id')::UUID;
 IF owner IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=owner) THEN RETURN NULL; END IF;
 IF TG_TABLE_NAME='kq_equipment_wallets' AND TG_OP='INSERT' THEN
  PERFORM public.kq_treasury_initialize(owner);
  RETURN NULL;
 END IF;
 old_owner:=COALESCE(previous_row->>'user_id',previous_row->>'owner_id')::UUID;
 IF NOT EXISTS(SELECT 1 FROM public.kq_treasury_accounts WHERE user_id=owner) THEN
  IF old_owner IS NOT NULL AND old_owner<>owner THEN
   PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=old_owner FOR UPDATE;
   PERFORM public.kq_treasury_queue(old_owner);
  END IF;
  RETURN NULL;
 END IF;
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id IN (owner,old_owner) ORDER BY user_id FOR UPDATE;
 source:=TG_TABLE_NAME||':'||COALESCE(data->>'id',data->>'request_key',data->>'run_id',gen_random_uuid()::TEXT);
 at:=COALESCE((data->>'occurred_at')::TIMESTAMPTZ,(data->>'created_at')::TIMESTAMPTZ,(data->>'granted_at')::TIMESTAMPTZ,now());
 at:=GREATEST(at,(SELECT started_at FROM public.kq_treasury_accounts WHERE user_id=owner));
 CASE TG_TABLE_NAME
 WHEN 'kq_equipment_wallets' THEN
  delta:=COALESCE((current_row->>'cash_cents')::BIGINT,0)-COALESCE((previous_row->>'cash_cents')::BIGINT,0);
  PERFORM public.kq_treasury_pair(owner,'cash-movement','cash:'||gen_random_uuid(),now(),'cash','suspense',delta,'Mouvement du portefeuille');
 WHEN 'kq_commerce_accounts' THEN
  delta:=COALESCE((current_row->>'vat_reserved_cents')::BIGINT,0)-COALESCE((previous_row->>'vat_reserved_cents')::BIGINT,0);
  PERFORM public.kq_treasury_pair(owner,'vat-reserve','vat-reserve:'||gen_random_uuid(),now(),'vat_reserve','suspense',delta,'Réserve de TVA');
 WHEN 'arena_chanvrier_savings_deposits' THEN
  delta:=COALESCE((current_row->>'balance_cents')::BIGINT,0)-COALESCE((previous_row->>'balance_cents')::BIGINT,0);
  PERFORM public.kq_treasury_pair(owner,'savings-movement','savings:'||gen_random_uuid(),now(),'savings','suspense',delta,'Mouvement de l’épargne');
  IF TG_OP='UPDATE' AND delta>0 AND current_row->>'credited_at' IS DISTINCT FROM previous_row->>'credited_at' THEN
   PERFORM public.kq_treasury_pair(owner,'savings-interest','interest:'||gen_random_uuid(),now(),'suspense','revenue_interest',delta,'Intérêts crédités');
  END IF;
 WHEN 'kq_market_sale_receipts' THEN
  IF TG_OP='INSERT' THEN
   amount:=(data->>'payout_cents')::BIGINT; delta:=COALESCE((data->>'vat_cents')::BIGINT,0);
   account_name:=CASE data->>'sales_channel' WHEN 'online' THEN 'revenue_online' WHEN 'cbd-shop' THEN 'revenue_shop' ELSE 'revenue_wholesale' END;
   PERFORM public.kq_treasury_post(owner,'sale',source,at,jsonb_build_array(
    jsonb_build_object('account','suspense','deltaCents',amount),jsonb_build_object('account',account_name,'deltaCents',-(amount-delta)),
    jsonb_build_object('account','vat_payable','deltaCents',-delta)),data->>'flower_id');
  END IF;
 WHEN 'kq_lab_invoices','kq_energy_invoices' THEN
  account_name:=CASE TG_TABLE_NAME WHEN 'kq_lab_invoices' THEN 'lab_payable' ELSE 'energy_payable' END;
  expense_name:=CASE TG_TABLE_NAME WHEN 'kq_lab_invoices' THEN 'expense_lab' ELSE 'expense_energy' END;
  debt_delta:=COALESCE((current_row->>'remaining_cents')::BIGINT,0)-COALESCE((previous_row->>'remaining_cents')::BIGINT,0);
  IF TG_OP='DELETE' THEN total_delta:=-COALESCE((previous_row->>'remaining_cents')::BIGINT,0);
  ELSE total_delta:=COALESCE((current_row->>'amount_cents')::BIGINT,(current_row->>'total_cents')::BIGINT,0)-COALESCE((previous_row->>'amount_cents')::BIGINT,(previous_row->>'total_cents')::BIGINT,0); END IF;
  IF total_delta<>0 OR debt_delta<>0 THEN
   PERFORM public.kq_treasury_post(owner,CASE WHEN TG_OP='INSERT' THEN 'invoice-issued' ELSE 'invoice-payment' END,source||':'||gen_random_uuid(),now(),jsonb_build_array(
    jsonb_build_object('account',expense_name,'deltaCents',total_delta),jsonb_build_object('account',account_name,'deltaCents',-debt_delta),
    jsonb_build_object('account','suspense','deltaCents',debt_delta-total_delta)),data->>'run_id');
  END IF;
 WHEN 'kq_commerce_batches' THEN
  IF TG_OP='INSERT' THEN PERFORM public.kq_treasury_pair(owner,'processing',source,at,'expense_processing','suspense',(data->>'processing_cents')::BIGINT,data->>'flower_id'); END IF;
 WHEN 'kq_commerce_requests' THEN
  IF TG_OP='INSERT' AND data->>'action'='buy-computer' THEN
   ignored:=public.kq_treasury_add_asset(owner,source,'equipment','expense_depreciation',(data->'receipt'->>'paidCents')::BIGINT,at,4320,'COMPUTER');
  END IF;
 WHEN 'kq_equipment_purchase_receipts' THEN
  IF TG_OP='INSERT' THEN
   FOR code IN SELECT jsonb_array_elements_text(data->'equipment_codes') LOOP
    SELECT purchase_price_cents INTO cost FROM public.kq_player_equipment WHERE user_id=owner AND tent_number=public.kq_equipment_storage_tent(code,(data->>'tent_number')::INTEGER) AND equipment_code=code;
    IF cost IS NOT NULL THEN ignored:=public.kq_treasury_add_tent_asset(owner,source||':'||code,cost,at,code,public.kq_equipment_storage_tent(code,(data->>'tent_number')::INTEGER)); END IF;
   END LOOP;
  END IF;
 WHEN 'kq_equipment_upgrade_receipts' THEN
  IF TG_OP='INSERT' THEN ignored:=public.kq_treasury_add_tent_asset(owner,source,(data->>'price_cents')::BIGINT,at,data->>'equipment_code',(data->>'tent_number')::INTEGER); END IF;
 WHEN 'kq_machine_repairs' THEN
  IF TG_OP='INSERT' THEN PERFORM public.kq_treasury_pair(owner,'maintenance',source,at,'expense_maintenance','suspense',(data->'receipt'->>'paidCents')::BIGINT,data->>'equipment_code'); END IF;
 WHEN 'kq_culture_equipment_replacements' THEN
  IF TG_OP='INSERT' THEN
   PERFORM public.kq_treasury_refresh(owner);
   FOR asset IN SELECT * FROM public.kq_treasury_assets WHERE user_id=owner AND tent_number=(data->>'tent_number')::INTEGER AND equipment_code=data->>'equipment_code' AND retired_at IS NULL FOR UPDATE LOOP
    PERFORM public.kq_treasury_pair(owner,'asset-disposal','disposal:'||asset.id,at,'expense_other',asset.account,asset.cost_cents-asset.recognized_cents,asset.equipment_code);
    UPDATE public.kq_treasury_assets SET retired_at=at WHERE id=asset.id;
   END LOOP;
   ignored:=public.kq_treasury_add_tent_asset(owner,source,(data->'receipt'->>'paidCents')::BIGINT,at,data->>'equipment_code',(data->>'tent_number')::INTEGER);
  END IF;
 WHEN 'kq_business_ledger' THEN
  IF TG_OP='INSERT' THEN
   amount:=(data->>'amount_cents')::BIGINT;
   CASE data->>'kind'
    WHEN 'shop-created' THEN ignored:=public.kq_treasury_add_asset(owner,source,'website','expense_depreciation',amount,at,1440);
    WHEN 'shop-renewed' THEN ignored:=public.kq_treasury_add_asset(owner,source,'prepaid','expense_hosting',amount,(data->>'occurred_at')::TIMESTAMPTZ,120);
    WHEN 'domicile-paid' THEN ignored:=public.kq_treasury_add_asset(owner,source,'prepaid','expense_domiciliation',amount,(data->>'occurred_at')::TIMESTAMPTZ,120);
    WHEN 'advertising-started' THEN ignored:=public.kq_treasury_add_asset(owner,source,'prepaid','expense_advertising',amount,(data->>'occurred_at')::TIMESTAMPTZ,CASE amount WHEN 6000 THEN 40 WHEN 15000 THEN 28 ELSE 20 END);
    WHEN 'vat-paid' THEN PERFORM public.kq_treasury_pair(owner,'vat-remittance',source,at,'vat_payable','suspense',amount,'Reversement de TVA');
    ELSE NULL;
   END CASE;
  END IF;
 WHEN 'kq_pioneer_pack_grants' THEN
  IF TG_OP='INSERT' THEN PERFORM public.kq_treasury_pair(owner,'reward',source,at,'suspense','revenue_rewards',(data->>'cash_cents')::BIGINT,'Pack des Pionniers'); END IF;
 ELSE NULL;
 END CASE;
 PERFORM public.kq_treasury_queue(owner);
 IF old_owner IS NOT NULL AND old_owner<>owner THEN PERFORM public.kq_treasury_queue(old_owner); END IF;
 RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.kq_is_shared_processing_equipment(TEXT),
 public.kq_equipment_storage_tent(TEXT,INTEGER),public.kq_guard_shared_workshop_storage()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_purchase_tent_equipment(UUID,UUID,TEXT[],INTEGER),
 public.rpc_kq_upgrade_tent_equipment(UUID,UUID,TEXT,INTEGER,INTEGER),
 public.rpc_kq_equip_tent_equipment(UUID,TEXT,INTEGER),
 public.rpc_kq_repair_tent_machine(UUID,TEXT,INTEGER,INTEGER,UUID,INTEGER)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_purchase_tent_equipment(UUID,UUID,TEXT[],INTEGER),
 public.rpc_kq_upgrade_tent_equipment(UUID,UUID,TEXT,INTEGER,INTEGER),
 public.rpc_kq_equip_tent_equipment(UUID,TEXT,INTEGER),
 public.rpc_kq_repair_tent_machine(UUID,TEXT,INTEGER,INTEGER,UUID,INTEGER)
 TO service_role;
COMMENT ON COLUMN public.kq_equipment_wallets.production_units IS
 'Individual culture tents with one common culture and one shared processing workshop (canonical tent 1).';
COMMIT;
