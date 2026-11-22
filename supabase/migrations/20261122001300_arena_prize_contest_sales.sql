BEGIN;

ALTER TABLE public.order_items
  ADD COLUMN arena_prize_track TEXT CHECK (arena_prize_track IN ('concours','regular','excluded','unknown')),
  ADD COLUMN arena_prize_unit_grams NUMERIC(12,3) CHECK (arena_prize_unit_grams > 0);

-- Snapshot the published tasting booklet at checkout. Legacy lines retain NULL.
CREATE FUNCTION public.arena_prize_snapshot_flower() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tracks TEXT[]; base TEXT := split_part(NEW.product_id,'::',1);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.arena_prize_track := OLD.arena_prize_track;
    NEW.arena_prize_unit_grams := OLD.arena_prize_unit_grams;
    RETURN NEW;
  END IF;
  NEW.arena_prize_unit_grams := NULL;
  NEW.arena_prize_track := 'excluded';
  IF NEW.parent_pack_id IS NOT NULL OR NEW.line_total <= 0 OR NEW.product_category IS DISTINCT FROM 'fleurs' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.products WHERE id=base AND is_pack) THEN RETURN NEW; END IF;
  SELECT array_agg(DISTINCT e.track::TEXT) INTO tracks
  FROM public.contest_entries e JOIN public.contest_seasons s ON e.season_id=s.id AND s.is_active AND NOT s.is_archived
  WHERE e.product_id=base AND e.is_published;
  IF tracks IS NULL THEN RETURN NEW; END IF;
  NEW.arena_prize_unit_grams := public.resolve_producer_settlement_weight(NEW.product_id, NEW.unit_weight_grams);
  NEW.arena_prize_track := CASE WHEN cardinality(tracks)=1 AND NEW.arena_prize_unit_grams IS NOT NULL THEN tracks[1] ELSE 'unknown' END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.arena_prize_snapshot_flower() FROM PUBLIC,anon,authenticated,service_role;
-- Runs after trg_arena_snapshot_order_item_product supplies category and weight.
CREATE TRIGGER trg_prize_flower_track BEFORE INSERT OR UPDATE OF arena_prize_track,arena_prize_unit_grams ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.arena_prize_snapshot_flower();

