BEGIN;

-- Finance Season 1 equipment and its upgrades at the existing reputation gates.
-- Only new offers change: existing principal, interest, seven-day schedules and
-- request receipts are retained verbatim. All amounts are virtual game cents.
ALTER TABLE public.kq_bank_loans
 DROP CONSTRAINT kq_bank_loans_principal_cents_check,
 ADD CONSTRAINT kq_bank_loans_principal_cents_check CHECK(principal_cents BETWEEN 10000 AND 25000000),
 DROP CONSTRAINT kq_bank_loans_interest_cents_check,
 ADD CONSTRAINT kq_bank_loans_interest_cents_check CHECK(interest_cents BETWEEN 100 AND 3500000);

CREATE OR REPLACE FUNCTION public.rpc_kq_bank(p_user_id UUID,p_command JSONB DEFAULT NULL) RETURNS JSONB
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
   OR COALESCE(p_command->>'amountCents','') !~ '^[0-9]{1,9}$' THEN RAISE EXCEPTION 'bank_invalid'; END IF;
  action:=p_command->>'action'; v_request_key:=(p_command->>'requestKey')::UUID; amount:=(p_command->>'amountCents')::INTEGER;
  IF amount<1 OR amount>28500000 THEN RAISE EXCEPTION 'bank_invalid'; END IF;
  SELECT * INTO previous FROM public.kq_bank_requests WHERE user_id=p_user_id AND kq_bank_requests.request_key=v_request_key;
  replayed:=FOUND;
  IF replayed AND previous.command<>p_command THEN RAISE EXCEPTION 'bank_request_mismatch'; END IF;
 END IF;
 auto_paid:=public.kq_bank_settle(p_user_id);
 PERFORM public.kq_business_settle(p_user_id);
 SELECT cash_cents,reputation INTO cash,rep FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
 market:=public.kq_bank_market();
 SELECT MIN(completed_at)+interval '24 hours' INTO eligible_at FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='completed';
 cap:=CASE WHEN rep>=3000 THEN 25000000 WHEN rep>=1500 THEN 10000000 WHEN rep>=600 THEN 2500000 WHEN rep>=200 THEN 500000 ELSE 0 END;
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

REVOKE ALL ON FUNCTION public.rpc_kq_bank(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_bank(UUID,JSONB) TO service_role;

COMMIT;
