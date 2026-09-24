BEGIN;

-- Provider retry limits and refresh scheduling are shared by every app instance.
-- This changes the public quote cache only; player execution keeps its strict
-- ten-minute quote lifetime and persisted-order checks.
ALTER TABLE public.kq_crypto_refresh_state
 ADD COLUMN next_attempt_at TIMESTAMPTZ,
 ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0 CHECK(failure_count>=0),
 ADD COLUMN last_failure_code TEXT CHECK(last_failure_code IN ('rate_limited','provider_unavailable','invalid_quotes','publish_failed'));

UPDATE public.kq_crypto_refresh_state
 SET next_attempt_at=GREATEST(succeeded_at+interval '5 minutes',attempted_at+interval '1 minute');

CREATE OR REPLACE FUNCTION public.rpc_kq_crypto_refresh_claim() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_state public.kq_crypto_refresh_state%ROWTYPE; lease UUID; held JSONB;
BEGIN
 SELECT * INTO current_state FROM public.kq_crypto_refresh_state WHERE id FOR UPDATE;
 IF current_state.lease_until>now() OR current_state.next_attempt_at>now() THEN RETURN NULL; END IF;
 lease:=gen_random_uuid();
 -- If the worker disappears without publishing or reporting failure, retry in
 -- one minute. A successful or failed completion replaces this fallback.
 UPDATE public.kq_crypto_refresh_state SET lease_id=lease,attempted_at=now(),
  lease_until=now()+interval '60 seconds',next_attempt_at=now()+interval '60 seconds' WHERE id;
 SELECT COALESCE(jsonb_agg(asset_id),'[]'::JSONB) INTO held FROM (
  SELECT q.asset_id FROM public.kq_crypto_quotes q WHERE EXISTS(SELECT 1 FROM public.kq_crypto_positions p WHERE p.asset_id=q.asset_id AND p.quantity>0)
  ORDER BY q.quoted_at,q.asset_id LIMIT 250
 ) candidates;
 RETURN jsonb_build_object('leaseId',lease,'heldAssetIds',held);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_crypto_refresh_publish(p_lease_id UUID,p_assets JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row JSONB; asset INTEGER; stamped TIMESTAMPTZ; price NUMERIC; lease public.kq_crypto_refresh_state%ROWTYPE;
 fresh_top_count INTEGER:=0; earliest_fresh TIMESTAMPTZ;
BEGIN
 SELECT * INTO lease FROM public.kq_crypto_refresh_state WHERE id FOR UPDATE;
 IF p_lease_id IS NULL OR lease.lease_id IS NULL OR lease.lease_id IS DISTINCT FROM p_lease_id OR lease.lease_until IS NULL OR lease.lease_until<clock_timestamp() THEN RETURN false; END IF;
 IF jsonb_typeof(p_assets) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'crypto_invalid_quotes'; END IF;
 IF jsonb_array_length(p_assets)>350 OR
  (SELECT COUNT(*) FROM jsonb_array_elements(p_assets) x WHERE (x->>'inTop100')::BOOLEAN)<>100 OR
  (SELECT COUNT(DISTINCT (x->>'rank')::INTEGER) FROM jsonb_array_elements(p_assets) x WHERE (x->>'inTop100')::BOOLEAN)<>100 OR
  (SELECT COUNT(DISTINCT (x->>'id')::INTEGER) FROM jsonb_array_elements(p_assets) x)<>jsonb_array_length(p_assets)
  THEN RAISE EXCEPTION 'crypto_invalid_quotes'; END IF;
 UPDATE public.kq_crypto_quotes SET in_top100=false WHERE in_top100;
 FOR row IN SELECT value FROM jsonb_array_elements(p_assets) LOOP
  asset:=(row->>'id')::INTEGER; stamped:=(row->>'quotedAt')::TIMESTAMPTZ; price:=(row->>'priceEur')::NUMERIC;
  IF asset IS NULL OR asset<=0 OR stamped IS NULL OR NOT isfinite(stamped) OR stamped>now()+interval '60 seconds'
   OR price IS NULL OR price<=0 OR price>=1e19
   OR jsonb_typeof(row->'name') IS DISTINCT FROM 'string' OR length(row->>'name') NOT BETWEEN 1 AND 120
   OR jsonb_typeof(row->'symbol') IS DISTINCT FROM 'string' OR length(row->>'symbol') NOT BETWEEN 1 AND 30
   OR jsonb_typeof(row->'inTop100') IS DISTINCT FROM 'boolean'
   OR ((row->>'inTop100')::BOOLEAN AND COALESCE((row->>'rank')::INTEGER,0) NOT BETWEEN 1 AND 100)
   THEN RAISE EXCEPTION 'crypto_invalid_quotes'; END IF;
  IF (row->>'inTop100')::BOOLEAN AND stamped>now()-interval '10 minutes' THEN fresh_top_count:=fresh_top_count+1; END IF;
  INSERT INTO public.kq_crypto_quotes(asset_id,name,symbol,cmc_rank,price_eur,change_24h,quoted_at,in_top100)
  VALUES(asset,row->>'name',row->>'symbol',(row->>'rank')::INTEGER,price,(row->>'change24h')::NUMERIC,stamped,(row->>'inTop100')::BOOLEAN)
  ON CONFLICT(asset_id) DO UPDATE SET name=EXCLUDED.name,symbol=EXCLUDED.symbol,cmc_rank=EXCLUDED.cmc_rank,
   price_eur=CASE WHEN EXCLUDED.quoted_at>=kq_crypto_quotes.quoted_at THEN EXCLUDED.price_eur ELSE kq_crypto_quotes.price_eur END,
   change_24h=CASE WHEN EXCLUDED.quoted_at>=kq_crypto_quotes.quoted_at THEN EXCLUDED.change_24h ELSE kq_crypto_quotes.change_24h END,
   quoted_at=GREATEST(EXCLUDED.quoted_at,kq_crypto_quotes.quoted_at),in_top100=EXCLUDED.in_top100,refreshed_at=now();
 END LOOP;
 -- An individually stale asset remains visible and non-tradable. A completely
 -- stale provider response cannot count as a successful refresh of the market.
 IF fresh_top_count=0 THEN RAISE EXCEPTION 'crypto_invalid_quotes'; END IF;
 SELECT MIN(quoted_at) INTO earliest_fresh FROM public.kq_crypto_quotes
  WHERE in_top100 AND quoted_at>now()-interval '10 minutes' AND quoted_at<=now()+interval '60 seconds';
 UPDATE public.kq_crypto_refresh_state SET succeeded_at=now(),lease_id=NULL,lease_until=NULL,
  failure_count=0,last_failure_code=NULL,
  next_attempt_at=GREATEST(now()+interval '60 seconds',LEAST(now()+interval '5 minutes',earliest_fresh+interval '9 minutes')) WHERE id;
 RETURN true;
END $$;

-- A successful top-100 read can accompany a throttled held-asset request. Keep
-- those good quotes while honoring the same provider's shared Retry-After.
-- The original two-argument signature remains available to deployed clients.
CREATE FUNCTION public.rpc_kq_crypto_refresh_publish(p_lease_id UUID,p_assets JSONB,p_retry_after_seconds INTEGER) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE published BOOLEAN;
BEGIN
 IF p_retry_after_seconds IS NULL OR p_retry_after_seconds NOT BETWEEN 0 AND 604800 THEN RAISE EXCEPTION 'crypto_invalid_refresh_failure'; END IF;
 published:=public.rpc_kq_crypto_refresh_publish(p_lease_id,p_assets);
 IF published THEN
  UPDATE public.kq_crypto_refresh_state SET next_attempt_at=GREATEST(next_attempt_at,now()+p_retry_after_seconds*interval '1 second') WHERE id;
 END IF;
 RETURN published;
END $$;

CREATE FUNCTION public.rpc_kq_crypto_refresh_fail(p_lease_id UUID,p_failure_code TEXT,p_retry_after_seconds INTEGER DEFAULT NULL) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_state public.kq_crypto_refresh_state%ROWTYPE; failures INTEGER; wait_seconds INTEGER;
BEGIN
 SELECT * INTO current_state FROM public.kq_crypto_refresh_state WHERE id FOR UPDATE;
 -- An expired worker may release its own lease, but never a replacement lease.
 IF p_lease_id IS NULL OR current_state.lease_id IS DISTINCT FROM p_lease_id THEN RETURN false; END IF;
 IF p_failure_code IS NULL OR p_failure_code NOT IN ('rate_limited','provider_unavailable','invalid_quotes','publish_failed')
  OR (p_retry_after_seconds IS NOT NULL AND p_retry_after_seconds NOT BETWEEN 0 AND 604800)
  THEN RAISE EXCEPTION 'crypto_invalid_refresh_failure'; END IF;
 failures:=LEAST(current_state.failure_count::BIGINT+1,2147483647)::INTEGER;
 wait_seconds:=GREATEST(CASE failures WHEN 1 THEN 60 WHEN 2 THEN 120 WHEN 3 THEN 240 ELSE 300 END,COALESCE(p_retry_after_seconds,0));
 UPDATE public.kq_crypto_refresh_state SET lease_id=NULL,lease_until=NULL,failure_count=failures,last_failure_code=p_failure_code,
  next_attempt_at=now()+wait_seconds*interval '1 second' WHERE id;
 RETURN true;
END $$;

-- Safe operational metadata: no player data, asset IDs, or lease identities.
CREATE FUNCTION public.rpc_kq_crypto_refresh_status() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('refreshing',COALESCE(s.lease_until>now(),false),
  'nextAttemptAt',GREATEST(s.next_attempt_at,s.lease_until),'attemptedAt',s.attempted_at,'succeededAt',s.succeeded_at,
  'failureCount',s.failure_count,'lastFailureCode',s.last_failure_code,
  'quoteCount',q.total,'freshQuoteCount',q.fresh,'oldestQuotedAt',q.oldest,'newestQuotedAt',q.newest)
 FROM public.kq_crypto_refresh_state s CROSS JOIN (
  SELECT COUNT(*) AS total,COUNT(*) FILTER(WHERE quoted_at>now()-interval '10 minutes' AND quoted_at<=now()+interval '60 seconds') AS fresh,
   MIN(quoted_at) AS oldest,MAX(quoted_at) AS newest FROM public.kq_crypto_quotes WHERE in_top100
 ) q WHERE s.id;
$$;

REVOKE ALL ON TABLE public.kq_crypto_quotes,public.kq_crypto_refresh_state FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_crypto_refresh_claim(),public.rpc_kq_crypto_refresh_publish(UUID,JSONB),public.rpc_kq_crypto_refresh_publish(UUID,JSONB,INTEGER),
 public.rpc_kq_crypto_refresh_fail(UUID,TEXT,INTEGER),public.rpc_kq_crypto_refresh_status() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_crypto_refresh_claim(),public.rpc_kq_crypto_refresh_publish(UUID,JSONB),public.rpc_kq_crypto_refresh_publish(UUID,JSONB,INTEGER),
 public.rpc_kq_crypto_refresh_fail(UUID,TEXT,INTEGER),public.rpc_kq_crypto_refresh_status() TO service_role;

COMMIT;
