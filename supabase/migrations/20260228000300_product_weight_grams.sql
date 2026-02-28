BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_grams integer;

COMMIT;
