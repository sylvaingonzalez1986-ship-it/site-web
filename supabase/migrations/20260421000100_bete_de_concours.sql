BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contest_entry_category') THEN
    CREATE TYPE public.contest_entry_category AS ENUM ('outdoor', 'greenhouse', 'indoor');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contest_consumption_method') THEN
    CREATE TYPE public.contest_consumption_method AS ENUM (
      'vaporizer',
      'joint_no_tobacco',
      'joint_with_tobacco',
      'water_pipe',
      'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contest_review_status') THEN
    CREATE TYPE public.contest_review_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contest_score_criterion') THEN
    CREATE TYPE public.contest_score_criterion AS ENUM (
      'appearance',
      'manicure',
      'drying_curing',
      'cold_aroma',
      'aroma_intensity',
      'aroma_complexity',
      'flavor',
      'smoothness_burn',
      'persistence',
      'overall_impression'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contest_aroma_tag') THEN
    CREATE TYPE public.contest_aroma_tag AS ENUM (
      'citrus',
      'tropical_fruit',
      'red_berry',
      'floral',
      'earthy',
      'woody',
      'pine_resin',
      'spicy_pepper',
      'diesel_gas',
      'herbal',
      'sweet_gourmand',
      'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contest_reward_unlock_status') THEN
    CREATE TYPE public.contest_reward_unlock_status AS ENUM ('unlocked', 'claimed', 'expired');
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.touch_contest_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.contest_seasons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  harvest_start DATE,
  harvest_end DATE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (char_length(trim(code)) BETWEEN 3 AND 60),
  CHECK (char_length(trim(label)) BETWEEN 3 AND 120),
  CHECK (harvest_end IS NULL OR harvest_start IS NULL OR harvest_end >= harvest_start)
);

DROP TRIGGER IF EXISTS trg_touch_contest_seasons_updated_at ON public.contest_seasons;
CREATE TRIGGER trg_touch_contest_seasons_updated_at
BEFORE UPDATE ON public.contest_seasons
FOR EACH ROW
EXECUTE FUNCTION public.touch_contest_updated_at();

CREATE TABLE IF NOT EXISTS public.contest_entries (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  producer_id TEXT REFERENCES public.producers(id) ON DELETE SET NULL,
  season_id TEXT NOT NULL REFERENCES public.contest_seasons(id) ON DELETE RESTRICT,
  category public.contest_entry_category NOT NULL,
  story TEXT NOT NULL DEFAULT '',
  technical_sheet JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_url TEXT NOT NULL DEFAULT '',
  gallery_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (char_length(trim(slug)) BETWEEN 3 AND 120),
  CHECK (char_length(trim(title)) BETWEEN 3 AND 160),
  CHECK (jsonb_typeof(technical_sheet) = 'object'),
  CHECK (jsonb_typeof(gallery_urls) = 'array')
);

DROP TRIGGER IF EXISTS trg_touch_contest_entries_updated_at ON public.contest_entries;
CREATE TRIGGER trg_touch_contest_entries_updated_at
BEFORE UPDATE ON public.contest_entries
FOR EACH ROW
EXECUTE FUNCTION public.touch_contest_updated_at();

CREATE TABLE IF NOT EXISTS public.contest_profiles (
  customer_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pseudo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (pseudo ~ '^[A-Za-z0-9._-]{3,24}$')
);

DROP TRIGGER IF EXISTS trg_touch_contest_profiles_updated_at ON public.contest_profiles;
CREATE TRIGGER trg_touch_contest_profiles_updated_at
BEFORE UPDATE ON public.contest_profiles
FOR EACH ROW
EXECUTE FUNCTION public.touch_contest_updated_at();

