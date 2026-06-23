BEGIN;

CREATE OR REPLACE FUNCTION public.contest_review_votes_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review record;
  v_voter_email TEXT;
BEGIN
  SELECT id, customer_id, status
  INTO v_review
  FROM public.contest_reviews
  WHERE id = NEW.review_id;

  IF v_review.id IS NULL THEN
    RAISE EXCEPTION 'contest_review_vote_invalid_review';
  END IF;

  IF v_review.status <> 'approved' THEN
    RAISE EXCEPTION 'contest_review_vote_review_not_approved';
  END IF;

  IF v_review.customer_id = NEW.voter_customer_id THEN
    RAISE EXCEPTION 'contest_review_vote_own_review';
  END IF;

  SELECT LOWER(email)
  INTO v_voter_email
  FROM auth.users
  WHERE id = NEW.voter_customer_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders orders
    WHERE orders.payment_state = 'paid'
      AND orders.status <> 'cancelled'
      AND (
        orders.customer_id = NEW.voter_customer_id
        OR (
          orders.customer_id IS NULL
          AND v_voter_email IS NOT NULL
          AND LOWER(COALESCE(orders.customer_email, '')) = v_voter_email
        )
      )
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'contest_review_vote_purchase_required';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_orders_contest_paid_customer
  ON public.orders (customer_id, created_at DESC)
  WHERE payment_state = 'paid' AND status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_orders_contest_paid_email
  ON public.orders (LOWER(customer_email), created_at DESC)
  WHERE customer_id IS NULL AND payment_state = 'paid' AND status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_contest_reviews_customer_status_created
  ON public.contest_reviews (customer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contest_review_votes_voter_review
  ON public.contest_review_votes (voter_customer_id, review_id);

COMMIT;
