BEGIN;

-- The crop health screen still checks symptoms, the intervention window and
-- the selected square. Its dose now comes from the allocation of that zone.
CREATE FUNCTION public.kq_warehouse_care_inventory(p_user uuid, p_run uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('productCode',code,'quantity',quantity,
    'legacyQuantity',0,'areaQuantity',quantity) ORDER BY code),'[]'::jsonb)
  FROM (
    SELECT i.code, sum(i.reserved) AS quantity
    FROM public.kq_runs leader
    JOIN public.kq_runs member ON member.user_id=leader.user_id
      AND (member.id=leader.id OR member.campaign_id=leader.campaign_id)
    JOIN public.kq_warehouse_run_inputs i ON i.run_id=member.id
    WHERE leader.id=p_run AND leader.user_id=p_user AND member.status='active' AND i.code LIKE 'CARE-%'
    GROUP BY i.code
    UNION ALL
    SELECT item->>'code',(item->>'availableQuantity')::bigint
    FROM jsonb_array_elements(CASE WHEN p_run IS NULL THEN public.rpc_kq_warehouse_preparations(p_user)->'items' ELSE '[]'::jsonb END) item
    WHERE item->>'code' LIKE 'CARE-%'
  ) stock;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_care_inventory(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

DO $migration$
DECLARE body text; at_start int; at_end int; old text; replacement text;
BEGIN
  body:=replace(pg_get_functiondef('public.kq_work_inner_apply_care(uuid,uuid,text,uuid,timestamptz,jsonb,integer)'::regprocedure),chr(13),'');
  at_start:=strpos(body,E'   IF target IS NOT NULL THEN\n     UPDATE public.kq_care_inventory');
  old:='IF NOT FOUND THEN RAISE EXCEPTION ''kq_care_stock_unavailable''; END IF;';
  at_end:=strpos(body,old);
  IF at_start=0 OR at_end<at_start THEN RAISE EXCEPTION 'warehouse_care_consumption_definition_changed'; END IF;
  replacement:=$care$
   IF run.state ? 'warehousePreparations' THEN
     PERFORM public.kq_warehouse_consume_inputs(p_user_id,(
       SELECT member.id FROM public.kq_runs member WHERE member.user_id=run.user_id AND member.status='active'
         AND (member.id=run.id OR member.campaign_id=run.campaign_id)
         AND member.warehouse_zone_id=coalesce(target->>'zoneId',run.warehouse_zone_id)
     ),jsonb_build_object(p_product_code,1));
     units:=1; area:=1;
   ELSE
  $care$ || substr(body,at_start,at_end+length(old)-at_start) || E'\n   END IF;';
  body:=overlay(body placing replacement from at_start for at_end+length(old)-at_start);
  old:='public.kq_care_inventory_for_run(p_user_id,run.state)';
  replacement:='CASE WHEN run.state ? ''warehousePreparations'' THEN public.kq_warehouse_care_inventory(p_user_id,p_run_id) ELSE '||old||' END';
  EXECUTE replace(body,old,replacement);
  body:=pg_get_functiondef('public.rpc_kq_care_intervention_receipt(uuid,uuid,uuid,text,jsonb)'::regprocedure);
  EXECUTE replace(body,old,replacement);
  body:=pg_get_functiondef('public.rpc_kq_care_shop_v2(uuid,uuid)'::regprocedure);
  IF strpos(body,old)=0 THEN RAISE EXCEPTION 'warehouse_care_shop_definition_changed'; END IF;
  EXECUTE replace(body,old,replace(replacement,'WHEN run.state','WHEN p_run_id IS NULL OR run.state'));
END;
$migration$;

-- Keep the standalone shop entry point at the same per-dose price. A run's
-- health screen can spend its reservation through the care RPC above.
CREATE OR REPLACE FUNCTION public.rpc_kq_purchase_care_v2(
  p_user_id uuid,p_product_code text,p_quantity integer,p_request_key uuid,p_run_id uuid,p_expected_price_cents integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE price integer; snapshot jsonb; replay boolean;
BEGIN
  IF p_run_id IS NOT NULL THEN RAISE EXCEPTION 'warehouse_care_locked'; END IF;
  price:=public.kq_care_price(p_product_code);
  IF price IS NULL OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
  IF price*p_quantity IS DISTINCT FROM p_expected_price_cents THEN RAISE EXCEPTION 'kq_care_price_changed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::text,0));
  SELECT EXISTS(SELECT FROM public.kq_warehouse_preparation_receipts WHERE user_id=p_user_id AND request_key=p_request_key) INTO replay;
  snapshot:=public.rpc_kq_warehouse_preparation_command(p_user_id,p_request_key,
    jsonb_build_object('action','purchase','code',p_product_code,'quantity',p_quantity,'requestKey',p_request_key));
  RETURN jsonb_build_object('cashCents',snapshot->'cashCents','inventory',public.kq_warehouse_care_inventory(p_user_id,NULL),
    'totalPriceCents',price*p_quantity,'replayed',replay);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_purchase_care_v2(uuid,text,integer,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_purchase_care_v2(uuid,text,integer,uuid,uuid,integer) TO service_role;

COMMIT;
