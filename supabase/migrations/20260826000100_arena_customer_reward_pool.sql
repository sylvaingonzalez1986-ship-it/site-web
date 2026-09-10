BEGIN;

-- The Arena reward is a commercial customer benefit funded by a fraction of
-- paid flower volume. Product facts are snapshotted on the order line so a
-- later catalog edit cannot rewrite the reward history.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_category TEXT,
  ADD COLUMN IF NOT EXISTS unit_weight_grams NUMERIC(12, 1);

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_unit_weight_grams_non_negative;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_unit_weight_grams_non_negative
  CHECK (unit_weight_grams IS NULL OR unit_weight_grams >= 0);

CREATE OR REPLACE FUNCTION public.arena_snapshot_order_item_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
BEGIN
  IF NEW.product_category IS NOT NULL AND NEW.unit_weight_grams IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT category::TEXT, weight_grams
  INTO v_product
  FROM public.products
  WHERE id = split_part(NEW.product_id, '::', 1);

  IF FOUND THEN
    NEW.product_category := COALESCE(NEW.product_category, v_product.category);
    NEW.unit_weight_grams := COALESCE(NEW.unit_weight_grams, v_product.weight_grams);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_arena_snapshot_order_item_product ON public.order_items;
CREATE TRIGGER trg_arena_snapshot_order_item_product
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.arena_snapshot_order_item_product();

CREATE OR REPLACE FUNCTION public.arena_set_order_paid_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_state = 'paid'
    AND NEW.paid_at IS NULL
    AND (TG_OP = 'INSERT' OR OLD.payment_state IS DISTINCT FROM 'paid')
  THEN
    NEW.paid_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_arena_set_order_paid_at ON public.orders;
CREATE TRIGGER trg_arena_set_order_paid_at
BEFORE INSERT OR UPDATE OF payment_state ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.arena_set_order_paid_at();

UPDATE public.orders
SET paid_at = COALESCE(stock_applied_at, created_at)
WHERE payment_state = 'paid' AND paid_at IS NULL;

UPDATE public.order_items item
SET product_category = product.category::TEXT,
    unit_weight_grams = product.weight_grams
FROM public.products product
WHERE product.id = split_part(item.product_id, '::', 1)
  AND (item.product_category IS NULL OR item.unit_weight_grams IS NULL);

CREATE INDEX IF NOT EXISTS idx_orders_paid_at_realized
  ON public.orders(paid_at)
  WHERE payment_state = 'paid' AND status <> 'cancelled' AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_arena_flower_weight
  ON public.order_items(order_id)
  WHERE product_category = 'fleurs' AND unit_weight_grams > 0;

