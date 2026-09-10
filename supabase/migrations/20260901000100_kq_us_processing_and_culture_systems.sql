BEGIN;

ALTER TABLE public.kq_equipment_catalog
  DROP CONSTRAINT IF EXISTS kq_equipment_catalog_slot_check;
ALTER TABLE public.kq_equipment_catalog
  ADD CONSTRAINT kq_equipment_catalog_slot_check CHECK (slot IN (
    'tent', 'lighting', 'air', 'climate-controller', 'sifting', 'washing',
    'filtration', 'static-separation', 'press', 'drying', 'energy', 'security'
  ));

ALTER TABLE public.kq_equipment_loadouts
  DROP CONSTRAINT IF EXISTS kq_equipment_loadouts_slot_check;
ALTER TABLE public.kq_equipment_loadouts
  ADD CONSTRAINT kq_equipment_loadouts_slot_check CHECK (slot IN (
    'tent', 'lighting', 'air', 'climate-controller', 'sifting', 'washing',
    'filtration', 'static-separation', 'press', 'drying', 'energy', 'security'
  ));

INSERT INTO public.kq_equipment_catalog(
  code, category, slot, price_cents, is_purchasable, is_active, sort_order
)
VALUES
  ('TENT-080-STARTER', 'infrastructure', 'tent', 0, FALSE, TRUE, 10),
  ('TENT-120', 'infrastructure', 'tent', 19900, TRUE, TRUE, 20),
  ('TENT-150', 'infrastructure', 'tent', 24900, TRUE, TRUE, 30),
  ('LED-150-STARTER', 'lighting', 'lighting', 0, FALSE, TRUE, 40),
  ('LED-300', 'lighting', 'lighting', 35900, TRUE, TRUE, 50),
  ('LED-500', 'lighting', 'lighting', 57900, TRUE, TRUE, 60),
  ('AIR-STARTER', 'climate', 'air', 0, FALSE, TRUE, 70),
  ('AIR-EC6', 'climate', 'air', 14900, TRUE, TRUE, 80),
  ('CLIMATE-SMART', 'climate', 'climate-controller', 13900, TRUE, TRUE, 90),
  ('SIFT-TRAY', 'processing', 'sifting', 419500, TRUE, TRUE, 100),
  ('WASHER-25L', 'processing', 'washing', 599500, TRUE, TRUE, 110),
  ('AUTO-SIEVE', 'processing', 'filtration', 499500, TRUE, TRUE, 120),
  ('WASHER-75G', 'processing', 'washing', 3049500, TRUE, TRUE, 130),
  ('TSS-225', 'processing', 'washing', 7940000, TRUE, TRUE, 140),
  ('STATIC-PLASMA', 'processing', 'static-separation', 2280000, TRUE, TRUE, 150),
  ('PRESS-0600', 'processing', 'press', 369500, TRUE, TRUE, 160),
  ('PRESS-2T', 'processing', 'press', 799500, TRUE, TRUE, 170),
  ('PRESS-10T', 'processing', 'press', 1149500, TRUE, TRUE, 180),
  ('PRESS-20T', 'processing', 'press', 1999600, TRUE, TRUE, 190),
  ('FREEZE-DRYER', 'processing', 'drying', 749500, TRUE, TRUE, 200),
  ('SOLAR-BACKUP', 'energy', 'energy', 114900, TRUE, TRUE, 210),
  ('SECURITY-CAMERA', 'security', 'security', 6999, TRUE, TRUE, 220)
ON CONFLICT (code) DO UPDATE SET
  category = EXCLUDED.category,
  slot = EXCLUDED.slot,
  price_cents = EXCLUDED.price_cents,
  is_purchasable = EXCLUDED.is_purchasable,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

ALTER TABLE public.kq_support_card_rules
  DROP CONSTRAINT IF EXISTS kq_support_card_rules_effect_check;
ALTER TABLE public.kq_support_card_rules
  ADD CONSTRAINT kq_support_card_rules_effect_check CHECK (effect IN (
    'reroll-neutral', 'pbi-success', 'pbi-strong-success', 'pbi-success-xp',
    'cancel-danger', 'reveal-pest', 'reroll-two-low', 'neutral-to-success',
    'four-keep-three', 'three-to-success', 'water-test', 'pest-monitor',
    'double-danger-shield', 'moisture-calibration', 'harvest-four-quality',
    'harvest-cool', 'danger-to-neutral', 'clean-cut', 'compliance-clearance',
    'illegal-power', 'bill-relief', 'theft-guard', 'root-aeration',
    'compost-buffer', 'safe-neutral-reroll', 'starter-stability',
    'hydroponic-control', 'aeroponic-precision', 'living-soil-buffer',
    'perlite-drainage', 'biochar-buffer', 'organic-feed', 'pbi-thrips-relief'
  ));

