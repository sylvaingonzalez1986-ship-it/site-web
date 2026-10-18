BEGIN;

-- Fictional game balance. Existing lots, paid inventory and immutable culture
-- snapshots are preserved. A room upgrade only changes future exposure.
ALTER FUNCTION public.kq_warehouse_device(TEXT) RENAME TO kq_warehouse_device_before_postharvest;
CREATE FUNCTION public.kq_warehouse_device(p_code TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT COALESCE(public.kq_warehouse_device_before_postharvest(p_code),
  (SELECT jsonb_build_object('code',code,'kind','climate','tier',tier,'priceCents',price,'watts',watts,
    'purchasable',true,'gameCapacity',jsonb_build_object('unit','m2','value',100))
   FROM (VALUES ('SIM-STORAGE-CLIMATE-01','economy',29900,120),
    ('SIM-STORAGE-CLIMATE-02','standard',79900,200),('SIM-STORAGE-CLIMATE-03','premium',149900,350)) c(code,tier,price,watts)
   WHERE code=p_code));
$$;

CREATE FUNCTION public.kq_storage_container_quality_bonus(p_capacity JSONB) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN COALESCE((p_capacity->>'totalUnits')::NUMERIC,0)>0 THEN
  round(COALESCE(sum((a->>'storedUnits')::NUMERIC*CASE public.kq_storage_container(a->>'containerCode')->>'methodCode'
   WHEN 'STORAGE-GROVE' THEN 0.1 WHEN 'STORAGE-BOVEDA' THEN 0.15 WHEN 'STORAGE-CVAULT' THEN 0.2
   WHEN 'STORAGE-CANNATROL' THEN 0.3 ELSE 0 END),0)/(p_capacity->>'totalUnits')::NUMERIC,2)
  ELSE 0 END FROM jsonb_array_elements(COALESCE(p_capacity->'allocations','[]'::JSONB)) a;
$$;

CREATE FUNCTION public.kq_warehouse_postharvest_profile(p_state JSONB,p_capacity JSONB DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE drying NUMERIC:=0; storage NUMERIC:=0; dry_capacity NUMERIC:=0; store_capacity NUMERIC:=0;
 protection NUMERIC:=0; climate_level INTEGER:=0; item RECORD; climate JSONB; factor NUMERIC;
BEGIN
 FOR item IN
  SELECT d.spec,(e->>'width')::NUMERIC*(e->>'height')::NUMERIC*(d.spec->'zoneLayout'->>'unitsPerM2')::NUMERIC
    *(d.spec->'zoneLayout'->>'capacityGramsPerUnit')::NUMERIC capacity
  FROM jsonb_array_elements(COALESCE(p_state->'serviceZones','[]'::JSONB)) e
  CROSS JOIN LATERAL (SELECT public.kq_warehouse_device(COALESCE(e->>'deviceCode',e->>'code')) spec) d
  WHERE d.spec->>'kind' IN ('drying','storage')
 LOOP
  IF item.spec->>'kind'='drying' THEN
   dry_capacity:=dry_capacity+item.capacity;
   drying:=drying+item.capacity*CASE item.spec->>'tier' WHEN 'standard' THEN 0.2 WHEN 'premium' THEN 0.4 ELSE 0 END;
  ELSE
   store_capacity:=store_capacity+item.capacity;
   storage:=storage+item.capacity*CASE item.spec->>'tier' WHEN 'standard' THEN 0.15 WHEN 'premium' THEN 0.3 ELSE 0 END;
   protection:=protection+item.capacity*CASE item.spec->>'tier' WHEN 'standard' THEN 80 WHEN 'premium' THEN 60 ELSE 100 END;
  END IF;
 END LOOP;
 climate:=public.kq_warehouse_device(p_state->>'storageClimateCode');
 IF climate->>'kind'='climate' AND store_capacity>0 THEN
  climate_level:=CASE climate->>'tier' WHEN 'economy' THEN 1 WHEN 'standard' THEN 2 WHEN 'premium' THEN 3 ELSE 0 END;
 END IF;
 factor:=ceil(CASE WHEN store_capacity>0 THEN ceil(protection/store_capacity) ELSE 100 END*(100-climate_level*10)/100);
 RETURN jsonb_build_object('dryingQualityBonus',CASE WHEN dry_capacity>0 THEN round(drying/dry_capacity,2) ELSE 0 END,
  'storageQualityBonus',CASE WHEN store_capacity>0 THEN round(storage/store_capacity,2) ELSE 0 END,
  'climateQualityBonus',climate_level::NUMERIC/10,'containerQualityBonus',public.kq_storage_container_quality_bonus(p_capacity),
  'aromaRateFactor',factor,'chemistryRateFactor',factor,'curingBonusWeightedMs',0);
END $$;

ALTER FUNCTION public.kq_warehouse_catalog_projection(JSONB) RENAME TO kq_warehouse_catalog_before_postharvest;
CREATE FUNCTION public.kq_warehouse_catalog_projection(p_state JSONB) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE result JSONB:=public.kq_warehouse_catalog_before_postharvest(p_state); climate JSONB; quantity NUMERIC;
 watts NUMERIC; energy NUMERIC;
BEGIN
 IF NOT(p_state ? 'storageClimateCode') THEN RETURN result; END IF;
 climate:=public.kq_warehouse_device(p_state->>'storageClimateCode');
 IF jsonb_typeof(p_state->'storageClimateCode') IS DISTINCT FROM 'string' OR climate->>'kind' IS DISTINCT FROM 'climate'
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_state->'serviceZones','[]'::JSONB)) z WHERE z->>'kind'='storage')
  THEN RAISE EXCEPTION 'warehouse_storage_climate_invalid'; END IF;
 SELECT COALESCE(sum((e->>'quantity')::NUMERIC),0) INTO quantity FROM jsonb_array_elements(p_state->'equipment') e
  WHERE e->>'code'=p_state->>'storageClimateCode';
 IF quantity<1 THEN RAISE EXCEPTION 'warehouse_equipment_missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_state->'zones') z WHERE z->'active'='true'::JSONB) THEN RETURN result; END IF;
 watts:=(climate->>'watts')::NUMERIC;
 energy:=round((result->>'energyKwh')::NUMERIC+watts*1440/1000,3);
 RETURN result||jsonb_build_object('powerWatts',(result->>'powerWatts')::NUMERIC+watts,
  'energyKwh',energy,'energyCostCents',round(energy*25));
