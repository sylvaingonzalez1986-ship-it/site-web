BEGIN;

-- Keep successful provider reads shared for five minutes. A failed attempt must
-- not prevent recovery for that full cache lifetime: retry after one minute,
-- while the original thirty-second lease still prevents concurrent refreshes.
CREATE OR REPLACE FUNCTION public.rpc_kq_crypto_refresh_claim() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_state public.kq_crypto_refresh_state%ROWTYPE; lease UUID; held JSONB;
BEGIN
 SELECT * INTO current_state FROM public.kq_crypto_refresh_state WHERE id FOR UPDATE;
 IF current_state.lease_until>now()
  OR current_state.succeeded_at>now()-interval '5 minutes'
  OR current_state.attempted_at>now()-interval '1 minute' THEN RETURN NULL; END IF;
 lease:=gen_random_uuid();
 UPDATE public.kq_crypto_refresh_state SET lease_id=lease,attempted_at=now(),lease_until=now()+interval '30 seconds' WHERE id;
 -- Include every held asset in rotation, even assets that leave the top 100.
 SELECT COALESCE(jsonb_agg(asset_id),'[]'::JSONB) INTO held FROM (
  SELECT q.asset_id FROM public.kq_crypto_quotes q WHERE EXISTS(SELECT 1 FROM public.kq_crypto_positions p WHERE p.asset_id=q.asset_id AND p.quantity>0)
  ORDER BY q.quoted_at,q.asset_id LIMIT 250
 ) candidates;
 RETURN jsonb_build_object('leaseId',lease,'heldAssetIds',held);
END $$;

REVOKE ALL ON FUNCTION public.rpc_kq_crypto_refresh_claim() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_crypto_refresh_claim() TO service_role;

COMMIT;
