BEGIN;

CREATE TABLE public.kq_warehouse_input_stock (
 user_id UUID NOT NULL REFERENCES public.kq_equipment_wallets(user_id) ON DELETE CASCADE,
 code TEXT NOT NULL,
 quantity BIGINT NOT NULL CHECK(quantity>=0),
 PRIMARY KEY(user_id,code)
);
CREATE TABLE public.kq_warehouse_preparation_receipts (
 user_id UUID NOT NULL REFERENCES public.kq_equipment_wallets(user_id) ON DELETE CASCADE,
 request_key UUID NOT NULL,
 command JSONB NOT NULL,
 PRIMARY KEY(user_id,request_key)
);
CREATE TABLE public.kq_warehouse_cleaning_work (
 user_id UUID NOT NULL REFERENCES public.kq_equipment_wallets(user_id) ON DELETE CASCADE,
 request_key UUID NOT NULL,
 step TEXT NOT NULL CHECK(step IN ('vacuum','mop')),
 actor TEXT NOT NULL,
 starts_at TIMESTAMPTZ NOT NULL,
 ends_at TIMESTAMPTZ NOT NULL CHECK(ends_at>starts_at),
 PRIMARY KEY(user_id,request_key)
);
CREATE INDEX kq_warehouse_cleaning_latest ON public.kq_warehouse_cleaning_work(user_id,step,ends_at DESC);
CREATE TABLE public.kq_warehouse_irrigation_programs (
 user_id UUID NOT NULL REFERENCES public.kq_equipment_wallets(user_id) ON DELETE CASCADE,
 station_id TEXT NOT NULL,
 zone_id TEXT NOT NULL,
 placement JSONB NOT NULL,
 quantities JSONB NOT NULL,
 starts_at TIMESTAMPTZ NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL CHECK(expires_at>starts_at),
 PRIMARY KEY(user_id,station_id,zone_id)
);
CREATE TABLE public.kq_warehouse_run_inputs (
 run_id UUID NOT NULL REFERENCES public.kq_runs(id) ON DELETE CASCADE,
 code TEXT NOT NULL,
 reserved INTEGER NOT NULL CHECK(reserved>=0),
 consumed INTEGER NOT NULL CHECK(consumed>=0),
 PRIMARY KEY(run_id,code)
);
ALTER TABLE public.kq_warehouse_input_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_warehouse_preparation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_warehouse_cleaning_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_warehouse_irrigation_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_warehouse_run_inputs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_warehouse_input_stock FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON TABLE public.kq_warehouse_preparation_receipts FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON TABLE public.kq_warehouse_cleaning_work FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON TABLE public.kq_warehouse_irrigation_programs FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON TABLE public.kq_warehouse_run_inputs FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_warehouse_preparation_catalog()
RETURNS TABLE(code TEXT,name TEXT,kind TEXT,price_cents INTEGER,unit TEXT)
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 VALUES ('WAREHOUSE-VACUUM','Aspirateur','equipment',400,'outil'),
 ('WAREHOUSE-MOP','Serpillière','equipment',1100,'outil'),
 ('WAREHOUSE-NUTRITION-BASE','Nutrition de base','consumable',180,'dose'),
 ('WAREHOUSE-NUTRITION-SUPPLEMENT','Complément de nutrition','consumable',240,'dose'),
 ('WAREHOUSE-PBI','Protection biologique','consumable',320,'dose'),
 ('WAREHOUSE-MAINTENANCE','Fournitures d’entretien','consumable',80,'dose'),
 ('CARE-COMPOST-TEA','Thé de compost','consumable',public.kq_care_price('CARE-COMPOST-TEA'),'dose'),
 ('CARE-VERMICOMPOST','Lombricompost','consumable',public.kq_care_price('CARE-VERMICOMPOST'),'dose'),
 ('CARE-ORGANIC-FEED','Engrais organique','consumable',public.kq_care_price('CARE-ORGANIC-FEED'),'dose'),
 ('CARE-SEAWEED','Extrait d’algues','consumable',public.kq_care_price('CARE-SEAWEED'),'dose'),
 ('CARE-APHIDIUS','Aphidius colemani','consumable',public.kq_care_price('CARE-APHIDIUS'),'dose'),
 ('CARE-PHYTOSEIULUS','Phytoseiulus persimilis','consumable',public.kq_care_price('CARE-PHYTOSEIULUS'),'dose'),
 ('CARE-SWIRSKII','Amblyseius swirskii','consumable',public.kq_care_price('CARE-SWIRSKII'),'dose'),
 ('CARE-ORIUS','Orius laevigatus','consumable',public.kq_care_price('CARE-ORIUS'),'dose'),
 ('CARE-CHRYSOPERLA','Chrysoperla carnea','consumable',public.kq_care_price('CARE-CHRYSOPERLA'),'dose'),
 ('CARE-COCCINELLA','Coccinelle à sept points','consumable',public.kq_care_price('CARE-COCCINELLA'),'dose');
