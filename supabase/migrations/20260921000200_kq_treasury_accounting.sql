BEGIN;

-- Prospective management accounts for the game. Debits are positive, credits
-- negative. Historical gaps are an opening position, never invented earnings.
CREATE TABLE public.kq_treasury_accounts (
 user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.kq_treasury_journal (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES public.kq_treasury_accounts(user_id) ON DELETE CASCADE,
 source_key TEXT NOT NULL, kind TEXT NOT NULL, reference TEXT NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 transaction_id BIGINT NOT NULL DEFAULT txid_current(), postings JSONB NOT NULL,
 UNIQUE(user_id,source_key), CHECK(jsonb_typeof(postings)='array')
);
CREATE INDEX kq_treasury_journal_period ON public.kq_treasury_journal(user_id,occurred_at,id);
CREATE TABLE public.kq_treasury_balances (
 user_id UUID NOT NULL REFERENCES public.kq_treasury_accounts(user_id) ON DELETE CASCADE,
 account TEXT NOT NULL, balance_cents BIGINT NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,account)
);
CREATE TABLE public.kq_treasury_assets (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES public.kq_treasury_accounts(user_id) ON DELETE CASCADE,
 source_key TEXT NOT NULL, account TEXT NOT NULL CHECK(account IN ('equipment','website','prepaid')),
 expense_account TEXT NOT NULL, equipment_code TEXT,
 cost_cents BIGINT NOT NULL CHECK(cost_cents>=0),
 recognized_cents BIGINT NOT NULL DEFAULT 0 CHECK(recognized_cents BETWEEN 0 AND cost_cents),
 starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL, recognized_at TIMESTAMPTZ NOT NULL,
 retired_at TIMESTAMPTZ, UNIQUE(user_id,source_key), CHECK(ends_at>starts_at)
);
CREATE INDEX kq_treasury_assets_live ON public.kq_treasury_assets(user_id,ends_at) WHERE retired_at IS NULL;
CREATE TABLE public.kq_treasury_pending (
 user_id UUID NOT NULL REFERENCES public.kq_treasury_accounts(user_id) ON DELETE CASCADE,
 transaction_id BIGINT NOT NULL DEFAULT txid_current(), PRIMARY KEY(user_id,transaction_id)
);
DO $$ DECLARE name TEXT; BEGIN
 FOREACH name IN ARRAY ARRAY['kq_treasury_accounts','kq_treasury_journal','kq_treasury_balances','kq_treasury_assets','kq_treasury_pending'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',name);
  EXECUTE format('GRANT SELECT ON public.%I TO service_role',name);
 END LOOP;
END $$;

CREATE FUNCTION public.kq_treasury_post(p_user UUID,p_kind TEXT,p_key TEXT,p_at TIMESTAMPTZ,p_postings JSONB,p_reference TEXT DEFAULT NULL) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE line RECORD; total NUMERIC; inserted BOOLEAN;
 allowed CONSTANT TEXT[]:=ARRAY['cash','vat_reserve','savings','equipment','website','stock','prepaid','lab_payable','energy_payable','vat_payable',
 'opening_equity','capital','suspense','revenue_online','revenue_shop','revenue_wholesale','revenue_rewards','revenue_interest',
 'expense_lab','expense_energy','expense_processing','expense_hosting','expense_advertising','expense_domiciliation','expense_maintenance','expense_depreciation','stock_variation','expense_other'];
BEGIN
 IF p_user IS NULL OR p_kind IS NULL OR p_key IS NULL OR p_at IS NULL OR jsonb_typeof(p_postings) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'treasury_invalid_entry'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_postings) value WHERE NOT COALESCE((value->>'account')=ANY(allowed),false)
  OR jsonb_typeof(value->'deltaCents') IS DISTINCT FROM 'number'
  OR (value->>'deltaCents')::NUMERIC<>trunc((value->>'deltaCents')::NUMERIC)) THEN RAISE EXCEPTION 'treasury_invalid_posting'; END IF;
 SELECT COALESCE(SUM((value->>'deltaCents')::NUMERIC),0) INTO total FROM jsonb_array_elements(p_postings) value;
 IF total<>0 THEN RAISE EXCEPTION 'treasury_unbalanced_entry'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_postings) value WHERE (value->>'deltaCents')::BIGINT<>0) THEN RETURN; END IF;
 INSERT INTO public.kq_treasury_journal(user_id,source_key,kind,reference,occurred_at,postings)
 VALUES(p_user,p_key,p_kind,COALESCE(p_reference,p_key),p_at,p_postings) ON CONFLICT(user_id,source_key) DO NOTHING;
 inserted:=FOUND;
 IF NOT inserted THEN RETURN; END IF;
 FOR line IN SELECT value->>'account' account,SUM((value->>'deltaCents')::BIGINT)::BIGINT amount FROM jsonb_array_elements(p_postings) value GROUP BY value->>'account' LOOP
  INSERT INTO public.kq_treasury_balances(user_id,account,balance_cents) VALUES(p_user,line.account,line.amount)
  ON CONFLICT(user_id,account) DO UPDATE SET balance_cents=public.kq_treasury_balances.balance_cents+EXCLUDED.balance_cents;
 END LOOP;
