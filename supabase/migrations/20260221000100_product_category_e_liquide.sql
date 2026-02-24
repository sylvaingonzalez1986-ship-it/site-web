-- Add e-liquide product category

BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_category') THEN
    ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'e-liquide';
  END IF;
END
$$;
COMMIT;
