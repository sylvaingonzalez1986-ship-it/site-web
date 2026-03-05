BEGIN;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['video/mp4', 'video/quicktime']
WHERE id = 'product-videos';

COMMIT;
