BEGIN;

UPDATE public.kq_heritage_card_definitions
SET effect_code = 'opening-hand-reserve',
    description = 'À la première étape, pioche 8 cartes et compose une main de 5.'
WHERE code = 'HERITAGE-003';

UPDATE public.kq_runs
SET state = jsonb_set(
      state,
      '{handCodes}',
      COALESCE(
        (
          SELECT jsonb_agg(card.value ORDER BY card.ordinality)
          FROM jsonb_array_elements(state->'handCodes') WITH ORDINALITY AS card(value, ordinality)
          WHERE card.ordinality <= 5
        ),
        '[]'::JSONB
      ),
      TRUE
    ),
    rules_version = GREATEST(rules_version, 2),
    updated_at = now()
WHERE status = 'active'
  AND jsonb_typeof(state->'handCodes') = 'array'
  AND jsonb_array_length(state->'handCodes') > 5;

COMMIT;
