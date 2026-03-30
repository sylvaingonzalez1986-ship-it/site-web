BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_issue_invoice(
  p_order_id TEXT
)
RETURNS TABLE (
  invoice_number TEXT,
  sequence INTEGER,
  year INTEGER,
  issued_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_current_year INTEGER;
  v_sequence INTEGER;
  v_invoice_number TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id, 0));

  RETURN QUERY
  SELECT i.invoice_number, i.sequence, i.year, i.issued_at
  FROM public.invoices AS i
  WHERE i.order_id = p_order_id;

  IF FOUND THEN
    RETURN;
  END IF;

  v_current_year := EXTRACT(YEAR FROM now())::INTEGER;

  INSERT INTO public.invoice_counter ("year", next_sequence)
  VALUES (v_current_year, 1)
  ON CONFLICT ("year") DO NOTHING;

  WITH next_value AS (
    SELECT GREATEST(
      ic.next_sequence,
      COALESCE((
        SELECT MAX(i.sequence) + 1
        FROM public.invoices AS i
        WHERE i.year = v_current_year
      ), 1)
    ) AS next_sequence
    FROM public.invoice_counter AS ic
    WHERE ic.year = v_current_year
    FOR UPDATE
  )
  UPDATE public.invoice_counter AS ic
  SET next_sequence = next_value.next_sequence + 1
  FROM next_value
  WHERE ic.year = v_current_year
  RETURNING next_value.next_sequence INTO v_sequence;

  v_invoice_number := format('FA-%s-%s', v_current_year, lpad(v_sequence::text, 6, '0'));

  INSERT INTO public.invoices (order_id, invoice_number, sequence, "year")
  VALUES (p_order_id, v_invoice_number, v_sequence, v_current_year);

  RETURN QUERY
  SELECT i.invoice_number, i.sequence, i.year, i.issued_at
  FROM public.invoices AS i
  WHERE i.order_id = p_order_id;
END;
$$;

INSERT INTO public.invoice_counter ("year", next_sequence)
SELECT yearly.year, yearly.next_sequence
FROM (
  SELECT i.year, MAX(i.sequence) + 1 AS next_sequence
  FROM public.invoices AS i
  GROUP BY i.year
) AS yearly
ON CONFLICT ("year")
DO UPDATE SET next_sequence = GREATEST(public.invoice_counter.next_sequence, EXCLUDED.next_sequence);

REVOKE ALL ON FUNCTION public.rpc_issue_invoice(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_issue_invoice(TEXT) TO service_role;

COMMIT;