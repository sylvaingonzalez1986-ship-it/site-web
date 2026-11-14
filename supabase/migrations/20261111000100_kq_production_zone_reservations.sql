BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Occupancy is separate from the paid floor plan. All warehouse reads and
-- receipts reuse this snapshot and the same reservation predicate as the guards.
ALTER FUNCTION public.kq_warehouse_snapshot(UUID) RENAME TO kq_warehouse_snapshot_before_production_reservation;
REVOKE ALL ON FUNCTION public.kq_warehouse_snapshot_before_production_reservation(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_warehouse_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.kq_warehouse_snapshot_before_production_reservation(p_user_id)
  ||jsonb_build_object('productionReservation',CASE WHEN reservation IS NULL THEN 'null'::JSONB
    ELSE jsonb_build_object('zoneId',reservation#>>'{facility,zoneId}',
      'enabled',reservation#>'{settings,enabled}') END)
 FROM (SELECT public.kq_staff_production_reservation(p_user_id) AS reservation) current_reservation;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

-- The public RPC is the player-hours wrapper installed by 20261107000500.
-- Patch its private implementation, retaining the wrapper, lock and early replay.
-- During rolling deployment, older servers omit reservation metadata. Their
-- complete member set is still checked against canonical available zones.
DO $patch$
DECLARE body TEXT; anchor TEXT;
BEGIN
 body:=pg_get_functiondef('public.kq_work_inner_start_campaign(uuid,uuid,jsonb,jsonb,integer,text)'::regprocedure);
 anchor:='WHERE z->''active''=''true''::JSONB AND z->>''buddieCode'' IS NOT NULL;';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1
 THEN RAISE EXCEPTION 'production_reservation_campaign_zones_anchor'; END IF;
 body:=replace(body,anchor,'WHERE z->''active''=''true''::JSONB AND z->>''buddieCode'' IS NOT NULL
   AND z->>''id'' IS DISTINCT FROM (public.kq_staff_production_reservation(p_user_id)#>>''{facility,zoneId}'');');
 anchor:='OR member->''state''->''warehouse''->''sourceState'' IS DISTINCT FROM layout.state';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1
 THEN RAISE EXCEPTION 'production_reservation_campaign_metadata_anchor'; END IF;
 body:=replace(body,anchor,anchor||'
   OR (member->''state''->''warehouse'' ? ''productionReservedZoneId''
    AND COALESCE(member->''state''->''warehouse''->''productionReservedZoneId'',''null''::JSONB)
     IS DISTINCT FROM COALESCE(public.kq_staff_production_reservation(p_user_id)#>''{facility,zoneId}'',''null''::JSONB))');
 EXECUTE body;
END
$patch$;
REVOKE ALL ON FUNCTION public.kq_work_inner_start_campaign(UUID,UUID,JSONB,JSONB,INTEGER,TEXT) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
