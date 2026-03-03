BEGIN;

ALTER TABLE public.lottery_game_config
  ADD COLUMN IF NOT EXISTS cycle_size INTEGER,
  ADD COLUMN IF NOT EXISTS common_quota INTEGER,
  ADD COLUMN IF NOT EXISTS silver_quota INTEGER,
  ADD COLUMN IF NOT EXISTS gold_quota INTEGER,
  ADD COLUMN IF NOT EXISTS epic_quota INTEGER,
  ADD COLUMN IF NOT EXISTS legendary_quota INTEGER;

DO $$
DECLARE
  v_row public.lottery_game_config%ROWTYPE;
  v_total_weight INTEGER;
  v_common INTEGER;
  v_silver INTEGER;
  v_gold INTEGER;
  v_epic INTEGER;
  v_legendary INTEGER;
  v_assigned INTEGER;
BEGIN
  SELECT * INTO v_row
  FROM public.lottery_game_config
  WHERE id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.lottery_game_config (
      id,
      euros_per_ticket,
      max_tickets_per_order,
      common_weight,
      silver_weight,
      gold_weight,
      epic_weight,
      legendary_weight,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      1,
      5,
      4,
      33,
      10,
      5,
      3,
      1,
      TRUE,
      now(),
      now()
    )
    RETURNING * INTO v_row;
  END IF;

  IF v_row.cycle_size IS NULL OR v_row.cycle_size <= 0 THEN
    v_row.cycle_size := 50000;
  END IF;

  IF v_row.common_quota IS NOT NULL
    AND v_row.silver_quota IS NOT NULL
    AND v_row.gold_quota IS NOT NULL
    AND v_row.epic_quota IS NOT NULL
    AND v_row.legendary_quota IS NOT NULL
    AND (v_row.common_quota + v_row.silver_quota + v_row.gold_quota + v_row.epic_quota + v_row.legendary_quota) = v_row.cycle_size
  THEN
    UPDATE public.lottery_game_config
    SET cycle_size = v_row.cycle_size,
        updated_at = now()
    WHERE id = 1;
    RETURN;
  END IF;

  v_total_weight :=
    COALESCE(v_row.common_weight, 0) +
    COALESCE(v_row.silver_weight, 0) +
    COALESCE(v_row.gold_weight, 0) +
    COALESCE(v_row.epic_weight, 0) +
    COALESCE(v_row.legendary_weight, 0);

  IF v_total_weight <= 0 THEN
    v_common := 40000;
    v_silver := 7000;
    v_gold := 2000;
    v_epic := 800;
    v_legendary := 200;
  ELSE
    v_common := floor((v_row.common_weight::NUMERIC / v_total_weight::NUMERIC) * v_row.cycle_size::NUMERIC)::INTEGER;
    v_silver := floor((v_row.silver_weight::NUMERIC / v_total_weight::NUMERIC) * v_row.cycle_size::NUMERIC)::INTEGER;
    v_gold := floor((v_row.gold_weight::NUMERIC / v_total_weight::NUMERIC) * v_row.cycle_size::NUMERIC)::INTEGER;
    v_epic := floor((v_row.epic_weight::NUMERIC / v_total_weight::NUMERIC) * v_row.cycle_size::NUMERIC)::INTEGER;
    v_legendary := floor((v_row.legendary_weight::NUMERIC / v_total_weight::NUMERIC) * v_row.cycle_size::NUMERIC)::INTEGER;

    v_assigned := v_common + v_silver + v_gold + v_epic + v_legendary;
    v_common := v_common + (v_row.cycle_size - v_assigned);
  END IF;

  UPDATE public.lottery_game_config
  SET cycle_size = v_row.cycle_size,
      common_quota = GREATEST(v_common, 0),
      silver_quota = GREATEST(v_silver, 0),
      gold_quota = GREATEST(v_gold, 0),
      epic_quota = GREATEST(v_epic, 0),
      legendary_quota = GREATEST(v_legendary, 0),
      updated_at = now()
  WHERE id = 1;
END
$$;

