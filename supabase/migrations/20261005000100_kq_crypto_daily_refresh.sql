BEGIN;

-- Daily game prices change at 19:00 Europe/Paris, including daylight saving time.
-- Calculate the next local calendar day rather than adding 24 hours to UTC.
CREATE FUNCTION public.kq_crypto_refresh_slot(p_at TIMESTAMPTZ) RETURNS TIMESTAMPTZ
LANGUAGE sql IMMUTABLE STRICT SET search_path=public AS $$
 SELECT ((p_at AT TIME ZONE 'Europe/Paris')::DATE
  - CASE WHEN (p_at AT TIME ZONE 'Europe/Paris')::TIME<TIME '19:00' THEN 1 ELSE 0 END
  + TIME '19:00') AT TIME ZONE 'Europe/Paris';
$$;

CREATE FUNCTION public.kq_crypto_next_refresh_at(p_at TIMESTAMPTZ) RETURNS TIMESTAMPTZ
LANGUAGE sql IMMUTABLE STRICT SET search_path=public AS $$
 SELECT ((public.kq_crypto_refresh_slot(p_at) AT TIME ZONE 'Europe/Paris')::DATE+1+TIME '19:00') AT TIME ZONE 'Europe/Paris';
$$;

-- Providers collect quotes shortly before publication. This allowance assigns a
-- quote from 18:55 to the 19:00 daily batch; it does not relax ingestion checks.
CREATE FUNCTION public.kq_crypto_quote_expires_at(p_quoted_at TIMESTAMPTZ) RETURNS TIMESTAMPTZ
LANGUAGE sql IMMUTABLE STRICT SET search_path=public AS $$
 SELECT public.kq_crypto_next_refresh_at(p_quoted_at+interval '10 minutes');
$$;

CREATE FUNCTION public.kq_crypto_quote_is_fresh(p_quoted_at TIMESTAMPTZ,p_at TIMESTAMPTZ) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE STRICT SET search_path=public AS $$
 SELECT isfinite(p_quoted_at) AND p_quoted_at<=p_at+interval '60 seconds'
  AND public.kq_crypto_quote_expires_at(p_quoted_at)>p_at;
$$;

-- Convert the previous five-minute success deadline to the daily schedule.
-- Keep an active provider failure/backoff intact. An old success becomes due
-- immediately if its following 19:00 slot has already passed.
UPDATE public.kq_crypto_refresh_state
 SET next_attempt_at=public.kq_crypto_next_refresh_at(succeeded_at)
 WHERE succeeded_at IS NOT NULL AND failure_count=0;

CREATE OR REPLACE FUNCTION public.rpc_kq_crypto_refresh_claim() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_state public.kq_crypto_refresh_state%ROWTYPE; lease UUID; held JSONB;
BEGIN
 SELECT * INTO current_state FROM public.kq_crypto_refresh_state WHERE id FOR UPDATE;
 IF current_state.lease_until>now() OR current_state.next_attempt_at>now()
  OR current_state.succeeded_at>=public.kq_crypto_refresh_slot(now()) THEN RETURN NULL; END IF;
 lease:=gen_random_uuid();
 -- Bootstrap and failed/missed daily batches can recover on the next request.
 -- A disappeared worker releases its exclusive lease after one minute.
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
 fresh_top_count INTEGER:=0;
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
  -- Preserve provider-ingestion freshness: daily gameplay validity must never
  -- allow an entirely old provider batch to count as a successful publication.
  IF (row->>'inTop100')::BOOLEAN AND stamped>now()-interval '10 minutes' THEN fresh_top_count:=fresh_top_count+1; END IF;
  INSERT INTO public.kq_crypto_quotes(asset_id,name,symbol,cmc_rank,price_eur,change_24h,quoted_at,in_top100)
  VALUES(asset,row->>'name',row->>'symbol',(row->>'rank')::INTEGER,price,(row->>'change24h')::NUMERIC,stamped,(row->>'inTop100')::BOOLEAN)
  ON CONFLICT(asset_id) DO UPDATE SET name=EXCLUDED.name,symbol=EXCLUDED.symbol,cmc_rank=EXCLUDED.cmc_rank,
   price_eur=CASE WHEN EXCLUDED.quoted_at>=kq_crypto_quotes.quoted_at THEN EXCLUDED.price_eur ELSE kq_crypto_quotes.price_eur END,
   change_24h=CASE WHEN EXCLUDED.quoted_at>=kq_crypto_quotes.quoted_at THEN EXCLUDED.change_24h ELSE kq_crypto_quotes.change_24h END,
   quoted_at=GREATEST(EXCLUDED.quoted_at,kq_crypto_quotes.quoted_at),in_top100=EXCLUDED.in_top100,refreshed_at=now();
 END LOOP;
 IF fresh_top_count=0 THEN RAISE EXCEPTION 'crypto_invalid_quotes'; END IF;
 UPDATE public.kq_crypto_refresh_state SET succeeded_at=now(),lease_id=NULL,lease_until=NULL,
  failure_count=0,last_failure_code=NULL,next_attempt_at=public.kq_crypto_next_refresh_at(now()) WHERE id;
 RETURN true;
