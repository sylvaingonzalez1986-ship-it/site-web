BEGIN;

UPDATE public.lottery_prizes
SET
  name = '1 an de fleurs OU 1 an de tisane',
  description = 'Jackpot legendaire: 365 g de fleurs offerts (1 g/jour sur 12 mois, varietes selon stock) OU 1 an de tisane (2 boites/mois pendant 12 mois).',
  updated_at = now()
WHERE rarity = 'legendary';

UPDATE public.cms_pages
SET
  description = replace(
    description,
    '1 an de consommation offerte',
    '365 g de fleurs offerts (1 g/jour) ou 1 an de tisane (2 boites/mois)'
  ),
  sections = replace(
    replace(
      sections::text,
      '1 an de consommation offerte',
      '365 g de fleurs offerts (1 g/jour pendant 12 mois, varietes selon stock) OU 1 an de tisane (2 boites/mois pendant 12 mois)'
    ),
    '1 an de conso a gagner',
    '365 g de fleurs (1 g/jour) ou 1 an de tisane (2 boites/mois)'
  )::jsonb,
  updated_at = now()
WHERE slug IN ('reglement-jeu-promo', 'tutorial-tickets')
  AND (
    description ILIKE '%1 an de consommation offerte%'
    OR sections::text ILIKE '%1 an de consommation offerte%'
    OR sections::text ILIKE '%1 an de conso a gagner%'
  );

COMMIT;

