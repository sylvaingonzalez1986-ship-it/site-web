BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'local';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS printful_sync_product_id BIGINT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variant_label TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variant_options JSONB;

UPDATE public.products
SET source = 'printful'
WHERE id LIKE 'printful-p-%' OR id LIKE 'printful-v-%';

UPDATE public.products
SET printful_sync_product_id = (regexp_match(id, '^printful-p-(\d+)$'))[1]::BIGINT
WHERE printful_sync_product_id IS NULL
  AND id ~ '^printful-p-[0-9]+$';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_source_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_source_check
  CHECK (source IN ('local', 'printful'));

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_variant_options_is_array;

ALTER TABLE public.products
  ADD CONSTRAINT products_variant_options_is_array
  CHECK (variant_options IS NULL OR jsonb_typeof(variant_options) = 'array');

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_printful_sync_product_unique
  ON public.products(printful_sync_product_id)
  WHERE printful_sync_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_source
  ON public.products(source);

COMMIT;
