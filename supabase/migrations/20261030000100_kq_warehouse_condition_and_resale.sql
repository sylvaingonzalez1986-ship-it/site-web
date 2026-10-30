BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Prospective game wear. Historical purchase prices and past wear are not
-- invented: the service initializes unknown bases as null and wear at zero.
ALTER TABLE public.kq_warehouse_layouts ADD COLUMN culture_assets JSONB;
ALTER TABLE public.kq_warehouse_layouts ADD CONSTRAINT kq_warehouse_culture_assets_array
 CHECK (culture_assets IS NULL OR jsonb_typeof(culture_assets)='array');

CREATE TABLE public.kq_warehouse_wear_receipts (
 run_id UUID PRIMARY KEY REFERENCES public.kq_runs(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 equipment JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kq_warehouse_wear_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_warehouse_wear_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_warehouse_validate_assets(p_state JSONB,p_assets JSONB) RETURNS VOID
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE item JSONB; zone JSONB; device JSONB; code TEXT; ids TEXT[]:='{}'; amount NUMERIC; expected NUMERIC;
BEGIN
 IF jsonb_typeof(p_assets) IS DISTINCT FROM 'array' OR jsonb_array_length(p_assets)>20000
  OR octet_length(p_assets::TEXT)>2000000 THEN RAISE EXCEPTION 'warehouse_condition_invalid'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_assets) LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string'
   OR length(item->>'id') NOT BETWEEN 1 AND 200 OR item->>'id'=ANY(ids)
   OR jsonb_typeof(item->'kind') IS DISTINCT FROM 'string' OR item->>'kind' NOT IN ('device','option') OR jsonb_typeof(item->'code') IS DISTINCT FROM 'string'
   OR jsonb_typeof(item->'quantity') IS DISTINCT FROM 'number'
   OR (item->>'quantity')::NUMERIC NOT BETWEEN 1 AND 100000 OR trunc((item->>'quantity')::NUMERIC)<>(item->>'quantity')::NUMERIC
   OR jsonb_typeof(item->'wearPercent') IS DISTINCT FROM 'number' OR (item->>'wearPercent')::NUMERIC NOT BETWEEN 0 AND 100
   OR trunc((item->>'wearPercent')::NUMERIC)<>(item->>'wearPercent')::NUMERIC
   OR NOT(item ? 'purchaseUnitCents') OR jsonb_typeof(item->'purchaseUnitCents') NOT IN ('number','null')
   OR jsonb_typeof(item->'purchaseUnitCents')='number' AND ((item->>'purchaseUnitCents')::NUMERIC NOT BETWEEN 0 AND 2147483647
     OR trunc((item->>'purchaseUnitCents')::NUMERIC)<>(item->>'purchaseUnitCents')::NUMERIC)
   OR NOT(item ? 'zoneId') OR jsonb_typeof(item->'zoneId') NOT IN ('string','null')
   OR item ? 'sourceAssetKey' AND (jsonb_typeof(item->'sourceAssetKey') IS DISTINCT FROM 'string' OR length(item->>'sourceAssetKey') NOT BETWEEN 1 AND 200)
  THEN RAISE EXCEPTION 'warehouse_condition_invalid'; END IF;
  ids:=array_append(ids,item->>'id');
  IF item->>'kind'='device' THEN
   device:=public.kq_warehouse_device(item->>'code');
   IF device IS NULL OR device->>'kind' NOT IN ('lighting','air') THEN RAISE EXCEPTION 'warehouse_condition_invalid'; END IF;
  ELSIF public.kq_warehouse_option(item->>'code') IS NULL THEN RAISE EXCEPTION 'warehouse_condition_invalid'; END IF;
  IF item->>'zoneId' IS NOT NULL THEN
   SELECT z INTO zone FROM jsonb_array_elements(p_state->'zones') z WHERE z->>'id'=item->>'zoneId';
   IF zone IS NULL OR item->>'kind'='device' AND item->>'code' NOT IN (zone->>'lightingCode',zone->>'airCode')
    OR item->>'kind'='option' AND NOT(COALESCE(zone->'optionCodes','[]'::JSONB) ? (item->>'code'))
   THEN RAISE EXCEPTION 'warehouse_condition_invalid'; END IF;
  END IF;
 END LOOP;
 -- Every culture item is represented exactly once, including equipment kept
 -- in reserve. Storage, drying and processing devices are separate systems.
 FOR item IN SELECT e||'{"kind":"device"}'::JSONB FROM jsonb_array_elements(p_state->'equipment') e
   WHERE public.kq_warehouse_device(e->>'code')->>'kind' IN ('lighting','air')
  UNION ALL SELECT e||'{"kind":"option"}'::JSONB FROM jsonb_array_elements(COALESCE(p_state->'optionInventory','[]'::JSONB)) e LOOP
  SELECT COALESCE(sum((a->>'quantity')::NUMERIC),0) INTO amount FROM jsonb_array_elements(p_assets) a
   WHERE a->>'code'=item->>'code' AND a->>'kind'=item->>'kind';
  IF amount IS DISTINCT FROM (item->>'quantity')::NUMERIC THEN RAISE EXCEPTION 'warehouse_condition_inventory'; END IF;
 END LOOP;
 FOR item IN SELECT DISTINCT jsonb_build_object('code',a->>'code','kind',a->>'kind') FROM jsonb_array_elements(p_assets) a LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE item->>'kind' WHEN 'device' THEN p_state->'equipment'
   ELSE COALESCE(p_state->'optionInventory','[]'::JSONB) END) e WHERE e->>'code'=item->>'code')
  THEN RAISE EXCEPTION 'warehouse_condition_inventory'; END IF;
 END LOOP;
 FOR zone IN SELECT * FROM jsonb_array_elements(p_state->'zones') LOOP
  FOREACH code IN ARRAY ARRAY[zone->>'lightingCode',zone->>'airCode'] LOOP
   expected:=ceil((zone->>'width')::NUMERIC*(zone->>'height')::NUMERIC/(public.kq_warehouse_device(code)->'gameCapacity'->>'value')::NUMERIC);
   SELECT COALESCE(sum((a->>'quantity')::NUMERIC),0) INTO amount FROM jsonb_array_elements(p_assets) a
    WHERE a->>'zoneId'=zone->>'id' AND a->>'code'=code AND a->>'kind'='device';
   IF amount<>expected THEN RAISE EXCEPTION 'warehouse_condition_inventory'; END IF;
  END LOOP;
  FOR code IN SELECT jsonb_array_elements_text(COALESCE(zone->'optionCodes','[]'::JSONB)) LOOP
   SELECT COALESCE(sum((a->>'quantity')::NUMERIC),0) INTO amount FROM jsonb_array_elements(p_assets) a
    WHERE a->>'zoneId'=zone->>'id' AND a->>'code'=code AND a->>'kind'='option';
   IF amount<>(zone->>'width')::NUMERIC*(zone->>'height')::NUMERIC THEN RAISE EXCEPTION 'warehouse_condition_inventory'; END IF;
  END LOOP;
 END LOOP;
