DROP INDEX IF EXISTS public.uq_lottery_reward_rules_active_rarity;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lottery_reward_rules_active_rarity_priority
  ON public.lottery_reward_rules(sticker_rarity, priority)
  WHERE is_active = TRUE;

INSERT INTO public.lottery_reward_definitions (
  code,
  level,
  kind,
  title,
  description,
  gift_weight_grams,
  gift_label,
  is_active
)
VALUES
  (
    'COMMON_GIFT_1G',
    'common',
    'gift_weight_grams',
    '1 g offert sur la prochaine commande',
    'Ligne commune: 1 g offert sur la prochaine commande.',
    1,
    '1 g offert sur la prochaine commande',
    TRUE
  ),
  (
    'RARE_GIFT_10G',
    'rare',
    'gift_weight_grams',
    '10 g offerts sur la prochaine commande',
    'Ligne rare: 10 g offerts sur la prochaine commande.',
    10,
    '10 g offerts sur la prochaine commande',
    TRUE
  )
ON CONFLICT (code) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  kind = EXCLUDED.kind,
  gift_weight_grams = EXCLUDED.gift_weight_grams,
  gift_label = EXCLUDED.gift_label,
  is_active = TRUE,
  deleted_at = NULL,
  updated_at = now();

UPDATE public.lottery_reward_rules
SET
  priority = 100,
  updated_at = now()
WHERE is_active = TRUE
  AND (
    (sticker_rarity = 'common' AND reward_definition_id = (SELECT id FROM public.lottery_reward_definitions WHERE code = 'COMMON_DISCOUNT_10' LIMIT 1))
    OR (sticker_rarity = 'rare' AND reward_definition_id = (SELECT id FROM public.lottery_reward_definitions WHERE code = 'RARE_DISCOUNT_20' LIMIT 1))
    OR (sticker_rarity = 'epic' AND reward_definition_id = (SELECT id FROM public.lottery_reward_definitions WHERE code = 'EPIC_GIFT_50G' LIMIT 1))
  );

INSERT INTO public.lottery_reward_rules (
  sticker_rarity,
  stickers_required,
  reward_definition_id,
  is_active,
  priority
)
SELECT
  'common'::public.lottery_sticker_rarity,
  10,
  reward.id,
  TRUE,
  200
FROM public.lottery_reward_definitions AS reward
WHERE reward.code = 'COMMON_GIFT_1G'
  AND NOT EXISTS (
    SELECT 1
    FROM public.lottery_reward_rules AS rule
    WHERE rule.sticker_rarity = 'common'
      AND rule.is_active = TRUE
      AND rule.priority = 200
  );

INSERT INTO public.lottery_reward_rules (
  sticker_rarity,
  stickers_required,
  reward_definition_id,
  is_active,
  priority
)
SELECT
  'rare'::public.lottery_sticker_rarity,
  10,
  reward.id,
  TRUE,
  200
FROM public.lottery_reward_definitions AS reward
WHERE reward.code = 'RARE_GIFT_10G'
  AND NOT EXISTS (
    SELECT 1
    FROM public.lottery_reward_rules AS rule
    WHERE rule.sticker_rarity = 'rare'
      AND rule.is_active = TRUE
      AND rule.priority = 200
  );

INSERT INTO public.lottery_reward_rules (
  sticker_rarity,
  stickers_required,
  reward_definition_id,
  is_active,
  priority
)
SELECT
  'epic'::public.lottery_sticker_rarity,
  10,
  reward.id,
  TRUE,
  100
FROM public.lottery_reward_definitions AS reward
WHERE reward.code = 'EPIC_GIFT_50G'
  AND NOT EXISTS (
    SELECT 1
    FROM public.lottery_reward_rules AS rule
    WHERE rule.sticker_rarity = 'epic'
      AND rule.is_active = TRUE
      AND rule.reward_definition_id = reward.id
  );

CREATE OR REPLACE FUNCTION public.lottery_get_next_reward_rule(
  p_user_id UUID,
  p_sticker_rarity public.lottery_sticker_rarity
)
RETURNS public.lottery_reward_rules
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule public.lottery_reward_rules%ROWTYPE;
  v_rule_count INTEGER := 0;
  v_materialized_count INTEGER := 0;
