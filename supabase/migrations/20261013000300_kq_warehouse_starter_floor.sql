BEGIN;

-- New premises are 10 × 10. Absence of floor deliberately retains the original
-- 40 × 25 geometry, including every immutable historical run/campaign snapshot.
CREATE FUNCTION public.kq_warehouse_validate_floor(p_state JSONB) RETURNS VOID
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE columns_count INTEGER:=40; rows_count INTEGER:=25; zones JSONB; zone JSONB; coordinate TEXT;
BEGIN
 IF p_state IS NULL OR jsonb_typeof(p_state) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'warehouse_floor_invalid'; END IF;
 IF p_state ? 'floor' THEN
  IF p_state->'floor' IS DISTINCT FROM '{"columns":10,"rows":10}'::JSONB THEN RAISE EXCEPTION 'warehouse_floor_invalid'; END IF;
  columns_count:=10; rows_count:=10;
 END IF;
 IF jsonb_typeof(p_state->'zones') IS DISTINCT FROM 'array'
  OR (p_state ? 'serviceZones' AND jsonb_typeof(p_state->'serviceZones') IS DISTINCT FROM 'array')
  OR jsonb_typeof(p_state->'preparedAreaM2') IS DISTINCT FROM 'number'
  OR COALESCE(p_state->>'preparedAreaM2','') !~ '^(0|[1-9][0-9]*)$'
  THEN RAISE EXCEPTION 'warehouse_floor_invalid'; END IF;
 IF (p_state->>'preparedAreaM2')::NUMERIC>columns_count*rows_count THEN RAISE EXCEPTION 'warehouse_floor_invalid'; END IF;
 zones:=(p_state->'zones')||COALESCE(p_state->'serviceZones','[]'::JSONB);
 IF jsonb_array_length(zones)>columns_count*rows_count THEN RAISE EXCEPTION 'warehouse_floor_invalid'; END IF;
 FOR zone IN SELECT value FROM jsonb_array_elements(zones) LOOP
  FOREACH coordinate IN ARRAY ARRAY['x','y','width','height'] LOOP
   IF jsonb_typeof(zone->coordinate) IS DISTINCT FROM 'number' OR COALESCE(zone->>coordinate,'') !~ '^(0|[1-9][0-9]*)$'
    THEN RAISE EXCEPTION 'warehouse_floor_invalid'; END IF;
  END LOOP;
  IF (zone->>'width')::NUMERIC<1 OR (zone->>'height')::NUMERIC<1
   OR (zone->>'x')::NUMERIC+(zone->>'width')::NUMERIC>columns_count
   OR (zone->>'y')::NUMERIC+(zone->>'height')::NUMERIC>rows_count
   OR jsonb_typeof(zone->'id') IS DISTINCT FROM 'string' OR length(zone->>'id') NOT BETWEEN 1 AND 80
   THEN RAISE EXCEPTION 'warehouse_floor_invalid'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(zones) z GROUP BY z->>'id' HAVING count(*)>1)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(zones) WITH ORDINALITY a(z,n),jsonb_array_elements(zones) WITH ORDINALITY b(z,n)
   WHERE a.n<b.n AND (a.z->>'x')::INTEGER<(b.z->>'x')::INTEGER+(b.z->>'width')::INTEGER
    AND (a.z->>'x')::INTEGER+(a.z->>'width')::INTEGER>(b.z->>'x')::INTEGER
    AND (a.z->>'y')::INTEGER<(b.z->>'y')::INTEGER+(b.z->>'height')::INTEGER
    AND (a.z->>'y')::INTEGER+(a.z->>'height')::INTEGER>(b.z->>'y')::INTEGER)
  THEN RAISE EXCEPTION 'warehouse_floor_invalid'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_validate_floor(JSONB) FROM PUBLIC,anon,authenticated,service_role;

