BEGIN;

-- Split the old identical fleet into individually owned equipment copies.
-- Cash, historical receipts and finished/active run snapshots remain unchanged.
LOCK TABLE public.kq_equipment_wallets,public.kq_player_equipment,public.kq_equipment_loadouts
 IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE public.kq_player_equipment ADD COLUMN tent_number INTEGER NOT NULL DEFAULT 1 CHECK(tent_number BETWEEN 1 AND 8);
ALTER TABLE public.kq_equipment_loadouts ADD COLUMN tent_number INTEGER NOT NULL DEFAULT 1 CHECK(tent_number BETWEEN 1 AND 8);
ALTER TABLE public.kq_equipment_loadouts DISABLE TRIGGER kq_guard_culture_equipment_loadout;
DO $$ DECLARE relation RECORD; BEGIN
 FOR relation IN SELECT conname FROM pg_constraint WHERE conrelid='public.kq_equipment_loadouts'::regclass
  AND (contype IN ('p','u') OR confrelid='public.kq_player_equipment'::regclass) LOOP
  EXECUTE format('ALTER TABLE public.kq_equipment_loadouts DROP CONSTRAINT %I',relation.conname);
 END LOOP;
END $$;
ALTER TABLE public.kq_player_equipment DROP CONSTRAINT kq_player_equipment_pkey;
ALTER TABLE public.kq_player_equipment ADD PRIMARY KEY(user_id,tent_number,equipment_code);
ALTER TABLE public.kq_equipment_loadouts ADD PRIMARY KEY(user_id,tent_number,slot),
 ADD UNIQUE(user_id,tent_number,equipment_code),
 ADD FOREIGN KEY(user_id,tent_number,equipment_code) REFERENCES public.kq_player_equipment(user_id,tent_number,equipment_code) ON DELETE CASCADE;
INSERT INTO public.kq_player_equipment(user_id,tent_number,equipment_code,purchase_price_cents,acquired_at,level,wear_cycles,maintenance_version,culture_wear_percent,culture_wear_version)
 SELECT e.user_id,n,e.equipment_code,
  FLOOR(e.purchase_price_cents::NUMERIC*n/w.production_units)-FLOOR(e.purchase_price_cents::NUMERIC*(n-1)/w.production_units),
  e.acquired_at,e.level,e.wear_cycles,e.maintenance_version,e.culture_wear_percent,e.culture_wear_version
 FROM public.kq_player_equipment e JOIN public.kq_equipment_wallets w USING(user_id)
 CROSS JOIN LATERAL generate_series(2,w.production_units) n WHERE e.tent_number=1;
UPDATE public.kq_player_equipment e SET purchase_price_cents=FLOOR(e.purchase_price_cents::NUMERIC/w.production_units)
 FROM public.kq_equipment_wallets w WHERE e.user_id=w.user_id AND e.tent_number=1;
INSERT INTO public.kq_equipment_loadouts(user_id,tent_number,slot,equipment_code,equipped_at)
 SELECT l.user_id,n,l.slot,l.equipment_code,l.equipped_at FROM public.kq_equipment_loadouts l
 JOIN public.kq_equipment_wallets w USING(user_id) CROSS JOIN LATERAL generate_series(2,w.production_units) n WHERE l.tent_number=1;

-- NULL identifies immutable historical receipts that covered the entire fleet.
ALTER TABLE public.kq_equipment_purchase_receipts ADD COLUMN tent_number INTEGER CHECK(tent_number BETWEEN 1 AND 8);
ALTER TABLE public.kq_equipment_upgrade_receipts ADD COLUMN tent_number INTEGER CHECK(tent_number BETWEEN 1 AND 8);
ALTER TABLE public.kq_machine_repairs ADD COLUMN tent_number INTEGER CHECK(tent_number BETWEEN 1 AND 8);
ALTER TABLE public.kq_culture_equipment_replacements ADD COLUMN tent_number INTEGER CHECK(tent_number BETWEEN 1 AND 8);
ALTER TABLE public.kq_treasury_assets ADD COLUMN tent_number INTEGER CHECK(tent_number BETWEEN 1 AND 8);

