BEGIN;

CREATE OR REPLACE FUNCTION public.lottery_secure_random_int(p_max_value INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_bytes BYTEA;
  v_number BIGINT;
BEGIN
  IF p_max_value IS NULL OR p_max_value < 1 THEN
    RAISE EXCEPTION 'invalid_max_value';
  END IF;

  v_bytes := extensions.gen_random_bytes(6);
  v_number :=
      (get_byte(v_bytes, 0)::BIGINT << 40) +
      (get_byte(v_bytes, 1)::BIGINT << 32) +
      (get_byte(v_bytes, 2)::BIGINT << 24) +
      (get_byte(v_bytes, 3)::BIGINT << 16) +
      (get_byte(v_bytes, 4)::BIGINT << 8) +
      get_byte(v_bytes, 5)::BIGINT;

  RETURN ((v_number % p_max_value) + 1)::INTEGER;
END;
$$;

COMMIT;
