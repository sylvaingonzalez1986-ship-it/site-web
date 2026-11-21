BEGIN;

ALTER TABLE public.kq_warehouse_layouts ADD COLUMN handling_equipment_conversions JSONB;

CREATE FUNCTION public.kq_warehouse_handling_codes() RETURNS TEXT[]
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT ARRAY['SIM-LOGISTICS-01','SIM-LOGISTICS-02','SIM-LOGISTICS-03'];
$$;

CREATE FUNCTION public.kq_warehouse_handling_quantity(p_state JSONB,p_code TEXT) RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT COALESCE(sum((entry->>'quantity')::INTEGER),0)::INTEGER
 FROM jsonb_array_elements(COALESCE(p_state->'optionInventory','[]'::JSONB)) entry
 WHERE entry->>'code'=p_code;
$$;

CREATE FUNCTION public.kq_warehouse_new_handling_cost(p_previous JSONB,p_next JSONB) RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT sum(GREATEST(0,public.kq_warehouse_handling_quantity(p_next,code)-public.kq_warehouse_handling_quantity(p_previous,code))
  *(public.kq_warehouse_option(code)->>'equipmentCentsPerM2')::INTEGER)::INTEGER
 FROM unnest(public.kq_warehouse_handling_codes()) code;
$$;

CREATE FUNCTION pg_temp.kq_handling_patch(p_target REGPROCEDURE,p_before TEXT,p_after TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE body TEXT:=pg_get_functiondef(p_target);
BEGIN
 IF (length(body)-length(replace(body,p_before,'')))/length(p_before)<>1
  THEN RAISE EXCEPTION 'warehouse_handling_anchor_changed: %',p_target; END IF;
 EXECUTE replace(body,p_before,p_after);
END $$;

SELECT pg_temp.kq_handling_patch('public.kq_warehouse_validate_options_change(jsonb,jsonb,integer)',
 'PERFORM public.kq_warehouse_options_projection(p_next);',$patch$PERFORM public.kq_warehouse_options_projection(p_next);
 IF EXISTS(
  SELECT 1 FROM unnest(public.kq_warehouse_handling_codes()) handling
  WHERE public.kq_warehouse_handling_quantity(p_next,handling)>GREATEST(1,public.kq_warehouse_handling_quantity(p_previous,handling))
   OR EXISTS(
    SELECT 1 FROM jsonb_array_elements(p_next->'zones') z
    WHERE z->'optionCodes' ? handling AND NOT EXISTS(
     SELECT 1 FROM jsonb_array_elements(p_previous->'zones') old
     WHERE old->>'id'=z->>'id' AND old->'optionCodes' ? handling
    )
   )
 ) THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;$patch$);
SELECT pg_temp.kq_handling_patch('public.kq_warehouse_validate_options_change(jsonb,jsonb,integer)',
 'round(module_cost*1.15)-240*GREATEST(0,public.kq_warehouse_cart_quantity(p_next)-public.kq_warehouse_cart_quantity(p_previous))',
 'module_cost+round((module_cost-public.kq_warehouse_new_handling_cost(p_previous,p_next))*0.15)');
SELECT pg_temp.kq_handling_patch('public.kq_warehouse_validate_catalog_change(jsonb,jsonb,integer)',
 'round(equipment_cost*0.15)-240*GREATEST(0,public.kq_warehouse_cart_quantity(p_next)-public.kq_warehouse_cart_quantity(p_previous))',
 'round((equipment_cost-public.kq_warehouse_new_handling_cost(p_previous,p_next))*0.15)');

-- Convert only when no culture or autonomous production still needs the saved
-- assignments. Keep the best unit and the history of discarded units.
CREATE FUNCTION public.rpc_kq_warehouse_convert_handling(p_user_id UUID,p_expected_revision INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE layout public.kq_warehouse_layouts%ROWTYPE; ref TEXT; next_state JSONB; next_assets JSONB;
 old_quantity INTEGER; old_assignments JSONB; old_assets JSONB; kept JSONB;
 next_zones JSONB; next_inventory JSONB; conversions JSONB; credit BIGINT;
 total_credit BIGINT:=0; unknown_quantity BIGINT;
BEGIN
 IF p_user_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1 THEN
  RAISE EXCEPTION 'warehouse_invalid_request';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO layout FROM public.kq_warehouse_layouts WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR layout.revision<>p_expected_revision
  OR EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='active')
  OR public.kq_staff_production_reservation(p_user_id) IS NOT NULL
 THEN RETURN public.kq_warehouse_snapshot(p_user_id); END IF;
 next_state:=layout.state;
 next_assets:=layout.culture_assets;
 conversions:=COALESCE(layout.handling_equipment_conversions,'{}'::JSONB);
 FOREACH ref IN ARRAY ARRAY['SIM-LOGISTICS-01','SIM-LOGISTICS-03'] LOOP
  old_quantity:=public.kq_warehouse_handling_quantity(next_state,ref);
  SELECT COALESCE(jsonb_agg(z->'id' ORDER BY n),'[]'::JSONB) INTO old_assignments
  FROM jsonb_array_elements(next_state->'zones') WITH ORDINALITY data(z,n) WHERE z->'optionCodes' ? ref;
  IF old_quantity<=1 AND old_assignments='[]'::JSONB THEN CONTINUE; END IF;
  IF next_assets IS NOT NULL THEN PERFORM public.kq_warehouse_validate_assets(next_state,next_assets); END IF;
  SELECT COALESCE(jsonb_agg(CASE WHEN z->'optionCodes' ? ref
   THEN jsonb_set(z,'{optionCodes}',(z->'optionCodes')-ref) ELSE z END ORDER BY n),'[]'::JSONB) INTO next_zones
  FROM jsonb_array_elements(next_state->'zones') WITH ORDINALITY data(z,n);
  SELECT COALESCE(jsonb_agg(entry ORDER BY n),'[]'::JSONB) INTO next_inventory
  FROM jsonb_array_elements(COALESCE(next_state->'optionInventory','[]'::JSONB)) WITH ORDINALITY data(entry,n)
  WHERE entry->>'code'<>ref;
  IF old_quantity>0 THEN
   next_inventory:=next_inventory||jsonb_build_array(jsonb_build_object('code',ref,'quantity',1));
  END IF;
  next_state:=jsonb_set(jsonb_set(next_state,'{zones}',next_zones),'{optionInventory}',next_inventory);
  credit:=0; unknown_quantity:=GREATEST(0,old_quantity-1); old_assets:=NULL; kept:=NULL;
  IF next_assets IS NOT NULL THEN
   SELECT COALESCE(jsonb_agg(asset ORDER BY n),'[]'::JSONB) INTO old_assets
   FROM jsonb_array_elements(next_assets) WITH ORDINALITY data(asset,n)
   WHERE asset->>'kind'='option' AND asset->>'code'=ref;
   SELECT asset INTO kept FROM jsonb_array_elements(old_assets) asset
   ORDER BY (asset->>'wearPercent')::INTEGER,(asset->>'purchaseUnitCents')::INTEGER DESC NULLS LAST,asset->>'id' LIMIT 1;
   SELECT COALESCE(sum((asset->>'purchaseUnitCents')::BIGINT*discarded),0),
    COALESCE(sum(discarded) FILTER(WHERE asset->>'purchaseUnitCents' IS NULL),0)
   INTO credit,unknown_quantity
   FROM jsonb_array_elements(old_assets) asset
   CROSS JOIN LATERAL (SELECT (asset->>'quantity')::INTEGER-CASE WHEN asset->>'id'=kept->>'id' THEN 1 ELSE 0 END AS discarded) units;
   SELECT COALESCE(jsonb_agg(asset ORDER BY n),'[]'::JSONB) INTO next_assets
   FROM jsonb_array_elements(next_assets) WITH ORDINALITY data(asset,n)
   WHERE NOT(asset->>'kind'='option' AND asset->>'code'=ref);
   IF kept IS NOT NULL THEN next_assets:=next_assets||jsonb_build_array(kept||'{"quantity":1,"zoneId":null}'::JSONB); END IF;
   PERFORM public.kq_warehouse_validate_assets(next_state,next_assets);
  END IF;
  total_credit:=total_credit+credit;
  conversions:=jsonb_set(conversions,ARRAY[ref],jsonb_build_object('convertedAt',now(),'quantity',old_quantity,
   'zoneIds',old_assignments,'assets',old_assets,'retainedAssetId',kept->'id','creditCents',credit,'unknownBasisQuantity',unknown_quantity));
 END LOOP;
 IF next_state IS DISTINCT FROM layout.state THEN
  PERFORM public.kq_warehouse_options_projection(next_state);
  UPDATE public.kq_warehouse_layouts SET state=next_state,culture_assets=next_assets,revision=revision+1,
   updated_at=now(),migration_credit_cents=migration_credit_cents+total_credit,handling_equipment_conversions=conversions
  WHERE user_id=p_user_id RETURNING revision INTO p_expected_revision;
  UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 END IF;
 RETURN public.rpc_kq_warehouse_convert_handling_cart(p_user_id,p_expected_revision);
END $$;

CREATE FUNCTION public.kq_warehouse_handling_condition(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT COALESCE(jsonb_object_agg(asset->>'code',asset->'wearPercent'),'{}'::JSONB)
 FROM public.kq_warehouse_layouts l
 CROSS JOIN LATERAL jsonb_array_elements(l.culture_assets) asset
 WHERE l.user_id=p_user AND asset->>'kind'='option' AND asset->'zoneId'='null'::JSONB
  AND asset->>'code'=ANY(public.kq_warehouse_handling_codes()) AND asset->'quantity'='1'::JSONB
  AND public.kq_warehouse_handling_quantity(l.state,asset->>'code')=1
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(l.state->'zones') z WHERE z->'optionCodes' ? (asset->>'code'));
$$;

-- Wear belongs to the accepted operation. Calling transactions already own
-- the equipment advisory lock and resolve replays before reaching this helper.
CREATE FUNCTION public.kq_warehouse_apply_handling_wear(p_user UUID,p_uses JSONB) RETURNS VOID
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE equipment JSONB:=public.kq_warehouse_handling_condition(p_user); next_assets JSONB;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM jsonb_each_text(equipment) e WHERE e.value::INTEGER<100 AND COALESCE((p_uses->>e.key)::INTEGER,0)>0)
 THEN RETURN; END IF;
 SELECT jsonb_agg(CASE WHEN equipment ? (asset->>'code') AND asset->>'kind'='option' AND asset->'zoneId'='null'::JSONB
  AND COALESCE((p_uses->>(asset->>'code'))::INTEGER,0)>0
  THEN jsonb_set(asset,'{wearPercent}',to_jsonb(LEAST(100,(asset->>'wearPercent')::INTEGER+(p_uses->>(asset->>'code'))::INTEGER)))
  ELSE asset END ORDER BY n)
 INTO next_assets FROM public.kq_warehouse_layouts l
 CROSS JOIN LATERAL jsonb_array_elements(l.culture_assets) WITH ORDINALITY data(asset,n)
 WHERE l.user_id=p_user;
 UPDATE public.kq_warehouse_layouts SET culture_assets=next_assets,revision=revision+1,updated_at=now()
 WHERE user_id=p_user;
