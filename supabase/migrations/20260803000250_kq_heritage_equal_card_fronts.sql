BEGIN;

UPDATE public.kq_heritage_card_definitions
SET image_url = CASE code
  WHEN 'HERITAGE-001' THEN '/app/kanab-quest/card-fronts/heritage-001-racines-solides-producer-front-v3.webp'
  WHEN 'HERITAGE-002' THEN '/app/kanab-quest/card-fronts/heritage-002-reserve-jardinier-producer-front-v3.webp'
  WHEN 'HERITAGE-003' THEN '/app/kanab-quest/card-fronts/heritage-003-main-prevoyante-producer-front-v3.webp'
  WHEN 'HERITAGE-004' THEN '/app/kanab-quest/card-fronts/heritage-004-climat-stable-producer-front-v3.webp'
  WHEN 'HERITAGE-005' THEN '/app/kanab-quest/card-fronts/heritage-005-second-regard-producer-front-v3.webp'
  WHEN 'HERITAGE-006' THEN '/app/kanab-quest/card-fronts/heritage-006-reprise-vigoureuse-producer-front-v3.webp'
  WHEN 'HERITAGE-007' THEN '/app/kanab-quest/card-fronts/heritage-007-instinct-cultivateur-producer-front-v3.webp'
  WHEN 'HERITAGE-008' THEN '/app/kanab-quest/card-fronts/heritage-008-bouclier-biologique-producer-front-v3.webp'
  WHEN 'HERITAGE-009' THEN '/app/kanab-quest/card-fronts/heritage-009-floraison-maitrisee-front-v3.webp'
  WHEN 'HERITAGE-010' THEN '/app/kanab-quest/card-fronts/heritage-010-affinage-patient-front-v3.webp'
  WHEN 'HERITAGE-011' THEN '/app/kanab-quest/card-fronts/heritage-011-canopy-legacy-front-v3.webp'
  WHEN 'HERITAGE-012' THEN '/app/kanab-quest/card-fronts/heritage-012-signature-maitre-front-v3.webp'
  ELSE image_url
END,
updated_at = now()
WHERE code BETWEEN 'HERITAGE-001' AND 'HERITAGE-012';

COMMIT;
