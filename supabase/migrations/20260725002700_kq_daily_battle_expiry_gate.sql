BEGIN;

CREATE TABLE IF NOT EXISTS public.kq_maintenance_runs (
  task_code TEXT NOT NULL,
  run_day DATE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  result JSONB NOT NULL DEFAULT '{}'::JSONB,
  PRIMARY KEY (task_code, run_day)
);

ALTER TABLE public.kq_maintenance_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_maintenance_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.kq_maintenance_runs TO service_role;

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
  v_previous JSONB;
  v_result JSONB;
  v_has_more BOOLEAN;
BEGIN
  IF p_expired_before IS NULL OR p_expired_before > now() THEN
    RAISE EXCEPTION 'Invalid battle expiry threshold';
  END IF;
  IF p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'Battle expiry batch must contain between 1 and 500 rows';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('kq-expire-battles-daily'));
  SELECT result INTO v_previous
  FROM public.kq_maintenance_runs
  WHERE task_code = 'expire-battles' AND run_day = current_date
  FOR UPDATE;

  IF FOUND AND COALESCE((v_previous->>'hasMore')::BOOLEAN, false) = false THEN
    RETURN v_previous || jsonb_build_object('skipped', true);
  END IF;

  INSERT INTO public.kq_maintenance_runs (task_code, run_day)
  VALUES ('expire-battles', current_date)
  ON CONFLICT (task_code, run_day) DO NOTHING;

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

    UPDATE public.kq_battles SET status = 'cancelled'
    WHERE id = v_battle.id AND status = 'locked';
    v_expired_ids := array_append(v_expired_ids, v_battle.id);
  END LOOP;

  SELECT EXISTS (
    SELECT 1 FROM public.kq_battles
    WHERE status = 'locked' AND locked_at < p_expired_before
  ) INTO v_has_more;
  v_result := jsonb_build_object(
    'expiredCount', cardinality(v_expired_ids),
    'battleIds', to_jsonb(v_expired_ids),
    'hasMore', v_has_more,
    'skipped', false
  );

  UPDATE public.kq_maintenance_runs
  SET completed_at = now(), result = v_result
  WHERE task_code = 'expire-battles' AND run_day = current_date;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_expire_battles(TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_expire_battles(TIMESTAMPTZ, INTEGER)
  TO service_role;

COMMIT;
