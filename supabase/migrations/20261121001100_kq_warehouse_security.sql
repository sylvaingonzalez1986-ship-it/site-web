BEGIN;

CREATE TABLE public.kq_warehouse_security (
 user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 alarm TEXT NOT NULL DEFAULT 'none' CHECK(alarm IN ('none','owned','installed')),
 monitoring_status TEXT NOT NULL DEFAULT 'none' CHECK(monitoring_status IN ('none','active','suspended','cancelled')),
 monitoring_enabled BOOLEAN NOT NULL DEFAULT false,
 paid_until TIMESTAMPTZ,
 CHECK(monitoring_status='none' OR alarm='installed'),
 CHECK(NOT monitoring_enabled OR (paid_until IS NOT NULL AND monitoring_status IN ('active','cancelled')))
);
CREATE INDEX kq_warehouse_security_due ON public.kq_warehouse_security(paid_until) WHERE monitoring_status='active';

CREATE TABLE public.kq_warehouse_security_cameras (
 user_id UUID NOT NULL REFERENCES public.kq_warehouse_security(user_id) ON DELETE CASCADE,
 id UUID NOT NULL,
 x INTEGER,
 y INTEGER,
 bearing INTEGER,
 bought_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,id),
 UNIQUE(user_id,x,y),
 CHECK((x IS NULL AND y IS NULL AND bearing IS NULL) OR
  (x IS NOT NULL AND y IS NOT NULL AND bearing IS NOT NULL AND x BETWEEN 0 AND 39 AND y BETWEEN 0 AND 24 AND bearing BETWEEN 0 AND 7))
);

CREATE TABLE public.kq_warehouse_security_requests (
 user_id UUID NOT NULL REFERENCES public.kq_warehouse_security(user_id) ON DELETE CASCADE,
 request_key UUID NOT NULL,
 request JSONB NOT NULL,
 charged_cents INTEGER NOT NULL CHECK(charged_cents>=0),
 PRIMARY KEY(user_id,request_key)
);

ALTER TABLE public.kq_warehouse_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_warehouse_security_cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_warehouse_security_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_warehouse_security,public.kq_warehouse_security_cameras,public.kq_warehouse_security_requests FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_warehouse_security_prices() RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT '{"cameraCents":8500,"alarmCents":16000,"monitoringCents":1900}'::JSONB;
$$;

CREATE FUNCTION public.kq_warehouse_security_cell_blocked(p_layout JSONB,p_x INTEGER,p_y INTEGER) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT p_layout IS NULL OR p_x IS NULL OR p_y IS NULL OR p_x<0 OR p_y<0
  OR p_x>=COALESCE((p_layout->'floor'->>'columns')::INTEGER,40)
  OR p_y>=COALESCE((p_layout->'floor'->>'rows')::INTEGER,25)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_layout->'partitions','[]'::JSONB)) w WHERE
   CASE w->>'axis' WHEN 'x' THEN p_y=(w->>'y')::INTEGER AND p_x>=(w->>'x')::INTEGER AND p_x<(w->>'x')::INTEGER+(w->>'length')::INTEGER
   ELSE p_x=(w->>'x')::INTEGER AND p_y>=(w->>'y')::INTEGER AND p_y<(w->>'y')::INTEGER+(w->>'length')::INTEGER END)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_layout->'stationPlacements','[]'::JSONB)) s
   WHERE s->>'code'='SIM-WATER-03' AND p_x=(s->>'x')::INTEGER AND p_y=(s->>'y')::INTEGER);
$$;

