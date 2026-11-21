BEGIN;

ALTER TABLE public.kq_warehouse_layouts ADD COLUMN handling_cart_conversion JSONB;

-- Older saved cultures keep their original area-based profile. Only new
-- investments use the shared cart, with no installation charge.
DO $migration$
DECLARE body TEXT; anchor TEXT;
BEGIN
 SELECT pg_get_functiondef('public.kq_warehouse_validate_options_change(jsonb,jsonb,integer)'::regprocedure) INTO body;
 anchor:='PERFORM public.kq_warehouse_options_projection(p_next);';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'warehouse_handling_options_anchor_changed'; END IF;
 body:=replace(body,anchor,anchor||$guard$
 IF public.kq_warehouse_cart_quantity(p_next)>GREATEST(1,public.kq_warehouse_cart_quantity(p_previous))
  OR EXISTS(
   SELECT 1 FROM jsonb_array_elements(p_next->'zones') next_zone
   WHERE next_zone->'optionCodes' ? 'SIM-LOGISTICS-02' AND NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(p_previous->'zones') previous_zone
    WHERE previous_zone->>'id'=next_zone->>'id' AND previous_zone->'optionCodes' ? 'SIM-LOGISTICS-02'
   )
  )
  THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
$guard$);
 anchor:='IF p_cost<round(module_cost*1.15)';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'warehouse_handling_cost_anchor_changed'; END IF;
 body:=replace(body,anchor,'IF p_cost<round(module_cost*1.15)-240*GREATEST(0,public.kq_warehouse_cart_quantity(p_next)-public.kq_warehouse_cart_quantity(p_previous))');
 -- plpgsql resolves the private helper when the function first runs.
 EXECUTE body;
 SELECT pg_get_functiondef('public.kq_warehouse_validate_catalog_change(jsonb,jsonb,integer)'::regprocedure) INTO body;
 anchor:='round(equipment_cost*0.15)';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'warehouse_handling_catalog_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,anchor||'-240*GREATEST(0,public.kq_warehouse_cart_quantity(p_next)-public.kq_warehouse_cart_quantity(p_previous))');
END $migration$;

