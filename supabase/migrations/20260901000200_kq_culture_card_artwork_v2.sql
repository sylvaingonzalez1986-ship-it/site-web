-- Point the renamed culture-system cards at their dedicated V2 fronts.

BEGIN;

WITH artwork(code, image_url) AS (
  VALUES
    ('BOTTE-007', '/app/kanab-quest/card-fronts/botte-007-hydroponie-recirculante-front-v2.webp'),
    ('BOTTE-008', '/app/kanab-quest/card-fronts/botte-008-aeroponie-haute-pression-front-v2.webp'),
    ('BOTTE-021', '/app/kanab-quest/card-fronts/botte-021-engrais-bio-complet-front-v2.webp')
)
UPDATE public.lottery_card_definitions AS definitions
SET image_url = artwork.image_url,
    updated_at = now()
FROM artwork
WHERE definitions.code = artwork.code;

COMMIT;
