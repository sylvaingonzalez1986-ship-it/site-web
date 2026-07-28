BEGIN;

ALTER TABLE public.kq_support_booster_entitlements
  DROP CONSTRAINT IF EXISTS kq_support_booster_entitlements_source_check;
ALTER TABLE public.kq_support_booster_entitlements
  DROP CONSTRAINT IF EXISTS kq_support_booster_entitlements_source_shape_check;
ALTER TABLE public.kq_support_booster_entitlements
  ADD CONSTRAINT kq_support_booster_entitlements_source_check
  CHECK (source IN ('ticket', 'arena_streak', 'notebook_badge', 'season_reward', 'points_purchase', 'welcome_pack'));
ALTER TABLE public.kq_support_booster_entitlements
  ADD CONSTRAINT kq_support_booster_entitlements_source_shape_check
  CHECK (
    (source = 'ticket' AND ticket_id IS NOT NULL AND reward_key IS NULL) OR
    (source IN ('arena_streak', 'notebook_badge', 'season_reward', 'points_purchase', 'welcome_pack')
      AND ticket_id IS NULL AND reward_key IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.rpc_kq_claim_welcome_support_booster(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward_key TEXT;
  v_entitlement public.kq_support_booster_entitlements%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'kq_invalid_user'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lottery_card_collections
    WHERE code = 'BOTTE_DU_CHANVRIER_2026' AND is_active = true
  ) THEN RAISE EXCEPTION 'support_collection_unavailable'; END IF;

  v_reward_key := 'kq-welcome:' || p_user_id::TEXT || ':v1';
  SELECT * INTO v_entitlement FROM public.kq_support_booster_entitlements
  WHERE reward_key = v_reward_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'entitlementId', v_entitlement.id,
      'claimed', false,
      'replayed', true,
      'status', v_entitlement.status
    );
  END IF;

  INSERT INTO public.kq_support_booster_entitlements(user_id, source, reward_key)
  VALUES (p_user_id, 'welcome_pack', v_reward_key)
  RETURNING * INTO v_entitlement;

  RETURN jsonb_build_object(
    'entitlementId', v_entitlement.id,
    'claimed', true,
    'replayed', false,
    'status', v_entitlement.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_claim_welcome_support_booster(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_claim_welcome_support_booster(UUID)
  TO service_role;

COMMIT;