END $$;

-- The known snapshot helper is reused by every existing warehouse receipt.
ALTER FUNCTION public.kq_warehouse_snapshot(UUID) RENAME TO kq_warehouse_snapshot_before_condition;
REVOKE ALL ON FUNCTION public.kq_warehouse_snapshot_before_condition(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_warehouse_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.kq_warehouse_snapshot_before_condition(p_user_id)||jsonb_build_object('cultureEquipment',
  (SELECT CASE WHEN culture_assets IS NULL THEN NULL ELSE jsonb_build_object('version',1,'assets',culture_assets) END
   FROM public.kq_warehouse_layouts WHERE user_id=p_user_id));
$$;

CREATE FUNCTION public.rpc_kq_warehouse_condition_initialize(p_user_id UUID,p_expected_revision INTEGER,p_assets JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE layout public.kq_warehouse_layouts%ROWTYPE;
BEGIN
 IF p_user_id IS NULL OR p_expected_revision IS NULL THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO layout FROM public.kq_warehouse_layouts WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'warehouse_revision_changed'; END IF;
 IF layout.culture_assets IS NOT NULL THEN RETURN public.kq_warehouse_snapshot(p_user_id); END IF;
 IF layout.revision<>p_expected_revision THEN RAISE EXCEPTION 'warehouse_revision_changed'; END IF;
 PERFORM public.kq_warehouse_validate_assets(layout.state,p_assets);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_assets) a WHERE (a->>'wearPercent')::NUMERIC<>0
  OR COALESCE((a->>'purchaseUnitCents')::NUMERIC,0)<>0 OR a ? 'sourceAssetKey')
 THEN RAISE EXCEPTION 'warehouse_condition_invalid'; END IF;
 UPDATE public.kq_warehouse_layouts SET culture_assets=p_assets WHERE user_id=p_user_id;
 RETURN public.kq_warehouse_snapshot(p_user_id);
