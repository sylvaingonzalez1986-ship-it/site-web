BEGIN;

DELETE FROM public.products
WHERE id ~ '^printful-v-[0-9]+$';

COMMIT;
