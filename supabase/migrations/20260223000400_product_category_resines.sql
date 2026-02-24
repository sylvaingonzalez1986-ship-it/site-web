-- Add "resines" as a first-class product category.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_category') THEN
    ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'resines';
  END IF;
END $$;