-- Only positions and the new floor marker may differ during free compaction.
-- Array order, IDs, dimensions, Buddies, active flags, funded area and all reserves
-- remain byte-for-byte equivalent as JSONB; missing legacy serviceZones stay missing.
CREATE FUNCTION public.kq_warehouse_floor_identity(p_state JSONB) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE result JSONB:=p_state-'floor'; field TEXT;
BEGIN
 FOREACH field IN ARRAY ARRAY['zones','serviceZones'] LOOP
  IF p_state ? field THEN
   result:=jsonb_set(result,ARRAY[field],(SELECT COALESCE(jsonb_agg(z-'x'-'y' ORDER BY n),'[]'::JSONB)
    FROM jsonb_array_elements(p_state->field) WITH ORDINALITY a(z,n)));
  END IF;
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_floor_identity(JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_warehouse_guard_floor() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 -- An older server may still initialize a legacy plan during a rolling deploy.
 -- Its original bounds remain valid; the new server can subsequently compact it.
 IF TG_OP='UPDATE' AND OLD.state ? 'floor' AND NEW.state->'floor' IS DISTINCT FROM OLD.state->'floor'
  THEN RAISE EXCEPTION 'warehouse_floor_changed'; END IF;
 PERFORM public.kq_warehouse_validate_floor(NEW.state);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_guard_floor() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_warehouse_floor_guard BEFORE INSERT OR UPDATE OF state ON public.kq_warehouse_layouts
 FOR EACH ROW EXECUTE FUNCTION public.kq_warehouse_guard_floor();

-- Preserve all later catalogue, occupied-zone, receipt and career guards. The
-- existing replay remains first, even for a receipt issued before floor adoption.
DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_warehouse_save(uuid,uuid,jsonb,integer,jsonb,jsonb,integer)'::regprocedure) INTO body;
 anchor:='IF replay IS NOT NULL THEN RETURN replay; END IF;';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'warehouse_floor_save_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,anchor||E'\n IF p_previous_state->''floor'' IS DISTINCT FROM p_next_state->''floor'' THEN RAISE EXCEPTION ''warehouse_floor_changed''; END IF;\n PERFORM public.kq_warehouse_validate_floor(p_next_state);');
END $$;

CREATE FUNCTION public.rpc_kq_warehouse_compact(
 p_user_id UUID,p_expected_revision INTEGER,p_previous_state JSONB,p_next_state JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE layout public.kq_warehouse_layouts%ROWTYPE;
BEGIN
 IF p_user_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1
  OR p_previous_state IS NULL OR p_next_state IS NULL OR octet_length(p_next_state::TEXT)>300000
  OR p_previous_state ? 'floor' OR p_next_state->'floor' IS DISTINCT FROM '{"columns":10,"rows":10}'::JSONB
  THEN RAISE EXCEPTION 'warehouse_floor_invalid'; END IF;
 PERFORM public.kq_warehouse_validate_floor(p_next_state);
 IF public.kq_warehouse_floor_identity(p_previous_state) IS DISTINCT FROM public.kq_warehouse_floor_identity(p_next_state)
  THEN RAISE EXCEPTION 'warehouse_inventory_loss'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO layout FROM public.kq_warehouse_layouts WHERE user_id=p_user_id FOR UPDATE;
 -- Concurrent edits/starts and retries keep the winning plan. No draft is lost.
 IF NOT FOUND OR layout.revision<>p_expected_revision OR layout.state IS DISTINCT FROM p_previous_state
  OR EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='active')
  THEN RETURN public.kq_warehouse_snapshot(p_user_id); END IF;
 UPDATE public.kq_warehouse_layouts SET state=p_next_state,revision=revision+1,updated_at=now() WHERE user_id=p_user_id;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 RETURN public.kq_warehouse_snapshot(p_user_id);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_compact(UUID,INTEGER,JSONB,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_compact(UUID,INTEGER,JSONB,JSONB) TO service_role;

COMMIT;
