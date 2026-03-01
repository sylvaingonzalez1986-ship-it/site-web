BEGIN;

DROP FUNCTION IF EXISTS public.rpc_release_lottery_reward_claims_for_order(TEXT);
DROP FUNCTION IF EXISTS public.rpc_consume_lottery_reward_claims_for_order(TEXT);
DROP FUNCTION IF EXISTS public.rpc_reserve_lottery_reward_claim(UUID, UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.rpc_burn_lottery_reward_line(UUID, UUID);
DROP FUNCTION IF EXISTS public.rpc_redeem_lottery_ticket(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_admin_grant_lottery_tickets(UUID, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_scratch_ticket(UUID, UUID);
DROP FUNCTION IF EXISTS public.rpc_mint_lottery_tickets(UUID, TEXT, NUMERIC);

DROP TABLE IF EXISTS public.lottery_audit_log CASCADE;
DROP TABLE IF EXISTS public.lottery_tickets CASCADE;
DROP TABLE IF EXISTS public.lottery_stickers CASCADE;
DROP TABLE IF EXISTS public.lottery_reward_claims CASCADE;
DROP TABLE IF EXISTS public.lottery_reward_lines CASCADE;
DROP TABLE IF EXISTS public.lottery_reward_rules CASCADE;
DROP TABLE IF EXISTS public.lottery_reward_definitions CASCADE;
DROP TABLE IF EXISTS public.lottery_ticket_counter CASCADE;
DROP TABLE IF EXISTS public.lottery_game_config CASCADE;
DROP TABLE IF EXISTS public.lottery_prizes CASCADE;
DROP TABLE IF EXISTS public.lottery_config CASCADE;

DROP FUNCTION IF EXISTS public.touch_lottery_updated_at();
DROP FUNCTION IF EXISTS public.validate_lottery_probability_budget();

DROP TYPE IF EXISTS public.lottery_reward_claim_status CASCADE;
DROP TYPE IF EXISTS public.lottery_reward_line_status CASCADE;
DROP TYPE IF EXISTS public.lottery_reward_kind CASCADE;
DROP TYPE IF EXISTS public.lottery_reward_level CASCADE;
DROP TYPE IF EXISTS public.lottery_sticker_rarity CASCADE;
DROP TYPE IF EXISTS public.lottery_prize_rarity CASCADE;
DROP TYPE IF EXISTS public.lottery_ticket_status CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lottery_ticket_status') THEN
    CREATE TYPE public.lottery_ticket_status AS ENUM ('available', 'scratched');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lottery_sticker_rarity') THEN
    CREATE TYPE public.lottery_sticker_rarity AS ENUM ('common', 'rare', 'epic');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lottery_reward_level') THEN
    CREATE TYPE public.lottery_reward_level AS ENUM ('common', 'rare', 'epic', 'legendary');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lottery_reward_kind') THEN
    CREATE TYPE public.lottery_reward_kind AS ENUM (
      'discount_percent',
      'gift_weight_grams',
      'gift_product',
      'physical_item',
      'custom'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lottery_reward_line_status') THEN
    CREATE TYPE public.lottery_reward_line_status AS ENUM ('earned', 'claimed', 'frozen');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lottery_reward_claim_status') THEN
    CREATE TYPE public.lottery_reward_claim_status AS ENUM ('available', 'reserved', 'used', 'fulfilled', 'cancelled');
  END IF;
END
$$;

CREATE TABLE public.lottery_reward_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  level public.lottery_reward_level NOT NULL,
  kind public.lottery_reward_kind NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  discount_percent INTEGER CHECK (discount_percent IS NULL OR discount_percent BETWEEN 1 AND 80),
  gift_weight_grams INTEGER CHECK (gift_weight_grams IS NULL OR gift_weight_grams > 0),
  gift_product_sku TEXT,
  gift_label TEXT,
  custom_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  replacement_reward_definition_id UUID REFERENCES public.lottery_reward_definitions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lottery_game_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  euros_per_ticket NUMERIC(10, 2) NOT NULL DEFAULT 5 CHECK (euros_per_ticket > 0),
  max_tickets_per_order INTEGER NOT NULL DEFAULT 4 CHECK (max_tickets_per_order BETWEEN 1 AND 20),
  stickers_per_line INTEGER NOT NULL DEFAULT 10 CHECK (stickers_per_line BETWEEN 1 AND 100),
  legendary_one_over INTEGER NOT NULL DEFAULT 100000 CHECK (legendary_one_over > 0),
  common_weight INTEGER NOT NULL DEFAULT 8500 CHECK (common_weight >= 0),
  rare_weight INTEGER NOT NULL DEFAULT 1300 CHECK (rare_weight >= 0),
  epic_weight INTEGER NOT NULL DEFAULT 200 CHECK (epic_weight >= 0),
  legendary_reward_definition_id UUID REFERENCES public.lottery_reward_definitions(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (common_weight + rare_weight + epic_weight > 0)
);

CREATE TABLE public.lottery_reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sticker_rarity public.lottery_sticker_rarity NOT NULL,
  stickers_required INTEGER NOT NULL DEFAULT 10 CHECK (stickers_required BETWEEN 1 AND 100),
  reward_definition_id UUID NOT NULL REFERENCES public.lottery_reward_definitions(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lottery_ticket_counter (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  next_number INTEGER NOT NULL DEFAULT 1 CHECK (next_number > 0)
);

CREATE TABLE public.lottery_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL UNIQUE,
  order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (order_amount >= 0),
  status public.lottery_ticket_status NOT NULL DEFAULT 'available',
  sticker_id UUID,
  sticker_rarity public.lottery_sticker_rarity,
  legendary_reward_claim_id UUID,
  scratched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lottery_reward_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_rarity public.lottery_sticker_rarity NOT NULL,
  stickers_required INTEGER NOT NULL CHECK (stickers_required > 0),
  reward_rule_id UUID REFERENCES public.lottery_reward_rules(id) ON DELETE SET NULL,
  reward_definition_id UUID REFERENCES public.lottery_reward_definitions(id) ON DELETE SET NULL,
  reward_snapshot JSONB NOT NULL,
  status public.lottery_reward_line_status NOT NULL DEFAULT 'earned',
  freeze_reason TEXT,
  claim_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ
);

CREATE TABLE public.lottery_stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL UNIQUE REFERENCES public.lottery_tickets(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rarity public.lottery_sticker_rarity NOT NULL,
  reward_line_id UUID REFERENCES public.lottery_reward_lines(id) ON DELETE SET NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lottery_reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_line_id UUID UNIQUE REFERENCES public.lottery_reward_lines(id) ON DELETE RESTRICT,
  source_ticket_id UUID UNIQUE REFERENCES public.lottery_tickets(id) ON DELETE RESTRICT,
  reward_definition_id UUID REFERENCES public.lottery_reward_definitions(id) ON DELETE SET NULL,
  reward_snapshot JSONB NOT NULL,
  status public.lottery_reward_claim_status NOT NULL DEFAULT 'available',
  generated_code TEXT,
  discount_percent INTEGER CHECK (discount_percent IS NULL OR discount_percent BETWEEN 1 AND 80),
  gift_weight_grams INTEGER CHECK (gift_weight_grams IS NULL OR gift_weight_grams > 0),
  gift_product_sku TEXT,
  gift_label TEXT,
  reserved_order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  reserved_at TIMESTAMPTZ,
  reserved_until TIMESTAMPTZ,
  used_order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (generated_code IS NULL OR generated_code ~ '^[A-Z0-9-]{6,32}$')
);

ALTER TABLE public.lottery_tickets
  ADD CONSTRAINT fk_lottery_tickets_sticker
  FOREIGN KEY (sticker_id) REFERENCES public.lottery_stickers(id) ON DELETE SET NULL;

ALTER TABLE public.lottery_tickets
  ADD CONSTRAINT fk_lottery_tickets_legendary_claim
  FOREIGN KEY (legendary_reward_claim_id) REFERENCES public.lottery_reward_claims(id) ON DELETE SET NULL;

ALTER TABLE public.lottery_reward_lines
  ADD CONSTRAINT fk_lottery_reward_lines_claim
  FOREIGN KEY (claim_id) REFERENCES public.lottery_reward_claims(id) ON DELETE SET NULL;

CREATE INDEX idx_lottery_tickets_user_status_created
  ON public.lottery_tickets(user_id, status, created_at DESC);
CREATE INDEX idx_lottery_tickets_order
  ON public.lottery_tickets(order_id);
CREATE INDEX idx_lottery_tickets_sticker_rarity
  ON public.lottery_tickets(sticker_rarity, scratched_at DESC);
CREATE INDEX idx_lottery_stickers_user_rarity_unused
  ON public.lottery_stickers(user_id, rarity, created_at)
  WHERE consumed_at IS NULL;
CREATE INDEX idx_lottery_reward_lines_user_created
  ON public.lottery_reward_lines(user_id, created_at DESC);
CREATE INDEX idx_lottery_reward_lines_status
  ON public.lottery_reward_lines(status, created_at DESC);
CREATE INDEX idx_lottery_reward_claims_user_status_created
  ON public.lottery_reward_claims(user_id, status, created_at DESC);
CREATE INDEX idx_lottery_reward_claims_reserved_order
  ON public.lottery_reward_claims(reserved_order_id)
  WHERE reserved_order_id IS NOT NULL;
CREATE UNIQUE INDEX uq_lottery_reward_rules_active_rarity
  ON public.lottery_reward_rules(sticker_rarity)
  WHERE is_active = TRUE;

CREATE TABLE public.lottery_audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.lottery_tickets(id) ON DELETE SET NULL,
  reward_line_id UUID REFERENCES public.lottery_reward_lines(id) ON DELETE SET NULL,
  reward_claim_id UUID REFERENCES public.lottery_reward_claims(id) ON DELETE SET NULL,
  order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lottery_audit_created
  ON public.lottery_audit_log(created_at DESC);

INSERT INTO public.lottery_ticket_counter (id, next_number)
VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lottery_reward_definitions (
  code,
  level,
  kind,
  title,
  description,
  discount_percent,
  gift_weight_grams,
  gift_label,
  is_active
)
VALUES
  (
    'COMMON_DISCOUNT_10',
    'common',
    'discount_percent',
    '10% sur la prochaine commande',
    'Lot commun: 10% de reduction sur la prochaine commande.',
    10,
    NULL,
    NULL,
    TRUE
  ),
  (
    'RARE_DISCOUNT_20',
    'rare',
    'discount_percent',
    '20% sur la prochaine commande',
    'Lot rare: 20% de reduction sur la prochaine commande.',
    20,
    NULL,
    NULL,
    TRUE
  ),
  (
    'EPIC_GIFT_50G',
    'epic',
    'gift_weight_grams',
    '50 g offerts sur la prochaine commande',
    'Lot epique: 50 g offerts sur la prochaine commande.',
    NULL,
    50,
    '50 g offerts sur la prochaine commande',
    TRUE
  ),
  (
    'LEGENDARY_YEAR',
    'legendary',
    'custom',
    '1 an de conso',
    'Le detail du lot legendaire est disponible dans le reglement du jeu promotionnel.',
    NULL,
    NULL,
    '1 an de conso',
    TRUE
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.lottery_game_config (
  id,
  euros_per_ticket,
  max_tickets_per_order,
  stickers_per_line,
  legendary_one_over,
  common_weight,
  rare_weight,
  epic_weight,
  legendary_reward_definition_id,
  is_active
)
SELECT
  1,
  5,
  4,
  10,
  100000,
  8500,
  1300,
  200,
  (
    SELECT id
    FROM public.lottery_reward_definitions
    WHERE code = 'LEGENDARY_YEAR'
    LIMIT 1
  ),
  TRUE
ON CONFLICT (id) DO UPDATE
SET
  euros_per_ticket = EXCLUDED.euros_per_ticket,
  max_tickets_per_order = EXCLUDED.max_tickets_per_order,
  stickers_per_line = EXCLUDED.stickers_per_line,
  legendary_one_over = EXCLUDED.legendary_one_over,
  common_weight = EXCLUDED.common_weight,
  rare_weight = EXCLUDED.rare_weight,
  epic_weight = EXCLUDED.epic_weight,
  legendary_reward_definition_id = EXCLUDED.legendary_reward_definition_id,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.lottery_reward_rules (
  sticker_rarity,
  stickers_required,
  reward_definition_id,
  is_active,
  priority
)
SELECT
  seeded.sticker_rarity,
  10,
  seeded.reward_definition_id,
  TRUE,
  100
FROM (
  VALUES
    ('common'::public.lottery_sticker_rarity, (SELECT id FROM public.lottery_reward_definitions WHERE code = 'COMMON_DISCOUNT_10' LIMIT 1)),
    ('rare'::public.lottery_sticker_rarity, (SELECT id FROM public.lottery_reward_definitions WHERE code = 'RARE_DISCOUNT_20' LIMIT 1)),
    ('epic'::public.lottery_sticker_rarity, (SELECT id FROM public.lottery_reward_definitions WHERE code = 'EPIC_GIFT_50G' LIMIT 1))
) AS seeded(sticker_rarity, reward_definition_id)
WHERE seeded.reward_definition_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.lottery_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_lottery_reward_definitions_updated_at ON public.lottery_reward_definitions;
CREATE TRIGGER trg_touch_lottery_reward_definitions_updated_at
BEFORE UPDATE ON public.lottery_reward_definitions
FOR EACH ROW
EXECUTE FUNCTION public.lottery_touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_lottery_game_config_updated_at ON public.lottery_game_config;
CREATE TRIGGER trg_touch_lottery_game_config_updated_at
BEFORE UPDATE ON public.lottery_game_config
FOR EACH ROW
EXECUTE FUNCTION public.lottery_touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_lottery_reward_rules_updated_at ON public.lottery_reward_rules;
CREATE TRIGGER trg_touch_lottery_reward_rules_updated_at
BEFORE UPDATE ON public.lottery_reward_rules
FOR EACH ROW
EXECUTE FUNCTION public.lottery_touch_updated_at();

CREATE OR REPLACE FUNCTION public.lottery_secure_random_int(p_max_value INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_bytes BYTEA;
  v_number BIGINT;
BEGIN
  IF p_max_value IS NULL OR p_max_value < 1 THEN
    RAISE EXCEPTION 'invalid_max_value';
  END IF;

  v_bytes := extensions.gen_random_bytes(6);
  v_number :=
      (get_byte(v_bytes, 0)::BIGINT << 40) +
      (get_byte(v_bytes, 1)::BIGINT << 32) +
      (get_byte(v_bytes, 2)::BIGINT << 24) +
      (get_byte(v_bytes, 3)::BIGINT << 16) +
      (get_byte(v_bytes, 4)::BIGINT << 8) +
      get_byte(v_bytes, 5)::BIGINT;

  RETURN ((v_number % p_max_value) + 1)::INTEGER;
END;
$$;

CREATE OR REPLACE FUNCTION public.lottery_build_reward_snapshot(
  p_reward_definition_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_definition public.lottery_reward_definitions%ROWTYPE;
BEGIN
  SELECT *
  INTO v_definition
  FROM public.lottery_reward_definitions
  WHERE id = p_reward_definition_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'rewardDefinitionId', NULL,
      'title', 'Lot retire',
      'description', 'Ce lot n''est plus propose.',
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
  END IF;

  RETURN jsonb_build_object(
    'rewardDefinitionId', v_definition.id,
    'title', v_definition.title,
    'description', v_definition.description,
    'level', v_definition.level,
    'kind', v_definition.kind,
    'imageUrl', v_definition.image_url,
    'discountPercent', v_definition.discount_percent,
    'giftWeightGrams', v_definition.gift_weight_grams,
    'giftProductSku', v_definition.gift_product_sku,
    'giftLabel', v_definition.gift_label,
    'customPayload', COALESCE(v_definition.custom_payload, '{}'::jsonb),
    'deleted', (v_definition.deleted_at IS NOT NULL)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lottery_generate_claim_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_candidate TEXT;
BEGIN
  LOOP
    v_candidate := 'LOT-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 12));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.lottery_reward_claims
      WHERE generated_code = v_candidate
    );
  END LOOP;

  RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.lottery_release_expired_claim_reservations(
  p_user_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_released INTEGER := 0;
BEGIN
  UPDATE public.lottery_reward_claims
  SET
    status = 'available',
    reserved_order_id = NULL,
    reserved_at = NULL,
    reserved_until = NULL
  WHERE status = 'reserved'
    AND reserved_until IS NOT NULL
    AND reserved_until < now()
    AND used_at IS NULL
    AND (p_user_id IS NULL OR user_id = p_user_id);

  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

CREATE OR REPLACE FUNCTION public.lottery_create_reward_claim(
  p_user_id UUID,
  p_reward_definition_id UUID,
  p_reward_line_id UUID DEFAULT NULL,
  p_source_ticket_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_definition public.lottery_reward_definitions%ROWTYPE;
  v_snapshot JSONB;
  v_claim_id UUID;
  v_generated_code TEXT;
BEGIN
  IF p_user_id IS NULL OR p_reward_definition_id IS NULL THEN
    RAISE EXCEPTION 'invalid_reward_claim_payload';
  END IF;

  SELECT *
  INTO v_definition
  FROM public.lottery_reward_definitions
  WHERE id = p_reward_definition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reward_definition_not_found';
  END IF;

  v_snapshot := public.lottery_build_reward_snapshot(v_definition.id);
  IF v_definition.kind = 'discount_percent' THEN
    v_generated_code := public.lottery_generate_claim_code();
  ELSE
    v_generated_code := NULL;
  END IF;

  INSERT INTO public.lottery_reward_claims (
    user_id,
    reward_line_id,
    source_ticket_id,
    reward_definition_id,
    reward_snapshot,
    status,
    generated_code,
    discount_percent,
    gift_weight_grams,
    gift_product_sku,
    gift_label
  )
  VALUES (
    p_user_id,
    p_reward_line_id,
    p_source_ticket_id,
    v_definition.id,
    v_snapshot,
    'available',
    v_generated_code,
    v_definition.discount_percent,
    v_definition.gift_weight_grams,
    v_definition.gift_product_sku,
    v_definition.gift_label
  )
  RETURNING id INTO v_claim_id;

  INSERT INTO public.lottery_audit_log (
    event_type,
    user_id,
    ticket_id,
    reward_line_id,
    reward_claim_id,
    details
  )
  VALUES (
    CASE WHEN p_source_ticket_id IS NOT NULL THEN 'legendary_claim_created' ELSE 'reward_claim_created' END,
    p_user_id,
    p_source_ticket_id,
    p_reward_line_id,
    v_claim_id,
    jsonb_build_object(
      'reward_definition_id', v_definition.id,
      'reward_code', v_generated_code,
      'kind', v_definition.kind,
      'level', v_definition.level
    )
  );

  RETURN v_claim_id;
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
  FROM public.lottery_reward_rules
  WHERE sticker_rarity = p_sticker_rarity
    AND is_active = TRUE
  ORDER BY priority ASC, created_at ASC
  LIMIT 1;

  IF FOUND THEN
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
          'stickers_required', v_rule.stickers_required
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
        'reward_definition_id', v_resolved_definition_id
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

CREATE OR REPLACE FUNCTION public.rpc_burn_lottery_reward_line(
  p_line_id UUID,
  p_user_id UUID
)
RETURNS public.lottery_reward_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line public.lottery_reward_lines%ROWTYPE;
  v_claim_id UUID;
  v_claim public.lottery_reward_claims%ROWTYPE;
BEGIN
  IF p_line_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'reward_line_not_found';
  END IF;

  SELECT *
  INTO v_line
  FROM public.lottery_reward_lines
  WHERE id = p_line_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reward_line_not_found';
  END IF;

  IF v_line.status = 'frozen' THEN
    RAISE EXCEPTION 'reward_line_frozen';
  END IF;

  IF v_line.status <> 'earned' OR v_line.claim_id IS NOT NULL OR v_line.reward_definition_id IS NULL THEN
    RAISE EXCEPTION 'reward_line_unavailable';
  END IF;

  v_claim_id := public.lottery_create_reward_claim(
    p_user_id,
    v_line.reward_definition_id,
    v_line.id,
    NULL
  );

  UPDATE public.lottery_reward_lines
  SET
    claim_id = v_claim_id,
    status = 'claimed',
    claimed_at = now()
  WHERE id = v_line.id;

  INSERT INTO public.lottery_audit_log (
    event_type,
    user_id,
    reward_line_id,
    reward_claim_id,
    details
  )
  VALUES (
    'reward_line_burned',
    p_user_id,
    v_line.id,
    v_claim_id,
    jsonb_build_object(
      'sticker_rarity', v_line.sticker_rarity,
      'reward_definition_id', v_line.reward_definition_id
    )
  );

  SELECT *
  INTO v_claim
  FROM public.lottery_reward_claims
  WHERE id = v_claim_id;

  RETURN v_claim;
END;
$$;

ALTER TABLE public.lottery_game_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_reward_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_reward_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_reward_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_ticket_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lottery_game_config_public_read ON public.lottery_game_config;
CREATE POLICY lottery_game_config_public_read
ON public.lottery_game_config
FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS lottery_reward_definitions_public_read ON public.lottery_reward_definitions;
CREATE POLICY lottery_reward_definitions_public_read
ON public.lottery_reward_definitions
FOR SELECT
USING (is_active = TRUE AND deleted_at IS NULL);

DROP POLICY IF EXISTS lottery_reward_rules_public_read ON public.lottery_reward_rules;
CREATE POLICY lottery_reward_rules_public_read
ON public.lottery_reward_rules
FOR SELECT
USING (is_active = TRUE);

DROP POLICY IF EXISTS lottery_tickets_user_read_own ON public.lottery_tickets;
CREATE POLICY lottery_tickets_user_read_own
ON public.lottery_tickets
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS lottery_stickers_user_read_own ON public.lottery_stickers;
CREATE POLICY lottery_stickers_user_read_own
ON public.lottery_stickers
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS lottery_reward_lines_user_read_own ON public.lottery_reward_lines;
CREATE POLICY lottery_reward_lines_user_read_own
ON public.lottery_reward_lines
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS lottery_reward_claims_user_read_own ON public.lottery_reward_claims;
CREATE POLICY lottery_reward_claims_user_read_own
ON public.lottery_reward_claims
FOR SELECT
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.rpc_mint_lottery_tickets(
  p_user_id UUID,
  p_order_id TEXT,
  p_order_amount NUMERIC
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config public.lottery_game_config%ROWTYPE;
  v_ticket_count INTEGER;
  v_start_number INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_order_id IS NULL OR btrim(p_order_id) = '' THEN
    RETURN 0;
  END IF;

  SELECT *
  INTO v_config
  FROM public.lottery_game_config
  WHERE id = 1;

  IF NOT FOUND OR v_config.is_active = FALSE OR v_config.euros_per_ticket <= 0 THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id, 0));

  IF EXISTS (SELECT 1 FROM public.lottery_tickets WHERE order_id = p_order_id) THEN
    RETURN 0;
  END IF;

  v_ticket_count := FLOOR(GREATEST(COALESCE(p_order_amount, 0), 0) / v_config.euros_per_ticket);
  v_ticket_count := LEAST(v_ticket_count, v_config.max_tickets_per_order);

  IF v_ticket_count < 1 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.lottery_ticket_counter (id, next_number)
  VALUES (1, 1)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.lottery_ticket_counter
  SET next_number = next_number + v_ticket_count
  WHERE id = 1
  RETURNING next_number - v_ticket_count INTO v_start_number;

  INSERT INTO public.lottery_tickets (
    user_id,
    order_id,
    ticket_number,
    order_amount,
    status
  )
  SELECT
    p_user_id,
    p_order_id,
    'TICKET-' || lpad((v_start_number + gs)::TEXT, 8, '0'),
    GREATEST(COALESCE(p_order_amount, 0), 0),
    'available'
  FROM generate_series(0, v_ticket_count - 1) AS gs;

  INSERT INTO public.lottery_audit_log (
    event_type,
    user_id,
    order_id,
    details
  )
  VALUES (
    'mint',
    p_user_id,
    p_order_id,
    jsonb_build_object(
      'ticket_count', v_ticket_count,
      'order_amount', GREATEST(COALESCE(p_order_amount, 0), 0),
      'euros_per_ticket', v_config.euros_per_ticket,
      'max_tickets_per_order', v_config.max_tickets_per_order
    )
  );

  RETURN v_ticket_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_grant_lottery_tickets(
  p_user_id UUID,
  p_ticket_count INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_admin_email TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_count INTEGER;
  v_start_number INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user_id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'customer_not_found';
  END IF;

  v_ticket_count := COALESCE(p_ticket_count, 0);
  IF v_ticket_count < 1 OR v_ticket_count > 200 THEN
    RAISE EXCEPTION 'invalid_ticket_count';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('lottery_ticket_counter', 0));

  INSERT INTO public.lottery_ticket_counter (id, next_number)
  VALUES (1, 1)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.lottery_ticket_counter
  SET next_number = next_number + v_ticket_count
  WHERE id = 1
  RETURNING next_number - v_ticket_count INTO v_start_number;

  INSERT INTO public.lottery_tickets (
    user_id,
    order_id,
    ticket_number,
    order_amount,
    status
  )
  SELECT
    p_user_id,
    NULL,
    'TICKET-' || lpad((v_start_number + gs)::TEXT, 8, '0'),
    0,
    'available'
  FROM generate_series(0, v_ticket_count - 1) AS gs;

  INSERT INTO public.lottery_audit_log (
    event_type,
    user_id,
    details
  )
  VALUES (
    'admin_grant',
    p_user_id,
    jsonb_build_object(
      'ticket_count', v_ticket_count,
      'reason', LEFT(COALESCE(NULLIF(BTRIM(p_reason), ''), 'Attribution manuelle admin'), 300),
      'admin_email', LEFT(COALESCE(BTRIM(p_admin_email), ''), 200)
    )
  );

  RETURN v_ticket_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_scratch_ticket(
  p_ticket_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.lottery_tickets%ROWTYPE;
  v_config public.lottery_game_config%ROWTYPE;
  v_total_weight INTEGER;
  v_roll INTEGER;
  v_sticker_rarity public.lottery_sticker_rarity;
  v_sticker_id UUID;
  v_line_id UUID;
  v_claim_id UUID;
  v_legendary_claim_id UUID;
  v_legendary_snapshot JSONB;
  v_scratched_at TIMESTAMPTZ;
  v_common_count INTEGER;
  v_rare_count INTEGER;
  v_epic_count INTEGER;
BEGIN
  IF p_ticket_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'ticket_not_found_or_already_scratched';
  END IF;

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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lottery_config_missing';
  END IF;

  v_total_weight := v_config.common_weight + v_config.rare_weight + v_config.epic_weight;
  IF v_total_weight < 1 THEN
    RAISE EXCEPTION 'invalid_sticker_weights';
  END IF;

  v_roll := public.lottery_secure_random_int(v_total_weight);
  IF v_roll <= v_config.common_weight THEN
    v_sticker_rarity := 'common';
  ELSIF v_roll <= (v_config.common_weight + v_config.rare_weight) THEN
    v_sticker_rarity := 'rare';
  ELSE
    v_sticker_rarity := 'epic';
  END IF;

  INSERT INTO public.lottery_stickers (
    ticket_id,
    user_id,
    rarity
  )
  VALUES (
    v_ticket.id,
    p_user_id,
    v_sticker_rarity
  )
  RETURNING id INTO v_sticker_id;

  IF v_config.legendary_reward_definition_id IS NOT NULL
     AND v_config.legendary_one_over > 0
     AND public.lottery_secure_random_int(v_config.legendary_one_over) = 1 THEN
    v_legendary_claim_id := public.lottery_create_reward_claim(
      p_user_id,
      v_config.legendary_reward_definition_id,
      NULL,
      v_ticket.id
    );

    SELECT reward_snapshot
    INTO v_legendary_snapshot
    FROM public.lottery_reward_claims
    WHERE id = v_legendary_claim_id;
  END IF;

  SELECT reward_line_id, reward_claim_id
  INTO v_line_id, v_claim_id
  FROM public.lottery_materialize_reward_line(
    p_user_id,
    v_sticker_rarity
  );

  UPDATE public.lottery_tickets
  SET
    status = 'scratched',
    sticker_id = v_sticker_id,
    sticker_rarity = v_sticker_rarity,
    legendary_reward_claim_id = v_legendary_claim_id,
    scratched_at = now()
  WHERE id = v_ticket.id
  RETURNING scratched_at INTO v_scratched_at;

  INSERT INTO public.lottery_audit_log (
    event_type,
    user_id,
    ticket_id,
    reward_line_id,
    reward_claim_id,
    details
  )
  VALUES (
    'scratch',
    p_user_id,
    v_ticket.id,
    v_line_id,
    COALESCE(v_legendary_claim_id, v_claim_id),
    jsonb_build_object(
      'sticker_rarity', v_sticker_rarity,
      'legendary_claim_id', v_legendary_claim_id,
      'reward_line_id', v_line_id,
      'reward_claim_id', v_claim_id
    )
  );

  SELECT COUNT(*)
  INTO v_common_count
  FROM public.lottery_stickers
  WHERE user_id = p_user_id
    AND rarity = 'common'
    AND consumed_at IS NULL;

  SELECT COUNT(*)
  INTO v_rare_count
  FROM public.lottery_stickers
  WHERE user_id = p_user_id
    AND rarity = 'rare'
    AND consumed_at IS NULL;

  SELECT COUNT(*)
  INTO v_epic_count
  FROM public.lottery_stickers
  WHERE user_id = p_user_id
    AND rarity = 'epic'
    AND consumed_at IS NULL;

  RETURN jsonb_build_object(
    'ticketId', v_ticket.id,
    'ticketNumber', v_ticket.ticket_number,
    'scratchedAt', v_scratched_at,
    'sticker', jsonb_build_object(
      'id', v_sticker_id,
      'rarity', v_sticker_rarity
    ),
    'rewardLine', CASE
      WHEN v_line_id IS NULL THEN NULL
      ELSE (
        SELECT jsonb_build_object(
          'id', l.id,
          'status', l.status,
          'stickerRarity', l.sticker_rarity,
          'stickersRequired', l.stickers_required,
          'title', COALESCE(l.reward_snapshot->>'title', 'Lot'),
          'description', COALESCE(l.reward_snapshot->>'description', ''),
          'freezeReason', l.freeze_reason
        )
        FROM public.lottery_reward_lines AS l
        WHERE l.id = v_line_id
      )
    END,
    'legendaryRewardClaim', CASE
      WHEN v_legendary_claim_id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', v_legendary_claim_id,
        'title', COALESCE(v_legendary_snapshot->>'title', 'Lot legendaire'),
        'description', COALESCE(v_legendary_snapshot->>'description', ''),
        'level', v_legendary_snapshot->>'level',
        'kind', v_legendary_snapshot->>'kind',
        'generatedCode', (
          SELECT generated_code
          FROM public.lottery_reward_claims
          WHERE id = v_legendary_claim_id
        )
      )
    END,
    'inventory', jsonb_build_object(
      'common', v_common_count,
      'rare', v_rare_count,
      'epic', v_epic_count
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_reserve_lottery_reward_claim(
  p_claim_id UUID,
  p_user_id UUID,
  p_order_id TEXT,
  p_reservation_minutes INTEGER DEFAULT 120
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim public.lottery_reward_claims%ROWTYPE;
  v_duration INTERVAL;
BEGIN
  IF p_claim_id IS NULL OR p_user_id IS NULL OR p_order_id IS NULL OR btrim(p_order_id) = '' THEN
    RAISE EXCEPTION 'invalid_reward_claim_payload';
  END IF;

  PERFORM public.lottery_release_expired_claim_reservations(p_user_id);

  v_duration := make_interval(mins => GREATEST(COALESCE(p_reservation_minutes, 120), 5));

  SELECT *
  INTO v_claim
  FROM public.lottery_reward_claims
  WHERE id = p_claim_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reward_claim_not_found';
  END IF;

  IF v_claim.status IN ('used', 'fulfilled', 'cancelled') THEN
    RAISE EXCEPTION 'reward_claim_unavailable';
  END IF;

  IF v_claim.status = 'reserved'
     AND v_claim.reserved_order_id IS NOT NULL
     AND v_claim.reserved_order_id <> p_order_id
     AND (v_claim.reserved_until IS NULL OR v_claim.reserved_until >= now()) THEN
    RAISE EXCEPTION 'reward_claim_already_reserved';
  END IF;

  UPDATE public.lottery_reward_claims
  SET
    status = 'reserved',
    reserved_order_id = p_order_id,
    reserved_at = now(),
    reserved_until = now() + v_duration
  WHERE id = v_claim.id;

  INSERT INTO public.lottery_audit_log (
    event_type,
    user_id,
    reward_claim_id,
    order_id,
    details
  )
  VALUES (
    'reward_claim_reserved',
    p_user_id,
    v_claim.id,
    p_order_id,
    jsonb_build_object(
      'reserved_until', now() + v_duration
    )
  );

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_consume_lottery_reward_claims_for_order(
  p_order_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consumed_count INTEGER := 0;
BEGIN
  IF p_order_id IS NULL OR btrim(p_order_id) = '' THEN
    RETURN 0;
  END IF;

  WITH updated_claims AS (
    UPDATE public.lottery_reward_claims
    SET
      status = 'used',
      used_order_id = p_order_id,
      used_at = now(),
      reserved_order_id = NULL,
      reserved_at = NULL,
      reserved_until = NULL
    WHERE reserved_order_id = p_order_id
      AND status = 'reserved'
    RETURNING id, user_id, reward_line_id
  )
  SELECT COUNT(*)
  INTO v_consumed_count
  FROM updated_claims;

  UPDATE public.lottery_reward_lines
  SET
    status = 'claimed',
    claimed_at = now()
  WHERE claim_id IN (
    SELECT id
    FROM public.lottery_reward_claims
    WHERE used_order_id = p_order_id
      AND used_at IS NOT NULL
  )
    AND status <> 'claimed';

  IF v_consumed_count > 0 THEN
    INSERT INTO public.lottery_audit_log (
      event_type,
      order_id,
      details
    )
    VALUES (
      'reward_claim_consumed',
      p_order_id,
      jsonb_build_object(
        'claims_count', v_consumed_count
      )
    );
  END IF;

  RETURN v_consumed_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_release_lottery_reward_claims_for_order(
  p_order_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released_count INTEGER := 0;
BEGIN
  IF p_order_id IS NULL OR btrim(p_order_id) = '' THEN
    RETURN 0;
  END IF;

  UPDATE public.lottery_reward_claims
  SET
    status = 'available',
    reserved_order_id = NULL,
    reserved_at = NULL,
    reserved_until = NULL
  WHERE reserved_order_id = p_order_id
    AND status = 'reserved'
    AND used_at IS NULL;

  GET DIAGNOSTICS v_released_count = ROW_COUNT;

  IF v_released_count > 0 THEN
    INSERT INTO public.lottery_audit_log (
      event_type,
      order_id,
      details
    )
    VALUES (
      'reward_claim_released',
      p_order_id,
      jsonb_build_object(
        'claims_count', v_released_count
      )
    );
  END IF;

  RETURN v_released_count;
END;
$$;

REVOKE ALL ON FUNCTION public.lottery_secure_random_int(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lottery_build_reward_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lottery_generate_claim_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lottery_release_expired_claim_reservations(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lottery_create_reward_claim(UUID, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lottery_materialize_reward_line(UUID, public.lottery_sticker_rarity) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_burn_lottery_reward_line(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_mint_lottery_tickets(UUID, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_admin_grant_lottery_tickets(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_scratch_ticket(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_reserve_lottery_reward_claim(UUID, UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_consume_lottery_reward_claims_for_order(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_release_lottery_reward_claims_for_order(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.lottery_secure_random_int(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.lottery_build_reward_snapshot(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.lottery_generate_claim_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.lottery_release_expired_claim_reservations(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.lottery_create_reward_claim(UUID, UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.lottery_materialize_reward_line(UUID, public.lottery_sticker_rarity) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_burn_lottery_reward_line(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_mint_lottery_tickets(UUID, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_admin_grant_lottery_tickets(UUID, INTEGER, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_scratch_ticket(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_reserve_lottery_reward_claim(UUID, UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_consume_lottery_reward_claims_for_order(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_release_lottery_reward_claims_for_order(TEXT) TO service_role;

COMMIT;
