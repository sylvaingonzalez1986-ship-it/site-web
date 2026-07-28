BEGIN;

CREATE TABLE IF NOT EXISTS public.kq_seasons (
  season_code TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'closed')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

INSERT INTO public.kq_seasons (season_code, status, activated_at)
VALUES ('KQ-2026-S1', 'active', now())
ON CONFLICT (season_code) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS uq_kq_single_active_season
  ON public.kq_seasons(status)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.kq_season_rank_archives (
  season_code TEXT NOT NULL REFERENCES public.kq_seasons(season_code) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  final_rank INTEGER NOT NULL CHECK (final_rank >= 1),
  final_rating INTEGER NOT NULL CHECK (final_rating >= 0),
  final_season_points INTEGER NOT NULL CHECK (final_season_points >= 0),
  wins INTEGER NOT NULL CHECK (wins >= 0),
  losses INTEGER NOT NULL CHECK (losses >= 0),
  final_streak INTEGER NOT NULL CHECK (final_streak >= 0),
  burned_flowers INTEGER NOT NULL CHECK (burned_flowers >= 0),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season_code, user_id),
  UNIQUE (season_code, final_rank)
);

ALTER TABLE public.kq_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_season_rank_archives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_seasons, public.kq_season_rank_archives
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_kq_rollover_season(
  p_from_season TEXT,
  p_to_season TEXT,
  p_execute BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_status TEXT;
  v_to_status TEXT;
  v_players INTEGER;
  v_eligible INTEGER;
  v_missing_grants INTEGER;
  v_locked_battles INTEGER;
BEGIN
  IF COALESCE(p_from_season, '') = '' OR COALESCE(p_to_season, '') = '' OR p_from_season = p_to_season THEN
    RAISE EXCEPTION 'Invalid season rollover';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('kq-season-rollover'));

  SELECT status INTO v_from_status FROM public.kq_seasons
  WHERE season_code = p_from_season FOR UPDATE;
  SELECT status INTO v_to_status FROM public.kq_seasons
  WHERE season_code = p_to_season FOR UPDATE;
  IF v_from_status IS NULL OR v_to_status IS NULL THEN RAISE EXCEPTION 'Season unavailable'; END IF;
  IF v_from_status = 'closed' AND v_to_status = 'active' THEN
    RETURN jsonb_build_object('alreadyRolled', true, 'executed', false);
  END IF;
  IF v_from_status <> 'active' OR v_to_status <> 'planned' THEN
    RAISE EXCEPTION 'Season statuses do not allow rollover';
  END IF;

  SELECT count(*)::INTEGER INTO v_players
  FROM public.kq_rank_profiles WHERE season_code = p_from_season;
  SELECT count(*)::INTEGER INTO v_eligible
  FROM public.kq_rank_profiles
  WHERE season_code = p_from_season AND wins + losses >= 3;
  SELECT count(*)::INTEGER INTO v_missing_grants
  FROM public.kq_rank_profiles profile
  WHERE profile.season_code = p_from_season
    AND profile.wins + profile.losses >= 3
    AND NOT EXISTS (
      SELECT 1 FROM public.kq_season_reward_grants grant_receipt
      WHERE grant_receipt.season_code = p_from_season
        AND grant_receipt.user_id = profile.user_id
    );
  SELECT count(*)::INTEGER INTO v_locked_battles
  FROM public.kq_battles WHERE status = 'locked';

  IF NOT p_execute THEN
    RETURN jsonb_build_object(
      'alreadyRolled', false, 'executed', false, 'players', v_players,
      'eligiblePlayers', v_eligible, 'missingRewardGrants', v_missing_grants,
      'lockedBattles', v_locked_battles,
      'ready', v_missing_grants = 0 AND v_locked_battles = 0
    );
  END IF;
  IF v_missing_grants > 0 THEN RAISE EXCEPTION 'Season rewards are incomplete'; END IF;
  IF v_locked_battles > 0 THEN RAISE EXCEPTION 'Locked battles prevent season rollover'; END IF;

  INSERT INTO public.kq_season_rank_archives (
    season_code, user_id, final_rank, final_rating, final_season_points,
    wins, losses, final_streak, burned_flowers
  )
  SELECT p_from_season, user_id,
    (row_number() OVER (ORDER BY rating DESC, season_points DESC, wins DESC, user_id))::INTEGER,
    rating, season_points, wins, losses, streak, burned_flowers
  FROM public.kq_rank_profiles
  WHERE season_code = p_from_season
  ON CONFLICT (season_code, user_id) DO NOTHING;

  UPDATE public.kq_rank_profiles SET
    season_code = p_to_season, rating = 1000, season_points = 0,
    wins = 0, losses = 0, streak = 0, burned_flowers = 0, updated_at = now()
  WHERE season_code = p_from_season;
  UPDATE public.kq_seasons SET status = 'closed', closed_at = now()
  WHERE season_code = p_from_season;
  UPDATE public.kq_seasons SET status = 'active', activated_at = now()
  WHERE season_code = p_to_season;

  RETURN jsonb_build_object(
    'alreadyRolled', false, 'executed', true, 'players', v_players,
    'fromSeason', p_from_season, 'toSeason', p_to_season
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_rollover_season(TEXT, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_rollover_season(TEXT, TEXT, BOOLEAN)
  TO service_role;

COMMENT ON FUNCTION public.rpc_kq_rollover_season(TEXT, TEXT, BOOLEAN) IS
  'Dormant admin-only season rollover. Preview by default; no application route executes it.';

COMMIT;
