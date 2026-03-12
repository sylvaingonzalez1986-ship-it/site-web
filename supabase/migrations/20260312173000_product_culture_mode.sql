BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS culture_type TEXT;

UPDATE public.products
SET culture_type = NULLIF(lower(trim(culture_type)), '')
WHERE culture_type IS NOT NULL;

UPDATE public.products
SET culture_type = NULL
WHERE culture_type IS NOT NULL
  AND culture_type NOT IN ('indoor', 'greenhouse', 'outdoor');

UPDATE public.products
SET culture_type = NULL
WHERE category NOT IN ('fleurs', 'resines')
  AND culture_type IS NOT NULL;

UPDATE public.products AS p
SET culture_type = (
  SELECT lower(trim(pr.culture_type[1]))
  FROM public.producers AS pr
  WHERE pr.id = p.producer_id
    AND array_length(pr.culture_type, 1) = 1
)
WHERE p.category IN ('fleurs', 'resines')
  AND p.culture_type IS NULL
  AND p.producer_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_culture_type_allowed'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_culture_type_allowed
      CHECK (culture_type IS NULL OR culture_type IN ('indoor', 'greenhouse', 'outdoor'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_culture_type_category_guard'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_culture_type_category_guard
      CHECK (culture_type IS NULL OR category IN ('fleurs', 'resines'));
  END IF;
END;
$$;

COMMIT;
