BEGIN;
-- Each deposit has its own 24-hour clock: new money never earns retroactive interest.
CREATE TABLE public.arena_chanvrier_savings_deposits (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES public.arena_chanvrier_profiles(user_id) ON DELETE CASCADE,
 balance_cents BIGINT NOT NULL CHECK(balance_cents BETWEEN 0 AND 2000000000),
 credited_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.arena_chanvrier_savings_deposits(user_id,created_at);
CREATE TABLE public.arena_chanvrier_savings_requests (
 user_id UUID NOT NULL REFERENCES public.arena_chanvrier_profiles(user_id) ON DELETE CASCADE,
 request_key UUID NOT NULL, action TEXT NOT NULL CHECK(action IN ('deposit','withdraw')),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_key)
);
ALTER TABLE public.arena_chanvrier_savings_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_chanvrier_savings_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.arena_chanvrier_savings_deposits,public.arena_chanvrier_savings_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.arena_chanvrier_savings_deposits TO service_role;
GRANT SELECT,INSERT ON public.arena_chanvrier_savings_requests TO service_role;

CREATE FUNCTION public.rpc_arena_chanvrier_savings(p_user_id UUID,p_action TEXT DEFAULT 'state',p_amount_cents INTEGER DEFAULT 0,p_request_key UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cash BIGINT; total BIGINT; earned BIGINT:=0; increment BIGINT; remaining BIGINT; take BIGINT;
 deposit public.arena_chanvrier_savings_deposits%ROWTYPE; previous public.arena_chanvrier_savings_requests%ROWTYPE;
 periods INTEGER; balance BIGINT; replayed BOOLEAN:=false; next_at TIMESTAMPTZ;
 ceiling CONSTANT BIGINT:=2000000000;
BEGIN
 IF p_user_id IS NULL OR p_action IS NULL OR p_action NOT IN ('state','deposit','withdraw')
  OR (p_action<>'state' AND (p_request_key IS NULL OR p_amount_cents IS NULL OR p_amount_cents<=0)) THEN RAISE EXCEPTION 'savings_invalid'; END IF;
 -- Same first lock as purchases, profile changes, sales and machine repairs.
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength='treasurer') THEN RAISE EXCEPTION 'savings_treasurer_required'; END IF;
 SELECT COALESCE(SUM(balance_cents),0) INTO total FROM public.arena_chanvrier_savings_deposits WHERE user_id=p_user_id;
 FOR deposit IN SELECT * FROM public.arena_chanvrier_savings_deposits WHERE user_id=p_user_id AND balance_cents>0 ORDER BY created_at,id FOR UPDATE LOOP
  periods:=GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (now()-deposit.credited_at))/86400))::INTEGER;
  balance:=deposit.balance_cents;
  IF periods>0 THEN
   FOR day IN 1..periods LOOP
    increment:=LEAST(FLOOR(balance::NUMERIC*5/100)::BIGINT,ceiling-total);
    EXIT WHEN increment<=0;
    balance:=balance+increment; total:=total+increment; earned:=earned+increment;
   END LOOP;
   UPDATE public.arena_chanvrier_savings_deposits SET balance_cents=balance,credited_at=deposit.credited_at+periods*interval '24 hours' WHERE id=deposit.id;
  END IF;
 END LOOP;
 IF p_action<>'state' THEN
  SELECT * INTO previous FROM public.arena_chanvrier_savings_requests WHERE user_id=p_user_id AND request_key=p_request_key;
  replayed:=FOUND;
  IF replayed AND (previous.action<>p_action OR previous.amount_cents<>p_amount_cents) THEN RAISE EXCEPTION 'savings_request_mismatch'; END IF;
  IF NOT replayed THEN
   IF p_action='deposit' THEN
    IF p_amount_cents>cash THEN RAISE EXCEPTION 'savings_cash'; END IF;
    IF total+p_amount_cents>ceiling THEN RAISE EXCEPTION 'savings_limit'; END IF;
    INSERT INTO public.arena_chanvrier_savings_deposits(user_id,balance_cents) VALUES(p_user_id,p_amount_cents);
    cash:=cash-p_amount_cents; total:=total+p_amount_cents;
   ELSE
    IF p_amount_cents>total THEN RAISE EXCEPTION 'savings_balance'; END IF;
    IF cash+p_amount_cents>2147483647 THEN RAISE EXCEPTION 'savings_wallet_limit'; END IF;
    remaining:=p_amount_cents;
    -- Withdraw newest deposits first, preserving the older deposits' next interest payment.
    FOR deposit IN SELECT * FROM public.arena_chanvrier_savings_deposits WHERE user_id=p_user_id AND balance_cents>0 ORDER BY created_at DESC,id DESC FOR UPDATE LOOP
     take:=LEAST(remaining,deposit.balance_cents);
     UPDATE public.arena_chanvrier_savings_deposits SET balance_cents=balance_cents-take WHERE id=deposit.id;
     remaining:=remaining-take; EXIT WHEN remaining=0;
    END LOOP;
    DELETE FROM public.arena_chanvrier_savings_deposits WHERE user_id=p_user_id AND balance_cents=0;
    cash:=cash+p_amount_cents; total:=total-p_amount_cents;
   END IF;
   UPDATE public.kq_equipment_wallets SET cash_cents=cash,updated_at=now() WHERE user_id=p_user_id;
   UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
   INSERT INTO public.arena_chanvrier_savings_requests(user_id,request_key,action,amount_cents) VALUES(p_user_id,p_request_key,p_action,p_amount_cents);
  END IF;
 END IF;
 SELECT MIN(credited_at+interval '24 hours') INTO next_at FROM public.arena_chanvrier_savings_deposits WHERE user_id=p_user_id AND balance_cents>=20;
 RETURN jsonb_build_object('cashCents',cash,'balanceCents',total,'interestCreditedCents',earned,'nextInterestAt',CASE WHEN total<ceiling THEN next_at ELSE NULL END,'ratePercent',5,'periodHours',24,'maxBalanceCents',ceiling,'replayed',replayed);
END $$;
REVOKE ALL ON FUNCTION public.rpc_arena_chanvrier_savings(UUID,TEXT,INTEGER,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_arena_chanvrier_savings(UUID,TEXT,INTEGER,UUID) TO service_role;
COMMIT;
