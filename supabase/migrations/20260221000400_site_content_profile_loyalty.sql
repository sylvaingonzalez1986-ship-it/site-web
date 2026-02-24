BEGIN;
ALTER TABLE public.site_content
ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.site_content
SET profile = COALESCE(profile, '{}'::jsonb)
WHERE id = 1;
COMMIT;
