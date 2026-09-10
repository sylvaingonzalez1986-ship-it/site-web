BEGIN;

CREATE TABLE IF NOT EXISTS public.kq_equipment_catalog (
  code TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('infrastructure', 'lighting', 'climate', 'processing', 'energy', 'security')),
  slot TEXT NOT NULL CHECK (slot IN ('tent', 'lighting', 'air', 'climate-controller', 'sifting', 'washing', 'press', 'drying', 'energy', 'security')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  is_purchasable BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.kq_equipment_catalog(code, category, slot, price_cents, is_purchasable, sort_order)
VALUES
  ('TENT-080-STARTER', 'infrastructure', 'tent', 0, FALSE, 10),
  ('TENT-120', 'infrastructure', 'tent', 16000, TRUE, 20),
  ('TENT-150', 'infrastructure', 'tent', 23000, TRUE, 30),
  ('LED-150-STARTER', 'lighting', 'lighting', 0, FALSE, 40),
  ('LED-300', 'lighting', 'lighting', 30000, TRUE, 50),
  ('LED-500', 'lighting', 'lighting', 50000, TRUE, 60),
  ('AIR-STARTER', 'climate', 'air', 0, FALSE, 70),
  ('AIR-EC6', 'climate', 'air', 8500, TRUE, 80),
  ('CLIMATE-SMART', 'climate', 'climate-controller', 25000, TRUE, 90),
  ('SIFT-TRAY', 'processing', 'sifting', 8500, TRUE, 100),
  ('WASHER-25L', 'processing', 'washing', 11000, TRUE, 110),
  ('PRESS-0600', 'processing', 'press', 13000, TRUE, 120),
  ('PRESS-2T', 'processing', 'press', 25000, TRUE, 130),
  ('PRESS-10T', 'processing', 'press', 45500, TRUE, 140),
  ('PRESS-20T', 'processing', 'press', 70000, TRUE, 150),
  ('FREEZE-DRYER', 'processing', 'drying', 180000, TRUE, 160),
  ('SOLAR-BACKUP', 'energy', 'energy', 45000, TRUE, 170),
  ('SECURITY-CAMERA', 'security', 'security', 9000, TRUE, 180)
ON CONFLICT (code) DO UPDATE SET
  category = EXCLUDED.category,
  slot = EXCLUDED.slot,
  price_cents = EXCLUDED.price_cents,
  is_purchasable = EXCLUDED.is_purchasable,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.kq_equipment_wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cash_cents INTEGER NOT NULL DEFAULT 35000 CHECK (cash_cents >= 0),
  reputation INTEGER NOT NULL DEFAULT 0 CHECK (reputation >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kq_player_equipment (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  equipment_code TEXT NOT NULL REFERENCES public.kq_equipment_catalog(code),
  purchase_price_cents INTEGER NOT NULL CHECK (purchase_price_cents >= 0),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, equipment_code)
);

CREATE TABLE IF NOT EXISTS public.kq_equipment_loadouts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('tent', 'lighting', 'air', 'climate-controller', 'sifting', 'washing', 'press', 'drying', 'energy', 'security')),
  equipment_code TEXT NOT NULL REFERENCES public.kq_equipment_catalog(code),
  equipped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot),
  UNIQUE (user_id, equipment_code),
  FOREIGN KEY (user_id, equipment_code)
    REFERENCES public.kq_player_equipment(user_id, equipment_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.kq_equipment_purchase_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  equipment_codes TEXT[] NOT NULL CHECK (cardinality(equipment_codes) BETWEEN 1 AND 8),
  total_price_cents INTEGER NOT NULL CHECK (total_price_cents > 0),
  cash_after_cents INTEGER NOT NULL CHECK (cash_after_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_key)
);

ALTER TABLE public.kq_equipment_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_equipment_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_player_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_equipment_loadouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_equipment_purchase_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kq_equipment_catalog_read_active ON public.kq_equipment_catalog;
CREATE POLICY kq_equipment_catalog_read_active ON public.kq_equipment_catalog
  FOR SELECT USING (is_active = TRUE);