END $$;
CREATE FUNCTION public.kq_treasury_pair(p_user UUID,p_kind TEXT,p_key TEXT,p_at TIMESTAMPTZ,p_debit TEXT,p_credit TEXT,p_amount BIGINT,p_reference TEXT DEFAULT NULL) RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT public.kq_treasury_post(p_user,p_kind,p_key,p_at,jsonb_build_array(
 jsonb_build_object('account',p_debit,'deltaCents',p_amount),jsonb_build_object('account',p_credit,'deltaCents',-p_amount)),p_reference);
$$;

-- Actual production cost only. Every remaining lot receives its proportion of
-- the run's laboratory, electricity/care and processing costs; never retail value.
CREATE FUNCTION public.kq_treasury_stock_cost(p_user UUID) RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(SUM(ROUND((COALESCE(lab.amount_cents,0)+COALESCE(energy.total_cents,0)+COALESCE(batch.processing_cents,0))::NUMERIC *
  CASE WHEN lot.status='sold' THEN 0 WHEN batch.flower_id IS NULL THEN 1 ELSE LEAST(1,COALESCE((SELECT SUM(s.remaining_units::NUMERIC*s.equivalent_units/s.initial_units)
   FROM public.kq_commerce_stock s WHERE s.flower_id=f.id),0)/batch.original_units) END)),0)::BIGINT
 FROM public.kq_flowers f JOIN public.kq_runs run ON run.id=f.run_id AND run.status::TEXT='completed'
 LEFT JOIN public.kq_lab_invoices lab ON lab.run_id=f.run_id
 LEFT JOIN public.kq_energy_invoices energy ON energy.run_id=f.run_id
 LEFT JOIN public.kq_commerce_batches batch ON batch.flower_id=f.id
 LEFT JOIN public.kq_market_lots lot ON lot.flower_id=f.id WHERE f.owner_id=p_user;
$$;
CREATE FUNCTION public.kq_treasury_add_asset(p_user UUID,p_key TEXT,p_account TEXT,p_expense TEXT,p_cost BIGINT,p_start TIMESTAMPTZ,p_hours INTEGER,p_equipment TEXT DEFAULT NULL,p_opening BOOLEAN DEFAULT false) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE recognized BIGINT:=0; asset_id UUID; cutoff TIMESTAMPTZ; end_at TIMESTAMPTZ;
BEGIN
 IF p_cost<=0 THEN RETURN 0; END IF;
 SELECT started_at INTO cutoff FROM public.kq_treasury_accounts WHERE user_id=p_user;
 end_at:=p_start+p_hours*interval '1 hour';
 IF p_opening THEN recognized:=LEAST(p_cost,GREATEST(0,FLOOR(p_cost*EXTRACT(EPOCH FROM (cutoff-p_start))/(p_hours::NUMERIC*3600))))::BIGINT; END IF;
 INSERT INTO public.kq_treasury_assets(user_id,source_key,account,expense_account,equipment_code,cost_cents,recognized_cents,starts_at,ends_at,recognized_at)
 VALUES(p_user,p_key,p_account,p_expense,p_equipment,p_cost,recognized,p_start,end_at,CASE WHEN p_opening THEN cutoff ELSE p_start END)
 ON CONFLICT(user_id,source_key) DO NOTHING RETURNING id INTO asset_id;
 IF asset_id IS NULL THEN RETURN 0; END IF;
 IF NOT p_opening THEN PERFORM public.kq_treasury_pair(p_user,'asset-purchase',p_key,GREATEST(cutoff,p_start),p_account,'suspense',p_cost,p_equipment); END IF;
 RETURN p_cost-recognized;
