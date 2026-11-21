BEGIN;

CREATE TABLE public.kq_warehouse_injectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.kq_equipment_wallets(user_id) ON DELETE CASCADE,
  station_id text,
  UNIQUE(user_id,station_id)
);
ALTER TABLE public.kq_warehouse_injectors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_warehouse_injectors FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_warehouse_unmount_injectors() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.kq_warehouse_injectors i SET station_id=NULL
  WHERE i.user_id=NEW.user_id AND i.station_id IS NOT NULL AND NOT EXISTS(
    SELECT FROM jsonb_array_elements(NEW.state->'stationPlacements') s
    WHERE s->>'code'='SIM-WATER-03' AND s->>'id'=i.station_id);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_unmount_injectors() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_warehouse_unmount_injectors AFTER UPDATE OF state ON public.kq_warehouse_layouts
  FOR EACH ROW WHEN (OLD.state IS DISTINCT FROM NEW.state) EXECUTE FUNCTION public.kq_warehouse_unmount_injectors();

ALTER FUNCTION public.rpc_kq_warehouse_preparations(uuid) RENAME TO kq_warehouse_preparations_without_injectors;
REVOKE ALL ON FUNCTION public.kq_warehouse_preparations_without_injectors(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.rpc_kq_warehouse_preparations(p_user_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.kq_warehouse_preparations_without_injectors(p_user_id)||jsonb_build_object('injectorPriceCents',1800,
    'injectors',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'stationId',i.station_id) ORDER BY i.id)
    FROM public.kq_warehouse_injectors i WHERE i.user_id=p_user_id),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_preparations(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_preparations(uuid) TO service_role;

ALTER FUNCTION public.rpc_kq_warehouse_preparation_command(uuid,uuid,jsonb) RENAME TO kq_warehouse_preparation_before_injectors;
REVOKE ALL ON FUNCTION public.kq_warehouse_preparation_before_injectors(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.rpc_kq_warehouse_preparation_command(p_user_id uuid,p_request_key uuid,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous jsonb; station text:=p_command->>'stationId'; plan jsonb; spare uuid; cost integer;
BEGIN
  IF p_command->>'action' NOT IN ('program','injector') THEN
    RETURN public.kq_warehouse_preparation_before_injectors(p_user_id,p_request_key,p_command);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::text,0));
  SELECT command INTO previous FROM public.kq_warehouse_preparation_receipts
    WHERE user_id=p_user_id AND request_key=p_request_key;
  IF FOUND THEN
    IF previous IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'kq_preparation_request_mismatch'; END IF;
    RETURN public.rpc_kq_warehouse_preparations(p_user_id);
  END IF;
  IF p_command->>'action'='program' THEN
    IF coalesce((p_command#>>'{quantities,WAREHOUSE-NUTRITION-SUPPLEMENT}')::integer,0)>0 AND NOT EXISTS(
      SELECT FROM public.kq_warehouse_injectors WHERE user_id=p_user_id AND station_id=station)
    THEN RAISE EXCEPTION 'kq_preparation_injector_required'; END IF;
    RETURN public.kq_warehouse_preparation_before_injectors(p_user_id,p_request_key,p_command);
  END IF;
  SELECT state INTO plan FROM public.kq_warehouse_layouts WHERE user_id=p_user_id FOR UPDATE;
  IF NOT EXISTS(SELECT FROM jsonb_array_elements(plan->'stationPlacements') s
    WHERE s->>'id'=station AND s->>'code'='SIM-WATER-03') THEN RAISE EXCEPTION 'kq_preparation_coverage'; END IF;
  IF EXISTS(SELECT FROM public.kq_warehouse_injectors i WHERE i.user_id=p_user_id AND i.station_id=station)
    THEN RAISE EXCEPTION 'kq_preparation_owned'; END IF;
  SELECT id INTO spare FROM public.kq_warehouse_injectors WHERE user_id=p_user_id AND station_id IS NULL ORDER BY id LIMIT 1 FOR UPDATE;
  cost:=CASE WHEN spare IS NULL THEN 1800 ELSE 0 END;
  IF (p_command->>'expectedCents')::int IS DISTINCT FROM cost THEN RAISE EXCEPTION 'kq_preparation_injector_quote'; END IF;
  IF spare IS NOT NULL THEN
    UPDATE public.kq_warehouse_injectors SET station_id=station WHERE id=spare;
  ELSE
    PERFORM public.kq_treasury_initialize(p_user_id);
    UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-cost,updated_at=now() WHERE user_id=p_user_id AND cash_cents>=cost;
    IF NOT FOUND THEN RAISE EXCEPTION 'kq_preparation_cash'; END IF;
    INSERT INTO public.kq_warehouse_injectors(user_id,station_id) VALUES(p_user_id,station);
    PERFORM public.kq_treasury_pair(p_user_id,'culture-input','warehouse-injector:'||p_request_key::text,
      now(),'expense_other','suspense',cost,'Injecteur de complément');
  END IF;
  INSERT INTO public.kq_warehouse_preparation_receipts(user_id,request_key,command) VALUES(p_user_id,p_request_key,p_command);
  RETURN public.rpc_kq_warehouse_preparations(p_user_id);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_preparation_command(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_preparation_command(uuid,uuid,jsonb) TO service_role;
COMMIT;
