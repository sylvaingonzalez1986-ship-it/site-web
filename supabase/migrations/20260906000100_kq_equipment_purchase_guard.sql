BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_kq_equip_durable(
  p_user_id UUID,
  p_equipment_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot TEXT;
  v_owned BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL OR NULLIF(BTRIM(p_equipment_code), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_equipment_loadout';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || p_user_id::TEXT, 0));
  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);

  SELECT TRUE INTO v_owned
  FROM public.kq_player_equipment owned
  WHERE owned.user_id = p_user_id
    AND owned.equipment_code = p_equipment_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment_not_owned'; END IF;

  SELECT catalog.slot INTO v_slot
  FROM public.kq_player_equipment owned
  JOIN public.kq_equipment_catalog catalog ON catalog.code = owned.equipment_code
  WHERE owned.user_id = p_user_id
    AND owned.equipment_code = p_equipment_code
    AND catalog.is_active = TRUE
    AND (catalog.is_purchasable = FALSE OR owned.purchase_price_cents > 0);
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment_not_purchased'; END IF;

  INSERT INTO public.kq_equipment_loadouts(user_id, slot, equipment_code, equipped_at)
  VALUES (p_user_id, v_slot, p_equipment_code, now())
  ON CONFLICT (user_id, slot) DO UPDATE SET
    equipment_code = EXCLUDED.equipment_code,
    equipped_at = now();

  RETURN jsonb_build_object(
    'equipmentCode', p_equipment_code,
    'slot', v_slot,
    'equipped', TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_equip_durable(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_equip_durable(UUID, TEXT) TO service_role;

COMMIT;
