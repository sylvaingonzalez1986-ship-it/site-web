BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- The shop's cultivation category is authoritative for the active catalogue.
-- Preserve entry identities, reviews, drafts and archived seasons.
UPDATE public.contest_entries e
SET category = p.culture_type::public.contest_entry_category,
    updated_at = now()
FROM public.products p, public.contest_seasons season
WHERE e.product_id = p.id AND e.season_id = season.id
  AND e.is_published AND season.is_active AND NOT season.is_archived
  AND p.category = 'fleurs'
  AND p.culture_type IN ('outdoor', 'greenhouse', 'indoor')
  AND e.category::text IS DISTINCT FROM p.culture_type;

-- Every published, rated flower participates from its first approved review.
-- Unrated flowers remain in the catalogue without a fabricated score or rank.
CREATE OR REPLACE VIEW public.contest_rankings_current
WITH (security_invoker = true) AS
WITH stats AS (
  SELECT s.*
  FROM public.contest_entry_stats s
  JOIN public.contest_entries e ON e.id = s.entry_id
  WHERE e.is_published AND s.approved_review_count > 0
),
season_baselines AS (
  SELECT season_id, track, ROUND(AVG(average_score), 2) AS season_baseline_score
  FROM stats
  GROUP BY season_id, track
),
smoothed AS (
  SELECT s.entry_id, s.season_id, s.category, s.track,
    s.approved_review_count, s.average_score,
    sb.season_baseline_score,
    ROUND(
      (s.approved_review_count::numeric / (s.approved_review_count::numeric + 5)) * s.average_score
      + (5::numeric / (s.approved_review_count::numeric + 5)) * sb.season_baseline_score,
      2
    ) AS smoothed_score,
    true AS is_rank_eligible
  FROM stats s
  JOIN season_baselines sb ON sb.season_id = s.season_id AND sb.track = s.track
)
SELECT sm.*,
  RANK() OVER (
    PARTITION BY sm.season_id
    ORDER BY sm.smoothed_score DESC, sm.approved_review_count DESC, sm.entry_id ASC
  ) AS season_rank_overall,
  RANK() OVER (
    PARTITION BY sm.season_id, sm.category
    ORDER BY sm.smoothed_score DESC, sm.approved_review_count DESC, sm.entry_id ASC
  ) AS season_category_rank
FROM smoothed sm;

REVOKE ALL ON TABLE public.contest_rankings_current FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.contest_rankings_current TO service_role;

COMMIT;
