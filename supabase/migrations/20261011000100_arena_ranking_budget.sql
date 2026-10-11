BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Profile reads never refresh the shared ranking. Only this named relation is
-- readable through the Data API; its writes remain SECURITY DEFINER operations.
REVOKE ALL ON TABLE public.kq_leaderboard_snapshots FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.kq_leaderboard_snapshots TO service_role;

-- Keep the existing explicit refresh RPC fresh for season reward settlement.
-- Public reads share one persisted result for sixty seconds across app servers.
CREATE OR REPLACE FUNCTION public.rpc_kq_get_daily_leaderboard(p_season_code TEXT)
RETURNS public.kq_leaderboard_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot public.kq_leaderboard_snapshots%ROWTYPE;
BEGIN
  SELECT * INTO v_snapshot FROM public.kq_leaderboard_snapshots
  WHERE season_code = p_season_code ORDER BY snapshot_date DESC LIMIT 1;
  IF FOUND AND v_snapshot.generated_at > clock_timestamp() - INTERVAL '60 seconds' THEN
    RETURN v_snapshot;
  END IF;

  -- Same lock as the forced refresher. Recheck after waiting for its writer.
  PERFORM pg_advisory_xact_lock(hashtext('kq_leaderboard:' || p_season_code));
  SELECT * INTO v_snapshot FROM public.kq_leaderboard_snapshots
  WHERE season_code = p_season_code ORDER BY snapshot_date DESC LIMIT 1;
  IF FOUND AND v_snapshot.generated_at > clock_timestamp() - INTERVAL '60 seconds' THEN
    RETURN v_snapshot;
  END IF;
  RETURN public.rpc_kq_refresh_daily_leaderboard(p_season_code);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_get_daily_leaderboard(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_get_daily_leaderboard(TEXT) TO service_role;

CREATE TABLE public.kq_arena_leaderboard_snapshots (
  season_code TEXT PRIMARY KEY,
  contest_season_id TEXT,
  contest_season_code TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  leaderboard JSONB NOT NULL DEFAULT '[]'::JSONB
);
ALTER TABLE public.kq_arena_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_arena_leaderboard_snapshots FROM PUBLIC, anon, authenticated, service_role;

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

  -- Aggregate only the current season's notebook data, without the unrelated
  -- vote summaries and ranking windows from contest_tester_rankings_by_season.
  -- Match its semantics: notebook points require a contest profile and reviews
  -- appear in that view only when the user has a points row for this season.
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
  ), scores AS (
    SELECT rank_profile.user_id, COALESCE(profile.pseudo, 'Cultivateur anonyme') AS pseudo,
      rank_profile.rating, rank_profile.wins, rank_profile.losses,
      LEAST(300, GREATEST(0, COALESCE(points.season_points, 0))) AS notebook_score,
      LEAST(600, rank_profile.season_points::BIGINT * 2)
        + LEAST(100, GREATEST(0, ROUND((rank_profile.rating - 900)::NUMERIC / 4))) AS placard_score,
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
      ORDER BY notebook_score + placard_score DESC, rating DESC, user_id
    ) AS rank
    FROM scores
    ORDER BY notebook_score + placard_score DESC, rating DESC, user_id
    LIMIT 100
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId', user_id, 'rank', rank, 'pseudo', pseudo,
    'score', notebook_score + placard_score, 'notebookScore', notebook_score,
    'placardScore', placard_score, 'approvedReviewCount', approved_review_count,
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

-- Extend the existing consolidated payload without losing the intervening
-- culture-care flower fields. Failure is explicit if its contract has changed.
DO $$
DECLARE
  v_body TEXT := pg_get_functiondef('public.rpc_kq_player_core_snapshot(uuid)'::REGPROCEDURE);
  v_anchor TEXT;
BEGIN
  v_anchor := '''seasonPoints'', profile.season_points,';
  IF strpos(v_body, v_anchor) = 0 THEN RAISE EXCEPTION 'kq_budget_progress_patch_mismatch'; END IF;
  v_body := replace(v_body, v_anchor, v_anchor || '
      ''reputation'', COALESCE(wallet.reputation, 0),
      ''placardScore'', profile.rating
        + LEAST(150, ROUND(profile.season_points * 0.25)::INTEGER)
        + LEAST(100, ROUND(4 * SQRT(COALESCE(wallet.reputation, 0)::NUMERIC))::INTEGER),');
  v_anchor := 'FROM rank_profile profile';
  IF strpos(v_body, v_anchor) = 0 THEN RAISE EXCEPTION 'kq_budget_wallet_patch_mismatch'; END IF;
  v_body := replace(v_body, v_anchor, v_anchor || '
    LEFT JOIN public.kq_equipment_wallets wallet ON wallet.user_id = profile.user_id');
  v_anchor := '''leaderboardGeneratedAt'', snapshot.snapshot_date';
  IF strpos(v_body, v_anchor) = 0 THEN RAISE EXCEPTION 'kq_budget_timestamp_patch_mismatch'; END IF;
  v_body := replace(v_body, v_anchor, '''leaderboardGeneratedAt'', snapshot.generated_at');
  v_anchor := 'SELECT leaderboard, snapshot_date';
  IF strpos(v_body, v_anchor) = 0 THEN RAISE EXCEPTION 'kq_budget_snapshot_patch_mismatch'; END IF;
  v_body := replace(v_body, v_anchor, 'SELECT leaderboard, snapshot_date, generated_at');
  EXECUTE v_body;
END;
$$;

COMMIT;
