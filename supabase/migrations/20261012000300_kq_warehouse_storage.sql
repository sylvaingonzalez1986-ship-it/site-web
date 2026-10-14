-- The physical warehouse keeps unsold goods. Its storage does not create
-- automatic wholesale buyers after the historical one-hour grace period.
-- Containers are already synchronized by 20261012000200; do not add them twice.
-- A converted account manages its historical lots in the same physical room.
CREATE FUNCTION public.kq_is_warehouse_flower(p_flower UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.kq_flowers f LEFT JOIN public.kq_runs r ON r.id=f.run_id
  WHERE f.id=p_flower AND (r.state ? 'warehouse'
   OR EXISTS(SELECT 1 FROM public.kq_warehouse_layouts l WHERE l.user_id=f.owner_id)));
$$;
REVOKE ALL ON FUNCTION public.kq_is_warehouse_flower(UUID) FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.kq_storage_allocate(uuid,text,boolean)'::regprocedure) INTO body;
 fragment:='capacity:=jsonb_build_object(''totalUnits'',total,''allocations'',allocations,''overflowDeadlineAt'',deadline);';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'warehouse_storage_capacity_anchor_changed'; END IF;
 body:=replace(body,fragment,fragment||E'\n IF public.kq_is_warehouse_flower(p_flower) THEN\n  capacity:=capacity||jsonb_build_object(''automaticOverflowSale'',false,''overflowDeadlineAt'',NULL);\n END IF;');
 EXECUTE body;

 SELECT pg_get_functiondef('public.kq_storage_sell_overflow(uuid,boolean)'::regprocedure) INTO body;
 fragment:='IF NOT FOUND THEN RETURN NULL; END IF;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'warehouse_storage_automatic_sale_anchor_changed'; END IF;
 body:=replace(body,fragment,fragment||E'\n IF p_automatic AND public.kq_is_warehouse_flower(p_flower) THEN RETURN NULL; END IF;');
 -- A requested surplus sale uses the same shared wholesale allowance as other
 -- sales. It cannot be used to bypass demand by changing the sale entry point.
 fragment:='IF units<=0 THEN RETURN NULL; END IF;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'warehouse_storage_manual_sale_anchor_changed'; END IF;
 body:=replace(body,fragment,fragment||E'\n IF NOT p_automatic THEN\n  IF EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=lot.user_id) THEN\n   INSERT INTO public.kq_commerce_accounts(user_id) VALUES(lot.user_id) ON CONFLICT DO NOTHING;\n   units:=LEAST(units,GREATEST(0,floor(COALESCE((public.kq_warehouse_wholesale_budget(lot.user_id)->>''remainingEquivalentUnits'')::NUMERIC,0)))::INTEGER);\n   IF units<=0 THEN RAISE EXCEPTION ''warehouse_wholesale_exhausted''; END IF;\n  END IF;\n  PERFORM public.kq_warehouse_consume_wholesale(lot.user_id,receipt,units);\n END IF;');
 EXECUTE body;
END $$;

-- Show the same partial quantity that settlement can buy now. The unpurchased
-- surplus remains in the lot; an oversized harvest is never blocked forever.
CREATE OR REPLACE FUNCTION public.kq_storage_overflow_offer(p_user UUID,p_state JSONB,p_sold INTEGER) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE units INTEGER; payout INTEGER;
BEGIN
 units:=(p_state->'capacity'->>'totalUnits')::INTEGER-COALESCE((SELECT sum((e->>'storedUnits')::INTEGER)
  FROM jsonb_array_elements(p_state->'capacity'->'allocations') e),0);
 IF EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=p_user) THEN
  units:=LEAST(units,GREATEST(0,floor(COALESCE((public.kq_warehouse_wholesale_budget(p_user)->>'remainingEquivalentUnits')::NUMERIC,0)))::INTEGER);
 END IF;
 IF units<=0 THEN RETURN NULL; END IF;
 payout:=round((p_sold+units)::NUMERIC*54/10)-round(p_sold::NUMERIC*54/10);
 RETURN jsonb_build_object('units',units,'payoutCents',payout)||public.kq_business_sale_preview(p_user,payout);
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_overflow_offer(UUID,JSONB,INTEGER) FROM PUBLIC,anon,authenticated,service_role;

-- Bulk stock reaches zero when it is packaged, before any buyer has paid.
-- Keep each listing's original material ratio available for sales forecasts.
DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.kq_online_snapshot(uuid)'::regprocedure) INTO body;
 fragment:='''baseUnitCents'',s.base_unit_cents';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'warehouse_online_mass_ratio_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,fragment||',''equivalentUnitsPerProductUnit'',s.equivalent_units::NUMERIC/NULLIF(s.initial_units,0)');
END $$;

UPDATE public.kq_storage_lots s
SET state=jsonb_set(state,'{capacity}',(state->'capacity')||jsonb_build_object('automaticOverflowSale',false,'overflowDeadlineAt',NULL)),
 revision=revision+1
WHERE state ? 'capacity' AND public.kq_is_warehouse_flower(s.flower_id);
