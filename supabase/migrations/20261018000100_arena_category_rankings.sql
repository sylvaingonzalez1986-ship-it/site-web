BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Rank each discipline across all eligible players before taking its top 100.
-- General/reward standings and the existing composite Kanab Quest score stay intact.
CREATE FUNCTION public.rpc_kq_get_arena_category_leaderboard(
  p_season_code TEXT,
  p_category TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leaderboard JSONB;
BEGIN
  IF p_category IS NULL OR p_category NOT IN ('duels', 'business') THEN
    RAISE EXCEPTION 'invalid_ranking_category';
  END IF;

  WITH candidates AS (
    SELECT user_id FROM public.kq_rank_profiles
    WHERE p_category = 'duels' AND season_code = p_season_code AND wins + losses > 0
    UNION ALL
    -- A company exists independently of battles and persists across seasons.
    SELECT user_id FROM public.kq_equipment_wallets WHERE p_category = 'business'
  ), scores AS MATERIALIZED (
    SELECT candidate.user_id, COALESCE(profile.pseudo, 'Cultivateur anonyme') AS pseudo,
      COALESCE(rank_profile.rating, 1000) AS rating,
      COALESCE(rank_profile.wins, 0) AS wins, COALESCE(rank_profile.losses, 0) AS losses,
      CASE WHEN p_category = 'duels' THEN
        LEAST(400, GREATEST(0, rank_profile.season_points::BIGINT) * 2)
          + LEAST(100, GREATEST(0, ROUND((rank_profile.rating - 900)::NUMERIC / 4)))
      ELSE (public.kq_business_development_score(candidate.user_id)->>'score')::INTEGER
      END AS score
    FROM candidates candidate
    LEFT JOIN public.kq_rank_profiles rank_profile
      ON rank_profile.user_id = candidate.user_id AND rank_profile.season_code = p_season_code
    LEFT JOIN public.contest_profiles profile ON profile.customer_id = candidate.user_id
  ), ranked AS (
    SELECT *, row_number() OVER (
      ORDER BY score DESC,
        CASE WHEN p_category = 'duels' THEN rating END DESC,
        CASE WHEN p_category = 'duels' THEN wins END DESC,
        CASE WHEN p_category = 'duels' THEN losses END ASC,
        user_id
    ) AS rank
    FROM scores
    WHERE p_category = 'duels' OR score > 0
    ORDER BY rank
    LIMIT 100
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId', user_id, 'rank', rank, 'pseudo', pseudo, 'score', score,
    'rating', rating, 'wins', wins, 'losses', losses
  ) ORDER BY rank), '[]'::JSONB) INTO v_leaderboard FROM ranked;

  RETURN jsonb_build_object(
    'seasonCode', p_season_code, 'category', p_category,
    'generatedAt', statement_timestamp(), 'leaderboard', v_leaderboard
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_get_arena_category_leaderboard(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_get_arena_category_leaderboard(TEXT, TEXT)
  TO service_role;

COMMIT;
