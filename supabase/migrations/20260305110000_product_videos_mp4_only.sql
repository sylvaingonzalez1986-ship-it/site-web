BEGIN;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['video/mp4']
WHERE id = 'product-videos';

COMMIT;
