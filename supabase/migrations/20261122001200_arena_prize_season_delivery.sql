BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.arena_customer_reward_seasons
  ADD COLUMN carry_from_season_code TEXT UNIQUE REFERENCES public.arena_customer_reward_seasons(season_code) ON DELETE RESTRICT,
  ADD COLUMN prize_settlement JSONB,
  ADD CONSTRAINT arena_customer_prize_settlement_version CHECK (
    prize_settlement IS NULL OR (formula_version = 'arena-customer-prizes-v3' AND status = 'settled')
  );

ALTER TABLE public.arena_customer_reward_grants
  ADD COLUMN fulfillment_order_id TEXT UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  ADD CONSTRAINT arena_customer_prize_single_remise CHECK (claim_id IS NULL OR fulfillment_order_id IS NULL);

-- Explicit opt-in for a season known to the operator. A frozen season or an
-- awarded right retains the rule under which it was recorded.
CREATE FUNCTION public.rpc_arena_configure_prize_season_v3(
  p_season_code TEXT, p_starts_at TIMESTAMPTZ, p_ends_at TIMESTAMPTZ, p_carry_from TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE season public.arena_customer_reward_seasons%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('arena-customer-reward:' || p_season_code, 0));
  SELECT * INTO season FROM public.arena_customer_reward_seasons WHERE season_code = p_season_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arena_customer_reward_season_not_found'; END IF;
  IF season.formula_version = 'arena-customer-prizes-v3'
    AND season.starts_at = p_starts_at AND season.ends_at = p_ends_at
    AND season.carry_from_season_code IS NOT DISTINCT FROM p_carry_from
  THEN RETURN jsonb_build_object('seasonCode', season.season_code, 'configured', FALSE); END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at
    OR season.status NOT IN ('planned', 'active') OR season.standings_snapshot IS NOT NULL
    OR season.ranking_formula_version <> 'arena-v3-tasting-first'
    OR EXISTS (SELECT 1 FROM public.arena_customer_reward_grants WHERE season_code = p_season_code)
    OR EXISTS (SELECT 1 FROM public.arena_customer_reward_draws WHERE season_code = p_season_code)
  THEN RAISE EXCEPTION 'arena_customer_prize_season_not_configurable'; END IF;
  IF p_carry_from IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.arena_customer_reward_seasons previous
    WHERE previous.season_code = p_carry_from AND previous.season_code <> p_season_code
      AND previous.formula_version = 'arena-customer-prizes-v3' AND previous.ends_at = p_starts_at
  ) THEN RAISE EXCEPTION 'arena_customer_prize_previous_season_invalid'; END IF;
  IF EXISTS (SELECT 1 FROM public.arena_customer_reward_seasons next WHERE next.carry_from_season_code = p_season_code)
  THEN RAISE EXCEPTION 'arena_customer_prize_already_linked'; END IF;
  -- A v3 week is recalculated from its own book of sales, with the date and
  -- the contribution rules of the new season. Keep existing weekly rolls.
  UPDATE public.arena_customer_reward_weeks
  SET status = 'provisional', finalized_at = NULL
  WHERE season_code = p_season_code;
  UPDATE public.arena_customer_reward_seasons
  SET starts_at = p_starts_at, ends_at = p_ends_at, formula_version = 'arena-customer-prizes-v3',
      carry_from_season_code = p_carry_from, updated_at = now()
  WHERE season_code = p_season_code;
  RETURN jsonb_build_object('seasonCode', season.season_code, 'configured', TRUE);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_arena_configure_prize_season_v3(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_arena_configure_prize_season_v3(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO service_role;

CREATE FUNCTION public.kq_arena_customer_prize_funding(p_season_code TEXT)
RETURNS JSONB LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'baseGrams', 100,
    'carryInGrams', COALESCE((previous.prize_settlement->>'reportGrams')::NUMERIC, 0),
    'carryPending', s.carry_from_season_code IS NOT NULL AND previous.prize_settlement IS NULL,
    'reportGrams', s.prize_settlement->'reportGrams',
    'settlement', s.prize_settlement
  )
  FROM public.arena_customer_reward_seasons s
  LEFT JOIN public.arena_customer_reward_seasons previous ON previous.season_code = s.carry_from_season_code
  WHERE s.season_code = p_season_code AND s.formula_version = 'arena-customer-prizes-v3';
$$;
REVOKE ALL ON FUNCTION public.kq_arena_customer_prize_funding(TEXT) FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.rpc_arena_settle_customer_rewards(TEXT, JSONB, JSONB, TEXT, INTEGER, BOOLEAN)
  RENAME TO kq_arena_settle_customer_rewards_pre_prizes_v3;
REVOKE ALL ON FUNCTION public.kq_arena_settle_customer_rewards_pre_prizes_v3(TEXT, JSONB, JSONB, TEXT, INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.rpc_arena_settle_customer_rewards(
  p_season_code TEXT, p_top_rewards JSONB, p_surprise_candidates JSONB,
  p_candidate_hash TEXT, p_surprise_grams INTEGER, p_execute BOOLEAN DEFAULT FALSE
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  season public.arena_customer_reward_seasons%ROWTYPE;
  funding JSONB;
  standings JSONB;
  plan JSONB;
  pool NUMERIC;
  ranking_grams INTEGER;
  surprise_grams INTEGER;
  candidate_count INTEGER;
  receipt JSONB;
  selected_index INTEGER;
  selected_candidate JSONB;
BEGIN
  p_execute := COALESCE(p_execute, FALSE);
  PERFORM pg_advisory_xact_lock(hashtextextended('arena-customer-reward:' || p_season_code, 0));
  SELECT * INTO season FROM public.arena_customer_reward_seasons WHERE season_code = p_season_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arena_customer_reward_season_not_found'; END IF;
  IF season.formula_version <> 'arena-customer-prizes-v3' THEN
    RETURN public.kq_arena_settle_customer_rewards_pre_prizes_v3(
      p_season_code, p_top_rewards, p_surprise_candidates, p_candidate_hash, p_surprise_grams, p_execute);
  END IF;
  IF season.status = 'settled' THEN
    RETURN season.prize_settlement || jsonb_build_object('executed', FALSE, 'alreadySettled', TRUE);
  END IF;
  IF p_execute AND season.status <> 'frozen' THEN RAISE EXCEPTION 'arena_customer_reward_season_must_be_frozen'; END IF;

  funding := public.kq_arena_customer_prize_funding(p_season_code);
  IF (funding->>'carryPending')::BOOLEAN AND p_execute THEN RAISE EXCEPTION 'arena_customer_prize_carry_pending'; END IF;
  standings := CASE WHEN season.status = 'active' THEN public.kq_arena_reward_current_standings(p_season_code) ELSE season.standings_snapshot END;
  IF jsonb_typeof(standings) IS DISTINCT FROM 'array'
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(standings) item WHERE item->>'rankingFormulaVersion' IS DISTINCT FROM 'arena-v3-tasting-first')
  THEN RAISE EXCEPTION 'arena_customer_reward_invalid_standings'; END IF;

  SELECT GREATEST(0, (funding->>'baseGrams')::NUMERIC + (funding->>'carryInGrams')::NUMERIC
    + COALESCE((SELECT SUM(contribution_grams) FROM public.arena_customer_reward_weeks WHERE season_code = p_season_code), 0)
    + COALESCE((SELECT SUM(grams) FROM public.arena_customer_reward_adjustments WHERE season_code = p_season_code), 0)) INTO pool;
  plan := public.kq_arena_reward_plan_v3(standings, pool, season.min_human_battles);
  IF p_top_rewards IS DISTINCT FROM plan->'topRewards' OR p_surprise_candidates IS DISTINCT FROM plan->'surpriseCandidates'
    OR p_surprise_grams IS DISTINCT FROM (plan->>'surpriseGrams')::INTEGER OR p_candidate_hash IS DISTINCT FROM plan->>'candidateHash'
  THEN RAISE EXCEPTION 'arena_customer_reward_allocation_changed'; END IF;

  SELECT COALESCE(SUM((item->>'grams')::INTEGER), 0) INTO ranking_grams FROM jsonb_array_elements(p_top_rewards) item;
  candidate_count := jsonb_array_length(p_surprise_candidates);
  surprise_grams := CASE WHEN candidate_count > 0 THEN p_surprise_grams ELSE 0 END;
  receipt := jsonb_build_object(
    'formulaVersion', season.formula_version, 'poolGrams', pool,
    'baseGrams', funding->'baseGrams', 'carryInGrams', funding->'carryInGrams',
    'rankingWinners', jsonb_array_length(p_top_rewards), 'rankingGrams', ranking_grams,
    'surpriseGrams', surprise_grams, 'surpriseCandidates', candidate_count, 'candidateHash', p_candidate_hash,
    'reportGrams', pool - ranking_grams - surprise_grams
  );
  IF NOT p_execute THEN
    RETURN receipt || jsonb_build_object('executed', FALSE, 'alreadySettled', FALSE, 'seasonStatus', season.status,
      'ready', season.status = 'frozen' AND NOT (funding->>'carryPending')::BOOLEAN);
  END IF;

  IF surprise_grams > 0 THEN
    selected_index := public.lottery_secure_random_int(0, candidate_count - 1);
    selected_candidate := p_surprise_candidates->selected_index;
    INSERT INTO public.arena_customer_reward_draws (season_code, candidate_count, candidate_hash, selected_index,
      winner_user_id, winner_leaderboard_rank, receipt)
    VALUES (p_season_code, candidate_count, p_candidate_hash, selected_index,
      (selected_candidate->>'userId')::UUID, (selected_candidate->>'leaderboardRank')::INTEGER,
      jsonb_build_object('formulaVersion', season.formula_version, 'oneChancePerCustomer', TRUE));
  END IF;

  INSERT INTO public.arena_customer_reward_grants (season_code, user_id, kind, leaderboard_rank,
    reward_rank, share_bps, gift_weight_grams, score_snapshot, rating_snapshot, wins_snapshot, losses_snapshot, grant_key)
  SELECT p_season_code, (award.value->>'userId')::UUID, award.kind, (award.value->>'leaderboardRank')::INTEGER,
    (award.value->>'rewardRank')::INTEGER, (award.value->>'shareBps')::NUMERIC, (award.value->>'grams')::INTEGER,
    (award.value->>'score')::NUMERIC, (award.value->>'rating')::INTEGER, (award.value->>'wins')::INTEGER,
    (award.value->>'losses')::INTEGER, p_season_code || ':' || (award.value->>'userId') || ':' || award.kind
  FROM (
    SELECT 'ranking' AS kind, value FROM jsonb_array_elements(p_top_rewards)
    UNION ALL
    SELECT 'surprise', selected_candidate || jsonb_build_object('shareBps', season.surprise_bps, 'grams', surprise_grams)
    WHERE surprise_grams > 0
  ) award;

  UPDATE public.arena_customer_reward_seasons SET status = 'settled', prize_settlement = receipt, updated_at = now()
  WHERE season_code = p_season_code;
  RETURN receipt || jsonb_build_object('executed', TRUE, 'alreadySettled', FALSE,
    'granted', jsonb_array_length(p_top_rewards) + CASE WHEN surprise_grams > 0 THEN 1 ELSE 0 END,
    'surpriseDrawn', surprise_grams > 0);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_arena_settle_customer_rewards(TEXT, JSONB, JSONB, TEXT, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_arena_settle_customer_rewards(TEXT, JSONB, JSONB, TEXT, INTEGER, BOOLEAN) TO service_role;

CREATE FUNCTION public.rpc_arena_order_customer_prize(p_grant_id UUID, p_user_id UUID, p_shipping JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  award public.arena_customer_reward_grants%ROWTYPE;
  order_ref TEXT;
  shipping_name TEXT := btrim(COALESCE(p_shipping->>'name', ''));
  street TEXT := btrim(COALESCE(p_shipping->>'address', ''));
  city TEXT := btrim(COALESCE(p_shipping->>'city', ''));
  postal_code TEXT := btrim(COALESCE(p_shipping->>'postalCode', ''));
  email TEXT := btrim(COALESCE(p_shipping->>'email', ''));
  phone TEXT := btrim(COALESCE(p_shipping->>'phone', ''));
BEGIN
  SELECT g.* INTO award FROM public.arena_customer_reward_grants g
  JOIN public.arena_customer_reward_seasons s ON s.season_code = g.season_code
  WHERE g.id = p_grant_id AND g.user_id = p_user_id AND g.claim_id IS NULL
    AND s.status = 'settled' AND s.formula_version = 'arena-customer-prizes-v3'
  FOR UPDATE OF g;
  IF NOT FOUND THEN RAISE EXCEPTION 'arena_customer_prize_not_found'; END IF;
  IF award.fulfillment_order_id IS NOT NULL THEN
    RETURN jsonb_build_object('orderId', award.fulfillment_order_id, 'grams', award.gift_weight_grams, 'totalCents', 0);
  END IF;
  IF char_length(shipping_name) NOT BETWEEN 2 AND 120 OR char_length(street) NOT BETWEEN 5 AND 180
    OR char_length(city) NOT BETWEEN 2 AND 100 OR char_length(email) NOT BETWEEN 3 AND 254
    OR postal_code !~ '^(0[1-9]|[1-8][0-9]|9[0-5])[0-9]{3}$' OR (phone <> '' AND phone !~ '^\+33[1-9][0-9]{8}$')
  THEN RAISE EXCEPTION 'arena_customer_prize_shipping_invalid'; END IF;

  order_ref := 'LOT-AR-' || gen_random_uuid()::TEXT;
  INSERT INTO public.orders (id, status, payment_provider, payment_state, customer_id, customer_name, customer_email,
    shipping_address, shipping_city, shipping_postal_code, shipping_country, shipping_phone, delivery_method, delivery_fee,
    items_count, total_ht, total_vat, total_amount)
  VALUES (order_ref, 'processing', 'arena_reward', 'not_configured', p_user_id, shipping_name, email,
    street, city, postal_code, 'FR', NULLIF(phone, ''), 'home', 0, 1, 0, 0, 0);
  INSERT INTO public.order_items (order_id, product_id, name, unit_price, unit_price_ht, quantity, line_total,
    line_total_ht, line_vat_amount, vat_rate, product_category, unit_weight_grams)
  VALUES (order_ref, 'arena-season-prize', format('Lot Arène %s · %s g de fleurs', award.season_code, award.gift_weight_grams),
    0, 0, 1, 0, 0, 0, 0, 'fleurs', award.gift_weight_grams);
  UPDATE public.arena_customer_reward_grants SET fulfillment_order_id = order_ref WHERE id = award.id;
  RETURN jsonb_build_object('orderId', order_ref, 'grams', award.gift_weight_grams, 'totalCents', 0);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_arena_order_customer_prize(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_arena_order_customer_prize(UUID, UUID, JSONB) TO service_role;

ALTER TABLE public.orders ADD CONSTRAINT arena_reward_order_has_no_payment CHECK (
  payment_provider <> 'arena_reward' OR (payment_state = 'not_configured' AND total_amount = 0 AND delivery_fee = 0
    AND viva_order_code IS NULL AND viva_transaction_id IS NULL)
);

COMMIT;