CREATE FUNCTION public.kq_warehouse_cart_quantity(p_state JSONB) RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT COALESCE(sum((entry->>'quantity')::INTEGER),0)::INTEGER
 FROM jsonb_array_elements(COALESCE(p_state->'optionInventory','[]'::JSONB)) entry
 WHERE entry->>'code'='SIM-LOGISTICS-02';
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_cart_quantity(JSONB) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.kq_warehouse_snapshot(UUID) RENAME TO kq_warehouse_snapshot_before_handling_cart;
CREATE FUNCTION public.kq_warehouse_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.kq_warehouse_snapshot_before_handling_cart(p_user_id)||
  COALESCE((SELECT jsonb_build_object('handlingCartConversion',jsonb_build_object(
   'quantity',handling_cart_conversion->'quantity','creditCents',handling_cart_conversion->'creditCents',
   'unknownBasisQuantity',handling_cart_conversion->'unknownBasisQuantity'))
   FROM public.kq_warehouse_layouts WHERE user_id=p_user_id AND handling_cart_conversion IS NOT NULL),'{}'::JSONB);
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_snapshot(UUID),public.kq_warehouse_snapshot_before_handling_cart(UUID)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_warehouse_convert_handling_cart(p_user_id UUID,p_expected_revision INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE layout public.kq_warehouse_layouts%ROWTYPE;
 next_state JSONB; next_zones JSONB; next_inventory JSONB; next_assets JSONB; old_assets JSONB; kept JSONB;
 old_quantity INTEGER; old_assignments JSONB; credit_cents BIGINT:=0; unknown_quantity BIGINT:=0;
 cart CONSTANT TEXT:='SIM-LOGISTICS-02';
BEGIN
 IF p_user_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1 THEN
  RAISE EXCEPTION 'warehouse_invalid_request';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO layout FROM public.kq_warehouse_layouts WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR layout.revision<>p_expected_revision OR layout.handling_cart_conversion IS NOT NULL
  OR EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='active')
  OR public.kq_staff_production_reservation(p_user_id) IS NOT NULL
  THEN RETURN public.kq_warehouse_snapshot(p_user_id); END IF;
 old_quantity:=public.kq_warehouse_cart_quantity(layout.state);
 SELECT COALESCE(jsonb_agg(z->'id' ORDER BY n),'[]'::JSONB) INTO old_assignments
 FROM jsonb_array_elements(layout.state->'zones') WITH ORDINALITY data(z,n) WHERE z->'optionCodes' ? cart;
 IF old_quantity<=1 AND old_assignments='[]'::JSONB THEN RETURN public.kq_warehouse_snapshot(p_user_id); END IF;
 SELECT COALESCE(jsonb_agg(CASE WHEN z->'optionCodes' ? cart
  THEN jsonb_set(z,'{optionCodes}',(z->'optionCodes')-cart) ELSE z END ORDER BY n),'[]'::JSONB) INTO next_zones
 FROM jsonb_array_elements(layout.state->'zones') WITH ORDINALITY data(z,n);
 SELECT COALESCE(jsonb_agg(entry ORDER BY n),'[]'::JSONB) INTO next_inventory
 FROM jsonb_array_elements(COALESCE(layout.state->'optionInventory','[]'::JSONB)) WITH ORDINALITY data(entry,n)
 WHERE entry->>'code'<>cart;
 IF old_quantity>0 THEN next_inventory:=next_inventory||jsonb_build_array(jsonb_build_object('code',cart,'quantity',1)); END IF;
 next_state:=jsonb_set(jsonb_set(layout.state,'{zones}',next_zones),'{optionInventory}',next_inventory);
 IF layout.culture_assets IS NOT NULL THEN
  PERFORM public.kq_warehouse_validate_assets(layout.state,layout.culture_assets);
  SELECT COALESCE(jsonb_agg(item ORDER BY n),'[]'::JSONB) INTO old_assets
  FROM jsonb_array_elements(layout.culture_assets) WITH ORDINALITY data(item,n) WHERE item->>'kind'='option' AND item->>'code'=cart;
  -- Keep one unit of the least worn lot, with its original paid basis and ID.
  SELECT item INTO kept FROM jsonb_array_elements(old_assets) item
  ORDER BY (item->>'wearPercent')::INTEGER,(item->>'purchaseUnitCents')::INTEGER DESC NULLS LAST,item->>'id' LIMIT 1;
  SELECT COALESCE(sum((item->>'purchaseUnitCents')::BIGINT * discarded),0),
   COALESCE(sum(discarded) FILTER(WHERE item->>'purchaseUnitCents' IS NULL),0)
  INTO credit_cents,unknown_quantity
  FROM jsonb_array_elements(old_assets) item
  CROSS JOIN LATERAL (SELECT (item->>'quantity')::INTEGER-CASE WHEN item->>'id'=kept->>'id' THEN 1 ELSE 0 END AS discarded) units;
  SELECT COALESCE(jsonb_agg(item ORDER BY n),'[]'::JSONB) INTO next_assets
  FROM jsonb_array_elements(layout.culture_assets) WITH ORDINALITY data(item,n)
  WHERE NOT(item->>'kind'='option' AND item->>'code'=cart);
  IF kept IS NOT NULL THEN next_assets:=next_assets||jsonb_build_array(kept||'{"quantity":1,"zoneId":null}'::JSONB); END IF;
  PERFORM public.kq_warehouse_validate_assets(next_state,next_assets);
 ELSE
  unknown_quantity:=GREATEST(0,old_quantity-1);
 END IF;
 PERFORM public.kq_warehouse_options_projection(next_state);
 UPDATE public.kq_warehouse_layouts SET state=next_state,culture_assets=next_assets,
  revision=revision+1,updated_at=now(),migration_credit_cents=migration_credit_cents+credit_cents,
  handling_cart_conversion=jsonb_build_object('version',1,'convertedAt',now(),'previousRevision',layout.revision,
   'quantity',old_quantity,'zoneIds',old_assignments,'assets',old_assets,'retainedAssetId',kept->'id',
   'creditCents',credit_cents,'unknownBasisQuantity',unknown_quantity)
 WHERE user_id=p_user_id;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 RETURN public.kq_warehouse_snapshot(p_user_id);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_convert_handling_cart(UUID,INTEGER) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_convert_handling_cart(UUID,INTEGER) TO service_role;

COMMIT;
