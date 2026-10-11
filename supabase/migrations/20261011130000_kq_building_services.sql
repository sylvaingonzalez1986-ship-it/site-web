BEGIN;

-- Building services occupy one physical anchor (tent 1 or 5). Accounts with an
-- active old culture keep their old equipment until its frozen bills and wear
-- have been recorded. Processing machines remain shared by the whole workshop.
LOCK TABLE public.kq_runs,public.kq_equipment_wallets,public.kq_player_equipment,
  public.kq_equipment_loadouts,public.kq_treasury_assets IN SHARE ROW EXCLUSIVE MODE;

CREATE FUNCTION public.kq_is_building_equipment(p_code TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT COALESCE(p_code IN ('DRYING-ROOM','SOLAR-BACKUP','SECURITY-CAMERA','SECURITY-DOG'),false);
$$;
CREATE FUNCTION public.kq_building_anchor(p_tent INTEGER) RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT 1+4*((p_tent-1)/4); $$;
CREATE FUNCTION public.kq_equipment_storage_tent_for_user(p_user UUID,p_code TEXT,p_tent INTEGER) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN public.kq_is_shared_processing_equipment(p_code) THEN 1
  WHEN public.kq_is_building_equipment(p_code) AND EXISTS(SELECT 1 FROM public.kq_equipment_wallets
   WHERE user_id=p_user AND equipment_scope_version>=3) THEN public.kq_building_anchor(p_tent)
  ELSE p_tent END;
$$;

-- Exact acquisition and installation records survive consolidation. This is an
-- audit archive, never a second stock of usable or resellable equipment.
CREATE TABLE public.kq_building_service_archive (
 user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 equipment JSONB NOT NULL CHECK(jsonb_typeof(equipment)='array'),
 loadouts JSONB NOT NULL CHECK(jsonb_typeof(loadouts)='array'),
 assets JSONB NOT NULL CHECK(jsonb_typeof(assets)='array')
);
ALTER TABLE public.kq_building_service_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_building_service_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.kq_building_service_conversions (
 user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 transaction_id BIGINT NOT NULL,
 completed_at TIMESTAMPTZ
);
ALTER TABLE public.kq_building_service_conversions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_building_service_conversions FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_reject_building_archive_mutation() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 -- Account erasure retains its existing cascading semantics. Ordinary updates
 -- and direct archive deletion cannot pass while the account still exists.
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'building_service_archive_immutable';
END $$;
CREATE TRIGGER kq_building_archive_immutable BEFORE UPDATE OR DELETE ON public.kq_building_service_archive
FOR EACH ROW EXECUTE FUNCTION public.kq_reject_building_archive_mutation();
CREATE FUNCTION public.kq_building_conversion_in_progress(p_user UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.kq_building_service_conversions
  WHERE user_id=p_user AND transaction_id=txid_current() AND completed_at IS NULL);
$$;

-- A private, transaction-bound marker preserves grandfathered levels and even
-- already-broken installations. API roles cannot create or invoke this bypass.
DO $$ DECLARE body TEXT; BEGIN
 SELECT pg_get_functiondef('public.kq_guard_equipment_career()'::regprocedure) INTO body; body:=replace(body,chr(13),'');
 body:=replace(body,E'BEGIN\n',E'BEGIN\n  IF public.kq_is_building_equipment(NEW.equipment_code) AND public.kq_building_conversion_in_progress(NEW.user_id) THEN RETURN NEW; END IF;\n');
 EXECUTE body;
 SELECT pg_get_functiondef('public.kq_guard_culture_equipment_loadout()'::regprocedure) INTO body; body:=replace(body,chr(13),'');
 body:=replace(body,' IF EXISTS(SELECT 1 FROM public.kq_player_equipment',
  ' IF NOT public.kq_building_conversion_in_progress(NEW.user_id) AND EXISTS(SELECT 1 FROM public.kq_player_equipment');
 EXECUTE body;
END $$;

CREATE FUNCTION public.kq_migrate_building_services(p_user UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE scope_version INTEGER; archived public.kq_building_service_archive%ROWTYPE;
BEGIN
 -- Completion triggers must finish the old invoice and wear transaction first.
 IF pg_trigger_depth()>0 THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 SELECT equipment_scope_version INTO scope_version FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 IF scope_version IS NULL OR scope_version>=3 THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user AND status::TEXT='active') THEN RETURN; END IF;
 -- Initialize historical valuation before physical identifiers change.
 IF NOT EXISTS(SELECT 1 FROM public.kq_treasury_accounts WHERE user_id=p_user) THEN
  PERFORM public.kq_treasury_initialize(p_user);
 END IF;
 INSERT INTO public.kq_building_service_archive(user_id,equipment,loadouts,assets)
 VALUES(p_user,
  (SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY tent_number,equipment_code),'[]') FROM public.kq_player_equipment e
   WHERE user_id=p_user AND public.kq_is_building_equipment(equipment_code)),
  (SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY tent_number,slot),'[]') FROM public.kq_equipment_loadouts l
   WHERE user_id=p_user AND public.kq_is_building_equipment(equipment_code)),
  (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY id),'[]') FROM public.kq_treasury_assets a
   WHERE user_id=p_user AND public.kq_is_building_equipment(equipment_code)))
 RETURNING * INTO archived;
 INSERT INTO public.kq_building_service_conversions(user_id,transaction_id) VALUES(p_user,txid_current());
 DELETE FROM public.kq_equipment_loadouts WHERE user_id=p_user AND public.kq_is_building_equipment(equipment_code);
 DELETE FROM public.kq_player_equipment WHERE user_id=p_user AND public.kq_is_building_equipment(equipment_code);
 -- A free consolidation retains the highest upgrade and the best condition.
 -- The summed basis and all individual source records remain accounted for.
 INSERT INTO public.kq_player_equipment(user_id,tent_number,equipment_code,purchase_price_cents,acquired_at,
  level,wear_cycles,maintenance_version,culture_wear_percent,culture_wear_version)
 SELECT p_user,public.kq_building_anchor(e.tent_number),e.equipment_code,SUM(e.purchase_price_cents)::INTEGER,
  MIN(e.acquired_at),MAX(e.level),MIN(e.wear_cycles),MAX(e.maintenance_version)+1,
  MIN(e.culture_wear_percent),MAX(e.culture_wear_version)+1
 FROM jsonb_populate_recordset(NULL::public.kq_player_equipment,archived.equipment) e
 GROUP BY public.kq_building_anchor(e.tent_number),e.equipment_code;
 INSERT INTO public.kq_equipment_loadouts(user_id,tent_number,slot,equipment_code,equipped_at)
 SELECT DISTINCT ON (e.tent_number,l.slot) p_user,e.tent_number,l.slot,e.equipment_code,l.equipped_at
 FROM jsonb_populate_recordset(NULL::public.kq_equipment_loadouts,archived.loadouts) l
 JOIN public.kq_player_equipment e ON e.user_id=p_user AND e.equipment_code=l.equipment_code
  AND e.tent_number=public.kq_building_anchor(l.tent_number)
 ORDER BY e.tent_number,l.slot,(e.culture_wear_percent<100) DESC,e.level DESC,e.culture_wear_percent,
  e.purchase_price_cents DESC,e.equipment_code,l.equipped_at;
 -- Existing journal amounts, depreciation, receipt bodies and timestamps stay
 -- unchanged. Live assets follow the device so a later replacement retires them.
 UPDATE public.kq_treasury_assets SET tent_number=public.kq_building_anchor(COALESCE(tent_number,1))
 WHERE user_id=p_user AND retired_at IS NULL AND public.kq_is_building_equipment(equipment_code);
 UPDATE public.kq_equipment_wallets SET equipment_scope_version=3 WHERE user_id=p_user;
 UPDATE public.kq_building_service_conversions SET completed_at=now() WHERE user_id=p_user;
