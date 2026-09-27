BEGIN;

-- A prospective, recurring purchase reward. Capture activation once rather than
-- interpreting old paid orders as new purchases whenever a player signs in.
CREATE TABLE public.kq_order_cash_reward_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  game_euros_per_euro INTEGER NOT NULL DEFAULT 10 CHECK (game_euros_per_euro = 10),
  rule_version TEXT NOT NULL DEFAULT 'order-cash-v1' CHECK (rule_version = 'order-cash-v1')
);
ALTER TABLE public.kq_order_cash_reward_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_order_cash_reward_settings FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO public.kq_order_cash_reward_settings(singleton) VALUES(TRUE);

-- Identifiers are immutable receipt snapshots: deleting an order/account must
-- not permit a second reward for that order after an import or email reuse.
CREATE TABLE public.kq_order_cash_reward_grants (
  order_id TEXT PRIMARY KEY CHECK (length(btrim(order_id)) > 0),
  user_id UUID NOT NULL,
  products_amount_cents INTEGER NOT NULL CHECK (products_amount_cents >= 0),
  cash_cents INTEGER NOT NULL CHECK (cash_cents >= 0),
  rule_version TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cash_cents::BIGINT = products_amount_cents::BIGINT * 10)
);
CREATE INDEX kq_order_cash_reward_grants_user ON public.kq_order_cash_reward_grants(user_id, granted_at, order_id);
ALTER TABLE public.kq_order_cash_reward_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_order_cash_reward_grants FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.kq_order_cash_reward_owner(p_customer_id UUID, p_customer_email TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN count(*) = 1 THEN (array_agg(id))[1] ELSE NULL END
  FROM auth.users
  WHERE (p_customer_id IS NOT NULL AND id = p_customer_id)
    OR (p_customer_id IS NULL AND email_confirmed_at IS NOT NULL
      AND NULLIF(lower(btrim(p_customer_email)), '') IS NOT NULL
      AND lower(btrim(email)) = lower(btrim(p_customer_email)));
$$;
REVOKE ALL ON FUNCTION public.kq_order_cash_reward_owner(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.kq_grant_order_cash_reward(p_order_id TEXT, p_expected_user_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE purchase public.orders%ROWTYPE; settings public.kq_order_cash_reward_settings%ROWTYPE;
  owner_id UUID; products_amount NUMERIC; reward_amount BIGINT; wallet INTEGER;
BEGIN
  -- Order before wallet, including retries. The immutable order receipt is the
  -- idempotency key across payment webhooks, manual changes and account visits.
  SELECT * INTO purchase FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM public.kq_order_cash_reward_grants WHERE order_id = p_order_id) THEN RETURN; END IF;
  SELECT * INTO settings FROM public.kq_order_cash_reward_settings WHERE singleton;
  IF NOT FOUND OR purchase.payment_state::TEXT IS DISTINCT FROM 'paid'
    OR purchase.status::TEXT = 'cancelled' OR purchase.archived_at IS NOT NULL
    OR purchase.payment_review_required IS DISTINCT FROM FALSE
    OR purchase.paid_at IS NULL OR purchase.paid_at < settings.starts_at
    OR purchase.paid_at > now() THEN RETURN; END IF;

  owner_id := public.kq_order_cash_reward_owner(purchase.customer_id, purchase.customer_email);
  IF owner_id IS NULL OR (p_expected_user_id IS NOT NULL AND owner_id <> p_expected_user_id) THEN RETURN; END IF;
  PERFORM 1 FROM auth.users WHERE id = owner_id FOR SHARE;
  -- Recheck after the lock: a verified guest address may have changed while we
  -- waited. Never let an unverified or ambiguous address claim another order.
  IF NOT FOUND OR public.kq_order_cash_reward_owner(purchase.customer_id, purchase.customer_email)
    IS DISTINCT FROM owner_id THEN RETURN; END IF;

  -- total_amount already contains all discounts and delivery. Do not subtract
  -- discount_amount again; independently round the persisted currency amounts.
  IF purchase.total_amount IS NULL OR purchase.total_amount::TEXT IN ('NaN', 'Infinity', '-Infinity')
    OR purchase.delivery_fee::TEXT IN ('NaN', 'Infinity', '-Infinity')
    OR purchase.total_amount < 0 OR COALESCE(purchase.delivery_fee, 0) < 0 THEN
    RAISE EXCEPTION 'kq_order_cash_invalid_amount';
  END IF;
  products_amount := greatest(round(purchase.total_amount * 100) - round(COALESCE(purchase.delivery_fee, 0) * 100), 0);
  IF products_amount > 2147483647::NUMERIC / settings.game_euros_per_euro THEN
    RAISE EXCEPTION 'kq_order_cash_wallet_limit';
  END IF;
  reward_amount := products_amount::BIGINT * settings.game_euros_per_euro;
  IF reward_amount > 0 THEN
    INSERT INTO public.kq_equipment_wallets(user_id) VALUES(owner_id) ON CONFLICT(user_id) DO NOTHING;
    SELECT cash_cents INTO wallet FROM public.kq_equipment_wallets WHERE user_id = owner_id FOR UPDATE;
    IF wallet::BIGINT + reward_amount > 2147483647 THEN RAISE EXCEPTION 'kq_order_cash_wallet_limit'; END IF;
    PERFORM public.kq_treasury_initialize(owner_id);
  END IF;
  INSERT INTO public.kq_order_cash_reward_grants(order_id, user_id, products_amount_cents, cash_cents, rule_version)
    VALUES(p_order_id, owner_id, products_amount::INTEGER, reward_amount::INTEGER, settings.rule_version);
  IF reward_amount > 0 THEN
    UPDATE public.kq_equipment_wallets SET cash_cents = (cash_cents::BIGINT + reward_amount)::INTEGER,
      updated_at = now() WHERE user_id = owner_id;
    PERFORM public.kq_treasury_pair(owner_id, 'reward', 'order-cash:' || p_order_id, now(),
      'suspense', 'revenue_rewards', reward_amount, 'Bonus de commande : ' || p_order_id);
    -- The wallet observer also queues a deferred treasury refresh. Flush it
    -- inside this reward's exception boundary, so accounting failures cannot
    -- escape later at COMMIT and undo the already captured payment.
    PERFORM public.kq_treasury_refresh(owner_id);
    DELETE FROM public.kq_treasury_pending WHERE user_id = owner_id AND transaction_id = txid_current();
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.kq_grant_order_cash_reward(TEXT, UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.kq_order_cash_reward_after_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Deferred execution observes the FINAL payment review flag. The payment RPC
  -- sets paid before inventory validation and can then mark the order for review.
  -- An optional game reward must never roll back a captured real-world payment.
  BEGIN
    PERFORM public.kq_grant_order_cash_reward(NEW.id);
  EXCEPTION WHEN query_canceled OR assert_failure OR OTHERS THEN
    RAISE WARNING 'kq_order_cash_reward_retry_needed order %, SQLSTATE %', NEW.id, SQLSTATE;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.kq_order_cash_reward_after_payment() FROM PUBLIC, anon, authenticated, service_role;
CREATE CONSTRAINT TRIGGER kq_order_cash_reward_after_payment
  AFTER INSERT OR UPDATE ON public.orders DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kq_order_cash_reward_after_payment();

CREATE FUNCTION public.rpc_kq_get_order_cash_rewards(p_user_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('available', TRUE, 'gameEurosPerEuro', settings.game_euros_per_euro,
    'startsAt', settings.starts_at,
    'receipts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'orderId', receipt.order_id, 'productsAmountCents', receipt.products_amount_cents,
      'cashCents', receipt.cash_cents, 'grantedAt', receipt.granted_at, 'ruleVersion', receipt.rule_version)
      ORDER BY receipt.granted_at DESC, receipt.order_id)
      FROM public.kq_order_cash_reward_grants receipt WHERE receipt.user_id = p_user_id), '[]'::JSONB))
  FROM public.kq_order_cash_reward_settings settings WHERE settings.singleton;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_get_order_cash_rewards(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_get_order_cash_rewards(UUID) TO service_role;

CREATE FUNCTION public.rpc_kq_sync_order_cash_rewards(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE purchase_id TEXT; candidate_ids TEXT[];
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'kq_order_cash_invalid_user';
  END IF;
  -- Lock the ENTIRE candidate set in a stable order before touching any wallet.
  -- A loop that locks order A -> wallet -> order B could deadlock against the
  -- payment trigger, which holds order B and then needs that same wallet.
  SELECT array_agg(candidate.id ORDER BY candidate.id) INTO candidate_ids FROM (
    SELECT purchase.id FROM public.orders purchase
    CROSS JOIN public.kq_order_cash_reward_settings settings
    WHERE settings.singleton AND purchase.payment_state::TEXT = 'paid'
      AND purchase.status::TEXT <> 'cancelled' AND purchase.archived_at IS NULL
      AND purchase.payment_review_required = FALSE
      AND purchase.paid_at >= settings.starts_at AND purchase.paid_at <= now()
      AND public.kq_order_cash_reward_owner(purchase.customer_id, purchase.customer_email) = p_user_id
      AND NOT EXISTS(SELECT 1 FROM public.kq_order_cash_reward_grants receipt WHERE receipt.order_id = purchase.id)
    ORDER BY purchase.id FOR UPDATE OF purchase
  ) candidate;
  FOREACH purchase_id IN ARRAY COALESCE(candidate_ids, ARRAY[]::TEXT[]) LOOP
    BEGIN
      PERFORM public.kq_grant_order_cash_reward(purchase_id, p_user_id);
    EXCEPTION WHEN query_canceled OR assert_failure OR OTHERS THEN
      RAISE WARNING 'kq_order_cash_reward_retry_needed order %, SQLSTATE %', purchase_id, SQLSTATE;
    END;
  END LOOP;
  RETURN public.rpc_kq_get_order_cash_rewards(p_user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_sync_order_cash_rewards(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_sync_order_cash_rewards(UUID) TO service_role;

COMMIT;
