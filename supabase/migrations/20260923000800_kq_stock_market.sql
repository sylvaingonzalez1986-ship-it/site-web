-- Real equity/index quotes; holdings and settlement use only virtual game euros.
BEGIN;
CREATE TABLE public.kq_stock_instruments (
 id TEXT PRIMARY KEY CHECK(id ~ '^[A-Z0-9^][A-Z0-9.^=-]{0,31}$'),
 symbol TEXT NOT NULL CHECK(length(symbol) BETWEEN 1 AND 32), name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 180),
 kind TEXT NOT NULL CHECK(kind IN ('stock','index')), markets TEXT[] NOT NULL CHECK(cardinality(markets) BETWEEN 0 AND 2 AND markets <@ ARRAY['cac40','sp500']::TEXT[]),
 currency TEXT NOT NULL CHECK(currency IN ('EUR','USD'))
);
CREATE TABLE public.kq_stock_quotes (
 asset_id TEXT PRIMARY KEY REFERENCES public.kq_stock_instruments(id),
 price_native NUMERIC(38,18) CHECK(price_native>0), price_eur NUMERIC(38,18) CHECK(price_eur>0), change_percent NUMERIC,
 quoted_at TIMESTAMPTZ, refreshed_at TIMESTAMPTZ, market_state TEXT CHECK(market_state IN ('open','closed')),
 fx_rate NUMERIC(38,18) CHECK(fx_rate>0), fx_quoted_at TIMESTAMPTZ,
 lease_id UUID, lease_until TIMESTAMPTZ, attempted_at TIMESTAMPTZ
);
CREATE TABLE public.kq_stock_positions (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 asset_id TEXT NOT NULL REFERENCES public.kq_stock_instruments(id),
 quantity NUMERIC(38,18) NOT NULL CHECK(quantity>=0), cost_basis_cents BIGINT NOT NULL CHECK(cost_basis_cents BETWEEN 0 AND 2147483647),
 PRIMARY KEY(user_id,asset_id), CHECK(quantity>0 OR cost_basis_cents=0)
);
CREATE TABLE public.kq_stock_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 asset_id TEXT NOT NULL REFERENCES public.kq_stock_instruments(id), side TEXT NOT NULL CHECK(side IN ('buy','sell')),
 quantity NUMERIC(38,18) NOT NULL CHECK(quantity>0), price_eur NUMERIC(38,18) NOT NULL CHECK(price_eur>0),
 amount_cents BIGINT NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
 quoted_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kq_stock_orders_owner ON public.kq_stock_orders(user_id,created_at);
CREATE TABLE public.kq_stock_trades (
 order_id UUID PRIMARY KEY REFERENCES public.kq_stock_orders(id), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 asset_id TEXT NOT NULL REFERENCES public.kq_stock_instruments(id), side TEXT NOT NULL CHECK(side IN ('buy','sell')),
 quantity NUMERIC(38,18) NOT NULL CHECK(quantity>0), price_eur NUMERIC(38,18) NOT NULL CHECK(price_eur>0),
 amount_cents BIGINT NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000), cost_basis_cents BIGINT NOT NULL CHECK(cost_basis_cents>=0),
 realized_pnl_cents BIGINT NOT NULL, cash_after_cents BIGINT NOT NULL CHECK(cash_after_cents BETWEEN 0 AND 2147483647), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kq_stock_trades_owner ON public.kq_stock_trades(user_id,created_at DESC);
ALTER TABLE public.kq_stock_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_stock_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_stock_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_stock_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_stock_trades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_stock_instruments,public.kq_stock_quotes,public.kq_stock_positions,
 public.kq_stock_orders,public.kq_stock_trades FROM PUBLIC,anon,authenticated,service_role;

