BEGIN;

DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT con.conname
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'contest_review_scores'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%score%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.contest_review_scores DROP CONSTRAINT IF EXISTS %I',
      constraint_record.conname
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.contest_review_scores WHERE score BETWEEN 1 AND 10)
     AND NOT EXISTS (SELECT 1 FROM public.contest_review_scores WHERE score > 10) THEN
    UPDATE public.contest_review_scores
    SET score = score * 10;
  END IF;
END $$;

UPDATE public.contest_review_scores scores
SET score = scores.score * 10
FROM public.contest_reviews reviews
WHERE reviews.id = scores.review_id
  AND reviews.status = 'approved'
  AND scores.score BETWEEN 1 AND 10;

ALTER TABLE public.contest_review_scores
  ADD CONSTRAINT contest_review_scores_score_1_100_chk CHECK (score BETWEEN 1 AND 100);

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
