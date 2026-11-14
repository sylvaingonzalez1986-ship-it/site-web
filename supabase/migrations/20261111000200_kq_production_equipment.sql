BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';

-- A capability field: older clients/servers keep the reserved zone read-only.
CREATE OR REPLACE FUNCTION public.kq_warehouse_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.kq_warehouse_snapshot_before_production_reservation(p_user_id)
  ||jsonb_build_object('productionReservation',CASE WHEN reservation IS NULL THEN 'null'::JSONB
   ELSE jsonb_build_object('zoneId',reservation#>>'{facility,zoneId}','enabled',reservation#>'{settings,enabled}',
    'equipmentEditable',jsonb_array_length(reservation->'lots')=0 AND jsonb_array_length(reservation->'jobs')=0) END)
 FROM (SELECT public.kq_staff_production_reservation(p_user_id) AS reservation) r;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.kq_staff_production_facility(UUID) RENAME TO kq_staff_production_facility_before_equipment;
REVOKE ALL ON FUNCTION public.kq_staff_production_facility_before_equipment(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_staff_production_facility(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.kq_staff_production_facility_before_equipment(p_user)||jsonb_build_object('cultureEquipment',
  (SELECT CASE WHEN culture_assets IS NULL THEN NULL ELSE jsonb_build_object('version',1,'assets',culture_assets) END
   FROM public.kq_warehouse_layouts WHERE user_id=p_user));
$$;
REVOKE ALL ON FUNCTION public.kq_staff_production_facility(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.kq_staff_production_layout_guard() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE production JSONB; zone_id TEXT; before_zone JSONB; after_zone JSONB;
BEGIN
 production:=public.kq_staff_production_reservation(OLD.user_id);
 IF production IS NULL THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'staff_production_occupied'; END IF;
 zone_id:=production#>>'{facility,zoneId}';
 SELECT z INTO before_zone FROM jsonb_array_elements(OLD.state->'zones') z WHERE z->>'id'=zone_id;
 SELECT z INTO after_zone FROM jsonb_array_elements(NEW.state->'zones') z WHERE z->>'id'=zone_id;
 IF before_zone IS DISTINCT FROM after_zone THEN
  IF before_zone IS NULL OR after_zone IS NULL
   OR before_zone-'lightingCode'-'airCode'-'optionCodes' IS DISTINCT FROM after_zone-'lightingCode'-'airCode'-'optionCodes'
   THEN RAISE EXCEPTION 'staff_production_occupied'; END IF;
  IF jsonb_array_length(production->'lots')>0 OR jsonb_array_length(production->'jobs')>0
   OR current_setting('kq.production_equipment_user',true) IS DISTINCT FROM OLD.user_id::TEXT
   THEN RAISE EXCEPTION 'staff_production_equipment_busy'; END IF;
 END IF;
 IF OLD.state->'serviceZones' IS DISTINCT FROM NEW.state->'serviceZones' THEN RAISE EXCEPTION 'staff_production_occupied'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_production_layout_guard() FROM PUBLIC,anon,authenticated,service_role;

-- Reuse the actual paid catalog, option, condition and shared-capacity rules.
-- No quote or derived amount is accepted from the browser or RPC caller.
CREATE FUNCTION public.kq_staff_production_equipment_quote(p_user UUID,p_state JSONB,p_assets JSONB,p_previous JSONB) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE zone JSONB; selected JSONB; options JSONB; catalog JSONB; condition JSONB; input JSONB;
 harvest NUMERIC; drying NUMERIC; storage NUMERIC; cost BIGINT;
BEGIN
 SELECT z INTO zone FROM jsonb_array_elements(p_state->'zones') z WHERE z->>'id'=p_previous->>'zoneId' AND z->'active'='true'::JSONB;
 IF zone IS NULL THEN RAISE EXCEPTION 'staff_production_occupied'; END IF;
 PERFORM public.kq_warehouse_validate_assets(p_state,p_assets);
 selected:=jsonb_set(p_state,'{zones}',jsonb_build_array(zone));
 options:=public.kq_warehouse_options_projection(selected);
 catalog:=public.kq_warehouse_catalog_projection(selected);
 condition:=public.kq_warehouse_condition_projection(jsonb_build_object('version',2,'zoneId',zone->>'id',
  'balanceVersion',2,'wearVersion',1,'sourceState',p_state,'cultureEquipment',jsonb_build_object('version',1,'assets',p_assets)));
 harvest:=(condition->>'estimatedHarvestGrams')::NUMERIC;
 cost:=(catalog->>'energyCostCents')::BIGINT+(options->>'consumablesCostCents')::BIGINT;
 input:=public.kq_staff_production_facility(p_user);
 drying:=GREATEST(0,public.kq_warehouse_drying_capacity_grams(p_state)-(input->>'reservedDryingGrams')::NUMERIC);
 storage:=GREATEST(0,public.kq_warehouse_storage_capacity_units(p_user,p_state)/10-(input->>'usedStorageGrams')::NUMERIC);
 IF harvest<=0 OR drying<harvest OR storage<harvest THEN RAISE EXCEPTION 'staff_production_capacity'; END IF;
 RETURN p_previous||jsonb_build_object('name',zone->>'name','areaM2',(options->>'activeAreaM2')::NUMERIC,
  'harvestGrams',harvest,'cycleCostCents',cost,'qualityBonus',LEAST(100,GREATEST(0,(options->>'qualityBonus')::NUMERIC)),
  'dryingCapacityGrams',harvest,'storageCapacityGrams',LEAST(storage,harvest*2));
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_production_equipment_quote(UUID,JSONB,JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_warehouse_save_production_equipment(
 p_user_id UUID,p_request_key UUID,p_request JSONB,p_expected_revision INTEGER,
 p_previous_state JSONB,p_next_state JSONB,p_cost_cents INTEGER,p_previous_assets JSONB,p_next_assets JSONB,
 p_expected_staff_revision INTEGER,p_settled_at TIMESTAMPTZ) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result JSONB; account public.kq_staff_accounts%ROWTYPE; production JSONB; facility JSONB; revision INTEGER;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 result:=public.rpc_kq_warehouse_receipt(p_user_id,p_request_key,p_request);
 IF result IS NOT NULL THEN RETURN result; END IF;
 SELECT * INTO account FROM public.kq_staff_accounts WHERE user_id=p_user_id FOR UPDATE;
 production:=public.kq_staff_production_reservation(p_user_id);
 IF NOT FOUND OR account.revision IS DISTINCT FROM p_expected_staff_revision OR production IS NULL
  OR p_settled_at IS NULL OR p_settled_at>now()
  OR p_settled_at IS DISTINCT FROM (production->>'advancedAt')::TIMESTAMPTZ
  OR p_settled_at IS DISTINCT FROM (account.state->>'lastSettledAt')::TIMESTAMPTZ
 THEN RAISE EXCEPTION 'staff_production_changed'; END IF;
 IF jsonb_array_length(production->'lots')>0 OR jsonb_array_length(production->'jobs')>0
 THEN RAISE EXCEPTION 'staff_production_equipment_busy'; END IF;
 facility:=public.kq_staff_production_equipment_quote(p_user_id,p_next_state,p_next_assets,production->'facility');
 IF (facility->>'cycleCostCents')::BIGINT>(production#>>'{settings,maxDailyCostCents}')::BIGINT
 THEN RAISE EXCEPTION 'staff_production_budget'; END IF;
 PERFORM set_config('kq.production_equipment_user',p_user_id::TEXT,true);
 -- Retain the public work-hours wrapper and its replay-safe paid receipt.
 result:=public.rpc_kq_warehouse_save_condition(p_user_id,p_request_key,p_request,p_expected_revision,
  p_previous_state,p_next_state,p_cost_cents,p_previous_assets,p_next_assets);
 PERFORM set_config('kq.production_equipment_user','',true);
 SELECT l.revision INTO revision FROM public.kq_warehouse_layouts l WHERE user_id=p_user_id;
 -- The engine waits at this boundary before opening a new lot, including if
 -- the purchase followed its prerequisite settlement by a few milliseconds.
 facility:=facility||jsonb_build_object('equipmentRevision',revision,'equipmentEffectiveAt',
  date_trunc('milliseconds',now())+CASE WHEN date_trunc('milliseconds',now())<now() THEN interval '1 millisecond' ELSE interval '0' END);
 -- The warehouse wrapper may have updated playerWorkDays: mutate only facility.
 UPDATE public.kq_staff_accounts SET state=jsonb_set(state,'{production,facility}',facility),
  revision=kq_staff_accounts.revision+1,updated_at=now() WHERE user_id=p_user_id;
 RETURN public.kq_warehouse_snapshot(p_user_id)||jsonb_build_object('receipt',result->'receipt');
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_save_production_equipment(UUID,UUID,JSONB,INTEGER,JSONB,JSONB,INTEGER,JSONB,JSONB,INTEGER,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_save_production_equipment(UUID,UUID,JSONB,INTEGER,JSONB,JSONB,INTEGER,JSONB,JSONB,INTEGER,TIMESTAMPTZ) TO service_role;
COMMIT;
