BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contest_entry_track') THEN
    CREATE TYPE public.contest_entry_track AS ENUM ('regular', 'concours');
  END IF;
END
$$;

ALTER TABLE public.contest_entries
  ADD COLUMN IF NOT EXISTS track public.contest_entry_track NOT NULL DEFAULT 'regular';

UPDATE public.contest_entries
SET track = 'regular'
WHERE track IS NULL;

CREATE INDEX IF NOT EXISTS idx_contest_entries_published_track
  ON public.contest_entries (is_published, season_id, track, category);

CREATE INDEX IF NOT EXISTS idx_contest_entries_season_track_position
  ON public.contest_entries (season_id, track, position, created_at DESC);

DROP VIEW IF EXISTS public.contest_rankings_current;
DROP VIEW IF EXISTS public.contest_entry_stats;

CREATE OR REPLACE VIEW public.contest_entry_stats
WITH (security_invoker = true) AS
WITH approved_reviews AS (
  SELECT
    r.id,
    r.entry_id,
    r.season_id,
    e.category,
    e.track,
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
    ar.track,
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
  GROUP BY ar.entry_id, ar.season_id, ar.category, ar.track
)
SELECT
  e.id AS entry_id,
  e.season_id,
  e.category,
  e.track,
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
    track,
    ROUND(AVG(average_score), 2) AS season_baseline_score
  FROM stats
  GROUP BY season_id, track
),
smoothed AS (
  SELECT
    s.entry_id,
    s.season_id,
    s.category,
    s.track,
    s.approved_review_count,
    s.average_score,
    COALESCE(sb.season_baseline_score, s.average_score, 70.0) AS season_baseline_score,
    ROUND(
      (
        (s.approved_review_count::numeric / (s.approved_review_count::numeric + 5)) * s.average_score
      ) + (
        (5::numeric / (s.approved_review_count::numeric + 5)) * COALESCE(sb.season_baseline_score, s.average_score, 70.0)
      ),
      2
    ) AS smoothed_score,
    (s.approved_review_count >= 5) AS is_rank_eligible
  FROM stats s
  LEFT JOIN season_baselines sb ON sb.season_id = s.season_id AND sb.track = s.track
),
ranked AS (
  SELECT
    sm.*,
    RANK() OVER (
      PARTITION BY sm.season_id, sm.track
      ORDER BY sm.smoothed_score DESC, sm.approved_review_count DESC, sm.entry_id ASC
    ) AS season_rank_overall,
    RANK() OVER (
      PARTITION BY sm.season_id, sm.track, sm.category
      ORDER BY sm.smoothed_score DESC, sm.approved_review_count DESC, sm.entry_id ASC
    ) AS season_category_rank
  FROM smoothed sm
)
SELECT *
FROM ranked;

COMMIT;
