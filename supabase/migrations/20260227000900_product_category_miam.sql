-- Add "miam" as a product category for non-tisane food products.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_category') THEN
    ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'miam';
  END IF;
END $$;