WITH cards(code, name, rarity, description, visual_prompt) AS (
  VALUES
    (
      'BOTTE-001', 'Terreau horticole', 'common',
      'Sur Racines ou Eau, si aucun dé ne réussit, transforme le meilleur dé neutre en 4.',
      'Illustration verticale cartoon 2D, key art satirique original. Sylvain fidèle à la mascotte prépare un terreau horticole sombre dans un grand bac, avec sacs neutres et outils simples. Gros contours noirs, aplats turquoise, beige, crème et jaune, trame halftone, sans texte ni logo.'
    ),
    (
      'BOTTE-007', 'Hydroponie recirculante', 'silver',
      'Sur Eau ou Floraison, relance un dé neutre et garde la meilleure face ; une coupure arrête les pompes.',
      'Illustration verticale cartoon 2D, key art satirique original. Sylvain fidèle à la mascotte surveille un réservoir hydroponique recirculant, pompe, tuyaux et paniers ajourés clairement visibles. Gros contours noirs, aplats francs, trame halftone, sans texte ni logo.'
    ),
    (
      'BOTTE-008', 'Aéroponie haute pression', 'gold',
      'Sur Racines, Eau ou Climat, transforme un dé neutre en 5 ; une coupure transforme les deux meilleurs dés en Dangers.',
      'Illustration verticale cartoon 2D, key art satirique original. Sylvain fidèle à la mascotte ouvre une chambre racinaire aéroponique où des buses créent une brume fine autour de racines suspendues. Énergie spectaculaire mais lisible, gros contours noirs, sans texte ni logo.'
    ),
    (
      'BOTTE-009', 'Sol vivant', 'gold',
      'Sur Racines ou Ravageur, la vie du sol amortit le premier Danger en résultat neutre.',
      'Illustration verticale cartoon 2D, key art satirique original. Sylvain fidèle à la mascotte observe un grand lit de sol vivant avec paillage, vers, champignons et plantes compagnes. Gros contours noirs, aplats chauds, trame halftone, sans texte ni logo.'
    ),
    (
      'BOTTE-019', 'Perlite calibrée', 'common',
      'Sur Racines ou Eau, corrige le plus mauvais dé : un 1 devient 2, ou un 2 devient 4.',
      'Illustration verticale cartoon 2D, key art satirique original. Sylvain fidèle à la mascotte dose de la perlite blanche dans un mélange de culture, avec un nuage léger et une pelle graduée. Gros contours noirs, gag visuel doux, sans texte ni logo.'
    ),
    (
      'BOTTE-020', 'Biochar inoculé', 'silver',
      'Sur Racines ou Ravageur, transforme le premier Danger en neutre et réduit la Pression de 1.',
      'Illustration verticale cartoon 2D, key art satirique original. Sylvain fidèle à la mascotte mélange du biochar noir déjà inoculé dans du compost, entouré de micro-organismes stylisés. Gros contours noirs, palette turquoise et terre, sans texte ni logo.'
    ),
    (
      'BOTTE-021', 'Engrais bio complet', 'gold',
      'Sur Racines ou Floraison, avec exactement deux réussites, transforme un dé neutre en Étincelle.',
      'Illustration verticale cartoon 2D, key art satirique original. Sylvain fidèle à la mascotte soupèse un sac générique d''engrais organique complet près d''un thé de compost brassé. Scène drôle, gros contours noirs, aplats francs, sans marque, texte ni logo.'
    )
)
UPDATE public.lottery_card_definitions AS definitions
SET name = cards.name,
    rarity = cards.rarity::public.lottery_card_rarity,
    description = cards.description,
    visual_prompt = cards.visual_prompt,
    updated_at = now()
FROM cards
WHERE definitions.code = cards.code;

WITH rules(code, category, timing, effect, xp_cost, tags, advantage, drawback) AS (
  VALUES
    ('BOTTE-001', 'substrate', 'passive', 'starter-stability', 0, ARRAY['roots','water']::TEXT[], 'Tolérant et gratuit pour démarrer.', 'Plafond faible : ne corrige un lancer que s''il ne contient aucune réussite.'),
    ('BOTTE-007', 'substrate', 'passive', 'hydroponic-control', 0, ARRAY['water','flower']::TEXT[], 'Relance sûre grâce au contrôle de la solution nutritive.', 'Les pompes dépendent du courant.'),
    ('BOTTE-008', 'substrate', 'passive', 'aeroponic-precision', 0, ARRAY['roots','water','climate']::TEXT[], 'Transforme un neutre en réussite forte sur trois familles.', 'Une coupure transforme les deux meilleurs dés en Dangers.'),
    ('BOTTE-009', 'substrate', 'passive', 'living-soil-buffer', 0, ARRAY['roots','pest']::TEXT[], 'Amortit le premier Danger grâce au tampon biologique.', 'Le résultat reste neutre et le bénéfice est limité à Racines et Ravageur.'),
    ('BOTTE-019', 'equipment', 'after-roll', 'perlite-drainage', 1, ARRAY['roots','water']::TEXT[], 'Corrige le plus mauvais dé après l''avoir vu.', 'Un Danger ne devient que neutre et la réaction est consommée.'),
    ('BOTTE-020', 'know-how', 'before-roll', 'biochar-buffer', 2, ARRAY['roots','pest']::TEXT[], 'Amortit un Danger et réduit la Pression.', 'Les 2 XP sont perdus si aucun Danger ne sort.'),
    ('BOTTE-021', 'know-how', 'after-roll', 'organic-feed', 2, ARRAY['roots','flower']::TEXT[], 'Convertit un résultat solide en Étincelle.', 'Exige exactement deux réussites et un dé neutre.')
)
UPDATE public.kq_support_card_rules AS card_rules
SET category = rules.category,
    timing = rules.timing,
    effect = rules.effect,
    xp_cost = rules.xp_cost,
    tags = rules.tags,
    targets = '{}',
    advantage = rules.advantage,
    drawback = rules.drawback,
    rules_version = card_rules.rules_version + 1,
    updated_at = now()
FROM rules
JOIN public.lottery_card_definitions AS definitions ON definitions.code = rules.code
WHERE card_rules.card_definition_id = definitions.id;

COMMIT;