END $$;

ALTER FUNCTION public.kq_staff_snapshot(UUID) RENAME TO kq_staff_snapshot_before_handling;
CREATE FUNCTION public.kq_staff_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_set(public.kq_staff_snapshot_before_handling(p_user),'{context,warehouseHandling}',
  public.kq_warehouse_handling_condition(p_user));
$$;

CREATE FUNCTION public.kq_staff_apply_trim_handling(p_user UUID,p_previous JSONB,p_next JSONB) RETURNS VOID
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE equipment JSONB; task JSONB; manual BOOLEAN; time_factor NUMERIC; rate NUMERIC; skill INTEGER;
 trolley_uses INTEGER:=0; table_uses INTEGER:=0;
BEGIN
 FOR task IN SELECT task_json FROM jsonb_array_elements(p_next->'tasks') task_json
  WHERE task_json->>'kind'='trim' AND task_json->'trimQueue'='true'::JSONB
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_previous->'tasks') old WHERE old->>'id'=task_json->>'id')
 LOOP
  equipment:=COALESCE(equipment,public.kq_warehouse_handling_condition(p_user));
  manual:=task->>'trimMode'='manual';
  skill:=(task->>'skillLevel')::INTEGER;
  IF skill IS NULL OR skill NOT BETWEEN 1 AND 10 OR COALESCE(task->>'trimMode','') NOT IN ('manual','machine')
   OR jsonb_typeof(task->'trimRateGramsPerHour') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'staff_invalid'; END IF;
  time_factor:=(1-.10*(100-COALESCE((equipment->>'SIM-LOGISTICS-01')::NUMERIC,100))/100);
  IF manual THEN time_factor:=time_factor*(1-.20*(100-COALESCE((equipment->>'SIM-LOGISTICS-03')::NUMERIC,100))/100); END IF;
  rate:=round((60+(skill-1)*10)*CASE WHEN manual THEN 1 ELSE 4 END/time_factor,6);
  IF abs((task->>'trimRateGramsPerHour')::NUMERIC-rate)>.000001 THEN RAISE EXCEPTION 'staff_trim_changed'; END IF;
  trolley_uses:=trolley_uses+1;
  IF manual THEN table_uses:=table_uses+1; END IF;
 END LOOP;
 IF trolley_uses>0 THEN
  PERFORM public.kq_warehouse_apply_handling_wear(p_user,jsonb_build_object('SIM-LOGISTICS-01',trolley_uses,'SIM-LOGISTICS-03',table_uses));
 END IF;
