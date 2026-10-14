BEGIN;

-- The shared workshop remains the single inventory for processing. The room
-- layout controls culture and storage; it never replaces an owned workshop.
CREATE OR REPLACE FUNCTION public.kq_warehouse_guard_legacy_equipment() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner UUID:=COALESCE(NEW.user_id,OLD.user_id);
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=owner)
  OR public.kq_is_shared_processing_equipment(NEW.equipment_code) THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM public.kq_player_equipment WHERE user_id=owner AND equipment_code=NEW.equipment_code AND tent_number=NEW.tent_number) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'warehouse_legacy_equipment_archived';
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_guard_legacy_equipment() FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.kq_warehouse_layouts ADD COLUMN workshop_reconciliation JSONB;
-- Imports preserve already purchased machines, including for a novice whose
-- career would prevent buying that model today. This exemption lasts only for
-- the data correction transaction, never for subsequent purchases or upgrades.
ALTER TABLE public.kq_player_equipment DISABLE TRIGGER kq_guard_equipment_career;
DO $$
DECLARE layout public.kq_warehouse_layouts%ROWTYPE; device RECORD; quantity INTEGER; owned BOOLEAN;
 basis BIGINT; removed BIGINT; refund BIGINT; extra_basis BIGINT; paid_basis BIGINT;
 imports JSONB; next_state JSONB;
BEGIN
 FOR layout IN SELECT * FROM public.kq_warehouse_layouts FOR UPDATE LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||layout.user_id::TEXT,0));
  PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=layout.user_id FOR UPDATE;
  SELECT COALESCE((SELECT sum((e->>'purchase_price_cents')::BIGINT)
     FROM jsonb_array_elements(layout.legacy_archive->'equipment') e WHERE public.kq_is_shared_processing_equipment(e->>'equipment_code')),0)
   +COALESCE((SELECT sum((u->>'price_cents')::BIGINT)
     FROM jsonb_array_elements(layout.legacy_archive->'upgrades') u WHERE public.kq_is_shared_processing_equipment(u->>'equipment_code')),0) INTO basis;
  removed:=LEAST(layout.migration_credit_cents,basis);
  SELECT COALESCE(sum((receipt->>'investmentCents')::BIGINT),0) INTO paid_basis
   FROM public.kq_warehouse_receipts WHERE user_id=layout.user_id;
  imports:='[]'::JSONB; extra_basis:=0;
  FOR device IN SELECT * FROM (VALUES('GV-GP50-7','PRESS-0600',36999),('GV-WASHER-36L','WASHER-25L',12799)) d(physical_code,legacy_code,price) LOOP
   SELECT COALESCE(sum((e->>'quantity')::INTEGER),0) INTO quantity
    FROM jsonb_array_elements(layout.state->'equipment') e WHERE e->>'code'=device.physical_code;
   IF quantity=0 THEN CONTINUE; END IF;
   SELECT EXISTS(SELECT 1 FROM public.kq_player_equipment WHERE user_id=layout.user_id AND tent_number=1
    AND equipment_code=device.legacy_code AND purchase_price_cents>0) INTO owned;
   IF NOT owned THEN
    INSERT INTO public.kq_player_equipment(user_id,tent_number,equipment_code,purchase_price_cents,level)
     VALUES(layout.user_id,1,device.legacy_code,device.price,1)
     ON CONFLICT(user_id,tent_number,equipment_code) DO UPDATE SET purchase_price_cents=EXCLUDED.purchase_price_cents;
    INSERT INTO public.kq_equipment_loadouts(user_id,tent_number,slot,equipment_code)
     SELECT layout.user_id,1,slot,code FROM public.kq_equipment_catalog WHERE code=device.legacy_code
     ON CONFLICT(user_id,tent_number,slot) DO NOTHING;
   END IF;
   extra_basis:=extra_basis+GREATEST(0,quantity-CASE WHEN owned THEN 0 ELSE 1 END)::BIGINT*device.price;
   imports:=imports||jsonb_build_array(jsonb_build_object('physicalCode',device.physical_code,'legacyCode',device.legacy_code,
    'quantity',quantity,'imported',NOT owned,'unitPriceCents',device.price));
  END LOOP;
  -- Refund only duplicate device principal, with no installation markup and no
  -- cash creation; cap it by investments recorded in successful paid receipts.
  refund:=LEAST(extra_basis,paid_basis);
  next_state:=jsonb_set(layout.state,'{equipment}',COALESCE((SELECT jsonb_agg(e)
   FROM jsonb_array_elements(layout.state->'equipment') e WHERE e->>'code' NOT IN ('GV-GP50-7','GV-WASHER-36L')),'[]'::JSONB));
  UPDATE public.kq_warehouse_layouts SET state=next_state,revision=revision+1,
   migration_credit_cents=migration_credit_cents-removed+refund,updated_at=now(),
   workshop_reconciliation=jsonb_build_object('version',1,'occurredAt',now(),'legacyWorkshopBasisCents',basis,
    'creditRemovedCents',removed,'previouslySpentCreditCents',basis-removed,'duplicateDeviceCreditCents',refund,'imports',imports)
   WHERE user_id=layout.user_id;
  UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=layout.user_id;
 END LOOP;
