BEGIN;

-- Every reputation point increases new borrowing capacity between the existing
-- anchors. Amounts are virtual game cents, rounded down to a whole game euro.
CREATE FUNCTION public.kq_bank_credit_limit(p_reputation INTEGER) RETURNS INTEGER
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=pg_catalog AS $$
 SELECT CASE
  WHEN p_reputation IS NULL OR p_reputation<200 THEN 0
  WHEN p_reputation<600 THEN 500000+floor((p_reputation-200)::NUMERIC*2000000/400/100)*100
  WHEN p_reputation<1500 THEN 2500000+floor((p_reputation-600)::NUMERIC*7500000/900/100)*100
  WHEN p_reputation<3000 THEN 10000000+floor((p_reputation-1500)::NUMERIC*15000000/1500/100)*100
  ELSE 25000000
 END::INTEGER;
$$;

REVOKE ALL ON FUNCTION public.kq_bank_credit_limit(INTEGER) FROM PUBLIC,anon,authenticated,service_role;

-- Patch only the capacity calculation in the current monthly-loan RPC. Signed
-- amounts, repayment dates, interest discounts, locks and receipts stay intact.
-- Stop on unexpected definitions rather than replacing unrelated RPC changes.
DO $$
DECLARE definition TEXT;
 cap_fragment TEXT:='cap:=CASE WHEN rep>=3000 THEN 25000000 WHEN rep>=1500 THEN 10000000 WHEN rep>=600 THEN 2500000 WHEN rep>=200 THEN 500000 ELSE 0 END;';
BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_bank(uuid,jsonb)'::regprocedure) INTO definition;
 IF length(definition)-length(replace(definition,cap_fragment,''))<>length(cap_fragment)
  OR position('''termDays'',35,''expiresAt''' in definition)=0 THEN
  RAISE EXCEPTION 'bank_progressive_credit_contract_drift';
 END IF;
 EXECUTE replace(definition,cap_fragment,'cap:=public.kq_bank_credit_limit(rep);');
END $$;

REVOKE ALL ON FUNCTION public.rpc_kq_bank(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_bank(UUID,JSONB) TO service_role;

COMMIT;