CREATE FUNCTION public.kq_warehouse_security_layout_guard() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.state->'optionInventory','[]'::JSONB)) n
  WHERE n->>'code' IN ('SIM-SECURITY-01','SIM-SECURITY-02','SIM-SECURITY-03','SIM-NUTRITION-01','SIM-NUTRITION-02','SIM-NUTRITION-03',
   'SIM-HYGIENE-01','SIM-HYGIENE-02') AND (n->>'quantity')::INTEGER >
   COALESCE((SELECT (o->>'quantity')::INTEGER FROM jsonb_array_elements(CASE WHEN TG_OP='UPDATE' THEN COALESCE(OLD.state->'optionInventory','[]'::JSONB) ELSE '[]'::JSONB END) o
    WHERE o->>'code'=n->>'code'),0)) THEN RAISE EXCEPTION 'warehouse_retired_option_purchase'; END IF;
 UPDATE public.kq_warehouse_security_cameras SET x=NULL,y=NULL,bearing=NULL
  WHERE user_id=NEW.user_id AND x IS NOT NULL AND public.kq_warehouse_security_cell_blocked(NEW.state,x,y);
 IF FOUND THEN UPDATE public.kq_warehouse_security SET revision=revision+1 WHERE user_id=NEW.user_id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_warehouse_security_layout_guard BEFORE INSERT OR UPDATE OF state ON public.kq_warehouse_layouts
FOR EACH ROW EXECUTE FUNCTION public.kq_warehouse_security_layout_guard();

CREATE FUNCTION public.kq_warehouse_security_charge(p_user UUID,p_kind TEXT,p_key TEXT,p_at TIMESTAMPTZ,p_cents INTEGER) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_cents<=0 THEN RETURN; END IF;
 PERFORM public.kq_treasury_initialize(p_user);
 UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-p_cents,updated_at=now()
  WHERE user_id=p_user AND cash_cents>=p_cents;
 IF NOT FOUND THEN RAISE EXCEPTION 'warehouse_security_cash'; END IF;
 IF p_kind='warehouse-security-monitoring' THEN
  PERFORM public.kq_treasury_pair(p_user,p_kind,p_key,p_at,'expense_other','suspense',p_cents,'Télésurveillance de l’entrepôt');
 ELSE
  PERFORM public.kq_treasury_add_asset(p_user,p_key,'equipment','expense_depreciation',p_cents,p_at,4320,
   CASE WHEN p_kind='warehouse-security-camera' THEN 'Caméra de l’entrepôt' ELSE 'Alarme de l’entrepôt' END);
 END IF;
 INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user,p_kind,p_cents,p_at);
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user;
END $$;

CREATE FUNCTION public.kq_warehouse_security_settle(p_user UUID,p_at TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_term public.kq_warehouse_security%ROWTYPE;
 fee INTEGER:=(public.kq_warehouse_security_prices()->>'monitoringCents')::INTEGER;
BEGIN
 -- Called inside the existing chronological commerce settlement and wallet lock.
 SELECT * INTO current_term FROM public.kq_warehouse_security WHERE user_id=p_user AND monitoring_status='active' AND paid_until<=p_at FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 WHILE current_term.paid_until<=p_at LOOP
  IF NOT EXISTS(SELECT 1 FROM public.kq_equipment_wallets WHERE user_id=p_user AND cash_cents>=fee) THEN
   UPDATE public.kq_warehouse_security SET monitoring_status='suspended',monitoring_enabled=false,revision=revision+1 WHERE user_id=p_user;
   RETURN;
  END IF;
  PERFORM public.kq_warehouse_security_charge(p_user,'warehouse-security-monitoring',
   'warehouse-security-renewal:'||(extract(epoch FROM current_term.paid_until)::NUMERIC)::TEXT,current_term.paid_until,fee);
  current_term.paid_until:=current_term.paid_until+interval '120 hours';
  UPDATE public.kq_warehouse_security SET paid_until=current_term.paid_until,revision=revision+1 WHERE user_id=p_user;
 END LOOP;
END $$;

CREATE FUNCTION public.kq_warehouse_security_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('layout',l.state,'layoutRevision',COALESCE(l.revision,0),'revision',COALESCE(s.revision,0),
  'cashCents',w.cash_cents,'prices',public.kq_warehouse_security_prices(),'alarm',COALESCE(s.alarm,'none'),
  'monitoring',jsonb_build_object('status',COALESCE(s.monitoring_status,'none'),'paidUntil',s.paid_until,
   'enabled',COALESCE(s.monitoring_enabled AND s.paid_until>now(),false)),
  'cameras',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'placement',CASE WHEN c.x IS NOT NULL
   THEN jsonb_build_object('x',c.x,'y',c.y,'bearing',c.bearing) END) ORDER BY c.bought_at,c.id)
   FROM public.kq_warehouse_security_cameras c WHERE c.user_id=p_user),'[]'::JSONB))
 FROM public.kq_equipment_wallets w LEFT JOIN public.kq_warehouse_layouts l USING(user_id)
 LEFT JOIN public.kq_warehouse_security s USING(user_id) WHERE w.user_id=p_user;
