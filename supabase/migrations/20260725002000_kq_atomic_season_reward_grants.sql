BEGIN;

ALTER TABLE public.kq_support_booster_entitlements
  DROP CONSTRAINT IF EXISTS kq_support_booster_entitlements_source_check;
ALTER TABLE public.kq_support_booster_entitlements
  DROP CONSTRAINT IF EXISTS kq_support_booster_entitlements_source_shape_check;
ALTER TABLE public.kq_support_booster_entitlements
  ADD CONSTRAINT kq_support_booster_entitlements_source_check
  CHECK (source IN ('ticket', 'arena_streak', 'notebook_badge', 'season_reward'));
ALTER TABLE public.kq_support_booster_entitlements
  ADD CONSTRAINT kq_support_booster_entitlements_source_shape_check
  CHECK (
    (source = 'ticket' AND ticket_id IS NOT NULL AND reward_key IS NULL) OR
    (source IN ('arena_streak', 'notebook_badge', 'season_reward') AND ticket_id IS NULL AND reward_key IS NOT NULL)
  );

ALTER TABLE public.kq_heritage_fragment_ledger
  DROP CONSTRAINT IF EXISTS kq_heritage_fragment_ledger_reason_check;
ALTER TABLE public.kq_heritage_fragment_ledger
  DROP CONSTRAINT IF EXISTS kq_heritage_fragment_ledger_check;
ALTER TABLE public.kq_heritage_fragment_ledger
  ADD CONSTRAINT kq_heritage_fragment_ledger_reason_check
  CHECK (reason IN ('duplicate_common', 'duplicate_rare', 'duplicate_epic', 'craft_common', 'craft_rare', 'season_reward'));
ALTER TABLE public.kq_heritage_fragment_ledger
  ADD CONSTRAINT kq_heritage_fragment_ledger_shape_check
  CHECK (
    (amount > 0 AND draw_id IS NOT NULL AND reason LIKE 'duplicate_%' AND reward_key IS NULL)
    OR (amount < 0 AND draw_id IS NULL AND reason LIKE 'craft_%' AND reward_key IS NOT NULL)
    OR (amount > 0 AND draw_id IS NULL AND reason = 'season_reward' AND reward_key IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.rpc_kq_grant_season_reward(
  p_season_code TEXT,
  p_user_id UUID,
  p_tier_code TEXT,
  p_final_rank INTEGER,
  p_final_rating INTEGER,
  p_final_season_points INTEGER,
  p_battles INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule public.kq_season_reward_rules%ROWTYPE;
  v_grant public.kq_season_reward_grants%ROWTYPE;
  v_grant_key TEXT;
  v_boosters INTEGER;
  v_fragments INTEGER;
  v_index INTEGER;
BEGIN
  SELECT * INTO v_rule
  FROM public.kq_season_reward_rules
  WHERE season_code = p_season_code
    AND tier_code = p_tier_code
    AND is_active = TRUE
    AND p_final_rank >= min_rank
    AND (max_rank IS NULL OR p_final_rank <= max_rank)
    AND p_battles >= min_battles;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_season_reward_inactive_or_ineligible'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lottery_card_collections
    WHERE code = 'BOTTE_DU_CHANVRIER_2026' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'kq_season_reward_collection_inactive';
  END IF;

  v_grant_key := p_season_code || ':' || p_user_id::TEXT || ':' || p_tier_code;
  SELECT * INTO v_grant FROM public.kq_season_reward_grants WHERE grant_key = v_grant_key;
  IF FOUND THEN
    RETURN jsonb_build_object('grant', to_jsonb(v_grant), 'alreadyGranted', TRUE);
  END IF;

  v_boosters := COALESCE((v_rule.reward_payload->>'supportBoosters')::INTEGER, 0);
  v_fragments := COALESCE((v_rule.reward_payload->>'heritageFragments')::INTEGER, 0);
  INSERT INTO public.kq_season_reward_grants(
    season_code, user_id, tier_code, final_rank, final_rating,
    final_season_points, reward_payload, grant_key
  ) VALUES (
    p_season_code, p_user_id, p_tier_code, p_final_rank, p_final_rating,
    p_final_season_points, v_rule.reward_payload, v_grant_key
  ) RETURNING * INTO v_grant;

  FOR v_index IN 1..v_boosters LOOP
    INSERT INTO public.kq_support_booster_entitlements(user_id, source, reward_key)
    VALUES (p_user_id, 'season_reward', v_grant_key || ':booster:' || v_index::TEXT);
  END LOOP;

  IF v_fragments > 0 THEN
    INSERT INTO public.kq_heritage_fragment_ledger(user_id, amount, reason, reward_key)
    VALUES (p_user_id, v_fragments, 'season_reward', v_grant_key || ':fragments');
    INSERT INTO public.kq_heritage_fragment_wallets(user_id, balance)
    VALUES (p_user_id, v_fragments)
    ON CONFLICT (user_id) DO UPDATE SET
      balance = public.kq_heritage_fragment_wallets.balance + EXCLUDED.balance,
      updated_at = now();
  END IF;

  RETURN jsonb_build_object('grant', to_jsonb(v_grant), 'alreadyGranted', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_grant_season_reward(TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_grant_season_reward(TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER)
  TO service_role;

COMMIT;
