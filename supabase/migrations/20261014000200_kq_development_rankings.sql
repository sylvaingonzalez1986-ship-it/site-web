BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Company development is a separate, capped contribution. The helper reads
-- existing business state without settling sales, invoices or subscriptions.
CREATE OR REPLACE FUNCTION public.rpc_kq_refresh_daily_leaderboard(p_season_code TEXT)
RETURNS public.kq_leaderboard_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot public.kq_leaderboard_snapshots%ROWTYPE;
  v_leaderboard JSONB;
  v_snapshot_date DATE := (timezone('Europe/Paris', now()))::date;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('kq_leaderboard:' || p_season_code));

  WITH base AS MATERIALIZED (
    SELECT profile.user_id, profile.rating, profile.season_points,
      COALESCE(wallet.reputation, 0) AS reputation,
      (public.kq_business_development_score(profile.user_id)->>'score')::INTEGER AS business_score,
      profile.wins, profile.losses, profile.streak, profile.burned_flowers
    FROM public.kq_rank_profiles profile
    LEFT JOIN public.kq_equipment_wallets wallet ON wallet.user_id = profile.user_id
    WHERE profile.season_code = p_season_code
  ), candidates AS (
    SELECT *, rating
      + LEAST(150, ROUND(season_points * 0.25)::INTEGER)
      + LEAST(100, ROUND(4 * SQRT(reputation::NUMERIC))::INTEGER)
      + business_score AS placard_score
    FROM base
  ), ranked AS (
    SELECT *, row_number() OVER (
      ORDER BY placard_score DESC, reputation DESC, rating DESC,
        wins DESC, losses ASC, season_points DESC, user_id
    ) AS rank
    FROM candidates
    ORDER BY placard_score DESC, reputation DESC, rating DESC,
      wins DESC, losses ASC, season_points DESC, user_id
    LIMIT 100
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'rank', rank, 'userId', user_id, 'placardScore', placard_score,
    'rating', rating, 'seasonPoints', season_points, 'reputation', reputation,
    'businessScore', business_score,
    'wins', wins, 'losses', losses, 'streak', streak, 'burnedFlowers', burned_flowers
  ) ORDER BY rank), '[]'::JSONB) INTO v_leaderboard FROM ranked;

  INSERT INTO public.kq_leaderboard_snapshots(snapshot_date, season_code, leaderboard)
  VALUES (v_snapshot_date, p_season_code, v_leaderboard)
  ON CONFLICT (snapshot_date, season_code) DO UPDATE
  SET leaderboard = EXCLUDED.leaderboard, generated_at = now()
  RETURNING * INTO v_snapshot;
  RETURN v_snapshot;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_refresh_daily_leaderboard(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_refresh_daily_leaderboard(TEXT) TO service_role;

-- Keep the shared sixty-second cache and explicit forced refresh for reward
-- finalization. General Arena scores remain out of 1,000: 300 + 500 + 200.
CREATE OR REPLACE FUNCTION public.rpc_kq_get_arena_leaderboard(
  p_season_code TEXT,
  p_force_refresh BOOLEAN DEFAULT false
)
RETURNS public.kq_arena_leaderboard_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot public.kq_arena_leaderboard_snapshots%ROWTYPE;
  v_contest_id public.contest_seasons.id%TYPE;
  v_contest_code TEXT;
  v_leaderboard JSONB;
BEGIN
  SELECT id, code INTO v_contest_id, v_contest_code
  FROM public.contest_seasons WHERE is_active = true AND is_archived = false
  ORDER BY harvest_start DESC NULLS LAST, year DESC LIMIT 1;

  SELECT * INTO v_snapshot FROM public.kq_arena_leaderboard_snapshots
  WHERE season_code = p_season_code;
  IF FOUND AND NOT COALESCE(p_force_refresh, false)
    AND v_snapshot.contest_season_id IS NOT DISTINCT FROM v_contest_id
    AND v_snapshot.generated_at > clock_timestamp() - INTERVAL '60 seconds' THEN
    RETURN v_snapshot;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('kq_arena_leaderboard:' || p_season_code));
  SELECT * INTO v_snapshot FROM public.kq_arena_leaderboard_snapshots
  WHERE season_code = p_season_code;
  IF FOUND AND NOT COALESCE(p_force_refresh, false)
    AND v_snapshot.contest_season_id IS NOT DISTINCT FROM v_contest_id
    AND v_snapshot.generated_at > clock_timestamp() - INTERVAL '60 seconds' THEN
    RETURN v_snapshot;
  END IF;

  WITH notebook_points AS (
    SELECT points.customer_id, SUM(points.points) AS season_points
    FROM public.contest_tester_points points
    JOIN public.contest_profiles profile ON profile.customer_id = points.customer_id
    WHERE points.season_id = v_contest_id
    GROUP BY points.customer_id
  ), notebook_reviews AS (
    SELECT customer_id, COUNT(*) AS approved_review_count
    FROM public.contest_reviews
    WHERE season_id = v_contest_id AND status = 'approved'
    GROUP BY customer_id
  ), scores AS MATERIALIZED (
    SELECT rank_profile.user_id, COALESCE(profile.pseudo, 'Cultivateur anonyme') AS pseudo,
      rank_profile.rating, rank_profile.wins, rank_profile.losses,
      LEAST(300, GREATEST(0, COALESCE(points.season_points, 0))) AS notebook_score,
      LEAST(400, GREATEST(0, rank_profile.season_points::BIGINT) * 2)
        + LEAST(100, GREATEST(0, ROUND((rank_profile.rating - 900)::NUMERIC / 4))) AS placard_score,
      (public.kq_business_development_score(rank_profile.user_id)->>'score')::INTEGER AS business_score,
      CASE WHEN points.customer_id IS NOT NULL
        THEN COALESCE(reviews.approved_review_count, 0) ELSE 0 END AS approved_review_count
    FROM public.kq_rank_profiles rank_profile
    LEFT JOIN public.contest_profiles profile ON profile.customer_id = rank_profile.user_id
    LEFT JOIN notebook_points points ON points.customer_id = rank_profile.user_id
    LEFT JOIN notebook_reviews reviews ON reviews.customer_id = rank_profile.user_id
    WHERE rank_profile.season_code = p_season_code
      AND rank_profile.wins + rank_profile.losses > 0
  ), ranked AS (
    SELECT *, row_number() OVER (
      ORDER BY notebook_score + placard_score + business_score DESC, rating DESC, user_id
    ) AS rank
    FROM scores
    ORDER BY notebook_score + placard_score + business_score DESC, rating DESC, user_id
    LIMIT 100
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId', user_id, 'rank', rank, 'pseudo', pseudo,
    'score', notebook_score + placard_score + business_score, 'notebookScore', notebook_score,
    'placardScore', placard_score, 'businessScore', business_score,
    'approvedReviewCount', approved_review_count,
    'rating', rating, 'wins', wins, 'losses', losses
  ) ORDER BY rank), '[]'::JSONB) INTO v_leaderboard FROM ranked;

  INSERT INTO public.kq_arena_leaderboard_snapshots (
    season_code, contest_season_id, contest_season_code, generated_at, leaderboard
  ) VALUES (p_season_code, v_contest_id, v_contest_code, clock_timestamp(), v_leaderboard)
  ON CONFLICT (season_code) DO UPDATE SET
    contest_season_id = EXCLUDED.contest_season_id,
    contest_season_code = EXCLUDED.contest_season_code,
    generated_at = EXCLUDED.generated_at,
    leaderboard = EXCLUDED.leaderboard
  RETURNING * INTO v_snapshot;
  RETURN v_snapshot;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_get_arena_leaderboard(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_get_arena_leaderboard(TEXT, BOOLEAN) TO service_role;

-- Extend only the current progress expression. Preserve the later campaign
-- and flower enrichments, and keep bootstrap reads independent of cache writes.
DO $$
DECLARE
  v_body TEXT := pg_get_functiondef('public.rpc_kq_player_core_snapshot(uuid)'::REGPROCEDURE);
  v_anchor TEXT;
BEGIN
  v_anchor := '''placardScore'', profile.rating';
  IF strpos(v_body, v_anchor) = 0 THEN RAISE EXCEPTION 'kq_development_score_patch_mismatch'; END IF;
  v_body := replace(v_body, v_anchor, '''businessScore'', development.score,
      ''placardScore'', profile.rating + development.score');
  v_anchor := 'FROM rank_profile profile';
  IF strpos(v_body, v_anchor) = 0 THEN RAISE EXCEPTION 'kq_development_progress_patch_mismatch'; END IF;
  v_body := replace(v_body, v_anchor, v_anchor || '
    CROSS JOIN LATERAL (
      SELECT (public.kq_business_development_score(profile.user_id)->>''score'')::INTEGER AS score
      OFFSET 0
    ) development');
  EXECUTE v_body;
END;
$$;

-- Expire only current live caches. Historical rankings, rank archives and
-- frozen customer reward standings retain their recorded scores and order.
UPDATE public.kq_leaderboard_snapshots snapshot
SET generated_at = LEAST(snapshot.generated_at, clock_timestamp() - INTERVAL '61 seconds')
WHERE snapshot.season_code IN (SELECT season_code FROM public.kq_seasons WHERE status = 'active')
  AND snapshot.snapshot_date = (
    SELECT MAX(recent.snapshot_date) FROM public.kq_leaderboard_snapshots recent
    WHERE recent.season_code = snapshot.season_code
  );
UPDATE public.kq_arena_leaderboard_snapshots snapshot
SET generated_at = LEAST(snapshot.generated_at, clock_timestamp() - INTERVAL '61 seconds')
WHERE snapshot.season_code IN (SELECT season_code FROM public.kq_seasons WHERE status = 'active');

COMMIT;
