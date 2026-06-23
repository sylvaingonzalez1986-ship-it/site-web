BEGIN;

ALTER TABLE public.contest_reviews
  ADD COLUMN IF NOT EXISTS quality_mark TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contest_reviews_quality_mark_chk'
      AND conrelid = 'public.contest_reviews'::regclass
  ) THEN
    ALTER TABLE public.contest_reviews
      ADD CONSTRAINT contest_reviews_quality_mark_chk
      CHECK (quality_mark IN ('', 'useful', 'excellent'));
  END IF;
END
$$;

ALTER TABLE public.contest_tester_points
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contest_tester_points_source_key_length_chk'
      AND conrelid = 'public.contest_tester_points'::regclass
  ) THEN
    ALTER TABLE public.contest_tester_points
      ADD CONSTRAINT contest_tester_points_source_key_length_chk
      CHECK (source_key IS NULL OR char_length(trim(source_key)) BETWEEN 6 AND 160);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contest_tester_points_metadata_object_chk'
      AND conrelid = 'public.contest_tester_points'::regclass
  ) THEN
    ALTER TABLE public.contest_tester_points
      ADD CONSTRAINT contest_tester_points_metadata_object_chk
      CHECK (jsonb_typeof(metadata) = 'object');
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contest_tester_points_source_key_unique
  ON public.contest_tester_points (source_key);