END $$;

-- Zone cultures share the installed climate bill by active growing area.
-- The caller has already compared this complete source plan to the locked
-- warehouse row; the client cannot choose a cheaper allocation percentage.
CREATE FUNCTION public.kq_warehouse_validate_postharvest_run(p_warehouse JSONB) RETURNS VOID
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE plan JSONB:=p_warehouse->'sourceState'; selected JSONB; expected JSONB; climate JSONB; field TEXT;
 area NUMERIC; full_area NUMERIC; share NUMERIC; watts NUMERIC:=0; energy NUMERIC;
BEGIN
 selected:=jsonb_set(plan-'storageClimateCode','{zones}',p_warehouse->'zones')||'{"serviceZones":[]}'::JSONB;
 expected:=public.kq_warehouse_catalog_before_postharvest(selected);
 IF plan ? 'storageClimateCode' THEN
  PERFORM public.kq_warehouse_catalog_projection(plan);
  climate:=public.kq_warehouse_device(plan->>'storageClimateCode');
  SELECT COALESCE(sum((z->>'width')::NUMERIC*(z->>'height')::NUMERIC),0) INTO full_area
   FROM jsonb_array_elements(plan->'zones') z WHERE z->'active'='true'::JSONB;
  SELECT COALESCE(sum((z->>'width')::NUMERIC*(z->>'height')::NUMERIC),0) INTO area
   FROM jsonb_array_elements(p_warehouse->'zones') z WHERE z->'active'='true'::JSONB;
  IF full_area>0 THEN share:=area/full_area; watts:=(climate->>'watts')::NUMERIC*share; END IF;
  energy:=round((expected->>'energyKwh')::NUMERIC+watts*1440/1000,3);
  expected:=expected||jsonb_build_object('powerWatts',round((expected->>'powerWatts')::NUMERIC+watts,3),
   'energyKwh',energy,'energyCostCents',round(energy*25));
 END IF;
 FOREACH field IN ARRAY ARRAY['powerWatts','energyKwh','energyCostCents'] LOOP
  IF p_warehouse->field IS DISTINCT FROM expected->field THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 END LOOP;
