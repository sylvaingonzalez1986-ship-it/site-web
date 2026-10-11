BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Reads still settle due charges and surplus sales under the same player lock.
-- Share that preparation with commands without building an unused JSON snapshot.
CREATE OR REPLACE FUNCTION public.kq_storage_prepare_state(p_user_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'storage_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM public.kq_business_settle(p_user_id);
 PERFORM public.kq_storage_settle_user(p_user_id);
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_prepare_state(UUID) FROM PUBLIC,anon,authenticated,service_role;

-- Both callers prepare first. The market retains archived lot states, while the
-- warehouse excludes sold lots before verdict/offer calculation and JSON transfer.
CREATE OR REPLACE FUNCTION public.kq_storage_snapshot(p_user_id UUID,p_active_only BOOLEAN) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_storage_accounts%ROWTYPE; cash INTEGER; bought BIGINT; used BIGINT; reserved BIGINT; overflow BIGINT;
BEGIN
 SELECT * INTO a FROM public.kq_storage_accounts WHERE user_id=p_user_id;
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
 SELECT COALESCE(sum(quantity*(public.kq_storage_container(container_code)->>'capacityUnits')::INTEGER),0) INTO bought FROM public.kq_storage_containers WHERE user_id=p_user_id;
 SELECT COALESCE(sum((e->>'storedUnits')::INTEGER),0),COALESCE(sum((e->>'quantity')::INTEGER*(public.kq_storage_container(e->>'containerCode')->>'capacityUnits')::INTEGER),0)
  INTO used,reserved FROM public.kq_storage_lots,LATERAL jsonb_array_elements(state->'capacity'->'allocations') e WHERE user_id=p_user_id;
 SELECT COALESCE(sum((state->'capacity'->>'totalUnits')::INTEGER),0)-used INTO overflow FROM public.kq_storage_lots WHERE user_id=p_user_id;
 RETURN jsonb_build_object('serverNow',now(),'cashCents',cash,'ownedMethodCodes',a.owned_method_codes,'defaultMethodCode',a.default_method_code,
  'ownedContainers',COALESCE((SELECT jsonb_object_agg(container_code,quantity) FROM public.kq_storage_containers WHERE user_id=p_user_id),'{}'),
  'capacity',jsonb_build_object('totalUnits',bought,'usedUnits',used,'freeUnits',bought-reserved,'reservedUnits',reserved,'overflowUnits',overflow),
  'overflowSales',COALESCE((SELECT jsonb_agg(jsonb_build_object('flowerId',flower_id,'units',units,'payoutCents',payout_cents,'netPayoutCents',net_payout_cents,'automatic',automatic,'soldAt',sold_at) ORDER BY sold_at DESC)
   FROM (SELECT * FROM public.kq_storage_overflow_sales WHERE user_id=p_user_id ORDER BY sold_at DESC LIMIT 20) sales),'[]'),
  'lots',COALESCE((SELECT jsonb_agg(jsonb_build_object('flowerId',s.flower_id,'varietyName',f.variety_name,'flowerStatus',f.status,
   'harvestGrams',s.original_units::NUMERIC/10,'state',s.state,'revision',s.revision,'juryScore',COALESCE(m.jury_score,public.kq_storage_verdict_score(s.flower_id)),
   'overflowOffer',public.kq_storage_overflow_offer(p_user_id,s.state,s.overflow_sold_units),
   'marketStatus',CASE WHEN (s.state->'capacity'->>'totalUnits')::INTEGER=0 THEN 'sold' ELSE m.status END) ORDER BY f.burned_at DESC,s.flower_id)
   FROM public.kq_storage_lots s JOIN public.kq_flowers f ON f.id=s.flower_id LEFT JOIN public.kq_market_lots m ON m.flower_id=s.flower_id
   WHERE s.user_id=p_user_id AND (NOT p_active_only OR ((s.state->'capacity'->>'totalUnits')::INTEGER>0 AND m.status IS DISTINCT FROM 'sold'))),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_snapshot(UUID,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_storage_state(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.kq_storage_prepare_state(p_user_id);
 RETURN public.kq_storage_snapshot(p_user_id,false);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_storage_state(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_storage_state(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_warehouse_storage_state(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.kq_storage_prepare_state(p_user_id);
 RETURN public.kq_storage_snapshot(p_user_id,true);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_storage_state(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_storage_state(UUID) TO service_role;

-- Purchases/reassignments/surplus sales keep their transaction and idempotency
-- guards. Only their unused pre-command snapshot and returned archive change.
DO $$ DECLARE definition TEXT; BEGIN
 definition:=pg_get_functiondef('public.rpc_kq_storage_capacity_command(uuid,text,text,text,integer,uuid,uuid)'::regprocedure);
 IF position('PERFORM public.rpc_kq_storage_state(p_user_id);' IN definition)>0 THEN
  definition:=replace(definition,'PERFORM public.rpc_kq_storage_state(p_user_id);','PERFORM public.kq_storage_prepare_state(p_user_id);');
  definition:=replace(definition,'RETURN public.rpc_kq_storage_state(p_user_id)','RETURN public.rpc_kq_warehouse_storage_state(p_user_id)');
  EXECUTE definition;
 ELSIF position('PERFORM public.kq_storage_prepare_state(p_user_id);' IN definition)=0
  OR position('RETURN public.rpc_kq_warehouse_storage_state(p_user_id)' IN definition)=0 THEN
  RAISE EXCEPTION 'storage_budget_command_anchor_missing';
 END IF;
END $$;

COMMIT;
