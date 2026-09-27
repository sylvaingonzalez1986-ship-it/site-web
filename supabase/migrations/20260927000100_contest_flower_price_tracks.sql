BEGIN;

-- Reconcile published notebook entries with the reference price per gram.
-- Discounts retain their regular list price; complex variants and invalid prices
-- are deliberately left for editorial review. No history or reward is deleted.
WITH reference_prices AS (
  SELECT
    product.id,
    round(
      (CASE
        WHEN product.original_price > product.price
          AND product.original_price::text NOT IN ('NaN', 'Infinity', '-Infinity')
        THEN product.original_price
        ELSE product.price
      END) / NULLIF(product.weight_grams, 0)::numeric,
      2
    ) AS price_per_gram
  FROM public.products product
  WHERE product.category::text = 'fleurs'
    AND product.is_pack IS FALSE
    AND product.weight_grams > 0
    AND product.price > 0
    AND product.price::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND (product.variant_options IS NULL OR product.variant_options = '[]'::jsonb)
), expected_tracks AS (
  SELECT
    id,
    CASE
      WHEN price_per_gram = 2.50 THEN 'regular'::public.contest_entry_track
      WHEN price_per_gram > 2.50 THEN 'concours'::public.contest_entry_track
      ELSE NULL::public.contest_entry_track
    END AS expected_track
  FROM reference_prices
), published_entries AS (
  SELECT
    entry.id,
    entry.track,
    price.expected_track,
    count(*) OVER (PARTITION BY entry.season_id, entry.product_id) AS published_count,
    coalesce(bool_or(entry.track = price.expected_track)
      OVER (PARTITION BY entry.season_id, entry.product_id), false) AS has_expected_track
  FROM public.contest_entries entry
  JOIN public.contest_seasons season ON season.id = entry.season_id
  JOIN expected_tracks price ON price.id = entry.product_id
  WHERE entry.is_published
    AND season.is_active
    AND NOT season.is_archived
), decisions AS (
  SELECT
    id,
    CASE
      WHEN expected_track IS NOT NULL AND track <> expected_track
        AND NOT has_expected_track AND published_count = 1
      THEN expected_track
      ELSE track
    END AS next_track,
    CASE
      WHEN expected_track IS NULL THEN false
      WHEN track <> expected_track AND has_expected_track THEN false
      ELSE true
    END AS next_published
  FROM published_entries
)
UPDATE public.contest_entries entry
SET track = decision.next_track,
    is_published = decision.next_published,
    updated_at = now()
FROM decisions decision
WHERE entry.id = decision.id
  AND (entry.track, entry.is_published)
    IS DISTINCT FROM (decision.next_track, decision.next_published);

-- Only publication and track changed. IDs, editorial content, reviews, access
-- entitlements, reward receipts and archived seasons retain their existing data.
COMMIT;
