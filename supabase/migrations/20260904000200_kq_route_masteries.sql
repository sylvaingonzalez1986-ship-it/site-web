BEGIN;

ALTER TABLE public.kq_market_sale_receipts
  ADD COLUMN IF NOT EXISTS matched_route_plan BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS first_route_mastery BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.kq_player_route_masteries (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route TEXT NOT NULL CHECK (route IN (
    'biomass', 'raw', 'dry-sift', 'static-sift', 'ice-water-hash',
    'rosin-trial', 'rosin-selection', 'rosin-premium',
    'rosin-signature', 'hash-signature'
  )),
  first_sale_receipt_id UUID NOT NULL UNIQUE REFERENCES public.kq_market_sale_receipts(id) ON DELETE RESTRICT,
  last_sale_receipt_id UUID NOT NULL REFERENCES public.kq_market_sale_receipts(id) ON DELETE RESTRICT,
  first_jury_score NUMERIC(3,1) NOT NULL CHECK (first_jury_score BETWEEN 0 AND 10),
  best_jury_score NUMERIC(3,1) NOT NULL CHECK (best_jury_score BETWEEN 0 AND 10),
  sale_count INTEGER NOT NULL DEFAULT 1 CHECK (sale_count > 0),
  total_payout_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_payout_cents >= 0),
  total_reputation INTEGER NOT NULL DEFAULT 0 CHECK (total_reputation >= 0),
  mastered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, route)
);

CREATE INDEX IF NOT EXISTS idx_kq_route_masteries_user_mastered
  ON public.kq_player_route_masteries(user_id, mastered_at DESC);

ALTER TABLE public.kq_player_route_masteries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kq_player_route_masteries_read_own ON public.kq_player_route_masteries;
CREATE POLICY kq_player_route_masteries_read_own ON public.kq_player_route_masteries
  FOR SELECT USING (auth.uid() = user_id);

REVOKE ALL ON public.kq_player_route_masteries FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.kq_player_route_masteries FROM authenticated;
GRANT SELECT ON public.kq_player_route_masteries TO authenticated;

INSERT INTO public.kq_player_route_masteries(
  user_id, route, first_sale_receipt_id, last_sale_receipt_id,
  first_jury_score, best_jury_score, sale_count,
  total_payout_cents, total_reputation, mastered_at, updated_at
)
SELECT
  owner_id,
  route,
  (array_agg(id ORDER BY created_at, id))[1],
  (array_agg(id ORDER BY created_at DESC, id DESC))[1],
  (array_agg(jury_score ORDER BY created_at, id))[1],
  MAX(jury_score),
  COUNT(*)::INTEGER,
  SUM(payout_cents)::BIGINT,
  SUM(reputation_gain)::INTEGER,
  MIN(created_at),
  MAX(created_at)
FROM public.kq_market_sale_receipts
GROUP BY owner_id, route
ON CONFLICT (user_id, route) DO NOTHING;

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
  v_mastery public.kq_player_route_masteries%ROWTYPE;
  v_option JSONB;
  v_payout INTEGER;
  v_reputation_gain INTEGER;
  v_cash_after INTEGER;
  v_reputation_after INTEGER;
  v_receipt_id UUID := gen_random_uuid();
  v_planned_route TEXT;
  v_matched_route_plan BOOLEAN := FALSE;
  v_first_route_mastery BOOLEAN := FALSE;
  v_mastered_routes JSONB := '[]'::JSONB;