CREATE TABLE public.arena_prize_flower_returns (
  order_item_id BIGINT NOT NULL REFERENCES public.order_items(id),
  reference TEXT NOT NULL CHECK (length(btrim(reference)) BETWEEN 1 AND 160),
  grams NUMERIC(12,3) NOT NULL CHECK (grams>0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(order_item_id,reference)
);
ALTER TABLE public.arena_prize_flower_returns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.arena_prize_flower_returns FROM PUBLIC,anon,authenticated,service_role;

-- Record an actual itemised refund; do not infer grams from a monetary refund.
CREATE FUNCTION public.rpc_arena_prize_record_return(p_item_id BIGINT,p_reference TEXT,p_grams NUMERIC)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item public.order_items%ROWTYPE; prior NUMERIC; refunded NUMERIC;
BEGIN
  IF p_grams IS NULL OR p_grams <= 0 OR p_grams <> round(p_grams,3) OR p_reference IS NULL
    OR p_reference <> btrim(p_reference) OR length(p_reference) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'invalid_prize_return'; END IF;
  -- A refund and the finalization of its week take the same season lock.
  PERFORM s.season_code FROM public.order_items i JOIN public.orders o ON o.id=i.order_id
    JOIN public.arena_customer_reward_seasons s ON o.paid_at>=s.starts_at AND o.paid_at<s.ends_at
    WHERE i.id=p_item_id AND s.formula_version='arena-customer-prizes-v3'
    ORDER BY s.season_code FOR UPDATE OF s;
  SELECT * INTO STRICT item FROM public.order_items WHERE id=p_item_id FOR UPDATE;
  SELECT grams INTO prior FROM public.arena_prize_flower_returns WHERE order_item_id=p_item_id AND reference=p_reference;
  IF FOUND THEN
    IF prior <> p_grams THEN RAISE EXCEPTION 'prize_return_changed'; END IF;
    RETURN prior;
  END IF;
  SELECT coalesce(sum(grams),0) INTO refunded FROM public.arena_prize_flower_returns WHERE order_item_id=p_item_id;
  IF item.arena_prize_track IS DISTINCT FROM 'concours' OR item.arena_prize_unit_grams IS NULL OR
    refunded+p_grams>item.quantity*item.arena_prize_unit_grams THEN RAISE EXCEPTION 'prize_return_exceeds_sale'; END IF;
  INSERT INTO public.arena_prize_flower_returns(order_item_id,reference,grams) VALUES(p_item_id,p_reference,p_grams);
  RETURN p_grams;
END $$;
REVOKE ALL ON FUNCTION public.rpc_arena_prize_record_return(BIGINT,TEXT,NUMERIC) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_arena_prize_record_return(BIGINT,TEXT,NUMERIC) TO service_role;

CREATE FUNCTION public.arena_prize_preserve_close() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF OLD.formula_version='arena-customer-prizes-v3' AND OLD.status='active' AND NEW.status='frozen' THEN
    IF OLD.ends_at IS NULL OR now()<OLD.ends_at THEN RAISE EXCEPTION 'prize_season_not_finished'; END IF;
    NEW.ends_at := OLD.ends_at;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.arena_prize_preserve_close() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER arena_prize_preserve_close BEFORE UPDATE OF status ON public.arena_customer_reward_seasons
FOR EACH ROW EXECUTE FUNCTION public.arena_prize_preserve_close();


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
  v_new_rules BOOLEAN;
  v_funding JSONB;
  v_unknown_lines INTEGER;
BEGIN
  SELECT * INTO v_season
  FROM public.arena_customer_reward_seasons
  WHERE season_code = p_season_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arena_customer_reward_season_not_found'; END IF;

  v_new_rules := v_season.formula_version='arena-customer-prizes-v3';
  IF v_new_rules THEN
    v_funding := public.kq_arena_customer_prize_funding(p_season_code);
    SELECT count(*) INTO v_unknown_lines
    FROM public.orders o JOIN public.order_items i ON i.order_id=o.id
    WHERE o.paid_at>=v_season.starts_at AND (v_season.ends_at IS NULL OR o.paid_at<v_season.ends_at)
      AND o.payment_state='paid' AND o.status<>'cancelled' AND o.total_amount>0
      AND i.product_category='fleurs' AND i.parent_pack_id IS NULL AND i.line_total>0
      AND (i.arena_prize_track IS NULL OR i.arena_prize_track='unknown');
  END IF;
  v_current_week := date_trunc(
    'week',
    timezone(
      'Europe/Paris',
      CASE
        WHEN v_new_rules THEN greatest(v_season.starts_at, least(now(), v_season.ends_at - interval '1 microsecond'))
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
           CASE WHEN v_new_rules THEN item.quantity * item.arena_prize_unit_grams
             - coalesce((SELECT sum(r.grams) FROM public.arena_prize_flower_returns r WHERE r.order_item_id=item.id),0)
             ELSE item.quantity * item.unit_weight_grams END AS line_grams
    FROM public.orders o
    JOIN public.order_items item ON item.order_id = o.id
    WHERE o.payment_state = 'paid'
      AND o.status <> 'cancelled'
      AND (v_new_rules OR o.archived_at IS NULL)
      AND o.paid_at IS NOT NULL
      AND o.paid_at >= v_season.starts_at
      AND (v_season.ends_at IS NULL OR o.paid_at < v_season.ends_at)
      AND item.product_category = 'fleurs'
      AND ((v_new_rules AND o.total_amount>0 AND item.arena_prize_track='concours' AND item.arena_prize_unit_grams>0)
        OR (NOT v_new_rules AND item.unit_weight_grams>0))
      AND item.quantity > 0
      AND item.line_total > 0
  ) source
  WHERE source.line_grams>0
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
    'poolGrams', CASE WHEN v_new_rules THEN coalesce((v_funding->'settlement'->>'poolGrams')::NUMERIC,
      greatest(0,v_total+v_adjustments+(v_funding->>'baseGrams')::NUMERIC+(v_funding->>'carryInGrams')::NUMERIC))
      ELSE GREATEST(0, v_total + v_adjustments) END,
    'currentWeekGrams', COALESCE(v_current, 0),
    'updatedAt', now(),
    'weeklyDice', jsonb_build_object(
      'startsOn', CASE WHEN v_new_rules THEN greatest(v_current_week,timezone('Europe/Paris',v_season.starts_at)::date) ELSE v_current_week END,
      'endsOn', CASE WHEN v_new_rules THEN least(v_current_week+7,timezone('Europe/Paris',v_season.ends_at-interval '1 microsecond')::date+1) ELSE v_current_week+7 END,
      'rollCount', COALESCE(v_current_roll_count, 0),
      'average', v_current_average,
      'rateBps', COALESCE(v_current_rate, 100),
      'eligibleFlowerGrams', COALESCE(v_current_sales, 0),
      'contributionGrams', COALESCE(v_current, 0)
    ),
    'lastFinalWeek', CASE WHEN v_last_final.week_start IS NULL THEN NULL ELSE jsonb_build_object(
      'startsOn', CASE WHEN v_new_rules THEN greatest(v_last_final.week_start,timezone('Europe/Paris',v_season.starts_at)::date) ELSE v_last_final.week_start END,
      'endsOn', CASE WHEN v_new_rules THEN least(v_last_final.week_end,timezone('Europe/Paris',v_season.ends_at-interval '1 microsecond')::date+1) ELSE v_last_final.week_end END,
      'contributionGrams', v_last_final.contribution_grams,
      'eligibleFlowerGrams', v_last_final.eligible_flower_grams,
      'contributionRateBps', v_last_final.contribution_bps,
      'diceRollCount', v_last_final.dice_roll_count,
      'diceAverage', v_last_final.dice_average
    ) END
  ) || CASE WHEN v_new_rules THEN (v_funding - 'poolGrams') || jsonb_build_object('unknownSaleLines',v_unknown_lines)
             ELSE '{}'::JSONB END;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_arena_refresh_customer_reward_pool(TEXT,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_arena_refresh_customer_reward_pool(TEXT,BOOLEAN) TO service_role;

COMMIT;
