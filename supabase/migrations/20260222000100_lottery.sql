BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lottery_ticket_status') THEN
    CREATE TYPE lottery_ticket_status AS ENUM ('available', 'scratched');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lottery_prize_rarity') THEN
    CREATE TYPE lottery_prize_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS lottery_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ticket_threshold_euros NUMERIC(10, 2) NOT NULL DEFAULT 20 CHECK (ticket_threshold_euros > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO lottery_config (id, ticket_threshold_euros, is_active)
VALUES (1, 20, TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS lottery_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rarity lottery_prize_rarity NOT NULL,
  probability NUMERIC(8, 6) NOT NULL CHECK (probability >= 0 AND probability <= 1),
  image_url TEXT NOT NULL DEFAULT '',
  value_euros NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (value_euros >= 0),
  stock INTEGER CHECK (stock IS NULL OR stock >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO lottery_prizes (
  name,
  description,
  rarity,
  probability,
  image_url,
  value_euros,
  stock,
  is_active
)
SELECT *
FROM (
  VALUES
    (
      'Reduction 10% prochaine commande',
      'Bon de reduction permanent de 10% sur la prochaine commande.',
      'common'::lottery_prize_rarity,
      0.225000::NUMERIC(8, 6),
      '',
      0::NUMERIC(10, 2),
      NULL::INTEGER,
      TRUE
    ),
    (
      '1 g offert',
      'Produit offert equivalent a 1 g.',
      'common'::lottery_prize_rarity,
      0.225000::NUMERIC(8, 6),
      '',
      0::NUMERIC(10, 2),
      NULL::INTEGER,
      TRUE
    ),
    (
      'Reduction 50% prochaine commande (rare)',
      'Bon de reduction de 50% sur la prochaine commande.',
      'rare'::lottery_prize_rarity,
      0.020000::NUMERIC(8, 6),
      '',
      0::NUMERIC(10, 2),
      NULL::INTEGER,
      TRUE
    ),
    (
      '10 g offerts',
      'Produit offert equivalent a 10 g.',
      'rare'::lottery_prize_rarity,
      0.020000::NUMERIC(8, 6),
      '',
      0::NUMERIC(10, 2),
      NULL::INTEGER,
      TRUE
    ),
    (
      'Reduction 50% prochaine commande (epique)',
      'Bon de reduction de 50% sur la prochaine commande.',
      'epic'::lottery_prize_rarity,
      0.004950::NUMERIC(8, 6),
      '',
      0::NUMERIC(10, 2),
      NULL::INTEGER,
      TRUE
    ),
    (
      '50 g offerts',
      'Produit offert equivalent a 50 g.',
      'epic'::lottery_prize_rarity,
      0.004950::NUMERIC(8, 6),
      '',
      0::NUMERIC(10, 2),
      NULL::INTEGER,
      TRUE
    ),
    (
      '1 an de consommation offerte',
      'Avantage exceptionnel: 1 an de consommation offerte.',
      'legendary'::lottery_prize_rarity,
      0.000100::NUMERIC(8, 6),
      '',
      0::NUMERIC(10, 2),
      NULL::INTEGER,
      TRUE
    )
) AS seeded(
  name,
  description,
  rarity,
  probability,
  image_url,
  value_euros,
  stock,
  is_active
)
WHERE NOT EXISTS (SELECT 1 FROM lottery_prizes);

CREATE TABLE IF NOT EXISTS lottery_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL UNIQUE,
  order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (order_amount >= 0),
  status lottery_ticket_status NOT NULL DEFAULT 'available',
  prize_id UUID REFERENCES lottery_prizes(id) ON DELETE SET NULL,
  is_win BOOLEAN,
  scratched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lottery_ticket_counter (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  next_number INTEGER NOT NULL DEFAULT 1 CHECK (next_number > 0)
);

INSERT INTO lottery_ticket_counter (id, next_number)
VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS lottery_audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES lottery_tickets(id) ON DELETE SET NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lottery_tickets_user_status_created
  ON lottery_tickets(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lottery_tickets_order ON lottery_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_lottery_tickets_prize ON lottery_tickets(prize_id);
CREATE INDEX IF NOT EXISTS idx_lottery_audit_created ON lottery_audit_log(created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_lottery_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_lottery_config_updated_at ON lottery_config;
CREATE TRIGGER trg_touch_lottery_config_updated_at
BEFORE UPDATE ON lottery_config
FOR EACH ROW
EXECUTE FUNCTION public.touch_lottery_updated_at();

DROP TRIGGER IF EXISTS trg_touch_lottery_prizes_updated_at ON lottery_prizes;
CREATE TRIGGER trg_touch_lottery_prizes_updated_at
BEFORE UPDATE ON lottery_prizes
FOR EACH ROW
EXECUTE FUNCTION public.touch_lottery_updated_at();

CREATE OR REPLACE FUNCTION public.validate_lottery_probability_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_sum NUMERIC(12, 6);
BEGIN
  SELECT COALESCE(SUM(probability), 0)
  INTO v_sum
  FROM lottery_prizes
  WHERE is_active = TRUE
    AND id <> COALESCE(NEW.id, OLD.id);

  IF TG_OP <> 'DELETE' AND NEW.is_active = TRUE THEN
    v_sum := v_sum + NEW.probability;
  END IF;

  IF v_sum > 1 THEN
    RAISE EXCEPTION 'LOTTERY_PROBABILITY_SUM_EXCEEDED';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_lottery_probability_budget ON lottery_prizes;
CREATE TRIGGER trg_validate_lottery_probability_budget
BEFORE INSERT OR UPDATE OR DELETE ON lottery_prizes
FOR EACH ROW
EXECUTE FUNCTION public.validate_lottery_probability_budget();

ALTER TABLE lottery_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_ticket_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lottery_config_public_read ON lottery_config;

DROP POLICY IF EXISTS lottery_prizes_public_read ON lottery_prizes;

DROP POLICY IF EXISTS lottery_tickets_user_read_own ON lottery_tickets;
CREATE POLICY lottery_tickets_user_read_own
ON lottery_tickets
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
  v_threshold NUMERIC(10, 2);
  v_is_active BOOLEAN;
  v_ticket_count INTEGER;
  v_start_number INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_order_id IS NULL OR btrim(p_order_id) = '' THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id, 0));

  IF EXISTS (SELECT 1 FROM lottery_tickets WHERE order_id = p_order_id) THEN
    RETURN 0;
  END IF;

  SELECT ticket_threshold_euros, is_active
  INTO v_threshold, v_is_active
  FROM lottery_config
  WHERE id = 1;

  IF v_threshold IS NULL THEN
    v_threshold := 20;
  END IF;

  IF COALESCE(v_is_active, FALSE) = FALSE OR v_threshold <= 0 THEN
    RETURN 0;
  END IF;

  v_ticket_count := FLOOR(GREATEST(COALESCE(p_order_amount, 0), 0) / v_threshold);

  IF v_ticket_count < 1 THEN
    RETURN 0;
  END IF;

  INSERT INTO lottery_ticket_counter (id, next_number)
  VALUES (1, 1)
  ON CONFLICT (id) DO NOTHING;

  UPDATE lottery_ticket_counter
  SET next_number = next_number + v_ticket_count
  WHERE id = 1
  RETURNING next_number - v_ticket_count INTO v_start_number;

  INSERT INTO lottery_tickets (
    user_id,
    order_id,
    ticket_number,
    order_amount,
    status
  )
  SELECT
    p_user_id,
    p_order_id,
    'TICKET-' || lpad((v_start_number + gs)::text, 8, '0'),
    GREATEST(COALESCE(p_order_amount, 0), 0),
    'available'
  FROM generate_series(0, v_ticket_count - 1) AS gs;

  INSERT INTO lottery_audit_log (
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
      'threshold', v_threshold
    )
  );

  RETURN v_ticket_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_scratch_ticket(
  p_ticket_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  ticket_id UUID,
  ticket_number TEXT,
  is_win BOOLEAN,
  prize_id UUID,
  prize_name TEXT,
  prize_description TEXT,
  prize_rarity lottery_prize_rarity,
  prize_image_url TEXT,
  prize_value_euros NUMERIC,
  scratched_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket lottery_tickets%ROWTYPE;
  v_draw lottery_prizes%ROWTYPE;
  v_selected_prize_id UUID;
  v_roll NUMERIC;
  v_cumulative NUMERIC := 0;
  v_scratched_at TIMESTAMPTZ;
BEGIN
  IF p_ticket_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'ticket_not_found_or_already_scratched';
  END IF;

  SELECT *
  INTO v_ticket
  FROM lottery_tickets
  WHERE id = p_ticket_id
    AND user_id = p_user_id
    AND status = 'available'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket_not_found_or_already_scratched';
  END IF;

  v_roll := random();

  FOR v_draw IN
    SELECT *
    FROM lottery_prizes
    WHERE is_active = TRUE
      AND (stock IS NULL OR stock > 0)
    ORDER BY probability DESC, created_at ASC
  LOOP
    v_cumulative := v_cumulative + v_draw.probability;
    IF v_roll < v_cumulative THEN
      v_selected_prize_id := v_draw.id;
      EXIT;
    END IF;
  END LOOP;

  IF v_selected_prize_id IS NOT NULL THEN
    SELECT *
    INTO v_draw
    FROM lottery_prizes
    WHERE id = v_selected_prize_id
    FOR UPDATE;

    IF v_draw.stock IS NOT NULL THEN
      UPDATE lottery_prizes
      SET stock = stock - 1
      WHERE id = v_selected_prize_id
        AND stock > 0
      RETURNING * INTO v_draw;

      IF NOT FOUND THEN
        v_selected_prize_id := NULL;
      END IF;
    END IF;
  END IF;

  UPDATE lottery_tickets
  SET
    status = 'scratched',
    scratched_at = now(),
    prize_id = v_selected_prize_id,
    is_win = (v_selected_prize_id IS NOT NULL)
  WHERE id = v_ticket.id
  RETURNING lottery_tickets.scratched_at INTO v_scratched_at;

  INSERT INTO lottery_audit_log (
    event_type,
    user_id,
    ticket_id,
    order_id,
    details
  )
  VALUES (
    'scratch',
    p_user_id,
    v_ticket.id,
    v_ticket.order_id,
    jsonb_build_object(
      'roll', v_roll,
      'selected_prize_id', v_selected_prize_id,
      'is_win', (v_selected_prize_id IS NOT NULL)
    )
  );

  IF v_selected_prize_id IS NULL THEN
    RETURN QUERY
    SELECT
      v_ticket.id,
      v_ticket.ticket_number,
      FALSE,
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      NULL::lottery_prize_rarity,
      NULL::TEXT,
      NULL::NUMERIC,
      v_scratched_at;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_ticket.id,
    v_ticket.ticket_number,
    TRUE,
    v_draw.id,
    v_draw.name,
    v_draw.description,
    v_draw.rarity,
    v_draw.image_url,
    v_draw.value_euros,
    v_scratched_at;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_mint_lottery_tickets(UUID, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_scratch_ticket(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_mint_lottery_tickets(UUID, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_scratch_ticket(UUID, UUID) TO service_role;

COMMIT;