CREATE INDEX IF NOT EXISTS idx_contest_tester_points_season_created
  ON public.contest_tester_points (season_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.contest_review_votes (
  id BIGSERIAL PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.contest_reviews(id) ON DELETE CASCADE,
  voter_customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contest_review_votes_unique_review_voter UNIQUE (review_id, voter_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_review_votes_review
  ON public.contest_review_votes (review_id);

CREATE INDEX IF NOT EXISTS idx_contest_review_votes_voter
  ON public.contest_review_votes (voter_customer_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.contest_review_votes_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review record;
  v_voter_email TEXT;
BEGIN
  SELECT id, customer_id, status
  INTO v_review
  FROM public.contest_reviews
  WHERE id = NEW.review_id;

  IF v_review.id IS NULL THEN
    RAISE EXCEPTION 'contest_review_vote_invalid_review';
  END IF;

  IF v_review.status <> 'approved' THEN
    RAISE EXCEPTION 'contest_review_vote_review_not_approved';
  END IF;

  IF v_review.customer_id = NEW.voter_customer_id THEN
    RAISE EXCEPTION 'contest_review_vote_own_review';
  END IF;

  SELECT LOWER(email)
  INTO v_voter_email
  FROM auth.users
  WHERE id = NEW.voter_customer_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders orders
    WHERE orders.payment_state IN ('paid', 'not_configured')
      AND orders.status <> 'cancelled'
      AND (
        orders.customer_id = NEW.voter_customer_id
        OR (
          orders.customer_id IS NULL
          AND v_voter_email IS NOT NULL
          AND LOWER(COALESCE(orders.customer_email, '')) = v_voter_email
        )
      )
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'contest_review_vote_purchase_required';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contest_review_votes_guard ON public.contest_review_votes;
CREATE TRIGGER trg_contest_review_votes_guard
BEFORE INSERT OR UPDATE ON public.contest_review_votes
FOR EACH ROW
EXECUTE FUNCTION public.contest_review_votes_guard();

ALTER TABLE public.contest_review_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contest_review_votes_user_read_own ON public.contest_review_votes;
CREATE POLICY contest_review_votes_user_read_own
  ON public.contest_review_votes
  FOR SELECT
  TO authenticated
  USING (voter_customer_id = auth.uid());

DROP POLICY IF EXISTS contest_review_votes_user_insert_own ON public.contest_review_votes;
CREATE POLICY contest_review_votes_user_insert_own
  ON public.contest_review_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (voter_customer_id = auth.uid());

DROP POLICY IF EXISTS contest_review_votes_user_update_own ON public.contest_review_votes;
CREATE POLICY contest_review_votes_user_update_own
  ON public.contest_review_votes
  FOR UPDATE
  TO authenticated
  USING (voter_customer_id = auth.uid())
  WITH CHECK (voter_customer_id = auth.uid());

DROP POLICY IF EXISTS contest_review_votes_no_delete ON public.contest_review_votes;
CREATE POLICY contest_review_votes_no_delete
  ON public.contest_review_votes
  FOR DELETE
  TO authenticated, anon
  USING (false);

CREATE OR REPLACE VIEW public.contest_review_vote_summary
WITH (security_invoker = true) AS
SELECT
  reviews.id AS review_id,
  COUNT(votes.id) FILTER (WHERE votes.value = 1)::integer AS upvote_count,
  COUNT(votes.id) FILTER (WHERE votes.value = -1)::integer AS downvote_count,
  COALESCE(SUM(votes.value), 0)::integer AS net_vote_score,
  (
    COUNT(votes.id) FILTER (WHERE votes.value = -1) >= 3
    OR (
      COUNT(votes.id) >= 5
      AND (
        COUNT(votes.id) FILTER (WHERE votes.value = -1)
      )::numeric / NULLIF(COUNT(votes.id), 0) >= 0.40
    )
  ) AS is_contested
FROM public.contest_reviews reviews
LEFT JOIN public.contest_review_votes votes ON votes.review_id = reviews.id
WHERE reviews.status = 'approved'
GROUP BY reviews.id;

CREATE OR REPLACE VIEW public.contest_tester_points_summary
WITH (security_invoker = true) AS
SELECT
  profiles.customer_id,
  profiles.pseudo,
  COALESCE(SUM(points.points), 0)::integer AS total_points,
  COALESCE(SUM(points.points) FILTER (WHERE points.reason = 'review_approved'), 0)::integer AS review_points,
  COALESCE(SUM(points.points) FILTER (WHERE points.reason = 'terpene_match'), 0)::integer AS terpene_points,
  COALESCE(SUM(points.points) FILTER (WHERE points.reason = 'review_upvote_received'), 0)::integer AS upvote_points,
  COALESCE(SUM(points.points) FILTER (WHERE points.reason = 'review_downvote_received'), 0)::integer AS downvote_points,
  COALESCE(SUM(points.points) FILTER (WHERE points.reason LIKE 'admin_quality_%'), 0)::integer AS admin_quality_points,
  MAX(points.created_at) AS latest_point_at
FROM public.contest_profiles profiles
LEFT JOIN public.contest_tester_points points ON points.customer_id = profiles.customer_id
GROUP BY profiles.customer_id, profiles.pseudo;

CREATE OR REPLACE VIEW public.contest_tester_rankings_global
WITH (security_invoker = true) AS
WITH review_stats AS (
  SELECT
    customer_id,
    COUNT(*) FILTER (WHERE status = 'approved')::integer AS approved_review_count,
    MAX(COALESCE(reviewed_at, created_at)) FILTER (WHERE status = 'approved') AS latest_approved_at
  FROM public.contest_reviews
  GROUP BY customer_id
),
terpene_stats AS (
  SELECT
    customer_id,
    COUNT(*) FILTER (WHERE reason = 'terpene_match')::integer AS correct_terpene_count
  FROM public.contest_tester_points
  GROUP BY customer_id
),
vote_stats AS (
  SELECT
    reviews.customer_id,
    COALESCE(SUM(summary.upvote_count), 0)::integer AS upvote_count,
    COALESCE(SUM(summary.downvote_count), 0)::integer AS downvote_count,
    COALESCE(SUM(summary.net_vote_score), 0)::integer AS net_vote_score
  FROM public.contest_reviews reviews
  LEFT JOIN public.contest_review_vote_summary summary ON summary.review_id = reviews.id
  WHERE reviews.status = 'approved'
  GROUP BY reviews.customer_id
),
ranked AS (
  SELECT
    summary.customer_id,
    summary.pseudo,
    summary.total_points,
    COALESCE(review_stats.approved_review_count, 0) AS approved_review_count,
    COALESCE(terpene_stats.correct_terpene_count, 0) AS correct_terpene_count,
    COALESCE(vote_stats.upvote_count, 0) AS upvote_count,
    COALESCE(vote_stats.downvote_count, 0) AS downvote_count,
    COALESCE(vote_stats.net_vote_score, 0) AS net_vote_score,
    review_stats.latest_approved_at
  FROM public.contest_tester_points_summary summary
  LEFT JOIN review_stats ON review_stats.customer_id = summary.customer_id
  LEFT JOIN terpene_stats ON terpene_stats.customer_id = summary.customer_id
  LEFT JOIN vote_stats ON vote_stats.customer_id = summary.customer_id
)
SELECT
  *,
  (RANK() OVER (
    ORDER BY
      total_points DESC,
      approved_review_count DESC,
      correct_terpene_count DESC,
      net_vote_score DESC,
      latest_approved_at DESC NULLS LAST,
      pseudo ASC
  ))::integer AS global_rank
FROM ranked;

CREATE OR REPLACE VIEW public.contest_tester_rankings_by_season
WITH (security_invoker = true) AS
WITH point_summary AS (
  SELECT
    profiles.customer_id,
    profiles.pseudo,
    points.season_id,
    COALESCE(SUM(points.points), 0)::integer AS season_points,
    COUNT(*) FILTER (WHERE points.reason = 'terpene_match')::integer AS correct_terpene_count,
    MAX(points.created_at) AS latest_point_at
  FROM public.contest_profiles profiles
  INNER JOIN public.contest_tester_points points ON points.customer_id = profiles.customer_id
  WHERE points.season_id IS NOT NULL
  GROUP BY profiles.customer_id, profiles.pseudo, points.season_id
),
review_stats AS (
  SELECT
    customer_id,
    season_id,
    COUNT(*) FILTER (WHERE status = 'approved')::integer AS approved_review_count,
    MAX(COALESCE(reviewed_at, created_at)) FILTER (WHERE status = 'approved') AS latest_approved_at
  FROM public.contest_reviews
  GROUP BY customer_id, season_id
),
vote_stats AS (
  SELECT
    reviews.customer_id,
    reviews.season_id,
    COALESCE(SUM(summary.upvote_count), 0)::integer AS upvote_count,
    COALESCE(SUM(summary.downvote_count), 0)::integer AS downvote_count,
    COALESCE(SUM(summary.net_vote_score), 0)::integer AS net_vote_score
  FROM public.contest_reviews reviews
  LEFT JOIN public.contest_review_vote_summary summary ON summary.review_id = reviews.id
  WHERE reviews.status = 'approved'
  GROUP BY reviews.customer_id, reviews.season_id
),
ranked AS (
  SELECT
    point_summary.customer_id,
    point_summary.pseudo,
    point_summary.season_id,
    point_summary.season_points,
    COALESCE(review_stats.approved_review_count, 0) AS approved_review_count,
    COALESCE(point_summary.correct_terpene_count, 0) AS correct_terpene_count,
    COALESCE(vote_stats.upvote_count, 0) AS upvote_count,
    COALESCE(vote_stats.downvote_count, 0) AS downvote_count,
    COALESCE(vote_stats.net_vote_score, 0) AS net_vote_score,
    review_stats.latest_approved_at
  FROM point_summary
  LEFT JOIN review_stats ON review_stats.customer_id = point_summary.customer_id
    AND review_stats.season_id = point_summary.season_id
  LEFT JOIN vote_stats ON vote_stats.customer_id = point_summary.customer_id
    AND vote_stats.season_id = point_summary.season_id
)
SELECT
  *,
  (RANK() OVER (
    PARTITION BY season_id
    ORDER BY
      season_points DESC,
      approved_review_count DESC,
      correct_terpene_count DESC,
      net_vote_score DESC,
      latest_approved_at DESC NULLS LAST,
      pseudo ASC
  ))::integer AS season_rank
FROM ranked;

COMMIT;
