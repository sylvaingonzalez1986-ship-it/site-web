BEGIN;

-- Existing global runs retain their exact snapshot and finish normally. New
-- zone runs share account locks, services and inventory, never an active slot.
ALTER TABLE public.kq_runs ADD COLUMN warehouse_zone_id TEXT
 CHECK(warehouse_zone_id IS NULL OR length(btrim(warehouse_zone_id)) BETWEEN 1 AND 80);
DROP INDEX public.uq_kq_one_active_run_per_user;
CREATE UNIQUE INDEX uq_kq_active_legacy_run ON public.kq_runs(user_id)
 WHERE status='active' AND warehouse_zone_id IS NULL;
CREATE UNIQUE INDEX uq_kq_active_zone_run ON public.kq_runs(user_id,warehouse_zone_id)
 WHERE status='active' AND warehouse_zone_id IS NOT NULL;
CREATE UNIQUE INDEX uq_kq_active_buddie ON public.kq_runs(user_id,buddie_card_definition_id)
 WHERE status='active';
CREATE INDEX kq_zone_run_history ON public.kq_runs(user_id,warehouse_zone_id,started_at DESC)
 WHERE warehouse_zone_id IS NOT NULL;

CREATE TABLE public.kq_zone_run_receipts (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_key UUID NOT NULL,
 request JSONB NOT NULL,
 run_id UUID NOT NULL REFERENCES public.kq_runs(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_key), UNIQUE(run_id)
);
ALTER TABLE public.kq_zone_run_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_zone_run_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.kq_zone_card_reservations (
 card_instance_id UUID PRIMARY KEY REFERENCES public.lottery_card_instances(id),
 run_id UUID NOT NULL REFERENCES public.kq_runs(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 card_code TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kq_zone_reserved_deck ON public.kq_zone_card_reservations(run_id,card_code);
CREATE INDEX kq_zone_reserved_owner ON public.kq_zone_card_reservations(user_id);
ALTER TABLE public.kq_zone_card_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_zone_card_reservations FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_zone_run_identity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE selected JSONB; code TEXT;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.warehouse_zone_id IS DISTINCT FROM OLD.warehouse_zone_id
   OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.buddie_card_definition_id IS DISTINCT FROM OLD.buddie_card_definition_id
   OR NEW.deck_codes IS DISTINCT FROM OLD.deck_codes
  THEN RAISE EXCEPTION 'kq_zone_identity_immutable'; END IF;
  RETURN NEW;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||NEW.user_id::TEXT,0));
 IF NEW.state->'warehouse'->>'version'='2' THEN
  code:=NEW.state->'warehouse'->>'zoneId';
  IF code IS NULL OR length(btrim(code)) NOT BETWEEN 1 AND 80
   OR NEW.warehouse_zone_id IS NOT NULL AND NEW.warehouse_zone_id<>code
  THEN RAISE EXCEPTION 'warehouse_zone_invalid'; END IF;
  NEW.warehouse_zone_id:=code;
  IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=NEW.user_id AND status='active' AND warehouse_zone_id IS NULL)
   THEN RAISE EXCEPTION 'warehouse_legacy_run_active'; END IF;
  IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=NEW.user_id AND status='active' AND warehouse_zone_id=code)
   THEN RAISE EXCEPTION 'warehouse_zone_busy'; END IF;
  IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=NEW.user_id AND status='active' AND buddie_card_definition_id=NEW.buddie_card_definition_id)
   THEN RAISE EXCEPTION 'kq_buddie_busy'; END IF;
  SELECT z INTO selected FROM public.kq_warehouse_layouts l,LATERAL jsonb_array_elements(l.state->'zones') z
   WHERE l.user_id=NEW.user_id AND z->>'id'=code;
  SELECT d.code INTO code FROM public.lottery_card_definitions d WHERE d.id=NEW.buddie_card_definition_id;
  IF code IS DISTINCT FROM NEW.state->>'varietyCode'
   OR selected->>'buddieCode' IS DISTINCT FROM code
  THEN RAISE EXCEPTION 'warehouse_buddie_mismatch'; END IF;
 ELSE
  IF NEW.warehouse_zone_id IS NOT NULL THEN RAISE EXCEPTION 'warehouse_zone_invalid'; END IF;
  IF NEW.status='active' AND EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=NEW.user_id AND status='active')
   THEN RAISE EXCEPTION 'kq_active_run_exists'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_zone_run_identity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER aaa_kq_zone_run_identity BEFORE INSERT OR UPDATE ON public.kq_runs
 FOR EACH ROW EXECUTE FUNCTION public.kq_zone_run_identity();

