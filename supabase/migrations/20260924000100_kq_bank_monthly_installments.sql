BEGIN;

-- One installment every 30 game days = 120 real hours. Keep seven installments,
-- the signed fixed cost, and every payment already collected. Existing open
-- loans use this cadence from accepted_at; closed loans retain their history.
ALTER TABLE public.kq_bank_loans
 ADD COLUMN installment_hours INTEGER NOT NULL DEFAULT 24
 CONSTRAINT kq_bank_loans_installment_hours_check CHECK(installment_hours IN (24,120));

UPDATE public.kq_bank_loans SET installment_hours=120 WHERE paid_at IS NULL;

ALTER TABLE public.kq_bank_loans ALTER COLUMN installment_hours SET DEFAULT 120;

COMMENT ON COLUMN public.kq_bank_loans.installment_hours IS
 'Real hours between seven installments: 120 for current loans, 24 for loans closed before the cadence migration.';

-- O(1) catch-up with the same wallet-first lock order and cumulative rounding.
CREATE OR REPLACE FUNCTION public.kq_bank_settle(p_user UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE loan public.kq_bank_loans%ROWTYPE; cash BIGINT; elapsed INTEGER; due INTEGER; collected INTEGER;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.kq_bank_loans WHERE user_id=p_user AND paid_at IS NULL) THEN RETURN 0; END IF;
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO loan FROM public.kq_bank_loans WHERE user_id=p_user AND paid_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN 0; END IF;
 elapsed:=LEAST(7,GREATEST(0,floor(EXTRACT(EPOCH FROM (now()-loan.accepted_at))/(loan.installment_hours*3600))))::INTEGER;
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

-- Hour intervals keep collection boundaries and displayed dates aligned across
-- daylight-saving changes, including the original cadence of closed loans.
CREATE OR REPLACE FUNCTION public.kq_bank_loan_json(loan public.kq_bank_loans) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('id',loan.id,'principalCents',loan.principal_cents,'rateBps',loan.rate_bps,
 'interestCents',loan.interest_cents,'totalCents',loan.total_cents,'paidCents',loan.paid_cents,
 'remainingCents',loan.total_cents-loan.paid_cents,'acceptedAt',loan.accepted_at,
 'dueAt',loan.accepted_at+7*loan.installment_hours*interval '1 hour','paidAt',loan.paid_at,
 'overdueCents',GREATEST(0,(loan.total_cents::BIGINT*LEAST(7,GREATEST(0,floor(EXTRACT(EPOCH FROM (now()-loan.accepted_at))/(loan.installment_hours*3600))))::INTEGER/7)::INTEGER-loan.paid_cents),
 'schedule',(SELECT jsonb_agg(jsonb_build_object('at',loan.accepted_at+installment*loan.installment_hours*interval '1 hour',
   'amountCents',(loan.total_cents::BIGINT*installment/7)-(loan.total_cents::BIGINT*(installment-1)/7),
   'paidCents',GREATEST(0,LEAST(loan.total_cents::BIGINT*installment/7,loan.paid_cents)-loan.total_cents::BIGINT*(installment-1)/7)) ORDER BY installment) FROM generate_series(1,7) installment));
$$;

-- Keep the latest investment limits, validation, locking and replay behavior.
-- termDays remains a real-day duration: seven 120-hour installments = 35 days.
DO $$
DECLARE definition TEXT;
 term_fragment TEXT:='''termDays'',7,''expiresAt''';
 cost_fragment TEXT:='Coût fixe du prêt sur 7 jours';
BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_bank(uuid,jsonb)'::regprocedure) INTO definition;
 IF position(term_fragment in definition)=0 OR position(cost_fragment in definition)=0 THEN
  RAISE EXCEPTION 'bank_monthly_contract_drift';
 END IF;
 definition:=replace(definition,term_fragment,'''termDays'',35,''expiresAt''');
 definition:=replace(definition,cost_fragment,'Coût fixe du prêt sur 210 jours de jeu');
 EXECUTE definition;
END $$;

REVOKE ALL ON public.kq_bank_loans FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_bank_settle(UUID),public.kq_bank_loan_json(public.kq_bank_loans),public.rpc_kq_bank(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_bank(UUID,JSONB) TO service_role;

COMMIT;