END $$;

CREATE FUNCTION public.kq_treasury_initialize(p_user UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_commerce_accounts%ROWTYPE; gear RECORD; upgrade RECORD; paid RECORD; replacement RECORD;
 started TIMESTAMPTZ; acquired TIMESTAMPTZ; basis BIGINT; equipment BIGINT:=0; website BIGINT:=0; prepaid BIGINT:=0;
 cash BIGINT; saving BIGINT; reserve BIGINT; lab BIGINT; energy BIGINT; stock BIGINT; net BIGINT;
BEGIN
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 INSERT INTO public.kq_treasury_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING RETURNING started_at INTO started;
 IF started IS NULL THEN RETURN; END IF;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user;
 FOR gear IN SELECT * FROM public.kq_player_equipment WHERE user_id=p_user AND purchase_price_cents>0 LOOP
  SELECT created_at,(receipt->>'paidCents')::BIGINT amount INTO replacement FROM public.kq_culture_equipment_replacements
   WHERE user_id=p_user AND equipment_code=gear.equipment_code ORDER BY created_at DESC,request_key DESC LIMIT 1;
  basis:=COALESCE(replacement.amount,gear.purchase_price_cents); acquired:=COALESCE(replacement.created_at,gear.acquired_at,started);
  equipment:=equipment+public.kq_treasury_add_asset(p_user,'opening-equipment:'||gear.equipment_code,'equipment','expense_depreciation',basis,acquired,4320,gear.equipment_code,true);
  FOR upgrade IN SELECT * FROM public.kq_equipment_upgrade_receipts WHERE user_id=p_user AND equipment_code=gear.equipment_code AND created_at>=acquired LOOP
   equipment:=equipment+public.kq_treasury_add_asset(p_user,'opening-upgrade:'||upgrade.id,'equipment','expense_depreciation',upgrade.price_cents,upgrade.created_at,4320,gear.equipment_code,true);
  END LOOP;
 END LOOP;
 IF a.computer_owned THEN
  SELECT MIN(created_at) INTO acquired FROM public.kq_commerce_requests WHERE user_id=p_user AND action='buy-computer';
  equipment:=equipment+public.kq_treasury_add_asset(p_user,'opening-computer','equipment','expense_depreciation',45000,COALESCE(acquired,started),4320,'COMPUTER',true);
 END IF;
 IF a.shop_created_at IS NOT NULL THEN
  website:=public.kq_treasury_add_asset(p_user,'opening-website','website','expense_depreciation',100000,a.shop_created_at,1440,NULL,true);
 END IF;
 FOR paid IN SELECT * FROM public.kq_business_ledger WHERE user_id=p_user AND amount_cents>0
  AND kind IN ('shop-renewed','domicile-paid','advertising-started') AND occurred_at>started-interval '120 hours' LOOP
  prepaid:=prepaid+public.kq_treasury_add_asset(p_user,'opening-prepaid:'||paid.id,'prepaid',
   CASE paid.kind WHEN 'shop-renewed' THEN 'expense_hosting' WHEN 'domicile-paid' THEN 'expense_domiciliation' ELSE 'expense_advertising' END,
   paid.amount_cents,paid.occurred_at,CASE WHEN paid.kind<>'advertising-started' THEN 120 WHEN paid.amount_cents=6000 THEN 40 WHEN paid.amount_cents=15000 THEN 28 ELSE 20 END,NULL,true);
 END LOOP;
 SELECT COALESCE(SUM(balance_cents),0) INTO saving FROM public.arena_chanvrier_savings_deposits WHERE user_id=p_user;
 SELECT COALESCE(SUM(remaining_cents),0) INTO lab FROM public.kq_lab_invoices WHERE user_id=p_user;
 SELECT COALESCE(SUM(remaining_cents),0) INTO energy FROM public.kq_energy_invoices WHERE user_id=p_user;
 reserve:=COALESCE(a.vat_reserved_cents,0); stock:=public.kq_treasury_stock_cost(p_user);
 net:=cash+saving+equipment+website+prepaid+stock-lab-energy;
 PERFORM public.kq_treasury_post(p_user,'opening','opening',started,jsonb_build_array(
  jsonb_build_object('account','cash','deltaCents',cash),jsonb_build_object('account','savings','deltaCents',saving),
  jsonb_build_object('account','vat_reserve','deltaCents',reserve),jsonb_build_object('account','vat_payable','deltaCents',-reserve),
  jsonb_build_object('account','equipment','deltaCents',equipment),jsonb_build_object('account','website','deltaCents',website),
  jsonb_build_object('account','prepaid','deltaCents',prepaid),jsonb_build_object('account','stock','deltaCents',stock),
  jsonb_build_object('account','lab_payable','deltaCents',-lab),jsonb_build_object('account','energy_payable','deltaCents',-energy),
  jsonb_build_object('account','opening_equity','deltaCents',-net)),'Position à l’ouverture du suivi comptable');
END $$;

CREATE FUNCTION public.kq_treasury_refresh(p_user UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE asset public.kq_treasury_assets%ROWTYPE; origin TIMESTAMPTZ; cutoff TIMESTAMPTZ; boundary TIMESTAMPTZ; target TIMESTAMPTZ;
 recognized BIGINT; amount BIGINT; stock BIGINT; previous_stock BIGINT;
BEGIN
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT started_at INTO cutoff FROM public.kq_treasury_accounts WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT COALESCE(business_started_at,cutoff) INTO origin FROM public.kq_commerce_accounts WHERE user_id=p_user;
 origin:=COALESCE(origin,cutoff);
 FOR asset IN SELECT * FROM public.kq_treasury_assets WHERE user_id=p_user AND retired_at IS NULL AND recognized_cents<cost_cents AND starts_at<now() ORDER BY id FOR UPDATE LOOP
  LOOP
   EXIT WHEN asset.recognized_at>=now() OR asset.recognized_cents>=asset.cost_cents;
   boundary:=origin+(FLOOR(EXTRACT(EPOCH FROM (asset.recognized_at-origin))/432000)+1)*interval '120 hours';
   target:=LEAST(now(),asset.ends_at,boundary);
   EXIT WHEN target<=asset.recognized_at;
   recognized:=LEAST(asset.cost_cents,GREATEST(0,FLOOR(asset.cost_cents*EXTRACT(EPOCH FROM (target-asset.starts_at))/EXTRACT(EPOCH FROM (asset.ends_at-asset.starts_at)))))::BIGINT;
   amount:=recognized-asset.recognized_cents;
   IF amount>0 THEN
    PERFORM public.kq_treasury_pair(p_user,CASE WHEN asset.account='prepaid' THEN 'prepaid-expense' ELSE 'depreciation' END,
     'recognition:'||asset.id||':'||target::TEXT,GREATEST(cutoff,target-interval '1 microsecond'),asset.expense_account,asset.account,amount,asset.equipment_code);
   END IF;
   UPDATE public.kq_treasury_assets SET recognized_cents=recognized,recognized_at=target WHERE id=asset.id;
   asset.recognized_cents:=recognized; asset.recognized_at:=target;
  END LOOP;
 END LOOP;
 stock:=public.kq_treasury_stock_cost(p_user);
 SELECT COALESCE((SELECT balance_cents FROM public.kq_treasury_balances WHERE user_id=p_user AND account='stock'),0) INTO previous_stock;
 IF stock<>previous_stock THEN
  PERFORM public.kq_treasury_pair(p_user,'stock-valuation','stock:'||gen_random_uuid(),now(),'stock','stock_variation',stock-previous_stock,'Stock au coût de production tracé');
 END IF;
END $$;
CREATE FUNCTION public.kq_treasury_queue(p_user UUID) RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 INSERT INTO public.kq_treasury_pending(user_id) SELECT p_user WHERE EXISTS(SELECT 1 FROM public.kq_treasury_accounts WHERE user_id=p_user) ON CONFLICT DO NOTHING;
$$;
CREATE FUNCTION public.kq_treasury_flush() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.kq_treasury_pending WHERE user_id=NEW.user_id AND transaction_id=NEW.transaction_id) THEN
  PERFORM public.kq_treasury_refresh(NEW.user_id);
  DELETE FROM public.kq_treasury_pending WHERE user_id=NEW.user_id AND transaction_id=NEW.transaction_id;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER kq_treasury_flush AFTER INSERT ON public.kq_treasury_pending DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.kq_treasury_flush();

CREATE FUNCTION public.kq_treasury_observe() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_row JSONB:=CASE WHEN TG_OP='DELETE' THEN '{}'::JSONB ELSE to_jsonb(NEW) END;
 previous_row JSONB:=CASE WHEN TG_OP='INSERT' THEN '{}'::JSONB ELSE to_jsonb(OLD) END;
 data JSONB; owner UUID; old_owner UUID; source TEXT; at TIMESTAMPTZ; amount BIGINT; delta BIGINT; total_delta BIGINT; debt_delta BIGINT;
 account_name TEXT; expense_name TEXT; code TEXT; asset RECORD; cost BIGINT; ignored BIGINT;
BEGIN
 data:=CASE WHEN TG_OP='DELETE' THEN previous_row ELSE current_row END;
 owner:=COALESCE(data->>'user_id',data->>'owner_id')::UUID;
 IF owner IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=owner) THEN RETURN NULL; END IF;
 IF TG_TABLE_NAME='kq_equipment_wallets' AND TG_OP='INSERT' THEN
  PERFORM public.kq_treasury_initialize(owner);
  RETURN NULL;
 END IF;
 old_owner:=COALESCE(previous_row->>'user_id',previous_row->>'owner_id')::UUID;
 IF NOT EXISTS(SELECT 1 FROM public.kq_treasury_accounts WHERE user_id=owner) THEN
  IF old_owner IS NOT NULL AND old_owner<>owner THEN
   PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=old_owner FOR UPDATE;
   PERFORM public.kq_treasury_queue(old_owner);
  END IF;
  RETURN NULL;
 END IF;
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id IN (owner,old_owner) ORDER BY user_id FOR UPDATE;
 source:=TG_TABLE_NAME||':'||COALESCE(data->>'id',data->>'request_key',data->>'run_id',gen_random_uuid()::TEXT);
 at:=COALESCE((data->>'occurred_at')::TIMESTAMPTZ,(data->>'created_at')::TIMESTAMPTZ,(data->>'granted_at')::TIMESTAMPTZ,now());
 at:=GREATEST(at,(SELECT started_at FROM public.kq_treasury_accounts WHERE user_id=owner));
 CASE TG_TABLE_NAME
 WHEN 'kq_equipment_wallets' THEN
  delta:=COALESCE((current_row->>'cash_cents')::BIGINT,0)-COALESCE((previous_row->>'cash_cents')::BIGINT,0);
  PERFORM public.kq_treasury_pair(owner,'cash-movement','cash:'||gen_random_uuid(),now(),'cash','suspense',delta,'Mouvement du portefeuille');
 WHEN 'kq_commerce_accounts' THEN
  delta:=COALESCE((current_row->>'vat_reserved_cents')::BIGINT,0)-COALESCE((previous_row->>'vat_reserved_cents')::BIGINT,0);
  PERFORM public.kq_treasury_pair(owner,'vat-reserve','vat-reserve:'||gen_random_uuid(),now(),'vat_reserve','suspense',delta,'Réserve de TVA');
 WHEN 'arena_chanvrier_savings_deposits' THEN
  delta:=COALESCE((current_row->>'balance_cents')::BIGINT,0)-COALESCE((previous_row->>'balance_cents')::BIGINT,0);
  PERFORM public.kq_treasury_pair(owner,'savings-movement','savings:'||gen_random_uuid(),now(),'savings','suspense',delta,'Mouvement de l’épargne');
  IF TG_OP='UPDATE' AND delta>0 AND current_row->>'credited_at' IS DISTINCT FROM previous_row->>'credited_at' THEN
   PERFORM public.kq_treasury_pair(owner,'savings-interest','interest:'||gen_random_uuid(),now(),'suspense','revenue_interest',delta,'Intérêts crédités');
  END IF;
 WHEN 'kq_market_sale_receipts' THEN
  IF TG_OP='INSERT' THEN
   amount:=(data->>'payout_cents')::BIGINT; delta:=COALESCE((data->>'vat_cents')::BIGINT,0);
   account_name:=CASE data->>'sales_channel' WHEN 'online' THEN 'revenue_online' WHEN 'cbd-shop' THEN 'revenue_shop' ELSE 'revenue_wholesale' END;
   PERFORM public.kq_treasury_post(owner,'sale',source,at,jsonb_build_array(
    jsonb_build_object('account','suspense','deltaCents',amount),jsonb_build_object('account',account_name,'deltaCents',-(amount-delta)),
    jsonb_build_object('account','vat_payable','deltaCents',-delta)),data->>'flower_id');
  END IF;
 WHEN 'kq_lab_invoices','kq_energy_invoices' THEN
  account_name:=CASE TG_TABLE_NAME WHEN 'kq_lab_invoices' THEN 'lab_payable' ELSE 'energy_payable' END;
  expense_name:=CASE TG_TABLE_NAME WHEN 'kq_lab_invoices' THEN 'expense_lab' ELSE 'expense_energy' END;
  debt_delta:=COALESCE((current_row->>'remaining_cents')::BIGINT,0)-COALESCE((previous_row->>'remaining_cents')::BIGINT,0);
  IF TG_OP='DELETE' THEN total_delta:=-COALESCE((previous_row->>'remaining_cents')::BIGINT,0);
  ELSE total_delta:=COALESCE((current_row->>'amount_cents')::BIGINT,(current_row->>'total_cents')::BIGINT,0)-COALESCE((previous_row->>'amount_cents')::BIGINT,(previous_row->>'total_cents')::BIGINT,0); END IF;
  IF total_delta<>0 OR debt_delta<>0 THEN
   PERFORM public.kq_treasury_post(owner,CASE WHEN TG_OP='INSERT' THEN 'invoice-issued' ELSE 'invoice-payment' END,source||':'||gen_random_uuid(),now(),jsonb_build_array(
    jsonb_build_object('account',expense_name,'deltaCents',total_delta),jsonb_build_object('account',account_name,'deltaCents',-debt_delta),
    jsonb_build_object('account','suspense','deltaCents',debt_delta-total_delta)),data->>'run_id');
  END IF;
 WHEN 'kq_commerce_batches' THEN
  IF TG_OP='INSERT' THEN PERFORM public.kq_treasury_pair(owner,'processing',source,at,'expense_processing','suspense',(data->>'processing_cents')::BIGINT,data->>'flower_id'); END IF;
 WHEN 'kq_commerce_requests' THEN
  IF TG_OP='INSERT' AND data->>'action'='buy-computer' THEN
   ignored:=public.kq_treasury_add_asset(owner,source,'equipment','expense_depreciation',(data->'receipt'->>'paidCents')::BIGINT,at,4320,'COMPUTER');
  END IF;
 WHEN 'kq_equipment_purchase_receipts' THEN
  IF TG_OP='INSERT' THEN
   FOR code IN SELECT jsonb_array_elements_text(data->'equipment_codes') LOOP
    SELECT purchase_price_cents INTO cost FROM public.kq_player_equipment WHERE user_id=owner AND equipment_code=code;
    IF cost IS NOT NULL THEN ignored:=public.kq_treasury_add_asset(owner,source||':'||code,'equipment','expense_depreciation',cost,at,4320,code); END IF;
   END LOOP;
  END IF;
 WHEN 'kq_equipment_upgrade_receipts' THEN
  IF TG_OP='INSERT' THEN ignored:=public.kq_treasury_add_asset(owner,source,'equipment','expense_depreciation',(data->>'price_cents')::BIGINT,at,4320,data->>'equipment_code'); END IF;
 WHEN 'kq_machine_repairs' THEN
  IF TG_OP='INSERT' THEN PERFORM public.kq_treasury_pair(owner,'maintenance',source,at,'expense_maintenance','suspense',(data->'receipt'->>'paidCents')::BIGINT,data->>'equipment_code'); END IF;
 WHEN 'kq_culture_equipment_replacements' THEN
  IF TG_OP='INSERT' THEN
   PERFORM public.kq_treasury_refresh(owner);
   FOR asset IN SELECT * FROM public.kq_treasury_assets WHERE user_id=owner AND equipment_code=data->>'equipment_code' AND retired_at IS NULL FOR UPDATE LOOP
    PERFORM public.kq_treasury_pair(owner,'asset-disposal','disposal:'||asset.id,at,'expense_other',asset.account,asset.cost_cents-asset.recognized_cents,asset.equipment_code);
    UPDATE public.kq_treasury_assets SET retired_at=at WHERE id=asset.id;
   END LOOP;
   ignored:=public.kq_treasury_add_asset(owner,source,'equipment','expense_depreciation',(data->'receipt'->>'paidCents')::BIGINT,at,4320,data->>'equipment_code');
  END IF;
 WHEN 'kq_business_ledger' THEN
  IF TG_OP='INSERT' THEN
   amount:=(data->>'amount_cents')::BIGINT;
   CASE data->>'kind'
    WHEN 'shop-created' THEN ignored:=public.kq_treasury_add_asset(owner,source,'website','expense_depreciation',amount,at,1440);
    WHEN 'shop-renewed' THEN ignored:=public.kq_treasury_add_asset(owner,source,'prepaid','expense_hosting',amount,(data->>'occurred_at')::TIMESTAMPTZ,120);
    WHEN 'domicile-paid' THEN ignored:=public.kq_treasury_add_asset(owner,source,'prepaid','expense_domiciliation',amount,(data->>'occurred_at')::TIMESTAMPTZ,120);
    WHEN 'advertising-started' THEN ignored:=public.kq_treasury_add_asset(owner,source,'prepaid','expense_advertising',amount,(data->>'occurred_at')::TIMESTAMPTZ,CASE amount WHEN 6000 THEN 40 WHEN 15000 THEN 28 ELSE 20 END);
    WHEN 'vat-paid' THEN PERFORM public.kq_treasury_pair(owner,'vat-remittance',source,at,'vat_payable','suspense',amount,'Reversement de TVA');
    ELSE NULL;
   END CASE;
  END IF;
 WHEN 'kq_pioneer_pack_grants' THEN
  IF TG_OP='INSERT' THEN PERFORM public.kq_treasury_pair(owner,'reward',source,at,'suspense','revenue_rewards',(data->>'cash_cents')::BIGINT,'Pack des Pionniers'); END IF;
 ELSE NULL;
 END CASE;
 PERFORM public.kq_treasury_queue(owner);
 IF old_owner IS NOT NULL AND old_owner<>owner THEN PERFORM public.kq_treasury_queue(old_owner); END IF;
 RETURN NULL;
