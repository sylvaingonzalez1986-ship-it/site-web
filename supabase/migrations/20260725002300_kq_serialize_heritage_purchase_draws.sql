BEGIN;

ALTER FUNCTION public.rpc_kq_draw_heritage_for_purchase(UUID, BIGINT, INTEGER)
  RENAME TO rpc_kq_draw_heritage_for_purchase_unlocked;

REVOKE ALL ON FUNCTION public.rpc_kq_draw_heritage_for_purchase_unlocked(UUID, BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.rpc_kq_draw_heritage_for_purchase(
  p_user_id UUID,
  p_order_item_id BIGINT,
  p_unit_index INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_order_item_id::TEXT || ':heritage-unit:' || p_unit_index::TEXT,
      0
    )
  );
  RETURN public.rpc_kq_draw_heritage_for_purchase_unlocked(
    p_user_id,
    p_order_item_id,
    p_unit_index
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_draw_heritage_for_purchase(UUID, BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_draw_heritage_for_purchase(UUID, BIGINT, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.rpc_kq_draw_heritage_for_purchase(UUID, BIGINT, INTEGER)
  IS 'Serializes one paid order-item unit before invoking the dormant idempotent Heritage draw.';

COMMIT;
