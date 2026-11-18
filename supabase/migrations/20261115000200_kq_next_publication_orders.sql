-- Orders execute at the first eligible provider quote dated AFTER submission.
-- Cash/positions are not reserved; insufficient funds/units reject at execution.
BEGIN;
CREATE TABLE public.kq_pending_market_orders (
 market TEXT NOT NULL CHECK(market IN ('crypto','stocks')),
 order_id UUID NOT NULL, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 asset_id TEXT NOT NULL, side TEXT NOT NULL CHECK(side IN ('buy','sell')),
 budget_cents BIGINT NOT NULL CHECK(budget_cents BETWEEN 1 AND 100000000),
 quantity NUMERIC NOT NULL CHECK(quantity>0),
 submitted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 quote_after TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 deadline_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()+interval '7 days',
 execution_price NUMERIC, execution_at TIMESTAMPTZ,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','executed','rejected')),
 reason TEXT, result JSONB,
 PRIMARY KEY(market,order_id)
);
ALTER TABLE public.kq_pending_market_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_pending_market_orders FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX kq_pending_market_owner ON public.kq_pending_market_orders(user_id,submitted_at);
CREATE INDEX kq_pending_market_ready ON public.kq_pending_market_orders(market,asset_id) WHERE status='pending';

ALTER FUNCTION public.rpc_kq_crypto_command(UUID,TEXT,JSONB,BOOLEAN) RENAME TO kq_crypto_command_before_queue;
ALTER FUNCTION public.rpc_kq_stock_command(UUID,TEXT,JSONB,TEXT[]) RENAME TO kq_stock_command_before_queue;
REVOKE ALL ON FUNCTION public.kq_crypto_command_before_queue(UUID,TEXT,JSONB,BOOLEAN),public.kq_stock_command_before_queue(UUID,TEXT,JSONB,TEXT[]) FROM PUBLIC,anon,authenticated,service_role;

-- A captured execution price remains authoritative even if settlement is retried later.
DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 body:=pg_get_functiondef('public.kq_crypto_command_before_queue(uuid,text,jsonb,boolean)'::regprocedure);
 anchor:='IF offer.expires_at<=clock_timestamp() OR NOT public.kq_crypto_quote_is_fresh(offer.quoted_at,clock_timestamp()) THEN';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'queued_crypto_expiry_anchor'; END IF;
 EXECUTE replace(body,anchor,$replacement$IF (offer.expires_at<=clock_timestamp() OR NOT public.kq_crypto_quote_is_fresh(offer.quoted_at,clock_timestamp()))
  AND NOT EXISTS(SELECT 1 FROM public.kq_pending_market_orders q WHERE q.market='crypto' AND q.order_id=offer.id AND q.user_id=p_user_id AND q.execution_price IS NOT NULL) THEN$replacement$);
END $$;

CREATE FUNCTION public.kq_capture_market_publication() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_market TEXT:=TG_ARGV[0]; eligible BOOLEAN:=true; fx_at TIMESTAMPTZ; needs_fx BOOLEAN:=false;
BEGIN
 IF v_market='stocks' THEN
  eligible:=NEW.market_state='open';
  IF EXISTS(SELECT 1 FROM public.kq_stock_instruments WHERE id=NEW.asset_id AND currency='USD') THEN fx_at:=NEW.fx_quoted_at; needs_fx:=true; END IF;
 END IF;
 IF eligible AND NEW.price_eur>0 AND NEW.quoted_at<=clock_timestamp() THEN
  UPDATE public.kq_pending_market_orders q SET execution_price=NEW.price_eur,execution_at=NEW.quoted_at
  WHERE q.market=v_market AND q.asset_id=NEW.asset_id::TEXT AND q.status='pending' AND q.execution_price IS NULL
   AND NEW.quoted_at>q.quote_after AND clock_timestamp()<=q.deadline_at
   AND (NOT needs_fx OR (fx_at>q.quote_after AND fx_at<=clock_timestamp()));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_crypto_capture_publication AFTER INSERT OR UPDATE ON public.kq_crypto_quotes FOR EACH ROW EXECUTE FUNCTION public.kq_capture_market_publication('crypto');
