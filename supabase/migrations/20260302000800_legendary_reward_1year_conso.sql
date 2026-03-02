-- ─────────────────────────────────────────────────────────────────
-- Update legendary page-completion reward:
--   "Pack Degustation Legendaire (25g)"  →  "1 an de conso (1 g/jour)"
--   365 g instead of 25 g
-- ─────────────────────────────────────────────────────────────────

BEGIN;

UPDATE public.lottery_reward_definitions
SET
  title       = '1 an de consommation (1 g/jour)',
  description = 'Récompense légendaire : 1 an de consommation offert, soit 365 g (1 g par jour pendant 365 jours).',
  gift_weight_grams = 365,
  gift_label  = '1 an de conso (365 g)',
  updated_at  = now()
WHERE code = 'TCG_PAGE_LEGENDARY';

COMMIT;
