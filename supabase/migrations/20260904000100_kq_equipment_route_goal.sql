BEGIN;

ALTER TABLE public.kq_equipment_wallets
  ADD COLUMN IF NOT EXISTS planned_route_code TEXT,
  ADD COLUMN IF NOT EXISTS planned_equipment_code TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kq_equipment_wallets_planned_route_check'
  ) THEN
    ALTER TABLE public.kq_equipment_wallets
      ADD CONSTRAINT kq_equipment_wallets_planned_route_check
      CHECK (
        planned_route_code IS NULL
        OR planned_route_code IN (
          'dry-sift', 'static-sift', 'ice-water-hash', 'rosin-trial',
          'rosin-selection', 'rosin-premium', 'rosin-signature', 'hash-signature'
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kq_equipment_wallets_planned_pair_check'
  ) THEN
    ALTER TABLE public.kq_equipment_wallets
      ADD CONSTRAINT kq_equipment_wallets_planned_pair_check
      CHECK ((planned_route_code IS NULL) = (planned_equipment_code IS NULL));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kq_equipment_wallets_planned_equipment_fkey'
  ) THEN
    ALTER TABLE public.kq_equipment_wallets
      ADD CONSTRAINT kq_equipment_wallets_planned_equipment_fkey
      FOREIGN KEY (planned_equipment_code) REFERENCES public.kq_equipment_catalog(code);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_set_equipment_route_plan(
  p_user_id UUID,
  p_route_code TEXT,
  p_equipment_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'invalid_equipment_user'; END IF;
  IF (p_route_code IS NULL) <> (p_equipment_code IS NULL) THEN
    RAISE EXCEPTION 'invalid_equipment_route_plan';
  END IF;
  IF p_route_code IS NOT NULL AND p_route_code NOT IN (
    'dry-sift', 'static-sift', 'ice-water-hash', 'rosin-trial',
    'rosin-selection', 'rosin-premium', 'rosin-signature', 'hash-signature'
  ) THEN
    RAISE EXCEPTION 'invalid_equipment_route';
  END IF;
  IF p_equipment_code IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.kq_equipment_catalog
    WHERE code = p_equipment_code AND is_active = TRUE AND is_purchasable = TRUE
  ) THEN
    RAISE EXCEPTION 'invalid_equipment_route_machine';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || p_user_id::TEXT, 0));
  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);

  UPDATE public.kq_equipment_wallets
  SET planned_route_code = p_route_code,
      planned_equipment_code = p_equipment_code,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'route', p_route_code,
    'equipmentCode', p_equipment_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_set_equipment_route_plan(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_set_equipment_route_plan(UUID, TEXT, TEXT) TO service_role;

COMMIT;
