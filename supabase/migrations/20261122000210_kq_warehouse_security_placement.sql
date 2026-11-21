BEGIN;

-- Charge new installations in the same transaction as their validated placement.
CREATE OR REPLACE FUNCTION public.rpc_kq_warehouse_security_command(p_user_id UUID,p_request_key UUID,p_revision INTEGER,p_layout_revision INTEGER,p_expected_charge INTEGER,p_command JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.kq_warehouse_security%ROWTYPE; l public.kq_warehouse_layouts%ROWTYPE; previous public.kq_warehouse_security_requests%ROWTYPE;
 prices JSONB:=public.kq_warehouse_security_prices(); action TEXT:=p_command->>'action'; charge_kind TEXT; charge INTEGER:=0;
 camera UUID; cell_x INTEGER; cell_y INTEGER; bearing_index INTEGER; at TIMESTAMPTZ:=now();
 request JSONB:=jsonb_build_object('revision',p_revision,'layoutRevision',p_layout_revision,'expectedCharge',p_expected_charge,'command',p_command);
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR p_revision IS NULL OR p_layout_revision IS NULL OR p_expected_charge IS NULL OR action IS NULL
  OR action NOT IN ('buy-camera','buy-place-camera','place-camera','stow-camera','buy-alarm','buy-install-alarm','install-alarm','subscribe','pause','cancel')
 THEN RAISE EXCEPTION 'warehouse_security_request'; END IF;
 PERFORM public.kq_business_settle(p_user_id);
 SELECT * INTO previous FROM public.kq_warehouse_security_requests WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF previous.request IS DISTINCT FROM request THEN RAISE EXCEPTION 'warehouse_security_request_reused'; END IF;
  RETURN public.kq_warehouse_security_snapshot(p_user_id)||jsonb_build_object('receipt',jsonb_build_object('chargedCents',previous.charged_cents,'replayed',true));
 END IF;
 SELECT * INTO l FROM public.kq_warehouse_layouts WHERE user_id=p_user_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'warehouse_security_layout'; END IF;
 IF l.revision<>p_layout_revision THEN RAISE EXCEPTION 'warehouse_security_changed'; END IF;
 INSERT INTO public.kq_warehouse_security(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO s FROM public.kq_warehouse_security WHERE user_id=p_user_id FOR UPDATE;
 IF s.revision<>p_revision THEN RAISE EXCEPTION 'warehouse_security_changed'; END IF;

 CASE action
 WHEN 'buy-camera', 'buy-place-camera', 'place-camera' THEN
  IF action='place-camera' THEN
    camera:=(p_command->>'cameraId')::uuid;
  ELSE
    camera:=p_request_key;
    IF (SELECT count(*) FROM public.kq_warehouse_security_cameras WHERE user_id=p_user_id)>=12 THEN RAISE EXCEPTION 'warehouse_security_camera_limit'; END IF;
    charge:=(prices->>'cameraCents')::INTEGER; charge_kind:='warehouse-security-camera';
    INSERT INTO public.kq_warehouse_security_cameras(user_id,id) VALUES(p_user_id,p_request_key);
  END IF;
  IF action<>'buy-camera' THEN
    cell_x:=(p_command->'placement'->>'x')::INTEGER;
    cell_y:=(p_command->'placement'->>'y')::INTEGER;
    bearing_index:=(p_command->'placement'->>'bearing')::INTEGER;
    IF cell_x IS NULL OR cell_y IS NULL OR public.kq_warehouse_security_cell_blocked(l.state,cell_x,cell_y) OR bearing_index IS NULL OR bearing_index NOT BETWEEN 0 AND 7
     OR EXISTS(SELECT 1 FROM public.kq_warehouse_security_cameras WHERE user_id=p_user_id AND id<>camera AND x=cell_x AND y=cell_y)
    THEN RAISE EXCEPTION 'warehouse_security_camera_position'; END IF;
    UPDATE public.kq_warehouse_security_cameras SET x=cell_x,y=cell_y,bearing=bearing_index WHERE user_id=p_user_id AND id=camera;
    IF NOT FOUND THEN RAISE EXCEPTION 'warehouse_security_camera_unknown'; END IF;
  END IF;
 WHEN 'stow-camera' THEN
  UPDATE public.kq_warehouse_security_cameras SET x=NULL,y=NULL,bearing=NULL WHERE user_id=p_user_id AND id=(p_command->>'cameraId')::UUID;
  IF NOT FOUND THEN RAISE EXCEPTION 'warehouse_security_camera_unknown'; END IF;
 WHEN 'buy-alarm', 'buy-install-alarm' THEN
  IF s.alarm<>'none' THEN RAISE EXCEPTION 'warehouse_security_alarm_owned'; END IF;
  charge:=(prices->>'alarmCents')::INTEGER; charge_kind:='warehouse-security-alarm'; s.alarm:=CASE WHEN action='buy-install-alarm' THEN 'installed' ELSE 'owned' END;
 WHEN 'install-alarm' THEN
  IF s.alarm<>'owned' THEN RAISE EXCEPTION 'warehouse_security_alarm_required'; END IF;
  s.alarm:='installed';
 WHEN 'subscribe' THEN
  IF s.alarm<>'installed' THEN RAISE EXCEPTION 'warehouse_security_alarm_required'; END IF;
  IF s.paid_until IS NULL OR s.paid_until<=at THEN
   charge:=(prices->>'monitoringCents')::INTEGER; charge_kind:='warehouse-security-monitoring';
   s.paid_until:=at+interval '120 hours';
  END IF;
  s.monitoring_status:='active'; s.monitoring_enabled:=true;
 WHEN 'pause' THEN
  IF s.monitoring_status<>'active' THEN RAISE EXCEPTION 'warehouse_security_monitoring_inactive'; END IF;
  s.monitoring_status:='suspended'; s.monitoring_enabled:=false;
 WHEN 'cancel' THEN
  IF s.monitoring_status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'warehouse_security_monitoring_inactive'; END IF;
  s.monitoring_status:='cancelled';
 END CASE;

 IF p_expected_charge<>charge THEN RAISE EXCEPTION 'warehouse_security_price_changed'; END IF;
 PERFORM public.kq_warehouse_security_charge(p_user_id,charge_kind,'warehouse-security:'||p_request_key,at,charge);
 UPDATE public.kq_warehouse_security SET alarm=s.alarm,monitoring_status=s.monitoring_status,
  monitoring_enabled=s.monitoring_enabled,paid_until=s.paid_until,revision=revision+1 WHERE user_id=p_user_id;
 INSERT INTO public.kq_warehouse_security_requests VALUES(p_user_id,p_request_key,request,charge);
 RETURN public.kq_warehouse_security_snapshot(p_user_id)||jsonb_build_object('receipt',jsonb_build_object('chargedCents',charge,'replayed',false));
END $$;

COMMIT;
