BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_kq_warehouse_storage_state(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE business_origin TIMESTAMPTZ;
BEGIN
  PERFORM public.kq_storage_prepare_state(p_user_id);

  -- Match the origin used by the player workday when commerce has not opened yet.
  SELECT COALESCE(commerce.business_started_at, wallet.created_at) INTO business_origin
  FROM public.kq_equipment_wallets wallet
  LEFT JOIN public.kq_commerce_accounts commerce ON commerce.user_id = wallet.user_id
  WHERE wallet.user_id = p_user_id;

  RETURN public.kq_storage_snapshot(p_user_id, true)
    || jsonb_build_object('businessStartedAt', business_origin);
END $$;

REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_storage_state(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_storage_state(UUID) TO service_role;

COMMIT;
