BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Joining still attempts a match immediately. A poll normally reads one row;
-- only a waiting entry with another candidate can claim a recovery attempt.
ALTER TABLE public.kq_random_battle_queue
  ADD COLUMN reconcile_after TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 minutes');

CREATE FUNCTION public.rpc_kq_poll_random_battle_queue(p_player_id UUID, p_flower_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.kq_random_battle_queue%ROWTYPE;
  v_retry BOOLEAN := false;
BEGIN
  IF p_player_id IS NULL OR p_flower_id IS NULL THEN
    RAISE EXCEPTION 'kq_random_queue_invalid';
  END IF;
  SELECT * INTO v_entry FROM public.kq_random_battle_queue
    WHERE owner_id = p_player_id AND flower_id = p_flower_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('matchStatus', 'idle'); END IF;

  IF v_entry.reconcile_after <= now() AND EXISTS (
    SELECT 1 FROM public.kq_random_battle_queue WHERE owner_id <> p_player_id
  ) THEN
    -- Conditional update arbitrates concurrent tabs/servers. Do not block on a
    -- matcher holding this entry: the next visible poll will observe its result.
    WITH candidate AS (
      SELECT flower_id FROM public.kq_random_battle_queue
      WHERE owner_id = p_player_id AND flower_id = p_flower_id AND reconcile_after <= now()
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.kq_random_battle_queue q SET reconcile_after = now() + interval '2 minutes'
    FROM candidate c WHERE q.flower_id = c.flower_id;
    v_retry := FOUND;
  END IF;
  RETURN jsonb_build_object('matchStatus', 'queued', 'flowerId', v_entry.flower_id,
    'queuedAt', v_entry.queued_at, 'replayed', true, 'retryMatch', v_retry);
END $$;

REVOKE ALL ON FUNCTION public.rpc_kq_poll_random_battle_queue(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_poll_random_battle_queue(UUID, UUID) TO service_role;
COMMIT;
