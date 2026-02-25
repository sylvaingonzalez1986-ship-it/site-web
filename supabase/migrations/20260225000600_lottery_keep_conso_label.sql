BEGIN;

UPDATE public.lottery_prizes
SET
  name = '1 an de conso',
  description = 'Le detail du lot legendaire est disponible dans le reglement du jeu promotionnel.',
  updated_at = now()
WHERE rarity = 'legendary';

UPDATE public.cms_pages
SET
  description = replace(
    replace(
      replace(
        description,
        'Jackpot legendaire: 365 g de fleurs (1 g/jour) ou 1 an de tisane (2 boites/mois).',
        'Le jackpot: 1 an de conso. Details dans le reglement du jeu.'
      ),
      '365 g de fleurs offerts (1 g/jour) ou 1 an de tisane (2 boites/mois)',
      '1 an de conso'
    ),
    '365 g de fleurs (1 g/jour) ou 1 an de tisane (2 boites/mois)',
    '1 an de conso'
  ),
  sections = replace(
    replace(
      replace(
        sections::text,
        'Jackpot legendaire: 365 g de fleurs (1 g/jour) ou 1 an de tisane (2 boites/mois).',
        'Le jackpot: 1 an de conso. Details dans le reglement du jeu.'
      ),
      '365 g de fleurs offerts (1 g/jour pendant 12 mois, varietes selon stock) OU 1 an de tisane (2 boites/mois pendant 12 mois)',
      '1 an de conso'
    ),
    '365 g de fleurs (1 g/jour) ou 1 an de tisane (2 boites/mois)',
    '1 an de conso'
  )::jsonb,
  updated_at = now()
WHERE slug = 'tutorial-tickets';

COMMIT;

