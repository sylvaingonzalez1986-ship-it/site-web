BEGIN;

ALTER FUNCTION public.rpc_kq_grant_notebook_badge_reward(UUID, BIGINT)
  RENAME TO rpc_kq_grant_notebook_badge_reward_unlocked;

REVOKE ALL ON FUNCTION public.rpc_kq_grant_notebook_badge_reward_unlocked(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.rpc_kq_grant_notebook_badge_reward(
  p_user_id UUID,
  p_profile_badge_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::TEXT || ':notebook-badge:' || p_profile_badge_id::TEXT, 0)
  );
  RETURN public.rpc_kq_grant_notebook_badge_reward_unlocked(
    p_user_id,
    p_profile_badge_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_grant_notebook_badge_reward(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_grant_notebook_badge_reward(UUID, BIGINT)
  TO service_role;

COMMENT ON FUNCTION public.rpc_kq_grant_notebook_badge_reward(UUID, BIGINT)
  IS 'Serializes one customer/profile-badge reward before invoking the dormant atomic notebook grant.';

COMMIT;