BEGIN
  IF p_user_id IS NULL OR p_sticker_rarity IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*)
  INTO v_rule_count
  FROM public.lottery_reward_rules
  WHERE sticker_rarity = p_sticker_rarity
    AND is_active = TRUE;

  IF v_rule_count < 1 THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*)
  INTO v_materialized_count
  FROM public.lottery_reward_lines
  WHERE user_id = p_user_id
    AND sticker_rarity = p_sticker_rarity;

  SELECT *
  INTO v_rule
  FROM public.lottery_reward_rules
  WHERE sticker_rarity = p_sticker_rarity
    AND is_active = TRUE
  ORDER BY priority ASC, created_at ASC
  OFFSET MOD(v_materialized_count, v_rule_count)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN v_rule;
END;
$$;

CREATE OR REPLACE FUNCTION public.lottery_materialize_reward_line(
  p_user_id UUID,
  p_sticker_rarity public.lottery_sticker_rarity
)
RETURNS TABLE (
  reward_line_id UUID,
  reward_claim_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule public.lottery_reward_rules%ROWTYPE;
  v_config public.lottery_game_config%ROWTYPE;
  v_definition public.lottery_reward_definitions%ROWTYPE;
  v_line_id UUID;
  v_claim_id UUID;
  v_sticker_ids UUID[];
  v_sticker_count INTEGER;
  v_snapshot JSONB;
  v_resolved_definition_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_sticker_rarity IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_config
  FROM public.lottery_game_config
  WHERE id = 1;

  SELECT *
  INTO v_rule
  FROM public.lottery_get_next_reward_rule(p_user_id, p_sticker_rarity);

  IF FOUND AND v_rule.id IS NOT NULL THEN
    WITH selected_stickers AS (
      SELECT id
      FROM public.lottery_stickers
      WHERE user_id = p_user_id
        AND rarity = p_sticker_rarity
        AND consumed_at IS NULL
      ORDER BY created_at ASC, id ASC
      LIMIT v_rule.stickers_required
      FOR UPDATE SKIP LOCKED
    )
    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]), COUNT(*)
    INTO v_sticker_ids, v_sticker_count
    FROM selected_stickers;

    IF v_sticker_count < v_rule.stickers_required THEN
      RETURN;
    END IF;

    SELECT *
    INTO v_definition
    FROM public.lottery_reward_definitions
    WHERE id = v_rule.reward_definition_id;

    v_resolved_definition_id := v_definition.id;
    IF NOT FOUND OR v_definition.deleted_at IS NOT NULL OR v_definition.is_active = FALSE THEN
      IF v_definition.replacement_reward_definition_id IS NOT NULL THEN
        SELECT *
        INTO v_definition
        FROM public.lottery_reward_definitions
        WHERE id = v_definition.replacement_reward_definition_id
          AND deleted_at IS NULL
          AND is_active = TRUE;

        IF FOUND THEN
          v_resolved_definition_id := v_definition.id;
        ELSE
          v_resolved_definition_id := NULL;
        END IF;
      ELSE
        v_resolved_definition_id := NULL;
      END IF;
    END IF;

    IF v_resolved_definition_id IS NULL THEN
      v_snapshot := jsonb_build_object(
        'rewardDefinitionId', NULL,
        'title', 'Lot retire',
        'description', 'Ce lot n''est plus propose, mais ta progression reste conservee.',
        'level', NULL,
        'kind', NULL,
        'imageUrl', '',
        'discountPercent', NULL,
        'giftWeightGrams', NULL,
        'giftProductSku', NULL,
        'giftLabel', NULL,
        'customPayload', '{}'::jsonb,
        'deleted', TRUE
      );

      INSERT INTO public.lottery_reward_lines (
        user_id,
        sticker_rarity,
        stickers_required,
        reward_rule_id,
        reward_definition_id,
        reward_snapshot,
        status,
        freeze_reason
      )
      VALUES (
        p_user_id,
        p_sticker_rarity,
        v_rule.stickers_required,
        v_rule.id,
        NULL,
        v_snapshot,
        'frozen',
        'MISSING_OR_INACTIVE_REWARD'
      )
      RETURNING id INTO v_line_id;

      UPDATE public.lottery_stickers
      SET
        reward_line_id = v_line_id,
        consumed_at = now()
      WHERE id = ANY(v_sticker_ids);

      INSERT INTO public.lottery_audit_log (
        event_type,
        user_id,
        reward_line_id,
        details
      )
      VALUES (
        'reward_line_frozen',
        p_user_id,
        v_line_id,
        jsonb_build_object(
          'rarity', p_sticker_rarity,
          'stickers_required', v_rule.stickers_required,
          'priority', v_rule.priority
        )
      );

      reward_line_id := v_line_id;
      reward_claim_id := NULL;
      RETURN NEXT;
      RETURN;
    END IF;

    v_snapshot := public.lottery_build_reward_snapshot(v_resolved_definition_id);

    INSERT INTO public.lottery_reward_lines (
      user_id,
      sticker_rarity,
      stickers_required,
      reward_rule_id,
      reward_definition_id,
      reward_snapshot,
      status
    )
    VALUES (
      p_user_id,
      p_sticker_rarity,
      v_rule.stickers_required,
      v_rule.id,
      v_resolved_definition_id,
      v_snapshot,
      'earned'
    )
    RETURNING id INTO v_line_id;

    UPDATE public.lottery_stickers
    SET
      reward_line_id = v_line_id,
      consumed_at = now()
    WHERE id = ANY(v_sticker_ids);

    INSERT INTO public.lottery_audit_log (
      event_type,
      user_id,
      reward_line_id,
      details
    )
    VALUES (
      'reward_line_earned',
      p_user_id,
      v_line_id,
      jsonb_build_object(
        'rarity', p_sticker_rarity,
        'stickers_required', v_rule.stickers_required,
        'reward_definition_id', v_resolved_definition_id,
        'priority', v_rule.priority
      )
    );

    reward_line_id := v_line_id;
    reward_claim_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  WITH selected_stickers AS (
    SELECT id
    FROM public.lottery_stickers
    WHERE user_id = p_user_id
      AND rarity = p_sticker_rarity
      AND consumed_at IS NULL
    ORDER BY created_at ASC, id ASC
    LIMIT COALESCE(v_config.stickers_per_line, 10)
    FOR UPDATE SKIP LOCKED
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]), COUNT(*)
  INTO v_sticker_ids, v_sticker_count
  FROM selected_stickers;

  IF v_sticker_count < COALESCE(v_config.stickers_per_line, 10) THEN
    RETURN;
  END IF;

  v_snapshot := jsonb_build_object(
    'rewardDefinitionId', NULL,
    'title', 'Lot retire',
    'description', 'Ce lot n''est plus propose, mais ta progression reste conservee.',
    'level', NULL,
    'kind', NULL,
    'imageUrl', '',
    'discountPercent', NULL,
    'giftWeightGrams', NULL,
    'giftProductSku', NULL,
    'giftLabel', NULL,
    'customPayload', '{}'::jsonb,
    'deleted', TRUE
  );

  INSERT INTO public.lottery_reward_lines (
    user_id,
    sticker_rarity,
    stickers_required,
    reward_rule_id,
    reward_definition_id,
    reward_snapshot,
    status,
    freeze_reason
  )
  VALUES (
    p_user_id,
    p_sticker_rarity,
    COALESCE(v_config.stickers_per_line, 10),
    NULL,
    NULL,
    v_snapshot,
    'frozen',
    'NO_ACTIVE_RULE'
  )
  RETURNING id INTO v_line_id;

  UPDATE public.lottery_stickers
  SET
    reward_line_id = v_line_id,
    consumed_at = now()
  WHERE id = ANY(v_sticker_ids);

  INSERT INTO public.lottery_audit_log (
    event_type,
    user_id,
    reward_line_id,
    details
  )
  VALUES (
    'reward_line_frozen',
    p_user_id,
    v_line_id,
    jsonb_build_object(
      'rarity', p_sticker_rarity,
      'stickers_required', COALESCE(v_config.stickers_per_line, 10),
      'reason', 'NO_ACTIVE_RULE'
    )
  );

  reward_line_id := v_line_id;
  reward_claim_id := NULL;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.lottery_get_next_reward_rule(UUID, public.lottery_sticker_rarity) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lottery_get_next_reward_rule(UUID, public.lottery_sticker_rarity) TO service_role;
