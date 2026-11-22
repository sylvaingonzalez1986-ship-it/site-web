BEGIN;

-- Every first wallet insert uses this default, including profile and reward RPCs.
ALTER TABLE public.kq_equipment_wallets
  ALTER COLUMN cash_cents SET DEFAULT 200000;

COMMIT;