END $$;

SELECT pg_temp.kq_handling_patch('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)',
 'PERFORM public.kq_staff_validate_task_results(p_user_id,p_state);',
 E'PERFORM public.kq_staff_validate_task_results(p_user_id,p_state);\n PERFORM public.kq_staff_apply_trim_handling(p_user_id,account.state,p_state);');

CREATE FUNCTION public.kq_processing_apply_cart_wear(p_user UUID,p_work JSONB,p_product_grams NUMERIC) RETURNS VOID
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE handling JSONB; charges INTEGER; base_hours NUMERIC; wear INTEGER; expected_hours NUMERIC;
BEGIN
 SELECT machine->'handling' INTO handling FROM jsonb_array_elements(p_work->'machines') machine WHERE machine->>'code'='FREEZE-DRYER';
 IF handling IS NULL THEN RETURN; END IF;
 charges:=ceil(p_product_grams*4/5443)::INTEGER;
 base_hours:=charges*.5;
 wear:=(public.kq_warehouse_handling_condition(p_user)->>'SIM-LOGISTICS-02')::INTEGER;
 expected_hours:=round(base_hours*(1-.25*(100-COALESCE(wear,100))/100),6);
 IF handling->'charges' IS DISTINCT FROM to_jsonb(charges) OR handling->'baseHours' IS DISTINCT FROM to_jsonb(base_hours)
  OR jsonb_typeof(handling->'hours') IS DISTINCT FROM 'number' OR abs((handling->>'hours')::NUMERIC-expected_hours)>.000001
 THEN RAISE EXCEPTION 'processing_work_changed'; END IF;
 IF wear<100 THEN PERFORM public.kq_warehouse_apply_handling_wear(p_user,jsonb_build_object('SIM-LOGISTICS-02',charges)); END IF;
