-- Audit log table for tracking security-sensitive admin operations.
-- Rows are insert-only (no updates or deletes from application code).

BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type    text        NOT NULL,
  actor_email   text        NOT NULL DEFAULT '',
  ip            text        NOT NULL DEFAULT '',
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_event_type ON public.audit_logs (event_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- RLS: deny all direct client access. Rows are inserted via service-role client only.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_no_client_access ON public.audit_logs;

CREATE POLICY audit_logs_no_client_access
ON public.audit_logs
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

COMMIT;
