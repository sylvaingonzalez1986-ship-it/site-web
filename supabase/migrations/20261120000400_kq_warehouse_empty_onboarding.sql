BEGIN;

-- Start an unconverted account with the empty template unless it has a
-- historical production footprint. Initialization and retries share the
-- existing equipment lock, wallet, conversion archive and credit rules.
CREATE FUNCTION public.rpc_kq_warehouse_initialize_onboarding(
 p_user_id uuid,p_starter_state jsonb,p_empty_state jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_user_id IS NULL OR p_empty_state IS DISTINCT FROM
  '{"version":1,"floor":{"columns":10,"rows":10},"zones":[],"serviceZones":[],"airPlacements":[],"airService":{},"equipment":[],"preparedAreaM2":0}'::jsonb
 THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::text,0));
 IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id)
  OR EXISTS(SELECT 1 FROM public.kq_player_equipment WHERE user_id=p_user_id AND purchase_price_cents>0)
  OR EXISTS(SELECT 1 FROM public.kq_equipment_upgrade_receipts WHERE user_id=p_user_id)
  OR EXISTS(SELECT 1 FROM public.kq_production_expansions WHERE user_id=p_user_id)
  OR EXISTS(SELECT 1 FROM public.kq_flowers WHERE owner_id=p_user_id)
  OR public.kq_warehouse_stock_units(p_user_id)>0
 THEN RETURN public.rpc_kq_warehouse_initialize(p_user_id,p_starter_state); END IF;
 RETURN public.rpc_kq_warehouse_initialize(p_user_id,p_empty_state);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_initialize_onboarding(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_initialize_onboarding(uuid,jsonb,jsonb) TO service_role;

-- An unlit cultivation rectangle participates in preparation and ownership
-- of assigned modules, while the paused state excludes operating projections.
DO $$
DECLARE def text;
 needle constant text := 'FOREACH kind IN ARRAY ARRAY[''lighting'',''air''] LOOP';
BEGIN
 def:=pg_get_functiondef('public.kq_warehouse_catalog_before_postharvest(jsonb)'::regprocedure);
 IF strpos(def,needle)=0 THEN RAISE EXCEPTION 'warehouse_unlit_catalog_anchor_missing'; END IF;
 EXECUTE replace(def,needle,$patch$IF zone->>'lightingCode'='UNLIT' THEN
   IF NOT(p_state ? 'airPlacements') OR zone->'active' IS DISTINCT FROM 'false'::jsonb
    OR public.kq_warehouse_device(zone->>'airCode')->>'kind' IS DISTINCT FROM 'air'
   THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
   CONTINUE;
  END IF;
  FOREACH kind IN ARRAY ARRAY['lighting','air'] LOOP$patch$);
END $$;

DO $$
DECLARE def text;
 needle constant text := 'FOREACH code IN ARRAY ARRAY[zone->>''lightingCode'',zone->>''airCode''] LOOP';
BEGIN
 def:=pg_get_functiondef('public.kq_warehouse_validate_assets(jsonb,jsonb)'::regprocedure);
 IF strpos(def,needle)=0 THEN RAISE EXCEPTION 'warehouse_unlit_assets_anchor_missing'; END IF;
 EXECUTE replace(def,needle,$patch$FOREACH code IN ARRAY ARRAY[zone->>'lightingCode',zone->>'airCode'] LOOP
   IF code='UNLIT' AND p_state ? 'airPlacements' AND zone->'active'='false'::jsonb THEN CONTINUE; END IF;$patch$);
END $$;

COMMIT;
