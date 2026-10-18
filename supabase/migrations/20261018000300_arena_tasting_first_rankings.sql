BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Existing legitimate discoveries keep their place when the seasonal purchase
-- rule starts. These are eligibility receipts, not points or reward grants.
CREATE TABLE public.kq_arena_tasting_transition_credits (
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  notebook_season_id TEXT NOT NULL REFERENCES public.contest_seasons(id) ON DELETE RESTRICT,
  review_id UUID NOT NULL UNIQUE REFERENCES public.contest_reviews(id) ON DELETE CASCADE,
  arena_season_code TEXT REFERENCES public.kq_seasons(season_code) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, product_id, notebook_season_id)
);
ALTER TABLE public.kq_arena_tasting_transition_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_arena_tasting_transition_credits FROM PUBLIC, anon, authenticated, service_role;

CREATE INDEX idx_kq_arena_bot_points ON public.kq_daily_challenge_claims(claimed_at, user_id)
  INCLUDE(points) WHERE bot_battle_id IS NOT NULL;

INSERT INTO public.kq_arena_tasting_transition_credits
  (customer_id, product_id, notebook_season_id, review_id, arena_season_code)
SELECT DISTINCT ON (review.customer_id, entry.product_id, review.season_id)
  review.customer_id, entry.product_id, review.season_id, review.id,
  COALESCE((SELECT season.season_code FROM public.kq_seasons season
    WHERE season.status IN ('active', 'closed')
      AND review.created_at >= COALESCE(season.starts_at, season.activated_at, season.created_at)
      AND review.created_at < COALESCE(LEAST(season.ends_at, season.closed_at), 'infinity'::TIMESTAMPTZ)
    ORDER BY COALESCE(season.starts_at, season.activated_at, season.created_at) DESC LIMIT 1),
    CASE WHEN review.season_id = (SELECT id FROM public.kq_current_notebook_season())
      THEN (SELECT season_code FROM public.kq_seasons WHERE status = 'active') END)
FROM public.contest_reviews review
JOIN public.contest_entries entry ON entry.id = review.entry_id AND entry.season_id = review.season_id
JOIN public.products product ON product.id = entry.product_id AND product.category::TEXT = 'fleurs'
JOIN auth.users customer ON customer.id = review.customer_id
WHERE review.status = 'approved' AND review.created_at <= statement_timestamp()
  AND EXISTS (
    SELECT 1 FROM public.orders purchase
    JOIN public.order_items item ON item.order_id = purchase.id
      AND split_part(btrim(item.product_id), '::', 1) = entry.product_id
      AND item.quantity > 0 AND item.line_total > 0
    WHERE purchase.payment_state::TEXT = 'paid' AND purchase.status::TEXT <> 'cancelled'
      AND purchase.payment_review_required IS FALSE
      AND purchase.created_at <= review.created_at
      AND COALESCE(purchase.paid_at, purchase.created_at) <= COALESCE(review.reviewed_at, review.created_at)
      AND COALESCE(purchase.paid_at, purchase.created_at) <= statement_timestamp()
      AND (purchase.customer_id = review.customer_id OR (
        purchase.customer_id IS NULL AND customer.email_confirmed_at IS NOT NULL
        AND NULLIF(btrim(customer.email), '') IS NOT NULL
        AND lower(btrim(purchase.customer_email)) = lower(btrim(customer.email))))
  )
ORDER BY review.customer_id, entry.product_id, review.season_id, review.created_at, review.id;

