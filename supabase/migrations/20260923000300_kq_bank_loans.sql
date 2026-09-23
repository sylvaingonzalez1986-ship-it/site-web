BEGIN;

-- Loans and market conditions concern virtual game euros only. The rate is the
-- TOTAL fixed contractual cost of seven REAL 24-hour days, never an annual APR.
CREATE TABLE public.kq_bank_markets (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), period DATE NOT NULL UNIQUE,
 scenario TEXT NOT NULL CHECK(scenario IN ('confidence','competition','steady','inflation','tension')),
 rate_bps INTEGER NOT NULL CHECK(rate_bps BETWEEN 150 AND 1400),
 change_bps INTEGER NOT NULL CHECK(change_bps BETWEEN -1250 AND 1250),
 starts_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL CHECK(expires_at>starts_at)
);
CREATE TABLE public.kq_bank_loans (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 market_id UUID NOT NULL REFERENCES public.kq_bank_markets(id),
 principal_cents INTEGER NOT NULL CHECK(principal_cents BETWEEN 10000 AND 1000000),
 rate_bps INTEGER NOT NULL CHECK(rate_bps BETWEEN 100 AND 1400),
 interest_cents INTEGER NOT NULL CHECK(interest_cents BETWEEN 100 AND 140000),
 total_cents INTEGER NOT NULL CHECK(total_cents=principal_cents+interest_cents),
 paid_cents INTEGER NOT NULL DEFAULT 0 CHECK(paid_cents BETWEEN 0 AND total_cents),
 accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(), paid_at TIMESTAMPTZ,
 CHECK((paid_cents=total_cents)=(paid_at IS NOT NULL)),
 CHECK(interest_cents=ceil(principal_cents::NUMERIC*rate_bps/10000)::INTEGER)
);
CREATE UNIQUE INDEX kq_bank_one_active ON public.kq_bank_loans(user_id) WHERE paid_at IS NULL;
CREATE INDEX kq_bank_history ON public.kq_bank_loans(user_id,accepted_at DESC);
CREATE TABLE public.kq_bank_requests (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, request_key UUID NOT NULL,
 command JSONB NOT NULL CHECK(jsonb_typeof(command)='object'), loan_id UUID NOT NULL REFERENCES public.kq_bank_loans(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,request_key)
);
ALTER TABLE public.kq_bank_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_bank_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_bank_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_bank_markets,public.kq_bank_loans,public.kq_bank_requests FROM PUBLIC,anon,authenticated,service_role;
-- These private tables are written AND read only through the bounded RPC.

DO $$ DECLARE definition TEXT; fragment TEXT:='''expense_other''];'; BEGIN
 SELECT pg_get_functiondef('public.kq_treasury_post(uuid,text,text,timestamptz,jsonb,text)'::regprocedure) INTO definition;
 IF position(fragment in definition)=0 THEN RAISE EXCEPTION 'bank_accounting_schema_drift'; END IF;
 EXECUTE replace(definition,fragment,'''expense_other'',''loan_payable'',''expense_loan_interest''];');
END $$;

CREATE FUNCTION public.kq_bank_market() RETURNS public.kq_bank_markets
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE market public.kq_bank_markets%ROWTYPE; today DATE:=(now() AT TIME ZONE 'UTC')::DATE;
 previous_rate INTEGER; next_rate INTEGER; draw INTEGER; movement INTEGER; scenario_code TEXT;
BEGIN
 SELECT * INTO market FROM public.kq_bank_markets WHERE period=today;
 IF FOUND THEN RETURN market; END IF;
 -- One shared draw per UTC day. Refreshing or concurrent visitors cannot reroll.
 PERFORM pg_advisory_xact_lock(723091,230003);
 SELECT * INTO market FROM public.kq_bank_markets WHERE period=today;
 IF FOUND THEN RETURN market; END IF;
 SELECT rate_bps INTO previous_rate FROM public.kq_bank_markets WHERE period<today ORDER BY period DESC LIMIT 1;
 previous_rate:=COALESCE(previous_rate,650); draw:=floor(random()*5)::INTEGER;
 scenario_code:=(ARRAY['confidence','competition','steady','inflation','tension'])[draw+1];
 movement:=(ARRAY[-150,-75,0,100,200])[draw+1];
 next_rate:=GREATEST(150,LEAST(1400,previous_rate+movement));
 INSERT INTO public.kq_bank_markets(period,scenario,rate_bps,change_bps,starts_at,expires_at)
 VALUES(today,scenario_code,next_rate,next_rate-previous_rate,today::TIMESTAMP AT TIME ZONE 'UTC',(today+1)::TIMESTAMP AT TIME ZONE 'UTC') RETURNING * INTO market;
 RETURN market;
