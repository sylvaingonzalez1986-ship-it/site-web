BEGIN;

-- Reputation is earned when a market lot is settled, so the public ranking
-- must not keep the first wallet values seen during the Paris day. The table
-- remains a durable snapshot for season rewards and recovery, but every
-- explicit refresh now rebuilds it from the authoritative profiles/wallets.
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
  -- Serialize concurrent refreshes for one season. This keeps the snapshot
  -- coherent without holding locks on player profiles or wallets.
  PERFORM pg_advisory_xact_lock(hashtext('kq_leaderboard:' || p_season_code));

  WITH candidates AS (
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
  ), ranked AS (
    SELECT *,
      row_number() OVER (
        ORDER BY rating DESC, season_points DESC, reputation DESC,
          wins DESC, losses ASC, user_id
      ) AS rank
    FROM candidates
    ORDER BY rating DESC, season_points DESC, reputation DESC,
      wins DESC, losses ASC, user_id
    LIMIT 100
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'rank', rank,
    'userId', user_id,
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
