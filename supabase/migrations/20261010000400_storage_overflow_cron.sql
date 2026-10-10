BEGIN;

-- A persistent database role must own the job, not a temporary CLI login.
SET LOCAL ROLE postgres;

-- Run in PostgreSQL even when no player is connected. Purchases and reads also
-- settle overdue lots, so an action cannot extend the real 24-hour deadline.
-- Supabase Cron: https://supabase.com/docs/guides/cron/quickstart
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;

-- A named schedule is updated rather than duplicated on repeated provisioning.
-- The bounded worker locks each player's account and keeps a sale receipt.
SELECT cron.schedule(
  'kq-storage-overflow-sales',
  '*/5 * * * *',
  'SELECT public.rpc_kq_storage_settle_due(100);'
);

COMMIT;
