BEGIN;

CREATE INDEX IF NOT EXISTS idx_kq_battles_locked_expiry
  ON public.kq_battles(locked_at, id)
  WHERE status = 'locked';

CREATE OR REPLACE FUNCTION public.rpc_kq_expire_battles(
  p_expired_before TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.kq_battles%ROWTYPE;
  v_unlocked_count INTEGER;
  v_expired_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF p_expired_before IS NULL OR p_expired_before > now() THEN
    RAISE EXCEPTION 'Invalid battle expiry threshold';
  END IF;
  IF p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'Battle expiry batch must contain between 1 and 500 rows';
  END IF;

  FOR v_battle IN
    SELECT *
    FROM public.kq_battles
    WHERE status = 'locked' AND locked_at < p_expired_before
    ORDER BY locked_at, id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.kq_flowers
    SET status = 'available', locked_at = NULL
    WHERE id IN (v_battle.flower_one_id, v_battle.flower_two_id)
      AND status = 'locked'
      AND burned_at IS NULL;
    GET DIAGNOSTICS v_unlocked_count = ROW_COUNT;
    IF v_unlocked_count <> 2 THEN
      RAISE EXCEPTION 'Expired battle flowers are inconsistent: %', v_battle.id;
    END IF;

    UPDATE public.kq_battles
    SET status = 'cancelled'
    WHERE id = v_battle.id AND status = 'locked';
    v_expired_ids := array_append(v_expired_ids, v_battle.id);
  END LOOP;

  RETURN jsonb_build_object(
    'expiredCount', cardinality(v_expired_ids),
    'battleIds', to_jsonb(v_expired_ids),
    'hasMore', (
      SELECT EXISTS (
        SELECT 1 FROM public.kq_battles
        WHERE status = 'locked' AND locked_at < p_expired_before
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_expire_battles(TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_expire_battles(TIMESTAMPTZ, INTEGER)
  TO service_role;

COMMIT;
