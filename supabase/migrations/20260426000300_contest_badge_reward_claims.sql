BEGIN;

ALTER TABLE public.contest_profile_badges
  ADD COLUMN IF NOT EXISTS reward_pack_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_claimed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contest_profile_badges_reward_pack_count_nonnegative'
      AND conrelid = 'public.contest_profile_badges'::regclass
  ) THEN
    ALTER TABLE public.contest_profile_badges
      ADD CONSTRAINT contest_profile_badges_reward_pack_count_nonnegative
      CHECK (reward_pack_count >= 0);
  END IF;
END
$$;

UPDATE public.contest_profile_badges
SET reward_pack_count = CASE badge_id
  WHEN 'contest-badge-testeur' THEN 1
  WHEN 'contest-badge-testeur-en-serie' THEN 5
  WHEN 'contest-badge-nez-absolu' THEN 3
  WHEN 'contest-badge-nez-divin' THEN 6
  ELSE reward_pack_count
END
WHERE reward_pack_count = 0
  AND badge_id IN (
    'contest-badge-testeur',
    'contest-badge-testeur-en-serie',
    'contest-badge-nez-absolu',
    'contest-badge-nez-divin'
  );

CREATE OR REPLACE FUNCTION public.rpc_claim_contest_badge_reward(
  p_customer_id UUID,
  p_badge_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack_count INTEGER;
  v_badge_label TEXT;
BEGIN
  IF p_customer_id IS NULL OR COALESCE(BTRIM(p_badge_id), '') = '' THEN
    RAISE EXCEPTION 'invalid_contest_badge_claim';
  END IF;

  UPDATE public.contest_profile_badges
  SET reward_claimed_at = now()
  WHERE customer_id = p_customer_id
    AND badge_id = p_badge_id
    AND reward_claimed_at IS NULL
    AND reward_pack_count > 0
  RETURNING reward_pack_count INTO v_pack_count;

  IF v_pack_count IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.contest_profile_badges
      WHERE customer_id = p_customer_id
        AND badge_id = p_badge_id
        AND reward_claimed_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'reward_already_claimed';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.contest_profile_badges
      WHERE customer_id = p_customer_id
        AND badge_id = p_badge_id
        AND reward_pack_count <= 0
    ) THEN
      RAISE EXCEPTION 'reward_not_claimable';
    END IF;

    RAISE EXCEPTION 'badge_not_unlocked';
  END IF;

  SELECT label
  INTO v_badge_label
  FROM public.contest_badges
  WHERE id = p_badge_id;

  PERFORM public.rpc_admin_grant_lottery_tickets(
    p_customer_id,
    v_pack_count,
    'Badge concours - ' || COALESCE(v_badge_label, p_badge_id) || ' - ' || v_pack_count || ' booster(s)',
    'bete-de-concours@system.local'
  );

  RETURN v_pack_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_claim_contest_badge_reward(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_claim_contest_badge_reward(UUID, TEXT) TO service_role;

COMMIT;
