BEGIN;

-- One pair of refillable balances per player, shared by every lot and culture.
ALTER TABLE public.kq_commerce_accounts
 ADD COLUMN demand_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 ADD COLUMN online_demand_debt NUMERIC(20,12) NOT NULL DEFAULT 0 CHECK(online_demand_debt BETWEEN 0 AND 1),
 ADD COLUMN shop_demand_debt NUMERIC(20,12) NOT NULL DEFAULT 0 CHECK(shop_demand_debt BETWEEN 0 AND 1);
ALTER TABLE public.kq_commerce_campaigns ADD COLUMN growth_started_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE FUNCTION public.kq_commerce_capacity(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH context AS (
 SELECT c.*,CASE WHEN p.strength='merchant' THEN 2 ELSE 1 END AS multiplier,
 CASE WHEN c.reputation>=3000 THEN 2800 WHEN c.reputation>=1500 THEN 2000 WHEN c.reputation>=600 THEN 1400
 WHEN c.reputation>=200 THEN 900 WHEN c.reputation>=60 THEN 600 ELSE 400 END AS base,
 CASE WHEN c.reputation>=3000 THEN 240 WHEN c.reputation>=1500 THEN 160 WHEN c.reputation>=600 THEN 100
 WHEN c.reputation>=200 THEN 65 WHEN c.reputation>=60 THEN 40 ELSE 25 END AS max_clients
 FROM public.kq_commerce_accounts a JOIN public.kq_commerce_campaigns c ON c.run_id=a.current_run_id
 LEFT JOIN public.arena_chanvrier_profiles p ON p.user_id=a.user_id WHERE a.user_id=p_user)
 SELECT jsonb_build_object('online',multiplier*base*(1+.25*LEAST(1,clients_start::NUMERIC/max_clients)),
 'cbd-shop',multiplier*(4000+LEAST(20,GREATEST(0,shop_partners_start))*250)*CASE WHEN event='restock' THEN 1.25 WHEN event='promotion' THEN .75 ELSE 1 END)
 FROM context;
$$;

-- Preserve already consumed demand on deployment. Historical receipts stay immutable.
UPDATE public.kq_commerce_accounts a SET
 online_demand_debt=LEAST(1,c.direct_used/(public.kq_commerce_capacity(a.user_id)->>'online')::NUMERIC),
 shop_demand_debt=LEAST(1,c.shop_used/(public.kq_commerce_capacity(a.user_id)->>'cbd-shop')::NUMERIC)
 FROM public.kq_commerce_campaigns c WHERE c.run_id=a.current_run_id;

CREATE FUNCTION public.kq_commerce_refresh_period(p_user UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_commerce_accounts%ROWTYPE; c public.kq_commerce_campaigns%ROWTYPE; draw INTEGER;
BEGIN
 -- All commerce operations use this same lock order, including culture completion.
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO c FROM public.kq_commerce_campaigns WHERE run_id=a.current_run_id FOR UPDATE;
 IF c.run_id IS NULL OR c.growth_started_at+interval '24 hours'>now() THEN RETURN; END IF;
 draw:=floor(random()*100);
 UPDATE public.kq_commerce_campaigns SET
 growth_started_at=now(),reputation=(SELECT reputation FROM public.kq_equipment_wallets WHERE user_id=p_user),
 clients_start=a.clients,shop_partners_start=a.shop_partners,shop_recruitment_start=a.shop_recruitment,shop_churn_start=a.shop_churn,
 good_units=0,disappointment_units=0,shop_good_units=0,shop_bad_units=0,revision=revision+1,
 event=CASE WHEN draw<60 THEN 'normal' WHEN draw<65 THEN 'spot-flower' WHEN draw<70 THEN 'spot-hash'
 WHEN draw<75 THEN 'spot-rosin' WHEN draw<90 THEN 'promotion' ELSE 'restock' END
 WHERE run_id=c.run_id;
END $$;

CREATE FUNCTION public.kq_commerce_demand_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('serverNow',now(),'updatedAt',a.demand_updated_at,'onlineDebt',a.online_demand_debt,
 'shopDebt',a.shop_demand_debt,'growthResetsAt',c.growth_started_at+interval '24 hours')
 FROM public.kq_commerce_accounts a LEFT JOIN public.kq_commerce_campaigns c ON c.run_id=a.current_run_id WHERE a.user_id=p_user;
$$;

CREATE FUNCTION public.kq_commerce_consume_demand(p_user UUID,p_offer JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_commerce_accounts%ROWTYPE; capacity JSONB; elapsed NUMERIC; online_debt NUMERIC; shop_debt NUMERIC;
 direct_cost NUMERIC:=(p_offer->>'directCost')::NUMERIC; shop_cost NUMERIC:=(p_offer->>'shopCost')::NUMERIC;
 channel TEXT:=p_offer->>'channel';
BEGIN
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user FOR UPDATE;
 IF channel IS NULL OR channel NOT IN ('online','cbd-shop','wholesale') OR direct_cost IS NULL OR shop_cost IS NULL
 OR direct_cost<0 OR shop_cost<0 OR (channel<>'online' AND direct_cost<>0) OR (channel<>'cbd-shop' AND shop_cost<>0)
 OR (channel='online' AND direct_cost=0) OR (channel='cbd-shop' AND shop_cost=0) THEN RAISE EXCEPTION 'commerce_invalid_quote'; END IF;
 IF channel='wholesale' THEN RETURN; END IF;
 capacity:=public.kq_commerce_capacity(p_user);
 IF capacity IS NULL THEN RAISE EXCEPTION 'commerce_cycle_required'; END IF;
 elapsed:=GREATEST(0,EXTRACT(EPOCH FROM (now()-a.demand_updated_at)));
 online_debt:=GREATEST(0,a.online_demand_debt-elapsed/14400);
 shop_debt:=GREATEST(0,a.shop_demand_debt-elapsed/43200);
 -- Quotes store trusted costs. Even two concurrent offers cannot consume the same budget.
 -- Tolerance is smaller than a stock unit and only covers six-decimal ledger rounding.
 IF direct_cost>(1-online_debt)*(capacity->>'online')::NUMERIC+.000001
 OR shop_cost>(1-shop_debt)*(capacity->>'cbd-shop')::NUMERIC+.000001 THEN RAISE EXCEPTION 'commerce_demand_exhausted'; END IF;
 UPDATE public.kq_commerce_accounts SET
 online_demand_debt=LEAST(1,online_debt+direct_cost/(capacity->>'online')::NUMERIC),
 shop_demand_debt=LEAST(1,shop_debt+shop_cost/(capacity->>'cbd-shop')::NUMERIC),demand_updated_at=GREATEST(now(),a.demand_updated_at) WHERE user_id=p_user;
END $$;

-- Extend the current implementations without replacing pricing, maintenance, achievements,
-- electricity settlement, idempotency, or the cost optimizations of earlier migrations.
DO $$
DECLARE definition TEXT; old_fragment TEXT; new_fragment TEXT;
BEGIN
 SELECT pg_get_functiondef('public.kq_commerce_open_cycle(uuid,uuid)'::regprocedure) INTO definition;
 old_fragment:=' IF EXISTS(SELECT 1 FROM public.kq_commerce_campaigns WHERE run_id=p_run) THEN RETURN; END IF;';
 IF position(old_fragment in definition)=0 THEN RAISE EXCEPTION 'commerce_time_open_drift'; END IF;
 definition:=replace(definition,old_fragment,old_fragment||E'\n PERFORM public.kq_commerce_refresh_period(p_user);');
 old_fragment:=' UPDATE public.kq_commerce_accounts SET current_run_id=p_run,revision=revision+1 WHERE user_id=p_user;';
 new_fragment:=$patch$
 -- A new harvest pays its Internet subscription as before, but cannot reroll the market,
 -- reset demand, or bypass the 24-hour recruitment and churn limits.
 UPDATE public.kq_commerce_campaigns fresh SET
 growth_started_at=previous.growth_started_at,reputation=previous.reputation,event=previous.event,
 clients_start=previous.clients_start,good_units=previous.good_units,disappointment_units=previous.disappointment_units,
 shop_partners_start=previous.shop_partners_start,shop_recruitment_start=previous.shop_recruitment_start,
 shop_churn_start=previous.shop_churn_start,shop_good_units=previous.shop_good_units,shop_bad_units=previous.shop_bad_units
 FROM public.kq_commerce_campaigns previous WHERE fresh.run_id=p_run AND previous.run_id=a.current_run_id;
 UPDATE public.kq_commerce_accounts SET current_run_id=p_run,revision=revision+1 WHERE user_id=p_user;
$patch$;
 IF position(old_fragment in definition)=0 THEN RAISE EXCEPTION 'commerce_time_carry_drift'; END IF;
 EXECUTE replace(definition,old_fragment,new_fragment);

 SELECT pg_get_functiondef('public.rpc_kq_commerce_state(uuid)'::regprocedure) INTO definition;
 old_fragment:=' SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user_id;';
 IF position(old_fragment in definition)=0 THEN RAISE EXCEPTION 'commerce_time_state_drift'; END IF;
 definition:=replace(definition,old_fragment,E' PERFORM public.kq_commerce_refresh_period(p_user_id);\n'||old_fragment);
 old_fragment:='RETURN jsonb_build_object(';
 IF position(old_fragment in definition)=0 THEN RAISE EXCEPTION 'commerce_time_snapshot_drift'; END IF;
 definition:=replace(definition,old_fragment,'RETURN jsonb_build_object(''demand'',public.kq_commerce_demand_snapshot(p_user_id),');
 EXECUTE definition;

 SELECT pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure) INTO definition;
 old_fragment:='  IF channel=''cbd-shop'' THEN';
 IF position(old_fragment in definition)=0 THEN RAISE EXCEPTION 'commerce_time_command_drift'; END IF;
 definition:=replace(definition,old_fragment,E'  PERFORM public.kq_commerce_consume_demand(p_user_id,offer);\n'||old_fragment);
 EXECUTE definition;
END $$;
REVOKE ALL ON FUNCTION public.kq_commerce_capacity(UUID),public.kq_commerce_refresh_period(UUID),public.kq_commerce_demand_snapshot(UUID),public.kq_commerce_consume_demand(UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kq_commerce_capacity(UUID),public.kq_commerce_refresh_period(UUID),public.kq_commerce_demand_snapshot(UUID),public.kq_commerce_consume_demand(UUID,JSONB) TO service_role;
COMMIT;