END $$;
ALTER TABLE public.kq_player_equipment ENABLE TRIGGER kq_guard_equipment_career;
ALTER TABLE public.kq_warehouse_layouts ALTER COLUMN workshop_reconciliation SET DEFAULT '{"version":1,"legacyCreditExcluded":true}'::JSONB;
COMMENT ON COLUMN public.kq_warehouse_layouts.workshop_reconciliation IS 'Immutable conversion archive is preserved; this correction records recovered credit and grandfathered purchases without debiting cash.';

DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_warehouse_initialize(uuid,jsonb)'::regprocedure) INTO body;
 fragment:='sum(purchase_price_cents) FROM public.kq_player_equipment WHERE user_id=p_user_id';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'warehouse_workshop_credit_purchase_anchor_changed'; END IF;
 body:=replace(body,fragment,fragment||' AND NOT public.kq_is_shared_processing_equipment(equipment_code)');
 fragment:='sum(price_cents) FROM public.kq_equipment_upgrade_receipts WHERE user_id=p_user_id';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'warehouse_workshop_credit_upgrade_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,fragment||' AND NOT public.kq_is_shared_processing_equipment(equipment_code)');

 SELECT pg_get_functiondef('public.rpc_kq_warehouse_save(uuid,uuid,jsonb,integer,jsonb,jsonb,integer)'::regprocedure) INTO body;
 fragment:='IF p_request->''expectedCostCents'' IS DISTINCT FROM to_jsonb(p_cost_cents)';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'warehouse_workshop_purchase_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,E'IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_next_state->''equipment'') e WHERE e->>''code'' IN (''GV-GP50-7'',''GV-WASHER-36L'')) THEN RAISE EXCEPTION ''warehouse_workshop_purchase''; END IF;\n '||fragment);

 SELECT pg_get_functiondef('public.kq_assert_processing_maintenance(uuid,text)'::regprocedure) INTO body;
 fragment:=' IF EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=p_user_id) THEN RETURN; END IF;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'warehouse_workshop_maintenance_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'');
 SELECT pg_get_functiondef('public.kq_record_chanvrier_processing()'::regprocedure) INTO body;
 fragment:=' AND NOT EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=owner)';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'warehouse_workshop_wear_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'');
END $$;