$$;

CREATE FUNCTION public.rpc_kq_warehouse_security_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'warehouse_security_request'; END IF;
 PERFORM public.kq_business_settle(p_user_id);
 RETURN public.kq_warehouse_security_snapshot(p_user_id);
END $$;

CREATE FUNCTION public.rpc_kq_warehouse_security_command(p_user_id UUID,p_request_key UUID,p_revision INTEGER,p_layout_revision INTEGER,p_expected_charge INTEGER,p_command JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.kq_warehouse_security%ROWTYPE; l public.kq_warehouse_layouts%ROWTYPE; previous public.kq_warehouse_security_requests%ROWTYPE;
 prices JSONB:=public.kq_warehouse_security_prices(); action TEXT:=p_command->>'action'; charge_kind TEXT; charge INTEGER:=0;
 camera UUID; cell_x INTEGER; cell_y INTEGER; bearing_index INTEGER; at TIMESTAMPTZ:=now();
 request JSONB:=jsonb_build_object('revision',p_revision,'layoutRevision',p_layout_revision,'expectedCharge',p_expected_charge,'command',p_command);
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR p_revision IS NULL OR p_layout_revision IS NULL OR p_expected_charge IS NULL OR action IS NULL
  OR action NOT IN ('buy-camera','place-camera','stow-camera','buy-alarm','install-alarm','subscribe','pause','cancel')
 THEN RAISE EXCEPTION 'warehouse_security_request'; END IF;
 PERFORM public.kq_business_settle(p_user_id);
 SELECT * INTO previous FROM public.kq_warehouse_security_requests WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF previous.request IS DISTINCT FROM request THEN RAISE EXCEPTION 'warehouse_security_request_reused'; END IF;
  RETURN public.kq_warehouse_security_snapshot(p_user_id)||jsonb_build_object('receipt',jsonb_build_object('chargedCents',previous.charged_cents,'replayed',true));
 END IF;
 SELECT * INTO l FROM public.kq_warehouse_layouts WHERE user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'warehouse_security_layout'; END IF;
 IF l.revision<>p_layout_revision THEN RAISE EXCEPTION 'warehouse_security_changed'; END IF;
 INSERT INTO public.kq_warehouse_security(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO s FROM public.kq_warehouse_security WHERE user_id=p_user_id FOR UPDATE;
 IF s.revision<>p_revision THEN RAISE EXCEPTION 'warehouse_security_changed'; END IF;

 CASE action
 WHEN 'buy-camera' THEN
  IF (SELECT count(*) FROM public.kq_warehouse_security_cameras WHERE user_id=p_user_id)>=12 THEN RAISE EXCEPTION 'warehouse_security_camera_limit'; END IF;
  charge:=(prices->>'cameraCents')::INTEGER; charge_kind:='warehouse-security-camera';
  INSERT INTO public.kq_warehouse_security_cameras(user_id,id) VALUES(p_user_id,p_request_key);
 WHEN 'place-camera' THEN
  camera:=(p_command->>'cameraId')::UUID;
  cell_x:=(p_command->'placement'->>'x')::INTEGER;
  cell_y:=(p_command->'placement'->>'y')::INTEGER;
  bearing_index:=(p_command->'placement'->>'bearing')::INTEGER;
  IF public.kq_warehouse_security_cell_blocked(l.state,cell_x,cell_y) OR bearing_index IS NULL OR bearing_index NOT BETWEEN 0 AND 7
   OR EXISTS(SELECT 1 FROM public.kq_warehouse_security_cameras WHERE user_id=p_user_id AND id<>camera AND x=cell_x AND y=cell_y)
  THEN RAISE EXCEPTION 'warehouse_security_camera_position'; END IF;
  UPDATE public.kq_warehouse_security_cameras SET x=cell_x,y=cell_y,bearing=bearing_index WHERE user_id=p_user_id AND id=camera;
  IF NOT FOUND THEN RAISE EXCEPTION 'warehouse_security_camera_unknown'; END IF;
 WHEN 'stow-camera' THEN
  UPDATE public.kq_warehouse_security_cameras SET x=NULL,y=NULL,bearing=NULL WHERE user_id=p_user_id AND id=(p_command->>'cameraId')::UUID;
  IF NOT FOUND THEN RAISE EXCEPTION 'warehouse_security_camera_unknown'; END IF;
 WHEN 'buy-alarm' THEN
  IF s.alarm<>'none' THEN RAISE EXCEPTION 'warehouse_security_alarm_owned'; END IF;
  charge:=(prices->>'alarmCents')::INTEGER; charge_kind:='warehouse-security-alarm'; s.alarm:='owned';
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

DO $$
DECLARE definition TEXT; anchor TEXT;
BEGIN
 SELECT pg_get_functiondef('public.kq_online_settle_until(uuid,timestamptz)'::regprocedure) INTO definition;
 anchor:='  PERFORM public.kq_storage_climate_settle_until(p_user,cursor_at);';
 -- The historical climate migration appends its call on the business event line.
 anchor:=ltrim(anchor);
 IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'warehouse_security_settlement_anchor'; END IF;
 definition:=replace(definition,anchor,anchor||E'\n  PERFORM public.kq_warehouse_security_settle(p_user,cursor_at);');
 anchor:='public.kq_online_next_bank_event(p_user,cursor_at));';
 IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'warehouse_security_deadline_anchor'; END IF;
 EXECUTE replace(definition,anchor,'(SELECT paid_until FROM public.kq_warehouse_security WHERE user_id=p_user AND monitoring_status=''active''), '||anchor);

 SELECT pg_get_functiondef('public.rpc_kq_online_settle_due(integer)'::regprocedure) INTO definition;
 anchor:='  AND (EXISTS(SELECT 1 FROM public.kq_online_merch_inventory';
 IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'warehouse_security_cron_anchor'; END IF;
 EXECUTE replace(definition,anchor,'  AND (EXISTS(SELECT 1 FROM public.kq_warehouse_security s WHERE s.user_id=kq_online_accounts.user_id AND s.monitoring_status=''active'' AND s.paid_until<=now()) OR EXISTS(SELECT 1 FROM public.kq_online_merch_inventory');
END $$;

REVOKE ALL ON FUNCTION public.kq_warehouse_security_prices(),public.kq_warehouse_security_cell_blocked(JSONB,INTEGER,INTEGER),
 public.kq_warehouse_security_layout_guard(),public.kq_warehouse_security_charge(UUID,TEXT,TEXT,TIMESTAMPTZ,INTEGER),
 public.kq_warehouse_security_settle(UUID,TIMESTAMPTZ),public.kq_warehouse_security_snapshot(UUID),
 public.rpc_kq_warehouse_security_snapshot(UUID),public.rpc_kq_warehouse_security_command(UUID,UUID,INTEGER,INTEGER,INTEGER,JSONB)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_security_snapshot(UUID),public.rpc_kq_warehouse_security_command(UUID,UUID,INTEGER,INTEGER,INTEGER,JSONB) TO service_role;

COMMIT;