END $$;

-- Snapshot every existing account before installing observers. This does not
-- replay receipts, credit savings interest, charge old bills or alter game cash.
-- Block concurrent financial writers during the opening snapshot and trigger switch.
LOCK TABLE public.kq_equipment_wallets,public.kq_commerce_accounts,public.arena_chanvrier_savings_deposits,
 public.kq_lab_invoices,public.kq_energy_invoices,public.kq_player_equipment,public.kq_flowers,
 public.kq_market_lots,public.kq_commerce_stock,public.kq_commerce_batches IN SHARE ROW EXCLUSIVE MODE;
DO $$ DECLARE owner UUID; BEGIN
 FOR owner IN SELECT user_id FROM public.kq_equipment_wallets ORDER BY user_id LOOP PERFORM public.kq_treasury_initialize(owner); END LOOP;
END $$;

CREATE TRIGGER kq_treasury_wallet AFTER INSERT OR UPDATE OF cash_cents ON public.kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION public.kq_treasury_observe();
CREATE TRIGGER kq_treasury_vat AFTER INSERT OR UPDATE OF vat_reserved_cents ON public.kq_commerce_accounts FOR EACH ROW EXECUTE FUNCTION public.kq_treasury_observe();
CREATE TRIGGER kq_treasury_savings AFTER INSERT OR UPDATE OF balance_cents OR DELETE ON public.arena_chanvrier_savings_deposits FOR EACH ROW EXECUTE FUNCTION public.kq_treasury_observe();
CREATE TRIGGER kq_treasury_lab AFTER INSERT OR UPDATE OF remaining_cents,amount_cents OR DELETE ON public.kq_lab_invoices FOR EACH ROW EXECUTE FUNCTION public.kq_treasury_observe();
CREATE TRIGGER kq_treasury_energy AFTER INSERT OR UPDATE OF remaining_cents,total_cents OR DELETE ON public.kq_energy_invoices FOR EACH ROW EXECUTE FUNCTION public.kq_treasury_observe();
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['kq_market_sale_receipts','kq_commerce_requests','kq_equipment_purchase_receipts','kq_equipment_upgrade_receipts','kq_machine_repairs','kq_culture_equipment_replacements','kq_business_ledger','kq_pioneer_pack_grants'] LOOP
  EXECUTE format('CREATE TRIGGER kq_treasury_source AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.kq_treasury_observe()',table_name);
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['kq_commerce_batches','kq_commerce_stock','kq_market_lots','kq_flowers'] LOOP
  EXECUTE format('CREATE TRIGGER kq_treasury_stock AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.kq_treasury_observe()',table_name);
 END LOOP;