CREATE TRIGGER kq_stock_capture_publication AFTER INSERT OR UPDATE ON public.kq_stock_quotes FOR EACH ROW EXECUTE FUNCTION public.kq_capture_market_publication('stocks');

CREATE FUNCTION public.kq_market_queue_json(q public.kq_pending_market_orders) RETURNS JSONB
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('orderId',q.order_id,'market',q.market,'assetId',q.asset_id,'side',q.side,
 'budgetCents',q.budget_cents,'quantity',q.quantity::TEXT,'submittedAt',q.submitted_at,'deadlineAt',q.deadline_at,
 'status',q.status,'reason',q.reason,'executionAt',q.execution_at);
$$;

CREATE FUNCTION public.kq_settle_market_queue(p_user UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.kq_pending_market_orders; qty NUMERIC; amount NUMERIC; receipt JSONB; code TEXT;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.kq_pending_market_orders WHERE user_id=p_user AND status='pending' AND (execution_price IS NOT NULL OR deadline_at<=clock_timestamp())) THEN RETURN; END IF;
 -- Same lock order as existing commerce/market commands: business, wallet, order.
 PERFORM public.kq_business_settle(p_user);
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 FOR q IN SELECT * FROM public.kq_pending_market_orders WHERE user_id=p_user AND status='pending'
   AND (execution_price IS NOT NULL OR deadline_at<=clock_timestamp()) ORDER BY submitted_at,market,order_id FOR UPDATE LOOP
  IF q.execution_price IS NULL THEN
   UPDATE public.kq_pending_market_orders SET status='rejected',reason='no_new_quote' WHERE market=q.market AND order_id=q.order_id;
   CONTINUE;
  END IF;
  BEGIN
   qty:=CASE WHEN q.side='buy' THEN trunc(q.budget_cents/(q.execution_price*100),18) ELSE q.quantity END;
   amount:=CASE WHEN q.side='buy' THEN q.budget_cents ELSE floor(qty*q.execution_price*100) END;
   IF qty<=0 OR amount<1 THEN RAISE EXCEPTION 'market_dust'; END IF;
   IF qty>=1e20 OR amount>100000000 THEN RAISE EXCEPTION 'market_limit'; END IF;
   IF q.market='crypto' THEN
    UPDATE public.kq_crypto_orders SET quantity=qty,amount_cents=amount::BIGINT,price_eur=q.execution_price,quoted_at=q.execution_at,expires_at='infinity' WHERE id=q.order_id AND user_id=p_user;
    receipt:=public.kq_crypto_command_before_queue(p_user,'confirm',jsonb_build_object('orderId',q.order_id),true);
   ELSE
    UPDATE public.kq_stock_orders SET quantity=qty,amount_cents=amount::BIGINT,price_eur=q.execution_price,quoted_at=q.execution_at,expires_at='infinity' WHERE id=q.order_id AND user_id=p_user;
    receipt:=public.kq_stock_command_before_queue(p_user,'confirm',jsonb_build_object('orderId',q.order_id),'{}');
   END IF;
   UPDATE public.kq_pending_market_orders SET status='executed',result=receipt WHERE market=q.market AND order_id=q.order_id;
  EXCEPTION WHEN raise_exception THEN
   GET STACKED DIAGNOSTICS code=MESSAGE_TEXT;
   IF code NOT IN ('market_dust','market_limit','crypto_cash','crypto_quantity','crypto_position_limit','crypto_wallet_limit','stocks_cash','stocks_quantity','stocks_position_limit','stocks_wallet_limit') THEN RAISE; END IF;
   UPDATE public.kq_pending_market_orders SET status='rejected',reason=code WHERE market=q.market AND order_id=q.order_id;
  END;
 END LOOP;
END $$;