CREATE TABLE IF NOT EXISTS public.contest_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id TEXT NOT NULL REFERENCES public.contest_entries(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES public.contest_seasons(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pseudo_snapshot TEXT NOT NULL,
  consumption_method public.contest_consumption_method NOT NULL,
  consumption_details TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  status public.contest_review_status NOT NULL DEFAULT 'pending',
  admin_note TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contest_reviews_unique_entry_customer UNIQUE (entry_id, customer_id),
  CHECK (char_length(trim(pseudo_snapshot)) BETWEEN 3 AND 24),
  CHECK (char_length(consumption_details) <= 120),
  CHECK (char_length(comment) <= 2000),
  CHECK (char_length(admin_note) <= 500)
);

DROP TRIGGER IF EXISTS trg_touch_contest_reviews_updated_at ON public.contest_reviews;
CREATE TRIGGER trg_touch_contest_reviews_updated_at
BEFORE UPDATE ON public.contest_reviews
FOR EACH ROW
EXECUTE FUNCTION public.touch_contest_updated_at();

CREATE TABLE IF NOT EXISTS public.contest_review_scores (
  id BIGSERIAL PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.contest_reviews(id) ON DELETE CASCADE,
  criterion public.contest_score_criterion NOT NULL,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contest_review_scores_unique_review_criterion UNIQUE (review_id, criterion)
);

CREATE TABLE IF NOT EXISTS public.contest_review_aroma_tags (
  id BIGSERIAL PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.contest_reviews(id) ON DELETE CASCADE,
  tag public.contest_aroma_tag NOT NULL,
  custom_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contest_review_aroma_tags_unique_review_tag UNIQUE (review_id, tag),
  CHECK (
    (
      tag = 'other'
      AND custom_label IS NOT NULL
      AND char_length(trim(custom_label)) BETWEEN 2 AND 80
    ) OR (
      tag <> 'other'
      AND COALESCE(custom_label, '') = ''
    )
  )
);

CREATE TABLE IF NOT EXISTS public.contest_review_terpene_guesses (
  id BIGSERIAL PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.contest_reviews(id) ON DELETE CASCADE,
  terpene TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contest_review_terpene_guesses_unique_review_terpene UNIQUE (review_id, terpene),
  CHECK (char_length(trim(terpene)) BETWEEN 2 AND 80)
);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_contest_profiles_pseudo_unique
  ON public.contest_profiles (LOWER(pseudo));

CREATE INDEX IF NOT EXISTS idx_contest_seasons_active
  ON public.contest_seasons (is_active, is_archived, year DESC);

CREATE INDEX IF NOT EXISTS idx_contest_entries_season_category_position
  ON public.contest_entries (season_id, category, position, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contest_entries_published
  ON public.contest_entries (is_published, season_id, category);

CREATE INDEX IF NOT EXISTS idx_contest_reviews_entry_status_created
  ON public.contest_reviews (entry_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contest_reviews_customer_created
  ON public.contest_reviews (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contest_review_scores_review
  ON public.contest_review_scores (review_id);

CREATE INDEX IF NOT EXISTS idx_contest_review_aroma_tags_review
  ON public.contest_review_aroma_tags (review_id);

CREATE INDEX IF NOT EXISTS idx_contest_review_terpene_guesses_review
  ON public.contest_review_terpene_guesses (review_id);

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

ALTER TABLE public.contest_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_review_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_review_aroma_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_review_terpene_guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_tester_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_profile_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_reward_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contest_seasons_public_read ON public.contest_seasons;
CREATE POLICY contest_seasons_public_read
  ON public.contest_seasons
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS contest_entries_public_read ON public.contest_entries;
CREATE POLICY contest_entries_public_read
  ON public.contest_entries
  FOR SELECT
  TO authenticated, anon
  USING (is_published = true);

DROP POLICY IF EXISTS contest_profiles_user_read_own ON public.contest_profiles;
CREATE POLICY contest_profiles_user_read_own
  ON public.contest_profiles
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS contest_profiles_user_insert_own ON public.contest_profiles;
CREATE POLICY contest_profiles_user_insert_own
  ON public.contest_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS contest_profiles_user_update_own ON public.contest_profiles;
CREATE POLICY contest_profiles_user_update_own
  ON public.contest_profiles
  FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS contest_reviews_read_public_or_own ON public.contest_reviews;
CREATE POLICY contest_reviews_read_public_or_own
  ON public.contest_reviews
  FOR SELECT
  TO authenticated, anon
  USING (
    status = 'approved'
    OR (
      auth.role() = 'authenticated'
      AND customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS contest_reviews_user_insert_own ON public.contest_reviews;
CREATE POLICY contest_reviews_user_insert_own
  ON public.contest_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND char_length(comment) <= 2000
  );

DROP POLICY IF EXISTS contest_review_scores_read_public_or_own ON public.contest_review_scores;
CREATE POLICY contest_review_scores_read_public_or_own
  ON public.contest_review_scores
  FOR SELECT
  TO authenticated, anon
  USING (
    review_id IN (
      SELECT id
      FROM public.contest_reviews
      WHERE status = 'approved'
         OR (auth.role() = 'authenticated' AND customer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS contest_review_scores_user_insert_own ON public.contest_review_scores;
CREATE POLICY contest_review_scores_user_insert_own
  ON public.contest_review_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    review_id IN (
      SELECT id
      FROM public.contest_reviews
      WHERE customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS contest_review_aroma_tags_read_public_or_own ON public.contest_review_aroma_tags;
CREATE POLICY contest_review_aroma_tags_read_public_or_own
  ON public.contest_review_aroma_tags
  FOR SELECT
  TO authenticated, anon
  USING (
    review_id IN (
      SELECT id
      FROM public.contest_reviews
      WHERE status = 'approved'
         OR (auth.role() = 'authenticated' AND customer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS contest_review_aroma_tags_user_insert_own ON public.contest_review_aroma_tags;
CREATE POLICY contest_review_aroma_tags_user_insert_own
  ON public.contest_review_aroma_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    review_id IN (
      SELECT id
      FROM public.contest_reviews
      WHERE customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS contest_review_terpene_guesses_read_public_or_own ON public.contest_review_terpene_guesses;
CREATE POLICY contest_review_terpene_guesses_read_public_or_own
  ON public.contest_review_terpene_guesses
  FOR SELECT
  TO authenticated, anon
  USING (
    review_id IN (
      SELECT id
      FROM public.contest_reviews
      WHERE status = 'approved'
         OR (auth.role() = 'authenticated' AND customer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS contest_review_terpene_guesses_user_insert_own ON public.contest_review_terpene_guesses;
CREATE POLICY contest_review_terpene_guesses_user_insert_own
  ON public.contest_review_terpene_guesses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    review_id IN (
      SELECT id
      FROM public.contest_reviews
      WHERE customer_id = auth.uid()
    )
  );

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

DROP POLICY IF EXISTS contest_reviews_no_update ON public.contest_reviews;
CREATE POLICY contest_reviews_no_update
  ON public.contest_reviews
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS contest_reviews_no_delete ON public.contest_reviews;
CREATE POLICY contest_reviews_no_delete
  ON public.contest_reviews
  FOR DELETE
  TO authenticated, anon
  USING (false);

DROP POLICY IF EXISTS contest_review_scores_no_update ON public.contest_review_scores;
CREATE POLICY contest_review_scores_no_update
  ON public.contest_review_scores
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS contest_review_scores_no_delete ON public.contest_review_scores;
CREATE POLICY contest_review_scores_no_delete
  ON public.contest_review_scores
  FOR DELETE
  TO authenticated, anon
  USING (false);

DROP POLICY IF EXISTS contest_review_aroma_tags_no_update ON public.contest_review_aroma_tags;
CREATE POLICY contest_review_aroma_tags_no_update
  ON public.contest_review_aroma_tags
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS contest_review_terpene_guesses_no_update ON public.contest_review_terpene_guesses;
CREATE POLICY contest_review_terpene_guesses_no_update
  ON public.contest_review_terpene_guesses
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS contest_review_terpene_guesses_no_delete ON public.contest_review_terpene_guesses;
CREATE POLICY contest_review_terpene_guesses_no_delete
  ON public.contest_review_terpene_guesses
  FOR DELETE
  TO authenticated, anon
  USING (false);

DROP POLICY IF EXISTS contest_review_aroma_tags_no_delete ON public.contest_review_aroma_tags;
CREATE POLICY contest_review_aroma_tags_no_delete
  ON public.contest_review_aroma_tags
  FOR DELETE
  TO authenticated, anon
  USING (false);

CREATE OR REPLACE VIEW public.contest_entry_stats
WITH (security_invoker = true) AS
WITH approved_reviews AS (
  SELECT
    r.id,
    r.entry_id,
    r.season_id,
    e.category,
    r.consumption_method
  FROM public.contest_reviews r
  INNER JOIN public.contest_entries e ON e.id = r.entry_id
  WHERE r.status = 'approved'
),
score_aggregates AS (
  SELECT
    ar.entry_id,
    ar.season_id,
    ar.category,
    COUNT(DISTINCT ar.id) AS approved_review_count,
    ROUND(AVG(s.score::numeric), 2) AS average_score,
    ROUND(AVG(s.score::numeric) FILTER (WHERE s.criterion = 'appearance'), 2) AS appearance_avg,
    ROUND(AVG(s.score::numeric) FILTER (WHERE s.criterion = 'manicure'), 2) AS manicure_avg,
    ROUND(AVG(s.score::numeric) FILTER (WHERE s.criterion = 'drying_curing'), 2) AS drying_curing_avg,
    ROUND(AVG(s.score::numeric) FILTER (WHERE s.criterion = 'cold_aroma'), 2) AS cold_aroma_avg,
    ROUND(AVG(s.score::numeric) FILTER (WHERE s.criterion = 'aroma_intensity'), 2) AS aroma_intensity_avg,
    ROUND(AVG(s.score::numeric) FILTER (WHERE s.criterion = 'aroma_complexity'), 2) AS aroma_complexity_avg,
    ROUND(AVG(s.score::numeric) FILTER (WHERE s.criterion = 'flavor'), 2) AS flavor_avg,
    ROUND(AVG(s.score::numeric) FILTER (WHERE s.criterion = 'smoothness_burn'), 2) AS smoothness_burn_avg,
    ROUND(AVG(s.score::numeric) FILTER (WHERE s.criterion = 'persistence'), 2) AS persistence_avg,
    ROUND(AVG(s.score::numeric) FILTER (WHERE s.criterion = 'overall_impression'), 2) AS overall_impression_avg,
    COUNT(DISTINCT ar.id) FILTER (WHERE ar.consumption_method = 'vaporizer') AS vaporizer_review_count,
    COUNT(DISTINCT ar.id) FILTER (WHERE ar.consumption_method = 'joint_no_tobacco') AS joint_no_tobacco_review_count,
    COUNT(DISTINCT ar.id) FILTER (WHERE ar.consumption_method = 'joint_with_tobacco') AS joint_with_tobacco_review_count,
    COUNT(DISTINCT ar.id) FILTER (WHERE ar.consumption_method = 'water_pipe') AS water_pipe_review_count,
    COUNT(DISTINCT ar.id) FILTER (WHERE ar.consumption_method = 'other') AS other_review_count
  FROM approved_reviews ar
  INNER JOIN public.contest_review_scores s ON s.review_id = ar.id
  GROUP BY ar.entry_id, ar.season_id, ar.category
)
SELECT
  e.id AS entry_id,
  e.season_id,
  e.category,
  COALESCE(sa.approved_review_count, 0) AS approved_review_count,
  COALESCE(sa.average_score, 0) AS average_score,
  sa.appearance_avg,
  sa.manicure_avg,
  sa.drying_curing_avg,
  sa.cold_aroma_avg,
  sa.aroma_intensity_avg,
  sa.aroma_complexity_avg,
  sa.flavor_avg,
  sa.smoothness_burn_avg,
  sa.persistence_avg,
  sa.overall_impression_avg,
  COALESCE(sa.vaporizer_review_count, 0) AS vaporizer_review_count,
  COALESCE(sa.joint_no_tobacco_review_count, 0) AS joint_no_tobacco_review_count,
  COALESCE(sa.joint_with_tobacco_review_count, 0) AS joint_with_tobacco_review_count,
  COALESCE(sa.water_pipe_review_count, 0) AS water_pipe_review_count,
  COALESCE(sa.other_review_count, 0) AS other_review_count
FROM public.contest_entries e
LEFT JOIN score_aggregates sa ON sa.entry_id = e.id;

CREATE OR REPLACE VIEW public.contest_rankings_current
WITH (security_invoker = true) AS
WITH stats AS (
  SELECT *
  FROM public.contest_entry_stats
  WHERE approved_review_count > 0
),
season_baselines AS (
  SELECT
    season_id,
    ROUND(AVG(average_score), 2) AS season_baseline_score
  FROM stats
  GROUP BY season_id
),
smoothed AS (
  SELECT
    s.entry_id,
    s.season_id,
    s.category,
    s.approved_review_count,
    s.average_score,
    COALESCE(sb.season_baseline_score, s.average_score, 7.0) AS season_baseline_score,
    ROUND(
      (
        (s.approved_review_count::numeric / (s.approved_review_count::numeric + 5)) * s.average_score
      ) + (
        (5::numeric / (s.approved_review_count::numeric + 5)) * COALESCE(sb.season_baseline_score, s.average_score, 7.0)
      ),
      2
    ) AS smoothed_score,
    (s.approved_review_count >= 5) AS is_rank_eligible
  FROM stats s
  LEFT JOIN season_baselines sb ON sb.season_id = s.season_id
),
ranked AS (
  SELECT
    sm.*,
    RANK() OVER (
      PARTITION BY sm.season_id
      ORDER BY sm.smoothed_score DESC, sm.approved_review_count DESC, sm.entry_id ASC
    ) AS season_rank_overall,
    RANK() OVER (
      PARTITION BY sm.season_id, sm.category
      ORDER BY sm.smoothed_score DESC, sm.approved_review_count DESC, sm.entry_id ASC
    ) AS season_category_rank
  FROM smoothed sm
)
SELECT *
FROM ranked;

COMMIT;
