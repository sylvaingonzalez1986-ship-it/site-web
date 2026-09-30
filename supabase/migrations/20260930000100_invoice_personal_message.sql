BEGIN;

-- A note belongs to the existing issued invoice; numbering and issuance stay unchanged.
ALTER TABLE public.invoices
  ADD COLUMN personal_message TEXT NOT NULL DEFAULT '',
  ADD CONSTRAINT invoices_personal_message_length_check
    CHECK (char_length(personal_message) <= 1000),
  ADD CONSTRAINT invoices_personal_message_lines_check
    CHECK (cardinality(string_to_array(personal_message, E'\n')) <= 20);

-- Only the server reads and updates the note. Preserve the existing table grants
-- used by issuance and historical import tools; add no client-role privileges.
GRANT SELECT (personal_message), UPDATE (personal_message)
  ON TABLE public.invoices TO service_role;

COMMIT;