-- Distribute existing live equipment assets without changing their total basis,
-- depreciation, dates, or the journal. Global property and prepaid assets stay global.
CREATE TEMP TABLE kq_tent_asset_split ON COMMIT DROP AS
 SELECT a.*,w.production_units FROM public.kq_treasury_assets a JOIN public.kq_equipment_wallets w USING(user_id)
 WHERE a.retired_at IS NULL AND EXISTS(SELECT 1 FROM public.kq_equipment_catalog c WHERE c.code=a.equipment_code);
INSERT INTO public.kq_treasury_assets(user_id,source_key,account,expense_account,equipment_code,cost_cents,recognized_cents,starts_at,ends_at,recognized_at,retired_at,tent_number)
 SELECT a.user_id,a.source_key||':tent:'||n,a.account,a.expense_account,a.equipment_code,
  FLOOR(a.cost_cents::NUMERIC*n/a.production_units)-FLOOR(a.cost_cents::NUMERIC*(n-1)/a.production_units),
  CASE WHEN a.cost_cents=0 THEN 0 ELSE
   FLOOR(a.recognized_cents::NUMERIC*FLOOR(a.cost_cents::NUMERIC*n/a.production_units)/a.cost_cents)
   -FLOOR(a.recognized_cents::NUMERIC*FLOOR(a.cost_cents::NUMERIC*(n-1)/a.production_units)/a.cost_cents) END,
  a.starts_at,a.ends_at,a.recognized_at,a.retired_at,n
 FROM kq_tent_asset_split a CROSS JOIN LATERAL generate_series(2,a.production_units) n;
UPDATE public.kq_treasury_assets a SET tent_number=1,
 cost_cents=FLOOR(s.cost_cents::NUMERIC/s.production_units),
 recognized_cents=CASE WHEN s.cost_cents=0 THEN 0 ELSE FLOOR(s.recognized_cents::NUMERIC*FLOOR(s.cost_cents::NUMERIC/s.production_units)/s.cost_cents) END
 FROM kq_tent_asset_split s WHERE a.id=s.id;