END $$;

-- O(1) catch-up, including a long absence. Existing wallet-first lock order is
-- preserved. No overdraft, extra penalty, or repricing of a signed contract.
CREATE FUNCTION public.kq_bank_settle(p_user UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE loan public.kq_bank_loans%ROWTYPE; cash BIGINT; elapsed INTEGER; due INTEGER; collected INTEGER;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.kq_bank_loans WHERE user_id=p_user AND paid_at IS NULL) THEN RETURN 0; END IF;
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO loan FROM public.kq_bank_loans WHERE user_id=p_user AND paid_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN 0; END IF;
 elapsed:=LEAST(7,GREATEST(0,floor(EXTRACT(EPOCH FROM (now()-loan.accepted_at))/86400)))::INTEGER;
 due:=GREATEST(0,(loan.total_cents::BIGINT*elapsed/7)::INTEGER-loan.paid_cents);
 collected:=LEAST(due,cash)::INTEGER;
 IF collected>0 THEN
  PERFORM public.kq_treasury_initialize(p_user);
  UPDATE public.kq_bank_loans SET paid_cents=paid_cents+collected,
   paid_at=CASE WHEN paid_cents+collected=total_cents THEN now() ELSE NULL END WHERE id=loan.id;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-collected,updated_at=now() WHERE user_id=p_user;
  UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user;
  PERFORM public.kq_treasury_pair(p_user,'loan-repayment','loan-auto:'||loan.id||':'||(loan.paid_cents+collected),now(),
   'loan_payable','suspense',collected,'Échéance du prêt bancaire');
 END IF;
 RETURN collected;
END $$;

CREATE FUNCTION public.kq_bank_loan_json(loan public.kq_bank_loans) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('id',loan.id,'principalCents',loan.principal_cents,'rateBps',loan.rate_bps,
 'interestCents',loan.interest_cents,'totalCents',loan.total_cents,'paidCents',loan.paid_cents,
 'remainingCents',loan.total_cents-loan.paid_cents,'acceptedAt',loan.accepted_at,'dueAt',loan.accepted_at+interval '168 hours','paidAt',loan.paid_at,
 'overdueCents',GREATEST(0,(loan.total_cents::BIGINT*LEAST(7,GREATEST(0,floor(EXTRACT(EPOCH FROM (now()-loan.accepted_at))/86400)))::INTEGER/7)::INTEGER-loan.paid_cents),
 'schedule',(SELECT jsonb_agg(jsonb_build_object('at',loan.accepted_at+day*interval '24 hours',
   'amountCents',(loan.total_cents::BIGINT*day/7)-(loan.total_cents::BIGINT*(day-1)/7),
   'paidCents',GREATEST(0,LEAST(loan.total_cents::BIGINT*day/7,loan.paid_cents)-loan.total_cents::BIGINT*(day-1)/7)) ORDER BY day) FROM generate_series(1,7) day));
$$;

