BEGIN;

-- Reuse the producer allocator's lock while reserving Iznofarm's new mechanic.
SELECT pg_advisory_xact_lock(hashtext('kq_heritage_unique_effect_assignment'));

-- Existing named tables already have explicit Data API grants. This migration
-- changes editorial rows only; it creates no table, sequence, view or function.
INSERT INTO public.kq_heritage_effect_catalog (
  effect_code, timing, default_name, default_description, default_drawback, position
) VALUES (
  'flower-lowest-plus-three',
  'once-per-run',
  'Floraison généreuse',
  'En Floraison, ajoute +3 au dé le plus faible, sans dépasser 6.',
  'Réservé à la Floraison et utilisable une seule fois ; aucun effet si les trois dés valent déjà 6.',
  25
)
ON CONFLICT (effect_code) DO UPDATE SET
  timing = EXCLUDED.timing,
  default_name = EXCLUDED.default_name,
  default_description = EXCLUDED.default_description,
  default_drawback = EXCLUDED.default_drawback,
  position = EXCLUDED.position,
  is_active = TRUE,
  updated_at = now();

-- The original eight producers keep their identity, title and mechanic. Bring
-- the stale advantage text into line with the actual playable effect and use
-- newly rendered, versioned fronts. No ownership or acquisition row is touched.
WITH editorial(code, producer_id, effect_code, image_url) AS (
  VALUES
    ('HERITAGE-001', 'producer-1773873534114-8538', 'root-danger-to-spark', '/app/kanab-quest/card-fronts/heritage-001-racines-solides-producer-front-v4.webp'),
    ('HERITAGE-002', 'producer-1773870683520-7273', 'starting-xp-two', '/app/kanab-quest/card-fronts/heritage-002-reserve-jardinier-producer-front-v4.webp'),
    ('HERITAGE-003', 'producer-1773870509228-7130', 'opening-hand-reserve', '/app/kanab-quest/card-fronts/heritage-003-main-prevoyante-producer-front-v4.webp'),
    ('HERITAGE-004', 'producer-1771159879557-3228', 'climate-danger-to-spark', '/app/kanab-quest/card-fronts/heritage-004-climat-stable-producer-front-v4.webp'),
    ('HERITAGE-005', 'producer-1773870264609-7958', 'two-extra-redraws', '/app/kanab-quest/card-fronts/heritage-005-second-regard-producer-front-v4.webp'),
    ('HERITAGE-006', 'producer-1773869866555-1494', 'failure-to-fragile', '/app/kanab-quest/card-fronts/heritage-006-reprise-vigoureuse-producer-front-v4.webp'),
    ('HERITAGE-007', 'producer-1773871640332-4267', 'neutral-to-spark', '/app/kanab-quest/card-fronts/heritage-007-instinct-cultivateur-producer-front-v4.webp'),
    ('HERITAGE-008', 'producer-1775332866395-6178', 'free-pest-mastery', '/app/kanab-quest/card-fronts/heritage-008-bouclier-biologique-producer-front-v4.webp')
)
UPDATE public.kq_heritage_card_definitions definition
SET description = catalog.default_description,
    advantage = catalog.default_description,
    drawback = catalog.default_drawback,
    image_url = editorial.image_url,
    updated_at = now()
FROM editorial
JOIN public.kq_heritage_effect_catalog catalog
  ON catalog.effect_code = editorial.effect_code
WHERE definition.code = editorial.code
  AND definition.producer_id = editorial.producer_id
  AND definition.effect_code = editorial.effect_code;

-- Personalise the seven recent producer cards in place. Match both the stable
-- card code and producer id: a different producer can never inherit this art.
-- Expected effects also prevent overwriting a later deliberate reassignment.
WITH editorial(code, producer_id, name, previous_effect, effect_code, image_url) AS (
  VALUES
    ('HERITAGE-013', 'producer-1773871212890-5816', 'Canopée attentive', 'flower-neutrals-to-success', 'flower-neutrals-to-success', '/app/kanab-quest/card-fronts/heritage-013-cannapache-front-v2.webp'),
    ('HERITAGE-014', 'producer-1773871368477-5738', 'Affinage de l’estuaire', 'drying-lowest-to-spark', 'drying-lowest-to-spark', '/app/kanab-quest/card-fronts/heritage-014-cap-estuaire-front-v2.webp'),
    ('HERITAGE-015', 'producer-1773872025906-6885', 'Précision indoor', 'dangers-to-success', 'dangers-to-success', '/app/kanab-quest/card-fronts/heritage-015-skud-farm-front-v2.webp'),
    ('HERITAGE-016', 'producer-1784410504995-5263', 'Sélection du vivant', 'five-keep-three', 'five-keep-three', '/app/kanab-quest/card-fronts/heritage-016-3-feuilles-front-v2.webp'),
    ('HERITAGE-017', 'producer-1787050571187-9641', 'Éveil pyrénéen', 'germination-lowest-to-strong', 'germination-lowest-to-strong', '/app/kanab-quest/card-fronts/heritage-017-kanadea-front-v2.webp'),
    ('HERITAGE-018', 'producer-1787423717166-9078', 'Racines sereines', 'rooting-pressure-reset', 'rooting-pressure-reset', '/app/kanab-quest/card-fronts/heritage-018-buds-of-delight-front-v2.webp'),
    ('HERITAGE-019', 'producer-1790012817375-3215', 'Floraison généreuse', 'growth-danger-reroll', 'flower-lowest-plus-three', '/app/kanab-quest/card-fronts/heritage-019-iznofarm-front-v2.webp')
)
UPDATE public.kq_heritage_card_definitions definition
SET name = editorial.name,
    timing = catalog.timing,
    effect_code = editorial.effect_code,
    description = catalog.default_description,
    advantage = catalog.default_description,
    drawback = catalog.default_drawback,
    image_url = editorial.image_url,
    updated_at = now()
FROM editorial
JOIN public.kq_heritage_effect_catalog catalog
  ON catalog.effect_code = editorial.effect_code
WHERE definition.code = editorial.code
  AND definition.producer_id = editorial.producer_id
  AND definition.effect_code IN (editorial.previous_effect, editorial.effect_code);

COMMIT;
