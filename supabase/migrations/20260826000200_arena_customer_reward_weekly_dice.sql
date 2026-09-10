BEGIN;

-- The commercial contribution rate is now chosen collectively every week.
-- Every Arena player can roll once; the rounded average selects 1/4/7/10%.
ALTER TABLE public.arena_customer_reward_seasons
  ALTER COLUMN contribution_bps SET DEFAULT 100;

ALTER TABLE public.arena_customer_reward_weeks
  ADD COLUMN IF NOT EXISTS contribution_bps INTEGER NOT NULL DEFAULT 1000
    CHECK (contribution_bps IN (100, 400, 700, 1000)),
  ADD COLUMN IF NOT EXISTS dice_roll_count INTEGER NOT NULL DEFAULT 0
    CHECK (dice_roll_count >= 0),
  ADD COLUMN IF NOT EXISTS dice_average NUMERIC(4, 2)
    CHECK (dice_average IS NULL OR dice_average BETWEEN 1 AND 6);

ALTER TABLE public.arena_customer_reward_weeks
  ALTER COLUMN contribution_bps SET DEFAULT 100;

CREATE TABLE IF NOT EXISTS public.arena_customer_reward_week_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_code TEXT NOT NULL,
  week_start DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  dice_value SMALLINT NOT NULL CHECK (dice_value BETWEEN 1 AND 6),
  rolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_code, week_start, user_id),
  FOREIGN KEY (season_code, week_start)
    REFERENCES public.arena_customer_reward_weeks(season_code, week_start)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_arena_customer_reward_week_rolls_week
  ON public.arena_customer_reward_week_rolls(season_code, week_start, rolled_at);

CREATE OR REPLACE FUNCTION public.arena_customer_reward_rate_from_dice(p_average NUMERIC)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_average IS NULL OR p_average < 2.5 THEN 100
    WHEN p_average < 3.5 THEN 400
    WHEN p_average < 4.5 THEN 700
    ELSE 1000
  END;
$$;

UPDATE public.arena_customer_reward_seasons
SET contribution_bps = 100,
    formula_version = 'arena-customer-dice-v2',
    updated_at = now()
WHERE status IN ('planned', 'active');