CREATE FUNCTION public.rpc_kq_bank(p_user_id UUID,p_command JSONB DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cash BIGINT; rep INTEGER; market public.kq_bank_markets%ROWTYPE; loan public.kq_bank_loans%ROWTYPE;
 previous public.kq_bank_requests%ROWTYPE; amount INTEGER; expected_rate INTEGER; quote UUID; loan_ref UUID; v_request_key UUID;
 action TEXT; blocked TEXT; eligible_at TIMESTAMPTZ; cap INTEGER; discount INTEGER; rate INTEGER; interest INTEGER;
 loan_json JSONB; offer JSONB; history JSONB; auto_paid INTEGER; replayed BOOLEAN:=false;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'bank_invalid'; END IF;
 -- Never accept client ownership, rate calculations or wallet balances.
 SELECT cash_cents,reputation INTO cash,rep FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'bank_profile'; END IF;
 IF p_command IS NOT NULL THEN
  IF jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR p_command->>'action' IS NULL
   OR p_command->>'action' NOT IN ('borrow','repay')
   OR COALESCE(p_command->>'requestKey','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   OR jsonb_typeof(p_command->'amountCents') IS DISTINCT FROM 'number'
   OR COALESCE(p_command->>'amountCents','') !~ '^[0-9]{1,7}$' THEN RAISE EXCEPTION 'bank_invalid'; END IF;
  action:=p_command->>'action'; v_request_key:=(p_command->>'requestKey')::UUID; amount:=(p_command->>'amountCents')::INTEGER;
  IF amount<1 OR amount>1140000 THEN RAISE EXCEPTION 'bank_invalid'; END IF;
  SELECT * INTO previous FROM public.kq_bank_requests WHERE user_id=p_user_id AND kq_bank_requests.request_key=v_request_key;
  replayed:=FOUND;
  IF replayed AND previous.command<>p_command THEN RAISE EXCEPTION 'bank_request_mismatch'; END IF;
 END IF;
 auto_paid:=public.kq_bank_settle(p_user_id);
 PERFORM public.kq_business_settle(p_user_id);
 SELECT cash_cents,reputation INTO cash,rep FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
 market:=public.kq_bank_market();
 SELECT MIN(completed_at)+interval '24 hours' INTO eligible_at FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='completed';
 cap:=CASE WHEN rep>=3000 THEN 1000000 WHEN rep>=1500 THEN 500000 WHEN rep>=600 THEN 200000 WHEN rep>=200 THEN 50000 ELSE 0 END;
 discount:=CASE WHEN rep>=3000 THEN 150 WHEN rep>=1500 THEN 100 WHEN rep>=600 THEN 50 ELSE 0 END;
 rate:=GREATEST(100,market.rate_bps-discount);
 IF p_command IS NOT NULL AND NOT replayed THEN
  PERFORM public.kq_treasury_initialize(p_user_id);
  IF action='borrow' THEN
   IF rep<200 THEN RAISE EXCEPTION 'bank_reputation'; END IF;
   IF eligible_at IS NULL OR eligible_at>now() THEN RAISE EXCEPTION 'bank_experience'; END IF;
   IF EXISTS(SELECT 1 FROM public.kq_bank_loans WHERE user_id=p_user_id AND paid_at IS NULL) THEN RAISE EXCEPTION 'bank_active'; END IF;
   IF COALESCE(p_command->>'quoteId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR jsonb_typeof(p_command->'expectedRateBps') IS DISTINCT FROM 'number'
    OR COALESCE(p_command->>'expectedRateBps','') !~ '^[0-9]{1,4}$' THEN RAISE EXCEPTION 'bank_invalid'; END IF;
   quote:=(p_command->>'quoteId')::UUID; expected_rate:=(p_command->>'expectedRateBps')::INTEGER;
   IF quote<>market.id OR expected_rate<>rate OR market.expires_at<=now() THEN RAISE EXCEPTION 'bank_quote_changed'; END IF;
   IF amount<10000 OR amount>cap THEN RAISE EXCEPTION 'bank_invalid'; END IF;
   IF cash+amount>2147483647 THEN RAISE EXCEPTION 'bank_wallet_limit'; END IF;
   interest:=ceil(amount::NUMERIC*rate/10000)::INTEGER;
   INSERT INTO public.kq_bank_loans(user_id,market_id,principal_cents,rate_bps,interest_cents,total_cents)
    VALUES(p_user_id,market.id,amount,rate,interest,amount+interest) RETURNING * INTO loan;
   loan_ref:=loan.id;
   UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+amount,updated_at=now() WHERE user_id=p_user_id;
   PERFORM public.kq_treasury_pair(p_user_id,'loan-issued','loan-issued:'||loan.id,now(),'suspense','loan_payable',amount,'Capital du prêt bancaire');
   PERFORM public.kq_treasury_pair(p_user_id,'loan-interest','loan-interest:'||loan.id,now(),'expense_loan_interest','loan_payable',interest,'Coût fixe du prêt sur 7 jours');
  ELSE
   IF COALESCE(p_command->>'loanId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bank_invalid'; END IF;
   loan_ref:=(p_command->>'loanId')::UUID;
   SELECT * INTO loan FROM public.kq_bank_loans WHERE id=loan_ref AND user_id=p_user_id AND paid_at IS NULL FOR UPDATE;
   IF NOT FOUND OR amount<>loan.total_cents-loan.paid_cents THEN RAISE EXCEPTION 'bank_repayment_changed'; END IF;
   IF amount>cash THEN RAISE EXCEPTION 'bank_cash'; END IF;
   UPDATE public.kq_bank_loans SET paid_cents=total_cents,paid_at=now() WHERE id=loan.id;
   UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-amount,updated_at=now() WHERE user_id=p_user_id;
   PERFORM public.kq_treasury_pair(p_user_id,'loan-repayment','loan-repay:'||v_request_key,now(),'loan_payable','suspense',amount,'Solde anticipé du prêt bancaire');
  END IF;
  UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
  INSERT INTO public.kq_bank_requests(user_id,request_key,command,loan_id) VALUES(p_user_id,v_request_key,p_command,loan_ref);
 END IF;
 SELECT * INTO loan FROM public.kq_bank_loans WHERE user_id=p_user_id AND paid_at IS NULL;
 loan_json:=CASE WHEN FOUND THEN public.kq_bank_loan_json(loan) ELSE NULL END;
 blocked:=CASE WHEN loan_json IS NOT NULL AND (loan_json->>'overdueCents')::INTEGER>0 THEN 'arrears' WHEN loan_json IS NOT NULL THEN 'active'
   WHEN rep<200 THEN 'reputation' WHEN eligible_at IS NULL OR eligible_at>now() THEN 'experience' ELSE NULL END;
 offer:=CASE WHEN blocked IS NULL THEN jsonb_build_object('quoteId',market.id,'minCents',10000,'maxCents',cap,'rateBps',rate,'termDays',7,'expiresAt',market.expires_at) ELSE NULL END;
 SELECT COALESCE(jsonb_agg(public.kq_bank_loan_json(h) ORDER BY h.accepted_at DESC),'[]'::JSONB) INTO history FROM
  (SELECT * FROM public.kq_bank_loans WHERE user_id=p_user_id AND paid_at IS NOT NULL ORDER BY accepted_at DESC LIMIT 3) h;
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
 RETURN jsonb_build_object('version',1,'serverNow',now(),'cashCents',cash,'reputation',rep,'eligibleAt',eligible_at,
  'market',jsonb_build_object('id',market.id,'scenario',market.scenario,'rateBps',market.rate_bps,'changeBps',market.change_bps,'startsAt',market.starts_at,'expiresAt',market.expires_at),
  'offer',offer,'blockedReason',blocked,'loan',loan_json,'history',history,'autoPaidCents',auto_paid,'replayed',replayed);
END $$;

-- Catch up during normal game actions as well as bank visits: commerce, saving,
-- equipment, repairs and run updates already enter kq_business_settle first.
DO $$ DECLARE definition TEXT; fragment TEXT:=' PERFORM public.rpc_kq_ensure_equipment_profile(p_user);'; BEGIN
 SELECT pg_get_functiondef('public.kq_business_settle(uuid)'::regprocedure) INTO definition;
 IF position(fragment in definition)=0 THEN RAISE EXCEPTION 'bank_business_hook_drift'; END IF;
 EXECUTE replace(definition,fragment,fragment||E'\n PERFORM public.kq_bank_settle(p_user);');
END $$;
REVOKE ALL ON FUNCTION public.kq_bank_market(),public.kq_bank_settle(UUID),public.kq_bank_loan_json(public.kq_bank_loans),public.rpc_kq_bank(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_bank(UUID,JSONB) TO service_role;
COMMIT;
