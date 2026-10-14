BEGIN;

-- Source plans are private and server-computed. A start freezes the exact paid
-- layout revision under the same wallet lock as purchases and sales.
CREATE FUNCTION public.kq_validate_warehouse_run_start(p_user UUID,p_run UUID,p_state JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE layout public.kq_warehouse_layouts%ROWTYPE; warehouse JSONB:=p_state->'warehouse';
 cash INTEGER; consumables INTEGER; potential NUMERIC; available_stock NUMERIC; pending NUMERIC; drying NUMERIC;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO layout FROM public.kq_warehouse_layouts WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND OR warehouse->>'version' IS DISTINCT FROM '1'
  OR warehouse->'sourceState' IS DISTINCT FROM layout.state
  OR warehouse->'revision' IS DISTINCT FROM to_jsonb(layout.revision)
  OR warehouse->'zones' IS DISTINCT FROM layout.state->'zones'
  OR p_state->'equipment' IS DISTINCT FROM '{"codes":[],"levels":{},"quantityPercent":0,"qualityMaxBonus":0,"regularityPercent":0,"pressureDelta":0,"powerWatts":0,"energyDiscountPercent":0,"processingPrecision":0,"processingCapacityPercent":0,"unlocks":[]}'::JSONB
  OR p_state->'energy'->>'version' IS DISTINCT FROM '1' OR p_state->'energy'->>'mode' IS DISTINCT FROM 'balanced'
  OR p_state->'energy'->'totalCents' IS DISTINCT FROM warehouse->'energyCostCents'
 THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 IF EXISTS(SELECT 1 FROM (VALUES('activeAreaM2'),('estimatedHarvestGrams'),('energyCostCents'),('consumablesCostCents'),('operatingCostCents'),('dryingCapacityGrams'),('storageCapacityGrams')) f(code)
  WHERE jsonb_typeof(warehouse->code) IS DISTINCT FROM 'number' OR (warehouse->>code)::NUMERIC<0)
  OR (warehouse->>'activeAreaM2')::NUMERIC NOT BETWEEN 1 AND 1000
  OR (warehouse->>'estimatedHarvestGrams')::NUMERIC NOT BETWEEN 0.1 AND 250000
  OR (warehouse->>'operatingCostCents')::NUMERIC<>(warehouse->>'energyCostCents')::NUMERIC+(warehouse->>'consumablesCostCents')::NUMERIC
 THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 potential:=(warehouse->>'estimatedHarvestGrams')::NUMERIC;
 -- Lots awaiting their verdict already occupy future room capacity.
 SELECT COALESCE(sum((r.state->>'harvestGrams')::NUMERIC),0) INTO pending
 FROM public.kq_flowers f JOIN public.kq_runs r ON r.id=f.run_id
 WHERE f.owner_id=p_user AND f.status::TEXT<>'burned';
 SELECT COALESCE(sum((s.state->'capacity'->>'totalUnits')::NUMERIC/10),0) INTO drying
 FROM public.kq_storage_lots s WHERE s.user_id=p_user AND (s.state->>'readyAt')::TIMESTAMPTZ>now();
 SELECT COALESCE(sum(c.quantity*(public.kq_storage_container(c.container_code)->>'capacityUnits')::NUMERIC),0)/10
  -COALESCE((SELECT sum((a->>'quantity')::NUMERIC*(public.kq_storage_container(a->>'containerCode')->>'capacityUnits')::NUMERIC)/10
    FROM public.kq_storage_lots s,LATERAL jsonb_array_elements(s.state->'capacity'->'allocations') a WHERE s.user_id=p_user),0)
 INTO available_stock FROM public.kq_storage_containers c WHERE c.user_id=p_user;
 available_stock:=LEAST(available_stock,
  (SELECT COALESCE(sum(c.quantity*(public.kq_storage_container(c.container_code)->>'capacityUnits')::NUMERIC),0)/10
   FROM public.kq_storage_containers c WHERE c.user_id=p_user)-public.kq_warehouse_stock_units(p_user)/10);
 IF potential+pending>available_stock OR potential+pending+drying>(warehouse->>'dryingCapacityGrams')::NUMERIC
 THEN RAISE EXCEPTION 'warehouse_capacity'; END IF;
 consumables:=(warehouse->>'consumablesCostCents')::INTEGER;
 IF consumables>cash THEN RAISE EXCEPTION 'warehouse_consumables_cash'; END IF;
 IF consumables>0 THEN
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-consumables,updated_at=now() WHERE user_id=p_user;
  PERFORM public.kq_treasury_pair(p_user,'warehouse-consumables','warehouse-consumables:'||p_run::TEXT,now(),'expense_other','suspense',consumables,p_run::TEXT);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.kq_validate_warehouse_run_start(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_guard_warehouse_run_snapshot() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.state->'warehouse' IS DISTINCT FROM OLD.state->'warehouse' THEN RAISE EXCEPTION 'warehouse_snapshot_immutable'; END IF;
 IF NEW.state ? 'warehouse' AND NEW.state ? 'harvestGrams' AND
  (jsonb_typeof(NEW.state->'harvestGrams') IS DISTINCT FROM 'number'
   OR (NEW.state->>'harvestGrams')::NUMERIC<0
   OR (NEW.state->>'harvestGrams')::NUMERIC>(NEW.state->'warehouse'->>'estimatedHarvestGrams')::NUMERIC)
 THEN RAISE EXCEPTION 'warehouse_harvest_invalid'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_guard_warehouse_run_snapshot() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_guard_warehouse_run_snapshot BEFORE UPDATE OF state ON public.kq_runs
 FOR EACH ROW EXECUTE FUNCTION public.kq_guard_warehouse_run_snapshot();

DO $$ DECLARE body TEXT; anchor INTEGER; BEGIN
 SELECT pg_get_functiondef('public.kq_guard_culture_equipment_start()'::regprocedure) INTO body;
 body:=replace(body,chr(13),''); anchor:=strpos(body,E'\nBEGIN\n');
 IF anchor=0 THEN RAISE EXCEPTION 'warehouse_start_guard_anchor_changed'; END IF;
 body:=overlay(body placing E'\nBEGIN\n IF NEW.state ? ''warehouse'' THEN\n  PERFORM public.kq_validate_warehouse_run_start(NEW.user_id,NEW.id,NEW.state);\n  RETURN NEW;\n END IF;\n IF EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=NEW.user_id) THEN RAISE EXCEPTION ''warehouse_layout_changed''; END IF;\n' from anchor for 7);
 EXECUTE body;
 -- The purchased dog's old ownership must not add a charge to the new room.
 SELECT pg_get_functiondef('public.kq_invoice_completed_cycle()'::regprocedure) INTO body;
 IF strpos(body,'IF NEW.status::TEXT <> ''completed'' OR OLD.status::TEXT = ''completed'' THEN RETURN NEW; END IF;')=0 THEN RAISE EXCEPTION 'warehouse_energy_status_anchor_changed'; END IF;
 body:=replace(body,'IF NEW.status::TEXT <> ''completed'' OR OLD.status::TEXT = ''completed'' THEN RETURN NEW; END IF;',
  'IF (NEW.status::TEXT <> ''completed'' AND NOT(NEW.state ? ''warehouse'' AND NEW.status::TEXT=''abandoned'' AND NEW.state->>''cultureDead''=''true'')) OR OLD.status::TEXT IN (''completed'',''abandoned'') THEN RETURN NEW; END IF;');
 IF strpos(body,'v_quote := NEW.state->''energy'';')=0 THEN RAISE EXCEPTION 'warehouse_energy_anchor_changed'; END IF;
 body:=replace(body,'v_quote := NEW.state->''energy'';',E'IF NEW.state ? ''warehouse'' THEN v_dogs:=0; END IF;\n  v_quote := NEW.state->''energy'';');
 EXECUTE body;
 SELECT pg_get_functiondef('public.kq_wear_culture_equipment_on_completion()'::regprocedure) INTO body;
 body:=replace(body,chr(13),''); anchor:=strpos(body,E'\nBEGIN\n');
 IF anchor=0 THEN RAISE EXCEPTION 'warehouse_wear_anchor_changed'; END IF;
 body:=overlay(body placing E'\nBEGIN\n IF NEW.state ? ''warehouse'' THEN RETURN NEW; END IF;\n' from anchor for 7); EXECUTE body;
END $$;

-- Packs add six real inventory entries once; existing containers are retained.
ALTER TABLE public.kq_storage_containers DROP CONSTRAINT kq_storage_containers_quantity_check;
ALTER TABLE public.kq_storage_containers ADD CONSTRAINT kq_storage_containers_quantity_check CHECK(quantity BETWEEN 1 AND 700000);
CREATE FUNCTION public.kq_warehouse_sync_containers() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous INTEGER:=0; current_count INTEGER; added INTEGER;
BEGIN
 IF TG_OP='UPDATE' THEN SELECT COALESCE(sum((e->>'quantity')::INTEGER),0) INTO previous
  FROM jsonb_array_elements(OLD.state->'equipment') e WHERE e->>'code'='LP-SUPER-1L'; END IF;
 SELECT COALESCE(sum((e->>'quantity')::INTEGER),0) INTO current_count
  FROM jsonb_array_elements(NEW.state->'equipment') e WHERE e->>'code'='LP-SUPER-1L';
 IF current_count<previous THEN RAISE EXCEPTION 'warehouse_storage_cannot_disappear'; END IF;
 added:=(current_count-previous)*6;
 IF added>0 THEN
  PERFORM public.kq_storage_initialize(NEW.user_id);
  INSERT INTO public.kq_storage_containers(user_id,container_code,quantity) VALUES(NEW.user_id,'GLASS-1L',added)
   ON CONFLICT(user_id,container_code) DO UPDATE SET quantity=kq_storage_containers.quantity+EXCLUDED.quantity;
  PERFORM public.kq_storage_fill_user(NEW.user_id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_sync_containers() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_warehouse_sync_containers AFTER INSERT OR UPDATE OF state ON public.kq_warehouse_layouts
 FOR EACH ROW EXECUTE FUNCTION public.kq_warehouse_sync_containers();

-- The former four-kilogram limit was the eight-tent ceiling, not a stock rule.
ALTER TABLE public.kq_market_lots ALTER COLUMN harvest_grams TYPE NUMERIC(9,1);
ALTER TABLE public.kq_market_lots DROP CONSTRAINT kq_market_lots_harvest_grams_check;
ALTER TABLE public.kq_market_lots ADD CONSTRAINT kq_market_lots_harvest_grams_check CHECK(harvest_grams BETWEEN 0 AND 1000000);
DO $$ DECLARE body TEXT; BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_prepare_market_lot(uuid,uuid,numeric,numeric,text,text[],jsonb)'::regprocedure) INTO body;
 IF strpos(body,'p_harvest_grams NOT BETWEEN 0.1 AND 4000')=0 THEN RAISE EXCEPTION 'warehouse_market_ceiling_anchor_changed'; END IF;
 EXECUTE replace(body,'p_harvest_grams NOT BETWEEN 0.1 AND 4000','p_harvest_grams NOT BETWEEN 0.1 AND 1000000');
END $$;

CREATE FUNCTION public.kq_warehouse_processing_codes(p_user UUID) RETURNS TEXT[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT array_agg(code ORDER BY code) FROM (
  SELECT 'TENT-080-STARTER' AS code UNION
  SELECT CASE e->>'code' WHEN 'GV-GP50-7' THEN 'PRESS-0600' WHEN 'GV-WASHER-36L' THEN 'WASHER-25L' END
  FROM public.kq_warehouse_layouts l,LATERAL jsonb_array_elements(l.state->'equipment') e
  WHERE l.user_id=p_user AND (e->>'quantity')::INTEGER>0 AND e->>'code' IN ('GV-GP50-7','GV-WASHER-36L')
 ) devices;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_processing_codes(UUID) FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.kq_commerce_batches ADD COLUMN processing_started_at TIMESTAMPTZ,
 ADD COLUMN processing_ready_at TIMESTAMPTZ;
CREATE INDEX kq_warehouse_processing_queue ON public.kq_commerce_batches(user_id,processing_ready_at) WHERE processing_ready_at IS NOT NULL;
-- Reuse the existing storage maturity deadline. The workshop has no separate
-- drying timer, and raw flower sales remain an independent route.
CREATE FUNCTION public.kq_assert_warehouse_processing_ready(p_user UUID,p_flower UUID,p_route TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE storage public.kq_storage_lots%ROWTYPE;
BEGIN
 IF p_route IN ('raw','biomass') OR NOT EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=p_user) THEN RETURN; END IF;
 SELECT * INTO storage FROM public.kq_storage_lots WHERE flower_id=p_flower AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR storage.state->>'readyAt' IS NULL OR (storage.state->>'readyAt')::TIMESTAMPTZ>now()
 THEN RAISE EXCEPTION 'warehouse_drying_required'; END IF;
 IF jsonb_typeof(storage.state->'capacity') IS DISTINCT FROM 'object'
  OR (storage.state->'capacity'->>'totalUnits')::NUMERIC>COALESCE((SELECT sum((a->>'storedUnits')::NUMERIC)
    FROM jsonb_array_elements(storage.state->'capacity'->'allocations') a),0)
 THEN RAISE EXCEPTION 'commerce_storage_overflow'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.kq_assert_warehouse_processing_ready(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_warehouse_queue_processing() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE layout public.kq_warehouse_layouts%ROWTYPE; lot public.kq_market_lots%ROWTYPE; quote JSONB; seconds INTEGER;
BEGIN
 SELECT * INTO layout FROM public.kq_warehouse_layouts WHERE user_id=NEW.user_id;
 IF NOT FOUND OR NEW.route IN ('raw','biomass') THEN RETURN NEW; END IF;
 PERFORM public.kq_assert_warehouse_processing_ready(NEW.user_id,NEW.flower_id,NEW.route);
 SELECT * INTO lot FROM public.kq_market_lots WHERE flower_id=NEW.flower_id;
 SELECT q INTO quote FROM jsonb_array_elements(lot.options) q WHERE q->>'route'=NEW.route;
 IF quote->'warehouseRevision' IS DISTINCT FROM to_jsonb(layout.revision)
  OR quote->'warehouseState' IS DISTINCT FROM layout.state
  OR lot.equipment_codes IS DISTINCT FROM public.kq_warehouse_processing_codes(NEW.user_id)
 THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
 seconds:=(quote->>'processingDurationSeconds')::INTEGER;
 IF seconds IS NULL OR seconds NOT BETWEEN 1 AND 45000000 THEN RAISE EXCEPTION 'commerce_route_unavailable'; END IF;
 NEW.processing_started_at:=GREATEST(now(),COALESCE((SELECT max(processing_ready_at) FROM public.kq_commerce_batches
  WHERE user_id=NEW.user_id AND CASE WHEN NEW.route LIKE 'rosin-%' THEN route LIKE 'rosin-%' ELSE route=NEW.route END),now()));
 NEW.processing_ready_at:=NEW.processing_started_at+seconds*interval '1 second';
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_queue_processing() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_warehouse_queue_processing BEFORE INSERT ON public.kq_commerce_batches
 FOR EACH ROW EXECUTE FUNCTION public.kq_warehouse_queue_processing();

-- Commercial demand is shared by the account, never reset by a culture or a lot.
CREATE TABLE public.kq_warehouse_wholesale_sales (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_key UUID NOT NULL,
 equivalent_units NUMERIC(24,6) NOT NULL CHECK(equivalent_units>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_key)
);
ALTER TABLE public.kq_warehouse_wholesale_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_warehouse_wholesale_sales FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX kq_warehouse_wholesale_window ON public.kq_warehouse_wholesale_sales(user_id,created_at);
CREATE FUNCTION public.kq_warehouse_wholesale_budget(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('capacityEquivalentUnits',10000+LEAST(20,GREATEST(0,COALESCE(a.shop_partners,0)))*2500,
  'remainingEquivalentUnits',GREATEST(0,10000+LEAST(20,GREATEST(0,COALESCE(a.shop_partners,0)))*2500-COALESCE(sum(s.equivalent_units),0)),
  'resetsAt',min(s.created_at)+interval '24 hours')
 FROM public.kq_commerce_accounts a LEFT JOIN public.kq_warehouse_wholesale_sales s ON s.user_id=a.user_id AND s.created_at>now()-interval '24 hours'
 WHERE a.user_id=p_user GROUP BY a.shop_partners;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_wholesale_budget(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_warehouse_consume_wholesale(p_user UUID,p_key UUID,p_units NUMERIC) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=p_user) THEN RETURN; END IF;
 IF p_units IS NULL OR p_units<=0 OR p_units>(public.kq_warehouse_wholesale_budget(p_user)->>'remainingEquivalentUnits')::NUMERIC
 THEN RAISE EXCEPTION 'warehouse_wholesale_exhausted'; END IF;
 INSERT INTO public.kq_warehouse_wholesale_sales(user_id,request_key,equivalent_units) VALUES(p_user,p_key,p_units);
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_consume_wholesale(UUID,UUID,NUMERIC) FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE body TEXT; fragment TEXT; anchor INTEGER; BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure) INTO body;
 fragment:='SELECT value INTO opt FROM jsonb_array_elements(l.options) WHERE value->>''route''=route_code;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'warehouse_processing_ready_anchor_changed'; END IF;
 body:=replace(body,fragment,'PERFORM public.kq_assert_warehouse_processing_ready(p_user_id,fid,route_code);'||E'\n '||fragment);
 fragment:='(SELECT COALESCE(array_agg(DISTINCT equipment_code ORDER BY equipment_code),ARRAY[]::TEXT[]) FROM public.kq_equipment_loadouts WHERE user_id=p_user_id)';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'warehouse_workshop_comparison_anchor_changed'; END IF;
 body:=replace(body,fragment,'(CASE WHEN EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=p_user_id) THEN public.kq_warehouse_processing_codes(p_user_id) ELSE '||fragment||' END)');
 fragment:='offer:=q.offer; units:=(offer->>''units'')::INTEGER; channel:=offer->>''channel''; payout:=(offer->>''payoutCents'')::INTEGER;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'warehouse_sale_anchor_changed'; END IF;
 body:=replace(body,fragment,fragment||E'\n IF b.processing_ready_at>now() AND s.route=b.route THEN RAISE EXCEPTION ''warehouse_processing_pending''; END IF;\n IF channel=''wholesale'' THEN PERFORM public.kq_warehouse_consume_wholesale(p_user_id,p_request_key,round(units::NUMERIC*s.equivalent_units/s.initial_units,6)); END IF;');
 EXECUTE body;
 -- Physical machines have no historical levels or old wear to charge.
 SELECT pg_get_functiondef('public.kq_assert_processing_maintenance(uuid,text)'::regprocedure) INTO body;
 body:=replace(body,chr(13),''); anchor:=strpos(body,E'\nBEGIN\n');
 IF anchor=0 THEN RAISE EXCEPTION 'warehouse_maintenance_anchor_changed'; END IF;
 body:=overlay(body placing E'\nBEGIN\n IF EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=p_user_id) THEN RETURN; END IF;\n' from anchor for 7); EXECUTE body;
 SELECT pg_get_functiondef('public.kq_record_chanvrier_processing()'::regprocedure) INTO body;
 fragment:='WHERE e.user_id=owner AND e.tent_number=1 AND e.equipment_code=ANY(used_codes)';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'warehouse_practice_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,fragment||' AND NOT EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=owner)');
 -- Packaging cannot turn an unfinished batch into immediately sellable stock.
 SELECT pg_get_functiondef('public.rpc_kq_online_command(uuid,text,jsonb,uuid)'::regprocedure) INTO body;
 fragment:='IF NOT FOUND OR s.route=''biomass'' OR s.remaining_units<qty*grams*10 THEN RAISE EXCEPTION ''online_stock_unavailable''; END IF;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'warehouse_online_processing_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,fragment||E'\n IF EXISTS(SELECT 1 FROM public.kq_commerce_batches WHERE flower_id=s.flower_id AND route=s.route AND processing_ready_at>now()) THEN RAISE EXCEPTION ''warehouse_processing_pending''; END IF;');
END $$;

ALTER FUNCTION public.rpc_kq_commerce_state(UUID) RENAME TO kq_warehouse_previous_commerce_state;
REVOKE ALL ON FUNCTION public.kq_warehouse_previous_commerce_state(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.rpc_kq_commerce_state(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result JSONB; stocks JSONB;
BEGIN
 result:=public.kq_warehouse_previous_commerce_state(p_user_id);
 SELECT COALESCE(jsonb_agg(s||jsonb_build_object('processingReadyAt',CASE WHEN s->>'route'=b.route THEN b.processing_ready_at ELSE NULL END)),'[]'::JSONB)
 INTO stocks FROM jsonb_array_elements(result->'stocks') s LEFT JOIN public.kq_commerce_batches b ON b.flower_id=(s->>'flowerId')::UUID;
 result:=jsonb_set(result,'{stocks}',stocks);
 IF EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=p_user_id)
 THEN result:=result||jsonb_build_object('wholesale',public.kq_warehouse_wholesale_budget(p_user_id)); END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_commerce_state(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_commerce_state(UUID) TO service_role;

COMMIT;
