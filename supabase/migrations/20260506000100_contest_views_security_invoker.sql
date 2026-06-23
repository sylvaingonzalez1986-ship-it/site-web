BEGIN;

ALTER VIEW IF EXISTS public.contest_entry_stats
  SET (security_invoker = true);

ALTER VIEW IF EXISTS public.contest_rankings_current
  SET (security_invoker = true);

COMMIT;
