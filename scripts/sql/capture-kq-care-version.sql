-- Read installed function definitions and print a transactional restore script.
-- See docs/bete-de-concours/retour-pbi-secteurs.md for the three versions.
CREATE OR REPLACE FUNCTION pg_temp.capture_kq_care_functions() RETURNS TEXT
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $capture$
DECLARE
  scoped BOOLEAN := to_regprocedure('public.rpc_kq_care_intervention_receipt(uuid,uuid,uuid,text,jsonb)') IS NOT NULL;
  scoped_inputs BOOLEAN := strpos(pg_get_functiondef('public.kq_work_inner_apply_care(uuid,uuid,text,uuid,timestamptz,jsonb,integer)'::regprocedure),'kq_care_treatment_count')>0;
  old_receipt TEXT := 'public.rpc_kq_care_intervention_receipt(uuid,uuid,uuid,text)';
  sector_receipt TEXT := 'public.rpc_kq_care_intervention_receipt(uuid,uuid,uuid,text,jsonb)';
  receipt TEXT; definition TEXT; signature TEXT; result TEXT := E'BEGIN;\n'; old_guard TEXT;
BEGIN
  -- Snapshots restore functions only. The current schema and historical
  -- rows (including sector receipts) stay installed across versions.
  result := result || $require_schema$
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_catalog.pg_attribute
   WHERE attrelid='public.kq_care_interventions'::regclass AND attname='target' AND NOT attisdropped)
 THEN RAISE EXCEPTION 'kq_care_sector_schema_required'; END IF;
END $$;
$require_schema$;
  IF NOT scoped THEN
    result := result || $guard$
LOCK TABLE public.kq_runs IN SHARE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT FROM public.kq_runs WHERE status='active' AND
     (jsonb_path_exists(state,'$.care.problems[*].plants')
      OR jsonb_path_exists(state,'$.care.interventions[*].target')
      OR jsonb_path_exists(state,'$.care.applications[*].target')))
 THEN RAISE EXCEPTION 'kq_care_active_spatial_runs'; END IF;
END $$;
$guard$;
  ELSIF NOT scoped_inputs THEN
    result := result || $input_guard$
LOCK TABLE public.kq_runs IN SHARE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT FROM public.kq_runs WHERE status='active' AND (
   EXISTS(SELECT FROM jsonb_array_elements(state->'care'->'problems') p
     WHERE p ? 'plants' AND p->>'code' NOT IN ('APHIDS','THRIPS','MITES')) OR
   EXISTS(SELECT FROM jsonb_array_elements((state->'care'->'applications')||(state->'care'->'interventions')) a
     WHERE a ? 'target' AND cardinality(public.kq_care_pbi_pests(a->>'productCode'))=0)))
 THEN RAISE EXCEPTION 'kq_care_active_input_sectors'; END IF;
END $$;
$input_guard$;
  END IF;
  receipt := CASE WHEN scoped THEN sector_receipt ELSE old_receipt END;
  result := result || format(E'DROP FUNCTION IF EXISTS %s;\n',CASE WHEN scoped THEN old_receipt ELSE sector_receipt END);
  FOREACH signature IN ARRAY ARRAY[
    'public.rpc_kq_care_shop_v2(uuid,uuid)',
    'public.rpc_kq_purchase_care_v2(uuid,text,integer,uuid,uuid,integer)',
    'public.kq_work_inner_apply_care(uuid,uuid,text,uuid,timestamptz,jsonb,integer)',
    receipt,
    CASE WHEN scoped THEN 'public.kq_care_inventory_for_run(uuid,jsonb)' END
  ] LOOP
    CONTINUE WHEN signature IS NULL;
    definition := pg_get_functiondef(signature::regprocedure);
    IF NOT scoped AND signature=old_receipt THEN
      -- A request from an old client has no target. Preserve its payload check
      -- for newer receipts, including delayed retries on a finished campaign.
      old_guard := 'IF old.run_id IS DISTINCT FROM p_run_id';
      IF strpos(definition,old_guard)>0 THEN
        definition := replace(definition,old_guard,'IF old.target IS NOT NULL OR old.run_id IS DISTINCT FROM p_run_id');
      ELSIF strpos(definition,'IF old.target IS NOT NULL OR old.run_id IS DISTINCT FROM p_run_id')=0 THEN
        RAISE EXCEPTION 'kq_care_unrecognized_receipt_definition';
      END IF;
    END IF;
    result := result || definition || E';\n';
    result := result || format(E'REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role;\n',signature);
    IF signature LIKE 'public.rpc_kq_%' THEN
      result := result || format(E'GRANT EXECUTE ON FUNCTION %s TO service_role;\n',signature);
    END IF;
  END LOOP;
  RETURN result || E'NOTIFY pgrst, ''reload schema'';\nCOMMIT;\n';
END
$capture$;
SELECT pg_temp.capture_kq_care_functions() AS script;
