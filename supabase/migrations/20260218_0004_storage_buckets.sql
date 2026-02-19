-- Storage buckets for media assets

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('products', 'products', true, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('producers', 'producers', true, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('blog', 'blog', true, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS storage_products_public_read ON storage.objects;
CREATE POLICY storage_products_public_read
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

DROP POLICY IF EXISTS storage_producers_public_read ON storage.objects;
CREATE POLICY storage_producers_public_read
ON storage.objects FOR SELECT
USING (bucket_id = 'producers');

DROP POLICY IF EXISTS storage_blog_public_read ON storage.objects;
CREATE POLICY storage_blog_public_read
ON storage.objects FOR SELECT
USING (bucket_id = 'blog');

COMMIT;