CREATE OR REPLACE FUNCTION public.kq_warehouse_processing_codes(p_user UUID) RETURNS TEXT[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT array_agg(code ORDER BY code) FROM (
  SELECT 'TENT-080-STARTER'::TEXT AS code UNION
  SELECT l.equipment_code FROM public.kq_equipment_loadouts l
   JOIN public.kq_player_equipment e USING(user_id,tent_number,equipment_code)
   JOIN public.kq_equipment_catalog c ON c.code=l.equipment_code
   WHERE l.user_id=p_user AND l.tent_number=1 AND public.kq_is_shared_processing_equipment(l.equipment_code)
    AND c.is_active AND e.purchase_price_cents>0
 ) installed;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_processing_codes(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_warehouse_workshop_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('equippedCodes',public.kq_warehouse_processing_codes(p_user),
  'levels',COALESCE((SELECT jsonb_object_agg(code,CASE WHEN code='TENT-080-STARTER' THEN 1 ELSE COALESCE(e.level,1) END)
    FROM unnest(public.kq_warehouse_processing_codes(p_user)) code
    LEFT JOIN public.kq_player_equipment e ON e.user_id=p_user AND e.tent_number=1 AND e.equipment_code=code),'{}'::JSONB));
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_workshop_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.kq_commerce_batches ADD COLUMN processing_equipment_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE public.kq_commerce_batches b SET processing_equipment_codes=ARRAY(
 SELECT code FROM unnest(ARRAY['SIFT-TRAY','PRESS-0600','WASHER-25L','AUTO-SIEVE','FREEZE-DRYER','STATIC-PLASMA']) code
 WHERE public.kq_processing_route_uses_equipment(b.route,code) ORDER BY code)
 WHERE b.processing_ready_at IS NOT NULL;
CREATE OR REPLACE FUNCTION public.kq_warehouse_queue_processing() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lot public.kq_market_lots%ROWTYPE; layout public.kq_warehouse_layouts%ROWTYPE; quote JSONB; seconds INTEGER; required_codes TEXT[];
BEGIN
 IF NEW.route IN ('raw','biomass') OR NOT EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=NEW.user_id) THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||NEW.user_id::TEXT,0));
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
 SELECT * INTO layout FROM public.kq_warehouse_layouts WHERE user_id=NEW.user_id FOR UPDATE;
 PERFORM public.kq_assert_warehouse_processing_ready(NEW.user_id,NEW.flower_id,NEW.route);
 PERFORM public.kq_assert_processing_maintenance(NEW.user_id,NEW.route);
 SELECT * INTO lot FROM public.kq_market_lots WHERE flower_id=NEW.flower_id;
 SELECT q INTO quote FROM jsonb_array_elements(lot.options) q WHERE q->>'route'=NEW.route;
 required_codes:=ARRAY(SELECT code FROM unnest(ARRAY['SIFT-TRAY','PRESS-0600','WASHER-25L','AUTO-SIEVE','FREEZE-DRYER','STATIC-PLASMA']) code
  WHERE public.kq_processing_route_uses_equipment(NEW.route,code) ORDER BY code);
 IF quote->'workshopSnapshot' IS DISTINCT FROM public.kq_warehouse_workshop_snapshot(NEW.user_id)
  OR quote->'warehouseRevision' IS DISTINCT FROM to_jsonb(layout.revision)
  OR quote->'warehouseState' IS DISTINCT FROM layout.state
  OR lot.equipment_codes IS DISTINCT FROM public.kq_warehouse_processing_codes(NEW.user_id)
  OR quote->'processingEquipmentCodes' IS DISTINCT FROM to_jsonb(required_codes)
  OR cardinality(required_codes)=0 OR NOT required_codes<@lot.equipment_codes
 THEN RAISE EXCEPTION 'commerce_offer_changed'; END IF;
 seconds:=(quote->>'processingDurationSeconds')::INTEGER;
 IF seconds IS NULL OR seconds NOT BETWEEN 1 AND 45000000 THEN RAISE EXCEPTION 'commerce_route_unavailable'; END IF;
 NEW.processing_equipment_codes:=required_codes;
 -- A recipe reserves every required machine for its job. Independent machines
 -- can work simultaneously; recipes sharing any machine wait for each other.
 NEW.processing_started_at:=GREATEST(now(),COALESCE((SELECT max(processing_ready_at)
  FROM public.kq_commerce_batches WHERE user_id=NEW.user_id AND processing_equipment_codes&&required_codes),now()));
 NEW.processing_ready_at:=NEW.processing_started_at+seconds*interval '1 second';
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_queue_processing() FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
