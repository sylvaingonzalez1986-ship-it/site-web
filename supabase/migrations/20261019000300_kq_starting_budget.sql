BEGIN;

-- New equipment wallets start with EUR 1,000. Existing balances, free starter
-- equipment and the one-time EUR 650 Treasurer bonus remain unchanged.
-- All wallet initialization paths omit cash_cents and use this table default.
ALTER TABLE public.kq_equipment_wallets
  ALTER COLUMN cash_cents SET DEFAULT 100000;

COMMIT;
