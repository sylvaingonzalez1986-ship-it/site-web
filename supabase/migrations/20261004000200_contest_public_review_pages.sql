BEGIN;

-- Bound each entry before its scores/tags are hydrated. Only the server may read
-- the complete review row; public responses use the application sanitizer.
CREATE OR REPLACE FUNCTION public.rpc_contest_public_review_page(
  p_entry_ids text[],
  p_limit integer DEFAULT 7,
  p_before_date timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL
)
RETURNS SETOF public.contest_reviews
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF coalesce(cardinality(p_entry_ids), 0) > 20 OR p_limit < 1 OR p_limit > 41 OR p_limit IS NULL THEN
    RAISE EXCEPTION 'invalid_review_page';
  END IF;
  IF (p_before_date IS NULL) <> (p_before_id IS NULL) OR
     (p_before_id IS NOT NULL AND cardinality(p_entry_ids) <> 1) THEN
    RAISE EXCEPTION 'invalid_review_cursor';
  END IF;
  RETURN QUERY
  SELECT page.*
  FROM public.contest_entries entry
  CROSS JOIN LATERAL (
    SELECT review.*
    FROM public.contest_reviews review
    WHERE review.entry_id = entry.id
      AND review.status = 'approved'
      AND (p_before_date IS NULL OR
        (coalesce(review.reviewed_at, review.created_at), review.id) < (p_before_date, p_before_id))
    ORDER BY coalesce(review.reviewed_at, review.created_at) DESC, review.id DESC
    LIMIT p_limit
  ) page
  WHERE entry.id = ANY(p_entry_ids) AND entry.is_published
  ORDER BY page.entry_id, coalesce(page.reviewed_at, page.created_at) DESC, page.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_contest_public_review_page(text[], integer, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_contest_public_review_page(text[], integer, timestamptz, uuid) TO service_role;

CREATE INDEX IF NOT EXISTS idx_contest_reviews_public_page
  ON public.contest_reviews (entry_id, (coalesce(reviewed_at, created_at)) DESC, id DESC)
  WHERE status = 'approved';

COMMIT;
