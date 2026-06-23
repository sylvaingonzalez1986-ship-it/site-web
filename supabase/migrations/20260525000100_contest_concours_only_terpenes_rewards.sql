BEGIN;

DELETE FROM public.contest_review_terpene_guesses guesses
USING public.contest_reviews reviews
INNER JOIN public.contest_entries entries ON entries.id = reviews.entry_id
WHERE guesses.review_id = reviews.id
  AND entries.track <> 'concours';

DELETE FROM public.contest_tester_points points
USING public.contest_reviews reviews
INNER JOIN public.contest_entries entries ON entries.id = reviews.entry_id
WHERE points.review_id = reviews.id
  AND entries.track <> 'concours';

DELETE FROM public.contest_profile_badges badges
USING public.contest_reviews reviews
INNER JOIN public.contest_entries entries ON entries.id = reviews.entry_id
WHERE badges.review_id = reviews.id
  AND badges.reward_claimed_at IS NULL
  AND entries.track <> 'concours';

CREATE OR REPLACE FUNCTION public.contest_review_terpene_guesses_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_track public.contest_entry_track;
BEGIN
  SELECT entries.track
  INTO v_track
  FROM public.contest_reviews reviews
  INNER JOIN public.contest_entries entries ON entries.id = reviews.entry_id
  WHERE reviews.id = NEW.review_id;

  IF v_track IS DISTINCT FROM 'concours'::public.contest_entry_track THEN
    RAISE EXCEPTION 'contest_terpene_guess_requires_concours_entry';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contest_review_terpene_guesses_guard
  ON public.contest_review_terpene_guesses;

CREATE TRIGGER trg_contest_review_terpene_guesses_guard
BEFORE INSERT OR UPDATE ON public.contest_review_terpene_guesses
FOR EACH ROW
EXECUTE FUNCTION public.contest_review_terpene_guesses_guard();

CREATE OR REPLACE FUNCTION public.contest_tester_points_review_track_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_track public.contest_entry_track;
BEGIN
  IF NEW.review_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT entries.track
  INTO v_track
  FROM public.contest_reviews reviews
  INNER JOIN public.contest_entries entries ON entries.id = reviews.entry_id
  WHERE reviews.id = NEW.review_id;

  IF v_track IS DISTINCT FROM 'concours'::public.contest_entry_track THEN
    RAISE EXCEPTION 'contest_tester_points_require_concours_entry';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contest_tester_points_review_track_guard
  ON public.contest_tester_points;

CREATE TRIGGER trg_contest_tester_points_review_track_guard
BEFORE INSERT OR UPDATE ON public.contest_tester_points
FOR EACH ROW
EXECUTE FUNCTION public.contest_tester_points_review_track_guard();

CREATE OR REPLACE VIEW public.contest_tester_rankings_global
WITH (security_invoker = true) AS
WITH concours_reviews AS (
  SELECT reviews.*
  FROM public.contest_reviews reviews
  INNER JOIN public.contest_entries entries ON entries.id = reviews.entry_id
  WHERE entries.track = 'concours'
),
review_stats AS (
  SELECT
    customer_id,
    COUNT(*) FILTER (WHERE status = 'approved')::integer AS approved_review_count,
    MAX(COALESCE(reviewed_at, created_at)) FILTER (WHERE status = 'approved') AS latest_approved_at
  FROM concours_reviews
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
  FROM concours_reviews reviews
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
concours_reviews AS (
  SELECT reviews.*
  FROM public.contest_reviews reviews
  INNER JOIN public.contest_entries entries ON entries.id = reviews.entry_id
  WHERE entries.track = 'concours'
),
review_stats AS (
  SELECT
    customer_id,
    season_id,
    COUNT(*) FILTER (WHERE status = 'approved')::integer AS approved_review_count,
    MAX(COALESCE(reviewed_at, created_at)) FILTER (WHERE status = 'approved') AS latest_approved_at
  FROM concours_reviews
  GROUP BY customer_id, season_id
),
vote_stats AS (
  SELECT
    reviews.customer_id,
    reviews.season_id,
    COALESCE(SUM(summary.upvote_count), 0)::integer AS upvote_count,
    COALESCE(SUM(summary.downvote_count), 0)::integer AS downvote_count,
    COALESCE(SUM(summary.net_vote_score), 0)::integer AS net_vote_score
  FROM concours_reviews reviews
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