END $$;

-- Preserve old receipts but close the old write path once tracking is enabled.
ALTER FUNCTION public.rpc_kq_warehouse_save(UUID,UUID,JSONB,INTEGER,JSONB,JSONB,INTEGER) RENAME TO kq_warehouse_save_before_condition;
REVOKE ALL ON FUNCTION public.kq_warehouse_save_before_condition(UUID,UUID,JSONB,INTEGER,JSONB,JSONB,INTEGER) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.rpc_kq_warehouse_save(p_user_id UUID,p_request_key UUID,p_request JSONB,p_expected_revision INTEGER,p_previous_state JSONB,p_next_state JSONB,p_cost_cents INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE replay JSONB;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 replay:=public.rpc_kq_warehouse_receipt(p_user_id,p_request_key,p_request);
 IF replay IS NOT NULL THEN RETURN replay; END IF;
 IF EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=p_user_id AND culture_assets IS NOT NULL)
 THEN RAISE EXCEPTION 'warehouse_condition_required'; END IF;
 RETURN public.kq_warehouse_save_before_condition(p_user_id,p_request_key,p_request,p_expected_revision,p_previous_state,p_next_state,p_cost_cents);
END $$;

CREATE FUNCTION public.rpc_kq_warehouse_save_condition(p_user_id UUID,p_request_key UUID,p_request JSONB,p_expected_revision INTEGER,p_previous_state JSONB,p_next_state JSONB,p_cost_cents INTEGER,p_previous_assets JSONB,p_next_assets JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE layout public.kq_warehouse_layouts%ROWTYPE; result JSONB; item JSONB; metadata JSONB; before_count NUMERIC; after_count NUMERIC;
 charged NUMERIC; unit_price NUMERIC; active_zone TEXT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 result:=public.rpc_kq_warehouse_receipt(p_user_id,p_request_key,p_request);
 IF result IS NOT NULL THEN RETURN result; END IF;
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO layout FROM public.kq_warehouse_layouts WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR layout.culture_assets IS NULL OR layout.culture_assets IS DISTINCT FROM p_previous_assets
  OR layout.revision IS DISTINCT FROM p_expected_revision OR layout.state IS DISTINCT FROM p_previous_state
 THEN RAISE EXCEPTION 'warehouse_condition_changed'; END IF;
 PERFORM public.kq_warehouse_validate_assets(p_next_state,p_next_assets);
 -- A reassignment may split an asset lot but must preserve every condition and
 -- acquisition basis. New quantities carry the current paid share, not credit.
 FOR metadata IN SELECT DISTINCT a-'id'-'zoneId'-'quantity' FROM jsonb_array_elements(p_previous_assets) a LOOP
  SELECT sum((a->>'quantity')::NUMERIC) INTO before_count FROM jsonb_array_elements(p_previous_assets) a WHERE a-'id'-'zoneId'-'quantity'=metadata;
  SELECT COALESCE(sum((a->>'quantity')::NUMERIC),0) INTO after_count FROM jsonb_array_elements(p_next_assets) a WHERE a-'id'-'zoneId'-'quantity'=metadata;
  IF before_count<>after_count THEN RAISE EXCEPTION 'warehouse_condition_changed'; END IF;
 END LOOP;
 charged:=GREATEST(0,p_cost_cents-layout.migration_credit_cents);
 FOR item IN SELECT a FROM jsonb_array_elements(p_next_assets) a WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_previous_assets) b
   WHERE a-'id'-'zoneId'-'quantity'=b-'id'-'zoneId'-'quantity') LOOP
  unit_price:=CASE item->>'kind' WHEN 'device' THEN (public.kq_warehouse_device(item->>'code')->>'priceCents')::NUMERIC
   ELSE (public.kq_warehouse_option(item->>'code')->>'equipmentCentsPerM2')::NUMERIC END;
  IF item->>'sourceAssetKey' IS DISTINCT FROM 'warehouse:'||p_request_key::TEXT OR (item->>'wearPercent')::NUMERIC<>0
   OR (item->>'purchaseUnitCents')::NUMERIC IS DISTINCT FROM (CASE WHEN p_cost_cents>0 THEN floor(unit_price*charged/p_cost_cents) ELSE 0 END)
  THEN RAISE EXCEPTION 'warehouse_condition_invalid'; END IF;
 END LOOP;
 FOR active_zone IN SELECT warehouse_zone_id FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='active' LOOP
  IF (SELECT COALESCE(jsonb_agg(a ORDER BY a->>'id'),'[]') FROM jsonb_array_elements(p_previous_assets) a WHERE a->>'zoneId'=active_zone)
    IS DISTINCT FROM (SELECT COALESCE(jsonb_agg(a ORDER BY a->>'id'),'[]') FROM jsonb_array_elements(p_next_assets) a WHERE a->>'zoneId'=active_zone)
  THEN RAISE EXCEPTION 'warehouse_zone_busy'; END IF;
 END LOOP;
 result:=public.kq_warehouse_save_before_condition(p_user_id,p_request_key,p_request,p_expected_revision,p_previous_state,p_next_state,p_cost_cents);
 UPDATE public.kq_warehouse_layouts SET culture_assets=p_next_assets WHERE user_id=p_user_id;
 RETURN public.kq_warehouse_snapshot(p_user_id)||jsonb_build_object('receipt',result->'receipt');
