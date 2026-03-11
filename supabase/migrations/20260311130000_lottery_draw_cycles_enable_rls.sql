-- Enforce RLS on internal lottery draw cycle state exposed in the public schema.
-- This table is meant to be accessed via server-side code and security-definer RPCs only.

BEGIN;

ALTER TABLE public.lottery_draw_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lottery_draw_cycles_no_client_access
ON public.lottery_draw_cycles;

CREATE POLICY lottery_draw_cycles_no_client_access
ON public.lottery_draw_cycles
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

COMMIT;