BEGIN;

-- Update only product eligibility inside the existing locked transaction.
-- Its stock, receipt, workday, campaign and area accounting stay together.
DO $migration$
DECLARE
  body text := replace(pg_get_functiondef('public.kq_work_inner_apply_care(uuid,uuid,text,uuid,timestamptz,jsonb,integer)'::regprocedure),chr(13),'');
  old_limits text := $old$OR jsonb_array_length(next_care->'applications')>2012 OR jsonb_array_length(next_care->'interventions')>2012
     OR public.kq_care_treatment_count(next_care->'applications')>12
     OR public.kq_care_treatment_count(next_care->'interventions')>4
     OR (cardinality(pests)=0 AND (
       (p_product_code='CARE-ORGANIC-FEED' AND care->'problems' @> '[{"code":"SALTS"}]'::JSONB)
       OR EXISTS(SELECT FROM jsonb_array_elements(care->'applications') a
         WHERE cardinality(public.kq_care_pbi_pests(a->>'productCode'))=0
           AND ((a->>'productCode'=p_product_code) IS DISTINCT FROM (a->'stageIndex'=to_jsonb(step))))
       OR (SELECT count(DISTINCT (a->>'productCode',a->>'stageIndex'))
           FROM jsonb_array_elements(next_care->'applications') a
           WHERE cardinality(public.kq_care_pbi_pests(a->>'productCode'))=0)>2))$old$;
  same_input_pass text := $new$OR (cardinality(pests)=0 AND EXISTS(
       SELECT FROM jsonb_array_elements(care->'applications') a
       WHERE a->>'productCode'=p_product_code AND a->'stageIndex'<>to_jsonb(step)))$new$;
  old_focus text := $old$IF p_product_code IN ('CARE-IRON','CARE-PERLITE','CARE-SHADE','CARE-BLUE-TRAPS') AND (
   (p_product_code='CARE-IRON' AND care->'problems' @> '[{"code":"SALTS"}]'::jsonb) OR NOT EXISTS(
   SELECT FROM jsonb_array_elements(care->'problems') prob WHERE prob->>'code'=CASE p_product_code WHEN 'CARE-IRON' THEN 'IRON'
    WHEN 'CARE-PERLITE' THEN 'ROOTS' WHEN 'CARE-SHADE' THEN 'HEAT' WHEN 'CARE-BLUE-TRAPS' THEN 'THRIPS' END
    AND public.kq_supply_problem_cell(run.state,prob,target))) THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;$old$;
  salt_guard text := $new$IF p_product_code IN ('CARE-IRON','CARE-ORGANIC-FEED') AND care->'problems' @> '[{"code":"SALTS"}]'::jsonb
     THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;$new$;
  old_overlap text := $old$(i->>'productCode'=p_product_code OR public.kq_care_pbi_pests(i->>'productCode') && pests)$old$;
BEGIN
  IF strpos(body,old_limits)=0 OR strpos(body,old_focus)=0 OR strpos(body,old_overlap)=0 THEN
    RAISE EXCEPTION 'kq_distinct_culture_inputs_definition_changed';
  END IF;
  body := replace(body,old_limits,same_input_pass);
  body := replace(body,old_focus,salt_guard);
  EXECUTE replace(body,old_overlap,'i->>''productCode''=p_product_code');
END
$migration$;

COMMIT;