END $$;

CREATE FUNCTION public.rpc_kq_warehouse_remove_zone(p_user_id UUID,p_request_key UUID,p_request JSONB,p_expected_revision INTEGER,p_previous_state JSONB,p_previous_assets JSONB,p_next_state JSONB,p_next_assets JSONB,p_resale_cents INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE layout public.kq_warehouse_layouts%ROWTYPE; result JSONB; removed_zone JSONB; item JSONB; following JSONB;
 removed_assets JSONB:='[]'; basis RECORD; asset public.kq_treasury_assets%ROWTYPE; retired_basis BIGINT; retired_recognized BIGINT;
 book_value BIGINT:=0; cash BIGINT; proceeds_limit NUMERIC; at TIMESTAMPTZ:=now();
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR jsonb_typeof(p_request) IS DISTINCT FROM 'object'
  OR p_resale_cents IS NULL OR p_resale_cents<0 THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 result:=public.rpc_kq_warehouse_receipt(p_user_id,p_request_key,p_request);
 IF result IS NOT NULL THEN RETURN result; END IF;
 PERFORM public.kq_business_settle(p_user_id);
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO layout FROM public.kq_warehouse_layouts WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR layout.revision IS DISTINCT FROM p_expected_revision OR layout.state IS DISTINCT FROM p_previous_state
  OR layout.culture_assets IS NULL OR layout.culture_assets IS DISTINCT FROM p_previous_assets
 THEN RAISE EXCEPTION 'warehouse_condition_changed'; END IF;
 IF p_next_state-'zones'-'equipment'-'optionInventory' IS DISTINCT FROM p_previous_state-'zones'-'equipment'-'optionInventory'
  OR jsonb_array_length(p_previous_state->'zones')<>jsonb_array_length(p_next_state->'zones')+1
 THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
 SELECT z INTO removed_zone FROM jsonb_array_elements(p_previous_state->'zones') z
  WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_next_state->'zones') n WHERE n->>'id'=z->>'id');
 IF removed_zone IS NULL OR p_next_state->'zones' IS DISTINCT FROM
   (SELECT COALESCE(jsonb_agg(z),'[]') FROM jsonb_array_elements(p_previous_state->'zones') z WHERE z->>'id'<>removed_zone->>'id')
 THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
 PERFORM public.kq_warehouse_validate_busy_zones(p_user_id,p_previous_state,p_next_state);
 PERFORM public.kq_warehouse_validate_floor(p_next_state);
 PERFORM public.kq_warehouse_validate_service_change(p_user_id,p_previous_state,p_next_state);
 PERFORM public.kq_warehouse_catalog_projection(p_next_state);
 PERFORM public.kq_warehouse_options_projection(p_next_state);
 PERFORM public.kq_warehouse_validate_assets(p_next_state,p_next_assets);
 FOR item IN SELECT * FROM jsonb_array_elements(p_previous_assets) LOOP
  SELECT a INTO following FROM jsonb_array_elements(p_next_assets) a WHERE a->>'id'=item->>'id';
  IF item->>'zoneId' IS DISTINCT FROM removed_zone->>'id' THEN
   IF following IS DISTINCT FROM item THEN RAISE EXCEPTION 'warehouse_condition_changed'; END IF;
  ELSIF following IS NOT NULL THEN
   IF following IS DISTINCT FROM jsonb_set(item,'{zoneId}','null') THEN RAISE EXCEPTION 'warehouse_condition_changed'; END IF;
  ELSE
   IF item->>'purchaseUnitCents' IS NULL THEN RAISE EXCEPTION 'warehouse_purchase_basis_unknown'; END IF;
   removed_assets:=removed_assets||jsonb_build_array(item);
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_next_assets) a WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_previous_assets) b WHERE b->>'id'=a->>'id'))
 THEN RAISE EXCEPTION 'warehouse_condition_changed'; END IF;
 -- Non-culture inventory is never sold by this command.
 IF (SELECT COALESCE(jsonb_agg(e ORDER BY e->>'code'),'[]') FROM jsonb_array_elements(p_previous_state->'equipment') e
    WHERE public.kq_warehouse_device(e->>'code')->>'kind' NOT IN ('lighting','air'))
  IS DISTINCT FROM (SELECT COALESCE(jsonb_agg(e ORDER BY e->>'code'),'[]') FROM jsonb_array_elements(p_next_state->'equipment') e
    WHERE public.kq_warehouse_device(e->>'code')->>'kind' NOT IN ('lighting','air'))
 THEN RAISE EXCEPTION 'warehouse_inventory_loss'; END IF;
 SELECT COALESCE(sum(floor((a->>'purchaseUnitCents')::NUMERIC*(a->>'quantity')::NUMERIC*(100-(a->>'wearPercent')::NUMERIC)/100)),0)
  INTO proceeds_limit FROM jsonb_array_elements(removed_assets) a;
 IF p_resale_cents<>proceeds_limit OR p_request->'expectedResaleCents' IS DISTINCT FROM to_jsonb(p_resale_cents)
  OR cash+p_resale_cents>2147483647 THEN RAISE EXCEPTION 'warehouse_price_changed'; END IF;
 PERFORM public.kq_treasury_initialize(p_user_id);
 PERFORM public.kq_treasury_refresh(p_user_id);
 -- Remove only sold device principal from the mixed fit-out asset. Paid room
 -- preparation and installation remain capitalized and available on the floor.
 FOR basis IN SELECT a->>'sourceAssetKey' source_key,sum((a->>'purchaseUnitCents')::BIGINT*(a->>'quantity')::BIGINT)::BIGINT amount
   FROM jsonb_array_elements(removed_assets) a WHERE a ? 'sourceAssetKey' GROUP BY a->>'sourceAssetKey' LOOP
  IF basis.amount=0 THEN CONTINUE; END IF;
  SELECT * INTO asset FROM public.kq_treasury_assets WHERE user_id=p_user_id AND source_key=basis.source_key AND retired_at IS NULL FOR UPDATE;
  IF NOT FOUND OR asset.cost_cents<basis.amount THEN RAISE EXCEPTION 'warehouse_asset_basis_changed'; END IF;
  retired_basis:=basis.amount;
  retired_recognized:=floor(asset.recognized_cents::NUMERIC*retired_basis/NULLIF(asset.cost_cents,0));
  book_value:=book_value+retired_basis-retired_recognized;
  UPDATE public.kq_treasury_assets SET cost_cents=cost_cents-retired_basis,recognized_cents=recognized_cents-retired_recognized,
   retired_at=CASE WHEN cost_cents=retired_basis THEN at ELSE retired_at END WHERE id=asset.id;
 END LOOP;
 UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+p_resale_cents,updated_at=at WHERE user_id=p_user_id;
 -- The wallet observer already posts cash against suspense. This completes
 -- that transaction, removes the carrying value, and records its gain/loss.
 PERFORM public.kq_treasury_post(p_user_id,'warehouse-resale','warehouse-resale:'||p_request_key::TEXT,at,jsonb_build_array(
  jsonb_build_object('account','suspense','deltaCents',p_resale_cents),
  jsonb_build_object('account','equipment','deltaCents',-book_value),
  jsonb_build_object('account','expense_other','deltaCents',book_value-p_resale_cents)),removed_zone->>'name');
 UPDATE public.kq_warehouse_layouts SET state=p_next_state,culture_assets=p_next_assets,revision=revision+1,updated_at=at WHERE user_id=p_user_id;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 result:=jsonb_build_object('requestKey',p_request_key,'revision',layout.revision+1,'investmentCents',0,'creditUsedCents',0,'chargedCents',0,
  'resaleCents',p_resale_cents,'removedZoneId',removed_zone->>'id',
  'soldCount',(SELECT COALESCE(sum((a->>'quantity')::INTEGER),0) FROM jsonb_array_elements(removed_assets) a),
  'keptCount',(SELECT COALESCE(sum((a->>'quantity')::INTEGER),0) FROM jsonb_array_elements(p_previous_assets) a
    WHERE a->>'zoneId'=removed_zone->>'id' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(removed_assets) s WHERE s->>'id'=a->>'id')),
  'replayed',false);
 INSERT INTO public.kq_warehouse_receipts(user_id,request_key,request,receipt) VALUES(p_user_id,p_request_key,p_request,result);
 RETURN public.kq_warehouse_snapshot(p_user_id)||jsonb_build_object('receipt',result);
