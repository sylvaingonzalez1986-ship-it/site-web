BEGIN;

ALTER TABLE public.producers
  ADD COLUMN IF NOT EXISTS culture_type text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS climate text DEFAULT '',
  ADD COLUMN IF NOT EXISTS soil text DEFAULT '',
  ADD COLUMN IF NOT EXISTS altitude text DEFAULT '',
  ADD COLUMN IF NOT EXISTS certifications text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS speciality text DEFAULT '',
  ADD COLUMN IF NOT EXISTS philosophy text DEFAULT '',
  ADD COLUMN IF NOT EXISTS experience text DEFAULT '',
  ADD COLUMN IF NOT EXISTS founded text DEFAULT '';

UPDATE public.producers
SET
  culture_type = COALESCE(culture_type, '{}'::text[]),
  climate = COALESCE(climate, ''),
  soil = COALESCE(soil, ''),
  altitude = COALESCE(altitude, ''),
  certifications = COALESCE(certifications, '{}'::text[]),
  speciality = COALESCE(speciality, ''),
  philosophy = COALESCE(philosophy, ''),
  experience = COALESCE(experience, ''),
  founded = COALESCE(founded, '');

UPDATE public.producers
SET culture_type = (
  SELECT COALESCE(array_agg(candidate), '{}'::text[])
  FROM (
    SELECT DISTINCT lower(trim(value)) AS candidate
    FROM unnest(COALESCE(culture_type, '{}'::text[])) AS value
    WHERE lower(trim(value)) IN ('indoor', 'greenhouse', 'outdoor')
  ) AS allowed_values
);

ALTER TABLE public.producers
  ALTER COLUMN culture_type SET DEFAULT '{}'::text[],
  ALTER COLUMN climate SET DEFAULT '',
  ALTER COLUMN soil SET DEFAULT '',
  ALTER COLUMN altitude SET DEFAULT '',
  ALTER COLUMN certifications SET DEFAULT '{}'::text[],
  ALTER COLUMN speciality SET DEFAULT '',
  ALTER COLUMN philosophy SET DEFAULT '',
  ALTER COLUMN experience SET DEFAULT '',
  ALTER COLUMN founded SET DEFAULT '';

ALTER TABLE public.producers
  ALTER COLUMN culture_type SET NOT NULL,
  ALTER COLUMN climate SET NOT NULL,
  ALTER COLUMN soil SET NOT NULL,
  ALTER COLUMN altitude SET NOT NULL,
  ALTER COLUMN certifications SET NOT NULL,
  ALTER COLUMN speciality SET NOT NULL,
  ALTER COLUMN philosophy SET NOT NULL,
  ALTER COLUMN experience SET NOT NULL,
  ALTER COLUMN founded SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'producers_culture_type_allowed'
      AND conrelid = 'public.producers'::regclass
  ) THEN
    ALTER TABLE public.producers
      ADD CONSTRAINT producers_culture_type_allowed
      CHECK (culture_type <@ ARRAY['indoor', 'greenhouse', 'outdoor']::text[]);
  END IF;
END;
$$;

COMMIT;
