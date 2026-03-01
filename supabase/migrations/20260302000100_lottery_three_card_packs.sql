BEGIN;

ALTER TABLE public.lottery_card_instances
  ADD COLUMN IF NOT EXISTS pack_slot INTEGER;

UPDATE public.lottery_card_instances
SET pack_slot = 1
WHERE pack_slot IS NULL;

ALTER TABLE public.lottery_card_instances
  ALTER COLUMN pack_slot SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lottery_card_instances_ticket_id_key'
      AND conrelid = 'public.lottery_card_instances'::regclass
  ) THEN
    ALTER TABLE public.lottery_card_instances
      DROP CONSTRAINT lottery_card_instances_ticket_id_key;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lottery_card_instances_pack_slot_check'
      AND conrelid = 'public.lottery_card_instances'::regclass
  ) THEN
    ALTER TABLE public.lottery_card_instances
      ADD CONSTRAINT lottery_card_instances_pack_slot_check
      CHECK (pack_slot BETWEEN 1 AND 3);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lottery_card_instances_ticket_slot_key'
      AND conrelid = 'public.lottery_card_instances'::regclass
  ) THEN
    ALTER TABLE public.lottery_card_instances
      ADD CONSTRAINT lottery_card_instances_ticket_slot_key
      UNIQUE (ticket_id, pack_slot);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_lottery_card_instances_ticket_slot
  ON public.lottery_card_instances(ticket_id, pack_slot);

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
  v_cards_json JSONB := '[]'::JSONB;
  v_roll INTEGER;
  v_total_weight INTEGER;
  v_definition_count INTEGER;
  v_definition_offset INTEGER;
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

  v_total_weight :=
    COALESCE(v_config.common_weight, 0) +
    COALESCE(v_config.silver_weight, 0) +
    COALESCE(v_config.gold_weight, 0) +
    COALESCE(v_config.epic_weight, 0) +
    COALESCE(v_config.legendary_weight, 0);

  IF v_total_weight <= 0 THEN
    RAISE EXCEPTION 'invalid_card_weight_budget';
  END IF;

  FOR v_pack_slot IN 1..3 LOOP
    v_roll := public.lottery_secure_random_int(1, v_total_weight);

    IF v_roll <= v_config.common_weight THEN
      SELECT count(*) INTO v_definition_count
      FROM public.lottery_card_definitions
      WHERE collection_id = v_collection.id
        AND rarity = 'common'
        AND is_active = TRUE;

      v_definition_offset := public.lottery_secure_random_int(0, GREATEST(v_definition_count - 1, 0));

      SELECT *
      INTO v_card
      FROM public.lottery_card_definitions
      WHERE collection_id = v_collection.id
        AND rarity = 'common'
        AND is_active = TRUE
      ORDER BY card_number ASC
      OFFSET v_definition_offset
      LIMIT 1;
    ELSIF v_roll <= v_config.common_weight + v_config.silver_weight THEN
      SELECT count(*) INTO v_definition_count
      FROM public.lottery_card_definitions
      WHERE collection_id = v_collection.id
        AND rarity = 'silver'
        AND is_active = TRUE;

      v_definition_offset := public.lottery_secure_random_int(0, GREATEST(v_definition_count - 1, 0));

      SELECT *
      INTO v_card
      FROM public.lottery_card_definitions
      WHERE collection_id = v_collection.id
        AND rarity = 'silver'
        AND is_active = TRUE
      ORDER BY card_number ASC
      OFFSET v_definition_offset
      LIMIT 1;
    ELSIF v_roll <= v_config.common_weight + v_config.silver_weight + v_config.gold_weight THEN
      SELECT count(*) INTO v_definition_count
      FROM public.lottery_card_definitions
      WHERE collection_id = v_collection.id
        AND rarity = 'gold'
        AND is_active = TRUE;

      v_definition_offset := public.lottery_secure_random_int(0, GREATEST(v_definition_count - 1, 0));

      SELECT *
      INTO v_card
      FROM public.lottery_card_definitions
      WHERE collection_id = v_collection.id
        AND rarity = 'gold'
        AND is_active = TRUE
      ORDER BY card_number ASC
      OFFSET v_definition_offset
      LIMIT 1;
    ELSIF v_roll <= v_config.common_weight + v_config.silver_weight + v_config.gold_weight + v_config.epic_weight THEN
      SELECT count(*) INTO v_definition_count
      FROM public.lottery_card_definitions
      WHERE collection_id = v_collection.id
        AND rarity = 'epic'
        AND is_active = TRUE;

      v_definition_offset := public.lottery_secure_random_int(0, GREATEST(v_definition_count - 1, 0));

      SELECT *
      INTO v_card
      FROM public.lottery_card_definitions
      WHERE collection_id = v_collection.id
        AND rarity = 'epic'
        AND is_active = TRUE
      ORDER BY card_number ASC
      OFFSET v_definition_offset
      LIMIT 1;
    ELSE
      SELECT count(*) INTO v_definition_count
      FROM public.lottery_card_definitions
      WHERE collection_id = v_collection.id
        AND rarity = 'legendary'
        AND is_active = TRUE;

      v_definition_offset := public.lottery_secure_random_int(0, GREATEST(v_definition_count - 1, 0));

      SELECT *
      INTO v_card
      FROM public.lottery_card_definitions
      WHERE collection_id = v_collection.id
        AND rarity = 'legendary'
        AND is_active = TRUE
      ORDER BY card_number ASC
      OFFSET v_definition_offset
      LIMIT 1;
    END IF;

    IF v_definition_count <= 0 OR v_card.id IS NULL THEN
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
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_scratch_ticket(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_scratch_ticket(UUID, UUID) TO service_role;

COMMIT;