END $$;

CREATE FUNCTION public.kq_warehouse_condition_projection(p_warehouse JSONB) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE zone JSONB; source JSONB:=p_warehouse->'sourceState'; assets JSONB:=p_warehouse->'cultureEquipment'->'assets';
 base NUMERIC:=0; potential NUMERIC:=0; own NUMERIC; wear NUMERIC;
BEGIN
 IF p_warehouse->'wearVersion' IS DISTINCT FROM '1'::JSONB OR p_warehouse->'cultureEquipment'->'version' IS DISTINCT FROM '1'::JSONB
  OR jsonb_typeof(assets) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'warehouse_condition_invalid'; END IF;
 FOR zone IN SELECT * FROM jsonb_array_elements(source->'zones') WHERE value->'active'='true'::JSONB
  AND (p_warehouse->'version' IS DISTINCT FROM '2'::JSONB OR value->>'id'=p_warehouse->>'zoneId') LOOP
  own:=(CASE WHEN p_warehouse->'balanceVersion'='2'::JSONB THEN public.kq_warehouse_options_projection(jsonb_set(source,'{zones}',jsonb_build_array(zone)))
   ELSE public.kq_warehouse_options_projection_v1(jsonb_set(source,'{zones}',jsonb_build_array(zone))) END->>'estimatedHarvestGrams')::NUMERIC;
  SELECT COALESCE(sum((a->>'quantity')::NUMERIC*(a->>'wearPercent')::NUMERIC)/NULLIF(sum((a->>'quantity')::NUMERIC),0),0)
   INTO wear FROM jsonb_array_elements(assets) a WHERE a->>'zoneId'=zone->>'id';
  base:=base+own; potential:=potential+own*(1-wear/200);
 END LOOP;
 potential:=round(potential,3);
 RETURN jsonb_build_object('baseHarvestGrams',base,'estimatedHarvestGrams',potential,'yieldFactor',CASE WHEN base>0 THEN potential/base ELSE 1 END);