CREATE FUNCTION public.kq_zone_reserve_deck() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE requested RECORD; instance UUID; count_reserved INTEGER;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.status='active' AND NEW.status<>'active' THEN DELETE FROM public.kq_zone_card_reservations WHERE run_id=NEW.id; END IF;
  RETURN NEW;
 END IF;
 IF NEW.warehouse_zone_id IS NULL OR NEW.status<>'active' THEN RETURN NEW; END IF;
 FOR requested IN SELECT code,count(*)::INTEGER quantity FROM unnest(NEW.deck_codes) code GROUP BY code ORDER BY code LOOP
  count_reserved:=0;
  FOR instance IN SELECT i.id FROM public.lottery_card_instances i JOIN public.lottery_card_definitions d ON d.id=i.card_definition_id
   WHERE i.user_id=NEW.user_id AND d.code=requested.code
    AND NOT EXISTS(SELECT 1 FROM public.kq_zone_card_reservations r WHERE r.card_instance_id=i.id)
   ORDER BY i.created_at,i.id LIMIT requested.quantity FOR UPDATE OF i LOOP
   INSERT INTO public.kq_zone_card_reservations(card_instance_id,run_id,user_id,card_code) VALUES(instance,NEW.id,NEW.user_id,requested.code);
   count_reserved:=count_reserved+1;
  END LOOP;
  IF count_reserved<>requested.quantity THEN RAISE EXCEPTION 'kq_deck_copy_reserved'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_zone_reserve_deck() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_zone_reserve_deck AFTER INSERT OR UPDATE OF status ON public.kq_runs
 FOR EACH ROW EXECUTE FUNCTION public.kq_zone_reserve_deck();

CREATE FUNCTION public.kq_zone_protect_reserved_card() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.card_definition_id IS DISTINCT FROM OLD.card_definition_id THEN
  -- UPDATE already owns this physical row lock. Start reserves under FOR
  -- UPDATE too; no reverse card-row -> account lock ordering is introduced.
  IF EXISTS(SELECT 1 FROM public.kq_zone_card_reservations WHERE card_instance_id=OLD.id)
   THEN RAISE EXCEPTION 'kq_card_reserved'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_zone_protect_reserved_card() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_zone_protect_reserved_card BEFORE UPDATE ON public.lottery_card_instances
 FOR EACH ROW EXECUTE FUNCTION public.kq_zone_protect_reserved_card();

