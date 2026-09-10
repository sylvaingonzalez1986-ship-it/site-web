BEGIN;

ALTER TABLE public.kq_support_card_rules
  DROP CONSTRAINT IF EXISTS kq_support_card_rules_effect_check;

ALTER TABLE public.kq_support_card_rules
  ADD CONSTRAINT kq_support_card_rules_effect_check CHECK (effect IN (
    'reroll-neutral', 'pbi-success', 'pbi-strong-success', 'pbi-success-xp',
    'cancel-danger', 'reveal-pest', 'reroll-two-low', 'neutral-to-success',
    'four-keep-three', 'three-to-success', 'water-test', 'pest-monitor',
    'double-danger-shield', 'moisture-calibration', 'harvest-four-quality',
    'harvest-cool', 'danger-to-neutral', 'clean-cut', 'compliance-clearance',
    'illegal-power', 'bill-relief', 'theft-guard'
  ));

WITH cards(code, name, rarity, description, visual_prompt, image_url) AS (
  VALUES
    (
      'BOTTE-027',
      'Papiers en règle',
      'gold',
      'Face à un contrôle DDTM, présente le dossier complet : les trois dés deviennent des réussites.',
      'Illustration verticale cartoon 2D, key art satirique original. Reprendre fidèlement Sylvain : mascotte ronde, visage crème très simple, petits yeux noirs, casquette bicolore turquoise et beige à visière noire, pull beige, salopette turquoise, gants crème et chaussures beiges. Il présente un classeur administratif géant à deux contrôleurs surpris. Gros contours noirs, aplats francs, trame halftone, palette turquoise, beige, crème et jaune, sans texte ni logo.',
      '/app/kanab-quest/cards/botte-027-papiers-en-regle-v3.webp'
    ),
    (
      'BOTTE-028',
      'Branchement illégal',
      'silver',
      'Après un mauvais jet sur la facture, transforme les deux dés les plus faibles en réussites mais gagne 2 Pression.',
      'Illustration verticale cartoon 2D, key art satirique original. Reprendre fidèlement Sylvain : mascotte ronde, visage crème très simple, petits yeux noirs, casquette bicolore turquoise et beige à visière noire, pull beige, salopette turquoise, gants crème et chaussures beiges. De nuit, il tient une multiprise surchargée qui projette des étincelles près d’un compteur. Gros contours noirs, aplats francs, trame halftone, danger burlesque, sans schéma technique, texte ni logo.',
      '/app/kanab-quest/cards/botte-028-branchement-illegal-v3.webp'
    ),
    (
      'BOTTE-031',
      'Échéancier négocié',
      'common',
      'Sur une Situation Énergie, réduit de 1 le nombre de réussites exigées par le créancier.',
      'Illustration verticale cartoon 2D, key art satirique original. Reprendre fidèlement Sylvain : mascotte ronde, visage crème très simple, petits yeux noirs, casquette bicolore turquoise et beige à visière noire, pull beige, salopette turquoise, gants crème et chaussures beiges. Il négocie au téléphone devant une facture générique, un calendrier et une calculatrice. Une seule scène, gros contours noirs, aplats francs, trame halftone, lumière chaude, sans texte, chiffres ni logo.',
      '/app/kanab-quest/cards/botte-031-echeancier-negocie-v3.webp'
    ),
    (
      'BOTTE-034',
      'Gros molosse',
      'gold',
      'Protège toute la récolte contre le Renard à deux pattes, quel que soit le résultat des dés.',
      'Illustration verticale cartoon 2D, key art satirique original. Rottweiler massif et fier au premier plan avec un morceau de caleçon à carreaux rouge et crème dans la gueule ; voleur en fuite derrière la clôture ; Sylvain fidèle à la mascotte de référence sourit depuis la porte, avec casquette turquoise et beige, pull beige et salopette turquoise. Gros contours noirs, aplats francs, trame halftone, gag non graphique, sans texte ni logo.',
      '/app/kanab-quest/cards/botte-034-gros-molosse-v3.webp'
    )
)
UPDATE public.lottery_card_definitions AS definitions
SET name = cards.name,
    rarity = cards.rarity::public.lottery_card_rarity,
    description = cards.description,
    visual_prompt = cards.visual_prompt,
    image_url = cards.image_url,
    updated_at = now()
FROM cards
WHERE definitions.code = cards.code;

WITH rules(code, category, timing, effect, xp_cost, tags, advantage, drawback) AS (
  VALUES
    (
      'BOTTE-027', 'equipment', 'before-roll', 'compliance-clearance', 3,
      ARRAY['compliance']::TEXT[],
      'Garantit immédiatement trois réussites pendant le contrôle DDTM.',
      'Coûte 3 XP et ne sert que sur cette Situation administrative.'
    ),
    (
      'BOTTE-028', 'luck', 'after-roll', 'illegal-power', 1,
      ARRAY['energy']::TEXT[],
      'Transforme les deux dés les plus faibles en réussites et peut éviter la coupure.',
      'Ajoute immédiatement 2 Pression et brûle la carte.'
    ),
    (
      'BOTTE-031', 'know-how', 'before-roll', 'bill-relief', 1,
      ARRAY['energy']::TEXT[],
      'Réduit de 1 le seuil de réussite de la facture électrique.',
      'Ne change aucune face de dé et reste réservé aux Situations Énergie.'
    ),
    (
      'BOTTE-034', 'equipment', 'before-roll', 'theft-guard', 2,
      ARRAY['security']::TEXT[],
      'Empêche toute perte de quantité lors du vol de récolte.',
      'Ne change pas le verdict du jury et coûte 2 XP.'
    )
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