END $$;

-- Keep the existing overload's Retry-After support and failure backoff RPC.
-- Both call/modify the same daily publication state above.
CREATE OR REPLACE FUNCTION public.rpc_kq_crypto_refresh_status() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('refreshing',COALESCE(s.lease_until>now(),false),
  'nextAttemptAt',GREATEST(s.next_attempt_at,s.lease_until),'attemptedAt',s.attempted_at,'succeededAt',s.succeeded_at,
  'failureCount',s.failure_count,'lastFailureCode',s.last_failure_code,
  'quoteCount',q.total,'freshQuoteCount',q.fresh,'oldestQuotedAt',q.oldest,'newestQuotedAt',q.newest)
 FROM public.kq_crypto_refresh_state s CROSS JOIN (
  SELECT COUNT(*) AS total,COUNT(*) FILTER(WHERE public.kq_crypto_quote_is_fresh(quoted_at,now())) AS fresh,
   MIN(quoted_at) AS oldest,MAX(quoted_at) AS newest FROM public.kq_crypto_quotes WHERE in_top100
 ) q WHERE s.id;
$$;


CREATE OR REPLACE FUNCTION public.rpc_kq_crypto_command(p_user_id UUID,p_action TEXT DEFAULT 'state',p_payload JSONB DEFAULT '{}'::JSONB,p_market_enabled BOOLEAN DEFAULT false) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE wallet BIGINT; side TEXT; asset INTEGER; amount BIGINT; qty NUMERIC; basis BIGINT; pnl BIGINT;
 quote_row public.kq_crypto_quotes%ROWTYPE; position public.kq_crypto_positions%ROWTYPE; offer public.kq_crypto_orders%ROWTYPE;
 trade public.kq_crypto_trades%ROWTYPE; assets JSONB; positions JSONB; trades JSONB; market_status TEXT; refreshed TIMESTAMPTZ;
