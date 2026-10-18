BEGIN;

-- Fictional commercial-quality balance. Prices and the jury score are unchanged.
-- Retain the original drying rules for cultures already started before this update.
ALTER FUNCTION public.kq_warehouse_postharvest_profile(JSONB,JSONB)
 RENAME TO kq_warehouse_postharvest_profile_v1;

CREATE FUNCTION public.kq_warehouse_postharvest_profile(p_state JSONB,p_capacity JSONB DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE drying NUMERIC:=0; storage NUMERIC:=0; dry_capacity NUMERIC:=0; store_capacity NUMERIC:=0;
 protection NUMERIC:=0; climate_bonus NUMERIC:=0; climate_protection NUMERIC:=0;
 item RECORD; climate JSONB; factor NUMERIC;
BEGIN
 FOR item IN
  SELECT d.spec,(e->>'width')::NUMERIC*(e->>'height')::NUMERIC*(d.spec->'zoneLayout'->>'unitsPerM2')::NUMERIC
    *(d.spec->'zoneLayout'->>'capacityGramsPerUnit')::NUMERIC capacity
  FROM jsonb_array_elements(COALESCE(p_state->'serviceZones','[]'::JSONB)) e
  CROSS JOIN LATERAL (SELECT public.kq_warehouse_device(COALESCE(e->>'deviceCode',e->>'code')) spec) d
  WHERE d.spec->>'kind' IN ('drying','storage') AND d.spec->>'kind'=e->>'kind'
 LOOP
  IF item.spec->>'kind'='drying' THEN
   dry_capacity:=dry_capacity+item.capacity;
   drying:=drying+item.capacity*CASE item.spec->>'tier' WHEN 'standard' THEN 0.35 WHEN 'premium' THEN 0.7 ELSE 0 END;
  ELSE
   store_capacity:=store_capacity+item.capacity;
   storage:=storage+item.capacity*CASE item.spec->>'tier' WHEN 'standard' THEN 0.3 WHEN 'premium' THEN 0.6 ELSE 0 END;
   protection:=protection+item.capacity*CASE item.spec->>'tier' WHEN 'standard' THEN 75 WHEN 'premium' THEN 55 ELSE 100 END;
  END IF;
 END LOOP;
 climate:=public.kq_warehouse_device(p_state->>'storageClimateCode');
 IF climate->>'kind'='climate' AND store_capacity>0 THEN
  climate_bonus:=CASE climate->>'tier' WHEN 'economy' THEN 0.1 WHEN 'standard' THEN 0.25 WHEN 'premium' THEN 0.5 ELSE 0 END;
  climate_protection:=CASE climate->>'tier' WHEN 'economy' THEN 10 WHEN 'standard' THEN 25 WHEN 'premium' THEN 40 ELSE 0 END;
 END IF;
 factor:=ceil(CASE WHEN store_capacity>0 THEN ceil(protection/store_capacity) ELSE 100 END*(100-climate_protection)/100);
 RETURN jsonb_build_object('dryingQualityBonus',CASE WHEN dry_capacity>0 THEN round(drying/dry_capacity,2) ELSE 0 END,
  'storageQualityBonus',CASE WHEN store_capacity>0 THEN round(storage/store_capacity,2) ELSE 0 END,
  'climateQualityBonus',climate_bonus,'containerQualityBonus',public.kq_storage_container_quality_bonus(p_capacity),
  'aromaRateFactor',factor,'chemistryRateFactor',factor,'curingBonusWeightedMs',0);
END $$;

CREATE OR REPLACE FUNCTION public.kq_storage_postharvest_lot() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE layout JSONB; culture_warehouse JSONB; profile JSONB; drying JSONB;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT l.state INTO layout FROM public.kq_warehouse_layouts l WHERE l.user_id=NEW.user_id;
  SELECT r.state->'warehouse' INTO culture_warehouse FROM public.kq_flowers f
   JOIN public.kq_runs r ON r.id=f.run_id WHERE f.id=NEW.flower_id;
  profile:=public.kq_warehouse_postharvest_profile(layout,NEW.state->'capacity');
  drying:=CASE WHEN culture_warehouse->'postHarvestBalanceVersion'='2'::JSONB
   THEN public.kq_warehouse_postharvest_profile(culture_warehouse->'sourceState')
   ELSE public.kq_warehouse_postharvest_profile_v1(culture_warehouse->'sourceState') END;
  NEW.state:=NEW.state||jsonb_build_object('postHarvest',jsonb_set(profile,'{dryingQualityBonus}',drying->'dryingQualityBonus'));
 ELSIF NEW.state ? 'postHarvest' AND NEW.state->'capacity' IS DISTINCT FROM OLD.state->'capacity' THEN
  NEW.state:=jsonb_set(NEW.state,'{postHarvest,containerQualityBonus}',to_jsonb(public.kq_storage_container_quality_bonus(NEW.state->'capacity')));
 END IF;
 RETURN NEW;
END $$;

-- New starts must use the current balance. Existing snapshots remain immutable
-- and their completion continues through the historical validators.
DO $$ DECLARE body TEXT; anchor TEXT:=' IF w->>''version'' IS DISTINCT FROM ''2'' THEN'; BEGIN
 body:=pg_get_functiondef('public.kq_validate_warehouse_run_start(uuid,uuid,jsonb)'::regprocedure);
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'postharvest_balance_start_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,
  ' IF w->''postHarvestBalanceVersion'' IS DISTINCT FROM ''2''::JSONB THEN RAISE EXCEPTION ''warehouse_layout_changed''; END IF;'||anchor);
END $$;

-- Freeze all elapsed exposure and curing at the previous rates first. The new
-- room benefit can only accrue for the remaining curing time; completed curing
-- and the drying score can never receive a retroactive windfall.
DO $$ DECLARE lot RECORD; settled JSONB; profile JSONB;
 checkpoint TIMESTAMPTZ:=date_trunc('milliseconds',now());
BEGIN
 FOR lot IN SELECT s.flower_id,s.state,l.state layout FROM public.kq_storage_lots s
  LEFT JOIN public.kq_warehouse_layouts l ON l.user_id=s.user_id FOR UPDATE OF s
 LOOP
  settled:=public.kq_storage_settle(lot.state,checkpoint);
  profile:=public.kq_warehouse_postharvest_profile(lot.layout,settled->'capacity')||jsonb_build_object(
   'dryingQualityBonus',COALESCE(settled->'postHarvest'->'dryingQualityBonus','0'::JSONB),
   'curingBonusWeightedMs',COALESCE(settled->'postHarvest'->'curingBonusWeightedMs','0'::JSONB));
  UPDATE public.kq_storage_lots SET state=settled||jsonb_build_object('postHarvest',profile),revision=revision+1
   WHERE flower_id=lot.flower_id;
 END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.kq_warehouse_postharvest_profile_v1(JSONB,JSONB),
 public.kq_warehouse_postharvest_profile(JSONB,JSONB),public.kq_storage_postharvest_lot()
 FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