END $$;

-- The treasurer's grant has no dedicated receipt. Record the exact authoritative
-- variable inside its existing one-time grant branch, never infer a historical bonus.
DO $$ DECLARE definition TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.rpc_arena_save_chanvrier(uuid,jsonb)'::regprocedure) INTO definition;
 fragment:='UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+bonus,updated_at=now() WHERE user_id=p_user_id;';
 IF position(fragment in definition)=0 THEN RAISE EXCEPTION 'treasury_capital_function_drift'; END IF;
 definition:=replace(definition,fragment,fragment||E'\n  PERFORM public.kq_treasury_pair(p_user_id,''capital-grant'',''treasurer-capital'',now(),''suspense'',''capital'',bonus,''Capital de départ du Trésorier'');');
 EXECUTE definition;
END $$;

CREATE FUNCTION public.kq_treasury_balances_at(p_user UUID,p_at TIMESTAMPTZ,p_inclusive BOOLEAN) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH names(account) AS (SELECT unnest(ARRAY['cash','vat_reserve','savings','equipment','website','stock','prepaid','lab_payable','energy_payable','vat_payable',
 'opening_equity','capital','suspense','revenue_online','revenue_shop','revenue_wholesale','revenue_rewards','revenue_interest',
 'expense_lab','expense_energy','expense_processing','expense_hosting','expense_advertising','expense_domiciliation','expense_maintenance','expense_depreciation','stock_variation','expense_other'])),
 later AS (SELECT line->>'account' account,SUM((line->>'deltaCents')::BIGINT)::BIGINT balance FROM public.kq_treasury_journal j
  CROSS JOIN LATERAL jsonb_array_elements(j.postings) line WHERE j.user_id=p_user AND j.kind<>'opening'
   AND (j.occurred_at>p_at OR (NOT p_inclusive AND j.occurred_at=p_at)) GROUP BY line->>'account')
 SELECT jsonb_object_agg(names.account,COALESCE(current.balance_cents,0)-COALESCE(later.balance,0))
 FROM names LEFT JOIN public.kq_treasury_balances current ON current.user_id=p_user AND current.account=names.account LEFT JOIN later ON later.account=names.account;
