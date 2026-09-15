BEGIN;
ALTER TABLE public.kq_player_equipment
 ADD COLUMN wear_cycles INTEGER NOT NULL DEFAULT 0 CHECK(wear_cycles>=0),
 ADD COLUMN maintenance_version INTEGER NOT NULL DEFAULT 0 CHECK(maintenance_version>=0);
CREATE TABLE public.kq_machine_repairs (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, request_key UUID NOT NULL,
 equipment_code TEXT NOT NULL, expected_version INTEGER NOT NULL, receipt JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,request_key)
);
ALTER TABLE public.kq_machine_repairs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_machine_repairs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.kq_machine_repairs TO service_role;

CREATE FUNCTION public.kq_machine_interval(p_code TEXT,p_level INTEGER) RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE WHEN p_level>=5 OR p_code='FREEZE-DRYER' THEN 20 ELSE 10 END $$;
CREATE FUNCTION public.kq_wear_machines_on_completion() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status::TEXT<>'completed' OR OLD.status::TEXT='completed' THEN RETURN NEW; END IF;
 PERFORM public.rpc_kq_ensure_equipment_profile(NEW.user_id);
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
 -- Count once per completed culture, against its snapshotted installation, not the current loadout.
 UPDATE public.kq_player_equipment e SET wear_cycles=LEAST(e.wear_cycles+1,public.kq_machine_interval(e.equipment_code,e.level)),maintenance_version=e.maintenance_version+1
 FROM public.kq_equipment_catalog c WHERE e.user_id=NEW.user_id AND c.code=e.equipment_code
 AND c.category='processing' AND c.code<>'SIFT-TRAY'
 AND COALESCE(NEW.state->'equipment'->'codes','[]'::JSONB) ? e.equipment_code;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_wear_machines_on_completion AFTER UPDATE OF status ON public.kq_runs
FOR EACH ROW EXECUTE FUNCTION public.kq_wear_machines_on_completion();

CREATE FUNCTION public.rpc_kq_repair_machine(p_user_id UUID,p_equipment_code TEXT,p_expected_version INTEGER,p_expected_cost_cents INTEGER,p_request_key UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE gear public.kq_player_equipment%ROWTYPE; catalog public.kq_equipment_catalog%ROWTYPE;
 old public.kq_machine_repairs%ROWTYPE; cash INTEGER; cost INTEGER; result JSONB;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR p_expected_version IS NULL OR p_expected_cost_cents IS NULL THEN RAISE EXCEPTION 'machine_invalid_request'; END IF;
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'machine_not_owned'; END IF;
 SELECT * INTO old FROM public.kq_machine_repairs WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF old.equipment_code<>p_equipment_code OR old.expected_version<>p_expected_version OR (old.receipt->>'paidCents')::INTEGER<>p_expected_cost_cents THEN RAISE EXCEPTION 'machine_request_mismatch'; END IF;
  RETURN old.receipt||'{"replayed":true}'::JSONB;
 END IF;
 SELECT * INTO gear FROM public.kq_player_equipment WHERE user_id=p_user_id AND equipment_code=p_equipment_code FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'machine_not_owned'; END IF;
 SELECT * INTO catalog FROM public.kq_equipment_catalog WHERE code=p_equipment_code AND category='processing' AND code<>'SIFT-TRAY' AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'machine_unavailable'; END IF;
 IF gear.maintenance_version<>p_expected_version THEN RAISE EXCEPTION 'machine_condition_changed'; END IF;
 IF gear.wear_cycles<public.kq_machine_interval(gear.equipment_code,gear.level) THEN RAISE EXCEPTION 'machine_not_due'; END IF;
 cost:=CASE WHEN EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength='handyperson') THEN 0
  ELSE LEAST(20000,GREATEST(1000,CEIL(catalog.price_cents*.06*(1+(gear.level-1)*.05)))) END;
 IF cost<>p_expected_cost_cents THEN RAISE EXCEPTION 'machine_condition_changed'; END IF;
 IF cash<cost THEN RAISE EXCEPTION 'machine_insufficient_cash'; END IF;
 UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-cost,updated_at=now() WHERE user_id=p_user_id;
 UPDATE public.kq_player_equipment SET wear_cycles=0,maintenance_version=maintenance_version+1 WHERE user_id=p_user_id AND equipment_code=p_equipment_code;
 UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 result:=jsonb_build_object('equipmentCode',p_equipment_code,'paidCents',cost,'cashAfterCents',cash-cost,'version',gear.maintenance_version+1,'replayed',false);
 INSERT INTO public.kq_machine_repairs(user_id,request_key,equipment_code,expected_version,receipt) VALUES(p_user_id,p_request_key,p_equipment_code,p_expected_version,result);
 RETURN result;
END $$;

-- The batch insert runs inside the existing wallet-locked prepare transaction.
-- Check wear again here, so a quote obtained just before a completion cannot bypass maintenance.
CREATE FUNCTION public.kq_assert_processing_maintenance(p_user_id UUID,p_route TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE broken TEXT;
BEGIN
 SELECT e.equipment_code INTO broken FROM public.kq_player_equipment e
 JOIN public.kq_equipment_loadouts l ON l.user_id=e.user_id AND l.equipment_code=e.equipment_code
 JOIN public.kq_equipment_catalog c ON c.code=e.equipment_code
 WHERE e.user_id=p_user_id AND e.wear_cycles>=public.kq_machine_interval(e.equipment_code,e.level)
 AND c.category='processing' AND c.code<>'SIFT-TRAY'
 AND ((p_route LIKE 'rosin-%' AND c.slot='press')
  OR (p_route IN ('ice-water-hash','hash-signature') AND c.slot='washing')
  OR (p_route='hash-signature' AND c.slot IN ('filtration','drying'))
  OR (p_route='static-sift' AND c.slot='static-separation')) LIMIT 1;
 IF broken IS NOT NULL THEN RAISE EXCEPTION 'commerce_machine_maintenance'; END IF;
END $$;
CREATE FUNCTION public.kq_guard_processing_maintenance() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public.kq_assert_processing_maintenance(NEW.user_id,NEW.route); RETURN NEW; END $$;
CREATE FUNCTION public.kq_guard_legacy_processing_maintenance() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 -- Old whole-lot sales transform immediately; modern channel sales use already prepared stock.
 IF NEW.sales_channel IS NULL THEN PERFORM public.kq_assert_processing_maintenance(NEW.owner_id,NEW.route); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_guard_processing_maintenance BEFORE INSERT ON public.kq_commerce_batches
FOR EACH ROW EXECUTE FUNCTION public.kq_guard_processing_maintenance();
CREATE TRIGGER kq_guard_legacy_processing_maintenance BEFORE INSERT ON public.kq_market_sale_receipts
FOR EACH ROW EXECUTE FUNCTION public.kq_guard_legacy_processing_maintenance();
REVOKE ALL ON FUNCTION public.kq_assert_processing_maintenance(UUID,TEXT),public.kq_wear_machines_on_completion(),public.kq_guard_processing_maintenance(),public.kq_guard_legacy_processing_maintenance(),public.rpc_kq_repair_machine(UUID,TEXT,INTEGER,INTEGER,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_repair_machine(UUID,TEXT,INTEGER,INTEGER,UUID) TO service_role;
COMMIT;