ALTER TABLE public.lottery_game_config
  ALTER COLUMN cycle_size SET DEFAULT 50000,
  ALTER COLUMN cycle_size SET NOT NULL,
  ALTER COLUMN common_quota SET DEFAULT 40000,
  ALTER COLUMN common_quota SET NOT NULL,
  ALTER COLUMN silver_quota SET DEFAULT 7000,
  ALTER COLUMN silver_quota SET NOT NULL,
  ALTER COLUMN gold_quota SET DEFAULT 2000,
  ALTER COLUMN gold_quota SET NOT NULL,
  ALTER COLUMN epic_quota SET DEFAULT 800,
  ALTER COLUMN epic_quota SET NOT NULL,
  ALTER COLUMN legendary_quota SET DEFAULT 200,
  ALTER COLUMN legendary_quota SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lottery_game_config_cycle_size_check'
      AND conrelid = 'public.lottery_game_config'::regclass
  ) THEN
    ALTER TABLE public.lottery_game_config
      ADD CONSTRAINT lottery_game_config_cycle_size_check
      CHECK (cycle_size BETWEEN 1000 AND 5000000);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lottery_game_config_cycle_quota_budget_check'
      AND conrelid = 'public.lottery_game_config'::regclass
  ) THEN
    ALTER TABLE public.lottery_game_config
      ADD CONSTRAINT lottery_game_config_cycle_quota_budget_check
      CHECK (
        common_quota >= 0
        AND silver_quota >= 0
        AND gold_quota >= 0
        AND epic_quota >= 0
        AND legendary_quota >= 0
        AND (common_quota + silver_quota + gold_quota + epic_quota + legendary_quota) = cycle_size
      );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.lottery_draw_cycles (
  id BIGSERIAL PRIMARY KEY,
  cycle_number INTEGER NOT NULL UNIQUE,
  total_packs INTEGER NOT NULL CHECK (total_packs > 0),
  packs_opened INTEGER NOT NULL DEFAULT 0 CHECK (packs_opened >= 0),
  common_initial INTEGER NOT NULL CHECK (common_initial >= 0),
  silver_initial INTEGER NOT NULL CHECK (silver_initial >= 0),
  gold_initial INTEGER NOT NULL CHECK (gold_initial >= 0),
  epic_initial INTEGER NOT NULL CHECK (epic_initial >= 0),
  legendary_initial INTEGER NOT NULL CHECK (legendary_initial >= 0),
  common_remaining INTEGER NOT NULL CHECK (common_remaining >= 0),
  silver_remaining INTEGER NOT NULL CHECK (silver_remaining >= 0),
  gold_remaining INTEGER NOT NULL CHECK (gold_remaining >= 0),
  epic_remaining INTEGER NOT NULL CHECK (epic_remaining >= 0),
  legendary_remaining INTEGER NOT NULL CHECK (legendary_remaining >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CHECK (packs_opened <= total_packs)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lottery_draw_cycles_single_active
  ON public.lottery_draw_cycles((completed_at IS NULL))
  WHERE completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.lottery_start_next_cycle(
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS public.lottery_draw_cycles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_active public.lottery_draw_cycles%ROWTYPE;
  v_config public.lottery_game_config%ROWTYPE;
  v_next_cycle_number INTEGER;
  v_inserted public.lottery_draw_cycles%ROWTYPE;
BEGIN
  IF p_force IS DISTINCT FROM TRUE THEN
    SELECT *
    INTO v_active
    FROM public.lottery_draw_cycles
    WHERE completed_at IS NULL
    ORDER BY cycle_number DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      RETURN v_active;
    END IF;
  END IF;

  SELECT *
  INTO v_config
  FROM public.lottery_game_config
  WHERE id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lottery_config_missing';
  END IF;

  SELECT COALESCE(MAX(cycle_number), 0) + 1
  INTO v_next_cycle_number
  FROM public.lottery_draw_cycles;

  INSERT INTO public.lottery_draw_cycles (
    cycle_number,
    total_packs,
    packs_opened,
    common_initial,
    silver_initial,
    gold_initial,
    epic_initial,
    legendary_initial,
    common_remaining,
    silver_remaining,
    gold_remaining,
    epic_remaining,
    legendary_remaining,
    started_at,
    completed_at
  )
  VALUES (
    v_next_cycle_number,
    v_config.cycle_size,
    0,
    GREATEST(v_config.common_quota * 3, 0),
    GREATEST(v_config.silver_quota * 3, 0),
    GREATEST(v_config.gold_quota * 3, 0),
    GREATEST(v_config.epic_quota * 3, 0),
    GREATEST(v_config.legendary_quota * 3, 0),
    GREATEST(v_config.common_quota * 3, 0),
    GREATEST(v_config.silver_quota * 3, 0),
    GREATEST(v_config.gold_quota * 3, 0),
    GREATEST(v_config.epic_quota * 3, 0),
    GREATEST(v_config.legendary_quota * 3, 0),
    now(),
    NULL
  )
  RETURNING * INTO v_inserted;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.lottery_start_next_cycle(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lottery_start_next_cycle(BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_scratch_ticket(
  p_ticket_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ticket public.lottery_tickets%ROWTYPE;
  v_config public.lottery_game_config%ROWTYPE;
  v_collection public.lottery_card_collections%ROWTYPE;
  v_card public.lottery_card_definitions%ROWTYPE;
  v_cycle public.lottery_draw_cycles%ROWTYPE;
  v_cards_json JSONB := '[]'::JSONB;
  v_roll INTEGER;
  v_total_remaining INTEGER;
  v_definition_count INTEGER;
  v_definition_offset INTEGER;
  v_selected_rarity public.lottery_card_rarity;
  v_card_rank INTEGER;
  v_primary_rank INTEGER := -1;
  v_primary_card_id UUID := NULL;
  v_primary_card_rarity public.lottery_card_rarity := NULL;
  v_primary_card_name TEXT := NULL;
  v_primary_card_number INTEGER := NULL;
  v_primary_card_code TEXT := NULL;
  v_primary_card_prompt TEXT := NULL;
  v_primary_card_description TEXT := NULL;
  v_primary_card_image_url TEXT := NULL;
  v_primary_owned_count INTEGER := 0;
  v_owned_count INTEGER;
  v_unique_owned INTEGER;
  v_total_owned INTEGER;
  v_common_count INTEGER;
  v_silver_count INTEGER;
  v_gold_count INTEGER;
  v_epic_count INTEGER;
  v_legendary_count INTEGER;
  v_pack_slot INTEGER;
  v_next_packs_opened INTEGER;
BEGIN
  SELECT *
  INTO v_ticket
  FROM public.lottery_tickets
  WHERE id = p_ticket_id
    AND user_id = p_user_id
    AND status = 'available'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket_not_found_or_already_scratched';
  END IF;

  SELECT *
  INTO v_config
  FROM public.lottery_game_config
  WHERE id = 1;

  IF NOT FOUND OR v_config.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'lottery_inactive';
  END IF;

  SELECT *
  INTO v_collection
  FROM public.lottery_card_collections
  WHERE is_active = TRUE
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'collection_not_found';
  END IF;

  SELECT *
  INTO v_cycle
  FROM public.lottery_draw_cycles
  WHERE completed_at IS NULL
  ORDER BY cycle_number DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM public.lottery_start_next_cycle();

    SELECT *
    INTO v_cycle
    FROM public.lottery_draw_cycles
    WHERE completed_at IS NULL
    ORDER BY cycle_number DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  FOR v_pack_slot IN 1..3 LOOP
    v_total_remaining :=
      COALESCE(v_cycle.common_remaining, 0) +
      COALESCE(v_cycle.silver_remaining, 0) +
      COALESCE(v_cycle.gold_remaining, 0) +
      COALESCE(v_cycle.epic_remaining, 0) +
      COALESCE(v_cycle.legendary_remaining, 0);

    IF v_total_remaining <= 0 THEN
      RAISE EXCEPTION 'cycle_deck_empty';
    END IF;

    v_roll := public.lottery_secure_random_int(1, v_total_remaining);

    IF v_roll <= v_cycle.common_remaining THEN
      v_selected_rarity := 'common';
      v_cycle.common_remaining := v_cycle.common_remaining - 1;
    ELSIF v_roll <= v_cycle.common_remaining + v_cycle.silver_remaining THEN
      v_selected_rarity := 'silver';
      v_cycle.silver_remaining := v_cycle.silver_remaining - 1;
    ELSIF v_roll <= v_cycle.common_remaining + v_cycle.silver_remaining + v_cycle.gold_remaining THEN
      v_selected_rarity := 'gold';
      v_cycle.gold_remaining := v_cycle.gold_remaining - 1;
    ELSIF v_roll <= v_cycle.common_remaining + v_cycle.silver_remaining + v_cycle.gold_remaining + v_cycle.epic_remaining THEN
      v_selected_rarity := 'epic';
      v_cycle.epic_remaining := v_cycle.epic_remaining - 1;
    ELSE
      v_selected_rarity := 'legendary';
      v_cycle.legendary_remaining := v_cycle.legendary_remaining - 1;
    END IF;

    SELECT count(*)
    INTO v_definition_count
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection.id
      AND rarity = v_selected_rarity
      AND is_active = TRUE;

    IF v_definition_count <= 0 THEN
      RAISE EXCEPTION 'card_definition_not_found_for_rarity';
    END IF;

    v_definition_offset := public.lottery_secure_random_int(0, GREATEST(v_definition_count - 1, 0));

    SELECT *
    INTO v_card
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection.id
      AND rarity = v_selected_rarity
      AND is_active = TRUE
    ORDER BY card_number ASC
    OFFSET v_definition_offset
    LIMIT 1;

    IF v_card.id IS NULL THEN
      RAISE EXCEPTION 'card_definition_not_found_for_rarity';
    END IF;

    INSERT INTO public.lottery_card_instances (
      user_id,
      ticket_id,
      pack_slot,
      card_definition_id
    )
    VALUES (
      p_user_id,
      v_ticket.id,
      v_pack_slot,
      v_card.id
    );

    SELECT count(*)
    INTO v_owned_count
    FROM public.lottery_card_instances
    WHERE user_id = p_user_id
      AND card_definition_id = v_card.id;

    v_cards_json := v_cards_json || jsonb_build_array(
      jsonb_build_object(
        'id', v_card.id,
        'definitionId', v_card.id,
        'collectionId', v_collection.id,
        'collectionCode', v_collection.code,
        'collectionTitle', v_collection.title,
        'code', v_card.code,
        'cardNumber', v_card.card_number,
        'name', v_card.name,
        'rarity', v_card.rarity,
        'visualPrompt', v_card.visual_prompt,
        'description', v_card.description,
        'imageUrl', v_card.image_url,
        'ownedCount', v_owned_count,
        'packSlot', v_pack_slot
      )
    );

    v_card_rank := CASE v_card.rarity
      WHEN 'legendary' THEN 5
      WHEN 'epic' THEN 4
      WHEN 'gold' THEN 3
      WHEN 'silver' THEN 2
      ELSE 1
    END;

    IF v_card_rank > v_primary_rank THEN
      v_primary_rank := v_card_rank;
      v_primary_card_id := v_card.id;
      v_primary_card_rarity := v_card.rarity;
      v_primary_card_name := v_card.name;
      v_primary_card_number := v_card.card_number;
      v_primary_card_code := v_card.code;
      v_primary_card_prompt := v_card.visual_prompt;
      v_primary_card_description := v_card.description;
      v_primary_card_image_url := v_card.image_url;
      v_primary_owned_count := v_owned_count;
    END IF;
  END LOOP;

  UPDATE public.lottery_draw_cycles
  SET packs_opened = packs_opened + 1,
      common_remaining = GREATEST(v_cycle.common_remaining, 0),
      silver_remaining = GREATEST(v_cycle.silver_remaining, 0),
      gold_remaining = GREATEST(v_cycle.gold_remaining, 0),
      epic_remaining = GREATEST(v_cycle.epic_remaining, 0),
      legendary_remaining = GREATEST(v_cycle.legendary_remaining, 0)
  WHERE id = v_cycle.id
  RETURNING packs_opened INTO v_next_packs_opened;

  IF v_next_packs_opened >= v_cycle.total_packs THEN
    UPDATE public.lottery_draw_cycles
    SET completed_at = now()
    WHERE id = v_cycle.id
      AND completed_at IS NULL;

    PERFORM public.lottery_start_next_cycle(TRUE);
  END IF;

  UPDATE public.lottery_tickets
  SET status = 'scratched',
      scratched_at = now(),
      card_definition_id = v_primary_card_id,
      card_rarity = v_primary_card_rarity,
      sticker_id = NULL,
      sticker_rarity = NULL,
      legendary_reward_claim_id = NULL
  WHERE id = v_ticket.id;

  SELECT
    count(DISTINCT card_definition_id),
    count(*)
  INTO v_unique_owned, v_total_owned
  FROM public.lottery_card_instances
  WHERE user_id = p_user_id;

  SELECT
    count(*) FILTER (WHERE d.rarity = 'common'),
    count(*) FILTER (WHERE d.rarity = 'silver'),
    count(*) FILTER (WHERE d.rarity = 'gold'),
    count(*) FILTER (WHERE d.rarity = 'epic'),
    count(*) FILTER (WHERE d.rarity = 'legendary')
  INTO
    v_common_count,
    v_silver_count,
    v_gold_count,
    v_epic_count,
    v_legendary_count
  FROM public.lottery_card_instances i
  JOIN public.lottery_card_definitions d ON d.id = i.card_definition_id
  WHERE i.user_id = p_user_id;

  RETURN jsonb_build_object(
    'ticketId', v_ticket.id,
    'ticketNumber', v_ticket.ticket_number,
    'scratchedAt', now(),
    'card', jsonb_build_object(
      'id', v_primary_card_id,
      'definitionId', v_primary_card_id,
      'collectionId', v_collection.id,
      'collectionCode', v_collection.code,
      'collectionTitle', v_collection.title,
      'code', v_primary_card_code,
      'cardNumber', v_primary_card_number,
      'name', v_primary_card_name,
      'rarity', v_primary_card_rarity,
      'visualPrompt', v_primary_card_prompt,
      'description', v_primary_card_description,
      'imageUrl', v_primary_card_image_url,
      'ownedCount', v_primary_owned_count
    ),
    'cards', v_cards_json,
    'inventory', jsonb_build_object(
      'totalCards', (SELECT count(*) FROM public.lottery_card_definitions WHERE collection_id = v_collection.id),
      'uniqueOwned', COALESCE(v_unique_owned, 0),
      'totalOwnedCopies', COALESCE(v_total_owned, 0),
      'duplicateCopies', GREATEST(COALESCE(v_total_owned, 0) - COALESCE(v_unique_owned, 0), 0),
      'common', COALESCE(v_common_count, 0),
      'silver', COALESCE(v_silver_count, 0),
      'gold', COALESCE(v_gold_count, 0),
      'epic', COALESCE(v_epic_count, 0),
      'legendary', COALESCE(v_legendary_count, 0)
    ),
    'cycle', jsonb_build_object(
      'cycleNumber', v_cycle.cycle_number,
      'totalPacks', v_cycle.total_packs,
      'packsOpened', v_next_packs_opened,
      'remaining', jsonb_build_object(
        'common', GREATEST(v_cycle.common_remaining, 0),
        'silver', GREATEST(v_cycle.silver_remaining, 0),
        'gold', GREATEST(v_cycle.gold_remaining, 0),
        'epic', GREATEST(v_cycle.epic_remaining, 0),
        'legendary', GREATEST(v_cycle.legendary_remaining, 0)
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_scratch_ticket(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_scratch_ticket(UUID, UUID) TO service_role;

DO $$
BEGIN
  PERFORM public.lottery_start_next_cycle(FALSE);
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END
$$;

COMMIT;
