BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_kq_grant_season_reward_unlocked(
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
  v_reward_payload JSONB;
  v_season_label TEXT;
  v_ribbon TEXT;
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

  v_season_label := regexp_replace(p_season_code, '^.*[-_](S[0-9]+)$', '\1', 'i');
  IF v_season_label = p_season_code THEN v_season_label := p_season_code; END IF;
  v_season_label := upper(v_season_label);
  v_ribbon := CASE p_tier_code
    WHEN 'champion' THEN 'Champion de saison ' || v_season_label
    WHEN 'podium' THEN 'Podium de saison ' || v_season_label
    WHEN 'finalist' THEN 'Finaliste de saison ' || v_season_label
    WHEN 'participant' THEN 'Saison ' || v_season_label || ' complète'
    ELSE COALESCE(v_rule.reward_payload->>'ribbon', 'Saison ' || v_season_label)
  END;
  v_reward_payload := jsonb_set(v_rule.reward_payload, '{ribbon}', to_jsonb(v_ribbon), TRUE);
  v_boosters := COALESCE((v_reward_payload->>'supportBoosters')::INTEGER, 0);
  v_fragments := COALESCE((v_reward_payload->>'heritageFragments')::INTEGER, 0);

  INSERT INTO public.kq_season_reward_grants(
    season_code, user_id, tier_code, final_rank, final_rating,
    final_season_points, reward_payload, grant_key
  ) VALUES (
    p_season_code, p_user_id, p_tier_code, p_final_rank, p_final_rating,
    p_final_season_points, v_reward_payload, v_grant_key
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

REVOKE ALL ON FUNCTION public.rpc_kq_grant_season_reward_unlocked(
  TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.rpc_kq_grant_season_reward_unlocked(
  TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER
) IS 'Atomic season reward grant with a ribbon derived from the requested season code.';

COMMIT;
