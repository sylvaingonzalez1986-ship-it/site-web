BEGIN;

-- Signed deltas; the wallet and receipt balance remain non-negative.
-- No historical receipt, balance or mastery is recalculated.
ALTER TABLE public.kq_market_lots
  DROP CONSTRAINT kq_market_lots_reputation_gain_check;
ALTER TABLE public.kq_market_sale_receipts
  DROP CONSTRAINT kq_market_sale_receipts_reputation_gain_check;
ALTER TABLE public.kq_player_route_masteries
  DROP CONSTRAINT kq_player_route_masteries_total_reputation_check;

-- Authoritative game balance, mirrored by calculateKqMarketReputation in TypeScript.
CREATE OR REPLACE FUNCTION public.kq_market_reputation_delta(p_route TEXT, p_jury_score NUMERIC)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_score INTEGER;
  v_neutral INTEGER := 70;
  v_gain INTEGER := 80;
  v_weight INTEGER;
BEGIN
  IF p_jury_score IS NULL OR p_jury_score NOT BETWEEN 0 AND 10
  THEN RAISE EXCEPTION 'invalid_market_score'; END IF;
  v_weight := CASE p_route
    WHEN 'biomass' THEN 0 WHEN 'raw' THEN 100
    WHEN 'dry-sift' THEN 135 WHEN 'static-sift' THEN 380
    WHEN 'ice-water-hash' THEN 170 WHEN 'hash-signature' THEN 420
    WHEN 'rosin-trial' THEN 155 WHEN 'rosin-selection' THEN 200
    WHEN 'rosin-premium' THEN 260 WHEN 'rosin-signature' THEN 360
    ELSE NULL END;
  IF v_weight IS NULL THEN RAISE EXCEPTION 'invalid_market_route'; END IF;
  IF v_weight = 0 THEN RETURN 0; END IF;
  IF p_route IN ('rosin-trial', 'rosin-selection', 'rosin-premium', 'rosin-signature', 'static-sift', 'hash-signature') THEN
    v_neutral := 80;
    v_gain := 88;
  END IF;
  v_score := ROUND(p_jury_score * 10);
  IF v_score < v_neutral THEN
    RETURN -GREATEST(1, ROUND((v_neutral - v_score) * 4 * v_weight / 1000.0)::INTEGER);
  END IF;
  IF v_score < v_gain THEN RETURN 0; END IF;
  RETURN GREATEST(1, ROUND((v_score - v_gain + 10) * 4 * v_weight / 1000.0)::INTEGER);
END;
$$;

REVOKE ALL ON FUNCTION public.kq_market_reputation_delta(TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kq_market_reputation_delta(TEXT, NUMERIC) TO service_role;

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
  v_base_reputation_gain INTEGER;
  v_expertise_bonus_reputation INTEGER := 0;
  v_reputation_gain INTEGER;
  v_route_sale_count INTEGER;
  v_cash_after INTEGER;
  v_reputation_after INTEGER;
  v_reputation_before INTEGER;
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
        'routeSales', v_existing.route_sale_count,
        'expertiseBonusReputation', v_existing.expertise_bonus_reputation,
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

  -- Mixed deployments must refresh the quote, never settle an old positive preview.
  IF COALESCE(v_option->>'reputationPolicyVersion', '') <> '2'
  THEN RAISE EXCEPTION 'market_reputation_quote_outdated'; END IF;

  v_payout := FLOOR((v_option->>'payoutCents')::NUMERIC);
  v_base_reputation_gain := public.kq_market_reputation_delta(p_route, v_lot.jury_score);
  IF v_payout IS NULL OR v_payout < 0 THEN RAISE EXCEPTION 'invalid_market_quote'; END IF;

  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
  SELECT planned_route_code, reputation INTO v_planned_route, v_reputation_before
  FROM public.kq_equipment_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  v_matched_route_plan := COALESCE(v_planned_route = p_route, FALSE);

  SELECT sale_count INTO v_route_sale_count
  FROM public.kq_player_route_masteries
  WHERE user_id = p_user_id AND route = p_route
  FOR UPDATE;
  v_route_sale_count := COALESCE(v_route_sale_count, 0) + 1;
  v_first_route_mastery := v_route_sale_count = 1;

  IF v_base_reputation_gain > 0 AND p_route IN (
    'dry-sift', 'static-sift', 'ice-water-hash', 'hash-signature',
    'rosin-trial', 'rosin-selection', 'rosin-premium', 'rosin-signature'
  ) THEN
    v_expertise_bonus_reputation := CASE v_route_sale_count
      WHEN 3 THEN 5
      WHEN 6 THEN 12
      WHEN 10 THEN 25
      ELSE 0
    END;
  END IF;
  v_reputation_gain := GREATEST(-v_reputation_before, v_base_reputation_gain + v_expertise_bonus_reputation);

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
    matched_route_plan, first_route_mastery, route_sale_count,
    expertise_bonus_reputation
  ) VALUES (
    v_receipt_id, p_request_key, p_flower_id, p_user_id, p_route,
    v_lot.jury_score, v_lot.harvest_grams, v_payout, v_reputation_gain,
    v_cash_after, v_reputation_after, v_matched_route_plan, v_first_route_mastery,
    v_route_sale_count, v_expertise_bonus_reputation
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
      'expertiseBonusReputation', v_expertise_bonus_reputation,
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