-- A canonical product counts once per season; pack sizes, votes and quality
-- marks never create extra discoveries. Renewed purchases apply prospectively.
CREATE FUNCTION public.kq_arena_eligible_tastings()
RETURNS TABLE(user_id UUID, product_id TEXT, notebook_season_id TEXT, arena_season_code TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH reviews AS MATERIALIZED (
    SELECT review.id, review.customer_id, review.season_id, review.created_at,
      COALESCE(review.reviewed_at, review.created_at) AS approved_at, entry.product_id,
      customer.email, customer.email_confirmed_at,
      credit.review_id AS transition_review_id, credit.arena_season_code AS transition_season
    FROM public.contest_reviews review
    JOIN public.contest_entries entry ON entry.id = review.entry_id AND entry.season_id = review.season_id
    JOIN public.products product ON product.id = entry.product_id AND product.category::TEXT = 'fleurs'
    JOIN auth.users customer ON customer.id = review.customer_id
    LEFT JOIN public.kq_arena_tasting_transition_credits credit ON credit.review_id = review.id
    WHERE review.status = 'approved' AND review.created_at <= statement_timestamp()
  ), assigned AS (
    SELECT review.*, CASE WHEN transition_review_id IS NOT NULL THEN transition_season
      ELSE season.season_code END AS assigned_season,
      CASE WHEN transition_review_id IS NOT NULL THEN '-infinity'::TIMESTAMPTZ
        ELSE COALESCE(season.starts_at, season.activated_at, season.created_at) END AS purchase_start
    FROM reviews review
    LEFT JOIN public.kq_seasons season ON review.transition_review_id IS NULL
      AND season.status IN ('active', 'closed')
      AND review.created_at >= COALESCE(season.starts_at, season.activated_at, season.created_at)
      AND review.created_at < COALESCE(LEAST(season.ends_at, season.closed_at), 'infinity'::TIMESTAMPTZ)
    WHERE transition_review_id IS NOT NULL OR season.season_code IS NOT NULL
  )
  SELECT DISTINCT review.customer_id, review.product_id, review.season_id, review.assigned_season
  FROM assigned review
  WHERE EXISTS (
    SELECT 1 FROM public.orders purchase
    JOIN public.order_items item ON item.order_id = purchase.id
      AND split_part(btrim(item.product_id), '::', 1) = review.product_id
      AND item.quantity > 0 AND item.line_total > 0
    WHERE purchase.payment_state::TEXT = 'paid' AND purchase.status::TEXT <> 'cancelled'
      AND purchase.payment_review_required IS FALSE
      AND purchase.created_at >= review.purchase_start AND purchase.created_at <= review.created_at
      AND COALESCE(purchase.paid_at, purchase.created_at) >= review.purchase_start
      AND COALESCE(purchase.paid_at, purchase.created_at) <= review.approved_at
      AND COALESCE(purchase.paid_at, purchase.created_at) <= statement_timestamp()
      AND (purchase.customer_id = review.customer_id OR (
        purchase.customer_id IS NULL AND review.email_confirmed_at IS NOT NULL
        AND NULLIF(btrim(review.email), '') IS NOT NULL
        AND lower(btrim(purchase.customer_email)) = lower(btrim(review.email))))
  );
$$;
REVOKE ALL ON FUNCTION public.kq_arena_eligible_tastings() FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.kq_arena_leaderboard_snapshots
  ADD COLUMN formula_version TEXT NOT NULL DEFAULT 'arena-v2-development';

CREATE OR REPLACE FUNCTION public.rpc_kq_get_arena_leaderboard(
  p_season_code TEXT, p_force_refresh BOOLEAN DEFAULT false
)
RETURNS public.kq_arena_leaderboard_snapshots
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_snapshot public.kq_arena_leaderboard_snapshots%ROWTYPE;
  v_season public.kq_seasons%ROWTYPE;
  v_contest_id TEXT;
  v_contest_code TEXT;
  v_leaderboard JSONB;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_season FROM public.kq_seasons WHERE season_code = p_season_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'arena_season_not_found'; END IF;
  v_start := COALESCE(v_season.starts_at, v_season.activated_at, v_season.created_at);
  v_end := LEAST(statement_timestamp(), v_season.ends_at, v_season.closed_at);
  SELECT season.id, season.code INTO v_contest_id, v_contest_code
    FROM public.contest_seasons season JOIN public.kq_current_notebook_season() current_season ON current_season.id = season.id;
  SELECT * INTO v_snapshot FROM public.kq_arena_leaderboard_snapshots WHERE season_code = p_season_code;
  -- Closed snapshots and frozen reward standings are historical evidence.
  IF FOUND AND v_season.status = 'closed' THEN RETURN v_snapshot; END IF;
  IF v_season.status <> 'active' THEN RAISE EXCEPTION 'arena_season_not_active'; END IF;
  IF FOUND AND NOT COALESCE(p_force_refresh, false)
    AND v_snapshot.formula_version = 'arena-v3-tasting-first'
    AND v_snapshot.contest_season_id IS NOT DISTINCT FROM v_contest_id
    AND v_snapshot.generated_at > clock_timestamp() - INTERVAL '60 seconds' THEN RETURN v_snapshot; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('kq_arena_leaderboard:' || p_season_code));
  SELECT * INTO v_snapshot FROM public.kq_arena_leaderboard_snapshots WHERE season_code = p_season_code;
  IF FOUND AND NOT COALESCE(p_force_refresh, false)
    AND v_snapshot.formula_version = 'arena-v3-tasting-first'
    AND v_snapshot.contest_season_id IS NOT DISTINCT FROM v_contest_id
    AND v_snapshot.generated_at > clock_timestamp() - INTERVAL '60 seconds' THEN RETURN v_snapshot; END IF;

  WITH discoveries AS MATERIALIZED (
    SELECT user_id, count(DISTINCT product_id) AS flower_count
    FROM public.kq_arena_eligible_tastings()
    WHERE arena_season_code = p_season_code GROUP BY user_id
  ), bot_points AS (
    -- All writes to season_points are human verdicts and daily challenges.
    -- The immutable claim ledger isolates the bot part exactly, including
    -- bot claims awarded to players who also participate in human duels.
    SELECT user_id, SUM(points)::BIGINT AS points FROM public.kq_daily_challenge_claims
    WHERE bot_battle_id IS NOT NULL AND claimed_at >= v_start AND claimed_at < v_end GROUP BY user_id
  ), human_points AS (
    SELECT profile.user_id, profile.rating, profile.wins, profile.losses,
      GREATEST(0, profile.season_points::BIGINT - COALESCE(bot.points, 0)) AS points
    FROM public.kq_rank_profiles profile LEFT JOIN bot_points bot ON bot.user_id = profile.user_id
    WHERE profile.season_code = p_season_code AND profile.wins + profile.losses > 0
  ), candidates AS (
    SELECT user_id FROM discoveries UNION SELECT user_id FROM human_points
    UNION SELECT user_id FROM public.kq_equipment_wallets
  ), scores AS MATERIALIZED (
    SELECT candidate.user_id, COALESCE(profile.pseudo, 'Cultivateur anonyme') AS pseudo,
      COALESCE(human.rating, 1000) AS rating, COALESCE(human.wins, 0) AS wins, COALESCE(human.losses, 0) AS losses,
      COALESCE(discovery.flower_count, 0) AS flower_count, COALESCE(human.points, 0) AS human_points,
      COALESCE(discovery.flower_count, 0) * 100 AS notebook_score,
      ROUND(100 * LOG(2::NUMERIC, 1 + COALESCE(human.points, 0)::NUMERIC / 50), 1) AS placard_score,
      (business.value->>'score')::NUMERIC AS business_score, business.value AS business
    FROM candidates candidate
    LEFT JOIN public.contest_profiles profile ON profile.customer_id = candidate.user_id
    LEFT JOIN discoveries discovery ON discovery.user_id = candidate.user_id
    LEFT JOIN human_points human ON human.user_id = candidate.user_id
    CROSS JOIN LATERAL (SELECT public.kq_business_development_score_for_season(candidate.user_id, p_season_code, v_end) AS value OFFSET 0) business
  ), ranked AS (
    SELECT *, RANK() OVER (ORDER BY notebook_score + placard_score + business_score DESC,
      notebook_score DESC, placard_score DESC, business_score DESC) AS rank
    FROM scores WHERE notebook_score + placard_score + business_score > 0
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId', user_id, 'rank', rank, 'pseudo', pseudo,
    'score', notebook_score + placard_score + business_score,
    'notebookScore', notebook_score, 'placardScore', placard_score, 'businessScore', business_score,
    'approvedReviewCount', flower_count, 'tastedFlowerCount', flower_count, 'duelSeasonPoints', human_points,
    'productionAreaM2', business->'productionAreaM2', 'salesHtCents', business->'salesHtCents', 'reputationPoints', business->'reputationPoints',
    'rating', rating, 'wins', wins, 'losses', losses
  ) ORDER BY rank, user_id), '[]'::JSONB) INTO v_leaderboard FROM ranked;

  INSERT INTO public.kq_arena_leaderboard_snapshots
    (season_code, contest_season_id, contest_season_code, generated_at, leaderboard, formula_version)
  VALUES(p_season_code, v_contest_id, v_contest_code, clock_timestamp(), v_leaderboard, 'arena-v3-tasting-first')
  ON CONFLICT(season_code) DO UPDATE SET contest_season_id = EXCLUDED.contest_season_id,
    contest_season_code = EXCLUDED.contest_season_code, generated_at = EXCLUDED.generated_at,
    leaderboard = EXCLUDED.leaderboard, formula_version = EXCLUDED.formula_version
  RETURNING * INTO v_snapshot;
  RETURN v_snapshot;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_get_arena_leaderboard(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_get_arena_leaderboard(TEXT, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_get_arena_category_leaderboard(p_season_code TEXT, p_category TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_snapshot public.kq_arena_leaderboard_snapshots%ROWTYPE;
  v_rows JSONB; v_generated_at TIMESTAMPTZ;
  v_formula_version TEXT := 'arena-v3-tasting-first';
BEGIN
  IF p_category IS NULL OR p_category NOT IN ('tasting', 'tasting-global', 'duels', 'business') THEN
    RAISE EXCEPTION 'invalid_ranking_category'; END IF;
  IF p_category = 'tasting-global' THEN
    WITH discoveries AS (
      -- Historical Carnets predate Arena seasons. Preserve their season key,
      -- but two Carnets in the same Arena season never duplicate a discovery.
      SELECT user_id, count(DISTINCT (product_id,
        COALESCE('arena:' || arena_season_code, 'notebook:' || notebook_season_id))) AS flower_count
      FROM public.kq_arena_eligible_tastings() GROUP BY user_id
    ), ranked AS (
      SELECT discovery.*, COALESCE(profile.pseudo, 'Cultivateur anonyme') AS pseudo,
        RANK() OVER (ORDER BY flower_count DESC) AS rank
      FROM discoveries discovery LEFT JOIN public.contest_profiles profile ON profile.customer_id = discovery.user_id
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('userId', user_id, 'rank', rank, 'pseudo', pseudo,
      'score', flower_count * 100, 'notebookScore', flower_count * 100, 'placardScore', 0, 'businessScore', 0,
      'tastedFlowerCount', flower_count, 'approvedReviewCount', flower_count, 'duelSeasonPoints', 0,
      'rating', 1000, 'wins', 0, 'losses', 0) ORDER BY rank, user_id), '[]'::JSONB)
    INTO v_rows FROM ranked;
    v_generated_at := statement_timestamp();
  ELSE
    v_snapshot := public.rpc_kq_get_arena_leaderboard(p_season_code, false);
    WITH scores AS (
      SELECT entry, (entry->>CASE p_category WHEN 'tasting' THEN 'notebookScore'
        WHEN 'duels' THEN 'placardScore' ELSE 'businessScore' END)::NUMERIC AS category_score
      FROM jsonb_array_elements(v_snapshot.leaderboard) entry
    ), ranked AS (
      SELECT entry, category_score, RANK() OVER (ORDER BY category_score DESC) AS rank
      FROM scores WHERE category_score > 0
    )
    SELECT COALESCE(jsonb_agg(entry || jsonb_build_object('rank', rank, 'score', category_score)
      ORDER BY rank, entry->>'userId'), '[]'::JSONB) INTO v_rows FROM ranked;
    v_generated_at := v_snapshot.generated_at;
    v_formula_version := v_snapshot.formula_version;
  END IF;
  RETURN jsonb_build_object('seasonCode', p_season_code, 'category', p_category,
    'formulaVersion', v_formula_version, 'generatedAt', v_generated_at, 'leaderboard', v_rows);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_get_arena_category_leaderboard(TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_get_arena_category_leaderboard(TEXT, TEXT) TO service_role;

COMMIT;
