BEGIN;

-- Editorial alignment for ten-card hands. The game engine owns drawing and
-- keeps the Heritage's three-card reserve and +2 starting XP unchanged.
-- Existing identities, editorial names, custom art and earned copies survive.
SELECT pg_advisory_xact_lock(hashtext('kq_heritage_unique_effect_assignment'));

UPDATE public.kq_heritage_effect_catalog
SET default_description='+2 XP au départ. À la première étape, pioche 13 cartes et compose une main de 10.',
    updated_at=now()
WHERE effect_code='opening-hand-reserve'
  AND default_description IS DISTINCT FROM
    '+2 XP au départ. À la première étape, pioche 13 cartes et compose une main de 10.';

UPDATE public.kq_heritage_card_definitions
SET description='+2 XP au départ. À la première étape, pioche 13 cartes et compose une main de 10.',
    advantage='+2 XP au départ. À la première étape, pioche 13 cartes et compose une main de 10.',
    image_url=CASE
      WHEN code='HERITAGE-003' AND producer_id='producer-1773870509228-7130'
        AND image_url='/app/kanab-quest/card-fronts/heritage-003-main-prevoyante-producer-front-v5.webp'
      THEN '/app/kanab-quest/card-fronts/heritage-003-main-prevoyante-producer-front-v6.webp'
      ELSE image_url END,
    updated_at=now()
WHERE effect_code='opening-hand-reserve'
  AND (description IS DISTINCT FROM
    '+2 XP au départ. À la première étape, pioche 13 cartes et compose une main de 10.'
    OR advantage IS DISTINCT FROM
    '+2 XP au départ. À la première étape, pioche 13 cartes et compose une main de 10.'
    OR (code='HERITAGE-003' AND producer_id='producer-1773870509228-7130'
      AND image_url='/app/kanab-quest/card-fronts/heritage-003-main-prevoyante-producer-front-v5.webp'));

-- No tables/functions are created, and existing Data API privileges are kept.
COMMIT;
