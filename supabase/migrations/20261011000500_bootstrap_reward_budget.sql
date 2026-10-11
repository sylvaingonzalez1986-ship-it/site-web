BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Paid-order triggers still grant immediately. This is only the bounded repair
-- path for deferred rewards and orders linked to a verified customer later.
CREATE TABLE public.kq_reward_sync_checks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cash_checked_at TIMESTAMPTZ,
  bundle_checked_at TIMESTAMPTZ
);
ALTER TABLE public.kq_reward_sync_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_reward_sync_checks FROM PUBLIC, anon, authenticated, service_role;

-- Each kind is a separate PostgREST request/transaction. Cash can retain wallet
-- locks and bundle can retain its customer advisory lock; combining both would
-- invert the lock order of concurrent payment triggers.
CREATE FUNCTION public.rpc_kq_sync_bootstrap_reward(p_user_id UUID, p_kind TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_check public.kq_reward_sync_checks%ROWTYPE;
  v_checked_at TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('cash', 'bundle') THEN
    RAISE EXCEPTION 'kq_reward_sync_invalid';
  END IF;
  SELECT * INTO v_check FROM public.kq_reward_sync_checks WHERE user_id = p_user_id;
  v_checked_at := CASE p_kind WHEN 'cash' THEN v_check.cash_checked_at ELSE v_check.bundle_checked_at END;
  IF v_checked_at > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('ok', true, 'reused', true);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('kq_reward_sync:' || p_user_id::TEXT));
  INSERT INTO public.kq_reward_sync_checks(user_id) VALUES (p_user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_check FROM public.kq_reward_sync_checks WHERE user_id = p_user_id;
  v_checked_at := CASE p_kind WHEN 'cash' THEN v_check.cash_checked_at ELSE v_check.bundle_checked_at END;
  IF v_checked_at > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('ok', true, 'reused', true);
  END IF;

  BEGIN
    IF p_kind = 'cash' THEN
      PERFORM public.rpc_kq_sync_order_cash_rewards(p_user_id);
      UPDATE public.kq_reward_sync_checks SET cash_checked_at = now() WHERE user_id = p_user_id;
    ELSE
      PERFORM public.rpc_kq_sync_contest_bundle_rewards(p_user_id);
      UPDATE public.kq_reward_sync_checks SET bundle_checked_at = now() WHERE user_id = p_user_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'reused', false);
  END;
  RETURN jsonb_build_object('ok', true, 'reused', false);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_sync_bootstrap_reward(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_sync_bootstrap_reward(UUID, TEXT) TO service_role;
COMMIT;
