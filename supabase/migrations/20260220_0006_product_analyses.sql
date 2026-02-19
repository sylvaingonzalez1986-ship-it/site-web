-- Product analyses PDF support

BEGIN;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS analysis_pdf TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-analyses',
  'product-analyses',
  true,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS storage_product_analyses_public_read ON storage.objects;
CREATE POLICY storage_product_analyses_public_read
ON storage.objects FOR SELECT
USING (bucket_id = 'product-analyses');

COMMIT;

