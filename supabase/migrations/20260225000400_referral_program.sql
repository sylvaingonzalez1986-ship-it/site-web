BEGIN;

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

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id BIGSERIAL PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  referrer_points INTEGER NOT NULL CHECK (referrer_points >= 0 AND referrer_points <= 100000),
  referee_points INTEGER NOT NULL CHECK (referee_points >= 0 AND referee_points <= 100000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer_created
ON public.referral_rewards (referrer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referee
ON public.referral_rewards (referee_id);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_rewards_user_read_own ON public.referral_rewards;
CREATE POLICY referral_rewards_user_read_own
ON public.referral_rewards
FOR SELECT
TO authenticated
USING (referrer_id = auth.uid() OR referee_id = auth.uid());

CREATE OR REPLACE FUNCTION public.rpc_bind_referral_code(
  p_referee_id UUID,
  p_referral_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_referrer_id UUID;
  v_referred_by UUID;
BEGIN
  IF p_referee_id IS NULL THEN
    RAISE EXCEPTION 'invalid_referee';
  END IF;

  v_code := UPPER(REGEXP_REPLACE(COALESCE(p_referral_code, ''), '[^A-Z0-9]', '', 'g'));
  IF LENGTH(v_code) < 6 OR LENGTH(v_code) > 16 THEN
    RAISE EXCEPTION 'referral_code_invalid';
  END IF;

  SELECT referred_by
  INTO v_referred_by
  FROM public.profiles
  WHERE id = p_referee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'referee_not_found';
  END IF;

  IF v_referred_by IS NOT NULL THEN
    RAISE EXCEPTION 'referral_already_bound';
  END IF;

  SELECT id
  INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = v_code;

  IF v_referrer_id IS NULL THEN
    RAISE EXCEPTION 'referral_code_not_found';
  END IF;

  IF v_referrer_id = p_referee_id THEN
    RAISE EXCEPTION 'self_referral_forbidden';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orders
    WHERE customer_id = p_referee_id
      AND payment_state IN ('paid', 'not_configured')
  ) THEN
    RAISE EXCEPTION 'referral_too_late';
  END IF;

  UPDATE public.profiles
  SET
    referred_by = v_referrer_id,
    referred_by_code = v_code,
    referral_bound_at = now()
  WHERE id = p_referee_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_apply_referral_reward_on_paid_order(
  p_order_id TEXT,
  p_referrer_points INTEGER,
  p_referee_points INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_referrer_id UUID;
  v_inserted_id BIGINT;
BEGIN
  IF p_order_id IS NULL OR BTRIM(p_order_id) = '' THEN
    RETURN FALSE;
  END IF;

  IF p_referrer_points IS NULL OR p_referee_points IS NULL OR p_referrer_points < 0 OR p_referee_points < 0 THEN
    RAISE EXCEPTION 'invalid_referral_points';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_order.customer_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_order.payment_state NOT IN ('paid', 'not_configured') THEN
    RETURN FALSE;
  END IF;

  SELECT referred_by
  INTO v_referrer_id
  FROM public.profiles
  WHERE id = v_order.customer_id
  FOR UPDATE;

  IF v_referrer_id IS NULL OR v_referrer_id = v_order.customer_id THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.referral_rewards (
    referrer_id,
    referee_id,
    order_id,
    referrer_points,
    referee_points
  )
  VALUES (
    v_referrer_id,
    v_order.customer_id,
    v_order.id,
    p_referrer_points,
    p_referee_points
  )
  ON CONFLICT (referee_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
  SET loyalty_points = loyalty_points + p_referrer_points
  WHERE id = v_referrer_id;

  UPDATE public.profiles
  SET
    loyalty_points = loyalty_points + p_referee_points,
    referral_rewarded_at = now()
  WHERE id = v_order.customer_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_bind_referral_code(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_apply_referral_reward_on_paid_order(TEXT, INTEGER, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rpc_bind_referral_code(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_apply_referral_reward_on_paid_order(TEXT, INTEGER, INTEGER) TO service_role;

COMMIT;
