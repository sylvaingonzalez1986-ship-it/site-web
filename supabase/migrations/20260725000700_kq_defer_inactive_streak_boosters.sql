BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_kq_grant_streak_booster(p_user_id UUID)
RETURNS public.kq_support_booster_entitlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.kq_rank_profiles%ROWTYPE;
  v_entitlement public.kq_support_booster_entitlements%ROWTYPE;
  v_reward_key TEXT;
  v_collection_live BOOLEAN;
BEGIN
  SELECT * INTO v_profile FROM public.kq_rank_profiles
  WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_profile.streak <= 0 OR v_profile.streak % 3 <> 0 THEN
    RAISE EXCEPTION 'Streak booster unavailable';
  END IF;
  v_reward_key := p_user_id::TEXT || ':streak:' || v_profile.wins::TEXT || ':' || v_profile.streak::TEXT;
  INSERT INTO public.kq_support_booster_entitlements (user_id, source, reward_key)
  VALUES (p_user_id, 'arena_streak', v_reward_key)
  ON CONFLICT (reward_key) DO UPDATE SET reward_key = EXCLUDED.reward_key
  RETURNING * INTO v_entitlement;

  SELECT EXISTS (
    SELECT 1 FROM public.lottery_card_collections
    WHERE code = 'BOTTE_DU_CHANVRIER_2026' AND is_active = TRUE
  ) INTO v_collection_live;
  IF NOT v_collection_live THEN
    -- Keep the stored entitlement available for launch day, but return a
    -- non-available transient status so the battle RPC does not open it now.
    v_entitlement.status := 'opened';
  END IF;
  RETURN v_entitlement;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_grant_streak_booster(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_grant_streak_booster(UUID) TO service_role;

COMMIT;
