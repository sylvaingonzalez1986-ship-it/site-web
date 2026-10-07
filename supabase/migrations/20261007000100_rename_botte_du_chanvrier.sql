BEGIN;

UPDATE public.lottery_card_collections
SET title = 'Botte du Chanvrier'
WHERE code = 'BOTTE_DU_CHANVRIER_2026';

COMMIT;