END $$;

ALTER FUNCTION public.kq_warehouse_validate_options_run(JSONB) RENAME TO kq_warehouse_validate_options_before_condition;
REVOKE ALL ON FUNCTION public.kq_warehouse_validate_options_before_condition(JSONB) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_warehouse_validate_options_run(p_warehouse JSONB) RETURNS VOID
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE projection JSONB; selected_source JSONB;
BEGIN
 IF NOT(p_warehouse ? 'wearVersion') THEN
  IF p_warehouse ? 'cultureEquipment' OR p_warehouse ? 'yieldFactor' THEN RAISE EXCEPTION 'warehouse_condition_invalid'; END IF;
  PERFORM public.kq_warehouse_validate_options_before_condition(p_warehouse); RETURN;
 END IF;
 -- A V2 snapshot keeps the complete frozen floor for identity checks. Its
 -- operational projection always concerns only its selected zone, including
 -- callers that have not already narrowed sourceState before validation.
 IF p_warehouse->'version'='2'::JSONB THEN
  SELECT jsonb_set(p_warehouse->'sourceState','{zones}',COALESCE(jsonb_agg(z),'[]')) INTO selected_source
   FROM jsonb_array_elements(p_warehouse->'sourceState'->'zones') z WHERE z->>'id'=p_warehouse->>'zoneId';
  IF jsonb_array_length(selected_source->'zones')<>1 THEN RAISE EXCEPTION 'warehouse_zone_invalid'; END IF;
  p_warehouse:=jsonb_set(p_warehouse,'{sourceState}',selected_source);
 END IF;
 projection:=public.kq_warehouse_condition_projection(p_warehouse);
 IF p_warehouse->'estimatedHarvestGrams' IS DISTINCT FROM projection->'estimatedHarvestGrams'
  OR jsonb_typeof(p_warehouse->'yieldFactor') IS DISTINCT FROM 'number'
  OR abs((p_warehouse->>'yieldFactor')::NUMERIC-(projection->>'yieldFactor')::NUMERIC)>0.000000001
 THEN RAISE EXCEPTION 'warehouse_condition_changed'; END IF;
 PERFORM public.kq_warehouse_validate_options_before_condition(jsonb_set(p_warehouse,'{estimatedHarvestGrams}',projection->'baseHarvestGrams'));
