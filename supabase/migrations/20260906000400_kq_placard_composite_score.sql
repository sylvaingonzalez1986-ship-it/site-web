BEGIN;

-- The Placard ranking combines duel skill, seasonal activity and permanent
-- quality reputation. Activity and reputation bonuses are capped so neither
-- farming nor account age can overwhelm the Elo rating.
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

  WITH base AS (
    SELECT
      profile.user_id,
      profile.rating,
      profile.season_points,
      COALESCE(wallet.reputation, 0) AS reputation,
      profile.wins,
      profile.losses,
      profile.streak,
      profile.burned_flowers
    FROM public.kq_rank_profiles AS profile
    LEFT JOIN public.kq_equipment_wallets AS wallet
      ON wallet.user_id = profile.user_id
    WHERE profile.season_code = p_season_code
  ), candidates AS (
    SELECT *,
      rating
        + LEAST(150, ROUND(season_points * 0.25)::INTEGER)
        + LEAST(100, ROUND(4 * SQRT(reputation::NUMERIC))::INTEGER)
        AS placard_score
    FROM base
  ), ranked AS (
    SELECT *,
      row_number() OVER (
        ORDER BY placard_score DESC, reputation DESC, rating DESC,
          wins DESC, losses ASC, season_points DESC, user_id
      ) AS rank
    FROM candidates
    ORDER BY placard_score DESC, reputation DESC, rating DESC,
      wins DESC, losses ASC, season_points DESC, user_id
    LIMIT 100
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'rank', rank,
    'userId', user_id,
    'placardScore', placard_score,
    'rating', rating,
    'seasonPoints', season_points,
    'reputation', reputation,
    'wins', wins,
    'losses', losses,
    'streak', streak,
    'burnedFlowers', burned_flowers
  ) ORDER BY rank), '[]'::JSONB)
  INTO v_leaderboard
  FROM ranked;

  INSERT INTO public.kq_leaderboard_snapshots (
    snapshot_date, season_code, leaderboard
  ) VALUES (
    v_snapshot_date, p_season_code, v_leaderboard
  )
  ON CONFLICT (snapshot_date, season_code) DO UPDATE
  SET leaderboard = EXCLUDED.leaderboard,
    generated_at = now()
  RETURNING * INTO v_snapshot;

  RETURN v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_refresh_daily_leaderboard(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_refresh_daily_leaderboard(TEXT)
  TO service_role;

COMMIT;
