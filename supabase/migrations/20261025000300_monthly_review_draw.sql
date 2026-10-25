BEGIN;

-- The programme starts with the next Paris calendar month when installed.
-- Persist this boundary: retries and later deployments must not reset it or
-- distribute prizes for months before the programme existed.
CREATE TABLE IF NOT EXISTS public.monthly_review_draw_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  first_draw_date DATE NOT NULL CHECK (extract(day FROM first_draw_date) = 1)
);
INSERT INTO public.monthly_review_draw_settings(singleton, first_draw_date)
VALUES (TRUE, (date_trunc('month', now() AT TIME ZONE 'Europe/Paris') + INTERVAL '1 month')::DATE)
ON CONFLICT (singleton) DO NOTHING;

-- Candidate IDs and review IDs are retained as an immutable drawing receipt.
-- They intentionally have no cascading foreign keys: later account, review or
-- claim deletion must not rewrite the population from which a winner was drawn.
CREATE TABLE IF NOT EXISTS public.monthly_review_draws (
  draw_date DATE PRIMARY KEY CHECK (extract(day FROM draw_date) = 1),
  period_starts_on DATE NOT NULL,
  participant_count INTEGER NOT NULL CHECK (participant_count >= 0),
  candidates JSONB NOT NULL CHECK (jsonb_typeof(candidates) = 'array'),
  selected_index INTEGER,
  winner_user_id UUID,
  claim_id UUID UNIQUE,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_starts_on = (draw_date - INTERVAL '1 month')::DATE),
  CHECK (jsonb_array_length(candidates) = participant_count),
  CHECK (
    (participant_count = 0 AND selected_index IS NULL AND winner_user_id IS NULL AND claim_id IS NULL)
    OR (participant_count > 0 AND selected_index IS NOT NULL
      AND selected_index >= 0 AND selected_index < participant_count
      AND winner_user_id IS NOT NULL AND claim_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS monthly_review_draws_winner
  ON public.monthly_review_draws(winner_user_id, draw_date DESC)
  WHERE winner_user_id IS NOT NULL;

ALTER TABLE public.monthly_review_draw_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_review_draws ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.monthly_review_draw_settings FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.monthly_review_draws FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.monthly_review_draw_receipt_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'monthly_review_draw_receipt_immutable';
END;
$$;
REVOKE ALL ON FUNCTION public.monthly_review_draw_receipt_immutable() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS monthly_review_draws_immutable ON public.monthly_review_draws;
CREATE TRIGGER monthly_review_draws_immutable BEFORE UPDATE OR DELETE ON public.monthly_review_draws
FOR EACH ROW EXECUTE FUNCTION public.monthly_review_draw_receipt_immutable();

-- Viva payment links can remain payable beyond the usual two-hour reward
-- reservation. Keep this monthly prize attached to that order until checkout
-- explicitly fails or is cancelled; otherwise two paid orders could each carry
-- its gift line after an automatic expiry. Existing consume/release RPCs still
-- handle payment success and confirmed cancellation without any special case.
CREATE OR REPLACE FUNCTION public.monthly_review_draw_keep_order_reservation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.reward_snapshot->'customPayload'->>'source' = 'monthly_review_draw'
    AND NEW.status::TEXT = 'reserved' THEN
    NEW.reserved_until := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.monthly_review_draw_keep_order_reservation() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS monthly_review_draw_order_reservation ON public.lottery_reward_claims;
CREATE TRIGGER monthly_review_draw_order_reservation BEFORE INSERT OR UPDATE ON public.lottery_reward_claims
FOR EACH ROW EXECUTE FUNCTION public.monthly_review_draw_keep_order_reservation();

-- The same eligibility calculation feeds the customer display and the draw.
-- One row means one chance, regardless of number of reviews or score awarded.
-- All past approved reviews count again each month; period_starts_on describes
-- the monthly drawing interval, never a lower limit on eligible review dates.
-- Approvals and purchases after the deadline cannot join a recovered old draw.
CREATE OR REPLACE FUNCTION public.monthly_review_draw_candidates(
  p_period_starts_on DATE,
  p_draw_date DATE,
  p_customer_id UUID DEFAULT NULL
)
RETURNS TABLE(customer_id UUID, review_ids UUID[], approved_review_count INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH bounds AS (
    SELECT p_draw_date::TIMESTAMP AT TIME ZONE 'Europe/Paris' AS ends_at
    WHERE extract(day FROM p_draw_date) = 1
      AND p_period_starts_on = (p_draw_date - INTERVAL '1 month')::DATE
  )
  SELECT review.customer_id, array_agg(review.id ORDER BY review.id), count(*)::INTEGER
  FROM bounds
  JOIN public.contest_reviews review ON review.created_at < bounds.ends_at AND review.created_at <= now()
    AND review.status::TEXT = 'approved'
    AND coalesce(review.reviewed_at, review.created_at) < bounds.ends_at
    AND coalesce(review.reviewed_at, review.created_at) <= now()
  JOIN auth.users customer ON customer.id = review.customer_id AND customer.deleted_at IS NULL
  JOIN public.contest_entries entry ON entry.id = review.entry_id
  JOIN public.products product ON product.id = entry.product_id AND product.category::TEXT = 'fleurs'
  WHERE (p_customer_id IS NULL OR review.customer_id = p_customer_id)
    AND EXISTS (
      SELECT 1 FROM public.order_items item
      JOIN public.orders purchase ON purchase.id = item.order_id
      WHERE btrim(split_part(item.product_id, '::', 1)) = entry.product_id
        AND item.quantity > 0
        AND purchase.payment_state::TEXT = 'paid'
        AND purchase.status::TEXT IS DISTINCT FROM 'cancelled'
        AND purchase.archived_at IS NULL AND purchase.payment_review_required IS FALSE
        AND purchase.created_at < bounds.ends_at AND purchase.created_at <= now()
        AND purchase.paid_at < bounds.ends_at AND purchase.paid_at <= now()
        AND (purchase.customer_id = customer.id OR (
          purchase.customer_id IS NULL AND customer.email_confirmed_at IS NOT NULL
          AND nullif(btrim(customer.email), '') IS NOT NULL
          AND lower(btrim(purchase.customer_email)) = lower(btrim(customer.email))
          AND NOT EXISTS (
            SELECT 1 FROM auth.users other_customer
            WHERE other_customer.id <> customer.id AND other_customer.deleted_at IS NULL
              AND other_customer.email_confirmed_at IS NOT NULL
              AND lower(btrim(other_customer.email)) = lower(btrim(customer.email))
          )
        ))
    )
  GROUP BY review.customer_id
  ORDER BY review.customer_id;
$$;
REVOKE ALL ON FUNCTION public.monthly_review_draw_candidates(DATE, DATE, UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_settle_monthly_review_draws()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  due_date DATE := date_trunc('month', now() AT TIME ZONE 'Europe/Paris')::DATE;
  draw_day DATE;
  candidates JSONB;
  participant_count INTEGER;
  selected_index INTEGER;
  winner UUID;
  reward_id UUID;
  settled_count INTEGER := 0;
  awarded_count INTEGER := 0;
  empty_count INTEGER := 0;
  more_due BOOLEAN;
BEGIN
  -- Serialise scheduler retries and simultaneous manual recovery, including
  -- the eligibility snapshot, random choice, prize and immutable receipt.
  PERFORM pg_advisory_xact_lock(hashtextextended('monthly-review-draws', 0));

  FOR draw_day IN
    SELECT month.day::DATE
    FROM public.monthly_review_draw_settings settings
    CROSS JOIN LATERAL generate_series(settings.first_draw_date::TIMESTAMP,
      due_date::TIMESTAMP, INTERVAL '1 month') AS month(day)
    WHERE settings.singleton AND NOT EXISTS (
      SELECT 1 FROM public.monthly_review_draws previous WHERE previous.draw_date = month.day::DATE
    )
    ORDER BY month.day
    LIMIT 12
  LOOP
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'customerId', candidate.customer_id,
      'reviewIds', candidate.review_ids,
      'approvedReviewCount', candidate.approved_review_count
    ) ORDER BY candidate.customer_id), '[]'::JSONB)
    INTO candidates
    FROM public.monthly_review_draw_candidates((draw_day - INTERVAL '1 month')::DATE, draw_day) candidate;

    participant_count := jsonb_array_length(candidates);
    selected_index := NULL;
    winner := NULL;
    reward_id := NULL;
    IF participant_count > 0 THEN
      selected_index := public.lottery_secure_random_int(0, participant_count - 1);
      winner := (candidates->selected_index->>'customerId')::UUID;
      INSERT INTO public.lottery_reward_claims(
        user_id, reward_snapshot, status, gift_weight_grams, gift_label
      ) VALUES (
        winner,
        jsonb_build_object(
          'title', 'Tirage mensuel du carnet : 10 g offerts',
          'description', '10 g de fleurs CBD à réclamer dans le panier lors d’une commande.',
          'kind', 'gift_weight_grams', 'giftWeightGrams', 10,
          'giftLabel', '10 g de fleurs CBD offerts',
          'customPayload', jsonb_build_object('source', 'monthly_review_draw',
            'drawDate', draw_day, 'checkoutRedeemable', TRUE),
          'deleted', FALSE
        ),
        'available', 10, '10 g de fleurs CBD offerts'
      ) RETURNING id INTO reward_id;
      awarded_count := awarded_count + 1;
    ELSE
      empty_count := empty_count + 1;
    END IF;

    INSERT INTO public.monthly_review_draws(draw_date, period_starts_on,
      participant_count, candidates, selected_index, winner_user_id, claim_id)
    VALUES (draw_day, (draw_day - INTERVAL '1 month')::DATE,
      participant_count, candidates, selected_index, winner, reward_id);
    settled_count := settled_count + 1;
  END LOOP;

  SELECT EXISTS (
    SELECT 1 FROM public.monthly_review_draw_settings settings
    CROSS JOIN LATERAL generate_series(settings.first_draw_date::TIMESTAMP,
      due_date::TIMESTAMP, INTERVAL '1 month') AS month(day)
    WHERE settings.singleton AND NOT EXISTS (
      SELECT 1 FROM public.monthly_review_draws previous WHERE previous.draw_date = month.day::DATE
    )
  ) INTO more_due;
  RETURN jsonb_build_object('settledDraws', settled_count, 'awardedPrizes', awarded_count,
    'emptyDraws', empty_count, 'hasMore', more_due);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_settle_monthly_review_draws() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_settle_monthly_review_draws() TO service_role;

-- Called only by the server, which supplies its authenticated customer ID.
-- Anonymous viewers receive dates and an aggregate result, never identities.
CREATE OR REPLACE FUNCTION public.rpc_get_monthly_review_draw(p_customer_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  next_draw DATE;
  review_count INTEGER;
  latest JSONB;
  rewards JSONB;
BEGIN
  -- Before today's scheduled worker, or after a missed invocation, keep the
  -- outstanding drawing visible. Reading status never settles or skips it.
  SELECT coalesce((
    SELECT min(month.day::DATE)
    FROM generate_series(settings.first_draw_date::TIMESTAMP,
      date_trunc('month', now() AT TIME ZONE 'Europe/Paris'), INTERVAL '1 month') AS month(day)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.monthly_review_draws previous WHERE previous.draw_date = month.day::DATE
    )
  ), greatest(settings.first_draw_date,
    (date_trunc('month', now() AT TIME ZONE 'Europe/Paris') + INTERVAL '1 month')::DATE))
  INTO next_draw FROM public.monthly_review_draw_settings settings WHERE settings.singleton;
  IF next_draw IS NULL THEN RAISE EXCEPTION 'monthly_review_draw_not_configured'; END IF;

  IF p_customer_id IS NOT NULL THEN
    SELECT coalesce((SELECT candidate.approved_review_count
      FROM public.monthly_review_draw_candidates((next_draw - INTERVAL '1 month')::DATE,
        next_draw, p_customer_id) candidate), 0) INTO review_count;
  END IF;

  SELECT jsonb_build_object('drawDate', draw.draw_date, 'participantCount', draw.participant_count,
    'viewerWon', coalesce(draw.winner_user_id = p_customer_id, FALSE))
  INTO latest FROM public.monthly_review_draws draw ORDER BY draw.draw_date DESC LIMIT 1;

  SELECT coalesce(jsonb_agg(jsonb_build_object('claimId', claim.id,
    'drawDate', draw.draw_date, 'status', claim.status) ORDER BY draw.draw_date DESC), '[]'::JSONB)
  INTO rewards
  FROM public.monthly_review_draws draw
  JOIN public.lottery_reward_claims claim ON claim.id = draw.claim_id AND claim.user_id = p_customer_id
  WHERE draw.winner_user_id = p_customer_id;

  RETURN jsonb_build_object('prizeGrams', 10, 'nextDrawDate', next_draw,
    'periodStartsOn', (next_draw - INTERVAL '1 month')::DATE,
    'eligible', CASE WHEN p_customer_id IS NULL THEN NULL ELSE review_count > 0 END,
    'approvedReviewCount', review_count, 'latestDraw', latest, 'rewards', rewards);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_get_monthly_review_draw(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_monthly_review_draw(UUID) TO service_role;

COMMIT;