CREATE FUNCTION public.kq_enqueue_market_order(p_market TEXT,p_user UUID,p_payload JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.kq_pending_market_orders; offer RECORD; order_key UUID; receipt JSONB; table_name TEXT; barrier TIMESTAMPTZ;
BEGIN
 IF p_market NOT IN ('crypto','stocks') OR p_payload->>'orderId' IS NULL THEN RAISE EXCEPTION 'market_invalid'; END IF;
 order_key:=(p_payload->>'orderId')::UUID;
 PERFORM public.kq_business_settle(p_user);
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'market_invalid'; END IF;
 -- Reconcile/return receipts BEFORE checking the old preview expiration.
 PERFORM public.kq_settle_market_queue(p_user);
 SELECT * INTO q FROM public.kq_pending_market_orders WHERE market=p_market AND order_id=order_key AND user_id=p_user;
 IF FOUND THEN
  IF q.status='executed' THEN RETURN q.result||jsonb_build_object('replayed',true); END IF;
  RETURN jsonb_build_object('queuedOrder',public.kq_market_queue_json(q),'replayed',true);
 END IF;
 IF p_market='crypto' THEN
  SELECT jsonb_build_object('trade',public.kq_crypto_trade_json(t),'replayed',true) INTO receipt FROM public.kq_crypto_trades t WHERE t.order_id=order_key AND t.user_id=p_user;
 ELSE
  SELECT jsonb_build_object('trade',public.kq_stock_trade_json(t),'replayed',true) INTO receipt FROM public.kq_stock_trades t WHERE t.order_id=order_key AND t.user_id=p_user;
 END IF;
 IF receipt IS NOT NULL THEN RETURN receipt; END IF;
 IF p_payload->>'executionPolicy' IS DISTINCT FROM 'next-publication' THEN RAISE EXCEPTION 'market_policy_required'; END IF;
 IF (SELECT count(*) FROM public.kq_pending_market_orders WHERE user_id=p_user AND status='pending')>=20 THEN RAISE EXCEPTION 'market_queue_limit'; END IF;
 table_name:=CASE WHEN p_market='crypto' THEN 'kq_crypto_orders' ELSE 'kq_stock_orders' END;
 EXECUTE format('SELECT id,asset_id::TEXT AS asset_id,side,amount_cents,quantity,expires_at FROM public.%I WHERE id=$1 AND user_id=$2 FOR UPDATE',table_name) INTO offer USING order_key,p_user;
 IF offer.id IS NULL THEN RAISE EXCEPTION 'market_order_missing'; END IF;
 IF offer.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'market_expired'; END IF;
 IF p_market='crypto' THEN SELECT greatest(clock_timestamp(),quoted_at) INTO barrier FROM public.kq_crypto_quotes WHERE asset_id::TEXT=offer.asset_id;
 ELSE SELECT greatest(clock_timestamp(),quoted_at,fx_quoted_at) INTO barrier FROM public.kq_stock_quotes WHERE asset_id=offer.asset_id; END IF;
 INSERT INTO public.kq_pending_market_orders(market,order_id,user_id,asset_id,side,budget_cents,quantity,quote_after)
 VALUES(p_market,order_key,p_user,offer.asset_id::TEXT,offer.side,offer.amount_cents,offer.quantity,barrier) RETURNING * INTO q;
 -- Existing preview cleanup must not remove an accepted order.
 EXECUTE format('UPDATE public.%I SET expires_at=''infinity'' WHERE id=$1 AND user_id=$2',table_name) USING order_key,p_user;
 RETURN jsonb_build_object('queuedOrder',public.kq_market_queue_json(q),'replayed',false);
END $$;

CREATE FUNCTION public.rpc_kq_crypto_command(p_user_id UUID,p_action TEXT DEFAULT 'state',p_payload JSONB DEFAULT '{}'::JSONB,p_market_enabled BOOLEAN DEFAULT false) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result JSONB;
BEGIN
 IF p_action='confirm' THEN
  IF NOT COALESCE(p_market_enabled,false) AND NOT EXISTS(SELECT 1 FROM public.kq_pending_market_orders WHERE user_id=p_user_id AND market='crypto' AND order_id::TEXT=p_payload->>'orderId')
   AND NOT EXISTS(SELECT 1 FROM public.kq_crypto_trades WHERE user_id=p_user_id AND order_id::TEXT=p_payload->>'orderId') THEN RAISE EXCEPTION 'crypto_closed'; END IF;
  RETURN public.kq_enqueue_market_order('crypto',p_user_id,p_payload);
 END IF;
 PERFORM public.kq_settle_market_queue(p_user_id);
 result:=public.kq_crypto_command_before_queue(p_user_id,p_action,p_payload,p_market_enabled);
 IF p_action='state' THEN
  result:=result||jsonb_build_object('queuedOrders',COALESCE((SELECT jsonb_agg(public.kq_market_queue_json(q) ORDER BY submitted_at DESC) FROM (SELECT * FROM public.kq_pending_market_orders WHERE user_id=p_user_id AND market='crypto' ORDER BY (status='pending') DESC,submitted_at DESC LIMIT 40) q),'[]'::JSONB));
 END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.rpc_kq_stock_command(p_user_id UUID,p_action TEXT DEFAULT 'state',p_payload JSONB DEFAULT '{}'::JSONB,p_asset_ids TEXT[] DEFAULT '{}') RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result JSONB;
BEGIN
 IF p_action='confirm' THEN RETURN public.kq_enqueue_market_order('stocks',p_user_id,p_payload); END IF;
 PERFORM public.kq_settle_market_queue(p_user_id);
 result:=public.kq_stock_command_before_queue(p_user_id,p_action,p_payload,p_asset_ids);
 IF p_action='state' THEN
  result:=result||jsonb_build_object('queuedOrders',COALESCE((SELECT jsonb_agg(public.kq_market_queue_json(q) ORDER BY submitted_at DESC) FROM (SELECT * FROM public.kq_pending_market_orders WHERE user_id=p_user_id AND market='stocks' ORDER BY (status='pending') DESC,submitted_at DESC LIMIT 40) q),'[]'::JSONB));
 END IF;
 RETURN result;
END $$;

-- Bounded drain after publication. The capture trigger freezes the FIRST eligible
-- price, so delayed retries never silently select a later, more favourable quote.
CREATE FUNCTION public.rpc_kq_settle_market_queue() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner UUID; count INTEGER:=0;
BEGIN
 FOR owner IN SELECT user_id FROM public.kq_pending_market_orders WHERE status='pending' AND (execution_price IS NOT NULL OR deadline_at<=clock_timestamp()) GROUP BY user_id ORDER BY user_id LIMIT 100 LOOP
  PERFORM public.kq_settle_market_queue(owner); count:=count+1;
 END LOOP;
 RETURN count;
END $$;
CREATE FUNCTION public.rpc_kq_pending_stock_assets() RETURNS TEXT[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(array_agg(asset_id),'{}') FROM (SELECT asset_id FROM public.kq_pending_market_orders WHERE market='stocks' AND status='pending' AND execution_price IS NULL GROUP BY asset_id ORDER BY min(submitted_at) LIMIT 6) q;
$$;
-- New application versions cannot accidentally execute an old immediate RPC
-- if their database migration has not been deployed yet.
CREATE FUNCTION public.rpc_kq_market_order_submit(p_market TEXT,p_user_id UUID,p_payload JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_market NOT IN ('crypto','stocks') OR p_market IS NULL OR p_user_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'market_invalid'; END IF;
 RETURN public.kq_enqueue_market_order(p_market,p_user_id,p_payload);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_market_order_submit(TEXT,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_market_order_submit(TEXT,UUID,JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.kq_capture_market_publication(),public.kq_market_queue_json(public.kq_pending_market_orders),public.kq_settle_market_queue(UUID),public.kq_enqueue_market_order(TEXT,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_crypto_command(UUID,TEXT,JSONB,BOOLEAN),public.rpc_kq_stock_command(UUID,TEXT,JSONB,TEXT[]),public.rpc_kq_settle_market_queue(),public.rpc_kq_pending_stock_assets() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_crypto_command(UUID,TEXT,JSONB,BOOLEAN),public.rpc_kq_stock_command(UUID,TEXT,JSONB,TEXT[]),public.rpc_kq_settle_market_queue(),public.rpc_kq_pending_stock_assets() TO service_role;
COMMIT;