-- All API instances share per-instrument leases; sorted locks avoid crossed batches.
CREATE FUNCTION public.rpc_kq_stock_refresh_claim(p_asset_ids TEXT[]) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE wanted TEXT[]; current_row public.kq_stock_quotes%ROWTYPE; lease UUID:=gen_random_uuid(); claimed TEXT[]:='{}'; stamped TIMESTAMPTZ:=clock_timestamp();
BEGIN
 IF p_asset_ids IS NULL OR cardinality(p_asset_ids)>12 OR EXISTS(SELECT 1 FROM unnest(p_asset_ids) x WHERE x IS NULL OR NOT EXISTS(SELECT 1 FROM public.kq_stock_instruments i WHERE i.id=x)) THEN RAISE EXCEPTION 'stocks_invalid_instruments'; END IF;
 SELECT COALESCE(array_agg(DISTINCT x ORDER BY x),'{}') INTO wanted FROM unnest(p_asset_ids) x;
 INSERT INTO public.kq_stock_quotes(asset_id) SELECT unnest(wanted) ORDER BY 1 ON CONFLICT DO NOTHING;
 FOR current_row IN SELECT * FROM public.kq_stock_quotes WHERE asset_id=ANY(wanted) ORDER BY asset_id FOR UPDATE LOOP
  IF current_row.lease_until>stamped OR current_row.refreshed_at>stamped-interval '5 minutes' OR current_row.attempted_at>stamped-interval '1 minute' THEN CONTINUE; END IF;
  UPDATE public.kq_stock_quotes SET lease_id=lease,lease_until=stamped+interval '60 seconds',attempted_at=stamped WHERE asset_id=current_row.asset_id;
  claimed:=array_append(claimed,current_row.asset_id);
 END LOOP;
 IF cardinality(claimed)=0 THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('leaseId',lease,'assetIds',to_jsonb(claimed));
END $$;

-- A bad/missing provider row leaves that instrument unavailable; valid rows still publish.
CREATE FUNCTION public.rpc_kq_stock_refresh_publish(p_lease_id UUID,p_assets JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item JSONB; instrument public.kq_stock_instruments%ROWTYPE; quote_row public.kq_stock_quotes%ROWTYPE;
 native NUMERIC; euros NUMERIC; fx NUMERIC; change NUMERIC; quoted TIMESTAMPTZ; fx_quoted TIMESTAMPTZ; state TEXT; published BOOLEAN:=false; stamped TIMESTAMPTZ:=clock_timestamp();
BEGIN
 IF p_lease_id IS NULL THEN RETURN false; END IF;
 IF jsonb_typeof(p_assets) IS DISTINCT FROM 'array' OR jsonb_array_length(p_assets)>12 THEN RAISE EXCEPTION 'stocks_invalid_quotes'; END IF;
 PERFORM asset_id FROM public.kq_stock_quotes WHERE lease_id=p_lease_id ORDER BY asset_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_assets) ORDER BY value->>'id' LOOP
  BEGIN
   IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN CONTINUE; END IF;
   SELECT * INTO quote_row FROM public.kq_stock_quotes WHERE asset_id=item->>'id' AND lease_id=p_lease_id;
   IF NOT FOUND OR quote_row.lease_until IS NULL OR quote_row.lease_until<clock_timestamp() THEN CONTINUE; END IF;
   SELECT * INTO instrument FROM public.kq_stock_instruments WHERE id=quote_row.asset_id;
   IF item->>'currency' IS DISTINCT FROM instrument.currency
    OR COALESCE(item->>'priceNative','') !~ '^(0|[1-9][0-9]{0,19})(\.[0-9]{1,18})?$'
    OR COALESCE(item->>'fxRate','') !~ '^(0|[1-9][0-9]{0,19})(\.[0-9]{1,18})?$' THEN CONTINUE; END IF;
   native:=(item->>'priceNative')::NUMERIC; fx:=(item->>'fxRate')::NUMERIC;
   quoted:=(item->>'quotedAt')::TIMESTAMPTZ; fx_quoted:=(item->>'fxQuotedAt')::TIMESTAMPTZ; state:=item->>'marketState';
   IF native<=0 OR native>=1e19 OR fx<=0 OR fx>=1e10 OR quoted IS NULL OR state IS NULL OR state NOT IN ('open','closed')
    OR quoted>stamped+interval '60 seconds' OR quoted<=stamped-(CASE WHEN state='open' THEN interval '45 minutes' ELSE interval '96 hours' END)
    OR (instrument.currency='EUR' AND (fx<>1 OR fx_quoted IS NOT NULL))
    OR (instrument.currency='USD' AND (fx_quoted IS NULL OR fx_quoted<=stamped-(CASE WHEN state='open' THEN interval '45 minutes' ELSE interval '96 hours' END) OR fx_quoted>stamped+interval '60 seconds')) THEN CONTINUE; END IF;
   change:=NULL;
   IF item->'changePercent' IS NOT NULL AND item->'changePercent'<>'null'::JSONB THEN
    IF jsonb_typeof(item->'changePercent')<>'number' THEN CONTINUE; END IF;
    change:=(item->>'changePercent')::NUMERIC;
    IF ABS(change)>1e9 THEN CONTINUE; END IF;
   END IF;
   euros:=CASE WHEN instrument.currency='EUR' THEN native ELSE trunc(native/fx,18) END;
   IF euros<=0 OR euros>=1e19 THEN CONTINUE; END IF;
   UPDATE public.kq_stock_quotes SET price_native=native,price_eur=euros,change_percent=change,quoted_at=quoted,refreshed_at=stamped,
    market_state=state,fx_rate=fx,fx_quoted_at=fx_quoted,lease_id=NULL,lease_until=NULL WHERE asset_id=quote_row.asset_id;
   published:=true;
  EXCEPTION WHEN data_exception THEN CONTINUE;
  END;
 END LOOP;
 UPDATE public.kq_stock_quotes SET lease_id=NULL,lease_until=NULL WHERE lease_id=p_lease_id;
 RETURN published;
