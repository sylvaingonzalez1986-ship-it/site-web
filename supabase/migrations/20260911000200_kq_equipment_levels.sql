BEGIN;

ALTER TABLE public.kq_player_equipment
  ADD COLUMN level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10);

-- Preserve paid ownership, installed slots and the best model when merging duplicates.
CREATE TEMP TABLE kq_equipment_replacements(old_code TEXT, code TEXT, level INTEGER) ON COMMIT DROP;
INSERT INTO kq_equipment_replacements VALUES
  ('TENT-150','TENT-120',10), ('LED-500','LED-300',10),
  ('WASHER-75G','WASHER-25L',5), ('TSS-225','WASHER-25L',10),
  ('PRESS-2T','PRESS-0600',5), ('PRESS-10T','PRESS-0600',8), ('PRESS-20T','PRESS-0600',10);

INSERT INTO public.kq_player_equipment(user_id,equipment_code,purchase_price_cents,acquired_at,level)
SELECT owned.user_id, replacement.code, MAX(owned.purchase_price_cents), MIN(owned.acquired_at),
  MAX(CASE WHEN owned.purchase_price_cents > 0 THEN replacement.level ELSE 1 END)
FROM public.kq_player_equipment owned JOIN kq_equipment_replacements replacement ON replacement.old_code = owned.equipment_code
GROUP BY owned.user_id,replacement.code
ON CONFLICT(user_id,equipment_code) DO UPDATE SET
  purchase_price_cents = GREATEST(kq_player_equipment.purchase_price_cents, EXCLUDED.purchase_price_cents),
  level = GREATEST(kq_player_equipment.level, EXCLUDED.level),
  acquired_at = LEAST(kq_player_equipment.acquired_at, EXCLUDED.acquired_at);

UPDATE public.kq_equipment_loadouts loadout SET equipment_code = replacement.code
FROM kq_equipment_replacements replacement WHERE loadout.equipment_code = replacement.old_code;
UPDATE public.kq_equipment_wallets wallet SET planned_equipment_code = replacement.code
FROM kq_equipment_replacements replacement WHERE wallet.planned_equipment_code = replacement.old_code;
DELETE FROM public.kq_player_equipment owned USING kq_equipment_replacements replacement
WHERE owned.equipment_code = replacement.old_code;
UPDATE public.kq_equipment_catalog catalog SET is_active = FALSE, is_purchasable = FALSE, updated_at = now()
FROM kq_equipment_replacements replacement WHERE catalog.code = replacement.old_code;

CREATE TABLE public.kq_equipment_upgrade_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_key UUID NOT NULL,
  equipment_code TEXT NOT NULL REFERENCES public.kq_equipment_catalog(code),
  previous_level INTEGER NOT NULL CHECK (previous_level BETWEEN 1 AND 9),
  level INTEGER NOT NULL CHECK (level = previous_level + 1 AND level BETWEEN 2 AND 10),
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  cash_after_cents INTEGER NOT NULL CHECK (cash_after_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id,request_key)
);
ALTER TABLE public.kq_equipment_upgrade_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_equipment_upgrade_receipts FROM anon, authenticated;
GRANT ALL ON public.kq_equipment_upgrade_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_upgrade_equipment(
  p_user_id UUID, p_request_key UUID, p_equipment_code TEXT, p_expected_level INTEGER
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing public.kq_equipment_upgrade_receipts%ROWTYPE;
  v_level INTEGER;
  v_price INTEGER;
  v_cash INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL OR p_equipment_code IS NULL
    OR p_expected_level IS NULL OR p_expected_level NOT BETWEEN 1 AND 9 THEN
    RAISE EXCEPTION 'invalid_equipment_upgrade';
  END IF;
  -- Same lock as purchases and installation; the wallet row also serializes sales.
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || p_user_id::TEXT, 0));
  SELECT * INTO v_existing FROM public.kq_equipment_upgrade_receipts
    WHERE user_id = p_user_id AND request_key = p_request_key;
  IF FOUND THEN
    IF v_existing.equipment_code <> p_equipment_code OR v_existing.previous_level <> p_expected_level THEN
      RAISE EXCEPTION 'equipment_upgrade_request_mismatch';
    END IF;
    RETURN jsonb_build_object('equipmentCode',v_existing.equipment_code,'level',v_existing.level,
      'priceCents',v_existing.price_cents,'cashAfterCents',v_existing.cash_after_cents,'replayed',TRUE);
  END IF;
  SELECT cash_cents INTO v_cash FROM public.kq_equipment_wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment_not_purchased'; END IF;
  SELECT owned.level, CEIL(catalog.price_cents::NUMERIC * owned.level / 10)::INTEGER INTO v_level,v_price
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
REVOKE ALL ON FUNCTION public.rpc_kq_upgrade_equipment(UUID,UUID,TEXT,INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_upgrade_equipment(UUID,UUID,TEXT,INTEGER) TO service_role;

COMMIT;
