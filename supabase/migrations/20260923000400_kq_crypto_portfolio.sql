BEGIN;

-- Shared CoinMarketCap EUR quotes and purely virtual game positions.
CREATE TABLE public.kq_crypto_quotes (
 asset_id INTEGER PRIMARY KEY CHECK(asset_id>0), name TEXT NOT NULL, symbol TEXT NOT NULL,
 cmc_rank INTEGER, price_eur NUMERIC(38,18) NOT NULL CHECK(price_eur>0),
 change_24h NUMERIC, quoted_at TIMESTAMPTZ NOT NULL, in_top100 BOOLEAN NOT NULL,
 refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.kq_crypto_refresh_state (
 id BOOLEAN PRIMARY KEY DEFAULT true CHECK(id), lease_id UUID, attempted_at TIMESTAMPTZ,
 succeeded_at TIMESTAMPTZ, lease_until TIMESTAMPTZ
);
INSERT INTO public.kq_crypto_refresh_state(id) VALUES(true);
CREATE TABLE public.kq_crypto_positions (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 asset_id INTEGER NOT NULL REFERENCES public.kq_crypto_quotes(asset_id),
 quantity NUMERIC(38,18) NOT NULL CHECK(quantity>=0), cost_basis_cents BIGINT NOT NULL CHECK(cost_basis_cents>=0),
 PRIMARY KEY(user_id,asset_id), CHECK(quantity>0 OR cost_basis_cents=0)
);
CREATE TABLE public.kq_crypto_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 asset_id INTEGER NOT NULL REFERENCES public.kq_crypto_quotes(asset_id), side TEXT NOT NULL CHECK(side IN ('buy','sell')),
 quantity NUMERIC(38,18) NOT NULL CHECK(quantity>0), price_eur NUMERIC(38,18) NOT NULL CHECK(price_eur>0),
 amount_cents BIGINT NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
 quoted_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kq_crypto_orders_owner ON public.kq_crypto_orders(user_id,created_at);
CREATE TABLE public.kq_crypto_trades (
 order_id UUID PRIMARY KEY REFERENCES public.kq_crypto_orders(id),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, asset_id INTEGER NOT NULL REFERENCES public.kq_crypto_quotes(asset_id),
 side TEXT NOT NULL CHECK(side IN ('buy','sell')), quantity NUMERIC(38,18) NOT NULL CHECK(quantity>0),
 price_eur NUMERIC(38,18) NOT NULL CHECK(price_eur>0), amount_cents BIGINT NOT NULL CHECK(amount_cents>0),
 cost_basis_cents BIGINT NOT NULL CHECK(cost_basis_cents>=0), realized_pnl_cents BIGINT NOT NULL,
 cash_after_cents BIGINT NOT NULL CHECK(cash_after_cents BETWEEN 0 AND 2147483647), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kq_crypto_trades_owner ON public.kq_crypto_trades(user_id,created_at DESC);
ALTER TABLE public.kq_crypto_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_crypto_refresh_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_crypto_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_crypto_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_crypto_trades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_crypto_quotes,public.kq_crypto_refresh_state,public.kq_crypto_positions,
 public.kq_crypto_orders,public.kq_crypto_trades FROM PUBLIC,anon,authenticated,service_role;

-- One lease across all server instances: at most two provider calls / five minutes.
CREATE FUNCTION public.rpc_kq_crypto_refresh_claim() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_state public.kq_crypto_refresh_state%ROWTYPE; lease UUID; held JSONB;
BEGIN
 SELECT * INTO current_state FROM public.kq_crypto_refresh_state WHERE id FOR UPDATE;
 IF current_state.attempted_at>now()-interval '5 minutes' OR current_state.lease_until>now() THEN RETURN NULL; END IF;
 lease:=gen_random_uuid();
 UPDATE public.kq_crypto_refresh_state SET lease_id=lease,attempted_at=now(),lease_until=now()+interval '30 seconds' WHERE id;
 -- Include every held asset in rotation, even assets that leave the top 100.
 SELECT COALESCE(jsonb_agg(asset_id),'[]'::JSONB) INTO held FROM (
  SELECT q.asset_id FROM public.kq_crypto_quotes q WHERE EXISTS(SELECT 1 FROM public.kq_crypto_positions p WHERE p.asset_id=q.asset_id AND p.quantity>0)
  ORDER BY q.quoted_at,q.asset_id LIMIT 250
 ) candidates;
 RETURN jsonb_build_object('leaseId',lease,'heldAssetIds',held);
END $$;
CREATE FUNCTION public.rpc_kq_crypto_refresh_publish(p_lease_id UUID,p_assets JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row JSONB; asset INTEGER; stamped TIMESTAMPTZ; price NUMERIC; lease public.kq_crypto_refresh_state%ROWTYPE;
BEGIN
 SELECT * INTO lease FROM public.kq_crypto_refresh_state WHERE id FOR UPDATE;
 IF p_lease_id IS NULL OR lease.lease_id IS NULL OR lease.lease_id IS DISTINCT FROM p_lease_id OR lease.lease_until IS NULL OR lease.lease_until<clock_timestamp() THEN RETURN false; END IF;
 IF jsonb_typeof(p_assets) IS DISTINCT FROM 'array' OR jsonb_array_length(p_assets)>350 OR
  (SELECT COUNT(*) FROM jsonb_array_elements(p_assets) x WHERE (x->>'inTop100')::BOOLEAN)<>100 OR
  (SELECT COUNT(DISTINCT (x->>'rank')::INTEGER) FROM jsonb_array_elements(p_assets) x WHERE (x->>'inTop100')::BOOLEAN)<>100 OR
  (SELECT COUNT(DISTINCT (x->>'id')::INTEGER) FROM jsonb_array_elements(p_assets) x)<>jsonb_array_length(p_assets)
  THEN RAISE EXCEPTION 'crypto_invalid_quotes'; END IF;
 UPDATE public.kq_crypto_quotes SET in_top100=false WHERE in_top100;
 FOR row IN SELECT value FROM jsonb_array_elements(p_assets) LOOP
  asset:=(row->>'id')::INTEGER; stamped:=(row->>'quotedAt')::TIMESTAMPTZ; price:=(row->>'priceEur')::NUMERIC;
  IF asset IS NULL OR asset<=0 OR stamped IS NULL OR stamped<now()-interval '10 minutes' OR stamped>now()+interval '60 seconds'
   OR price IS NULL OR price<=0 OR price>=1e19 OR length(row->>'name') NOT BETWEEN 1 AND 120 OR length(row->>'symbol') NOT BETWEEN 1 AND 30
   OR ((row->>'inTop100')::BOOLEAN AND COALESCE((row->>'rank')::INTEGER,0) NOT BETWEEN 1 AND 100)
   THEN RAISE EXCEPTION 'crypto_invalid_quotes'; END IF;
  INSERT INTO public.kq_crypto_quotes(asset_id,name,symbol,cmc_rank,price_eur,change_24h,quoted_at,in_top100)
  VALUES(asset,row->>'name',row->>'symbol',(row->>'rank')::INTEGER,price,(row->>'change24h')::NUMERIC,stamped,(row->>'inTop100')::BOOLEAN)
  ON CONFLICT(asset_id) DO UPDATE SET name=EXCLUDED.name,symbol=EXCLUDED.symbol,cmc_rank=EXCLUDED.cmc_rank,price_eur=EXCLUDED.price_eur,
   change_24h=EXCLUDED.change_24h,quoted_at=EXCLUDED.quoted_at,in_top100=EXCLUDED.in_top100,refreshed_at=now();
 END LOOP;
 UPDATE public.kq_crypto_refresh_state SET succeeded_at=now(),lease_until=NULL WHERE id;
 RETURN true;
END $$;

CREATE FUNCTION public.kq_crypto_trade_json(p_trade public.kq_crypto_trades) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('orderId',p_trade.order_id,'assetId',p_trade.asset_id,'side',p_trade.side,'quantity',p_trade.quantity::TEXT,
  'priceEur',p_trade.price_eur::TEXT,'amountCents',p_trade.amount_cents,'costBasisCents',p_trade.cost_basis_cents,
  'realizedPnlCents',p_trade.realized_pnl_cents,'cashAfterCents',p_trade.cash_after_cents,'createdAt',p_trade.created_at);
$$;

-- Extend the existing allowed chart without dropping accounts from preceding migrations.
DO $$ DECLARE definition TEXT; patched TEXT; BEGIN
 SELECT pg_get_functiondef('public.kq_treasury_post(uuid,text,text,timestamptz,jsonb,text)'::regprocedure) INTO definition;
 patched:=replace(definition,'''expense_loan_interest'']','''expense_loan_interest'',''crypto_assets'',''revenue_crypto_gains'',''expense_crypto_losses'']');
 IF patched=definition THEN RAISE EXCEPTION 'crypto_treasury_chart_drift'; END IF;
 EXECUTE patched;
END $$;

CREATE FUNCTION public.rpc_kq_crypto_command(p_user_id UUID,p_action TEXT DEFAULT 'state',p_payload JSONB DEFAULT '{}'::JSONB,p_market_enabled BOOLEAN DEFAULT false) RETURNS JSONB
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
   WHEN refreshed<=now()-interval '10 minutes' OR EXISTS(SELECT 1 FROM public.kq_crypto_quotes WHERE in_top100 AND quoted_at<=now()-interval '10 minutes') THEN 'stale' ELSE 'live' END;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',asset_id,'rank',cmc_rank,'name',name,'symbol',symbol,'priceEur',price_eur::TEXT,
   'change24h',change_24h,'quotedAt',quoted_at,'inTop100',in_top100) ORDER BY in_top100 DESC,cmc_rank NULLS LAST,asset_id),'[]') INTO assets
   FROM public.kq_crypto_quotes q WHERE in_top100 OR EXISTS(SELECT 1 FROM public.kq_crypto_positions p WHERE p.user_id=p_user_id AND p.asset_id=q.asset_id AND p.quantity>0);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('assetId',p.asset_id,'quantity',p.quantity::TEXT,'costBasisCents',p.cost_basis_cents,
   'valueCents',CASE WHEN q.quoted_at>now()-interval '10 minutes' AND floor(p.quantity*q.price_eur*100)<=9007199254740991
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
  IF NOT FOUND OR quote_row.quoted_at<=now()-interval '10 minutes' OR quote_row.quoted_at>now()+interval '60 seconds' THEN RAISE EXCEPTION 'crypto_stale'; END IF;
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
   VALUES(p_user_id,asset,side,qty,quote_row.price_eur,amount,quote_row.quoted_at,LEAST(now()+interval '60 seconds',quote_row.quoted_at+interval '10 minutes')) RETURNING * INTO offer;
  RETURN jsonb_build_object('orderId',offer.id,'assetId',asset,'side',side,'quantity',qty::TEXT,'priceEur',quote_row.price_eur::TEXT,'amountCents',amount,'quotedAt',quote_row.quoted_at,'expiresAt',offer.expires_at);
 END IF;
 SELECT * INTO offer FROM public.kq_crypto_orders WHERE id=(p_payload->>'orderId')::UUID AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'crypto_order_missing'; END IF;
 IF offer.expires_at<=clock_timestamp() OR offer.quoted_at<=clock_timestamp()-interval '10 minutes' THEN RAISE EXCEPTION 'crypto_expired'; END IF;
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
REVOKE ALL ON FUNCTION public.kq_crypto_trade_json(public.kq_crypto_trades) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_crypto_refresh_claim(),public.rpc_kq_crypto_refresh_publish(UUID,JSONB),
 public.rpc_kq_crypto_command(UUID,TEXT,JSONB,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_crypto_refresh_claim(),public.rpc_kq_crypto_refresh_publish(UUID,JSONB),
 public.rpc_kq_crypto_command(UUID,TEXT,JSONB,BOOLEAN) TO service_role;
COMMIT;
