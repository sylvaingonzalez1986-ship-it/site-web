-- TCG Collection Album: page completions, reward options, burn log & RPCs
-- Aligned with LotteryCollectionAlbum contract (lottery.ts)

BEGIN;

-- ─── 1. Page completion tracking ────────────────────────────────
-- One row per (user, card_rarity).

CREATE TABLE IF NOT EXISTS public.lottery_collection_page_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_rarity public.lottery_card_rarity NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  reward_claim_id UUID REFERENCES public.lottery_reward_claims(id) ON DELETE SET NULL,
  selected_reward_definition_id UUID REFERENCES public.lottery_reward_definitions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_collection_page_user_rarity UNIQUE (user_id, page_rarity)
);

CREATE INDEX IF NOT EXISTS idx_collection_page_completions_user
  ON public.lottery_collection_page_completions(user_id);

ALTER TABLE public.lottery_collection_page_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collection_page_completions_user_read_own
  ON public.lottery_collection_page_completions;
CREATE POLICY collection_page_completions_user_read_own
  ON public.lottery_collection_page_completions
  FOR SELECT USING (auth.uid() = user_id);

-- ─── 2. Per-rarity reward options (admin-configurable) ──────────

CREATE TABLE IF NOT EXISTS public.lottery_collection_page_reward_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_rarity public.lottery_card_rarity NOT NULL,
  reward_definition_id UUID NOT NULL REFERENCES public.lottery_reward_definitions(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_collection_reward_option UNIQUE (page_rarity, reward_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_reward_options_rarity
  ON public.lottery_collection_page_reward_options(page_rarity, is_active, priority);

ALTER TABLE public.lottery_collection_page_reward_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collection_reward_options_read_all
  ON public.lottery_collection_page_reward_options;
CREATE POLICY collection_reward_options_read_all
  ON public.lottery_collection_page_reward_options
  FOR SELECT USING (true);

-- ─── 3. Burn log (audit & idempotence) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.lottery_collection_burn_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rarity public.lottery_card_rarity NOT NULL,
  burned_instance_ids UUID[] NOT NULL,
  reward_claim_id UUID REFERENCES public.lottery_reward_claims(id) ON DELETE SET NULL,
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collection_burn_log_user
  ON public.lottery_collection_burn_log(user_id, created_at DESC);

ALTER TABLE public.lottery_collection_burn_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collection_burn_log_user_read_own
  ON public.lottery_collection_burn_log;
CREATE POLICY collection_burn_log_user_read_own
  ON public.lottery_collection_burn_log
  FOR SELECT USING (auth.uid() = user_id);

-- ─── 4. Updated-at trigger ──────────────────────────────────────

DROP TRIGGER IF EXISTS trg_touch_collection_reward_options_updated_at
  ON public.lottery_collection_page_reward_options;
CREATE TRIGGER trg_touch_collection_reward_options_updated_at
  BEFORE UPDATE ON public.lottery_collection_page_reward_options
  FOR EACH ROW EXECUTE FUNCTION public.lottery_touch_updated_at();

-- ─── 5. RPC: claim page completion reward ───────────────────────

CREATE OR REPLACE FUNCTION public.rpc_claim_collection_page_reward(
  p_user_id UUID,
  p_page_rarity public.lottery_card_rarity,
  p_reward_definition_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completion_id UUID;
  v_total_defined INTEGER;
  v_owned_unique INTEGER;
  v_reward_def RECORD;
  v_claim_id UUID;
  v_generated_code TEXT;
  v_snapshot JSONB;
  v_claim_row RECORD;
BEGIN
  -- 1. Check reward option is valid and active for this page rarity
  IF NOT EXISTS (
    SELECT 1 FROM lottery_collection_page_reward_options
    WHERE page_rarity = p_page_rarity
      AND reward_definition_id = p_reward_definition_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'collection_reward_option_not_found';
  END IF;

  -- 2. Verify page is actually complete
  SELECT count(DISTINCT cd.id) INTO v_total_defined
  FROM lottery_card_definitions cd
  WHERE cd.rarity = p_page_rarity AND cd.is_active = TRUE;

  SELECT count(DISTINCT ci.card_definition_id) INTO v_owned_unique
  FROM lottery_card_instances ci
  JOIN lottery_card_definitions cd ON cd.id = ci.card_definition_id
  WHERE ci.user_id = p_user_id
    AND cd.rarity = p_page_rarity
    AND cd.is_active = TRUE;

  IF v_total_defined = 0 OR v_owned_unique < v_total_defined THEN
    RAISE EXCEPTION 'collection_page_not_complete';
  END IF;

  -- 3. Idempotent completion row
  INSERT INTO lottery_collection_page_completions (user_id, page_rarity, completed_at)
  VALUES (p_user_id, p_page_rarity, now())
  ON CONFLICT (user_id, page_rarity) DO NOTHING;

  SELECT id INTO v_completion_id
  FROM lottery_collection_page_completions
  WHERE user_id = p_user_id AND page_rarity = p_page_rarity;

  -- 4. Check not already claimed
  IF EXISTS (
    SELECT 1 FROM lottery_collection_page_completions
    WHERE id = v_completion_id AND claimed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'collection_page_already_claimed';
  END IF;

  -- 5. Load reward definition
  SELECT * INTO v_reward_def
  FROM lottery_reward_definitions
  WHERE id = p_reward_definition_id AND is_active = TRUE AND deleted_at IS NULL;

  IF v_reward_def IS NULL THEN
    RAISE EXCEPTION 'collection_reward_definition_invalid';
  END IF;

  -- 6. Generate code for discount rewards
  v_generated_code := NULL;
  IF v_reward_def.kind = 'discount_percent' THEN
    v_generated_code := 'COL-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8));
  END IF;

  -- 7. Build reward snapshot
  v_snapshot := jsonb_build_object(
    'rewardDefinitionId', v_reward_def.id,
    'title', v_reward_def.title,
    'description', v_reward_def.description,
    'level', v_reward_def.level::TEXT,
    'kind', v_reward_def.kind::TEXT,
    'imageUrl', v_reward_def.image_url,
    'discountPercent', v_reward_def.discount_percent,
    'giftWeightGrams', v_reward_def.gift_weight_grams,
    'giftProductSku', v_reward_def.gift_product_sku,
    'giftLabel', v_reward_def.gift_label,
    'customPayload', COALESCE(v_reward_def.custom_payload, '{}'::JSONB),
    'deleted', FALSE
  );

  -- 8. Create reward claim
  INSERT INTO lottery_reward_claims (
    user_id, reward_definition_id, reward_snapshot, status,
    generated_code, discount_percent, gift_weight_grams,
    gift_product_sku, gift_label
  )
  VALUES (
    p_user_id, v_reward_def.id, v_snapshot, 'available',
    v_generated_code, v_reward_def.discount_percent,
    v_reward_def.gift_weight_grams, v_reward_def.gift_product_sku,
    v_reward_def.gift_label
  )
  RETURNING id INTO v_claim_id;

  -- 9. Mark page as claimed
  UPDATE lottery_collection_page_completions
  SET claimed_at = now(),
      reward_claim_id = v_claim_id,
      selected_reward_definition_id = p_reward_definition_id
  WHERE id = v_completion_id;

  -- 10. Return the full claim row as JSONB
  SELECT * INTO v_claim_row FROM lottery_reward_claims WHERE id = v_claim_id;

  RETURN jsonb_build_object(
    'id', v_claim_row.id,
    'user_id', v_claim_row.user_id,
    'reward_line_id', v_claim_row.reward_line_id,
    'source_ticket_id', v_claim_row.source_ticket_id,
    'reward_definition_id', v_claim_row.reward_definition_id,
    'reward_snapshot', v_claim_row.reward_snapshot,
    'status', v_claim_row.status,
    'generated_code', v_claim_row.generated_code,
    'discount_percent', v_claim_row.discount_percent,
    'gift_weight_grams', v_claim_row.gift_weight_grams,
    'gift_product_sku', v_claim_row.gift_product_sku,
    'gift_label', v_claim_row.gift_label,
    'reserved_order_id', v_claim_row.reserved_order_id,
    'reserved_at', v_claim_row.reserved_at,
    'reserved_until', v_claim_row.reserved_until,
    'used_order_id', v_claim_row.used_order_id,
    'used_at', v_claim_row.used_at,
    'fulfilled_at', v_claim_row.fulfilled_at,
    'created_at', v_claim_row.created_at,
    'page_rarity', p_page_rarity::TEXT,
    'claimed_at', now()
  );
END;
$$;

-- ─── 6. RPC: burn 5 duplicate cards (same rarity) ──────────────
-- Auto-creates a discount claim; no reward_definition_id needed.

CREATE OR REPLACE FUNCTION public.rpc_burn_duplicate_cards(
  p_user_id UUID,
  p_rarity public.lottery_card_rarity,
  p_instance_ids UUID[],
  p_discount_percent INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_valid_count INTEGER;
  v_claim_id UUID;
  v_generated_code TEXT;
  v_snapshot JSONB;
  v_claim_row RECORD;
  v_instance UUID;
BEGIN
  -- 1. Legendary cannot be burned
  IF p_rarity = 'legendary' THEN
    RAISE EXCEPTION 'burn_legendary_not_allowed';
  END IF;

  -- 2. Exactly 5 instances required
  v_count := array_length(p_instance_ids, 1);
  IF v_count IS NULL OR v_count <> 5 THEN
    RAISE EXCEPTION 'burn_requires_exactly_5';
  END IF;

  -- 3. Validate all instances belong to user and match rarity
  SELECT count(*) INTO v_valid_count
  FROM lottery_card_instances ci
  JOIN lottery_card_definitions cd ON cd.id = ci.card_definition_id
  WHERE ci.id = ANY(p_instance_ids)
    AND ci.user_id = p_user_id
    AND cd.rarity = p_rarity;

  IF v_valid_count <> 5 THEN
    RAISE EXCEPTION 'burn_instances_invalid';
  END IF;

  -- 4. Ensure burning won't remove the last copy of any definition
  FOR v_instance IN
    SELECT unnest(p_instance_ids)
  LOOP
    IF (
      SELECT count(*)
      FROM lottery_card_instances ci2
      WHERE ci2.card_definition_id = (
        SELECT card_definition_id FROM lottery_card_instances WHERE id = v_instance
      )
      AND ci2.user_id = p_user_id
      AND ci2.id <> ALL(p_instance_ids)
    ) < 1 THEN
      RAISE EXCEPTION 'burn_would_remove_last_copy';
    END IF;
  END LOOP;

  -- 5. Delete burned instances
  DELETE FROM lottery_card_instances
  WHERE id = ANY(p_instance_ids) AND user_id = p_user_id;

  -- 6. Generate discount code
  v_generated_code := 'BURN-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8));

  -- 7. Build snapshot
  v_snapshot := jsonb_build_object(
    'title', 'Burn ' || p_rarity::TEXT || ' x5',
    'description', 'Remise ' || p_discount_percent || '% obtenue en brulant 5 doublons ' || p_rarity::TEXT,
    'kind', 'discount_percent',
    'discountPercent', p_discount_percent,
    'deleted', FALSE
  );

  -- 8. Create discount claim
  INSERT INTO lottery_reward_claims (
    user_id, reward_snapshot, status, generated_code, discount_percent
  )
  VALUES (
    p_user_id, v_snapshot, 'available', v_generated_code, p_discount_percent
  )
  RETURNING id INTO v_claim_id;

  -- 9. Audit log
  INSERT INTO lottery_collection_burn_log (
    user_id, rarity, burned_instance_ids, reward_claim_id, discount_percent
  )
  VALUES (
    p_user_id, p_rarity, p_instance_ids, v_claim_id, p_discount_percent
  );

  -- 10. Return claim row as JSONB
  SELECT * INTO v_claim_row FROM lottery_reward_claims WHERE id = v_claim_id;

  RETURN jsonb_build_object(
    'id', v_claim_row.id,
    'user_id', v_claim_row.user_id,
    'reward_line_id', v_claim_row.reward_line_id,
    'source_ticket_id', v_claim_row.source_ticket_id,
    'reward_definition_id', v_claim_row.reward_definition_id,
    'reward_snapshot', v_claim_row.reward_snapshot,
    'status', v_claim_row.status,
    'generated_code', v_claim_row.generated_code,
    'discount_percent', v_claim_row.discount_percent,
    'gift_weight_grams', v_claim_row.gift_weight_grams,
    'gift_product_sku', v_claim_row.gift_product_sku,
    'gift_label', v_claim_row.gift_label,
    'reserved_order_id', v_claim_row.reserved_order_id,
    'reserved_at', v_claim_row.reserved_at,
    'reserved_until', v_claim_row.reserved_until,
    'used_order_id', v_claim_row.used_order_id,
    'used_at', v_claim_row.used_at,
    'fulfilled_at', v_claim_row.fulfilled_at,
    'created_at', v_claim_row.created_at,
    'rarity', p_rarity::TEXT,
    'burned_count', 5,
    'consumed_instance_ids', to_jsonb(p_instance_ids)
  );
END;
$$;

-- ─── 7. Seed default page-completion rewards ────────────────────

DO $$
DECLARE
  v_rarities TEXT[] := ARRAY['common', 'silver', 'gold', 'epic', 'legendary'];
  v_titles TEXT[] := ARRAY[
    'Pack Degustation Decouverte (3g)',
    'Pack Degustation Silver (5g)',
    'Pack Degustation Gold (10g)',
    'Pack Degustation Epique (15g)',
    'Pack Degustation Legendaire (25g)'
  ];
  v_grams INTEGER[] := ARRAY[3, 5, 10, 15, 25];
  v_levels TEXT[] := ARRAY['common', 'rare', 'epic', 'epic', 'legendary'];
  v_reward_id UUID;
  i INTEGER;
BEGIN
  FOR i IN 1..5 LOOP
    INSERT INTO public.lottery_reward_definitions (
      code, level, kind, title, description,
      gift_weight_grams, gift_label, is_active
    )
    VALUES (
      'TCG_PAGE_' || upper(v_rarities[i]),
      v_levels[i]::public.lottery_reward_level,
      'physical_item',
      v_titles[i],
      'Pack degustation offert pour avoir complete la page ' || v_rarities[i] || ' de la collection.',
      v_grams[i],
      v_titles[i],
      TRUE
    )
    ON CONFLICT (code) DO UPDATE
    SET title = EXCLUDED.title,
        description = EXCLUDED.description,
        gift_weight_grams = EXCLUDED.gift_weight_grams,
        gift_label = EXCLUDED.gift_label,
        updated_at = now()
    RETURNING id INTO v_reward_id;

    INSERT INTO public.lottery_collection_page_reward_options (
      page_rarity, reward_definition_id, priority, is_active
    )
    VALUES (
      v_rarities[i]::public.lottery_card_rarity,
      v_reward_id,
      (i * 100),
      TRUE
    )
    ON CONFLICT (page_rarity, reward_definition_id) DO UPDATE
    SET priority = EXCLUDED.priority,
        is_active = TRUE,
        updated_at = now();
  END LOOP;
END
$$;

COMMIT;
