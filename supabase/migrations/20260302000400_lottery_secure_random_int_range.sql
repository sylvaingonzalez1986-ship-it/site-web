BEGIN;

CREATE OR REPLACE FUNCTION public.lottery_secure_random_int(
  p_min_value INTEGER,
  p_max_value INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_span INTEGER;
BEGIN
  IF p_min_value IS NULL OR p_max_value IS NULL OR p_min_value > p_max_value THEN
    RAISE EXCEPTION 'invalid_random_range';
  END IF;

  IF p_min_value = p_max_value THEN
    RETURN p_min_value;
  END IF;

  v_span := p_max_value - p_min_value + 1;
  RETURN p_min_value + public.lottery_secure_random_int(v_span) - 1;
END;
$$;

REVOKE ALL ON FUNCTION public.lottery_secure_random_int(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lottery_secure_random_int(INTEGER, INTEGER) TO service_role;

COMMIT;