END $$;

DO $$ DECLARE body TEXT; anchor TEXT:='PERFORM public.kq_warehouse_validate_catalog_run(validation);'; BEGIN
 body:=pg_get_functiondef('public.kq_validate_warehouse_run_start(uuid,uuid,jsonb)'::regprocedure);
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'postharvest_zone_validation_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,'PERFORM public.kq_warehouse_validate_postharvest_run(w);');
END $$;

CREATE OR REPLACE FUNCTION public.kq_storage_settle(p_state JSONB,p_until TIMESTAMPTZ) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE elapsed NUMERIC; method JSONB; total INTEGER; stored INTEGER; aroma NUMERIC; chemistry NUMERIC;
 result JSONB; profile JSONB:=p_state->'postHarvest'; curing_elapsed NUMERIC; bonus_rate NUMERIC; protected_fraction NUMERIC:=1;
BEGIN
 elapsed:=GREATEST(0,EXTRACT(EPOCH FROM(p_until-(p_state->>'lastSettledAt')::TIMESTAMPTZ))*1000);
 method:=public.kq_storage_method(p_state->>'methodCode');
 IF method IS NULL THEN RAISE EXCEPTION 'storage_invalid_method'; END IF;
 aroma:=(method->>'aromaRate')::INTEGER; chemistry:=(method->>'chemistryRate')::INTEGER;
 total:=(p_state->'capacity'->>'totalUnits')::INTEGER;
 IF total>0 THEN
  SELECT COALESCE(sum((entry->>'storedUnits')::INTEGER),0),
   COALESCE(sum((entry->>'storedUnits')::NUMERIC*(public.kq_storage_method(public.kq_storage_container(entry->>'containerCode')->>'methodCode')->>'aromaRate')::INTEGER),0),
   COALESCE(sum((entry->>'storedUnits')::NUMERIC*(public.kq_storage_method(public.kq_storage_container(entry->>'containerCode')->>'methodCode')->>'chemistryRate')::INTEGER),0)
   INTO stored,aroma,chemistry FROM jsonb_array_elements(p_state->'capacity'->'allocations') entry;
  aroma:=ceil((aroma*COALESCE((profile->>'aromaRateFactor')::NUMERIC,100)/100+(total-stored)*100)/total);
  chemistry:=ceil((chemistry*COALESCE((profile->>'chemistryRateFactor')::NUMERIC,100)/100+(total-stored)*100)/total);
  protected_fraction:=stored::NUMERIC/total;
 ELSIF profile IS NOT NULL THEN
  aroma:=ceil(aroma*(profile->>'aromaRateFactor')::NUMERIC/100);
  chemistry:=ceil(chemistry*(profile->>'chemistryRateFactor')::NUMERIC/100);
  IF p_state ? 'capacity' THEN protected_fraction:=0; END IF;
 END IF;
 result:=p_state||jsonb_build_object('lastSettledAt',GREATEST(p_until,(p_state->>'lastSettledAt')::TIMESTAMPTZ),
  'exposure',jsonb_build_object('aromaWeightedMs',(p_state->'exposure'->>'aromaWeightedMs')::NUMERIC+elapsed*aroma,
   'chemistryWeightedMs',(p_state->'exposure'->>'chemistryWeightedMs')::NUMERIC+elapsed*chemistry));
 IF profile IS NOT NULL THEN
  curing_elapsed:=GREATEST(0,EXTRACT(EPOCH FROM(LEAST(p_until,(p_state->>'readyAt')::TIMESTAMPTZ)
   -GREATEST((p_state->>'lastSettledAt')::TIMESTAMPTZ,(p_state->>'curingStartedAt')::TIMESTAMPTZ)))*1000);
  bonus_rate:=round((((profile->>'storageQualityBonus')::NUMERIC+(profile->>'climateQualityBonus')::NUMERIC)*protected_fraction
   +(profile->>'containerQualityBonus')::NUMERIC)*100);
  result:=jsonb_set(result,'{postHarvest,curingBonusWeightedMs}',to_jsonb((profile->>'curingBonusWeightedMs')::NUMERIC+curing_elapsed*bonus_rate));
 END IF;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.kq_storage_condition(p_state JSONB,p_jury NUMERIC,p_now TIMESTAMPTZ) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE start_at TIMESTAMPTZ:=(p_state->>'curingStartedAt')::TIMESTAMPTZ;
 last_at TIMESTAMPTZ:=(p_state->>'lastSettledAt')::TIMESTAMPTZ;
 ready_at TIMESTAMPTZ:=(p_state->>'readyAt')::TIMESTAMPTZ;
 eval_at TIMESTAMPTZ; next_at TIMESTAMPTZ; settled JSONB; aroma_loss NUMERIC; chemistry_loss NUMERIC; loss NUMERIC;
 profile JSONB; bonus NUMERIC:=0; score NUMERIC; duration NUMERIC;