$$;

CREATE FUNCTION public.kq_warehouse_quantities(p_quantities JSONB) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
 IF jsonb_typeof(p_quantities) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_quantities) e LEFT JOIN public.kq_warehouse_preparation_catalog() c ON c.code=e.key
  WHERE c.kind IS DISTINCT FROM 'consumable' OR jsonb_typeof(e.value) IS DISTINCT FROM 'number'
   OR (e.value::numeric NOT BETWEEN 0 AND 1000 OR e.value::numeric<>trunc(e.value::numeric)))
 THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
 RETURN COALESCE((SELECT jsonb_object_agg(key,value) FROM jsonb_each(p_quantities) WHERE value::numeric>0),'{}'::jsonb);
END $$;

-- Reuse the same coordinate, wall, precedence and capacity allocation. The
-- detailed view only changes the output keys to include the assigned station.
DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 body:=pg_get_functiondef('public.kq_warehouse_station_service(jsonb)'::regprocedure);
 body:=replace(body,'public.kq_warehouse_station_service(','public.kq_warehouse_preparation_station_coverage(');
 anchor:='SELECT coalesce(jsonb_object_agg(z->>''id'',''{"waterAreaM2":0,"hygieneAreaM2":0}''::jsonb),''{}''::jsonb) INTO result';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'warehouse_preparation_coverage_anchor'; END IF;
 body:=replace(body,anchor,'SELECT coalesce(jsonb_object_agg(z->>''id'',''{}''::jsonb),''{}''::jsonb) INTO result');
 anchor:='result:=jsonb_set(result,ARRAY[served.zid,field],to_jsonb((result->served.zid->>field)::int+1));';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'warehouse_preparation_coverage_result_anchor'; END IF;
 EXECUTE replace(body,anchor,$body$result:=jsonb_set(result,ARRAY[served.zid,station->>'id'],
  to_jsonb(coalesce((result->served.zid->>(station->>'id'))::int,0)+1));$body$);
END $$;

CREATE FUNCTION public.kq_warehouse_live_programs(p_user UUID,p_layout JSONB,p_coverage JSONB,p_at TIMESTAMPTZ)
RETURNS SETOF public.kq_warehouse_irrigation_programs
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT p.* FROM public.kq_warehouse_irrigation_programs p
 WHERE p.user_id=p_user AND p.starts_at<=p_at AND p.expires_at>p_at
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_layout->'stationPlacements') s WHERE s=p.placement)
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_layout->'zones') z WHERE z->>'id'=p.zone_id AND z->'active'='true'::jsonb)
 AND (p_coverage->p.zone_id->>p.station_id)::int>=(p.quantities->>'WAREHOUSE-NUTRITION-BASE')::int;
$$;

