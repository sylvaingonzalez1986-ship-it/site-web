BEGIN;

UPDATE public.invoices
SET
  sequence = 40,
  invoice_number = 'FA-2026-000040'
WHERE year = 2026
  AND sequence = 1
  AND NOT EXISTS (
    SELECT 1
    FROM public.invoices AS i
    WHERE i.year = 2026
      AND i.sequence = 40
  );

INSERT INTO public.invoice_counter ("year", next_sequence)
VALUES (2026, 41)
ON CONFLICT ("year")
DO UPDATE SET next_sequence = 41
WHERE invoice_counter.next_sequence < 41;

COMMIT;
