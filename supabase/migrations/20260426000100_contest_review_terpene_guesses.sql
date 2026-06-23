BEGIN;

CREATE TABLE IF NOT EXISTS public.contest_review_terpene_guesses (
  id BIGSERIAL PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.contest_reviews(id) ON DELETE CASCADE,
  terpene TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contest_review_terpene_guesses_unique_review_terpene UNIQUE (review_id, terpene),
  CHECK (char_length(trim(terpene)) BETWEEN 2 AND 80)
);

CREATE INDEX IF NOT EXISTS idx_contest_review_terpene_guesses_review
  ON public.contest_review_terpene_guesses (review_id);

ALTER TABLE public.contest_review_terpene_guesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contest_review_terpene_guesses_read_public_or_own ON public.contest_review_terpene_guesses;
CREATE POLICY contest_review_terpene_guesses_read_public_or_own
  ON public.contest_review_terpene_guesses
  FOR SELECT
  TO authenticated, anon
  USING (
    review_id IN (
      SELECT id
      FROM public.contest_reviews
      WHERE status = 'approved'
         OR (auth.role() = 'authenticated' AND customer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS contest_review_terpene_guesses_user_insert_own ON public.contest_review_terpene_guesses;
CREATE POLICY contest_review_terpene_guesses_user_insert_own
  ON public.contest_review_terpene_guesses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    review_id IN (
      SELECT id
      FROM public.contest_reviews
      WHERE customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS contest_review_terpene_guesses_no_update ON public.contest_review_terpene_guesses;
CREATE POLICY contest_review_terpene_guesses_no_update
  ON public.contest_review_terpene_guesses
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS contest_review_terpene_guesses_no_delete ON public.contest_review_terpene_guesses;
CREATE POLICY contest_review_terpene_guesses_no_delete
  ON public.contest_review_terpene_guesses
  FOR DELETE
  TO authenticated, anon
  USING (false);

COMMIT;
