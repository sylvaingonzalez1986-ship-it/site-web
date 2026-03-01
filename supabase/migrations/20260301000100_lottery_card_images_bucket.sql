BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lottery-cards',
  'lottery-cards',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS storage_lottery_cards_public_read ON storage.objects;
CREATE POLICY storage_lottery_cards_public_read
ON storage.objects FOR SELECT
USING (bucket_id = 'lottery-cards');

COMMIT;
