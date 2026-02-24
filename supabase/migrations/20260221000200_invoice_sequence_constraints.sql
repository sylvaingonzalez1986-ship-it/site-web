BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_year_sequence_key'
      AND conrelid = 'public.invoices'::regclass
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_year_sequence_key UNIQUE (year, sequence);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_sequence_positive_chk'
      AND conrelid = 'public.invoices'::regclass
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_sequence_positive_chk CHECK (sequence > 0);
  END IF;
END $$;
COMMIT;
