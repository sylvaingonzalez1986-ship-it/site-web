BEGIN;

UPDATE public.cms_pages
SET
  sections = regexp_replace(
    regexp_replace(
      regexp_replace(
        sections::text,
        '1 g offert(?! sur la prochaine commande)',
        '1 g offert sur la prochaine commande',
        'g'
      ),
      '10 g offerts(?! sur la prochaine commande)',
      '10 g offerts sur la prochaine commande',
      'g'
    ),
    '50 g offerts(?! sur la prochaine commande)',
    '50 g offerts sur la prochaine commande',
    'g'
  )::jsonb,
  updated_at = now()
WHERE slug = 'reglement-jeu-promo'
  AND (
    sections::text ~ '1 g offert'
    OR sections::text ~ '10 g offerts'
    OR sections::text ~ '50 g offerts'
  );

COMMIT;

