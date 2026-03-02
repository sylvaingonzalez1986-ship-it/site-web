-- ─────────────────────────────────────────────────────────────────
-- Simplify page-completion rewards: remove grammage, just
-- "Coffret Dégustation <rarity>" for each non-legendary tier.
-- Legendary already set to "1 an de conso" by previous migration.
-- ─────────────────────────────────────────────────────────────────

BEGIN;

UPDATE public.lottery_reward_definitions
SET title       = 'Coffret Dégustation Découverte',
    description = 'Coffret dégustation offert pour avoir complété la page Commune.',
    gift_label  = 'Coffret Dégustation Découverte',
    gift_weight_grams = NULL,
    updated_at  = now()
WHERE code = 'TCG_PAGE_COMMON';

UPDATE public.lottery_reward_definitions
SET title       = 'Coffret Dégustation Silver',
    description = 'Coffret dégustation offert pour avoir complété la page Silver.',
    gift_label  = 'Coffret Dégustation Silver',
    gift_weight_grams = NULL,
    updated_at  = now()
WHERE code = 'TCG_PAGE_SILVER';

UPDATE public.lottery_reward_definitions
SET title       = 'Coffret Dégustation Gold',
    description = 'Coffret dégustation offert pour avoir complété la page Gold.',
    gift_label  = 'Coffret Dégustation Gold',
    gift_weight_grams = NULL,
    updated_at  = now()
WHERE code = 'TCG_PAGE_GOLD';

UPDATE public.lottery_reward_definitions
SET title       = 'Coffret Dégustation Épique',
    description = 'Coffret dégustation offert pour avoir complété la page Épique.',
    gift_label  = 'Coffret Dégustation Épique',
    gift_weight_grams = NULL,
    updated_at  = now()
WHERE code = 'TCG_PAGE_EPIC';

COMMIT;
