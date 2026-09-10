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
    'compost-buffer', 'starter-stability', 'safe-neutral-reroll',
    'pbi-thrips-relief'
  ));

WITH cards(code, description) AS (
  VALUES
    (
      'BOTTE-001',
      'Sur Racines, si aucun dé ne réussit, transforme le meilleur dé neutre en 4.'
    ),
    (
      'BOTTE-007',
      'Sur Eau, relance un dé neutre mais conserve toujours la meilleure des deux faces.'
    ),
    (
      'BOTTE-023',
      'Contre les thrips, transforme un dé faible en réussite et réduit la Pression de 1.'
    )
)
UPDATE public.lottery_card_definitions AS definitions
SET description = cards.description,
    updated_at = now()
FROM cards
WHERE definitions.code = cards.code;

WITH rules(code, category, timing, effect, xp_cost, tags, targets, advantage, drawback) AS (
  VALUES
    (
      'BOTTE-001', 'substrate', 'passive', 'starter-stability', 0,
      ARRAY['roots']::TEXT[], '{}'::TEXT[],
      'Garantit une réussite à partir d’un dé neutre quand les Racines n’en obtiennent aucune.',
      'Ne se déclenche ni si une réussite est déjà présente, ni sur un lancer composé uniquement de Dangers.'
    ),
    (
      'BOTTE-007', 'substrate', 'passive', 'safe-neutral-reroll', 0,
      ARRAY['water']::TEXT[], '{}'::TEXT[],
      'Relance un dé neutre sans jamais conserver un résultat inférieur.',
      'Ne couvre que les Situations Eau, contrairement aux mélanges plus polyvalents.'
    ),
    (
      'BOTTE-023', 'pbi', 'after-roll', 'pbi-thrips-relief', 2,
      ARRAY['pest']::TEXT[], ARRAY['thrips']::TEXT[],
      'Corrige un dé faible contre les thrips et réduit immédiatement la Pression de 1.',
      'Ne cible que les thrips et brûle l’unique réaction de l’étape.'
    )
)
UPDATE public.kq_support_card_rules AS card_rules
SET category = rules.category,
    timing = rules.timing,
    effect = rules.effect,
    xp_cost = rules.xp_cost,
    tags = rules.tags,
    targets = rules.targets,
    advantage = rules.advantage,
    drawback = rules.drawback,
    rules_version = card_rules.rules_version + 1,
    updated_at = now()
FROM rules
JOIN public.lottery_card_definitions AS definitions ON definitions.code = rules.code
WHERE card_rules.card_definition_id = definitions.id;

COMMIT;