BEGIN
 eval_at:=GREATEST(last_at,start_at+floor(GREATEST(0,EXTRACT(EPOCH FROM(GREATEST(p_now,last_at)-start_at)))/14400)*interval '4 hours');
 settled:=public.kq_storage_settle(p_state,eval_at);
 aroma_loss:=LEAST(40,floor((settled->'exposure'->>'aromaWeightedMs')::NUMERIC/(15*14400000::NUMERIC*100)));
 chemistry_loss:=LEAST(64,floor((settled->'exposure'->>'chemistryWeightedMs')::NUMERIC/(60*14400000::NUMERIC*100)));
 loss:=round((LEAST(aroma_loss,GREATEST(0,(p_state->'baseline'->>'aroma')::NUMERIC-35))+
  LEAST(chemistry_loss,GREATEST(0,(p_state->'baseline'->'care'->>'cannabinoidExpression')::NUMERIC-35)))/25,2);
 next_at:=start_at+(floor(GREATEST(0,EXTRACT(EPOCH FROM(GREATEST(p_now,last_at)-start_at)))/14400)+1)*interval '4 hours';
 IF ready_at>p_now THEN next_at:=LEAST(next_at,ready_at); END IF;
 IF p_state ? 'postHarvest' THEN
  profile:=public.kq_storage_settle(p_state,GREATEST(p_now,last_at))->'postHarvest';
  duration:=EXTRACT(EPOCH FROM(ready_at-start_at))*1000;
  bonus:=(profile->>'dryingQualityBonus')::NUMERIC+CASE WHEN duration>0
   THEN round((profile->>'curingBonusWeightedMs')::NUMERIC/(duration*100),2) ELSE 0 END;
  score:=GREATEST(0,LEAST(10,round(p_jury+bonus-loss,2)));
 ELSE score:=GREATEST(0,round(p_jury-loss,2)); END IF;
 RETURN jsonb_build_object('conditionScore',score,'qualityDelta',CASE WHEN p_state ? 'postHarvest' THEN round(score-p_jury,2) ELSE -loss END,
  'readyAt',ready_at,'nextChangeAt',next_at,'stage',CASE WHEN p_now>=ready_at THEN 'ready' ELSE 'curing' END);