END $$;

ALTER FUNCTION public.kq_validate_warehouse_run_start(UUID,UUID,JSONB) RENAME TO kq_validate_warehouse_start_before_condition;
REVOKE ALL ON FUNCTION public.kq_validate_warehouse_start_before_condition(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_validate_warehouse_run_start(p_user UUID,p_run UUID,p_state JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE assets JSONB; layout_state JSONB; warehouse JSONB:=p_state->'warehouse';
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT culture_assets,state INTO assets,layout_state FROM public.kq_warehouse_layouts WHERE user_id=p_user FOR UPDATE;
 IF assets IS NOT NULL THEN
  IF warehouse->'wearVersion' IS DISTINCT FROM '1'::JSONB OR warehouse->'cultureEquipment' IS DISTINCT FROM jsonb_build_object('version',1,'assets',assets)
  THEN RAISE EXCEPTION 'warehouse_condition_changed'; END IF;
  PERFORM public.kq_warehouse_validate_assets(layout_state,assets);
 ELSIF warehouse ? 'wearVersion' OR warehouse ? 'cultureEquipment' OR warehouse ? 'yieldFactor' THEN RAISE EXCEPTION 'warehouse_condition_changed'; END IF;
 PERFORM public.kq_validate_warehouse_start_before_condition(p_user,p_run,p_state);
END $$;

CREATE FUNCTION public.kq_warehouse_wear_on_completion() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE layout public.kq_warehouse_layouts%ROWTYPE; current_asset JSONB; frozen JSONB; next_assets JSONB:='[]'; changes JSONB:='[]'; loss INTEGER;
BEGIN
 IF NEW.status::TEXT<>'completed' OR OLD.status::TEXT IN ('completed','abandoned') OR NEW.state->'warehouse'->'wearVersion' IS DISTINCT FROM '1'::JSONB THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||NEW.user_id::TEXT,0));
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.kq_warehouse_wear_receipts WHERE run_id=NEW.id) THEN RETURN NEW; END IF;
 SELECT * INTO layout FROM public.kq_warehouse_layouts WHERE user_id=NEW.user_id FOR UPDATE;
 IF layout.culture_assets IS NULL THEN RAISE EXCEPTION 'warehouse_condition_changed'; END IF;
 loss:=CASE NEW.state->'energy'->>'mode' WHEN 'eco' THEN 2 WHEN 'intensive' THEN 10 ELSE 5 END;
 FOR current_asset IN SELECT * FROM jsonb_array_elements(layout.culture_assets) LOOP
  SELECT a INTO frozen FROM jsonb_array_elements(NEW.state->'warehouse'->'cultureEquipment'->'assets') a
   WHERE a->>'id'=current_asset->>'id' AND a->>'zoneId' IN (SELECT z->>'id' FROM jsonb_array_elements(NEW.state->'warehouse'->'zones') z WHERE z->'active'='true'::JSONB);
  IF frozen IS NOT NULL THEN
   IF frozen IS DISTINCT FROM current_asset THEN RAISE EXCEPTION 'warehouse_condition_changed'; END IF;
   current_asset:=jsonb_set(current_asset,'{wearPercent}',to_jsonb(LEAST(100,(current_asset->>'wearPercent')::NUMERIC+loss)));
   changes:=changes||jsonb_build_array(jsonb_build_object('id',current_asset->>'id','wearBefore',frozen->'wearPercent','wearAfter',current_asset->'wearPercent'));
  END IF;
  next_assets:=next_assets||jsonb_build_array(current_asset);
 END LOOP;
 INSERT INTO public.kq_warehouse_wear_receipts(run_id,user_id,equipment) VALUES(NEW.id,NEW.user_id,changes);
 UPDATE public.kq_warehouse_layouts SET culture_assets=next_assets,revision=revision+1,updated_at=now() WHERE user_id=NEW.user_id;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=NEW.user_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_wear_on_completion() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_warehouse_wear_on_completion AFTER UPDATE OF status ON public.kq_runs FOR EACH ROW EXECUTE FUNCTION public.kq_warehouse_wear_on_completion();