BEGIN
  IF p_user_id IS NULL OR p_flower_id IS NULL OR p_request_key IS NULL
    OR NULLIF(BTRIM(p_route), '') IS NULL
  THEN RAISE EXCEPTION 'invalid_market_sale'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('kq-market:' || p_user_id::TEXT, 0));

  SELECT * INTO v_existing
  FROM public.kq_market_sale_receipts
  WHERE owner_id = p_user_id AND request_key = p_request_key;
  IF FOUND THEN
    SELECT * INTO v_mastery
    FROM public.kq_player_route_masteries
    WHERE user_id = p_user_id AND route = v_existing.route;
    SELECT COALESCE(jsonb_agg(m.route ORDER BY m.mastered_at), '[]'::JSONB)
      INTO v_mastered_routes
    FROM public.kq_player_route_masteries AS m
    WHERE m.user_id = p_user_id;
    RETURN jsonb_build_object(
      'receiptId', v_existing.id,
      'flowerId', v_existing.flower_id,
      'route', v_existing.route,
      'payoutCents', v_existing.payout_cents,
      'reputationGain', v_existing.reputation_gain,
      'cashAfterCents', v_existing.cash_after_cents,
      'reputationAfter', v_existing.reputation_after,
      'routeMastery', jsonb_build_object(
        'matchedPlan', v_existing.matched_route_plan,
        'firstMastery', v_existing.first_route_mastery,
        'routeSales', COALESCE(v_mastery.sale_count, 1),
        'masteredAt', COALESCE(v_mastery.mastered_at, v_existing.created_at),
        'masteredRoutes', v_mastered_routes
      ),
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
  SELECT planned_route_code INTO v_planned_route
  FROM public.kq_equipment_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  v_matched_route_plan := COALESCE(v_planned_route = p_route, FALSE);
  SELECT NOT EXISTS (
    SELECT 1 FROM public.kq_player_route_masteries
    WHERE user_id = p_user_id AND route = p_route
  ) INTO v_first_route_mastery;

  UPDATE public.kq_equipment_wallets
  SET cash_cents = cash_cents + v_payout,
    reputation = reputation + v_reputation_gain,
    planned_route_code = CASE WHEN v_matched_route_plan THEN NULL ELSE planned_route_code END,
    planned_equipment_code = CASE WHEN v_matched_route_plan THEN NULL ELSE planned_equipment_code END,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING cash_cents, reputation INTO v_cash_after, v_reputation_after;

  UPDATE public.kq_market_lots
  SET status = 'sold', selected_route = p_route, payout_cents = v_payout,
    reputation_gain = v_reputation_gain, settled_at = now(), updated_at = now()
  WHERE flower_id = p_flower_id;

  INSERT INTO public.kq_market_sale_receipts(
    id, request_key, flower_id, owner_id, route, jury_score, harvest_grams,
    payout_cents, reputation_gain, cash_after_cents, reputation_after,
    matched_route_plan, first_route_mastery
  ) VALUES (
    v_receipt_id, p_request_key, p_flower_id, p_user_id, p_route,
    v_lot.jury_score, v_lot.harvest_grams, v_payout, v_reputation_gain,
    v_cash_after, v_reputation_after, v_matched_route_plan, v_first_route_mastery
  );

  INSERT INTO public.kq_player_route_masteries(
    user_id, route, first_sale_receipt_id, last_sale_receipt_id,
    first_jury_score, best_jury_score, sale_count,
    total_payout_cents, total_reputation, mastered_at, updated_at
  ) VALUES (
    p_user_id, p_route, v_receipt_id, v_receipt_id,
    v_lot.jury_score, v_lot.jury_score, 1,
    v_payout, v_reputation_gain, now(), now()
  )
  ON CONFLICT (user_id, route) DO UPDATE SET
    last_sale_receipt_id = EXCLUDED.last_sale_receipt_id,
    best_jury_score = GREATEST(public.kq_player_route_masteries.best_jury_score, EXCLUDED.best_jury_score),
    sale_count = public.kq_player_route_masteries.sale_count + 1,
    total_payout_cents = public.kq_player_route_masteries.total_payout_cents + EXCLUDED.total_payout_cents,
    total_reputation = public.kq_player_route_masteries.total_reputation + EXCLUDED.total_reputation,
    updated_at = now()
  RETURNING * INTO v_mastery;

  SELECT COALESCE(jsonb_agg(m.route ORDER BY m.mastered_at), '[]'::JSONB)
    INTO v_mastered_routes
  FROM public.kq_player_route_masteries AS m
  WHERE m.user_id = p_user_id;

  RETURN jsonb_build_object(
    'receiptId', v_receipt_id,
    'flowerId', p_flower_id,
    'route', p_route,
    'payoutCents', v_payout,
    'reputationGain', v_reputation_gain,
    'cashAfterCents', v_cash_after,
    'reputationAfter', v_reputation_after,
    'routeMastery', jsonb_build_object(
      'matchedPlan', v_matched_route_plan,
      'firstMastery', v_first_route_mastery,
      'routeSales', v_mastery.sale_count,
      'masteredAt', v_mastery.mastered_at,
      'masteredRoutes', v_mastered_routes
    ),
    'replayed', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_sell_market_lot(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_sell_market_lot(UUID, UUID, UUID, TEXT) TO service_role;

COMMIT;
