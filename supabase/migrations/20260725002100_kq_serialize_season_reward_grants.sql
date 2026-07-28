BEGIN;

ALTER FUNCTION public.rpc_kq_grant_season_reward(
  TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER
) RENAME TO rpc_kq_grant_season_reward_unlocked;

REVOKE ALL ON FUNCTION public.rpc_kq_grant_season_reward_unlocked(
  TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.rpc_kq_grant_season_reward(
  p_season_code TEXT,
  p_user_id UUID,
  p_tier_code TEXT,
  p_final_rank INTEGER,
  p_final_rating INTEGER,
  p_final_season_points INTEGER,
  p_battles INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key TEXT;
BEGIN
  v_lock_key := p_season_code || ':' || p_user_id::TEXT || ':' || p_tier_code;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
  RETURN public.rpc_kq_grant_season_reward_unlocked(
    p_season_code,
    p_user_id,
    p_tier_code,
    p_final_rank,
    p_final_rating,
    p_final_season_points,
    p_battles
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_grant_season_reward(
  TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_grant_season_reward(
  TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER
) TO service_role;

COMMENT ON FUNCTION public.rpc_kq_grant_season_reward(
  TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER
) IS 'Serializes one season/player/tier grant before invoking the dormant atomic reward transaction.';

COMMIT;
