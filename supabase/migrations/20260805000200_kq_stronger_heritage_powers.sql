-- Keep the persisted Heritage catalogue aligned with the stronger, deterministic
-- powers implemented by the game engine.
WITH balanced_cards(code, timing, effect_code, description) AS (
  VALUES
    ('HERITAGE-001', 'once-per-run', 'root-danger-to-spark', 'Le premier Danger en Enracinement devient une Étincelle.'),
    ('HERITAGE-002', 'passive', 'starting-xp-two', 'Commence chaque culture avec 2 XP supplémentaires.'),
    ('HERITAGE-003', 'once-per-run', 'opening-draw-thirteen', 'À la première étape, pioche 13 cartes et conserve une main de 10.'),
    ('HERITAGE-004', 'once-per-run', 'climate-danger-to-spark', 'Le premier Danger d’une situation Climat devient une Étincelle.'),
    ('HERITAGE-005', 'passive', 'two-extra-redraws', 'Accorde deux changements de main supplémentaires par culture.'),
    ('HERITAGE-006', 'once-per-run', 'failure-to-fragile', 'Le premier échec de la culture devient un résultat Fragile.'),
    ('HERITAGE-007', 'once-per-run', 'neutral-to-spark', 'Après un lancer, transforme un dé neutre en Étincelle.'),
    ('HERITAGE-008', 'once-per-run', 'free-pest-mastery', 'Révèle gratuitement le premier ravageur et accorde 2 XP.'),
    ('HERITAGE-009', 'once-per-run', 'flower-neutrals-to-success', 'Pendant la Floraison, transforme tous les dés neutres en réussites.'),
    ('HERITAGE-010', 'once-per-run', 'drying-lowest-to-spark', 'À la dernière étape, transforme le dé le plus faible en Étincelle.'),
    ('HERITAGE-011', 'once-per-run', 'dangers-to-success', 'Transforme tous les Dangers d’un lancer en réussites.'),
    ('HERITAGE-012', 'once-per-run', 'five-keep-three', 'Lance cinq dés et conserve les trois meilleurs.')
)
UPDATE public.kq_heritage_card_definitions AS definitions
SET
  timing = balanced_cards.timing,
  effect_code = balanced_cards.effect_code,
  description = balanced_cards.description
FROM balanced_cards
WHERE definitions.code = balanced_cards.code;
