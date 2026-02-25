-- Enforce RLS on internal security rate-limit table exposed in public schema.
-- This table is only meant to be accessed by security-definer RPCs.

BEGIN;

ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_rate_limits_no_client_access
ON public.security_rate_limits;

CREATE POLICY security_rate_limits_no_client_access
ON public.security_rate_limits
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

COMMIT;
