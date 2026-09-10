BEGIN;

CREATE TABLE IF NOT EXISTS public.kq_market_lots (
  flower_id UUID PRIMARY KEY REFERENCES public.kq_flowers(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  harvest_grams NUMERIC(7,1) NOT NULL CHECK (harvest_grams BETWEEN 20 AND 500),
  jury_score NUMERIC(3,1) NOT NULL CHECK (jury_score BETWEEN 0 AND 10),
  quality_band TEXT NOT NULL CHECK (quality_band IN ('biomass', 'standard', 'selection', 'premium', 'signature')),
  equipment_codes TEXT[] NOT NULL DEFAULT '{}',
  options JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(options) = 'array'),
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'sold')),
  selected_route TEXT,
  payout_cents INTEGER CHECK (payout_cents IS NULL OR payout_cents >= 0),
  reputation_gain INTEGER CHECK (reputation_gain IS NULL OR reputation_gain >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  CHECK (
    (status = 'ready' AND selected_route IS NULL AND payout_cents IS NULL AND reputation_gain IS NULL AND settled_at IS NULL)
    OR
    (status = 'sold' AND selected_route IS NOT NULL AND payout_cents IS NOT NULL AND reputation_gain IS NOT NULL AND settled_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_kq_market_lots_owner_status
  ON public.kq_market_lots(owner_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.kq_market_sale_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key UUID NOT NULL,
  flower_id UUID NOT NULL UNIQUE REFERENCES public.kq_flowers(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route TEXT NOT NULL,
  jury_score NUMERIC(3,1) NOT NULL,
  harvest_grams NUMERIC(7,1) NOT NULL,
  payout_cents INTEGER NOT NULL CHECK (payout_cents >= 0),
  reputation_gain INTEGER NOT NULL CHECK (reputation_gain >= 0),
  cash_after_cents INTEGER NOT NULL CHECK (cash_after_cents >= 0),
  reputation_after INTEGER NOT NULL CHECK (reputation_after >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, request_key)
);

ALTER TABLE public.kq_market_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_market_sale_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kq_market_lots_read_own ON public.kq_market_lots;
CREATE POLICY kq_market_lots_read_own ON public.kq_market_lots
  FOR SELECT USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS kq_market_sale_receipts_read_own ON public.kq_market_sale_receipts;
CREATE POLICY kq_market_sale_receipts_read_own ON public.kq_market_sale_receipts
  FOR SELECT USING (auth.uid() = owner_id);

REVOKE INSERT, UPDATE, DELETE ON public.kq_market_lots FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.kq_market_sale_receipts FROM anon, authenticated;

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
    OR p_harvest_grams NOT BETWEEN 20 AND 500
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

CREATE OR REPLACE FUNCTION public.rpc_kq_sell_market_lot(
  p_user_id UUID,
  p_flower_id UUID,
  p_request_key UUID,
  p_route TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot public.kq_market_lots%ROWTYPE;
  v_existing public.kq_market_sale_receipts%ROWTYPE;
  v_option JSONB;
  v_payout INTEGER;
  v_reputation_gain INTEGER;
  v_cash_after INTEGER;
  v_reputation_after INTEGER;
  v_receipt_id UUID := gen_random_uuid();
BEGIN
  IF p_user_id IS NULL OR p_flower_id IS NULL OR p_request_key IS NULL
    OR NULLIF(BTRIM(p_route), '') IS NULL
  THEN RAISE EXCEPTION 'invalid_market_sale'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('kq-market:' || p_user_id::TEXT, 0));

  SELECT * INTO v_existing
  FROM public.kq_market_sale_receipts
  WHERE owner_id = p_user_id AND request_key = p_request_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'receiptId', v_existing.id,
      'flowerId', v_existing.flower_id,
      'route', v_existing.route,
      'payoutCents', v_existing.payout_cents,
      'reputationGain', v_existing.reputation_gain,
      'cashAfterCents', v_existing.cash_after_cents,
      'reputationAfter', v_existing.reputation_after,
      'replayed', TRUE
    );
  END IF;

  SELECT * INTO v_lot
  FROM public.kq_market_lots
  WHERE flower_id = p_flower_id AND owner_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_lot.status <> 'ready' THEN RAISE EXCEPTION 'market_lot_unavailable'; END IF;

  SELECT entry.value INTO v_option
  FROM jsonb_array_elements(v_lot.options) AS entry(value)
  WHERE entry.value->>'route' = p_route
  LIMIT 1;
  IF v_option IS NULL OR COALESCE((v_option->>'available')::BOOLEAN, FALSE) = FALSE
  THEN RAISE EXCEPTION 'market_route_unavailable'; END IF;

  v_payout := FLOOR((v_option->>'payoutCents')::NUMERIC);
  v_reputation_gain := FLOOR((v_option->>'reputationGain')::NUMERIC);
  IF v_payout < 0 OR v_reputation_gain < 0 THEN RAISE EXCEPTION 'invalid_market_quote'; END IF;

  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
  UPDATE public.kq_equipment_wallets
  SET cash_cents = cash_cents + v_payout,
    reputation = reputation + v_reputation_gain,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING cash_cents, reputation INTO v_cash_after, v_reputation_after;

  UPDATE public.kq_market_lots
  SET status = 'sold', selected_route = p_route, payout_cents = v_payout,
    reputation_gain = v_reputation_gain, settled_at = now(), updated_at = now()
  WHERE flower_id = p_flower_id;

  INSERT INTO public.kq_market_sale_receipts(
    id, request_key, flower_id, owner_id, route, jury_score, harvest_grams,
    payout_cents, reputation_gain, cash_after_cents, reputation_after
  ) VALUES (
    v_receipt_id, p_request_key, p_flower_id, p_user_id, p_route,
    v_lot.jury_score, v_lot.harvest_grams, v_payout, v_reputation_gain,
    v_cash_after, v_reputation_after
  );

  RETURN jsonb_build_object(
    'receiptId', v_receipt_id,
    'flowerId', p_flower_id,
    'route', p_route,
    'payoutCents', v_payout,
    'reputationGain', v_reputation_gain,
    'cashAfterCents', v_cash_after,
    'reputationAfter', v_reputation_after,
    'replayed', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_prepare_market_lot(UUID, UUID, NUMERIC, NUMERIC, TEXT, TEXT[], JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_kq_sell_market_lot(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_prepare_market_lot(UUID, UUID, NUMERIC, NUMERIC, TEXT, TEXT[], JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_sell_market_lot(UUID, UUID, UUID, TEXT) TO service_role;

COMMIT;
