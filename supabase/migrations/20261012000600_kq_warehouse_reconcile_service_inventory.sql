BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- The application could persist paid service-zone devices before migration005
-- installed their container bridge. Reconcile that authoritative inventory,
-- without replaying purchases or adding existing legacy stock a second time.
CREATE OR REPLACE FUNCTION public.kq_warehouse_reconcile_service_inventory(p_user UUID) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE layout public.kq_warehouse_layouts%ROWTYPE; item RECORD; owned INTEGER; changed BOOLEAN:=false;
 repack BOOLEAN:=false; old_overflow NUMERIC; new_overflow NUMERIC; old_mass NUMERIC;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO layout FROM public.kq_warehouse_layouts WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM public.kq_storage_initialize(p_user);
 FOR item IN
  SELECT code,sum(amount)::INTEGER quantity FROM (
   SELECT CASE e->>'code' WHEN 'CURTEC-60L' THEN 'CURTEC-60L' ELSE 'GLASS-1L' END code,
    (e->>'quantity')::INTEGER*CASE e->>'code' WHEN 'LP-SUPER-1L' THEN 6 WHEN 'BROR-JARS-48' THEN 48 ELSE 1 END amount
   FROM jsonb_array_elements(layout.state->'equipment') e WHERE e->>'code' IN ('LP-SUPER-1L','BROR-JARS-48','CURTEC-60L')
  ) devices GROUP BY code HAVING sum(amount)>0
 LOOP
  SELECT quantity INTO owned FROM public.kq_storage_containers WHERE user_id=p_user AND container_code=item.code;
  IF COALESCE(owned,0)<item.quantity THEN
   INSERT INTO public.kq_storage_containers(user_id,container_code,quantity) VALUES(p_user,item.code,item.quantity)
    ON CONFLICT(user_id,container_code) DO UPDATE SET quantity=GREATEST(kq_storage_containers.quantity,EXCLUDED.quantity);
   changed:=true;
  END IF;
 END LOOP;
 IF layout.state ? 'serviceZones' THEN
  -- Existing allocations can also predate the physical plan even when every
  -- paid container is already present. They must no longer use reserve devices.
  SELECT changed OR EXISTS(
   SELECT 1 FROM (
    SELECT a->>'containerCode' code,sum((a->>'quantity')::INTEGER) quantity
    FROM public.kq_storage_lots s,LATERAL jsonb_array_elements(s.state->'capacity'->'allocations') a
    WHERE s.user_id=p_user GROUP BY a->>'containerCode'
   ) occupied LEFT JOIN public.kq_warehouse_usable_containers(p_user) usable ON usable.container_code=occupied.code
   WHERE occupied.quantity>COALESCE(usable.quantity,0)
  ) INTO repack;
 END IF;
 IF repack THEN
  old_mass:=public.kq_warehouse_stock_units(p_user);
  SELECT COALESCE(sum(GREATEST(0,public.kq_storage_remaining(s.flower_id)-COALESCE((SELECT sum((a->>'storedUnits')::NUMERIC)
   FROM jsonb_array_elements(s.state->'capacity'->'allocations') a),0))),0) INTO old_overflow
   FROM public.kq_storage_lots s WHERE user_id=p_user;
  -- Settle the former protection before the atomic rearrangement. Neither the
  -- drying clock nor any flower, packet, paid device or historical run changes.
  UPDATE public.kq_storage_lots SET state=jsonb_set(public.kq_storage_settle(state,date_trunc('milliseconds',now())),
   '{capacity,allocations}','[]'::JSONB),revision=revision+1 WHERE user_id=p_user;
  PERFORM public.kq_storage_fill_user(p_user);
  SELECT COALESCE(sum(GREATEST(0,public.kq_storage_remaining(s.flower_id)-COALESCE((SELECT sum((a->>'storedUnits')::NUMERIC)
   FROM jsonb_array_elements(s.state->'capacity'->'allocations') a),0))),0) INTO new_overflow
   FROM public.kq_storage_lots s WHERE user_id=p_user;
  IF public.kq_warehouse_stock_units(p_user) IS DISTINCT FROM old_mass THEN RAISE EXCEPTION 'warehouse_reconciliation_mass_changed'; END IF;
  IF new_overflow>old_overflow THEN RAISE EXCEPTION 'warehouse_reconciliation_capacity_in_use'; END IF;
  changed:=true;
 ELSIF changed THEN
  PERFORM public.kq_storage_fill_user(p_user);
 END IF;
 IF changed THEN
  UPDATE public.kq_warehouse_layouts SET revision=revision+1,updated_at=now() WHERE user_id=p_user;
  UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user;
 END IF;
 RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_reconcile_service_inventory(UUID) FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE owner UUID; BEGIN
 FOR owner IN SELECT user_id FROM public.kq_warehouse_layouts ORDER BY user_id LOOP
  PERFORM public.kq_warehouse_reconcile_service_inventory(owner);
 END LOOP;
END $$;

COMMIT;