CREATE FUNCTION public.kq_warehouse_preparation_inventory(p_user UUID,p_layout JSONB,p_coverage JSONB,p_at TIMESTAMPTZ)
RETURNS TABLE(code TEXT,name TEXT,kind TEXT,price_cents INTEGER,unit TEXT,available BIGINT,reserved BIGINT)
LANGUAGE sql STABLE SET search_path='' AS $$
 WITH holds AS (
  SELECT i.code,i.reserved::bigint AS quantity FROM public.kq_warehouse_run_inputs i JOIN public.kq_runs r ON r.id=i.run_id
   WHERE r.user_id=p_user AND r.status='active'
  UNION ALL
  SELECT e.key,e.value::bigint FROM public.kq_warehouse_live_programs(p_user,p_layout,p_coverage,p_at) p
   CROSS JOIN LATERAL jsonb_each(p.quantities) e
 ), totals AS (SELECT h.code,sum(h.quantity)::bigint AS quantity FROM holds h GROUP BY h.code)
 SELECT c.*,coalesce(s.quantity,0)-coalesce(t.quantity,0),coalesce(t.quantity,0)
 FROM public.kq_warehouse_preparation_catalog() c
 LEFT JOIN public.kq_warehouse_input_stock s ON s.user_id=p_user AND s.code=c.code
 LEFT JOIN totals t ON t.code=c.code;
$$;

CREATE FUNCTION public.kq_warehouse_cleaning_status(p_user UUID,p_step TEXT,p_at TIMESTAMPTZ) RETURNS JSONB
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('completedAt',finished.ends_at,'expiresAt',finished.ends_at+interval '28 hours',
  'pending',CASE WHEN active.ends_at IS NULL THEN NULL ELSE jsonb_build_object(
   'startsAt',active.starts_at,'endsAt',active.ends_at,'workChoice',active.actor) END)
 FROM (SELECT 1) singleton
 LEFT JOIN LATERAL (SELECT w.ends_at FROM public.kq_warehouse_cleaning_work w
  WHERE w.user_id=p_user AND w.step=p_step AND w.ends_at<=p_at ORDER BY w.ends_at DESC LIMIT 1) finished ON true
 LEFT JOIN LATERAL (SELECT w.starts_at,w.ends_at,w.actor FROM public.kq_warehouse_cleaning_work w
  WHERE w.user_id=p_user AND w.step=p_step AND w.ends_at>p_at ORDER BY w.ends_at DESC LIMIT 1) active ON true;
$$;

CREATE FUNCTION public.kq_warehouse_preparation_quote_key(p_user UUID,p_plan JSONB,p_coverage JSONB,p_at TIMESTAMPTZ) RETURNS TEXT
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT md5(jsonb_build_object('programs',COALESCE((SELECT jsonb_agg(jsonb_build_array(p.station_id,p.zone_id,p.quantities,
  extract(epoch FROM p.starts_at),extract(epoch FROM p.expires_at)) ORDER BY p.zone_id,p.station_id)
  FROM public.kq_warehouse_live_programs(p_user,p_plan,p_coverage,p_at) p),'[]'::jsonb),
 'cleaning',COALESCE((SELECT jsonb_object_agg(c.step,extract(epoch FROM c.ends)) FROM (
  SELECT step,max(ends_at) AS ends FROM public.kq_warehouse_cleaning_work WHERE user_id=p_user
   AND ends_at<=p_at AND ends_at+interval '28 hours'>p_at GROUP BY step) c),'{}'::jsonb))::text);
$$;

