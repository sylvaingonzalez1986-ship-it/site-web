BEGIN;
-- JavaScript modulo can leave sub-millionth residue on the partner progress.
-- Compare at the same six-decimal precision as the stored commerce ledgers.
-- All other checks (price, ownership, stock, expiry, revisions) remain strict.
DO $$
DECLARE original TEXT; definition TEXT; field TEXT;
BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure) INTO original;
 definition:=original;
 FOREACH field IN ARRAY ARRAY['shopRecruitmentAfter','shopChurnAfter'] LOOP
  IF position(format('(offer->>%L)::NUMERIC IS DISTINCT FROM',field) in definition)=0 THEN
   RAISE EXCEPTION 'commerce_shop_precision_drift';
  END IF;
  definition:=replace(definition,format('(offer->>%L)::NUMERIC IS DISTINCT FROM',field),format('ROUND((offer->>%L)::NUMERIC,6) IS DISTINCT FROM',field));
 END LOOP;
 EXECUTE definition;
END $$;
COMMIT;
