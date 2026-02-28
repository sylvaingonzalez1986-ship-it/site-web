BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-videos',
  'product-videos',
  true,
  31457280,
  ARRAY['video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS storage_product_videos_public_read ON storage.objects;
CREATE POLICY storage_product_videos_public_read
ON storage.objects FOR SELECT
USING (bucket_id = 'product-videos');

COMMIT;