CREATE FUNCTION public.rpc_kq_warehouse_preparations(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE plan JSONB; coverage JSONB; cash BIGINT; origin TIMESTAMPTZ; at TIMESTAMPTZ:=now();
BEGIN
 SELECT w.cash_cents,coalesce(c.business_started_at,w.created_at) INTO cash,origin
 FROM public.kq_equipment_wallets w LEFT JOIN public.kq_commerce_accounts c USING(user_id) WHERE w.user_id=p_user_id;
 SELECT state INTO plan FROM public.kq_warehouse_layouts WHERE user_id=p_user_id;
 coverage:=CASE WHEN plan ? 'stationPlacements' THEN public.kq_warehouse_preparation_station_coverage(plan) ELSE '{}'::jsonb END;
 RETURN jsonb_build_object('cashCents',coalesce(cash,0),'calendarOrigin',origin,'serverNow',at,
  'quoteKey',public.kq_warehouse_preparation_quote_key(p_user_id,plan,coverage,at),
  'items',(SELECT jsonb_agg(jsonb_build_object('code',i.code,'name',i.name,'kind',i.kind,'priceCents',i.price_cents,
   'unit',i.unit,'availableQuantity',i.available,'reservedQuantity',i.reserved) ORDER BY i.kind DESC,i.price_cents,i.code)
   FROM public.kq_warehouse_preparation_inventory(p_user_id,plan,coverage,at) i),
  'cleaning',jsonb_build_object('vacuum',public.kq_warehouse_cleaning_status(p_user_id,'vacuum',at),
   'mop',public.kq_warehouse_cleaning_status(p_user_id,'mop',at)),
  'coverage',COALESCE((SELECT jsonb_agg(jsonb_build_object('zoneId',z->>'id','areaM2',(z->>'width')::int*(z->>'height')::int,
   'stations',COALESCE((SELECT jsonb_agg(jsonb_build_object('stationId',s->>'id','kind',
    CASE s->>'code' WHEN 'SIM-WATER-03' THEN 'irrigation' ELSE 'hygiene' END,
    'servedM2',(coverage->(z->>'id')->>(s->>'id'))::int) ORDER BY s->>'id')
    FROM jsonb_array_elements(plan->'stationPlacements') s WHERE coverage->(z->>'id') ? (s->>'id')),'[]'::jsonb)) ORDER BY z->>'id')
    FROM jsonb_array_elements(plan->'zones') z),'[]'::jsonb),
  'programs',COALESCE((SELECT jsonb_agg(jsonb_build_object('stationId',p.station_id,'zoneId',p.zone_id,'quantities',p.quantities,
   'startsAt',p.starts_at,'expiresAt',p.expires_at) ORDER BY p.zone_id,p.station_id)
   FROM public.kq_warehouse_live_programs(p_user_id,plan,coverage,at) p),'[]'::jsonb),
  'runs',COALESCE((SELECT jsonb_agg(jsonb_build_object('runId',r.id,'zoneId',r.warehouse_zone_id,
   'reserved',COALESCE(i.reserved,'{}'::jsonb),'consumed',COALESCE(i.consumed,'{}'::jsonb)) ORDER BY r.warehouse_zone_id)
   FROM public.kq_runs r CROSS JOIN LATERAL (SELECT
    jsonb_object_agg(s.code,s.reserved) FILTER(WHERE s.reserved>0) reserved,
    jsonb_object_agg(s.code,s.consumed) FILTER(WHERE s.consumed>0) consumed
    FROM public.kq_warehouse_run_inputs s WHERE s.run_id=r.id) i
   WHERE r.user_id=p_user_id AND r.status='active' AND r.state ? 'warehousePreparations'),'[]'::jsonb));
END $$;

REVOKE ALL ON FUNCTION public.kq_warehouse_preparation_catalog(),public.kq_warehouse_quantities(JSONB),
 public.kq_warehouse_preparation_station_coverage(JSONB),public.kq_warehouse_live_programs(UUID,JSONB,JSONB,TIMESTAMPTZ),
 public.kq_warehouse_preparation_inventory(UUID,JSONB,JSONB,TIMESTAMPTZ),public.kq_warehouse_cleaning_status(UUID,TEXT,TIMESTAMPTZ),
 public.kq_warehouse_preparation_quote_key(UUID,JSONB,JSONB,TIMESTAMPTZ),
 public.rpc_kq_warehouse_preparations(UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_preparations(UUID) TO service_role;

COMMIT;
