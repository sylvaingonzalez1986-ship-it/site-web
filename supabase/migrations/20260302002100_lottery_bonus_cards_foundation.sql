BEGIN;

CREATE TABLE IF NOT EXISTS public.lottery_bonus_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  quota_per_cycle INTEGER NOT NULL DEFAULT 0 CHECK (quota_per_cycle >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lottery_bonus_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bonus_definition_id UUID NOT NULL REFERENCES public.lottery_bonus_definitions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  kind public.lottery_reward_kind NOT NULL,
  gift_weight_grams INTEGER CHECK (gift_weight_grams IS NULL OR gift_weight_grams > 0),
  gift_product_sku TEXT,
  gift_label TEXT,
  custom_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lottery_cycle_bonus_pool (
  cycle_id BIGINT NOT NULL REFERENCES public.lottery_draw_cycles(id) ON DELETE CASCADE,
  bonus_definition_id UUID NOT NULL REFERENCES public.lottery_bonus_definitions(id) ON DELETE CASCADE,
  quota INTEGER NOT NULL CHECK (quota >= 0),
  remaining INTEGER NOT NULL CHECK (remaining >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cycle_id, bonus_definition_id)
);

CREATE TABLE IF NOT EXISTS public.lottery_bonus_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.lottery_tickets(id) ON DELETE CASCADE,
  cycle_id BIGINT NOT NULL REFERENCES public.lottery_draw_cycles(id) ON DELETE RESTRICT,
  bonus_definition_id UUID NOT NULL REFERENCES public.lottery_bonus_definitions(id) ON DELETE RESTRICT,
  selected_option_id UUID REFERENCES public.lottery_bonus_options(id) ON DELETE SET NULL,
  status public.lottery_reward_claim_status NOT NULL DEFAULT 'available',
  generated_code TEXT,
  reserved_order_id TEXT,
  used_order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  selected_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  UNIQUE (ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_lottery_bonus_instances_user_status
  ON public.lottery_bonus_instances(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lottery_bonus_options_definition
  ON public.lottery_bonus_options(bonus_definition_id, sort_order ASC);

CREATE OR REPLACE FUNCTION public.touch_lottery_bonus_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_lottery_bonus_definitions_updated_at ON public.lottery_bonus_definitions;
CREATE TRIGGER trg_touch_lottery_bonus_definitions_updated_at
BEFORE UPDATE ON public.lottery_bonus_definitions
FOR EACH ROW
EXECUTE FUNCTION public.touch_lottery_bonus_updated_at();

DROP TRIGGER IF EXISTS trg_touch_lottery_bonus_options_updated_at ON public.lottery_bonus_options;
CREATE TRIGGER trg_touch_lottery_bonus_options_updated_at
BEFORE UPDATE ON public.lottery_bonus_options
FOR EACH ROW
EXECUTE FUNCTION public.touch_lottery_bonus_updated_at();

DROP TRIGGER IF EXISTS trg_touch_lottery_cycle_bonus_pool_updated_at ON public.lottery_cycle_bonus_pool;
CREATE TRIGGER trg_touch_lottery_cycle_bonus_pool_updated_at
BEFORE UPDATE ON public.lottery_cycle_bonus_pool
FOR EACH ROW
EXECUTE FUNCTION public.touch_lottery_bonus_updated_at();

CREATE OR REPLACE FUNCTION public.lottery_seed_bonus_pool_for_cycle(
  p_cycle_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.lottery_cycle_bonus_pool (
    cycle_id,
    bonus_definition_id,
    quota,
    remaining,
    created_at,
    updated_at
  )
  SELECT
    p_cycle_id,
    d.id,
    d.quota_per_cycle,
    d.quota_per_cycle,
    now(),
    now()
  FROM public.lottery_bonus_definitions d
  WHERE d.is_active = TRUE
    AND d.quota_per_cycle > 0
  ON CONFLICT (cycle_id, bonus_definition_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.lottery_seed_bonus_pool_for_cycle(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lottery_seed_bonus_pool_for_cycle(BIGINT) TO service_role;

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

  PERFORM public.lottery_seed_bonus_pool_for_cycle(v_inserted.id);

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.lottery_start_next_cycle(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lottery_start_next_cycle(BOOLEAN) TO service_role;

COMMIT;