$$;
CREATE FUNCTION public.rpc_kq_treasury_snapshot(p_user_id UUID,p_period TEXT DEFAULT 'current',p_offset INTEGER DEFAULT 0,p_limit INTEGER DEFAULT 25) RETURNS JSONB
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
  'vatDebtCents',a.vat_reserved_cents) INTO checks FROM public.kq_equipment_wallets w JOIN public.kq_commerce_accounts a USING(user_id) WHERE w.user_id=p_user_id;
 RETURN jsonb_build_object('version',1,'serverNow',now(),'startedAt',started,'businessStartedAt',origin,
  'period',jsonb_build_object('key',p_period,'from',period_from,'to',period_to),'openingBalances',opening,'closingBalances',closing,
  'series',series,'journal',jsonb_build_object('items',items,'total',total,'offset',p_offset,'limit',p_limit),'checks',checks,'unclassified',unclassified);
END $$;

-- No client can forge accounting events, asset schedules or opening positions.
DO $$ DECLARE routine RECORD; BEGIN
 FOR routine IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND (p.proname LIKE 'kq_treasury_%' OR p.proname='rpc_kq_treasury_snapshot') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',routine.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.rpc_kq_treasury_snapshot(UUID,TEXT,INTEGER,INTEGER) TO service_role;
COMMIT;
