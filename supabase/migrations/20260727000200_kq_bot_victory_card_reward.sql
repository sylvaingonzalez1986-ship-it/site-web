BEGIN;

ALTER TABLE public.lottery_card_instances
  ADD COLUMN IF NOT EXISTS source_bot_battle_id UUID
  REFERENCES public.kq_bot_battles(id) ON DELETE CASCADE;

ALTER TABLE public.lottery_card_instances
  DROP CONSTRAINT IF EXISTS lottery_card_instances_source_required;
ALTER TABLE public.lottery_card_instances
  ADD CONSTRAINT lottery_card_instances_source_required
  CHECK (
    ticket_id IS NOT NULL
    OR kq_support_entitlement_id IS NOT NULL
    OR source_bot_battle_id IS NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_kq_bot_battle_card_reward
  ON public.lottery_card_instances(source_bot_battle_id)
  WHERE source_bot_battle_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_bot_battle(
  p_user_id UUID,
  p_flower_id UUID,
  p_bot_code TEXT,
  p_bot_flower JSONB,
  p_seed INTEGER,
  p_rounds JSONB,
  p_winner TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flower public.kq_flowers%ROWTYPE;
  v_battle public.kq_bot_battles%ROWTYPE;
  v_today_start TIMESTAMPTZ;
  v_today_count INTEGER;
  v_season TEXT;
  v_collection_id UUID;
  v_reward_card public.lottery_card_definitions%ROWTYPE;
  v_reward_count INTEGER;
  v_reward_offset INTEGER;
  v_reward JSONB := NULL;
BEGIN
  IF p_user_id IS NULL OR p_flower_id IS NULL OR COALESCE(BTRIM(p_bot_code), '') = ''
    OR p_bot_flower IS NULL OR p_rounds IS NULL OR JSONB_ARRAY_LENGTH(p_rounds) <> 3
    OR p_winner NOT IN ('player', 'opponent')
  THEN RAISE EXCEPTION 'kq_invalid_bot_battle'; END IF;

  v_today_start := ((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')::DATE AT TIME ZONE 'Europe/Paris');
  SELECT COUNT(*) INTO v_today_count FROM public.kq_bot_battles
  WHERE user_id = p_user_id AND verdict_at >= v_today_start;
  IF v_today_count >= 10 THEN RAISE EXCEPTION 'kq_bot_daily_limit'; END IF;

  SELECT * INTO v_flower FROM public.kq_flowers
  WHERE id = p_flower_id AND owner_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_flower.status <> 'available' THEN RAISE EXCEPTION 'kq_flower_unavailable'; END IF;

  INSERT INTO public.kq_bot_battles (
    user_id, flower_id, bot_code, bot_flower, seed, rounds, winner
  ) VALUES (
    p_user_id, p_flower_id, p_bot_code, p_bot_flower, p_seed, p_rounds, p_winner
  ) RETURNING * INTO v_battle;

  UPDATE public.kq_flowers
  SET status = 'burned', locked_at = v_battle.verdict_at, burned_at = v_battle.verdict_at
  WHERE id = p_flower_id;

  v_season := public.kq_active_season_code();
  INSERT INTO public.kq_rank_profiles (user_id, season_code, arena_experience, burned_flowerS)
  VALUES (p_user_id, v_season, 0.1, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET arena_experience = public.kq_rank_profiles.arena_experience + 0.1,
      burned_flowers = public.kq_rank_profiles.burned_flowers + 1,
      updated_at = now();

  IF p_winner = 'player' THEN
    SELECT id INTO v_collection_id
    FROM public.lottery_card_collections
    WHERE code = 'BOTTE_DU_CHANVRIER_2026' AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'kq_support_collection_unavailable'; END IF;

    SELECT COUNT(*) INTO v_reward_count
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection_id AND is_active = TRUE AND code LIKE 'BOTTE-%';
    IF v_reward_count = 0 THEN RAISE EXCEPTION 'kq_support_reward_unavailable'; END IF;

    v_reward_offset := public.lottery_secure_random_int(0, v_reward_count - 1);
    SELECT * INTO v_reward_card
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection_id AND is_active = TRUE AND code LIKE 'BOTTE-%'
    ORDER BY card_number
    OFFSET v_reward_offset LIMIT 1;

    INSERT INTO public.lottery_card_instances (
      user_id, ticket_id, kq_support_entitlement_id, source_bot_battle_id, pack_slot, card_definition_id
    ) VALUES (
      p_user_id, NULL, NULL, v_battle.id, 1, v_reward_card.id
    );

    v_reward := jsonb_build_object(
      'code', v_reward_card.code,
      'name', v_reward_card.name,
      'rarity', v_reward_card.rarity,
      'description', v_reward_card.description,
      'imageUrl', v_reward_card.image_url
    );
  END IF;

  RETURN jsonb_build_object(
    'battleId', v_battle.id,
    'verdictAt', v_battle.verdict_at,
    'winner', v_battle.winner,
    'rounds', v_battle.rounds,
    'experienceAwarded', v_battle.experience_awarded,
    'todayCount', v_today_count + 1,
    'dailyLimit', 10,
    'rewardCard', v_reward
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_finalize_bot_battle(UUID, UUID, TEXT, JSONB, INTEGER, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_finalize_bot_battle(UUID, UUID, TEXT, JSONB, INTEGER, JSONB, TEXT)
  TO service_role;

COMMIT;
