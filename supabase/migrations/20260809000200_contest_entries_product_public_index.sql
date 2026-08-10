CREATE INDEX IF NOT EXISTS idx_contest_entries_product_public_updated
  ON public.contest_entries (product_id, updated_at DESC)
  WHERE is_published = TRUE;
