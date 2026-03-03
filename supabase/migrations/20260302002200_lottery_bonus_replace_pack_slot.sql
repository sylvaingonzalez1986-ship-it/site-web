BEGIN;

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
  v_total_bonus_remaining INTEGER := 0;
  v_remaining_packs INTEGER := 0;
  v_bonus_roll INTEGER := 0;
  v_bonus_won BOOLEAN := FALSE;
  v_bonus_slot INTEGER := 0;
  v_bonus_choice_roll INTEGER := 0;
  v_bonus_definition public.lottery_bonus_definitions%ROWTYPE;
  v_bonus_pool_row public.lottery_cycle_bonus_pool%ROWTYPE;
  v_bonus_instance_id UUID := NULL;
  v_bonus_options_json JSONB := '[]'::JSONB;
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

  SELECT COALESCE(sum(remaining), 0)
  INTO v_total_bonus_remaining
  FROM public.lottery_cycle_bonus_pool
  WHERE cycle_id = v_cycle.id;

  v_remaining_packs := GREATEST(v_cycle.total_packs - v_cycle.packs_opened, 0);

  IF v_total_bonus_remaining > 0 AND v_remaining_packs > 0 THEN
    v_bonus_roll := public.lottery_secure_random_int(1, v_remaining_packs);
    IF v_bonus_roll <= v_total_bonus_remaining THEN
      v_bonus_won := TRUE;
      v_bonus_slot := public.lottery_secure_random_int(1, 3);

      v_bonus_choice_roll := public.lottery_secure_random_int(1, v_total_bonus_remaining);

      FOR v_bonus_pool_row IN
        SELECT *
        FROM public.lottery_cycle_bonus_pool
        WHERE cycle_id = v_cycle.id
          AND remaining > 0
        ORDER BY bonus_definition_id
      LOOP
        IF v_bonus_choice_roll <= v_bonus_pool_row.remaining THEN
          UPDATE public.lottery_cycle_bonus_pool
          SET remaining = remaining - 1
          WHERE cycle_id = v_bonus_pool_row.cycle_id
            AND bonus_definition_id = v_bonus_pool_row.bonus_definition_id;

          SELECT *
          INTO v_bonus_definition
          FROM public.lottery_bonus_definitions
          WHERE id = v_bonus_pool_row.bonus_definition_id;

          EXIT;
        END IF;

        v_bonus_choice_roll := v_bonus_choice_roll - v_bonus_pool_row.remaining;
      END LOOP;

      IF v_bonus_definition.id IS NULL THEN
        v_bonus_won := FALSE;
        v_bonus_slot := 0;
      ELSE
        INSERT INTO public.lottery_bonus_instances (
          user_id,
          ticket_id,
          cycle_id,
          bonus_definition_id,
          status,
          created_at
        )
        VALUES (
          p_user_id,
          v_ticket.id,
          v_cycle.id,
          v_bonus_definition.id,
          'available',
          now()
        )
        RETURNING id INTO v_bonus_instance_id;

        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', o.id,
              'bonusDefinitionId', o.bonus_definition_id,
              'label', o.label,
              'kind', o.kind,
              'giftWeightGrams', o.gift_weight_grams,
              'giftProductSku', o.gift_product_sku,
              'giftLabel', o.gift_label,
              'customPayload', o.custom_payload,
              'sortOrder', o.sort_order,
              'createdAt', o.created_at,
              'updatedAt', o.updated_at
            )
            ORDER BY o.sort_order ASC, o.created_at ASC
          ),
          '[]'::jsonb
        )
        INTO v_bonus_options_json
        FROM public.lottery_bonus_options o
        WHERE o.bonus_definition_id = v_bonus_definition.id;
      END IF;
    END IF;
  END IF;

  FOR v_pack_slot IN 1..3 LOOP
    IF v_bonus_won AND v_pack_slot = v_bonus_slot THEN
      v_cards_json := v_cards_json || jsonb_build_array(
        jsonb_build_object(
          'id', v_bonus_definition.id,
          'definitionId', v_bonus_definition.id,
          'collectionId', v_collection.id,
          'collectionCode', 'BONUS',
          'collectionTitle', 'Cartes Bonus',
          'code', v_bonus_definition.code,
          'cardNumber', 0,
          'name', v_bonus_definition.title,
          'rarity', 'legendary',
          'visualPrompt', '',
          'description', v_bonus_definition.description,
          'imageUrl', v_bonus_definition.image_url,
          'ownedCount', 1,
          'packSlot', v_pack_slot,
          'isBonus', TRUE,
          'bonusInstanceId', v_bonus_instance_id,
          'bonusOptions', v_bonus_options_json
        )
      );

      CONTINUE;
    END IF;

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
        'packSlot', v_pack_slot,
        'isBonus', FALSE
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
      'ownedCount', v_primary_owned_count,
      'isBonus', FALSE
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
    ),
    'bonusPrize', CASE
      WHEN v_bonus_won AND v_bonus_definition.id IS NOT NULL THEN jsonb_build_object(
        'id', v_bonus_definition.id,
        'code', v_bonus_definition.code,
        'title', v_bonus_definition.title,
        'description', v_bonus_definition.description,
        'imageUrl', v_bonus_definition.image_url,
        'bonusInstanceId', v_bonus_instance_id,
        'packSlot', v_bonus_slot,
        'options', v_bonus_options_json
      )
      ELSE NULL
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_scratch_ticket(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_scratch_ticket(UUID, UUID) TO service_role;

COMMIT;
