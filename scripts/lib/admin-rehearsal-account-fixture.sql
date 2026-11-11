-- LOCAL FIXTURE ONLY. Not a production migration.
-- Intended instance: project_id admin-access-rehearsal, API 127.0.0.1:55321,
-- database 127.0.0.1:55322. The caller must enforce that destination before use.
-- Prerequisites: real local Supabase Auth schema/users/uid() and native API roles.
-- This file neither creates Auth users nor substitutes any authentication logic.
--
-- Provenance (source SQL extracted, with public qualification on the two CREATEs):
--   20260215_0001_init.sql: profiles + promo_codes CREATE TABLE definitions.
--   20260225000400_referral_program.sql: profile additions, backfill, constraints
--     and indexes only; stop before referral_rewards and all referral RPCs.
--   20260302001200_loyalty_pack_purchase.sql: profile points-spent column/check
--     only; omit lottery purchase RPC and all lottery dependencies.
--   RLS read predicates come from 20260215_0001_init.sql. The obsolete profile
--     update policy is removed as in 20261110000200_security_data_api_boundaries.sql.
-- ACLs below intentionally select only the server operations needed by the real
-- loginSupabaseCustomer -> ensureProfileRow/loadPromoCodes path. They are a
-- narrower subset of the production named service grants, not a site-wide replay.
--
-- contest_beta_testers is intentionally absent: the real
-- loadContestBetaTesterEnabled handles missing relation/schema-cache as false.
-- No orders, referral rewards, lottery tables, or game schema are installed.

BEGIN;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  date_of_birth DATE,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'France',
  notes TEXT NOT NULL DEFAULT '',
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id BIGSERIAL PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code ~ '^[A-Z0-9_-]{4,24}$'),
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 80),
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ,
  UNIQUE (customer_id, code)
);

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referred_by_code TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_bound_at TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_rewarded_at TIMESTAMPTZ;

UPDATE public.profiles
SET referral_code = UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 10))
WHERE referral_code IS NULL
   OR BTRIM(referral_code) = '';

ALTER TABLE public.profiles
ALTER COLUMN referral_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_referral_code_format'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_referral_code_format
    CHECK (referral_code ~ '^[A-Z0-9]{6,16}$');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_referred_by_not_self'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_referred_by_not_self
    CHECK (referred_by IS NULL OR referred_by <> id);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code_unique
ON public.profiles (referral_code);

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by
ON public.profiles (referred_by);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS loyalty_points_spent INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_loyalty_points_spent_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_loyalty_points_spent_check
  CHECK (loyalty_points_spent >= 0);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_user_read_own ON public.profiles;
CREATE POLICY profiles_user_read_own ON public.profiles
  FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS profiles_user_update_own ON public.profiles;

DROP POLICY IF EXISTS promo_codes_user_read_own ON public.promo_codes;
CREATE POLICY promo_codes_user_read_own ON public.promo_codes
  FOR SELECT USING (customer_id = auth.uid());

-- Deny direct client access regardless of fresh-project default grants.
REVOKE ALL ON TABLE public.profiles, public.promo_codes
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.profiles TO service_role;
GRANT SELECT ON TABLE public.promo_codes TO service_role;

-- No service-role promo insert is exercised, so sequence USAGE is not granted.
REVOKE ALL ON SEQUENCE public.promo_codes_id_seq
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;