CREATE OR REPLACE FUNCTION public.rpc_kq_ensure_equipment_profile(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'invalid_equipment_user'; END IF;
 INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
 INSERT INTO public.kq_player_equipment(user_id,tent_number,equipment_code,purchase_price_cents)
 SELECT p_user_id,n,code,0 FROM public.kq_equipment_wallets w CROSS JOIN LATERAL generate_series(1,w.production_units) n
 CROSS JOIN (VALUES('TENT-080-STARTER'),('LED-150-STARTER'),('AIR-STARTER')) starter(code)
 WHERE w.user_id=p_user_id ON CONFLICT(user_id,tent_number,equipment_code) DO NOTHING;
 INSERT INTO public.kq_equipment_loadouts(user_id,tent_number,slot,equipment_code)
 SELECT p_user_id,n,slot,code FROM public.kq_equipment_wallets w CROSS JOIN LATERAL generate_series(1,w.production_units) n
 CROSS JOIN (VALUES('tent','TENT-080-STARTER'),('lighting','LED-150-STARTER'),('air','AIR-STARTER')) starter(slot,code)
 WHERE w.user_id=p_user_id ON CONFLICT(user_id,tent_number,slot) DO NOTHING;
 RETURN jsonb_build_object('ready',true);
END $$;

CREATE FUNCTION public.kq_assert_owned_tent(p_user_id UUID,p_tent_number INTEGER) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE units INTEGER;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 SELECT production_units INTO units FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF p_user_id IS NULL OR p_tent_number IS NULL OR units IS NULL OR p_tent_number NOT BETWEEN 1 AND units THEN
  RAISE EXCEPTION 'production_invalid_tent';
 END IF;
END $$;

CREATE FUNCTION public.kq_treasury_add_tent_asset(p_user UUID,p_key TEXT,p_cost BIGINT,p_start TIMESTAMPTZ,p_equipment TEXT,p_tent_number INTEGER,p_opening BOOLEAN DEFAULT false) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE remaining BIGINT;
BEGIN
 remaining:=public.kq_treasury_add_asset(p_user,p_key,'equipment','expense_depreciation',p_cost,p_start,4320,p_equipment,p_opening);
 UPDATE public.kq_treasury_assets SET tent_number=p_tent_number WHERE user_id=p_user AND source_key=p_key;
 RETURN remaining;
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
    IF v_existing.tent_number IS DISTINCT FROM p_tent_number OR v_existing.equipment_codes IS DISTINCT FROM v_codes THEN RAISE EXCEPTION 'equipment_purchase_request_mismatch'; END IF;
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
  WHERE user_id = p_user_id AND tent_number=p_tent_number AND equipment_code = ANY(v_codes);
  IF v_owned_count > 0 THEN RAISE EXCEPTION 'equipment_already_owned'; END IF;

  SELECT cash_cents,production_units INTO v_cash,v_units
  FROM public.kq_equipment_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  -- Purchases equip only the selected tent.
  IF v_cash < v_total THEN RAISE EXCEPTION 'insufficient_equipment_cash'; END IF;

  UPDATE public.kq_equipment_wallets
  SET cash_cents = cash_cents - v_total, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.kq_player_equipment(user_id, tent_number, equipment_code, purchase_price_cents)
  SELECT p_user_id, p_tent_number, code, price_cents
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
    IF v_existing.tent_number IS DISTINCT FROM p_tent_number OR v_existing.equipment_code <> p_equipment_code OR v_existing.previous_level <> p_expected_level THEN
      RAISE EXCEPTION 'equipment_upgrade_request_mismatch';
    END IF;
    RETURN jsonb_build_object('tentNumber',p_tent_number,'equipmentCode',v_existing.equipment_code,'level',v_existing.level,
      'priceCents',v_existing.price_cents,'cashAfterCents',v_existing.cash_after_cents,'replayed',TRUE);
  END IF;
  PERFORM public.kq_assert_owned_tent(p_user_id,p_tent_number);
  SELECT cash_cents,production_units INTO v_cash,v_units FROM public.kq_equipment_wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment_not_purchased'; END IF;
  SELECT owned.level, CEIL(catalog.price_cents::NUMERIC * owned.level / 10)::INTEGER INTO v_level,v_price
  FROM public.kq_player_equipment owned JOIN public.kq_equipment_catalog catalog ON catalog.code = owned.equipment_code
  WHERE owned.user_id = p_user_id AND owned.tent_number=p_tent_number AND owned.equipment_code = p_equipment_code
    AND owned.purchase_price_cents > 0 AND catalog.is_active AND catalog.is_purchasable
  FOR UPDATE OF owned;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment_not_purchased'; END IF;
  IF v_level >= 10 THEN RAISE EXCEPTION 'equipment_max_level'; END IF;
  IF v_level <> p_expected_level THEN RAISE EXCEPTION 'equipment_level_changed'; END IF;
  IF v_cash < v_price THEN RAISE EXCEPTION 'insufficient_equipment_cash'; END IF;
  UPDATE public.kq_equipment_wallets SET cash_cents = cash_cents - v_price, updated_at = now() WHERE user_id = p_user_id;
  UPDATE public.kq_player_equipment SET level = level + 1 WHERE user_id = p_user_id AND tent_number=p_tent_number AND equipment_code = p_equipment_code;
  INSERT INTO public.kq_equipment_upgrade_receipts(user_id,request_key,equipment_code,previous_level,level,price_cents,cash_after_cents,tent_number)
    VALUES(p_user_id,p_request_key,p_equipment_code,v_level,v_level+1,v_price,v_cash-v_price,p_tent_number);
  RETURN jsonb_build_object('tentNumber',p_tent_number,'equipmentCode',p_equipment_code,'level',v_level+1,
    'priceCents',v_price,'cashAfterCents',v_cash-v_price,'replayed',FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_repair_tent_machine(p_user_id UUID,p_equipment_code TEXT,p_expected_version INTEGER,p_expected_cost_cents INTEGER,p_request_key UUID,p_tent_number INTEGER) RETURNS JSONB
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
  IF old.tent_number IS DISTINCT FROM p_tent_number OR old.equipment_code<>p_equipment_code OR old.expected_version<>p_expected_version OR (old.receipt->>'paidCents')::INTEGER<>p_expected_cost_cents THEN RAISE EXCEPTION 'machine_request_mismatch'; END IF;
  RETURN old.receipt||'{"replayed":true}'::JSONB;
 END IF;
 PERFORM public.kq_assert_owned_tent(p_user_id,p_tent_number);
  SELECT * INTO gear FROM public.kq_player_equipment WHERE user_id=p_user_id AND tent_number=p_tent_number AND equipment_code=p_equipment_code FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'machine_not_owned'; END IF;
 SELECT * INTO catalog FROM public.kq_equipment_catalog WHERE code=p_equipment_code AND category='processing' AND code<>'SIFT-TRAY' AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'machine_unavailable'; END IF;
 IF gear.maintenance_version<>p_expected_version THEN RAISE EXCEPTION 'machine_condition_changed'; END IF;
 IF gear.wear_cycles<public.kq_machine_interval(gear.equipment_code,gear.level) THEN RAISE EXCEPTION 'machine_not_due'; END IF;
 cost:=CASE WHEN EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength='handyperson') THEN 0
  ELSE LEAST(20000,GREATEST(1000,CEIL(catalog.price_cents*.06*(1+(gear.level-1)*.05)))) END;
 -- The selected copy alone is repaired or replaced.
 IF cost<>p_expected_cost_cents THEN RAISE EXCEPTION 'machine_condition_changed'; END IF;
 IF cash<cost THEN RAISE EXCEPTION 'machine_insufficient_cash'; END IF;
 UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-cost,updated_at=now() WHERE user_id=p_user_id;
 UPDATE public.kq_player_equipment SET wear_cycles=0,maintenance_version=maintenance_version+1 WHERE user_id=p_user_id AND tent_number=p_tent_number AND equipment_code=p_equipment_code;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 result:=jsonb_build_object('tentNumber',p_tent_number,'equipmentCode',p_equipment_code,'paidCents',cost,'cashAfterCents',cash-cost,'version',gear.maintenance_version+1,'replayed',false);
 INSERT INTO public.kq_machine_repairs(user_id,request_key,equipment_code,expected_version,receipt,tent_number) VALUES(p_user_id,p_request_key,p_equipment_code,p_expected_version,result,p_tent_number);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_replace_tent_culture_equipment(
  p_user_id UUID,p_equipment_code TEXT,p_expected_version INTEGER,p_expected_cost_cents INTEGER,p_request_key UUID,p_tent_number INTEGER
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
    IF old.tent_number IS DISTINCT FROM p_tent_number OR old.equipment_code<>p_equipment_code OR old.expected_version<>p_expected_version
      OR (old.receipt->>'paidCents')::INTEGER<>p_expected_cost_cents THEN
      RAISE EXCEPTION 'culture_equipment_request_mismatch';
    END IF;
    RETURN old.receipt || '{"replayed":true}'::JSONB;
  END IF;
  IF EXISTS (SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='active') THEN
    RAISE EXCEPTION 'culture_equipment_active_run';
  END IF;
  PERFORM public.kq_assert_owned_tent(p_user_id,p_tent_number);
  SELECT * INTO gear FROM public.kq_player_equipment WHERE user_id=p_user_id AND tent_number=p_tent_number AND equipment_code=p_equipment_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'culture_equipment_not_owned'; END IF;
  SELECT * INTO catalog FROM public.kq_equipment_catalog WHERE code=p_equipment_code AND is_active AND is_purchasable;
  IF NOT FOUND OR gear.purchase_price_cents<=0 OR public.kq_culture_equipment_wear_delta(p_equipment_code,'balanced',0)=0 THEN
    RAISE EXCEPTION 'culture_equipment_unavailable';
  END IF;
  IF gear.culture_wear_version<>p_expected_version THEN RAISE EXCEPTION 'culture_equipment_condition_changed'; END IF;
  IF gear.culture_wear_percent<100 THEN RAISE EXCEPTION 'culture_equipment_not_due'; END IF;
  cost := CEIL(catalog.price_cents::NUMERIC*(100+(gear.level-1)*10)/100)::INTEGER;
  -- The selected copy alone is repaired or replaced.
  IF cost<>p_expected_cost_cents THEN RAISE EXCEPTION 'culture_equipment_condition_changed'; END IF;
  IF cash<cost THEN RAISE EXCEPTION 'culture_equipment_insufficient_cash'; END IF;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-cost,updated_at=now() WHERE user_id=p_user_id;
  UPDATE public.kq_player_equipment SET culture_wear_percent=0,culture_wear_version=culture_wear_version+1
    WHERE user_id=p_user_id AND tent_number=p_tent_number AND equipment_code=p_equipment_code;
  IF to_regclass('public.kq_commerce_accounts') IS NOT NULL THEN
    UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
  END IF;
  result := jsonb_build_object('tentNumber',p_tent_number,'equipmentCode',p_equipment_code,'paidCents',cost,'cashAfterCents',cash-cost,
    'version',gear.culture_wear_version+1,'level',gear.level,'replayed',false);
  INSERT INTO public.kq_culture_equipment_replacements(user_id,request_key,equipment_code,expected_version,receipt,tent_number)
    VALUES(p_user_id,p_request_key,p_equipment_code,p_expected_version,result,p_tent_number);
  RETURN result;
END $$;

CREATE FUNCTION public.rpc_kq_equip_tent_equipment(p_user_id UUID,p_equipment_code TEXT,p_tent_number INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE equipment_slot TEXT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
 PERFORM public.kq_assert_owned_tent(p_user_id,p_tent_number);
 SELECT c.slot INTO equipment_slot FROM public.kq_player_equipment e JOIN public.kq_equipment_catalog c ON c.code=e.equipment_code
 WHERE e.user_id=p_user_id AND e.tent_number=p_tent_number AND e.equipment_code=p_equipment_code
 AND c.is_active AND (NOT c.is_purchasable OR e.purchase_price_cents>0);
 IF NOT FOUND THEN RAISE EXCEPTION 'equipment_not_purchased'; END IF;
 INSERT INTO public.kq_equipment_loadouts(user_id,tent_number,slot,equipment_code) VALUES(p_user_id,p_tent_number,equipment_slot,p_equipment_code)
 ON CONFLICT(user_id,tent_number,slot) DO UPDATE SET equipment_code=EXCLUDED.equipment_code,equipped_at=now();
 RETURN jsonb_build_object('equipmentCode',p_equipment_code,'tentNumber',p_tent_number,'slot',equipment_slot,'equipped',true);
END $$;

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
  PERFORM public.kq_treasury_add_tent_asset(p_user_id,'production:'||p_request_key::TEXT||':tent:'||n,30000,now(),'STARTER-KIT',n);
 END LOOP;
 IF target=8 THEN PERFORM public.kq_treasury_add_asset(p_user_id,'production:'||p_request_key::TEXT||':warehouse','equipment','expense_depreciation',2000000,now(),4320,'WAREHOUSE-EXTENSION'); END IF;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 result:=jsonb_build_object('productionUnits',target,'previousUnits',units,'addedUnits',target-units,'priceCents',cost,'cashAfterCents',cash-cost,'replayed',false);
 INSERT INTO public.kq_production_expansions(user_id,request_key,previous_units,production_units,price_cents,receipt)
 VALUES(p_user_id,p_request_key,units,target,cost,result);
 RETURN result;
END $$;

-- Legacy entry points can replay earlier fleet receipts, but cannot silently
-- spend on the wrong copy after the player owns multiple tents.
CREATE OR REPLACE FUNCTION public.rpc_kq_purchase_equipment(p_user_id UUID,p_request_key UUID,p_equipment_codes TEXT[]) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.kq_equipment_purchase_receipts%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 SELECT * INTO old FROM public.kq_equipment_purchase_receipts WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND AND old.tent_number IS NULL THEN
  RETURN jsonb_build_object('purchaseId',old.id,'equipmentCodes',old.equipment_codes,'totalPriceCents',old.total_price_cents,'cashAfterCents',old.cash_after_cents,'replayed',true);
 END IF;
 IF NOT FOUND AND EXISTS(SELECT 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id AND production_units>1) THEN RAISE EXCEPTION 'production_units_changed'; END IF;
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
 IF NOT FOUND AND EXISTS(SELECT 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id AND production_units>1) THEN RAISE EXCEPTION 'production_units_changed'; END IF;
 RETURN public.rpc_kq_upgrade_tent_equipment(p_user_id,p_request_key,p_equipment_code,p_expected_level,1);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_equip_durable(p_user_id UUID,p_equipment_code TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 IF EXISTS(SELECT 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id AND production_units>1) THEN RAISE EXCEPTION 'production_units_changed'; END IF;
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
 IF NOT FOUND AND EXISTS(SELECT 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id AND production_units>1) THEN RAISE EXCEPTION 'production_units_changed'; END IF;
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
 IF NOT FOUND AND EXISTS(SELECT 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id AND production_units>1) THEN RAISE EXCEPTION 'production_units_changed'; END IF;
 RETURN public.rpc_kq_replace_tent_culture_equipment(p_user_id,p_equipment_code,p_expected_version,p_expected_cost_cents,p_request_key,1);
END $$;

-- Old snapshots describe identical copies; new snapshots identify every tent.
CREATE FUNCTION public.kq_run_tents(p_state JSONB) RETURNS TABLE(tent_number INTEGER,codes JSONB,levels JSONB)
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT (t->>'tentNumber')::INTEGER,COALESCE(t->'codes','[]'::JSONB),COALESCE(t->'levels','{}'::JSONB)
 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_state->'equipment'->'tents')='array' THEN p_state->'equipment'->'tents' ELSE '[]'::JSONB END) t
 UNION ALL
 SELECT n,COALESCE(p_state->'equipment'->'codes','[]'::JSONB),COALESCE(p_state->'equipment'->'levels','{}'::JSONB)
 FROM generate_series(1,public.kq_run_production_units(p_state)) n WHERE NOT(p_state->'equipment' ? 'tents');
$$;

CREATE OR REPLACE FUNCTION public.kq_guard_culture_equipment_loadout() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE units INTEGER;
BEGIN
 -- Callers already serialize equipment changes; profile initialization can run
 -- with the wallet locked, so this trigger must not acquire an advisory lock.
 SELECT production_units INTO units FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
 IF NEW.tent_number IS NULL OR units IS NULL OR NEW.tent_number NOT BETWEEN 1 AND units THEN RAISE EXCEPTION 'production_invalid_tent'; END IF;
 IF EXISTS(SELECT 1 FROM public.kq_player_equipment WHERE user_id=NEW.user_id AND tent_number=NEW.tent_number
  AND equipment_code=NEW.equipment_code AND culture_wear_percent=100
  AND public.kq_culture_equipment_wear_delta(equipment_code,'balanced',0)>0) THEN RAISE EXCEPTION 'kq_culture_equipment_broken'; END IF;
 RETURN NEW;
END $$;
ALTER TABLE public.kq_equipment_loadouts ENABLE TRIGGER kq_guard_culture_equipment_loadout;

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
   WHERE l.user_id=NEW.user_id AND l.tent_number=tent.tent_number AND c.is_active AND (NOT c.is_purchasable OR e.purchase_price_cents>0)
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
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.kq_lock_run_energy() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.state->'energy' IS DISTINCT FROM OLD.state->'energy'
 OR (OLD.state ? 'energy' AND NEW.state->'equipment' IS DISTINCT FROM OLD.state->'equipment')
 OR NEW.state->'equipment'->'productionUnits' IS DISTINCT FROM OLD.state->'equipment'->'productionUnits'
 OR NEW.state->'equipment'->'tents' IS DISTINCT FROM OLD.state->'equipment'->'tents'
 THEN RAISE EXCEPTION 'kq_energy_quote_immutable'; END IF;
 RETURN NEW;
END $$;

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
 FOR gear IN SELECT e.* FROM public.kq_player_equipment e JOIN public.kq_run_tents(NEW.state) t ON t.tent_number=e.tent_number
  WHERE e.user_id=NEW.user_id AND t.codes ? e.equipment_code AND public.kq_culture_equipment_wear_delta(e.equipment_code,mode,e.culture_wear_percent)>0
  ORDER BY e.tent_number,e.equipment_code FOR UPDATE OF e LOOP
  after_wear:=LEAST(100,gear.culture_wear_percent+public.kq_culture_equipment_wear_delta(gear.equipment_code,mode,gear.culture_wear_percent));
  UPDATE public.kq_player_equipment SET culture_wear_percent=after_wear,culture_wear_version=culture_wear_version+1
   WHERE user_id=NEW.user_id AND tent_number=gear.tent_number AND equipment_code=gear.equipment_code;
  changes:=changes||jsonb_build_array(jsonb_build_object('tentNumber',gear.tent_number,'equipmentCode',gear.equipment_code,'wearBefore',gear.culture_wear_percent,'wearAfter',after_wear,'version',gear.culture_wear_version+1));
 END LOOP;
 UPDATE public.kq_culture_equipment_wear_receipts SET equipment=changes WHERE run_id=NEW.id;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.kq_wear_machines_on_completion() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status::TEXT<>'completed' OR OLD.status::TEXT='completed' THEN RETURN NEW; END IF;
 PERFORM public.rpc_kq_ensure_equipment_profile(NEW.user_id);
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
 UPDATE public.kq_player_equipment e SET wear_cycles=e.wear_cycles+1,maintenance_version=e.maintenance_version+1
 FROM public.kq_equipment_catalog c,public.kq_run_tents(NEW.state) t WHERE e.user_id=NEW.user_id AND c.code=e.equipment_code
 AND t.tent_number=e.tent_number AND t.codes ? e.equipment_code AND c.category='processing' AND c.code<>'SIFT-TRAY'
 AND e.wear_cycles<public.kq_machine_interval(e.equipment_code,e.level);
 RETURN NEW;
END $$;

-- Common harvests use the available processing machines across every tent.
CREATE OR REPLACE FUNCTION public.kq_assert_processing_maintenance(p_user_id UUID,p_route TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(
  SELECT 1 FROM public.kq_player_equipment e JOIN public.kq_equipment_loadouts l USING(user_id,tent_number,equipment_code)
  JOIN public.kq_equipment_catalog c ON c.code=e.equipment_code
  WHERE e.user_id=p_user_id AND c.category='processing' AND c.code<>'SIFT-TRAY'
  AND e.wear_cycles>=public.kq_machine_interval(e.equipment_code,e.level)
  AND ((p_route LIKE 'rosin-%' AND c.slot='press') OR (p_route IN ('ice-water-hash','hash-signature') AND c.slot='washing')
   OR (p_route='hash-signature' AND c.slot IN ('filtration','drying')) OR (p_route='static-sift' AND c.slot='static-separation'))
  AND NOT EXISTS(SELECT 1 FROM public.kq_player_equipment usable JOIN public.kq_equipment_loadouts installed USING(user_id,tent_number,equipment_code)
   JOIN public.kq_equipment_catalog alternative ON alternative.code=usable.equipment_code
   WHERE usable.user_id=e.user_id AND alternative.is_active AND alternative.slot=c.slot AND usable.wear_cycles<public.kq_machine_interval(usable.equipment_code,usable.level))
 ) THEN RAISE EXCEPTION 'commerce_machine_maintenance'; END IF;
END $$;

-- Preserve all later commerce patches; change only the comparison of the
-- installed shared pool. Abort on drift instead of replacing unrelated behavior.
DO $$ DECLARE definition TEXT; fragment TEXT:=
 '(SELECT COALESCE(array_agg(equipment_code ORDER BY equipment_code),ARRAY[]::TEXT[]) FROM public.kq_equipment_loadouts WHERE user_id=p_user_id)';
BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure) INTO definition;
 IF position(fragment in definition)=0 THEN RAISE EXCEPTION 'individual_tents_commerce_function_drift'; END IF;
 definition:=replace(definition,fragment,
 '(SELECT COALESCE(array_agg(DISTINCT equipment_code ORDER BY equipment_code),ARRAY[]::TEXT[]) FROM public.kq_equipment_loadouts WHERE user_id=p_user_id)');
 EXECUTE definition;
END $$;

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
  SELECT CASE WHEN NEW.state->'equipment' ? 'tents' THEN
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

CREATE OR REPLACE FUNCTION public.rpc_kq_energy_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH care AS (SELECT COUNT(*)::INTEGER AS cycles FROM public.kq_energy_invoices WHERE user_id=p_user_id AND dog_care IS NOT NULL),
  fleet AS (SELECT COUNT(*)::INTEGER AS units FROM public.kq_equipment_loadouts WHERE user_id=p_user_id AND equipment_code='SECURITY-DOG')
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
  FOR upgrade IN SELECT * FROM public.kq_equipment_upgrade_receipts WHERE user_id=p_user AND equipment_code=gear.equipment_code AND tent_number=gear.tent_number AND created_at>=acquired LOOP
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
    SELECT purchase_price_cents INTO cost FROM public.kq_player_equipment WHERE user_id=owner AND tent_number=(data->>'tent_number')::INTEGER AND equipment_code=code;
    IF cost IS NOT NULL THEN ignored:=public.kq_treasury_add_tent_asset(owner,source||':'||code,cost,at,code,(data->>'tent_number')::INTEGER); END IF;
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

REVOKE ALL ON FUNCTION public.kq_assert_owned_tent(UUID,INTEGER),public.kq_run_tents(JSONB),
 public.kq_treasury_add_tent_asset(UUID,TEXT,BIGINT,TIMESTAMPTZ,TEXT,INTEGER,BOOLEAN),
 public.rpc_kq_purchase_tent_equipment(UUID,UUID,TEXT[],INTEGER),public.rpc_kq_upgrade_tent_equipment(UUID,UUID,TEXT,INTEGER,INTEGER),
 public.rpc_kq_equip_tent_equipment(UUID,TEXT,INTEGER),public.rpc_kq_repair_tent_machine(UUID,TEXT,INTEGER,INTEGER,UUID,INTEGER),
 public.rpc_kq_replace_tent_culture_equipment(UUID,TEXT,INTEGER,INTEGER,UUID,INTEGER)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_purchase_tent_equipment(UUID,UUID,TEXT[],INTEGER),
 public.rpc_kq_upgrade_tent_equipment(UUID,UUID,TEXT,INTEGER,INTEGER),public.rpc_kq_equip_tent_equipment(UUID,TEXT,INTEGER),
 public.rpc_kq_repair_tent_machine(UUID,TEXT,INTEGER,INTEGER,UUID,INTEGER),public.rpc_kq_replace_tent_culture_equipment(UUID,TEXT,INTEGER,INTEGER,UUID,INTEGER)
 TO service_role;

COMMENT ON COLUMN public.kq_equipment_wallets.production_units IS 'Owned tents: independent equipment, levels and wear, with one common culture.';
COMMIT;