END $$;

CREATE FUNCTION public.kq_stock_quote_is_fresh(p_quote public.kq_stock_quotes,p_currency TEXT,p_now TIMESTAMPTZ) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(p_quote.price_native>0 AND p_quote.price_eur>0 AND p_quote.fx_rate>0
  AND p_quote.market_state IN ('open','closed') AND p_quote.refreshed_at>p_now-interval '10 minutes' AND p_quote.refreshed_at<=p_now+interval '60 seconds'
  AND p_quote.quoted_at<=p_now+interval '60 seconds'
  AND p_quote.quoted_at>p_now-CASE WHEN p_quote.market_state='open' THEN interval '45 minutes' ELSE interval '96 hours' END
  AND ((p_currency='EUR' AND p_quote.fx_rate=1) OR (p_currency='USD' AND p_quote.fx_quoted_at>p_now-(CASE WHEN p_quote.market_state='open' THEN interval '45 minutes' ELSE interval '96 hours' END) AND p_quote.fx_quoted_at<=p_now+interval '60 seconds')),false);
$$;
CREATE FUNCTION public.kq_stock_trade_json(p_trade public.kq_stock_trades) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('orderId',p_trade.order_id,'assetId',p_trade.asset_id,'side',p_trade.side,'quantity',p_trade.quantity::TEXT,
  'priceEur',p_trade.price_eur::TEXT,'amountCents',p_trade.amount_cents,'costBasisCents',p_trade.cost_basis_cents,
  'realizedPnlCents',p_trade.realized_pnl_cents,'cashAfterCents',p_trade.cash_after_cents,'createdAt',p_trade.created_at);
$$;

DO $$ DECLARE definition TEXT; patched TEXT; BEGIN
 SELECT pg_get_functiondef('public.kq_treasury_post(uuid,text,text,timestamptz,jsonb,text)'::regprocedure) INTO definition;
 patched:=replace(definition,'''expense_crypto_losses'']','''expense_crypto_losses'',''securities_assets'',''revenue_stock_gains'',''expense_stock_losses'']');
 IF patched=definition THEN RAISE EXCEPTION 'stocks_treasury_chart_drift'; END IF;
 EXECUTE patched;
END $$;

CREATE FUNCTION public.rpc_kq_stock_command(p_user_id UUID,p_action TEXT DEFAULT 'state',p_payload JSONB DEFAULT '{}'::JSONB,p_asset_ids TEXT[] DEFAULT '{}') RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE wallet BIGINT; side TEXT; asset TEXT; amount BIGINT; qty NUMERIC; basis BIGINT; pnl BIGINT;
 quote_row public.kq_stock_quotes%ROWTYPE; position public.kq_stock_positions%ROWTYPE; offer public.kq_stock_orders%ROWTYPE;
 trade public.kq_stock_trades%ROWTYPE; assets JSONB; positions JSONB; trades JSONB; instrument public.kq_stock_instruments%ROWTYPE; expiry TIMESTAMPTZ;
