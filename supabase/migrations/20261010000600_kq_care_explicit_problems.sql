BEGIN;

-- Ambient observations still stop adding problems once two are present. An
-- explicit situation must remain visible even when those two slots are occupied.
-- The engine observes at most one new problem at each of the five live stages,
-- so five is the absolute persistence limit. Existing states need no rewrite.
CREATE OR REPLACE FUNCTION public.kq_care_state_valid(care JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
BEGIN
  IF jsonb_typeof(care) IS DISTINCT FROM 'object' OR care->'version' IS DISTINCT FROM '1'::JSONB THEN RETURN FALSE; END IF;
  IF jsonb_typeof(care->'vitality') IS DISTINCT FROM 'number' OR jsonb_typeof(care->'terpenes') IS DISTINCT FROM 'number'
    OR jsonb_typeof(care->'cannabinoidExpression') IS DISTINCT FROM 'number'
    OR jsonb_typeof(care->'cannabinoidConversion') IS DISTINCT FROM 'number'
    OR jsonb_typeof(care->'cannabinoidOxidation') IS DISTINCT FROM 'number'
    OR jsonb_typeof(care->'yieldBonusPercent') IS DISTINCT FROM 'number' OR jsonb_typeof(care->'yieldLossPercent') IS DISTINCT FROM 'number'
    OR jsonb_typeof(care->'problems') IS DISTINCT FROM 'array' OR jsonb_typeof(care->'interventions') IS DISTINCT FROM 'array'
    OR jsonb_typeof(care->'applications') IS DISTINCT FROM 'array' OR jsonb_typeof(care->'history') IS DISTINCT FROM 'array' THEN RETURN FALSE; END IF;
  RETURN (care->>'vitality')::NUMERIC BETWEEN 0 AND 100 AND (care->>'terpenes')::NUMERIC BETWEEN 35 AND 99
    AND (care->>'cannabinoidExpression')::NUMERIC BETWEEN 35 AND 99
    AND (care->>'cannabinoidConversion')::NUMERIC BETWEEN 0 AND 20
    AND (care->>'cannabinoidOxidation')::NUMERIC BETWEEN 0 AND 20
    AND (care->>'yieldBonusPercent')::NUMERIC BETWEEN 0 AND 10 AND (care->>'yieldLossPercent')::NUMERIC BETWEEN 0 AND 40
    AND jsonb_array_length(care->'problems')<=5 AND jsonb_array_length(care->'history')<=48;
END $$;
REVOKE ALL ON FUNCTION public.kq_care_state_valid(JSONB) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