END $$;

ALTER TABLE public.kq_equipment_wallets ALTER COLUMN equipment_scope_version SET DEFAULT 3;
COMMENT ON COLUMN public.kq_equipment_wallets.equipment_scope_version IS
 '3: drying, solar and security shared by each four-tent building; processing global. Version 2 remains until its active culture closes.';

CREATE OR REPLACE FUNCTION public.kq_guard_shared_workshop_storage() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.tent_number IS DISTINCT FROM public.kq_equipment_storage_tent_for_user(NEW.user_id,NEW.equipment_code,NEW.tent_number) THEN
  RAISE EXCEPTION 'equipment_shared_storage_only';
 END IF;
 RETURN NEW;
END $$;

-- Reuse every existing price, receipt, ownership and career check. Resolve the
-- physical identifier AFTER ensure, because that call can convert an account.
DO $$ DECLARE body TEXT; signature TEXT; BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_ensure_equipment_profile(uuid)'::regprocedure) INTO body; body:=replace(body,chr(13),'');
 body:=replace(body,E'BEGIN\n',E'BEGIN\n IF pg_trigger_depth()=0 THEN PERFORM pg_advisory_xact_lock(hashtextextended(''kq-equipment:''||p_user_id::TEXT,0)); END IF;\n');
 body:=replace(body,' RETURN jsonb_build_object(''ready'',true);',
  ' PERFORM public.kq_migrate_building_services(p_user_id); RETURN jsonb_build_object(''ready'',true);');
 IF strpos(body,'PERFORM public.kq_migrate_building_services')=0 THEN RAISE EXCEPTION 'building_ensure_definition_changed'; END IF;
 EXECUTE body;
 FOREACH signature IN ARRAY ARRAY[
  'public.rpc_kq_purchase_tent_equipment(uuid,uuid,text[],integer)',
  'public.rpc_kq_upgrade_tent_equipment(uuid,uuid,text,integer,integer)',
  'public.rpc_kq_repair_tent_machine(uuid,text,integer,integer,uuid,integer)',
  'public.rpc_kq_equip_tent_equipment(uuid,text,integer)'] LOOP
  SELECT pg_get_functiondef(signature::regprocedure) INTO body; body:=replace(body,chr(13),'');
  IF strpos(body,'public.kq_equipment_storage_tent(')=0 THEN RAISE EXCEPTION 'building_rpc_definition_changed: %',signature; END IF;
  body:=replace(body,'public.kq_equipment_storage_tent(', 'public.kq_equipment_storage_tent_for_user(p_user_id,');
  IF strpos(body,'v_storage_tent INTEGER')>0 THEN
   IF strpos(signature,'equip_tent_equipment')>0 THEN
    body:=replace(body,'PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);',
     'PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id); v_storage_tent:=public.kq_equipment_storage_tent_for_user(p_user_id,p_equipment_code,p_tent_number);');
   ELSE
    body:=replace(body,'PERFORM public.kq_business_settle(p_user_id);',
     'PERFORM public.kq_business_settle(p_user_id); PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id); v_storage_tent:=public.kq_equipment_storage_tent_for_user(p_user_id,p_equipment_code,p_tent_number);');
   END IF;
  END IF;
  -- Historical replay returns its historical physical identifier verbatim.
  body:=replace(body,'''tentNumber'',v_storage_tent,''equipmentCode'',v_existing.equipment_code',
   '''tentNumber'',COALESCE(v_existing.tent_number,v_storage_tent),''equipmentCode'',v_existing.equipment_code');
  EXECUTE body;
 END LOOP;
 SELECT pg_get_functiondef('public.rpc_kq_replace_tent_culture_equipment(uuid,text,integer,integer,uuid,integer)'::regprocedure) INTO body; body:=replace(body,chr(13),'');
 body:=replace(body,'DECLARE gear ', 'DECLARE v_storage_tent INTEGER; gear ');
 body:=replace(body,'PERFORM public.kq_business_settle(p_user_id);',
  'PERFORM public.kq_business_settle(p_user_id); PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id); v_storage_tent:=public.kq_equipment_storage_tent_for_user(p_user_id,p_equipment_code,p_tent_number);');
 body:=replace(body,'old.tent_number IS DISTINCT FROM p_tent_number',
  'public.kq_equipment_storage_tent_for_user(p_user_id,old.equipment_code,old.tent_number) IS DISTINCT FROM v_storage_tent');
 body:=replace(body,'tent_number=p_tent_number AND equipment_code=p_equipment_code','tent_number=v_storage_tent AND equipment_code=p_equipment_code');
 body:=replace(body,'''tentNumber'',p_tent_number,','''tentNumber'',v_storage_tent,');
 body:=replace(body,'result,p_tent_number);','result,v_storage_tent);');
 EXECUTE body;
END $$;

-- Building snapshots contain each tent's effective service codes for gameplay.
-- Legacy deployment snapshots with scope=tent still validate physical profiles.
DO $$ DECLARE body TEXT; BEGIN
 SELECT pg_get_functiondef('public.kq_guard_culture_equipment_start()'::regprocedure) INTO body; body:=replace(body,chr(13),'');
 body:=replace(body,'DECLARE units INTEGER;', 'DECLARE units INTEGER; scope_version INTEGER; building BOOLEAN;');
 body:=replace(body,' IF NEW.state->''equipment''->>''scope'' IS DISTINCT FROM ''tent'' THEN RAISE EXCEPTION ''kq_culture_equipment_changed''; END IF;',
  ' IF COALESCE(NEW.state->''equipment''->>''scope'','''') NOT IN (''tent'',''building'') THEN RAISE EXCEPTION ''kq_culture_equipment_changed''; END IF; building:=NEW.state->''equipment''->>''scope''=''building'';');
 body:=replace(body,'SELECT production_units INTO units FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;',
  'SELECT production_units,equipment_scope_version INTO units,scope_version FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE; IF building AND scope_version<3 THEN RAISE EXCEPTION ''kq_culture_equipment_changed''; END IF;');
 body:=replace(body,'AND tent_number=tent.tent_number',
  'AND tent_number=CASE WHEN building THEN public.kq_equipment_storage_tent_for_user(NEW.user_id,equipment_code,tent.tent_number) ELSE tent.tent_number END');
 body:=replace(body,'AND l.tent_number=tent.tent_number',
  'AND l.tent_number=CASE WHEN building THEN public.kq_equipment_storage_tent_for_user(NEW.user_id,l.equipment_code,tent.tent_number) ELSE tent.tent_number END');
 body:=replace(body,'AND e.tent_number=tent.tent_number',
  'AND e.tent_number=CASE WHEN building THEN public.kq_equipment_storage_tent_for_user(NEW.user_id,e.equipment_code,tent.tent_number) ELSE tent.tent_number END');
 IF strpos(body,'IF building AND scope_version<3')=0 THEN RAISE EXCEPTION 'building_start_definition_changed'; END IF;
 EXECUTE body;
 SELECT pg_get_functiondef('public.kq_invoice_completed_cycle()'::regprocedure) INTO body; body:=replace(body,chr(13),'');
 body:=replace(body,'WHEN NEW.state->''equipment''->>''scope''=''tent'' THEN',
  'WHEN NEW.state->''equipment''->>''scope'' IN (''tent'',''building'') THEN');
 EXECUTE body;
END $$;

CREATE OR REPLACE FUNCTION public.kq_wear_culture_equipment_on_completion() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mode TEXT; gear RECORD; after_wear INTEGER; changes JSONB:='[]'::JSONB;
BEGIN
 IF NEW.status::TEXT<>'completed' OR OLD.status::TEXT='completed' THEN RETURN NEW; END IF;
 PERFORM public.rpc_kq_ensure_equipment_profile(NEW.user_id);
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
 mode:=CASE WHEN NEW.state->'energy'->>'mode' IN ('eco','intensive') THEN NEW.state->'energy'->>'mode' ELSE 'balanced' END;
 INSERT INTO public.kq_culture_equipment_wear_receipts(run_id,user_id,energy_mode) VALUES(NEW.id,NEW.user_id,mode) ON CONFLICT(run_id) DO NOTHING;
 IF NOT FOUND THEN RETURN NEW; END IF;
 FOR gear IN SELECT e.* FROM public.kq_player_equipment e
  WHERE e.user_id=NEW.user_id AND public.kq_culture_equipment_wear_delta(e.equipment_code,mode,e.culture_wear_percent)>0
   AND EXISTS(SELECT 1 FROM public.kq_run_tents(NEW.state) t WHERE t.codes ? e.equipment_code
    AND e.tent_number=CASE WHEN NEW.state->'equipment'->>'scope'='building'
     THEN public.kq_equipment_storage_tent_for_user(NEW.user_id,e.equipment_code,t.tent_number) ELSE t.tent_number END)
  ORDER BY e.tent_number,e.equipment_code FOR UPDATE OF e LOOP
  after_wear:=LEAST(100,gear.culture_wear_percent+public.kq_culture_equipment_wear_delta(gear.equipment_code,mode,gear.culture_wear_percent));
  UPDATE public.kq_player_equipment SET culture_wear_percent=after_wear,culture_wear_version=culture_wear_version+1
   WHERE user_id=NEW.user_id AND tent_number=gear.tent_number AND equipment_code=gear.equipment_code;
  changes:=changes||jsonb_build_array(jsonb_build_object('tentNumber',gear.tent_number,'equipmentCode',gear.equipment_code,'wearBefore',gear.culture_wear_percent,'wearAfter',after_wear,'version',gear.culture_wear_version+1));
 END LOOP;
 UPDATE public.kq_culture_equipment_wear_receipts SET equipment=changes WHERE run_id=NEW.id;
 RETURN NEW;
END $$;

-- No extra API surface: existing service-only RPCs perform the conversion.
REVOKE ALL ON FUNCTION public.kq_is_building_equipment(TEXT),public.kq_building_anchor(INTEGER),
 public.kq_equipment_storage_tent_for_user(UUID,TEXT,INTEGER),public.kq_reject_building_archive_mutation(),
 public.kq_building_conversion_in_progress(UUID),public.kq_migrate_building_services(UUID)
 FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE owner UUID; BEGIN
 FOR owner IN SELECT user_id FROM public.kq_equipment_wallets WHERE equipment_scope_version<3 ORDER BY user_id LOOP
  PERFORM public.kq_migrate_building_services(owner);
 END LOOP;
END $$;

COMMIT;
