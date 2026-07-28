BEGIN;

ALTER TABLE public.lottery_card_instances
  DROP CONSTRAINT IF EXISTS lottery_card_instances_pack_slot_check;
ALTER TABLE public.lottery_card_instances
  ADD CONSTRAINT lottery_card_instances_pack_slot_check
  CHECK (pack_slot BETWEEN 1 AND 13);

UPDATE public.lottery_card_collections
SET is_active = TRUE, updated_at = now()
WHERE code = 'BOTTE_DU_CHANVRIER_2026';

UPDATE public.lottery_card_definitions
SET is_active = TRUE, updated_at = now()
WHERE collection_id = (
  SELECT id FROM public.lottery_card_collections
  WHERE code = 'BOTTE_DU_CHANVRIER_2026'
);

CREATE OR REPLACE FUNCTION public.rpc_kq_open_support_booster(
  p_entitlement_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT * INTO v_entitlement
  FROM public.kq_support_booster_entitlements
  WHERE id = p_entitlement_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_entitlement.status <> 'available' THEN
    RAISE EXCEPTION 'Support booster unavailable';
  END IF;

  SELECT id INTO v_collection_id
  FROM public.lottery_card_collections
  WHERE code = 'BOTTE_DU_CHANVRIER_2026' AND is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Support collection unavailable'; END IF;

  FOR v_slot_index IN 1..10 LOOP
    v_storage_slot := CASE
      WHEN v_entitlement.ticket_id IS NOT NULL THEN v_slot_index + 3
      ELSE v_slot_index
    END;

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

    SELECT count(*) INTO v_count
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection_id AND rarity = v_rarity AND is_active = TRUE;
    IF v_count = 0 THEN RAISE EXCEPTION 'Support rarity unavailable'; END IF;

    v_offset := public.lottery_secure_random_int(0, v_count - 1);
    SELECT * INTO v_card
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection_id AND rarity = v_rarity AND is_active = TRUE
    ORDER BY card_number
    OFFSET v_offset LIMIT 1;

    INSERT INTO public.lottery_card_instances(
      user_id, ticket_id, kq_support_entitlement_id, pack_slot, card_definition_id
    )
    VALUES (
      p_user_id, v_entitlement.ticket_id, v_entitlement.id, v_storage_slot, v_card.id
    );

    v_cards := v_cards || jsonb_build_array(jsonb_build_object(
      'code', v_card.code,
      'name', v_card.name,
      'rarity', v_card.rarity,
      'packSlot', v_slot_index,
      'imageUrl', v_card.image_url
    ));
  END LOOP;

  UPDATE public.kq_support_booster_entitlements
  SET status = 'opened', opened_at = now()
  WHERE id = v_entitlement.id;

  RETURN jsonb_build_object(
    'entitlementId', v_entitlement.id,
    'cards', v_cards,
    'openedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_open_support_booster(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_open_support_booster(UUID, UUID)
  TO service_role;

COMMIT;
