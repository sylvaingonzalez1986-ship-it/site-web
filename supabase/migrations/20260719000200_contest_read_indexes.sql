DO $indexes$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contest_reviews_feed ON public.contest_reviews (entry_id, status, reviewed_at, created_at) WHERE status = ''approved'' AND comment <> ''''';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contest_reviews_season_customer_status ON public.contest_reviews (season_id, customer_id, status)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contest_points_customer_season_reason ON public.contest_tester_points (customer_id, season_id, reason)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contest_votes_review_value ON public.contest_review_votes (review_id, value)';
END
$indexes$;
