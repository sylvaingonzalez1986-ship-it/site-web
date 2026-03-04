BEGIN;

UPDATE public.cms_pages
SET
  description = replace(
    replace(
      replace(
        replace(
          replace(
            description,
            '1 an de conso a gagner',
            '600 euros de bon d''achat a gagner'
          ),
          '1 an de conso',
          '600 euros de bon d''achat'
        ),
        '1 an de consommation offerte',
        '600 euros de bon d''achat'
      ),
      '365 g de fleurs offerts (1 g/jour) ou 1 an de tisane (2 boites/mois)',
      '12 bons d''achat de 50 euros, 1 par mois pendant 12 mois, hors frais de port'
    ),
    '365 g de fleurs (1 g/jour) ou 1 an de tisane (2 boites/mois)',
    '12 bons d''achat de 50 euros, 1 par mois pendant 12 mois, hors frais de port'
  ),
  sections = replace(
    replace(
      replace(
        replace(
          replace(
            sections::text,
            '1 an de conso a gagner',
            '600 euros de bon d''achat a gagner'
          ),
          '1 an de conso',
          '600 euros de bon d''achat'
        ),
        '1 an de consommation offerte',
        '600 euros de bon d''achat'
      ),
      '365 g de fleurs offerts (1 g/jour pendant 12 mois, varietes selon stock) OU 1 an de tisane (2 boites/mois pendant 12 mois)',
      '12 bons d''achat de 50 euros, 1 par mois pendant 12 mois, utilisables sur toute la boutique. Frais de port a la charge du client.'
    ),
    '365 g de fleurs (1 g/jour) ou 1 an de tisane (2 boites/mois)',
    '12 bons d''achat de 50 euros, 1 par mois pendant 12 mois, utilisables sur toute la boutique. Frais de port a la charge du client.'
  )::jsonb,
  updated_at = now()
WHERE slug IN ('reglement-jeu-promo', 'tutorial-tickets')
  AND (
    description ILIKE '%1 an de conso%'
    OR description ILIKE '%1 an de consommation%'
    OR description ILIKE '%365 g de fleurs%'
    OR sections::text ILIKE '%1 an de conso%'
    OR sections::text ILIKE '%1 an de consommation%'
    OR sections::text ILIKE '%365 g de fleurs%'
  );

COMMIT;