CREATE TABLE IF NOT EXISTS public.arena_customer_reward_seasons (
  season_code TEXT PRIMARY KEY REFERENCES public.kq_seasons(season_code) ON DELETE RESTRICT,
  contest_season_id TEXT REFERENCES public.contest_seasons(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'frozen', 'settled')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  contribution_bps INTEGER NOT NULL DEFAULT 1000 CHECK (contribution_bps BETWEEN 0 AND 10000),
  surprise_bps INTEGER NOT NULL DEFAULT 1000 CHECK (surprise_bps BETWEEN 0 AND 10000),
  min_human_battles INTEGER NOT NULL DEFAULT 3 CHECK (min_human_battles >= 0),
  formula_version TEXT NOT NULL DEFAULT 'arena-customer-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_arena_customer_reward_active_season
  ON public.arena_customer_reward_seasons(status) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.arena_customer_reward_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_code TEXT NOT NULL REFERENCES public.arena_customer_reward_seasons(season_code) ON DELETE RESTRICT,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'provisional' CHECK (status IN ('provisional', 'final')),
  eligible_order_count INTEGER NOT NULL DEFAULT 0 CHECK (eligible_order_count >= 0),
  eligible_flower_grams NUMERIC(14, 1) NOT NULL DEFAULT 0 CHECK (eligible_flower_grams >= 0),
  contribution_grams NUMERIC(14, 1) NOT NULL DEFAULT 0 CHECK (contribution_grams >= 0),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at TIMESTAMPTZ,
  UNIQUE (season_code, week_start),
  CHECK (week_end = week_start + 7),
  CHECK ((status = 'final') = (finalized_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_arena_customer_reward_weeks_recent
  ON public.arena_customer_reward_weeks(season_code, week_start DESC);

CREATE TABLE IF NOT EXISTS public.arena_customer_reward_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_code TEXT NOT NULL REFERENCES public.arena_customer_reward_seasons(season_code) ON DELETE RESTRICT,
  grams NUMERIC(14, 1) NOT NULL CHECK (grams <> 0),
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
  actor_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.arena_customer_reward_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_code TEXT NOT NULL UNIQUE REFERENCES public.arena_customer_reward_seasons(season_code) ON DELETE RESTRICT,
  candidate_count INTEGER NOT NULL CHECK (candidate_count > 0),
  candidate_hash TEXT NOT NULL CHECK (candidate_hash ~ '^[a-f0-9]{64}$'),
  selected_index INTEGER NOT NULL CHECK (selected_index >= 0),
  winner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  winner_leaderboard_rank INTEGER NOT NULL CHECK (winner_leaderboard_rank > 10),
  drawn_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  receipt JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE IF NOT EXISTS public.arena_customer_reward_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_code TEXT NOT NULL REFERENCES public.arena_customer_reward_seasons(season_code) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('ranking', 'surprise')),
  leaderboard_rank INTEGER NOT NULL CHECK (leaderboard_rank >= 1),
  reward_rank INTEGER CHECK (reward_rank IS NULL OR reward_rank BETWEEN 1 AND 10),
  share_bps INTEGER NOT NULL CHECK (share_bps BETWEEN 1 AND 10000),
  gift_weight_grams INTEGER NOT NULL CHECK (gift_weight_grams > 0),
  score_snapshot INTEGER NOT NULL CHECK (score_snapshot >= 0),
  rating_snapshot INTEGER NOT NULL CHECK (rating_snapshot >= 0),
  wins_snapshot INTEGER NOT NULL CHECK (wins_snapshot >= 0),
  losses_snapshot INTEGER NOT NULL CHECK (losses_snapshot >= 0),
  claim_id UUID UNIQUE REFERENCES public.lottery_reward_claims(id) ON DELETE RESTRICT,
  grant_key TEXT NOT NULL UNIQUE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_code, user_id),
  CHECK ((kind = 'ranking' AND reward_rank IS NOT NULL) OR (kind = 'surprise' AND reward_rank IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_arena_customer_reward_grants_season_rank
  ON public.arena_customer_reward_grants(season_code, reward_rank, leaderboard_rank);

INSERT INTO public.arena_customer_reward_seasons (
  season_code, contest_season_id, status, starts_at, ends_at
)
SELECT kq.season_code,
       contest.id,
       'active',
       date_trunc('week', timezone('Europe/Paris', now())) AT TIME ZONE 'Europe/Paris',
       kq.ends_at
FROM public.kq_seasons kq
LEFT JOIN LATERAL (
  SELECT id FROM public.contest_seasons
  WHERE is_active = TRUE AND is_archived = FALSE
  ORDER BY harvest_start DESC NULLS LAST, year DESC
  LIMIT 1
) contest ON TRUE
WHERE kq.status = 'active'
ON CONFLICT (season_code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.rpc_arena_refresh_customer_reward_pool(
  p_season_code TEXT,
  p_finalize_previous_weeks BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season public.arena_customer_reward_seasons%ROWTYPE;
  v_current_week DATE;
  v_total NUMERIC(14, 1) := 0;
  v_current NUMERIC(14, 1) := 0;
  v_adjustments NUMERIC(14, 1) := 0;
  v_last_final RECORD;
BEGIN
  SELECT * INTO v_season
  FROM public.arena_customer_reward_seasons
  WHERE season_code = p_season_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'arena_customer_reward_season_not_found'; END IF;

  v_current_week := date_trunc(
    'week',
    timezone(
      'Europe/Paris',
      CASE
        WHEN v_season.status IN ('frozen', 'settled') AND v_season.ends_at IS NOT NULL THEN v_season.ends_at
        ELSE now()
      END
    )
  )::DATE;

  -- Reset open snapshots before recomputing them. This also removes an order
  -- that was cancelled or refunded after a previous refresh.
  UPDATE public.arena_customer_reward_weeks
  SET eligible_order_count = 0,
      eligible_flower_grams = 0,
      contribution_grams = 0,
      computed_at = now()
  WHERE season_code = v_season.season_code
    AND status = 'provisional';

  INSERT INTO public.arena_customer_reward_weeks (
    season_code, week_start, week_end, eligible_order_count,
    eligible_flower_grams, contribution_grams, computed_at
  )
  SELECT v_season.season_code,
         source.week_start,
         source.week_start + 7,
         count(DISTINCT source.order_id)::INTEGER,
         round(sum(source.line_grams), 1),
         round(sum(source.line_grams) * v_season.contribution_bps / 10000.0, 1),
         now()
  FROM (
    SELECT o.id AS order_id,
           date_trunc('week', timezone('Europe/Paris', o.paid_at))::DATE AS week_start,
           item.quantity * item.unit_weight_grams AS line_grams
    FROM public.orders o
    JOIN public.order_items item ON item.order_id = o.id
    WHERE o.payment_state = 'paid'
      AND o.status <> 'cancelled'
      AND o.archived_at IS NULL
      AND o.paid_at IS NOT NULL
      AND o.paid_at >= v_season.starts_at
      AND (v_season.ends_at IS NULL OR o.paid_at < v_season.ends_at)
      AND item.product_category = 'fleurs'
      AND item.unit_weight_grams > 0
      AND item.quantity > 0
      AND item.line_total > 0
  ) source
  GROUP BY source.week_start
  ON CONFLICT (season_code, week_start) DO UPDATE SET
    eligible_order_count = EXCLUDED.eligible_order_count,
    eligible_flower_grams = EXCLUDED.eligible_flower_grams,
    contribution_grams = EXCLUDED.contribution_grams,
    computed_at = now()
  WHERE public.arena_customer_reward_weeks.status = 'provisional';

  INSERT INTO public.arena_customer_reward_weeks (season_code, week_start, week_end)
  VALUES (v_season.season_code, v_current_week, v_current_week + 7)
  ON CONFLICT (season_code, week_start) DO NOTHING;

  IF p_finalize_previous_weeks THEN
    UPDATE public.arena_customer_reward_weeks
    SET status = 'final', finalized_at = now(), computed_at = now()
    WHERE season_code = v_season.season_code
      AND week_start < v_current_week
      AND status = 'provisional';
  END IF;

  SELECT COALESCE(sum(contribution_grams), 0)::NUMERIC(14, 1)
  INTO v_total
  FROM public.arena_customer_reward_weeks
  WHERE season_code = v_season.season_code;

  SELECT COALESCE(sum(grams), 0)::NUMERIC(14, 1)
  INTO v_adjustments
  FROM public.arena_customer_reward_adjustments
  WHERE season_code = v_season.season_code;

  SELECT COALESCE(contribution_grams, 0)::NUMERIC(14, 1)
  INTO v_current
  FROM public.arena_customer_reward_weeks
  WHERE season_code = v_season.season_code AND week_start = v_current_week;

  SELECT week_start, week_end, contribution_grams, eligible_flower_grams
  INTO v_last_final
  FROM public.arena_customer_reward_weeks
  WHERE season_code = v_season.season_code AND status = 'final'
  ORDER BY week_start DESC LIMIT 1;

  RETURN jsonb_build_object(
    'seasonCode', v_season.season_code,
    'status', v_season.status,
    'formulaVersion', v_season.formula_version,
    'contributionRateBps', v_season.contribution_bps,
    'surpriseShareBps', v_season.surprise_bps,
    'minHumanBattles', v_season.min_human_battles,
    'startsAt', v_season.starts_at,
    'endsAt', v_season.ends_at,
    'poolGrams', GREATEST(0, v_total + v_adjustments),
    'currentWeekGrams', COALESCE(v_current, 0),
    'updatedAt', now(),
    'lastFinalWeek', CASE WHEN v_last_final.week_start IS NULL THEN NULL ELSE jsonb_build_object(
      'startsOn', v_last_final.week_start,
      'endsOn', v_last_final.week_end,
      'contributionGrams', v_last_final.contribution_grams,
      'eligibleFlowerGrams', v_last_final.eligible_flower_grams
    ) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_arena_freeze_customer_reward_season(
  p_season_code TEXT,
  p_execute BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season public.arena_customer_reward_seasons%ROWTYPE;
  v_frozen_at TIMESTAMPTZ := now();
  v_pool JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('arena-customer-reward:' || p_season_code, 0));

  SELECT * INTO v_season
  FROM public.arena_customer_reward_seasons
  WHERE season_code = p_season_code
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arena_customer_reward_season_not_found'; END IF;
  IF v_season.status = 'settled' THEN
    RAISE EXCEPTION 'arena_customer_reward_season_already_settled';
  END IF;
  IF v_season.status NOT IN ('active', 'frozen') THEN
    RAISE EXCEPTION 'arena_customer_reward_season_not_freezable';
  END IF;

  v_pool := public.rpc_arena_refresh_customer_reward_pool(p_season_code, TRUE);
  IF v_season.status = 'frozen' THEN
    RETURN v_pool || jsonb_build_object(
      'executed', FALSE,
      'alreadyFrozen', TRUE,
      'ready', TRUE
    );
  END IF;
  IF NOT p_execute THEN
    RETURN v_pool || jsonb_build_object(
      'executed', FALSE,
      'alreadyFrozen', FALSE,
      'ready', TRUE
    );
  END IF;

  UPDATE public.arena_customer_reward_seasons
  SET status = 'frozen', ends_at = v_frozen_at, updated_at = now()
  WHERE season_code = p_season_code;

  -- Recompute once with the immutable end timestamp, then close every week,
  -- including the partial week in which the Arena season is frozen.
  v_pool := public.rpc_arena_refresh_customer_reward_pool(p_season_code, TRUE);
  UPDATE public.arena_customer_reward_weeks
  SET status = 'final', finalized_at = COALESCE(finalized_at, now()), computed_at = now()
  WHERE season_code = p_season_code AND status = 'provisional';
  v_pool := public.rpc_arena_refresh_customer_reward_pool(p_season_code, FALSE);

  RETURN v_pool || jsonb_build_object(
    'executed', TRUE,
    'alreadyFrozen', FALSE,
    'ready', TRUE,
    'frozenAt', v_frozen_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_arena_settle_customer_rewards(
  p_season_code TEXT,
  p_top_rewards JSONB,
  p_surprise_candidates JSONB,
  p_candidate_hash TEXT,
  p_surprise_grams INTEGER,
  p_execute BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season public.arena_customer_reward_seasons%ROWTYPE;
  v_reward JSONB;
  v_candidate JSONB;
  v_candidate_count INTEGER;
  v_selected_index INTEGER;
  v_claim_id UUID;
  v_grant_id UUID;
  v_ranking_grams INTEGER := 0;
  v_surprise_award_grams INTEGER := 0;
  v_available_grams INTEGER := 0;
  v_granted INTEGER := 0;
BEGIN
  IF jsonb_typeof(p_top_rewards) <> 'array' OR jsonb_array_length(p_top_rewards) > 10 THEN
    RAISE EXCEPTION 'arena_customer_reward_top_invalid';
  END IF;
  IF jsonb_typeof(p_surprise_candidates) <> 'array' THEN
    RAISE EXCEPTION 'arena_customer_reward_candidates_invalid';
  END IF;
  IF COALESCE(p_candidate_hash, '') !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'arena_customer_reward_candidate_hash_invalid';
  END IF;

  SELECT * INTO v_season
  FROM public.arena_customer_reward_seasons
  WHERE season_code = p_season_code
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arena_customer_reward_season_not_found'; END IF;
  IF v_season.status = 'settled' THEN
    RETURN jsonb_build_object('executed', FALSE, 'alreadySettled', TRUE);
  END IF;
  IF v_season.status NOT IN ('active', 'frozen') THEN
    RAISE EXCEPTION 'arena_customer_reward_season_not_settleable';
  END IF;

  SELECT COALESCE(sum((item->>'grams')::INTEGER), 0)
  INTO v_ranking_grams
  FROM jsonb_array_elements(p_top_rewards) item;
  v_candidate_count := jsonb_array_length(p_surprise_candidates);
  v_surprise_award_grams := CASE
    WHEN v_candidate_count > 0 THEN GREATEST(0, p_surprise_grams)
    ELSE 0
  END;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_top_rewards) item
    WHERE (item->>'leaderboardRank')::INTEGER NOT BETWEEN 1 AND 10
      OR (item->>'rewardRank')::INTEGER <> (item->>'leaderboardRank')::INTEGER
  ) THEN RAISE EXCEPTION 'arena_customer_reward_ranking_position_invalid'; END IF;
  IF (
    SELECT count(DISTINCT item->>'userId')
    FROM jsonb_array_elements(p_top_rewards) item
  ) <> jsonb_array_length(p_top_rewards) THEN
    RAISE EXCEPTION 'arena_customer_reward_top_duplicate';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_surprise_candidates) item
    WHERE (item->>'leaderboardRank')::INTEGER <= 10
  ) THEN RAISE EXCEPTION 'arena_customer_reward_surprise_must_be_outside_top'; END IF;
  IF (
    SELECT count(DISTINCT item->>'userId')
    FROM jsonb_array_elements(p_surprise_candidates) item
  ) <> v_candidate_count THEN
    RAISE EXCEPTION 'arena_customer_reward_candidate_duplicate';
  END IF;

  SELECT floor(GREATEST(0,
    COALESCE((SELECT sum(contribution_grams) FROM public.arena_customer_reward_weeks
      WHERE season_code = p_season_code), 0)
    + COALESCE((SELECT sum(grams) FROM public.arena_customer_reward_adjustments
      WHERE season_code = p_season_code), 0)
  ))::INTEGER INTO v_available_grams;
  IF v_ranking_grams + v_surprise_award_grams > v_available_grams
  THEN RAISE EXCEPTION 'arena_customer_reward_pool_exceeded'; END IF;
  IF jsonb_array_length(p_top_rewards) = 0 THEN
    RAISE EXCEPTION 'arena_customer_reward_no_ranking_winner';
  END IF;

  IF NOT p_execute THEN
    RETURN jsonb_build_object(
      'executed', FALSE,
      'alreadySettled', FALSE,
      'rankingWinners', jsonb_array_length(p_top_rewards),
      'rankingGrams', v_ranking_grams,
      'surpriseCandidates', v_candidate_count,
      'surpriseGrams', v_surprise_award_grams,
      'seasonStatus', v_season.status,
      'ready', v_season.status = 'frozen' AND jsonb_array_length(p_top_rewards) > 0
    );
  END IF;

  IF v_season.status <> 'frozen' THEN
    RAISE EXCEPTION 'arena_customer_reward_season_must_be_frozen';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('arena-customer-reward:' || p_season_code, 0));
  IF EXISTS (SELECT 1 FROM public.arena_customer_reward_grants WHERE season_code = p_season_code) THEN
    RAISE EXCEPTION 'arena_customer_reward_grants_already_exist';
  END IF;

  FOR v_reward IN SELECT value FROM jsonb_array_elements(p_top_rewards)
  LOOP
    IF COALESCE((v_reward->>'grams')::INTEGER, 0) <= 0 THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.kq_rank_profiles profile
      WHERE profile.user_id = (v_reward->>'userId')::UUID
        AND profile.season_code = p_season_code
        AND profile.wins + profile.losses >= v_season.min_human_battles
    ) THEN RAISE EXCEPTION 'arena_customer_reward_player_ineligible'; END IF;

    INSERT INTO public.arena_customer_reward_grants (
      season_code, user_id, kind, leaderboard_rank, reward_rank, share_bps,
      gift_weight_grams, score_snapshot, rating_snapshot, wins_snapshot,
      losses_snapshot, grant_key
    ) VALUES (
      p_season_code, (v_reward->>'userId')::UUID, 'ranking',
      (v_reward->>'leaderboardRank')::INTEGER, (v_reward->>'rewardRank')::INTEGER,
      (v_reward->>'shareBps')::INTEGER, (v_reward->>'grams')::INTEGER,
      (v_reward->>'score')::INTEGER, (v_reward->>'rating')::INTEGER,
      (v_reward->>'wins')::INTEGER, (v_reward->>'losses')::INTEGER,
      p_season_code || ':' || (v_reward->>'userId') || ':ranking'
    ) RETURNING id INTO v_grant_id;

    INSERT INTO public.lottery_reward_claims (
      user_id, reward_snapshot, status, gift_weight_grams, gift_label
    ) VALUES (
      (v_reward->>'userId')::UUID,
      jsonb_build_object(
        'title', 'Récompense du classement Arène',
        'description', 'Un extra réservé à nos clients qui participent à l’Arène.',
        'kind', 'gift_weight_grams',
        'giftWeightGrams', (v_reward->>'grams')::INTEGER,
        'giftLabel', (v_reward->>'grams') || ' g de fleurs offerts',
        'customPayload', jsonb_build_object('source', 'arena_customer_reward', 'seasonCode', p_season_code),
        'deleted', FALSE
      ),
      'available', (v_reward->>'grams')::INTEGER,
      (v_reward->>'grams') || ' g de fleurs offerts'
    ) RETURNING id INTO v_claim_id;
    UPDATE public.arena_customer_reward_grants SET claim_id = v_claim_id WHERE id = v_grant_id;
    v_granted := v_granted + 1;
  END LOOP;

  IF v_candidate_count > 0 AND p_surprise_grams > 0 THEN
    v_selected_index := public.lottery_secure_random_int(0, v_candidate_count - 1);
    v_candidate := p_surprise_candidates->v_selected_index;
    IF EXISTS (
      SELECT 1 FROM public.arena_customer_reward_grants
      WHERE season_code = p_season_code AND user_id = (v_candidate->>'userId')::UUID
    ) THEN RAISE EXCEPTION 'arena_customer_reward_surprise_in_top'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.kq_rank_profiles profile
      WHERE profile.user_id = (v_candidate->>'userId')::UUID
        AND profile.season_code = p_season_code
        AND profile.wins + profile.losses >= v_season.min_human_battles
    ) THEN RAISE EXCEPTION 'arena_customer_reward_surprise_ineligible'; END IF;

    INSERT INTO public.arena_customer_reward_draws (
      season_code, candidate_count, candidate_hash, selected_index,
      winner_user_id, winner_leaderboard_rank, receipt
    ) VALUES (
      p_season_code, v_candidate_count, p_candidate_hash, v_selected_index,
      (v_candidate->>'userId')::UUID, (v_candidate->>'leaderboardRank')::INTEGER,
      jsonb_build_object('formulaVersion', v_season.formula_version, 'oneChancePerCustomer', TRUE)
    );

    INSERT INTO public.arena_customer_reward_grants (
      season_code, user_id, kind, leaderboard_rank, reward_rank, share_bps,
      gift_weight_grams, score_snapshot, rating_snapshot, wins_snapshot,
      losses_snapshot, grant_key
    ) VALUES (
      p_season_code, (v_candidate->>'userId')::UUID, 'surprise',
      (v_candidate->>'leaderboardRank')::INTEGER, NULL, v_season.surprise_bps,
      p_surprise_grams, (v_candidate->>'score')::INTEGER, (v_candidate->>'rating')::INTEGER,
      (v_candidate->>'wins')::INTEGER, (v_candidate->>'losses')::INTEGER,
      p_season_code || ':' || (v_candidate->>'userId') || ':surprise'
    ) RETURNING id INTO v_grant_id;

    INSERT INTO public.lottery_reward_claims (
      user_id, reward_snapshot, status, gift_weight_grams, gift_label
    ) VALUES (
      (v_candidate->>'userId')::UUID,
      jsonb_build_object(
        'title', 'La Fleur Surprise de l’Arène',
        'description', 'L’extra client réservé à un participant classé hors Top 10.',
        'kind', 'gift_weight_grams',
        'giftWeightGrams', p_surprise_grams,
        'giftLabel', p_surprise_grams || ' g de fleurs offerts',
        'customPayload', jsonb_build_object('source', 'arena_customer_reward', 'seasonCode', p_season_code),
        'deleted', FALSE
      ),
      'available', p_surprise_grams, p_surprise_grams || ' g de fleurs offerts'
    ) RETURNING id INTO v_claim_id;
    UPDATE public.arena_customer_reward_grants SET claim_id = v_claim_id WHERE id = v_grant_id;
    v_granted := v_granted + 1;
  END IF;

  UPDATE public.arena_customer_reward_seasons
  SET status = 'settled', updated_at = now()
  WHERE season_code = p_season_code;

  RETURN jsonb_build_object(
    'executed', TRUE, 'alreadySettled', FALSE, 'granted', v_granted,
    'surpriseDrawn', v_candidate_count > 0 AND p_surprise_grams > 0
  );
END;
$$;

ALTER TABLE public.arena_customer_reward_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_customer_reward_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_customer_reward_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_customer_reward_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_customer_reward_grants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.arena_customer_reward_seasons,
  public.arena_customer_reward_weeks,
  public.arena_customer_reward_adjustments,
  public.arena_customer_reward_draws,
  public.arena_customer_reward_grants
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.rpc_arena_refresh_customer_reward_pool(TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_arena_freeze_customer_reward_season(TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_arena_settle_customer_rewards(TEXT, JSONB, JSONB, TEXT, INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_arena_refresh_customer_reward_pool(TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_arena_freeze_customer_reward_season(TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_arena_settle_customer_rewards(TEXT, JSONB, JSONB, TEXT, INTEGER, BOOLEAN) TO service_role;

COMMENT ON TABLE public.arena_customer_reward_seasons IS
  'Commercial Arena customer benefit funded by ten percent of paid flower weight; not a ticket product.';
COMMENT ON TABLE public.arena_customer_reward_draws IS
  'Auditable equal-chance customer reward among eligible participants outside the ranking reward zone.';

COMMIT;
