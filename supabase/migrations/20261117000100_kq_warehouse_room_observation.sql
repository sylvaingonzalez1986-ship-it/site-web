BEGIN;

-- The culture camera needs the saved layout as it is now. The usual warehouse
-- entry may initialize equipment or settle billing, neither belongs to a view.
CREATE FUNCTION public.rpc_kq_observe_warehouse_room(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'state', room->'state', 'revision', room->'revision',
    'stockGrams', room->'stockGrams', 'activeRuns', room->'activeRuns',
    'productionReservation', room->'productionReservation'
  )
  FROM (SELECT public.kq_warehouse_snapshot(p_user_id) AS room) source
  WHERE room->'state' IS NOT NULL AND room->'state' <> 'null'::jsonb;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_observe_warehouse_room(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_observe_warehouse_room(UUID) TO service_role;
COMMIT;