CREATE FUNCTION public.rpc_kq_reserved_cards(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('cardInstanceId',card_instance_id,'runId',run_id,'cardCode',card_code)
  ORDER BY created_at,card_instance_id),'[]'::JSONB) FROM public.kq_zone_card_reservations WHERE user_id=p_user_id;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_reserved_cards(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_reserved_cards(UUID) TO service_role;

-- Potential harvests are reserved separately, including whole-container fit.
CREATE FUNCTION public.kq_zone_reserved_harvest(p_user UUID) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(sum((state->'warehouse'->>'estimatedHarvestGrams')::NUMERIC),0)
 FROM public.kq_runs WHERE user_id=p_user AND status='active' AND state ? 'warehouse';
$$;
REVOKE ALL ON FUNCTION public.kq_zone_reserved_harvest(UUID) FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.kq_warehouse_pending_shortage_units(uuid,jsonb,numeric)'::regprocedure) INTO body;
 fragment:='UNION ALL SELECT p_new_units,now(),NULL::UUID';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'zone_pending_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,E'UNION ALL SELECT round((r.state->''warehouse''->>''estimatedHarvestGrams'')::NUMERIC*10),r.started_at,r.id\n FROM public.kq_runs r WHERE r.user_id=p_user AND r.status=''active'' AND r.state ? ''warehouse''\n '||fragment);
 SELECT pg_get_functiondef('public.kq_warehouse_validate_service_change(uuid,jsonb,jsonb)'::regprocedure) INTO body;
 fragment:='reserved:=public.kq_warehouse_reserved_storage_units(p_user)';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'zone_service_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'pending:=pending+public.kq_zone_reserved_harvest(p_user);'||chr(10)||fragment);
 SELECT pg_get_functiondef('public.kq_warehouse_sync_containers()'::regprocedure) INTO body;
 fragment:='old_deficit:=GREATEST';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'zone_repack_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'pending_units:=pending_units+public.kq_zone_reserved_harvest(NEW.user_id)*10;'||chr(10)||fragment);
END $$;

-- Reassigning an already stored harvest or changing the default container
-- cannot consume the whole-container room promised to active cultures.
ALTER FUNCTION public.rpc_kq_storage_capacity_command(UUID,TEXT,TEXT,TEXT,INTEGER,UUID,UUID) RENAME TO kq_storage_capacity_before_zone_runs;
REVOKE ALL ON FUNCTION public.kq_storage_capacity_before_zone_runs(UUID,TEXT,TEXT,TEXT,INTEGER,UUID,UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.rpc_kq_storage_capacity_command(p_user_id UUID,p_action TEXT,p_method_code TEXT,p_container_code TEXT,p_quantity INTEGER,p_flower_id UUID,p_request_key UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous_shortage NUMERIC; result JSONB;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status='active' AND warehouse_zone_id IS NOT NULL) THEN
  previous_shortage:=public.kq_warehouse_pending_shortage_units(p_user_id);
 END IF;
 result:=public.kq_storage_capacity_before_zone_runs(p_user_id,p_action,p_method_code,p_container_code,p_quantity,p_flower_id,p_request_key);
 IF previous_shortage IS NOT NULL AND public.kq_warehouse_pending_shortage_units(p_user_id)>previous_shortage
  THEN RAISE EXCEPTION 'warehouse_service_capacity_in_use'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_storage_capacity_command(UUID,TEXT,TEXT,TEXT,INTEGER,UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_storage_capacity_command(UUID,TEXT,TEXT,TEXT,INTEGER,UUID,UUID) TO service_role;

ALTER FUNCTION public.kq_validate_warehouse_run_start(UUID,UUID,JSONB) RENAME TO kq_validate_warehouse_run_start_v1;
REVOKE ALL ON FUNCTION public.kq_validate_warehouse_run_start_v1(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_validate_warehouse_run_start(p_user UUID,p_run UUID,p_state JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE layout public.kq_warehouse_layouts%ROWTYPE; w JSONB:=p_state->'warehouse'; zone JSONB; selected_state JSONB;
 validation JSONB; potential NUMERIC; pending NUMERIC; drying NUMERIC; available NUMERIC;
BEGIN
 IF w->>'version' IS DISTINCT FROM '2' THEN
  PERFORM public.kq_validate_warehouse_run_start_v1(p_user,p_run,p_state); RETURN;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO layout FROM public.kq_warehouse_layouts WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND OR w->'sourceState' IS DISTINCT FROM layout.state OR w->'revision' IS DISTINCT FROM to_jsonb(layout.revision)
  OR p_state->'equipment' IS DISTINCT FROM '{"codes":[],"levels":{},"quantityPercent":0,"qualityMaxBonus":0,"regularityPercent":0,"pressureDelta":0,"powerWatts":0,"energyDiscountPercent":0,"processingPrecision":0,"processingCapacityPercent":0,"unlocks":[]}'::JSONB
  OR p_state->'energy'->>'version' IS DISTINCT FROM '1' OR p_state->'energy'->>'mode' IS DISTINCT FROM 'balanced'
  OR p_state->'energy'->'totalCents' IS DISTINCT FROM w->'energyCostCents'
 THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 SELECT z INTO zone FROM jsonb_array_elements(layout.state->'zones') z WHERE z->>'id'=w->>'zoneId';
 IF zone IS NULL OR zone->'active' IS DISTINCT FROM 'true'::JSONB OR w->'zones' IS DISTINCT FROM jsonb_build_array(zone)
  THEN RAISE EXCEPTION 'warehouse_zone_invalid'; END IF;
 -- Validate full funded ownership first; price and energy projection then use
 -- only the selected culture, while service capacities remain account-wide.
 PERFORM public.kq_warehouse_catalog_projection(layout.state);
 PERFORM public.kq_warehouse_options_projection(layout.state);
 IF (layout.state->>'preparedAreaM2')::INTEGER<(public.kq_warehouse_catalog_projection(layout.state)->>'allocatedAreaM2')::INTEGER
  THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 selected_state:=jsonb_set(layout.state,'{zones}',jsonb_build_array(zone))||'{"serviceZones":[]}'::JSONB;
 validation:=w||jsonb_build_object('sourceState',selected_state);
 PERFORM public.kq_warehouse_validate_catalog_run(validation);
 PERFORM public.kq_warehouse_validate_options_run(validation);
 IF EXISTS(SELECT 1 FROM (VALUES('operatingCostCents'),('dryingCapacityGrams'),('storageCapacityGrams')) f(code)
   WHERE jsonb_typeof(w->code) IS DISTINCT FROM 'number' OR (w->>code)::NUMERIC<0)
  OR w->'operatingCostCents' IS DISTINCT FROM to_jsonb((w->>'energyCostCents')::INTEGER+(w->>'consumablesCostCents')::INTEGER)
  OR (w->>'dryingCapacityGrams')::NUMERIC<>public.kq_warehouse_drying_capacity_grams(layout.state)
  OR layout.state ? 'serviceZones' AND (w->>'storageCapacityGrams')::NUMERIC<>public.kq_warehouse_storage_capacity_units(p_user,layout.state)/10
  OR (w->>'activeAreaM2')::NUMERIC NOT BETWEEN 1 AND 1000
 THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 potential:=(w->>'estimatedHarvestGrams')::NUMERIC;
 SELECT COALESCE(sum((r.state->>'harvestGrams')::NUMERIC),0)+public.kq_zone_reserved_harvest(p_user) INTO pending
  FROM public.kq_flowers f JOIN public.kq_runs r ON r.id=f.run_id WHERE f.owner_id=p_user AND f.status::TEXT<>'burned';
 SELECT COALESCE(sum(public.kq_storage_remaining(s.flower_id)::NUMERIC/10),0) INTO drying
  FROM public.kq_storage_lots s WHERE s.user_id=p_user AND (s.state->>'readyAt')::TIMESTAMPTZ>now();
 available:=public.kq_warehouse_storage_capacity_units(p_user)/10-GREATEST(public.kq_warehouse_stock_units(p_user),
  public.kq_warehouse_reserved_storage_units(p_user)+public.kq_warehouse_packed_stock_units(p_user))/10;
 IF potential+pending>available OR potential+pending+drying>(w->>'dryingCapacityGrams')::NUMERIC
  OR public.kq_warehouse_pending_shortage_units(p_user,NULL,round(potential*10))>0
 THEN RAISE EXCEPTION 'warehouse_capacity'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.kq_validate_warehouse_run_start(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_warehouse_validate_busy_zones(p_user UUID,p_previous JSONB,p_next JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run RECORD; zone JSONB;
BEGIN
 IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user AND status='active' AND warehouse_zone_id IS NULL)
  THEN RAISE EXCEPTION 'warehouse_active_run'; END IF;
 FOR run IN SELECT warehouse_zone_id FROM public.kq_runs WHERE user_id=p_user AND status='active' LOOP
  IF (SELECT z FROM jsonb_array_elements(p_previous->'zones') z WHERE z->>'id'=run.warehouse_zone_id)
   IS DISTINCT FROM (SELECT z FROM jsonb_array_elements(p_next->'zones') z WHERE z->>'id'=run.warehouse_zone_id)
  THEN RAISE EXCEPTION 'warehouse_zone_busy'; END IF;
 END LOOP;
 FOR zone IN SELECT z FROM jsonb_array_elements(p_next->'zones') z WHERE z ? 'buddieCode' LOOP
  IF jsonb_typeof(zone->'buddieCode') IS DISTINCT FROM 'string' OR NOT EXISTS(
   SELECT 1 FROM public.lottery_card_instances i JOIN public.lottery_card_definitions d ON d.id=i.card_definition_id
   WHERE i.user_id=p_user AND d.code=zone->>'buddieCode' AND d.code ~ '^HH2026-[0-9]{3}$')
  THEN RAISE EXCEPTION 'kq_buddie_not_owned'; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_validate_busy_zones(UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_warehouse_save(uuid,uuid,jsonb,integer,jsonb,jsonb,integer)'::regprocedure) INTO body;
 fragment:='IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT=''active'') THEN RAISE EXCEPTION ''warehouse_active_run''; END IF;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'zone_layout_guard_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'PERFORM public.kq_warehouse_validate_busy_zones(p_user_id,layout.state,p_next_state);');
END $$;

-- Copy the currently installed start bodies, including career, Heritage and
-- calendar patches. Public legacy entry points cannot accept a v2 snapshot.
DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_start_run(uuid,text,integer,text[],text[],jsonb,integer)'::regprocedure) INTO body;
 body:=replace(body,'public.rpc_kq_start_run(','public.kq_start_run_internal(');
 fragment:='IF EXISTS (SELECT 1 FROM public.kq_runs WHERE user_id = p_user_id AND status = ''active'') THEN';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'zone_start_anchor_changed'; END IF;
 body:=replace(body,fragment,'IF p_initial_state->''warehouse''->>''version'' IS DISTINCT FROM ''2'' AND EXISTS (SELECT 1 FROM public.kq_runs WHERE user_id = p_user_id AND status = ''active'') THEN');
 EXECUTE body;
 SELECT pg_get_functiondef('public.rpc_kq_start_run_with_heritage(uuid,text,integer,text[],text[],jsonb,integer,text)'::regprocedure) INTO body;
 body:=replace(body,'public.rpc_kq_start_run_with_heritage(','public.kq_start_run_with_heritage_internal(');
 IF strpos(body,'public.rpc_kq_start_run(')=0 THEN RAISE EXCEPTION 'zone_heritage_anchor_changed'; END IF;
 EXECUTE replace(body,'public.rpc_kq_start_run(','public.kq_start_run_internal(');
END $$;
REVOKE ALL ON FUNCTION public.kq_start_run_internal(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_start_run_with_heritage_internal(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER,TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_start_run(p_user_id UUID,p_buddie_code TEXT,p_seed INTEGER,p_deck_codes TEXT[],p_scenario_codes TEXT[],p_initial_state JSONB,p_culture_tokens INTEGER DEFAULT 0) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_initial_state->'warehouse'->>'version'='2' THEN RAISE EXCEPTION 'warehouse_zone_request_required'; END IF;
 RETURN public.kq_start_run_internal(p_user_id,p_buddie_code,p_seed,p_deck_codes,p_scenario_codes,p_initial_state,p_culture_tokens);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_start_run(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_start_run(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER) TO service_role;
CREATE OR REPLACE FUNCTION public.rpc_kq_start_run_with_heritage(p_user_id UUID,p_buddie_code TEXT,p_seed INTEGER,p_deck_codes TEXT[],p_scenario_codes TEXT[],p_initial_state JSONB,p_culture_tokens INTEGER DEFAULT 0,p_heritage_code TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_initial_state->'warehouse'->>'version'='2' THEN RAISE EXCEPTION 'warehouse_zone_request_required'; END IF;
 RETURN public.kq_start_run_with_heritage_internal(p_user_id,p_buddie_code,p_seed,p_deck_codes,p_scenario_codes,p_initial_state,p_culture_tokens,p_heritage_code);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_start_run_with_heritage(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_start_run_with_heritage(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER,TEXT) TO service_role;

CREATE FUNCTION public.rpc_kq_zone_run_receipt(p_user_id UUID,p_request_key UUID,p_request JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE receipt public.kq_zone_run_receipts%ROWTYPE; run public.kq_runs%ROWTYPE;
BEGIN
 SELECT * INTO receipt FROM public.kq_zone_run_receipts WHERE user_id=p_user_id AND request_key=p_request_key;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF receipt.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'kq_zone_request_mismatch'; END IF;
 SELECT * INTO run FROM public.kq_runs WHERE id=receipt.run_id AND user_id=p_user_id;
 RETURN jsonb_build_object('run',to_jsonb(run),'burnReceipt',NULL,'freeSubstrate',true,'replayed',true,
  'cultureTokenBalance',COALESCE((SELECT balance FROM public.kq_culture_token_wallets WHERE user_id=p_user_id),0));
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_zone_run_receipt(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_zone_run_receipt(UUID,UUID,JSONB) TO service_role;

CREATE FUNCTION public.rpc_kq_start_zone_run(p_user_id UUID,p_zone_id TEXT,p_request_key UUID,p_request JSONB,p_buddie_code TEXT,p_seed INTEGER,
 p_deck_codes TEXT[],p_scenario_codes TEXT[],p_initial_state JSONB,p_culture_tokens INTEGER DEFAULT 0,p_heritage_code TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE replay JSONB; result JSONB;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR p_zone_id IS NULL OR length(btrim(p_zone_id)) NOT BETWEEN 1 AND 80
  OR p_request IS NULL OR p_request IS DISTINCT FROM jsonb_build_object('zoneId',p_zone_id,'buddieCode',p_buddie_code,
   'deckCodes',p_deck_codes,'cultureTokens',p_culture_tokens,'heritageCode',p_heritage_code,'energyMode','balanced',
   'expectedEnergyCents',p_request->'expectedEnergyCents')
 THEN RAISE EXCEPTION 'kq_zone_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 replay:=public.rpc_kq_zone_run_receipt(p_user_id,p_request_key,p_request);
 IF replay IS NOT NULL THEN RETURN replay; END IF;
 IF p_initial_state->'warehouse'->>'version' IS DISTINCT FROM '2' OR p_initial_state->'warehouse'->>'zoneId' IS DISTINCT FROM p_zone_id
  OR p_initial_state->>'varietyCode' IS DISTINCT FROM p_buddie_code
 THEN RAISE EXCEPTION 'warehouse_zone_invalid'; END IF;
 IF p_request->'expectedEnergyCents' IS DISTINCT FROM 'null'::JSONB AND
  p_request->'expectedEnergyCents' IS DISTINCT FROM p_initial_state->'warehouse'->'energyCostCents'
 THEN RAISE EXCEPTION 'kq_energy_quote_changed'; END IF;
 result:=public.kq_start_run_with_heritage_internal(p_user_id,p_buddie_code,p_seed,p_deck_codes,p_scenario_codes,p_initial_state,p_culture_tokens,p_heritage_code);
 INSERT INTO public.kq_zone_run_receipts(user_id,request_key,request,run_id) VALUES(p_user_id,p_request_key,p_request,(result->'run'->>'id')::UUID);
 RETURN result||jsonb_build_object('replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_start_zone_run(UUID,TEXT,UUID,JSONB,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_start_zone_run(UUID,TEXT,UUID,JSONB,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER,TEXT) TO service_role;

DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_play_support_card(uuid,uuid,text,smallint,text,timestamptz,jsonb)'::regprocedure) INTO body;
 fragment:='WHERE instance.user_id = p_user_id AND instance.card_definition_id = v_definition.id';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'zone_card_selection_anchor_changed'; END IF;
 body:=replace(body,fragment,fragment||E'\n AND CASE WHEN v_run.warehouse_zone_id IS NOT NULL AND p_use_kind=''support'' THEN\n EXISTS(SELECT 1 FROM public.kq_zone_card_reservations r WHERE r.card_instance_id=instance.id AND r.run_id=p_run_id)\n ELSE NOT EXISTS(SELECT 1 FROM public.kq_zone_card_reservations r WHERE r.card_instance_id=instance.id) END');
 fragment:='DELETE FROM public.lottery_card_instances WHERE id = v_instance.id;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'zone_card_burn_anchor_changed'; END IF;
 body:=replace(body,fragment,'DELETE FROM public.kq_zone_card_reservations WHERE card_instance_id=v_instance.id AND run_id=p_run_id;'||chr(10)||fragment);
 EXECUTE body;
END $$;

ALTER FUNCTION public.kq_warehouse_snapshot(UUID) RENAME TO kq_warehouse_snapshot_before_zone_runs;
REVOKE ALL ON FUNCTION public.kq_warehouse_snapshot_before_zone_runs(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_warehouse_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.kq_warehouse_snapshot_before_zone_runs(p_user_id)||jsonb_build_object(
  'legacyActiveRun',EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status='active' AND warehouse_zone_id IS NULL),
  'reservedHarvestGrams',public.kq_zone_reserved_harvest(p_user_id),
  'activeRuns',(SELECT COALESCE(jsonb_agg(jsonb_build_object('runId',r.id,'zoneId',r.warehouse_zone_id,'buddieCode',d.code,
   'stageIndex',r.state->'stageIndex','phase',r.state->'phase','startedAt',r.started_at) ORDER BY r.started_at,r.id),'[]'::JSONB)
   FROM public.kq_runs r LEFT JOIN public.lottery_card_definitions d ON d.id=r.buddie_card_definition_id WHERE r.user_id=p_user_id AND r.status='active'),
  'completedRuns',(SELECT COALESCE(jsonb_agg(jsonb_build_object('runId',r.id,'zoneId',r.warehouse_zone_id,'buddieCode',d.code,
   'stageIndex',r.state->'stageIndex','phase',r.state->'phase','startedAt',r.started_at,'completedAt',r.completed_at,'flowerId',f.id)
   ORDER BY r.warehouse_zone_id),'[]'::JSONB) FROM (
    SELECT DISTINCT ON(warehouse_zone_id) * FROM public.kq_runs WHERE user_id=p_user_id AND status<>'active' AND warehouse_zone_id IS NOT NULL
    ORDER BY warehouse_zone_id,started_at DESC,id DESC) r
   LEFT JOIN public.lottery_card_definitions d ON d.id=r.buddie_card_definition_id LEFT JOIN public.kq_flowers f ON f.run_id=r.id)
 );
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_energy_snapshot(uuid)'::regprocedure) INTO body;
 fragment:='''supplierInvoice'',';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'zone_supplier_snapshot_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,$new$'supplierInvoices',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'runId',s.run_id,
  'zoneId',r.warehouse_zone_id,'issuedAt',s.issued_at,'dueAt',s.due_at,'amountCents',s.amount_cents,'remainingCents',s.remaining_cents)
  ORDER BY s.issued_at,s.id),'[]'::JSONB) FROM public.kq_supplier_invoices s JOIN public.kq_runs r ON r.id=s.run_id
  WHERE s.user_id=p_user_id AND (s.remaining_cents>0 OR r.status='active')),'supplierInvoice',$new$);
END $$;

COMMIT;