END $$;

SELECT pg_temp.kq_handling_patch('public.kq_warehouse_queue_processing()',
 '  INSERT INTO public.kq_processing_jobs(flower_id,user_id,route,input_grams,nominal_hours,passive_hours,work,equipment_codes)',
 E'  PERFORM public.kq_processing_apply_cart_wear(NEW.user_id,quote->''processingWork'',(quote->>''productGrams'')::NUMERIC);\n  INSERT INTO public.kq_processing_jobs(flower_id,user_id,route,input_grams,nominal_hours,passive_hours,work,equipment_codes)');

REVOKE ALL ON FUNCTION public.kq_warehouse_handling_codes(),public.kq_warehouse_handling_quantity(JSONB,TEXT),
 public.kq_warehouse_new_handling_cost(JSONB,JSONB),public.rpc_kq_warehouse_convert_handling(UUID,INTEGER),
 public.kq_warehouse_handling_condition(UUID),public.kq_warehouse_apply_handling_wear(UUID,JSONB),
 public.kq_staff_snapshot(UUID),public.kq_staff_snapshot_before_handling(UUID),
 public.kq_staff_apply_trim_handling(UUID,JSONB,JSONB),public.kq_processing_apply_cart_wear(UUID,JSONB,NUMERIC)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_convert_handling(UUID,INTEGER) TO service_role;

COMMIT;
