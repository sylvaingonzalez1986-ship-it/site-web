BEGIN;

ALTER TABLE public.kq_support_booster_entitlements
  ADD COLUMN IF NOT EXISTS card_count INTEGER NOT NULL DEFAULT 10
  CHECK (card_count BETWEEN 1 AND 10);

ALTER TABLE public.kq_support_booster_entitlements
  DROP CONSTRAINT IF EXISTS kq_support_booster_entitlements_source_check;
ALTER TABLE public.kq_support_booster_entitlements
  DROP CONSTRAINT IF EXISTS kq_support_booster_entitlements_source_shape_check;
ALTER TABLE public.kq_support_booster_entitlements
  ADD CONSTRAINT kq_support_booster_entitlements_source_check
  CHECK (source IN ('ticket', 'arena_streak', 'notebook_badge', 'season_reward', 'points_purchase', 'welcome_pack', 'pvp_win'));
ALTER TABLE public.kq_support_booster_entitlements
  ADD CONSTRAINT kq_support_booster_entitlements_source_shape_check
  CHECK (
    (source = 'ticket' AND ticket_id IS NOT NULL AND reward_key IS NULL) OR
    (source IN ('arena_streak', 'notebook_badge', 'season_reward', 'points_purchase', 'welcome_pack', 'pvp_win')
      AND ticket_id IS NULL AND reward_key IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.rpc_kq_open_support_booster(p_entitlement_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entitlement public.kq_support_booster_entitlements%ROWTYPE;
  v_collection_id UUID;
  v_card public.lottery_card_definitions%ROWTYPE;
  v_rarity public.lottery_card_rarity;
  v_roll INTEGER;
  v_count INTEGER;
  v_offset INTEGER;
  v_slot_index INTEGER;
  v_storage_slot INTEGER;
  v_cards JSONB := '[]'::JSONB;
BEGIN
  SELECT * INTO v_entitlement FROM public.kq_support_booster_entitlements
  WHERE id = p_entitlement_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_entitlement.status <> 'available' THEN RAISE EXCEPTION 'Support booster unavailable'; END IF;

  SELECT id INTO v_collection_id FROM public.lottery_card_collections
  WHERE code = 'BOTTE_DU_CHANVRIER_2026' AND is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Support collection unavailable'; END IF;

  FOR v_slot_index IN 1..v_entitlement.card_count LOOP
    v_storage_slot := CASE WHEN v_entitlement.ticket_id IS NOT NULL THEN v_slot_index + 3 ELSE v_slot_index END;
    IF v_slot_index = 1 THEN
      v_rarity := 'common';
    ELSE
      v_roll := public.lottery_secure_random_int(1, 100);
      v_rarity := CASE
        WHEN v_roll <= 70 THEN 'common'::public.lottery_card_rarity
        WHEN v_roll <= 94 THEN 'silver'::public.lottery_card_rarity
        ELSE 'gold'::public.lottery_card_rarity
      END;
    END IF;
    SELECT count(*) INTO v_count FROM public.lottery_card_definitions
    WHERE collection_id = v_collection_id AND rarity = v_rarity AND is_active = TRUE;
    IF v_count = 0 THEN RAISE EXCEPTION 'Support rarity unavailable'; END IF;
    v_offset := public.lottery_secure_random_int(0, v_count - 1);
    SELECT * INTO v_card FROM public.lottery_card_definitions
    WHERE collection_id = v_collection_id AND rarity = v_rarity AND is_active = TRUE
    ORDER BY card_number OFFSET v_offset LIMIT 1;
    INSERT INTO public.lottery_card_instances(
      user_id, ticket_id, kq_support_entitlement_id, pack_slot, card_definition_id
    ) VALUES (p_user_id, v_entitlement.ticket_id, v_entitlement.id, v_storage_slot, v_card.id);
    v_cards := v_cards || jsonb_build_array(jsonb_build_object(
      'code', v_card.code, 'name', v_card.name, 'rarity', v_card.rarity,
      'packSlot', v_slot_index, 'imageUrl', v_card.image_url
    ));
  END LOOP;

  UPDATE public.kq_support_booster_entitlements SET status = 'opened', opened_at = now()
  WHERE id = v_entitlement.id;
  RETURN jsonb_build_object(
    'entitlementId', v_entitlement.id, 'cardCount', v_entitlement.card_count,
    'cards', v_cards, 'openedAt', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_battle_for_both_players(
  p_battle_id UUID, p_rounds JSONB, p_winner_id UUID, p_user_id UUID,
  p_challenge_day DATE, p_challenge_codes TEXT[],
  p_opponent_challenge_day DATE, p_opponent_challenge_codes TEXT[]
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_battle public.kq_battles%ROWTYPE;
  v_opponent_id UUID;
  v_result JSONB;
  v_opponent_points INTEGER;
  v_canonical_rounds JSONB;
  v_booster_id UUID;
BEGIN
  SELECT * INTO v_battle FROM public.kq_battles
  WHERE id = p_battle_id AND p_user_id IN (player_one_id, player_two_id) FOR UPDATE;
  IF NOT FOUND OR v_battle.status <> 'locked' THEN RAISE EXCEPTION 'Battle unavailable for player'; END IF;
  v_opponent_id := CASE WHEN v_battle.player_one_id = p_user_id THEN v_battle.player_two_id ELSE v_battle.player_one_id END;

  v_result := public.rpc_kq_finalize_battle_with_challenges(
    p_battle_id, p_rounds, p_winner_id, p_user_id,
    p_challenge_day, COALESCE(p_challenge_codes, ARRAY[]::TEXT[])
  );
  v_opponent_points := public.rpc_kq_claim_daily_challenges(
    v_opponent_id, p_battle_id, p_opponent_challenge_day,
    COALESCE(p_opponent_challenge_codes, ARRAY[]::TEXT[])
  );

  INSERT INTO public.kq_support_booster_entitlements(user_id, source, reward_key, card_count)
  VALUES (p_winner_id, 'pvp_win', 'pvp-win:' || p_battle_id::TEXT, 3)
  ON CONFLICT (reward_key) DO UPDATE SET reward_key = EXCLUDED.reward_key
  RETURNING id INTO v_booster_id;

  IF p_user_id = v_battle.player_two_id THEN
    SELECT jsonb_agg(
      (round_value - 'playerScore' - 'opponentScore' - 'winner')
      || jsonb_build_object(
        'playerScore', round_value->'opponentScore',
        'opponentScore', round_value->'playerScore',
        'winner', CASE round_value->>'winner' WHEN 'player' THEN 'opponent' ELSE 'player' END
      ) ORDER BY round_index
    ) INTO v_canonical_rounds
    FROM jsonb_array_elements(p_rounds) WITH ORDINALITY AS rounds(round_value, round_index);
    UPDATE public.kq_battles SET rounds = v_canonical_rounds
    WHERE id = p_battle_id AND status = 'verdict';
  ELSE
    v_canonical_rounds := p_rounds;
  END IF;

  RETURN v_result || jsonb_build_object(
    'opponentChallengePoints', v_opponent_points,
    'roundsStoredFrom', 'player_one',
    'pvpBoosterEntitlementId', v_booster_id,
    'pvpBoosterCardCount', 3,
    'pvpBoosterWinnerId', p_winner_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_open_support_booster(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_open_support_booster(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_finalize_battle_for_both_players(
  UUID, JSONB, UUID, UUID, DATE, TEXT[], DATE, TEXT[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_finalize_battle_for_both_players(
  UUID, JSONB, UUID, UUID, DATE, TEXT[], DATE, TEXT[]
) TO service_role;

COMMIT;
