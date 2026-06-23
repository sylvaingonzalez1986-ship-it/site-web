BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contest_reward_unlock_status') THEN
    CREATE TYPE public.contest_reward_unlock_status AS ENUM ('unlocked', 'claimed', 'expired');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.contest_tester_points (
  id BIGSERIAL PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_id UUID REFERENCES public.contest_reviews(id) ON DELETE SET NULL,
  season_id TEXT REFERENCES public.contest_seasons(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  points INTEGER NOT NULL CHECK (points <> 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (char_length(trim(reason)) BETWEEN 3 AND 80)
);

CREATE TABLE IF NOT EXISTS public.contest_badges (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  season_id TEXT REFERENCES public.contest_seasons(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (char_length(trim(code)) BETWEEN 3 AND 80),
  CHECK (char_length(trim(label)) BETWEEN 3 AND 120),
  CHECK (char_length(description) <= 500)
);

CREATE TABLE IF NOT EXISTS public.contest_profile_badges (
  id BIGSERIAL PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES public.contest_badges(id) ON DELETE CASCADE,
  review_id UUID REFERENCES public.contest_reviews(id) ON DELETE SET NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contest_profile_badges_unique_customer_badge UNIQUE (customer_id, badge_id)
);

CREATE TABLE IF NOT EXISTS public.contest_rewards (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  required_points INTEGER NOT NULL DEFAULT 0 CHECK (required_points >= 0),
  reward_type TEXT NOT NULL DEFAULT 'manual',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (char_length(trim(code)) BETWEEN 3 AND 80),
  CHECK (char_length(trim(label)) BETWEEN 3 AND 120),
  CHECK (char_length(description) <= 500),
  CHECK (char_length(trim(reward_type)) BETWEEN 3 AND 40)
);

CREATE TABLE IF NOT EXISTS public.contest_reward_unlocks (
  id BIGSERIAL PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL REFERENCES public.contest_rewards(id) ON DELETE CASCADE,
  status public.contest_reward_unlock_status NOT NULL DEFAULT 'unlocked',
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  CONSTRAINT contest_reward_unlocks_unique_customer_reward UNIQUE (customer_id, reward_id),
  CHECK (claimed_at IS NULL OR claimed_at >= unlocked_at)
);

CREATE INDEX IF NOT EXISTS idx_contest_tester_points_customer_created
  ON public.contest_tester_points (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contest_tester_points_review
  ON public.contest_tester_points (review_id);

CREATE INDEX IF NOT EXISTS idx_contest_badges_active
  ON public.contest_badges (is_active, season_id);

CREATE INDEX IF NOT EXISTS idx_contest_profile_badges_customer
  ON public.contest_profile_badges (customer_id, awarded_at DESC);

CREATE INDEX IF NOT EXISTS idx_contest_rewards_active_points
  ON public.contest_rewards (is_active, required_points);

CREATE INDEX IF NOT EXISTS idx_contest_reward_unlocks_customer
  ON public.contest_reward_unlocks (customer_id, unlocked_at DESC);

ALTER TABLE public.contest_tester_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_profile_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_reward_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contest_tester_points_user_read_own ON public.contest_tester_points;
CREATE POLICY contest_tester_points_user_read_own
  ON public.contest_tester_points
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS contest_badges_public_read ON public.contest_badges;
CREATE POLICY contest_badges_public_read
  ON public.contest_badges
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

DROP POLICY IF EXISTS contest_profile_badges_public_read ON public.contest_profile_badges;
CREATE POLICY contest_profile_badges_public_read
  ON public.contest_profile_badges
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS contest_rewards_public_read ON public.contest_rewards;
CREATE POLICY contest_rewards_public_read
  ON public.contest_rewards
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

DROP POLICY IF EXISTS contest_reward_unlocks_user_read_own ON public.contest_reward_unlocks;
CREATE POLICY contest_reward_unlocks_user_read_own
  ON public.contest_reward_unlocks
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

COMMIT;
