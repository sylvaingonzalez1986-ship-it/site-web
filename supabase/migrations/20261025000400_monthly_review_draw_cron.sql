BEGIN;

-- A persistent database role owns the schedule across CLI deployments.
SET LOCAL ROLE postgres;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;

-- pg_cron uses UTC here. 03:00 UTC is always the same calendar day in Paris,
-- including daylight-saving changes. The worker only settles completed months:
-- the first day draws; subsequent daily runs recover a missed invocation.
SELECT cron.schedule(
  'monthly-review-draw',
  '0 3 * * *',
  'SELECT public.rpc_settle_monthly_review_draws();'
);

COMMIT;