END $$;

-- New harvests freeze the drying room from the culture's immutable source
-- plan. Buying better shelves after that culture cannot rewrite its drying.
CREATE FUNCTION public.kq_storage_postharvest_lot() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE layout JSONB; culture_plan JSONB; profile JSONB;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT l.state INTO layout FROM public.kq_warehouse_layouts l WHERE l.user_id=NEW.user_id;
  SELECT r.state->'warehouse'->'sourceState' INTO culture_plan FROM public.kq_flowers f
   JOIN public.kq_runs r ON r.id=f.run_id WHERE f.id=NEW.flower_id;
  profile:=public.kq_warehouse_postharvest_profile(layout,NEW.state->'capacity');
  profile:=jsonb_set(profile,'{dryingQualityBonus}',public.kq_warehouse_postharvest_profile(culture_plan)->'dryingQualityBonus');
  NEW.state:=NEW.state||jsonb_build_object('postHarvest',profile);
 ELSIF NEW.state ? 'postHarvest' AND NEW.state->'capacity' IS DISTINCT FROM OLD.state->'capacity' THEN
  NEW.state:=jsonb_set(NEW.state,'{postHarvest,containerQualityBonus}',to_jsonb(public.kq_storage_container_quality_bonus(NEW.state->'capacity')));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_storage_postharvest_lot BEFORE INSERT OR UPDATE OF state ON public.kq_storage_lots
 FOR EACH ROW EXECUTE FUNCTION public.kq_storage_postharvest_lot();

-- This trigger runs after the existing alphabetical container-sync trigger.
-- Old protection and old bonus rates are settled before the new room applies.
CREATE FUNCTION public.kq_warehouse_postharvest_sync() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lot RECORD; settled JSONB; profile JSONB;
BEGIN
 IF public.kq_warehouse_postharvest_profile(OLD.state) IS NOT DISTINCT FROM public.kq_warehouse_postharvest_profile(NEW.state) THEN RETURN NEW; END IF;
 FOR lot IN SELECT flower_id,state FROM public.kq_storage_lots WHERE user_id=NEW.user_id FOR UPDATE LOOP
  settled:=public.kq_storage_settle(lot.state,date_trunc('milliseconds',now()));
  profile:=public.kq_warehouse_postharvest_profile(NEW.state,settled->'capacity')||jsonb_build_object(
   'dryingQualityBonus',COALESCE(settled->'postHarvest'->'dryingQualityBonus','0'::JSONB),
   'curingBonusWeightedMs',COALESCE(settled->'postHarvest'->'curingBonusWeightedMs','0'::JSONB));
  UPDATE public.kq_storage_lots SET state=settled||jsonb_build_object('postHarvest',profile),revision=revision+1 WHERE flower_id=lot.flower_id;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_warehouse_z_postharvest_sync AFTER UPDATE OF state ON public.kq_warehouse_layouts
 FOR EACH ROW EXECUTE FUNCTION public.kq_warehouse_postharvest_sync();

REVOKE ALL ON FUNCTION public.kq_warehouse_device_before_postharvest(TEXT),public.kq_warehouse_device(TEXT),
 public.kq_storage_container_quality_bonus(JSONB),public.kq_warehouse_postharvest_profile(JSONB,JSONB),
 public.kq_storage_settle(JSONB,TIMESTAMPTZ),public.kq_storage_condition(JSONB,NUMERIC,TIMESTAMPTZ),
 public.kq_storage_postharvest_lot(),public.kq_warehouse_postharvest_sync(),
 public.kq_warehouse_catalog_before_postharvest(JSONB),public.kq_warehouse_catalog_projection(JSONB),
 public.kq_warehouse_validate_postharvest_run(JSONB)
 FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