REVOKE ALL ON FUNCTION public.kq_warehouse_validate_assets(JSONB,JSONB),public.kq_warehouse_snapshot(UUID),
 public.kq_warehouse_condition_projection(JSONB),public.kq_warehouse_validate_options_run(JSONB),public.kq_validate_warehouse_run_start(UUID,UUID,JSONB)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_condition_initialize(UUID,INTEGER,JSONB),
 public.rpc_kq_warehouse_save(UUID,UUID,JSONB,INTEGER,JSONB,JSONB,INTEGER),
 public.rpc_kq_warehouse_save_condition(UUID,UUID,JSONB,INTEGER,JSONB,JSONB,INTEGER,JSONB,JSONB),
 public.rpc_kq_warehouse_remove_zone(UUID,UUID,JSONB,INTEGER,JSONB,JSONB,JSONB,JSONB,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_condition_initialize(UUID,INTEGER,JSONB),
 public.rpc_kq_warehouse_save(UUID,UUID,JSONB,INTEGER,JSONB,JSONB,INTEGER),
 public.rpc_kq_warehouse_save_condition(UUID,UUID,JSONB,INTEGER,JSONB,JSONB,INTEGER,JSONB,JSONB),
 public.rpc_kq_warehouse_remove_zone(UUID,UUID,JSONB,INTEGER,JSONB,JSONB,JSONB,JSONB,INTEGER) TO service_role;
COMMIT;
