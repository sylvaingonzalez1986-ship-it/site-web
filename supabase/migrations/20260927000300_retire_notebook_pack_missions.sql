BEGIN;

-- Retire only the notebook pack missions. Existing badges, receipts, tokens,
-- available packs and opened cards remain owned by their players.
UPDATE public.kq_notebook_reward_rules
SET is_active = FALSE, updated_at = now()
WHERE badge_code IN ('premier-carnet', 'combo-aromatique') AND is_active;

-- The old badge claim does not consult kq_notebook_reward_rules. Guard its
-- retired codes too, including unclaimed rows with an old positive pack count.
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

  -- These two missions no longer award packs through either reward economy.
  -- Keep historical receipts intact and retain the legacy replay error.
  IF EXISTS (
    SELECT 1 FROM public.contest_profile_badges profile_badge
    JOIN public.contest_badges badge ON badge.id = profile_badge.badge_id
    WHERE profile_badge.customer_id = p_customer_id
      AND profile_badge.badge_id = p_badge_id
      AND badge.code IN ('premier-carnet', 'combo-aromatique')
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.contest_profile_badges
      WHERE customer_id = p_customer_id AND badge_id = p_badge_id
        AND reward_claimed_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'reward_already_claimed';
    END IF;
    RAISE EXCEPTION 'reward_not_claimable';
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

REVOKE ALL ON FUNCTION public.rpc_claim_contest_badge_reward(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_claim_contest_badge_reward(UUID, TEXT) TO service_role;

COMMIT;
