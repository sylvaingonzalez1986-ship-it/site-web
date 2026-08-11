BEGIN;

ALTER TABLE public.kq_support_card_rules
  DROP CONSTRAINT IF EXISTS kq_support_card_rules_effect_check;

ALTER TABLE public.kq_support_card_rules
  ADD CONSTRAINT kq_support_card_rules_effect_check CHECK (effect IN (
    'reroll-neutral', 'pbi-success', 'pbi-strong-success', 'pbi-success-xp',
    'cancel-danger', 'reveal-pest', 'reroll-two-low', 'neutral-to-success',
    'four-keep-three', 'three-to-success', 'water-test', 'pest-monitor',
    'double-danger-shield', 'moisture-calibration', 'harvest-four-quality',
    'harvest-cool', 'danger-to-neutral', 'clean-cut'
  ));

WITH cards(code, name, rarity, description, image_url) AS (
  VALUES
    ('BOTTE-018', 'Testeur pH–EC', 'silver', 'Relance le dé le plus faible sur une Situation Eau ou Racines et gagne 1 XP si le résultat s’améliore.', '/app/kanab-quest/cards/botte-018-testeur-ph-ec-v2.webp'),
    ('BOTTE-025', 'Plaque engluée de suivi', 'silver', 'Identifie le ravageur et récupère 1 XP pour préparer une réponse PBI.', '/app/kanab-quest/cards/botte-025-plaque-engluee-suivi-v2.webp'),
    ('BOTTE-026', 'Extracteur bien réglé', 'silver', 'Annule jusqu’à deux Dangers sur une Situation Climat ou Séchage.', '/app/kanab-quest/cards/botte-026-extracteur-bien-regle-v2.webp'),
    ('BOTTE-030', 'Sonde d’humidité', 'gold', 'Pendant le Séchage, transforme un 2 en 4 ou un 3 en 5.', '/app/kanab-quest/cards/botte-030-sonde-humidite-v2.webp'),
    ('BOTTE-032', 'Loupe à trichomes', 'gold', 'En Récolte, lance quatre dés, garde les trois meilleurs et gagne 1 Qualité en cas de réussite.', '/app/kanab-quest/cards/botte-032-loupe-trichomes-v2.webp'),
    ('BOTTE-033', 'Récolte au frais', 'common', 'Annule un Danger en Récolte et réduit la Pression de 1 si la protection se déclenche.', '/app/kanab-quest/cards/botte-033-recolte-frais-v2.webp'),
    ('BOTTE-035', 'Récolte par lots', 'silver', 'En Récolte, transforme un Danger en résultat neutre pour isoler la partie fragile du lot.', '/app/kanab-quest/cards/botte-035-recolte-lots-v2.webp'),
    ('BOTTE-036', 'Sécateur propre', 'common', 'Annule un Danger en Récolte et rapporte 1 XP si l’étape est réussie.', '/app/kanab-quest/cards/botte-036-secateur-propre-v2.webp')
)
UPDATE public.lottery_card_definitions AS definitions
SET name = cards.name, rarity = cards.rarity::public.lottery_card_rarity, description = cards.description,
    image_url = cards.image_url, updated_at = now()
FROM cards
WHERE definitions.code = cards.code;

WITH rules(code, category, timing, effect, xp_cost, tags) AS (
  VALUES
    ('BOTTE-018', 'equipment', 'after-roll', 'water-test', 2, ARRAY['water','roots']::TEXT[]),
    ('BOTTE-025', 'equipment', 'before-roll', 'pest-monitor', 1, ARRAY['pest']::TEXT[]),
    ('BOTTE-026', 'equipment', 'before-roll', 'double-danger-shield', 2, ARRAY['climate','drying']::TEXT[]),
    ('BOTTE-030', 'equipment', 'after-roll', 'moisture-calibration', 2, ARRAY['drying']::TEXT[]),
    ('BOTTE-032', 'equipment', 'before-roll', 'harvest-four-quality', 2, ARRAY['harvest']::TEXT[]),
    ('BOTTE-033', 'know-how', 'before-roll', 'harvest-cool', 1, ARRAY['harvest','climate']::TEXT[]),
    ('BOTTE-035', 'know-how', 'after-roll', 'danger-to-neutral', 2, ARRAY['harvest']::TEXT[]),
    ('BOTTE-036', 'equipment', 'before-roll', 'clean-cut', 1, ARRAY['harvest']::TEXT[])
)
UPDATE public.kq_support_card_rules AS card_rules
SET category = rules.category, timing = rules.timing, effect = rules.effect,
    xp_cost = rules.xp_cost, tags = rules.tags, targets = '{}',
    rules_version = card_rules.rules_version + 1, updated_at = now()
FROM rules
JOIN public.lottery_card_definitions AS definitions ON definitions.code = rules.code
WHERE card_rules.card_definition_id = definitions.id;

COMMIT;
