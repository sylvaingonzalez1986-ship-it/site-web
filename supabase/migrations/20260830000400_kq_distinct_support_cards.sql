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
    'illegal-power', 'bill-relief', 'theft-guard', 'root-aeration',
    'compost-buffer'
  ));

WITH cards(code, description) AS (
  VALUES
    (
      'BOTTE-013',
      'Transforme un Danger en résultat neutre sur Racines ou Eau, mais gagne 1 Pression car le pot sèche vite.'
    ),
    (
      'BOTTE-021',
      'Sur Racines ou Ravageur, transforme le premier Danger en résultat neutre sans relancer les dés.'
    )
)
UPDATE public.lottery_card_definitions AS definitions
SET description = cards.description,
    updated_at = now()
FROM cards
WHERE definitions.code = cards.code;

WITH rules(code, category, timing, effect, xp_cost, tags, advantage, drawback) AS (
  VALUES
    (
      'BOTTE-013', 'equipment', 'before-roll', 'root-aeration', 1,
      ARRAY['roots','water']::TEXT[],
      'Transforme un Danger en résultat neutre sur Racines ou Eau.',
      'Le pot sèche vite : jouer la carte ajoute immédiatement 1 Pression.'
    ),
    (
      'BOTTE-021', 'substrate', 'passive', 'compost-buffer', 0,
      ARRAY['roots','pest']::TEXT[],
      'Le compost amortit automatiquement le premier Danger sur Racines ou Ravageur.',
      'Le résultat devient seulement neutre et aucun dé n’est relancé.'
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
