-- ============================================================
-- Welcome Pack: one-shot free lottery pack per user
-- ============================================================

-- Table storing one-time welcome pack claims (user_id is PK = at most one row per user)
CREATE TABLE IF NOT EXISTS public.lottery_welcome_pack_claims (
  user_id  UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lottery_welcome_pack_claims ENABLE ROW LEVEL SECURITY;

-- Users can only read their own claim row
CREATE POLICY "Users read own welcome pack claim"
  ON public.lottery_welcome_pack_claims
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role has full access (used by RPC with SECURITY DEFINER)
-- No INSERT/UPDATE/DELETE policy for authenticated — only the RPC function touches it.

-- ─── Atomic claim function ─────────────────────────────────
-- Returns TRUE if the pack was granted (first call), FALSE if already claimed.
-- Uses INSERT … ON CONFLICT DO NOTHING for idempotent one-shot guarantee.
-- On success, internally calls rpc_admin_grant_lottery_tickets to mint 1 ticket.
CREATE OR REPLACE FUNCTION public.rpc_claim_welcome_pack(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user_id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'customer_not_found';
  END IF;

  -- Atomic one-shot insert
  INSERT INTO public.lottery_welcome_pack_claims (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted THEN
    -- Grant exactly 1 ticket via the existing admin grant RPC
    PERFORM public.rpc_admin_grant_lottery_tickets(
      p_user_id,
      1,
      'Pack de bienvenue — inscription',
      'system@welcome-pack.local'
    );
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Permissions: only callable via service_role (backend)
REVOKE ALL ON FUNCTION public.rpc_claim_welcome_pack(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_claim_welcome_pack(UUID) TO service_role;
