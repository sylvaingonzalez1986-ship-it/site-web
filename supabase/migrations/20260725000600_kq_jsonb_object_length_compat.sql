BEGIN;

-- PostgreSQL does not expose jsonb_object_length on every supported Supabase
-- engine version. Keep the game RPC portable without weakening its five-stat
-- validation.
CREATE OR REPLACE FUNCTION public.jsonb_object_length(p_value JSONB)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT count(*)::INTEGER FROM jsonb_object_keys(p_value);
$$;

REVOKE ALL ON FUNCTION public.jsonb_object_length(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jsonb_object_length(JSONB) TO service_role;

COMMIT;
