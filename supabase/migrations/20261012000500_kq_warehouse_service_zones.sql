BEGIN;

-- Optional serviceZones distinguishes new physical plans from immutable
-- historical plans. No saved culture or existing layout is rewritten here.
DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.kq_storage_container(text)'::regprocedure) INTO body;
 fragment:=' WHEN ''CANNATROL'' THEN';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'service_container_catalog_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,E' WHEN ''CURTEC-60L'' THEN ''{"methodCode":"STORAGE-GLASS","capacityUnits":30000,"priceCents":8550}''::JSONB\n'||fragment);
END $$;

CREATE FUNCTION public.kq_warehouse_installed_containers(p_state JSONB)
RETURNS TABLE(container_code TEXT,quantity INTEGER)
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT code,sum(amount)::INTEGER FROM (
  SELECT CASE z->>'deviceCode' WHEN 'CURTEC-60L' THEN 'CURTEC-60L' ELSE 'GLASS-1L' END code,
   (z->>'width')::INTEGER*(z->>'height')::INTEGER*
    CASE z->>'deviceCode' WHEN 'LP-SUPER-1L' THEN 24 WHEN 'BROR-JARS-48' THEN 48 WHEN 'CURTEC-60L' THEN 4 ELSE 0 END amount
  FROM jsonb_array_elements(COALESCE(p_state->'serviceZones','[]'::JSONB)) z WHERE z->>'kind'='storage'
 ) installed GROUP BY code HAVING sum(amount)>0;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_installed_containers(JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_warehouse_service_storage_changed(p_previous JSONB,p_next JSONB) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT (p_previous ? 'serviceZones') IS DISTINCT FROM (p_next ? 'serviceZones')
  OR (SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY container_code),'[]'::JSONB) FROM public.kq_warehouse_installed_containers(p_previous) i)
   IS DISTINCT FROM (SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY container_code),'[]'::JSONB) FROM public.kq_warehouse_installed_containers(p_next) i);
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_service_storage_changed(JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_warehouse_usable_containers(p_user UUID)
RETURNS TABLE(container_code TEXT,quantity INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT i.container_code,CASE WHEN l.state ? 'serviceZones' THEN LEAST(i.quantity,COALESCE(s.quantity,0)) ELSE i.quantity END
 FROM public.kq_storage_containers i LEFT JOIN public.kq_warehouse_layouts l ON l.user_id=i.user_id
 LEFT JOIN LATERAL public.kq_warehouse_installed_containers(l.state) s ON s.container_code=i.container_code
 WHERE i.user_id=p_user;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_usable_containers(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_warehouse_storage_capacity_units(p_user UUID,p_state JSONB DEFAULT NULL) RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE state JSONB:=p_state; capacity NUMERIC;
BEGIN
 IF state IS NULL THEN SELECT l.state INTO state FROM public.kq_warehouse_layouts l WHERE user_id=p_user; END IF;
 IF state ? 'serviceZones' THEN
  SELECT COALESCE(sum(i.quantity::NUMERIC*(public.kq_storage_container(i.container_code)->>'capacityUnits')::NUMERIC),0)
   INTO capacity FROM public.kq_warehouse_installed_containers(state) i;
 ELSE
  SELECT COALESCE(sum(i.quantity::NUMERIC*(public.kq_storage_container(i.container_code)->>'capacityUnits')::NUMERIC),0)
   INTO capacity FROM public.kq_storage_containers i WHERE user_id=p_user;
 END IF;
 RETURN capacity;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_storage_capacity_units(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_warehouse_drying_capacity_grams(p_state JSONB) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN p_state ? 'serviceZones' THEN
  COALESCE((SELECT sum((z->>'width')::NUMERIC*(z->>'height')::NUMERIC*1000)
   FROM jsonb_array_elements(p_state->'serviceZones') z WHERE z->>'kind'='drying' AND z->>'deviceCode'='SJ-DRYIT90'),0)
 ELSE COALESCE((SELECT sum((e->>'quantity')::NUMERIC*5000)
   FROM jsonb_array_elements(p_state->'equipment') e WHERE e->>'code'='SJ-DRYIT90'),0) END;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_drying_capacity_grams(JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_warehouse_reserved_storage_units(p_user UUID,p_except UUID DEFAULT NULL) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(sum((a->>'quantity')::NUMERIC*(public.kq_storage_container(a->>'containerCode')->>'capacityUnits')::NUMERIC),0)
 FROM public.kq_storage_lots s,LATERAL jsonb_array_elements(COALESCE(s.state->'capacity'->'allocations','[]'::JSONB)) a
 WHERE s.user_id=p_user AND s.flower_id IS DISTINCT FROM p_except;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_reserved_storage_units(UUID,UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_warehouse_packed_stock_units(p_user UUID) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(sum(l.remaining_packets::NUMERIC*l.format_grams*10*s.equivalent_units/NULLIF(s.initial_units,0)),0)
 FROM public.kq_online_listings l JOIN public.kq_commerce_stock s ON s.id=l.stock_id
 WHERE l.user_id=p_user AND l.remaining_packets>0;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_packed_stock_units(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_warehouse_free_service_slots(p_user UUID,p_flower UUID,p_code TEXT,p_allocations JSONB) RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE own_reserved NUMERIC; available NUMERIC;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=p_user AND state ? 'serviceZones') THEN RETURN 2147483647; END IF;
 SELECT COALESCE(sum((a->>'quantity')::NUMERIC*(public.kq_storage_container(a->>'containerCode')->>'capacityUnits')::NUMERIC),0)
  INTO own_reserved FROM jsonb_array_elements(p_allocations) a;
 available:=public.kq_warehouse_storage_capacity_units(p_user)-public.kq_warehouse_reserved_storage_units(p_user,p_flower)
  -public.kq_warehouse_packed_stock_units(p_user)-own_reserved;
 RETURN GREATEST(0,LEAST(2147483647,floor(available/(public.kq_storage_container(p_code)->>'capacityUnits')::NUMERIC)))::INTEGER;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_free_service_slots(UUID,UUID,TEXT,JSONB) FROM PUBLIC,anon,authenticated,service_role;

-- A partly filled drum belongs to one harvest. Reserve pending harvests in
-- whole containers before promising space to another culture. This uses the
 -- same fit order as the real allocator without creating or moving any stock.
CREATE FUNCTION public.kq_warehouse_pending_shortage_units(p_user UUID,p_state JSONB DEFAULT NULL,p_new_units NUMERIC DEFAULT 0) RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE plan JSONB:=p_state; inventory JSONB; initial_inventory JSONB; requested JSONB:='{}'; budget NUMERIC; initial_budget NUMERIC;
 preferred TEXT; harvest RECORD; chosen RECORD; remaining NUMERIC; shortage NUMERIC:=0; requested_budget NUMERIC:=0;
 unavailable_units NUMERIC; qty INTEGER; unit_capacity NUMERIC;
BEGIN
 IF plan IS NULL THEN SELECT state INTO plan FROM public.kq_warehouse_layouts WHERE user_id=p_user; END IF;
 SELECT COALESCE(jsonb_object_agg(i.container_code,GREATEST(0,
  CASE WHEN plan ? 'serviceZones' THEN LEAST(i.quantity,COALESCE(installed.quantity,0)) ELSE i.quantity END
   -COALESCE((SELECT sum((a->>'quantity')::INTEGER) FROM public.kq_storage_lots s,
    LATERAL jsonb_array_elements(s.state->'capacity'->'allocations') a WHERE s.user_id=p_user AND a->>'containerCode'=i.container_code),0))),'{}'::JSONB)
 INTO inventory FROM public.kq_storage_containers i
 LEFT JOIN public.kq_warehouse_installed_containers(plan) installed ON installed.container_code=i.container_code WHERE i.user_id=p_user;
 budget:=public.kq_warehouse_storage_capacity_units(p_user,plan)-public.kq_warehouse_reserved_storage_units(p_user)-public.kq_warehouse_packed_stock_units(p_user);
 initial_inventory:=inventory; initial_budget:=budget;
 SELECT default_method_code INTO preferred FROM public.kq_storage_accounts WHERE user_id=p_user;
 -- Each future lot receives an independent allocation trace against the same
 -- free inventory. Their summed container demands must fit together. Whenever
 -- they do, every trace remains available in any verdict order. This knowingly
 -- rejects some tightly packed mixtures rather than promising the same drum
 -- twice; sorting a sequential simulation would not give that guarantee.
 FOR harvest IN SELECT mass FROM (
  SELECT round((r.state->>'harvestGrams')::NUMERIC*10) mass,f.created_at,f.id
   FROM public.kq_flowers f JOIN public.kq_runs r ON r.id=f.run_id WHERE f.owner_id=p_user AND f.status::TEXT<>'burned'
  UNION ALL SELECT p_new_units,now(),NULL::UUID
 ) pending ORDER BY created_at,id LOOP
  inventory:=initial_inventory; budget:=initial_budget;
  remaining:=COALESCE(harvest.mass,0);
  WHILE remaining>0 LOOP
   SELECT i.key code,i.value::INTEGER available,public.kq_storage_container(i.key) spec INTO chosen
    FROM jsonb_each_text(inventory) i WHERE i.value::INTEGER>0 AND (public.kq_storage_container(i.key)->>'capacityUnits')::NUMERIC<=budget
    ORDER BY (public.kq_storage_container(i.key)->>'methodCode'=preferred) DESC,
     (public.kq_storage_method(public.kq_storage_container(i.key)->>'methodCode')->>'aromaRate')::INTEGER,
     CASE WHEN (public.kq_storage_container(i.key)->>'capacityUnits')::NUMERIC>=remaining THEN 0 ELSE 1 END,
     CASE WHEN (public.kq_storage_container(i.key)->>'capacityUnits')::NUMERIC>=remaining THEN (public.kq_storage_container(i.key)->>'capacityUnits')::NUMERIC
      ELSE -(public.kq_storage_container(i.key)->>'capacityUnits')::NUMERIC END,i.key LIMIT 1;
   EXIT WHEN NOT FOUND;
   unit_capacity:=(chosen.spec->>'capacityUnits')::NUMERIC;
   qty:=LEAST(chosen.available,GREATEST(1,floor(remaining/unit_capacity)),floor(budget/unit_capacity));
   inventory:=jsonb_set(inventory,ARRAY[chosen.code],to_jsonb(chosen.available-qty));
   requested:=jsonb_set(requested,ARRAY[chosen.code],to_jsonb(COALESCE((requested->>chosen.code)::INTEGER,0)+qty));
   requested_budget:=requested_budget+qty*unit_capacity;
   budget:=budget-qty*unit_capacity; remaining:=GREATEST(0,remaining-qty*unit_capacity);
  END LOOP;
  shortage:=shortage+remaining;
 END LOOP;
 SELECT COALESCE(sum(GREATEST(0,i.value::NUMERIC-COALESCE((initial_inventory->>i.key)::NUMERIC,0))
  *(public.kq_storage_container(i.key)->>'capacityUnits')::NUMERIC),0) INTO unavailable_units FROM jsonb_each_text(requested) i;
 RETURN shortage+GREATEST(unavailable_units,requested_budget-GREATEST(0,initial_budget));
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_pending_shortage_units(UUID,JSONB,NUMERIC) FROM PUBLIC,anon,authenticated,service_role;

-- Ownership is credited exactly once on purchase. Moving an existing zone
-- changes usable capacity but never adds a second copy of its containers.
CREATE OR REPLACE FUNCTION public.kq_warehouse_sync_containers() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item RECORD; previous INTEGER; current_count INTEGER; added INTEGER; reassign BOOLEAN:=false;
 old_overflow NUMERIC; new_overflow NUMERIC; pending_units NUMERIC; old_deficit NUMERIC; new_deficit NUMERIC; old_pending_shortage NUMERIC;
BEGIN
 IF TG_OP='UPDATE' THEN reassign:=NEW.state ? 'serviceZones' AND public.kq_warehouse_service_storage_changed(OLD.state,NEW.state); END IF;
 IF reassign THEN
  old_pending_shortage:=public.kq_warehouse_pending_shortage_units(NEW.user_id,OLD.state);
  SELECT COALESCE(sum((r.state->>'harvestGrams')::NUMERIC*10),0) INTO pending_units
   FROM public.kq_flowers f JOIN public.kq_runs r ON r.id=f.run_id WHERE f.owner_id=NEW.user_id AND f.status::TEXT<>'burned';
  old_deficit:=GREATEST(0,GREATEST(public.kq_warehouse_stock_units(NEW.user_id),public.kq_warehouse_reserved_storage_units(NEW.user_id)
   +public.kq_warehouse_packed_stock_units(NEW.user_id))+pending_units-public.kq_warehouse_storage_capacity_units(NEW.user_id,OLD.state));
  SELECT COALESCE(sum((s.state->'capacity'->>'totalUnits')::NUMERIC-COALESCE((SELECT sum((a->>'storedUnits')::NUMERIC)
   FROM jsonb_array_elements(s.state->'capacity'->'allocations') a),0)),0) INTO old_overflow FROM public.kq_storage_lots s WHERE user_id=NEW.user_id;
  -- Settle the old protection before changing it. Clear all reservations first,
  -- then repack together so an old container cannot block a new container type.
  UPDATE public.kq_storage_lots SET state=jsonb_set(public.kq_storage_settle(state,date_trunc('milliseconds',now())),
   '{capacity,allocations}','[]'::JSONB),revision=revision+1 WHERE user_id=NEW.user_id;
 END IF;
 FOR item IN SELECT * FROM (VALUES('LP-SUPER-1L','GLASS-1L',6),('BROR-JARS-48','GLASS-1L',48),('CURTEC-60L','CURTEC-60L',1)) d(device_code,container_code,multiplier) LOOP
  previous:=0;
  IF TG_OP='UPDATE' THEN SELECT COALESCE(sum((e->>'quantity')::INTEGER),0) INTO previous
   FROM jsonb_array_elements(OLD.state->'equipment') e WHERE e->>'code'=item.device_code; END IF;
  SELECT COALESCE(sum((e->>'quantity')::INTEGER),0) INTO current_count
   FROM jsonb_array_elements(NEW.state->'equipment') e WHERE e->>'code'=item.device_code;
  IF current_count<previous THEN RAISE EXCEPTION 'warehouse_storage_cannot_disappear'; END IF;
  added:=(current_count-previous)*item.multiplier;
  IF added>0 THEN
   PERFORM public.kq_storage_initialize(NEW.user_id);
   INSERT INTO public.kq_storage_containers(user_id,container_code,quantity) VALUES(NEW.user_id,item.container_code,added)
    ON CONFLICT(user_id,container_code) DO UPDATE SET quantity=kq_storage_containers.quantity+EXCLUDED.quantity;
  END IF;
 END LOOP;
 PERFORM public.kq_storage_fill_user(NEW.user_id);
 IF reassign THEN
  SELECT COALESCE(sum((s.state->'capacity'->>'totalUnits')::NUMERIC-COALESCE((SELECT sum((a->>'storedUnits')::NUMERIC)
   FROM jsonb_array_elements(s.state->'capacity'->'allocations') a),0)),0) INTO new_overflow FROM public.kq_storage_lots s WHERE user_id=NEW.user_id;
  IF new_overflow>old_overflow THEN RAISE EXCEPTION 'warehouse_service_capacity_in_use'; END IF;
  new_deficit:=GREATEST(0,GREATEST(public.kq_warehouse_stock_units(NEW.user_id),public.kq_warehouse_reserved_storage_units(NEW.user_id)
   +public.kq_warehouse_packed_stock_units(NEW.user_id))+pending_units-public.kq_warehouse_storage_capacity_units(NEW.user_id,NEW.state));
  IF new_deficit>old_deficit THEN RAISE EXCEPTION 'warehouse_service_capacity_in_use'; END IF;
  IF public.kq_warehouse_pending_shortage_units(NEW.user_id,NEW.state)>old_pending_shortage THEN RAISE EXCEPTION 'warehouse_service_capacity_in_use'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_sync_containers() FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.kq_storage_containers DROP CONSTRAINT kq_storage_containers_quantity_check;
ALTER TABLE public.kq_storage_containers ADD CONSTRAINT kq_storage_containers_quantity_check CHECK(quantity BETWEEN 1 AND 6000000);

CREATE FUNCTION public.kq_warehouse_validate_service_change(p_user UUID,p_previous JSONB,p_next JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pending NUMERIC; stored NUMERIC; drying NUMERIC; reserved NUMERIC; zone JSONB; demand RECORD;
BEGIN
 IF p_previous ? 'serviceZones' AND NOT(p_next ? 'serviceZones') THEN RAISE EXCEPTION 'warehouse_service_plan_required'; END IF;
 -- A deployed older server may still serve plans without this marker. Keep
 -- its purchase contract intact until explicit adoption; the new server's
 -- quote boundary requires a traced zone for new service-device purchases.
 IF NOT(p_next ? 'serviceZones') THEN RETURN; END IF;
 IF jsonb_typeof(p_next->'serviceZones') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'warehouse_service_layout_invalid'; END IF;
 FOR zone IN SELECT value FROM jsonb_array_elements(p_next->'serviceZones') LOOP
  IF NOT(zone ?& ARRAY['x','y','width','height','kind','deviceCode']) OR zone->>'kind' IS NULL OR zone->>'deviceCode' IS NULL
   OR zone->>'x' IS NULL OR zone->>'y' IS NULL OR zone->>'width' IS NULL OR zone->>'height' IS NULL
   OR (zone->>'kind',zone->>'deviceCode') NOT IN (('drying','SJ-DRYIT90'),('storage','LP-SUPER-1L'),('storage','BROR-JARS-48'),('storage','CURTEC-60L'))
   OR (zone->>'width')::INTEGER NOT BETWEEN 1 AND 40 OR (zone->>'height')::INTEGER NOT BETWEEN 1 AND 25
   OR (zone->>'x')::INTEGER<0 OR (zone->>'y')::INTEGER<0
   OR (zone->>'x')::INTEGER+(zone->>'width')::INTEGER>40 OR (zone->>'y')::INTEGER+(zone->>'height')::INTEGER>25
  THEN RAISE EXCEPTION 'warehouse_service_layout_invalid'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements((p_next->'zones')||(p_next->'serviceZones')) WITH ORDINALITY a(z,n),
   jsonb_array_elements((p_next->'zones')||(p_next->'serviceZones')) WITH ORDINALITY b(z,n)
   WHERE a.n<b.n AND (a.z->>'x')::INTEGER<(b.z->>'x')::INTEGER+(b.z->>'width')::INTEGER
    AND (a.z->>'x')::INTEGER+(a.z->>'width')::INTEGER>(b.z->>'x')::INTEGER
    AND (a.z->>'y')::INTEGER<(b.z->>'y')::INTEGER+(b.z->>'height')::INTEGER
    AND (a.z->>'y')::INTEGER+(a.z->>'height')::INTEGER>(b.z->>'y')::INTEGER)
 THEN RAISE EXCEPTION 'warehouse_service_layout_invalid'; END IF;
 FOR demand IN SELECT z->>'deviceCode' code,sum((z->>'width')::INTEGER*(z->>'height')::INTEGER*
   CASE z->>'deviceCode' WHEN 'LP-SUPER-1L' THEN 4 WHEN 'CURTEC-60L' THEN 4 ELSE 1 END) quantity
  FROM jsonb_array_elements(p_next->'serviceZones') z GROUP BY z->>'deviceCode' LOOP
  IF demand.quantity>COALESCE((SELECT sum((e->>'quantity')::INTEGER) FROM jsonb_array_elements(p_next->'equipment') e WHERE e->>'code'=demand.code),0)
  THEN RAISE EXCEPTION 'warehouse_service_equipment_missing'; END IF;
 END LOOP;
 SELECT COALESCE(sum((r.state->>'harvestGrams')::NUMERIC),0) INTO pending
  FROM public.kq_flowers f JOIN public.kq_runs r ON r.id=f.run_id WHERE f.owner_id=p_user AND f.status::TEXT<>'burned';
 reserved:=public.kq_warehouse_reserved_storage_units(p_user)+public.kq_warehouse_packed_stock_units(p_user);
 stored:=CASE WHEN public.kq_warehouse_service_storage_changed(p_previous,p_next) THEN public.kq_warehouse_stock_units(p_user)
  ELSE GREATEST(public.kq_warehouse_stock_units(p_user),reserved) END/10+pending;
 SELECT COALESCE(sum(public.kq_storage_remaining(s.flower_id)::NUMERIC/10),0)+pending INTO drying
  FROM public.kq_storage_lots s WHERE s.user_id=p_user AND (s.state->>'readyAt')::TIMESTAMPTZ>now();
 IF GREATEST(0,stored-public.kq_warehouse_storage_capacity_units(p_user,p_next)/10)>
    GREATEST(0,stored-public.kq_warehouse_storage_capacity_units(p_user,p_previous)/10)
  OR GREATEST(0,drying-public.kq_warehouse_drying_capacity_grams(p_next))>
    GREATEST(0,drying-public.kq_warehouse_drying_capacity_grams(p_previous))
 THEN RAISE EXCEPTION 'warehouse_service_capacity_in_use'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_validate_service_change(UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_warehouse_save(uuid,uuid,jsonb,integer,jsonb,jsonb,integer)'::regprocedure) INTO body;
 fragment:='credit_used:=LEAST(layout.migration_credit_cents,p_cost_cents);';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'service_save_capacity_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'PERFORM public.kq_warehouse_validate_service_change(p_user_id,layout.state,p_next_state);'||E'\n '||fragment);

 SELECT pg_get_functiondef('public.rpc_kq_warehouse_initialize(uuid,jsonb)'::regprocedure) INTO body;
 fragment:='INSERT INTO public.kq_warehouse_layouts(user_id,state,migration_credit_cents,legacy_archive)';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'service_initialize_capacity_anchor_changed'; END IF;
 -- Geometry and funded devices are checked for new starter plans, without
 -- requiring old stock to fit the free starter on its first conversion.
 EXECUTE replace(body,fragment,E'IF p_starter_state ? ''serviceZones'' THEN\n  IF public.kq_warehouse_stock_units(p_user_id)>0 OR EXISTS(SELECT 1 FROM public.kq_flowers WHERE owner_id=p_user_id AND status::TEXT<>''burned'') THEN\n   p_starter_state:=p_starter_state-''serviceZones'';\n  ELSE\n   PERFORM public.kq_warehouse_validate_service_change(p_user_id,p_starter_state,p_starter_state);\n  END IF;\n END IF;\n '||fragment);

 SELECT pg_get_functiondef('public.kq_storage_allocate(uuid,text,boolean)'::regprocedure) INTO body;
 fragment:='FROM public.kq_storage_containers i WHERE i.user_id=lot.user_id';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'service_allocator_inventory_anchor_changed'; END IF;
 body:=replace(body,fragment,'FROM public.kq_warehouse_usable_containers(lot.user_id) i');
 fragment:='i.quantity-COALESCE('; IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'service_allocator_free_anchor_changed'; END IF;
 body:=replace(body,fragment,'LEAST(i.quantity-COALESCE(');
 fragment:='WHERE e->>''containerCode''=i.container_code),0) free';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'service_allocator_budget_anchor_changed'; END IF;
 body:=replace(body,fragment,'WHERE e->>''containerCode''=i.container_code),0),public.kq_warehouse_free_service_slots(lot.user_id,p_flower,i.container_code,allocations)) free');
 EXECUTE body;

 SELECT pg_get_functiondef('public.kq_validate_warehouse_run_start(uuid,uuid,jsonb)'::regprocedure) INTO body;
 fragment:='potential:=(warehouse->>''estimatedHarvestGrams'')::NUMERIC;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'service_run_snapshot_anchor_changed'; END IF;
 body:=replace(body,fragment,E'IF (warehouse->>''dryingCapacityGrams'')::NUMERIC IS DISTINCT FROM public.kq_warehouse_drying_capacity_grams(layout.state)\n  OR (layout.state ? ''serviceZones'' AND (warehouse->>''storageCapacityGrams'')::NUMERIC IS DISTINCT FROM public.kq_warehouse_storage_capacity_units(p_user)/10)\n THEN RAISE EXCEPTION ''warehouse_layout_changed''; END IF;\n '||fragment);
 fragment:='IF potential+pending>available_stock OR potential+pending+drying>';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'service_run_capacity_anchor_changed'; END IF;
 body:=replace(body,fragment,E'IF layout.state ? ''serviceZones'' THEN\n  available_stock:=LEAST(available_stock,public.kq_warehouse_storage_capacity_units(p_user)/10-GREATEST(public.kq_warehouse_stock_units(p_user),public.kq_warehouse_reserved_storage_units(p_user)+public.kq_warehouse_packed_stock_units(p_user))/10);\n  IF public.kq_warehouse_pending_shortage_units(p_user,NULL,round(potential*10))>0 THEN RAISE EXCEPTION ''warehouse_capacity''; END IF;\n END IF;\n '||fragment);
 EXECUTE body;

 SELECT pg_get_functiondef('public.rpc_kq_storage_capacity_command(uuid,text,text,text,integer,uuid,uuid)'::regprocedure) INTO body;
 fragment:=E' IF p_action=''buy'' THEN\n';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'service_legacy_purchase_anchor_changed'; END IF;
 -- Replay is deliberately checked first, including receipts issued pre-adoption.
 EXECUTE replace(body,fragment,E' IF p_action=''buy'' AND EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=p_user_id AND state ? ''serviceZones'') THEN RAISE EXCEPTION ''warehouse_storage_purchase''; END IF;\n IF p_action IN (''assign'',''select-default'') AND EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=p_user_id AND state ? ''serviceZones'')\n  AND NOT EXISTS(SELECT 1 FROM public.kq_warehouse_usable_containers(p_user_id) i WHERE i.quantity>0 AND public.kq_storage_container(i.container_code)->>''methodCode''=p_method_code) THEN RAISE EXCEPTION ''warehouse_storage_method_not_installed''; END IF;\n'||fragment);

 SELECT pg_get_functiondef('public.kq_warehouse_snapshot(uuid)'::regprocedure) INTO body;
 fragment:='COALESCE((SELECT sum(c.quantity*(public.kq_storage_container(c.container_code)->>''capacityUnits'')::NUMERIC)/10 FROM public.kq_storage_containers c WHERE c.user_id=p_user_id),0)';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'service_snapshot_capacity_anchor_changed'; END IF;
 body:=replace(body,fragment,'public.kq_warehouse_storage_capacity_units(p_user_id)/10');
 fragment:='''storageCapacityGrams'',';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'service_snapshot_reserved_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'''storageReservedGrams'',GREATEST(public.kq_warehouse_stock_units(p_user_id),public.kq_warehouse_reserved_storage_units(p_user_id)+public.kq_warehouse_packed_stock_units(p_user_id))/10,'||fragment);

 -- Avoid integer multiplication overflow in large historical reserves; the
 -- physical installed budget itself always remains bounded by 1,000 cells.
 SELECT pg_get_functiondef('public.kq_storage_snapshot(uuid,boolean)'::regprocedure) INTO body;
 body:=replace(body,'sum(quantity*(public.kq_storage_container(container_code)->>''capacityUnits'')::INTEGER)',
  'sum(quantity::BIGINT*(public.kq_storage_container(container_code)->>''capacityUnits'')::INTEGER)');
 EXECUTE body;
END $$;

ALTER FUNCTION public.kq_storage_snapshot(UUID,BOOLEAN) RENAME TO kq_storage_snapshot_before_service_zones;
REVOKE ALL ON FUNCTION public.kq_storage_snapshot_before_service_zones(UUID,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_storage_snapshot(p_user_id UUID,p_active_only BOOLEAN) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result JSONB; capacity NUMERIC; occupied NUMERIC; stored NUMERIC; installed JSONB;
BEGIN
 result:=public.kq_storage_snapshot_before_service_zones(p_user_id,p_active_only);
 IF NOT EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=p_user_id AND state ? 'serviceZones') THEN RETURN result; END IF;
 capacity:=public.kq_warehouse_storage_capacity_units(p_user_id);
 occupied:=public.kq_warehouse_reserved_storage_units(p_user_id)+public.kq_warehouse_packed_stock_units(p_user_id);
 stored:=public.kq_warehouse_stock_units(p_user_id);
 SELECT COALESCE(jsonb_object_agg(container_code,quantity),'{}'::JSONB) INTO installed FROM public.kq_warehouse_usable_containers(p_user_id);
 RETURN result||jsonb_build_object('installedContainers',installed,'capacity',jsonb_build_object('totalUnits',capacity,
  'usedUnits',stored,'reservedUnits',occupied,'freeUnits',GREATEST(0,capacity-occupied),
  'overflowUnits',GREATEST((result->'capacity'->>'overflowUnits')::NUMERIC,stored-capacity)));
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_snapshot(UUID,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
