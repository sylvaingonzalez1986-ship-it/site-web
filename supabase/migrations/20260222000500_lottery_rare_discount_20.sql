BEGIN;

UPDATE public.lottery_prizes
SET
  name = regexp_replace(name, '50\s*%', '20%', 'gi'),
  description = regexp_replace(description, '50\s*%', '20%', 'gi'),
  updated_at = now()
WHERE rarity = 'rare'
  AND (
    name ~* '50\s*%'
    OR description ~* '50\s*%'
  );

COMMIT;