BEGIN
 IF p_user_id IS NULL OR p_action IS NULL OR p_action NOT IN ('state','preview','confirm') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'crypto_invalid'; END IF;
 -- This settles elapsed business bills and (via the banking hook) due loan instalments.
 PERFORM public.kq_business_settle(p_user_id);
 SELECT cash_cents INTO wallet FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'crypto_no_wallet'; END IF;
 PERFORM public.kq_treasury_initialize(p_user_id);
 IF p_action='state' THEN
  SELECT succeeded_at INTO refreshed FROM public.kq_crypto_refresh_state WHERE id;
  market_status:=CASE WHEN NOT COALESCE(p_market_enabled,false) THEN 'unconfigured' WHEN refreshed IS NULL THEN 'unavailable'
   WHEN refreshed<public.kq_crypto_refresh_slot(now()) OR EXISTS(SELECT 1 FROM public.kq_crypto_quotes WHERE in_top100 AND NOT public.kq_crypto_quote_is_fresh(quoted_at,now())) THEN 'stale' ELSE 'live' END;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',asset_id,'rank',cmc_rank,'name',name,'symbol',symbol,'priceEur',price_eur::TEXT,
   'change24h',change_24h,'quotedAt',quoted_at,'inTop100',in_top100) ORDER BY in_top100 DESC,cmc_rank NULLS LAST,asset_id),'[]') INTO assets
   FROM public.kq_crypto_quotes q WHERE in_top100 OR EXISTS(SELECT 1 FROM public.kq_crypto_positions p WHERE p.user_id=p_user_id AND p.asset_id=q.asset_id AND p.quantity>0);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('assetId',p.asset_id,'quantity',p.quantity::TEXT,'costBasisCents',p.cost_basis_cents,
   'valueCents',CASE WHEN public.kq_crypto_quote_is_fresh(q.quoted_at,now()) AND floor(p.quantity*q.price_eur*100)<=9007199254740991
    THEN floor(p.quantity*q.price_eur*100)::BIGINT ELSE NULL END) ORDER BY p.asset_id),'[]') INTO positions
   FROM public.kq_crypto_positions p JOIN public.kq_crypto_quotes q USING(asset_id) WHERE p.user_id=p_user_id AND p.quantity>0;
  SELECT COALESCE(jsonb_agg(public.kq_crypto_trade_json(t) ORDER BY t.created_at DESC,t.order_id),'[]') INTO trades
   FROM (SELECT * FROM public.kq_crypto_trades WHERE user_id=p_user_id ORDER BY created_at DESC,order_id LIMIT 20) t;
  RETURN jsonb_build_object('version',1,'serverNow',now(),'marketStatus',market_status,'updatedAt',refreshed,'cashCents',wallet,'assets',assets,'positions',positions,'recentTrades',trades);
 END IF;
 IF p_action='confirm' THEN
  -- Read the owner's persisted receipt before expiry/configuration checks; retrying a
  -- committed order can never spend twice, even after a lost network response.
  SELECT * INTO trade FROM public.kq_crypto_trades WHERE user_id=p_user_id AND order_id=(p_payload->>'orderId')::UUID;
  IF FOUND THEN RETURN jsonb_build_object('trade',public.kq_crypto_trade_json(trade),'replayed',true); END IF;
 END IF;
 IF NOT COALESCE(p_market_enabled,false) THEN RAISE EXCEPTION 'crypto_closed'; END IF;
 IF p_action='preview' THEN
  side:=p_payload->>'side'; asset:=(p_payload->>'assetId')::INTEGER;
  IF side IS NULL OR side NOT IN ('buy','sell') OR asset IS NULL OR asset<=0 THEN RAISE EXCEPTION 'crypto_invalid'; END IF;
  SELECT * INTO quote_row FROM public.kq_crypto_quotes WHERE asset_id=asset;
  IF NOT FOUND OR NOT public.kq_crypto_quote_is_fresh(quote_row.quoted_at,now()) THEN RAISE EXCEPTION 'crypto_stale'; END IF;
  SELECT * INTO position FROM public.kq_crypto_positions WHERE user_id=p_user_id AND asset_id=asset;
  IF side='buy' THEN
   IF NOT quote_row.in_top100 THEN RAISE EXCEPTION 'crypto_not_top100'; END IF;
   IF (p_payload->>'amountCents') IS NULL OR (p_payload->>'amountCents') !~ '^[0-9]{1,9}$' THEN RAISE EXCEPTION 'crypto_invalid'; END IF;
   amount:=(p_payload->>'amountCents')::BIGINT;
   IF amount<100 OR amount>100000000 THEN RAISE EXCEPTION 'crypto_invalid'; END IF;
   IF wallet<amount THEN RAISE EXCEPTION 'crypto_cash'; END IF;
   qty:=trunc(amount::NUMERIC/(quote_row.price_eur*100),18);
   IF qty>=1e20 THEN RAISE EXCEPTION 'crypto_position_limit'; END IF;
  ELSE
   IF (p_payload->>'quantity') IS NULL OR (p_payload->>'quantity') !~ '^(0|[1-9][0-9]{0,19})(\.[0-9]{1,18})?$' THEN RAISE EXCEPTION 'crypto_invalid'; END IF;
   qty:=(p_payload->>'quantity')::NUMERIC;
   IF qty<=0 OR position.quantity IS NULL OR qty>position.quantity THEN RAISE EXCEPTION 'crypto_quantity'; END IF;
   IF floor(qty*quote_row.price_eur*100)>100000000 THEN RAISE EXCEPTION 'crypto_order_limit'; END IF;
   amount:=floor(qty*quote_row.price_eur*100)::BIGINT;
  END IF;
  IF qty<=0 OR amount<1 THEN RAISE EXCEPTION 'crypto_dust'; END IF;
  -- Bound abandoned preview storage; committed orders remain the idempotency key.
  DELETE FROM public.kq_crypto_orders o WHERE user_id=p_user_id AND expires_at<now()-interval '1 day'
   AND NOT EXISTS(SELECT 1 FROM public.kq_crypto_trades t WHERE t.order_id=o.id);
  INSERT INTO public.kq_crypto_orders(user_id,asset_id,side,quantity,price_eur,amount_cents,quoted_at,expires_at)
   VALUES(p_user_id,asset,side,qty,quote_row.price_eur,amount,quote_row.quoted_at,LEAST(now()+interval '60 seconds',public.kq_crypto_quote_expires_at(quote_row.quoted_at))) RETURNING * INTO offer;
  RETURN jsonb_build_object('orderId',offer.id,'assetId',asset,'side',side,'quantity',qty::TEXT,'priceEur',quote_row.price_eur::TEXT,'amountCents',amount,'quotedAt',quote_row.quoted_at,'expiresAt',offer.expires_at);
 END IF;
 SELECT * INTO offer FROM public.kq_crypto_orders WHERE id=(p_payload->>'orderId')::UUID AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'crypto_order_missing'; END IF;
 IF offer.expires_at<=clock_timestamp() OR NOT public.kq_crypto_quote_is_fresh(offer.quoted_at,clock_timestamp()) THEN RAISE EXCEPTION 'crypto_expired'; END IF;
 SELECT * INTO position FROM public.kq_crypto_positions WHERE user_id=p_user_id AND asset_id=offer.asset_id FOR UPDATE;
 IF offer.side='buy' THEN
  IF wallet<offer.amount_cents THEN RAISE EXCEPTION 'crypto_cash'; END IF;
  IF COALESCE(position.cost_basis_cents,0)+offer.amount_cents>2147483647 OR COALESCE(position.quantity,0)+offer.quantity>=1e20 THEN RAISE EXCEPTION 'crypto_position_limit'; END IF;
  wallet:=wallet-offer.amount_cents; basis:=offer.amount_cents; pnl:=0;
  INSERT INTO public.kq_crypto_positions(user_id,asset_id,quantity,cost_basis_cents) VALUES(p_user_id,offer.asset_id,offer.quantity,basis)
   ON CONFLICT(user_id,asset_id) DO UPDATE SET quantity=public.kq_crypto_positions.quantity+EXCLUDED.quantity,cost_basis_cents=public.kq_crypto_positions.cost_basis_cents+EXCLUDED.cost_basis_cents;
 ELSE
  IF position.quantity IS NULL OR position.quantity<offer.quantity THEN RAISE EXCEPTION 'crypto_quantity'; END IF;
  IF wallet+offer.amount_cents>2147483647 THEN RAISE EXCEPTION 'crypto_wallet_limit'; END IF;
  basis:=CASE WHEN position.quantity=offer.quantity THEN position.cost_basis_cents ELSE floor(position.cost_basis_cents*offer.quantity/position.quantity)::BIGINT END;
  pnl:=offer.amount_cents-basis; wallet:=wallet+offer.amount_cents;
  UPDATE public.kq_crypto_positions SET quantity=quantity-offer.quantity,cost_basis_cents=cost_basis_cents-basis WHERE user_id=p_user_id AND asset_id=offer.asset_id;
 END IF;
 UPDATE public.kq_equipment_wallets SET cash_cents=wallet,updated_at=now() WHERE user_id=p_user_id;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 INSERT INTO public.kq_crypto_trades(order_id,user_id,asset_id,side,quantity,price_eur,amount_cents,cost_basis_cents,realized_pnl_cents,cash_after_cents)
 VALUES(offer.id,p_user_id,offer.asset_id,offer.side,offer.quantity,offer.price_eur,offer.amount_cents,basis,pnl,wallet) RETURNING * INTO trade;
 IF offer.side='buy' THEN
  PERFORM public.kq_treasury_pair(p_user_id,'crypto-buy','crypto:'||offer.id,now(),'crypto_assets','suspense',basis,'Achat crypto virtuel');
 ELSE
  PERFORM public.kq_treasury_post(p_user_id,'crypto-sell','crypto:'||offer.id,now(),jsonb_build_array(
   jsonb_build_object('account','suspense','deltaCents',offer.amount_cents),jsonb_build_object('account','crypto_assets','deltaCents',-basis),
   jsonb_build_object('account',CASE WHEN pnl>=0 THEN 'revenue_crypto_gains' ELSE 'expense_crypto_losses' END,'deltaCents',-pnl)),'Vente crypto virtuelle');
 END IF;
 RETURN jsonb_build_object('trade',public.kq_crypto_trade_json(trade),'replayed',false);
END $$;

-- Helpers are implementation details; only server-owned RPCs are executable.
REVOKE ALL ON FUNCTION public.kq_crypto_refresh_slot(TIMESTAMPTZ),public.kq_crypto_next_refresh_at(TIMESTAMPTZ),
 public.kq_crypto_quote_expires_at(TIMESTAMPTZ),public.kq_crypto_quote_is_fresh(TIMESTAMPTZ,TIMESTAMPTZ)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON TABLE public.kq_crypto_quotes,public.kq_crypto_refresh_state,public.kq_crypto_positions,
 public.kq_crypto_orders,public.kq_crypto_trades FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_crypto_refresh_claim(),public.rpc_kq_crypto_refresh_publish(UUID,JSONB),
 public.rpc_kq_crypto_refresh_status(),public.rpc_kq_crypto_command(UUID,TEXT,JSONB,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_crypto_refresh_claim(),public.rpc_kq_crypto_refresh_publish(UUID,JSONB),
 public.rpc_kq_crypto_refresh_status(),public.rpc_kq_crypto_command(UUID,TEXT,JSONB,BOOLEAN) TO service_role;

COMMIT;
