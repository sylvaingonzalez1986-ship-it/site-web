BEGIN;

-- Prepared locally for review and isolated tests; applying this migration is
-- a separate deployment step. Fictional game balance v2 preserves purchase
-- prices, ownership, invoices and existing immutable run snapshots.
ALTER FUNCTION public.kq_warehouse_option(TEXT) RENAME TO kq_warehouse_option_v1;
ALTER FUNCTION public.kq_warehouse_options_projection(JSONB) RENAME TO kq_warehouse_options_projection_v1;
DO $$ DECLARE body TEXT; BEGIN
 body:=pg_get_functiondef('public.kq_warehouse_options_projection_v1(jsonb)'::regprocedure);
 IF strpos(body,'public.kq_warehouse_option(')=0 THEN RAISE EXCEPTION 'warehouse_balance_legacy_anchor_changed'; END IF;
 EXECUTE replace(body,'public.kq_warehouse_option(','public.kq_warehouse_option_v1(');
END $$;

CREATE FUNCTION public.kq_warehouse_option(p_code TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT old||jsonb_build_object('yieldBonusPercent',right(p_code,2)::INTEGER,
  'qualityBonus',CASE WHEN old->>'family' IN ('climate','hygiene','substrate')
    THEN right(p_code,2)::INTEGER-1 ELSE (old->>'qualityBonus')::INTEGER END)
 FROM (SELECT public.kq_warehouse_option_v1(p_code) old) entry WHERE old IS NOT NULL;
$$;

CREATE FUNCTION public.kq_warehouse_device_quality(p_code TEXT) RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN device->>'kind' IN ('lighting','air') AND (device->>'purchasable')::BOOLEAN
  THEN CASE device->>'tier' WHEN 'standard' THEN 1 WHEN 'premium' THEN 2 ELSE 0 END ELSE 0 END
 FROM (SELECT public.kq_warehouse_device(p_code) device) entry;
$$;

CREATE FUNCTION public.kq_warehouse_options_projection(p_state JSONB) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE result JSONB:=public.kq_warehouse_options_projection_v1(p_state);
 zone JSONB; code TEXT; option JSONB; area INTEGER; active_area INTEGER:=(result->>'activeAreaM2')::INTEGER;
 yield_bonus INTEGER; module_quality INTEGER; device_quality INTEGER; quality_sum BIGINT:=0; potential NUMERIC:=0;
BEGIN
 -- Retain validation of identities, unique families and funded quantities.
 FOR zone IN SELECT * FROM jsonb_array_elements(p_state->'zones') LOOP
  IF NOT (zone->>'active')::BOOLEAN THEN CONTINUE; END IF;
  area:=(zone->>'width')::INTEGER*(zone->>'height')::INTEGER;
  yield_bonus:=0; module_quality:=0;
  FOR code IN SELECT jsonb_array_elements_text(COALESCE(zone->'optionCodes','[]'::JSONB)) LOOP
   option:=public.kq_warehouse_option(code);
   yield_bonus:=yield_bonus+(option->>'yieldBonusPercent')::INTEGER;
   module_quality:=module_quality+(option->>'qualityBonus')::INTEGER;
  END LOOP;
  device_quality:=public.kq_warehouse_device_quality(zone->>'lightingCode')+public.kq_warehouse_device_quality(zone->>'airCode');
  quality_sum:=quality_sum+area*(LEAST(4,module_quality)+device_quality);
  potential:=potential+area*250::NUMERIC*(100+LEAST(24,yield_bonus))/100;
 END LOOP;
 RETURN result||jsonb_build_object('estimatedHarvestGrams',potential,
  'qualityBonus',CASE WHEN active_area>0 THEN quality_sum/active_area ELSE 0 END);
END $$;

CREATE OR REPLACE FUNCTION public.kq_warehouse_validate_options_run(p_warehouse JSONB) RETURNS VOID
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE expected JSONB; field TEXT; modern BOOLEAN:=p_warehouse ? 'balanceVersion';
BEGIN
 IF modern AND p_warehouse->'balanceVersion' IS DISTINCT FROM '2'::JSONB
  THEN RAISE EXCEPTION 'warehouse_balance_version_invalid'; END IF;
 expected:=CASE WHEN modern THEN public.kq_warehouse_options_projection(p_warehouse->'sourceState')
  ELSE public.kq_warehouse_options_projection_v1(p_warehouse->'sourceState') END;
 FOREACH field IN ARRAY ARRAY['activeAreaM2','estimatedHarvestGrams','consumablesCostCents'] LOOP
  IF p_warehouse->field IS DISTINCT FROM expected->field THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 END LOOP;
 IF (expected->>'hasOptions')::BOOLEAN OR modern AND (expected->>'qualityBonus')::INTEGER>0 THEN
  IF p_warehouse->'qualityBonus' IS DISTINCT FROM expected->'qualityBonus' THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 ELSIF p_warehouse ? 'qualityBonus' THEN RAISE EXCEPTION 'warehouse_layout_changed';
 END IF;
END $$;

DO $$ DECLARE body TEXT; target REGPROCEDURE; BEGIN
 target:=to_regprocedure('public.kq_validate_warehouse_run_start_v1(uuid,uuid,jsonb)');
 IF target IS NULL THEN target:=to_regprocedure('public.kq_validate_warehouse_run_start(uuid,uuid,jsonb)'); END IF;
 body:=pg_get_functiondef(target);
 IF strpos(body,'NOT BETWEEN 0.1 AND 300000')=0 THEN RAISE EXCEPTION 'warehouse_balance_potential_anchor_changed'; END IF;
 EXECUTE replace(body,'NOT BETWEEN 0.1 AND 300000','NOT BETWEEN 0.1 AND 310000');
END $$;

REVOKE ALL ON FUNCTION public.kq_warehouse_option_v1(TEXT),public.kq_warehouse_options_projection_v1(JSONB),
 public.kq_warehouse_option(TEXT),public.kq_warehouse_device_quality(TEXT),public.kq_warehouse_options_projection(JSONB),
 public.kq_warehouse_validate_options_run(JSONB) FROM PUBLIC,anon,authenticated,service_role;
-- Private helper functions remain inaccessible to Data API roles. Existing
-- service-only RPC permissions are preserved; no table or public grant added.
COMMIT;