BEGIN
 IF p_user_id IS NULL OR p_action IS NULL OR p_action NOT IN ('state','preview','confirm') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR p_asset_ids IS NULL OR cardinality(p_asset_ids)>12 OR EXISTS(SELECT 1 FROM unnest(p_asset_ids) x WHERE x IS NULL OR NOT EXISTS(SELECT 1 FROM public.kq_stock_instruments i WHERE i.id=x)) THEN RAISE EXCEPTION 'stocks_invalid'; END IF;
 -- This settles elapsed business bills and (via the banking hook) due loan instalments.
 PERFORM public.kq_business_settle(p_user_id);
 SELECT cash_cents INTO wallet FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'stocks_no_wallet'; END IF;
 PERFORM public.kq_treasury_initialize(p_user_id);
 IF p_action='state' THEN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',i.id,'symbol',i.symbol,'name',i.name,'kind',i.kind,'markets',to_jsonb(i.markets),'currency',i.currency,
   'priceNative',q.price_native::TEXT,'priceEur',q.price_eur::TEXT,'changePercent',q.change_percent,'quotedAt',q.quoted_at,'refreshedAt',q.refreshed_at,
   'marketState',q.market_state,'fxRate',q.fx_rate::TEXT,'fxQuotedAt',q.fx_quoted_at) ORDER BY i.name,i.id),'[]') INTO assets
   FROM public.kq_stock_instruments i LEFT JOIN public.kq_stock_quotes q ON q.asset_id=i.id
   WHERE i.id=ANY(p_asset_ids) OR EXISTS(SELECT 1 FROM public.kq_stock_positions p WHERE p.user_id=p_user_id AND p.asset_id=i.id AND p.quantity>0);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('assetId',p.asset_id,'quantity',p.quantity::TEXT,'costBasisCents',p.cost_basis_cents,
   'valueCents',CASE WHEN public.kq_stock_quote_is_fresh(q,i.currency,clock_timestamp()) AND floor(p.quantity*q.price_eur*100)<=9007199254740991
    THEN floor(p.quantity*q.price_eur*100)::BIGINT ELSE NULL END) ORDER BY p.asset_id),'[]') INTO positions
   FROM public.kq_stock_positions p JOIN public.kq_stock_instruments i ON i.id=p.asset_id LEFT JOIN public.kq_stock_quotes q ON q.asset_id=p.asset_id
   WHERE p.user_id=p_user_id AND p.quantity>0;
  SELECT COALESCE(jsonb_agg(public.kq_stock_trade_json(t) ORDER BY t.created_at DESC,t.order_id),'[]') INTO trades
   FROM (SELECT * FROM public.kq_stock_trades WHERE user_id=p_user_id ORDER BY created_at DESC,order_id LIMIT 20) t;
  RETURN jsonb_build_object('version',1,'serverNow',clock_timestamp(),'cashCents',wallet,'assets',assets,'positions',positions,'recentTrades',trades);
 END IF;
 IF p_action='confirm' THEN
  IF COALESCE(p_payload->>'orderId','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN RAISE EXCEPTION 'stocks_invalid'; END IF;
  -- Read the owner's persisted receipt before expiry/configuration checks; retrying a
  -- committed order can never spend twice, even after a lost network response.
  SELECT * INTO trade FROM public.kq_stock_trades WHERE user_id=p_user_id AND order_id=(p_payload->>'orderId')::UUID;
  IF FOUND THEN RETURN jsonb_build_object('trade',public.kq_stock_trade_json(trade),'replayed',true); END IF;
 END IF;
 IF p_action='preview' THEN
  side:=p_payload->>'side'; asset:=p_payload->>'assetId';
  IF side IS NULL OR side NOT IN ('buy','sell') OR asset IS NULL THEN RAISE EXCEPTION 'stocks_invalid'; END IF;
  SELECT * INTO instrument FROM public.kq_stock_instruments WHERE id=asset;
  IF NOT FOUND THEN RAISE EXCEPTION 'stocks_invalid'; END IF;
  SELECT * INTO quote_row FROM public.kq_stock_quotes WHERE asset_id=asset;
  IF NOT FOUND OR NOT public.kq_stock_quote_is_fresh(quote_row,instrument.currency,clock_timestamp()) THEN RAISE EXCEPTION 'stocks_stale'; END IF;
  SELECT * INTO position FROM public.kq_stock_positions WHERE user_id=p_user_id AND asset_id=asset;
  IF side='buy' THEN
   IF cardinality(instrument.markets)=0 THEN RAISE EXCEPTION 'stocks_retired'; END IF;
   IF (p_payload->>'amountCents') IS NULL OR (p_payload->>'amountCents') !~ '^[0-9]{1,9}$' THEN RAISE EXCEPTION 'stocks_invalid'; END IF;
   amount:=(p_payload->>'amountCents')::BIGINT;
   IF amount<100 OR amount>100000000 THEN RAISE EXCEPTION 'stocks_invalid'; END IF;
   IF wallet<amount THEN RAISE EXCEPTION 'stocks_cash'; END IF;
   qty:=trunc(amount::NUMERIC/(quote_row.price_eur*100),18);
   IF qty>=1e20 THEN RAISE EXCEPTION 'stocks_position_limit'; END IF;
  ELSE
   IF (p_payload->>'quantity') IS NULL OR (p_payload->>'quantity') !~ '^(0|[1-9][0-9]{0,19})(\.[0-9]{1,18})?$' THEN RAISE EXCEPTION 'stocks_invalid'; END IF;
   qty:=(p_payload->>'quantity')::NUMERIC;
   IF qty<=0 OR position.quantity IS NULL OR qty>position.quantity THEN RAISE EXCEPTION 'stocks_quantity'; END IF;
   IF floor(qty*quote_row.price_eur*100)>100000000 THEN RAISE EXCEPTION 'stocks_order_limit'; END IF;
   amount:=floor(qty*quote_row.price_eur*100)::BIGINT;
  END IF;
  IF qty<=0 OR amount<1 THEN RAISE EXCEPTION 'stocks_dust'; END IF;
  expiry:=LEAST(clock_timestamp()+interval '60 seconds',quote_row.refreshed_at+interval '10 minutes',
   quote_row.quoted_at+CASE WHEN quote_row.market_state='open' THEN interval '45 minutes' ELSE interval '96 hours' END,
   CASE WHEN instrument.currency='USD' THEN quote_row.fx_quoted_at+(CASE WHEN quote_row.market_state='open' THEN interval '45 minutes' ELSE interval '96 hours' END) ELSE 'infinity'::TIMESTAMPTZ END);
  -- Bound abandoned preview storage; committed orders remain the idempotency key.
  DELETE FROM public.kq_stock_orders o WHERE user_id=p_user_id AND expires_at<now()-interval '1 day'
   AND NOT EXISTS(SELECT 1 FROM public.kq_stock_trades t WHERE t.order_id=o.id);
  INSERT INTO public.kq_stock_orders(user_id,asset_id,side,quantity,price_eur,amount_cents,quoted_at,expires_at)
   VALUES(p_user_id,asset,side,qty,quote_row.price_eur,amount,quote_row.quoted_at,expiry) RETURNING * INTO offer;
  RETURN jsonb_build_object('orderId',offer.id,'assetId',asset,'side',side,'quantity',qty::TEXT,'priceEur',quote_row.price_eur::TEXT,'amountCents',amount,'quotedAt',quote_row.quoted_at,'expiresAt',offer.expires_at);
 END IF;
 SELECT * INTO offer FROM public.kq_stock_orders WHERE id=(p_payload->>'orderId')::UUID AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'stocks_order_missing'; END IF;
 IF offer.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'stocks_expired'; END IF;
 SELECT * INTO position FROM public.kq_stock_positions WHERE user_id=p_user_id AND asset_id=offer.asset_id FOR UPDATE;
 IF offer.side='buy' THEN
  IF wallet<offer.amount_cents THEN RAISE EXCEPTION 'stocks_cash'; END IF;
  IF COALESCE(position.cost_basis_cents,0)+offer.amount_cents>2147483647 OR COALESCE(position.quantity,0)+offer.quantity>=1e20 THEN RAISE EXCEPTION 'stocks_position_limit'; END IF;
  wallet:=wallet-offer.amount_cents; basis:=offer.amount_cents; pnl:=0;
  INSERT INTO public.kq_stock_positions(user_id,asset_id,quantity,cost_basis_cents) VALUES(p_user_id,offer.asset_id,offer.quantity,basis)
   ON CONFLICT(user_id,asset_id) DO UPDATE SET quantity=public.kq_stock_positions.quantity+EXCLUDED.quantity,cost_basis_cents=public.kq_stock_positions.cost_basis_cents+EXCLUDED.cost_basis_cents;
 ELSE
  IF position.quantity IS NULL OR position.quantity<offer.quantity THEN RAISE EXCEPTION 'stocks_quantity'; END IF;
  IF wallet+offer.amount_cents>2147483647 THEN RAISE EXCEPTION 'stocks_wallet_limit'; END IF;
  basis:=CASE WHEN position.quantity=offer.quantity THEN position.cost_basis_cents ELSE floor(position.cost_basis_cents*offer.quantity/position.quantity)::BIGINT END;
  pnl:=offer.amount_cents-basis; wallet:=wallet+offer.amount_cents;
  UPDATE public.kq_stock_positions SET quantity=quantity-offer.quantity,cost_basis_cents=cost_basis_cents-basis WHERE user_id=p_user_id AND asset_id=offer.asset_id;
 END IF;
 UPDATE public.kq_equipment_wallets SET cash_cents=wallet,updated_at=now() WHERE user_id=p_user_id;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 INSERT INTO public.kq_stock_trades(order_id,user_id,asset_id,side,quantity,price_eur,amount_cents,cost_basis_cents,realized_pnl_cents,cash_after_cents)
 VALUES(offer.id,p_user_id,offer.asset_id,offer.side,offer.quantity,offer.price_eur,offer.amount_cents,basis,pnl,wallet) RETURNING * INTO trade;
 IF offer.side='buy' THEN
  PERFORM public.kq_treasury_pair(p_user_id,'stock-buy','stock:'||offer.id,now(),'securities_assets','suspense',basis,'Achat boursier virtuel');
 ELSE
  PERFORM public.kq_treasury_post(p_user_id,'stock-sell','stock:'||offer.id,now(),jsonb_build_array(
   jsonb_build_object('account','suspense','deltaCents',offer.amount_cents),jsonb_build_object('account','securities_assets','deltaCents',-basis),
   jsonb_build_object('account',CASE WHEN pnl>=0 THEN 'revenue_stock_gains' ELSE 'expense_stock_losses' END,'deltaCents',-pnl)),'Vente boursière virtuelle');
 END IF;
 RETURN jsonb_build_object('trade',public.kq_stock_trade_json(trade),'replayed',false);
END $$;

CREATE OR REPLACE FUNCTION public.kq_treasury_balances_at(p_user UUID,p_at TIMESTAMPTZ,p_inclusive BOOLEAN) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH names(account) AS (SELECT unnest(ARRAY['cash','vat_reserve','savings','equipment','website','stock','prepaid','lab_payable','energy_payable','vat_payable',
 'opening_equity','capital','suspense','revenue_online','revenue_shop','revenue_wholesale','revenue_rewards','revenue_interest',
 'expense_lab','expense_energy','expense_processing','expense_hosting','expense_advertising','expense_domiciliation','expense_maintenance','expense_depreciation','stock_variation','expense_other','loan_payable','expense_loan_interest','crypto_assets','revenue_crypto_gains','expense_crypto_losses','securities_assets','revenue_stock_gains','expense_stock_losses'])),
 later AS (SELECT line->>'account' account,SUM((line->>'deltaCents')::BIGINT)::BIGINT balance FROM public.kq_treasury_journal j
  CROSS JOIN LATERAL jsonb_array_elements(j.postings) line WHERE j.user_id=p_user AND j.kind<>'opening'
   AND (j.occurred_at>p_at OR (NOT p_inclusive AND j.occurred_at=p_at)) GROUP BY line->>'account')
 SELECT jsonb_object_agg(names.account,COALESCE(current.balance_cents,0)-COALESCE(later.balance,0))
 FROM names LEFT JOIN public.kq_treasury_balances current ON current.user_id=p_user AND current.account=names.account LEFT JOIN later ON later.account=names.account;
$$;
CREATE OR REPLACE FUNCTION public.rpc_kq_treasury_snapshot(p_user_id UUID,p_period TEXT DEFAULT 'current',p_offset INTEGER DEFAULT 0,p_limit INTEGER DEFAULT 25) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE started TIMESTAMPTZ; origin TIMESTAMPTZ; month_start TIMESTAMPTZ; period_from TIMESTAMPTZ; period_to TIMESTAMPTZ;
 opening JSONB; closing JSONB; series JSONB; items JSONB; total BIGINT; step_seconds BIGINT; checks JSONB; unclassified JSONB;
BEGIN
 IF p_user_id IS NULL OR p_period IS NULL OR p_period NOT IN ('current','previous','all') OR p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'treasury_invalid_request'; END IF;
 -- Match every other economy endpoint's wallet -> commerce/account lock order.
 PERFORM public.kq_business_settle(p_user_id);
 PERFORM public.kq_treasury_initialize(p_user_id);
 IF EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength='treasurer') THEN
  PERFORM public.rpc_arena_chanvrier_savings(p_user_id,'state',0,NULL);
 END IF;
 PERFORM public.kq_treasury_refresh(p_user_id);
 SELECT started_at INTO started FROM public.kq_treasury_accounts WHERE user_id=p_user_id;
 SELECT business_started_at INTO origin FROM public.kq_commerce_accounts WHERE user_id=p_user_id;
 origin:=COALESCE(origin,started);
 month_start:=origin+FLOOR(GREATEST(0,EXTRACT(EPOCH FROM (now()-origin)))/432000)*interval '120 hours';
 period_from:=CASE p_period WHEN 'current' THEN GREATEST(started,month_start) WHEN 'previous' THEN GREATEST(started,month_start-interval '120 hours') ELSE started END;
 period_to:=GREATEST(period_from,CASE p_period WHEN 'previous' THEN LEAST(now(),month_start) ELSE now() END);
 opening:=public.kq_treasury_balances_at(p_user_id,period_from,false);
 closing:=public.kq_treasury_balances_at(p_user_id,period_to,p_period<>'previous');
 -- A prior period entirely before opening has no observed activity or chart.
 IF period_to=period_from AND p_period='previous' THEN closing:=opening; END IF;
 step_seconds:=CASE WHEN p_period='all' THEN 432000*GREATEST(1,CEIL(EXTRACT(EPOCH FROM (period_to-period_from))/432000/1200))::BIGINT ELSE 14400 END;
 WITH buckets AS (
  SELECT GREATEST(period_from,stamp) AS bucket_from,LEAST(period_to,stamp+step_seconds*interval '1 second') AS bucket_to
  FROM generate_series(origin+FLOOR(EXTRACT(EPOCH FROM (period_from-origin))/step_seconds)*step_seconds*interval '1 second',
   period_to,step_seconds*interval '1 second') stamp WHERE period_to>period_from AND stamp<period_to AND stamp+step_seconds*interval '1 second'>period_from
 ), flows AS (
  SELECT j.occurred_at,line->>'account' account,(line->>'deltaCents')::BIGINT amount
  FROM public.kq_treasury_journal j CROSS JOIN LATERAL jsonb_array_elements(j.postings) line
  WHERE j.user_id=p_user_id AND j.kind<>'opening' AND j.occurred_at>=period_from
   AND (j.occurred_at<period_to OR (p_period<>'previous' AND j.occurred_at=period_to))
 ), bucket_flows AS (
  SELECT b.bucket_from,b.bucket_to,
   COALESCE(SUM(f.amount) FILTER(WHERE f.account='cash'),0)::BIGINT cash_delta,
   COALESCE(SUM(f.amount) FILTER(WHERE f.account='cash' AND f.amount>0),0)::BIGINT inflows,
   COALESCE(-SUM(f.amount) FILTER(WHERE f.account='cash' AND f.amount<0),0)::BIGINT outflows,
   COALESCE(-SUM(f.amount) FILTER(WHERE f.account LIKE 'revenue_%'),0)::BIGINT revenue,
   COALESCE(SUM(f.amount) FILTER(WHERE f.account LIKE 'expense_%' OR f.account='stock_variation'),0)::BIGINT expense
  FROM buckets b LEFT JOIN flows f ON f.occurred_at>=b.bucket_from AND (f.occurred_at<b.bucket_to OR (p_period<>'previous' AND b.bucket_to=period_to AND f.occurred_at=period_to))
  GROUP BY b.bucket_from,b.bucket_to
 ), points AS (
  SELECT *, (opening->>'cash')::BIGINT+COALESCE(SUM(cash_delta) OVER(ORDER BY bucket_from ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0)::BIGINT cash_opening,
   (opening->>'cash')::BIGINT+SUM(cash_delta) OVER(ORDER BY bucket_from)::BIGINT cash_closing FROM bucket_flows
 ) SELECT COALESCE(jsonb_agg(jsonb_build_object('from',bucket_from,'to',bucket_to,'cashOpeningCents',cash_opening,'cashClosingCents',cash_closing,
  'inflowsCents',inflows,'outflowsCents',outflows,'revenueCents',revenue,'expenseCents',expense) ORDER BY bucket_from),'[]'::JSONB) INTO series FROM points;
 SELECT COUNT(*) INTO total FROM public.kq_treasury_journal j WHERE user_id=p_user_id AND occurred_at>=period_from
  AND (occurred_at<period_to OR (p_period<>'previous' AND occurred_at=period_to)) AND (period_to>period_from OR p_period<>'previous');
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',j.id,'occurredAt',j.occurred_at,'kind',j.kind,'reference',j.reference,'postings',j.postings) ORDER BY j.occurred_at DESC,j.id DESC),'[]'::JSONB)
 INTO items FROM (SELECT * FROM public.kq_treasury_journal WHERE user_id=p_user_id AND occurred_at>=period_from
  AND (occurred_at<period_to OR (p_period<>'previous' AND occurred_at=period_to)) AND (period_to>period_from OR p_period<>'previous') ORDER BY occurred_at DESC,id DESC OFFSET p_offset LIMIT p_limit) j;
 -- Match counterparts within the same committed financial transaction. Opposite
 -- unknown transactions remain visible even if their total suspense cancels out.
 -- The report refresh above has already completed deferred asset/stock valuation.
 WITH unresolved AS (
  SELECT j.transaction_id,SUM((line->>'deltaCents')::BIGINT)::BIGINT amount
  FROM public.kq_treasury_journal j CROSS JOIN LATERAL jsonb_array_elements(j.postings) line
  WHERE j.user_id=p_user_id AND line->>'account'='suspense'
   AND (j.occurred_at<period_to OR (p_period<>'previous' AND j.occurred_at=period_to))
  GROUP BY j.transaction_id HAVING SUM((line->>'deltaCents')::BIGINT)<>0
 ) SELECT jsonb_build_object('transactions',COUNT(*),'netCents',COALESCE(SUM(amount),0),'absoluteCents',COALESCE(SUM(ABS(amount)),0))
 INTO unclassified FROM unresolved;
 SELECT jsonb_build_object('walletCashCents',w.cash_cents,'vatReserveCents',a.vat_reserved_cents,
  'savingsCents',COALESCE((SELECT SUM(balance_cents) FROM public.arena_chanvrier_savings_deposits WHERE user_id=p_user_id),0),
  'labDebtCents',COALESCE((SELECT SUM(remaining_cents) FROM public.kq_lab_invoices WHERE user_id=p_user_id),0),
  'energyDebtCents',COALESCE((SELECT SUM(remaining_cents) FROM public.kq_energy_invoices WHERE user_id=p_user_id),0),
  'loanDebtCents',COALESCE((SELECT SUM(total_cents-paid_cents) FROM public.kq_bank_loans WHERE user_id=p_user_id),0),
  'cryptoCostCents',COALESCE((SELECT SUM(cost_basis_cents) FROM public.kq_crypto_positions WHERE user_id=p_user_id),0),
  'securitiesCostCents',COALESCE((SELECT SUM(cost_basis_cents) FROM public.kq_stock_positions WHERE user_id=p_user_id),0),
  'vatDebtCents',a.vat_reserved_cents) INTO checks FROM public.kq_equipment_wallets w JOIN public.kq_commerce_accounts a USING(user_id) WHERE w.user_id=p_user_id;
 RETURN jsonb_build_object('version',1,'serverNow',now(),'startedAt',started,'businessStartedAt',origin,
  'period',jsonb_build_object('key',p_period,'from',period_from,'to',period_to),'openingBalances',opening,'closingBalances',closing,
  'series',series,'journal',jsonb_build_object('items',items,'total',total,'offset',p_offset,'limit',p_limit),'checks',checks,'unclassified',unclassified);
END $$;


REVOKE ALL ON FUNCTION public.kq_treasury_balances_at(UUID,TIMESTAMPTZ,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_treasury_snapshot(UUID,TEXT,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_treasury_snapshot(UUID,TEXT,INTEGER,INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.kq_stock_quote_is_fresh(public.kq_stock_quotes,TEXT,TIMESTAMPTZ),public.kq_stock_trade_json(public.kq_stock_trades) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_stock_refresh_claim(TEXT[]),public.rpc_kq_stock_refresh_publish(UUID,JSONB),public.rpc_kq_stock_command(UUID,TEXT,JSONB,TEXT[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_stock_refresh_claim(TEXT[]),public.rpc_kq_stock_refresh_publish(UUID,JSONB),public.rpc_kq_stock_command(UUID,TEXT,JSONB,TEXT[]) TO service_role;
COMMIT;
