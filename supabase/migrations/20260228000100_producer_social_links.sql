BEGIN;

ALTER TABLE public.producers
  ADD COLUMN IF NOT EXISTS instagram text DEFAULT '',
  ADD COLUMN IF NOT EXISTS facebook text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tiktok text DEFAULT '';

UPDATE public.producers
SET
  instagram = COALESCE(instagram, ''),
  facebook = COALESCE(facebook, ''),
  tiktok = COALESCE(tiktok, '');

ALTER TABLE public.producers
  ALTER COLUMN instagram SET DEFAULT '',
  ALTER COLUMN facebook SET DEFAULT '',
  ALTER COLUMN tiktok SET DEFAULT '',
  ALTER COLUMN instagram SET NOT NULL,
  ALTER COLUMN facebook SET NOT NULL,
  ALTER COLUMN tiktok SET NOT NULL;

COMMIT;