CREATE OR REPLACE FUNCTION public.rpc_arena_refresh_customer_reward_pool(
  p_season_code TEXT,
  p_finalize_previous_weeks BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season public.arena_customer_reward_seasons%ROWTYPE;
  v_current_week DATE;
  v_total NUMERIC(14, 1) := 0;
  v_current NUMERIC(14, 1) := 0;
  v_current_sales NUMERIC(14, 1) := 0;
  v_current_rate INTEGER := 100;
  v_current_roll_count INTEGER := 0;
  v_current_average NUMERIC(4, 2);
  v_adjustments NUMERIC(14, 1) := 0;
  v_last_final RECORD;
BEGIN
  SELECT * INTO v_season
  FROM public.arena_customer_reward_seasons
  WHERE season_code = p_season_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'arena_customer_reward_season_not_found'; END IF;

  v_current_week := date_trunc(
    'week',
    timezone(
      'Europe/Paris',
      CASE
        WHEN v_season.status IN ('frozen', 'settled') AND v_season.ends_at IS NOT NULL THEN v_season.ends_at
        ELSE now()
      END
    )
  )::DATE;

  -- Provisional sales and rolls remain live. Final weeks are immutable.
  UPDATE public.arena_customer_reward_weeks
  SET eligible_order_count = 0,
      eligible_flower_grams = 0,
      contribution_grams = 0,
      dice_roll_count = 0,
      dice_average = NULL,
      contribution_bps = 100,
      computed_at = now()
  WHERE season_code = v_season.season_code
    AND status = 'provisional';

  INSERT INTO public.arena_customer_reward_weeks (
    season_code, week_start, week_end, eligible_order_count,
    eligible_flower_grams, contribution_grams, contribution_bps, computed_at
  )
  SELECT v_season.season_code,
         source.week_start,
         source.week_start + 7,
         count(DISTINCT source.order_id)::INTEGER,
         round(sum(source.line_grams), 1),
         round(sum(source.line_grams) / 100.0, 1),
         100,
         now()
  FROM (
    SELECT o.id AS order_id,
           date_trunc('week', timezone('Europe/Paris', o.paid_at))::DATE AS week_start,
           item.quantity * item.unit_weight_grams AS line_grams
    FROM public.orders o
    JOIN public.order_items item ON item.order_id = o.id
    WHERE o.payment_state = 'paid'
      AND o.status <> 'cancelled'
      AND o.archived_at IS NULL
      AND o.paid_at IS NOT NULL
      AND o.paid_at >= v_season.starts_at
      AND (v_season.ends_at IS NULL OR o.paid_at < v_season.ends_at)
      AND item.product_category = 'fleurs'
      AND item.unit_weight_grams > 0
      AND item.quantity > 0
      AND item.line_total > 0
  ) source
  GROUP BY source.week_start
  ON CONFLICT (season_code, week_start) DO UPDATE SET
    eligible_order_count = EXCLUDED.eligible_order_count,
    eligible_flower_grams = EXCLUDED.eligible_flower_grams,
    contribution_grams = EXCLUDED.contribution_grams,
    computed_at = now()
  WHERE public.arena_customer_reward_weeks.status = 'provisional';

  INSERT INTO public.arena_customer_reward_weeks (season_code, week_start, week_end)
  VALUES (v_season.season_code, v_current_week, v_current_week + 7)
  ON CONFLICT (season_code, week_start) DO NOTHING;

  WITH provisional_dice AS (
    SELECT reward_week.id,
           count(roll.id)::INTEGER AS roll_count,
           round(avg(roll.dice_value), 2) AS roll_average
    FROM public.arena_customer_reward_weeks reward_week
    LEFT JOIN public.arena_customer_reward_week_rolls roll
      ON roll.season_code = reward_week.season_code
     AND roll.week_start = reward_week.week_start
    WHERE reward_week.season_code = v_season.season_code
      AND reward_week.status = 'provisional'
    GROUP BY reward_week.id
  )
  UPDATE public.arena_customer_reward_weeks reward_week
  SET dice_roll_count = provisional_dice.roll_count,
      dice_average = provisional_dice.roll_average,
      contribution_bps = public.arena_customer_reward_rate_from_dice(provisional_dice.roll_average),
      contribution_grams = round(
        reward_week.eligible_flower_grams
        * public.arena_customer_reward_rate_from_dice(provisional_dice.roll_average)
        / 10000.0,
        1
      ),
      computed_at = now()
  FROM provisional_dice
  WHERE reward_week.id = provisional_dice.id;

  IF p_finalize_previous_weeks THEN
    UPDATE public.arena_customer_reward_weeks
    SET status = 'final', finalized_at = now(), computed_at = now()
    WHERE season_code = v_season.season_code
      AND week_start < v_current_week
      AND status = 'provisional';
  END IF;

  SELECT COALESCE(sum(contribution_grams), 0)::NUMERIC(14, 1)
  INTO v_total
  FROM public.arena_customer_reward_weeks
  WHERE season_code = v_season.season_code;

  SELECT COALESCE(sum(grams), 0)::NUMERIC(14, 1)
  INTO v_adjustments
  FROM public.arena_customer_reward_adjustments
  WHERE season_code = v_season.season_code;

  SELECT contribution_grams,
         eligible_flower_grams,
         contribution_bps,
         dice_roll_count,
         dice_average
  INTO v_current, v_current_sales, v_current_rate, v_current_roll_count, v_current_average
  FROM public.arena_customer_reward_weeks
  WHERE season_code = v_season.season_code AND week_start = v_current_week;

  SELECT week_start, week_end, contribution_grams, eligible_flower_grams,
         contribution_bps, dice_roll_count, dice_average
  INTO v_last_final
  FROM public.arena_customer_reward_weeks
  WHERE season_code = v_season.season_code AND status = 'final'
  ORDER BY week_start DESC LIMIT 1;

  RETURN jsonb_build_object(
    'seasonCode', v_season.season_code,
    'status', v_season.status,
    'formulaVersion', v_season.formula_version,
    'contributionRateBps', COALESCE(v_current_rate, 100),
    'surpriseShareBps', v_season.surprise_bps,
    'minHumanBattles', v_season.min_human_battles,
    'startsAt', v_season.starts_at,
    'endsAt', v_season.ends_at,
    'poolGrams', GREATEST(0, v_total + v_adjustments),
    'currentWeekGrams', COALESCE(v_current, 0),
    'updatedAt', now(),
    'weeklyDice', jsonb_build_object(
      'startsOn', v_current_week,
      'endsOn', v_current_week + 7,
      'rollCount', COALESCE(v_current_roll_count, 0),
      'average', v_current_average,
      'rateBps', COALESCE(v_current_rate, 100),
      'eligibleFlowerGrams', COALESCE(v_current_sales, 0),
      'contributionGrams', COALESCE(v_current, 0)
    ),
    'lastFinalWeek', CASE WHEN v_last_final.week_start IS NULL THEN NULL ELSE jsonb_build_object(
      'startsOn', v_last_final.week_start,
      'endsOn', v_last_final.week_end,
      'contributionGrams', v_last_final.contribution_grams,
      'eligibleFlowerGrams', v_last_final.eligible_flower_grams,
      'contributionRateBps', v_last_final.contribution_bps,
      'diceRollCount', v_last_final.dice_roll_count,
      'diceAverage', v_last_final.dice_average
    ) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_arena_roll_customer_reward_dice(
  p_season_code TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season public.arena_customer_reward_seasons%ROWTYPE;
  v_week_start DATE;
  v_roll SMALLINT;
  v_pool JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('arena-customer-reward-dice:' || p_season_code || ':' || p_user_id::TEXT, 0)
  );

  SELECT * INTO v_season
  FROM public.arena_customer_reward_seasons
  WHERE season_code = p_season_code
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arena_customer_reward_season_not_found'; END IF;
  IF v_season.status <> 'active' THEN RAISE EXCEPTION 'arena_customer_reward_dice_closed'; END IF;
  IF now() < v_season.starts_at OR (v_season.ends_at IS NOT NULL AND now() >= v_season.ends_at) THEN
    RAISE EXCEPTION 'arena_customer_reward_dice_closed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kq_rank_profiles
    WHERE season_code = p_season_code AND user_id = p_user_id
  ) THEN RAISE EXCEPTION 'arena_customer_reward_dice_player_required'; END IF;

  v_week_start := date_trunc('week', timezone('Europe/Paris', now()))::DATE;
  v_pool := public.rpc_arena_refresh_customer_reward_pool(p_season_code, FALSE);

  SELECT dice_value INTO v_roll
  FROM public.arena_customer_reward_week_rolls
  WHERE season_code = p_season_code
    AND week_start = v_week_start
    AND user_id = p_user_id;
  IF FOUND THEN
    RETURN v_pool || jsonb_build_object('viewerRoll', v_roll, 'alreadyRolled', TRUE);
  END IF;

  v_roll := public.lottery_secure_random_int(1, 6)::SMALLINT;
  INSERT INTO public.arena_customer_reward_week_rolls (
    season_code, week_start, user_id, dice_value
  ) VALUES (
    p_season_code, v_week_start, p_user_id, v_roll
  );

  v_pool := public.rpc_arena_refresh_customer_reward_pool(p_season_code, FALSE);
  RETURN v_pool || jsonb_build_object('viewerRoll', v_roll, 'alreadyRolled', FALSE);
END;
$$;

ALTER TABLE public.arena_customer_reward_week_rolls ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.arena_customer_reward_week_rolls FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_customer_reward_rate_from_dice(NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_arena_roll_customer_reward_dice(TEXT, UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.arena_customer_reward_rate_from_dice(NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_arena_roll_customer_reward_dice(TEXT, UUID) TO service_role;

COMMENT ON TABLE public.arena_customer_reward_week_rolls IS
  'One free collective Arena dice roll per player and week; rolls only choose the commercial contribution rate.';
COMMENT ON COLUMN public.arena_customer_reward_weeks.contribution_bps IS
  'Weekly rate selected from 1/4/7/10 percent by the rounded collective dice average.';
COMMENT ON TABLE public.arena_customer_reward_seasons IS
  'Commercial Arena customer benefit funded by a weekly collective dice rate applied to paid flower weight; not a ticket product.';

COMMIT;