DROP POLICY IF EXISTS kq_equipment_wallets_read_own ON public.kq_equipment_wallets;
CREATE POLICY kq_equipment_wallets_read_own ON public.kq_equipment_wallets
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS kq_player_equipment_read_own ON public.kq_player_equipment;
CREATE POLICY kq_player_equipment_read_own ON public.kq_player_equipment
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS kq_equipment_loadouts_read_own ON public.kq_equipment_loadouts;
CREATE POLICY kq_equipment_loadouts_read_own ON public.kq_equipment_loadouts
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS kq_equipment_purchase_receipts_read_own ON public.kq_equipment_purchase_receipts;
CREATE POLICY kq_equipment_purchase_receipts_read_own ON public.kq_equipment_purchase_receipts
  FOR SELECT USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.kq_equipment_catalog FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.kq_equipment_wallets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.kq_player_equipment FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.kq_equipment_loadouts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.kq_equipment_purchase_receipts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_kq_ensure_equipment_profile(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'invalid_equipment_user'; END IF;

  INSERT INTO public.kq_equipment_wallets(user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.kq_player_equipment(user_id, equipment_code, purchase_price_cents)
  VALUES
    (p_user_id, 'TENT-080-STARTER', 0),
    (p_user_id, 'LED-150-STARTER', 0),
    (p_user_id, 'AIR-STARTER', 0)
  ON CONFLICT (user_id, equipment_code) DO NOTHING;

  INSERT INTO public.kq_equipment_loadouts(user_id, slot, equipment_code)
  VALUES
    (p_user_id, 'tent', 'TENT-080-STARTER'),
    (p_user_id, 'lighting', 'LED-150-STARTER'),
    (p_user_id, 'air', 'AIR-STARTER')
  ON CONFLICT (user_id, slot) DO NOTHING;

  RETURN jsonb_build_object('ready', TRUE);
END;
$$;

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
  v_purchase_id UUID := gen_random_uuid();
  v_existing public.kq_equipment_purchase_receipts%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL THEN RAISE EXCEPTION 'invalid_equipment_purchase'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || p_user_id::TEXT, 0));

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

  SELECT cash_cents INTO v_cash
  FROM public.kq_equipment_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF v_cash < v_total THEN RAISE EXCEPTION 'insufficient_equipment_cash'; END IF;

  UPDATE public.kq_equipment_wallets
  SET cash_cents = cash_cents - v_total, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.kq_player_equipment(user_id, equipment_code, purchase_price_cents)
  SELECT p_user_id, code, price_cents
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

CREATE OR REPLACE FUNCTION public.rpc_kq_equip_durable(
  p_user_id UUID,
  p_equipment_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot TEXT;
BEGIN
  IF p_user_id IS NULL OR NULLIF(BTRIM(p_equipment_code), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_equipment_loadout';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || p_user_id::TEXT, 0));
  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);

  SELECT catalog.slot INTO v_slot
  FROM public.kq_player_equipment owned
  JOIN public.kq_equipment_catalog catalog ON catalog.code = owned.equipment_code
  WHERE owned.user_id = p_user_id
    AND owned.equipment_code = p_equipment_code
    AND catalog.is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment_not_owned'; END IF;

  INSERT INTO public.kq_equipment_loadouts(user_id, slot, equipment_code, equipped_at)
  VALUES (p_user_id, v_slot, p_equipment_code, now())
  ON CONFLICT (user_id, slot) DO UPDATE SET
    equipment_code = EXCLUDED.equipment_code,
    equipped_at = now();

  RETURN jsonb_build_object(
    'equipmentCode', p_equipment_code,
    'slot', v_slot,
    'equipped', TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_ensure_equipment_profile(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_kq_purchase_equipment(UUID, UUID, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_kq_equip_durable(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_ensure_equipment_profile(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_purchase_equipment(UUID, UUID, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_equip_durable(UUID, TEXT) TO service_role;

COMMIT;
