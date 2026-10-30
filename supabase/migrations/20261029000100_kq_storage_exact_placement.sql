BEGIN;

-- Keep the existing family preference command for older clients. Placement is
-- explicit: one model, the whole remaining lot, no fallback to another model.
ALTER FUNCTION public.rpc_kq_storage_capacity_command(UUID,TEXT,TEXT,TEXT,INTEGER,UUID,UUID)
 RENAME TO kq_storage_capacity_before_placement;
REVOKE ALL ON FUNCTION public.kq_storage_capacity_before_placement(UUID,TEXT,TEXT,TEXT,INTEGER,UUID,UUID)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_storage_capacity_command(p_user_id UUID,p_action TEXT,p_method_code TEXT,p_container_code TEXT,p_quantity INTEGER,p_flower_id UUID,p_request_key UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE payload JSONB; previous JSONB; item JSONB; lot public.kq_storage_lots%ROWTYPE;
 total INTEGER; needed INTEGER; available INTEGER; reserved NUMERIC; previous_shortage NUMERIC; capacity JSONB;
BEGIN
 IF p_action IS DISTINCT FROM 'place' THEN
  RETURN public.kq_storage_capacity_before_placement(p_user_id,p_action,p_method_code,p_container_code,p_quantity,p_flower_id,p_request_key);
 END IF;
 item:=public.kq_storage_container(p_container_code);
 IF p_user_id IS NULL OR p_flower_id IS NULL OR p_request_key IS NULL OR item IS NULL
  OR p_method_code IS NOT NULL OR p_quantity IS NOT NULL THEN RAISE EXCEPTION 'storage_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 payload:=jsonb_build_object('action',p_action,'methodCode',p_method_code,'containerCode',p_container_code,'quantity',p_quantity,'flowerId',p_flower_id);
 SELECT r.payload INTO previous FROM public.kq_storage_requests r WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF previous IS DISTINCT FROM payload THEN RAISE EXCEPTION 'storage_request_mismatch'; END IF;
  RETURN public.kq_storage_snapshot(p_user_id,true)||jsonb_build_object('replayed',true);
 END IF;
 -- Settle due sales and elapsed business time before calculating the actual mass.
 PERFORM public.kq_storage_prepare_state(p_user_id);
 SELECT * INTO lot FROM public.kq_storage_lots WHERE flower_id=p_flower_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'storage_lot_unavailable'; END IF;
 total:=public.kq_storage_remaining(p_flower_id);
 IF total IS NULL OR total<=0 THEN RAISE EXCEPTION 'storage_lot_unavailable'; END IF;
 needed:=ceil(total::NUMERIC/(item->>'capacityUnits')::NUMERIC)::INTEGER;
 SELECT quantity INTO available FROM public.kq_warehouse_usable_containers(p_user_id) WHERE container_code=p_container_code;
 IF COALESCE(available,0)<=0 THEN RAISE EXCEPTION 'storage_container_not_installed'; END IF;
 SELECT COALESCE(sum((a->>'quantity')::NUMERIC),0) INTO reserved
  FROM public.kq_storage_lots s,LATERAL jsonb_array_elements(COALESCE(s.state->'capacity'->'allocations','[]'::JSONB)) a
  WHERE s.user_id=p_user_id AND s.flower_id<>p_flower_id AND a->>'containerCode'=p_container_code;
 IF available-reserved<needed THEN RAISE EXCEPTION 'storage_container_capacity'; END IF;
 IF public.kq_warehouse_free_service_slots(p_user_id,p_flower_id,p_container_code,'[]'::JSONB)<needed
  THEN RAISE EXCEPTION 'warehouse_service_capacity_in_use'; END IF;
 IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status='active' AND warehouse_zone_id IS NOT NULL) THEN
  previous_shortage:=public.kq_warehouse_pending_shortage_units(p_user_id);
 END IF;
 capacity:=lot.state->'capacity'||jsonb_build_object('totalUnits',total,'allocations',jsonb_build_array(
  jsonb_build_object('containerCode',p_container_code,'quantity',needed,'storedUnits',total)));
 -- Settle at the OLD rates first; the post-harvest trigger updates only the
 -- future container bonus. Keep the curing dates, deadline and acquired quality.
 UPDATE public.kq_storage_lots SET state=public.kq_storage_settle(lot.state,date_trunc('milliseconds',now()))
  ||jsonb_build_object('methodCode',item->>'methodCode','capacity',capacity),revision=revision+1
  WHERE flower_id=p_flower_id AND user_id=p_user_id;
 IF previous_shortage IS NOT NULL AND public.kq_warehouse_pending_shortage_units(p_user_id)>previous_shortage
  THEN RAISE EXCEPTION 'warehouse_service_capacity_in_use'; END IF;
 -- Do not auto-fill other lots with the newly freed containers.
 INSERT INTO public.kq_storage_requests(user_id,request_key,payload) VALUES(p_user_id,p_request_key,payload);
 RETURN public.kq_storage_snapshot(p_user_id,true)||jsonb_build_object('replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_storage_capacity_command(UUID,TEXT,TEXT,TEXT,INTEGER,UUID,UUID)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_storage_capacity_command(UUID,TEXT,TEXT,TEXT,INTEGER,UUID,UUID) TO service_role;

COMMIT;
