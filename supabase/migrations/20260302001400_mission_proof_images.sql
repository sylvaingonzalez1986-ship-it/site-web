BEGIN;

ALTER TABLE public.social_mission_submissions
ADD COLUMN IF NOT EXISTS proof_storage_path TEXT,
ADD COLUMN IF NOT EXISTS proof_content_type TEXT,
ADD COLUMN IF NOT EXISTS proof_file_size INTEGER,
ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mission-proofs',
  'mission-proofs',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
