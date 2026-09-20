BEGIN;

ALTER TABLE public.kq_player_equipment
  ADD COLUMN culture_wear_percent INTEGER NOT NULL DEFAULT 0 CHECK (culture_wear_percent BETWEEN 0 AND 100),
  ADD COLUMN culture_wear_version INTEGER NOT NULL DEFAULT 0 CHECK (culture_wear_version >= 0);

-- Separate from processing-machine maintenance: culture wear requires replacement.
CREATE TABLE public.kq_culture_equipment_wear_receipts (
  run_id UUID PRIMARY KEY REFERENCES public.kq_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  energy_mode TEXT NOT NULL CHECK (energy_mode IN ('eco','balanced','intensive')),
  equipment JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.kq_culture_equipment_replacements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_key UUID NOT NULL,
  equipment_code TEXT NOT NULL REFERENCES public.kq_equipment_catalog(code),
  expected_version INTEGER NOT NULL CHECK (expected_version >= 0),
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,request_key)
);
ALTER TABLE public.kq_culture_equipment_wear_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_culture_equipment_replacements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_culture_equipment_wear_receipts, public.kq_culture_equipment_replacements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.kq_culture_equipment_wear_receipts, public.kq_culture_equipment_replacements TO service_role;

-- Existing completed cultures never incur retrospective wear, including on replay.
INSERT INTO public.kq_culture_equipment_wear_receipts(run_id,user_id,energy_mode)
SELECT id,user_id,CASE WHEN state->'energy'->>'mode' IN ('eco','intensive')
  THEN state->'energy'->>'mode' ELSE 'balanced' END
FROM public.kq_runs WHERE status::TEXT='completed';

CREATE FUNCTION public.kq_culture_equipment_wear_delta(p_code TEXT,p_mode TEXT,p_wear INTEGER)
RETURNS INTEGER LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE WHEN p_mode='intensive' AND p_wear>70 THEN CEIL(base*1.5)::INTEGER ELSE base END
  FROM (SELECT CASE p_code
    WHEN 'LED-300' THEN CASE p_mode WHEN 'eco' THEN 2 WHEN 'intensive' THEN 10 ELSE 5 END
    WHEN 'AIR-EC6' THEN CASE p_mode WHEN 'eco' THEN 1 WHEN 'intensive' THEN 6 ELSE 3 END
    WHEN 'CLIMATE-SMART' THEN CASE p_mode WHEN 'eco' THEN 1 WHEN 'intensive' THEN 4 ELSE 2 END
    WHEN 'TENT-120' THEN CASE p_mode WHEN 'eco' THEN 1 WHEN 'intensive' THEN 3 ELSE 2 END
    WHEN 'DRYING-ROOM' THEN CASE p_mode WHEN 'eco' THEN 1 WHEN 'intensive' THEN 4 ELSE 2 END
    WHEN 'SOLAR-BACKUP' THEN CASE p_mode WHEN 'eco' THEN 1 WHEN 'intensive' THEN 4 ELSE 2 END
    WHEN 'SECURITY-CAMERA' THEN 1
    ELSE 0 END AS base) rates;
$$;

CREATE FUNCTION public.kq_wear_culture_equipment_on_completion() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mode TEXT; gear RECORD; loss INTEGER; after_wear INTEGER; changes JSONB := '[]'::JSONB;
BEGIN
  IF NEW.status::TEXT<>'completed' OR OLD.status::TEXT='completed' THEN RETURN NEW; END IF;
  PERFORM public.rpc_kq_ensure_equipment_profile(NEW.user_id);
  -- Existing invoice, commerce and processing triggers use this same wallet lock.
  PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
  mode := CASE WHEN NEW.state->'energy'->>'mode' IN ('eco','intensive')
    THEN NEW.state->'energy'->>'mode' ELSE 'balanced' END;
  INSERT INTO public.kq_culture_equipment_wear_receipts(run_id,user_id,energy_mode)
    VALUES(NEW.id,NEW.user_id,mode) ON CONFLICT(run_id) DO NOTHING;
  IF NOT FOUND THEN RETURN NEW; END IF;
  FOR gear IN SELECT e.* FROM public.kq_player_equipment e
    WHERE e.user_id=NEW.user_id
      AND public.kq_culture_equipment_wear_delta(e.equipment_code,mode,e.culture_wear_percent)>0
      AND COALESCE(NEW.state->'equipment'->'codes','[]'::JSONB) ? e.equipment_code
    ORDER BY e.equipment_code FOR UPDATE
  LOOP
    loss := public.kq_culture_equipment_wear_delta(gear.equipment_code,mode,gear.culture_wear_percent);
    after_wear := LEAST(100,gear.culture_wear_percent+loss);
    UPDATE public.kq_player_equipment SET culture_wear_percent=after_wear,
      culture_wear_version=culture_wear_version+1
      WHERE user_id=NEW.user_id AND equipment_code=gear.equipment_code;
    changes := changes || jsonb_build_array(jsonb_build_object('equipmentCode',gear.equipment_code,
      'wearBefore',gear.culture_wear_percent,'wearAfter',after_wear,
      'version',gear.culture_wear_version+1));
  END LOOP;
  UPDATE public.kq_culture_equipment_wear_receipts SET equipment=changes WHERE run_id=NEW.id;
  RETURN NEW;
END $$;
CREATE TRIGGER kq_wear_culture_equipment_on_completion AFTER UPDATE OF status ON public.kq_runs
FOR EACH ROW EXECUTE FUNCTION public.kq_wear_culture_equipment_on_completion();

CREATE FUNCTION public.kq_guard_culture_equipment_start() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE requested TEXT[]; expected TEXT[];
BEGIN
  IF NEW.status::TEXT<>'active' THEN RETURN NEW; END IF;
  -- Same order as purchases/upgrades/replacements. Recheck the snapshot while locked.
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || NEW.user_id::TEXT,0));
  PERFORM public.rpc_kq_ensure_equipment_profile(NEW.user_id);
  PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
  IF jsonb_typeof(NEW.state->'equipment'->'codes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'kq_culture_equipment_changed';
  END IF;
  SELECT COALESCE(array_agg(code ORDER BY code),ARRAY[]::TEXT[]) INTO requested
    FROM jsonb_array_elements_text(NEW.state->'equipment'->'codes') item(code);
  IF EXISTS (SELECT 1 FROM public.kq_player_equipment WHERE user_id=NEW.user_id
    AND equipment_code=ANY(requested) AND culture_wear_percent=100
    AND public.kq_culture_equipment_wear_delta(equipment_code,'balanced',0)>0) THEN
    RAISE EXCEPTION 'kq_culture_equipment_broken';
  END IF;
  WITH usable AS (
    SELECT e.equipment_code,c.slot FROM public.kq_equipment_loadouts l
    JOIN public.kq_player_equipment e ON e.user_id=l.user_id AND e.equipment_code=l.equipment_code
    JOIN public.kq_equipment_catalog c ON c.code=e.equipment_code
    WHERE l.user_id=NEW.user_id AND c.is_active AND (NOT c.is_purchasable OR e.purchase_price_cents>0)
      AND (public.kq_culture_equipment_wear_delta(e.equipment_code,'balanced',0)=0 OR e.culture_wear_percent<100)
  ), effective AS (
    SELECT equipment_code FROM usable
    UNION ALL
    SELECT starter.code FROM (VALUES ('tent','TENT-080-STARTER'),('lighting','LED-150-STARTER'),('air','AIR-STARTER')) starter(slot,code)
      WHERE NOT EXISTS (SELECT 1 FROM usable WHERE usable.slot=starter.slot)
  ) SELECT array_agg(equipment_code ORDER BY equipment_code) INTO expected FROM effective;
  IF requested IS DISTINCT FROM expected THEN RAISE EXCEPTION 'kq_culture_equipment_changed'; END IF;
  IF EXISTS (SELECT 1 FROM public.kq_player_equipment e WHERE e.user_id=NEW.user_id
    AND e.equipment_code=ANY(requested)
    AND COALESCE(NEW.state->'equipment'->'levels'->e.equipment_code,'1'::JSONB) IS DISTINCT FROM to_jsonb(e.level)) THEN
    RAISE EXCEPTION 'kq_culture_equipment_changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER kq_guard_culture_equipment_start BEFORE INSERT ON public.kq_runs
FOR EACH ROW EXECUTE FUNCTION public.kq_guard_culture_equipment_start();

CREATE FUNCTION public.kq_guard_culture_equipment_loadout() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.kq_player_equipment WHERE user_id=NEW.user_id
    AND equipment_code=NEW.equipment_code AND culture_wear_percent=100
    AND public.kq_culture_equipment_wear_delta(equipment_code,'balanced',0)>0) THEN
    RAISE EXCEPTION 'kq_culture_equipment_broken';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER kq_guard_culture_equipment_loadout BEFORE INSERT OR UPDATE OF equipment_code ON public.kq_equipment_loadouts
FOR EACH ROW EXECUTE FUNCTION public.kq_guard_culture_equipment_loadout();

CREATE FUNCTION public.rpc_kq_replace_culture_equipment(
  p_user_id UUID,p_equipment_code TEXT,p_expected_version INTEGER,p_expected_cost_cents INTEGER,p_request_key UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE gear public.kq_player_equipment%ROWTYPE; catalog public.kq_equipment_catalog%ROWTYPE;
  old public.kq_culture_equipment_replacements%ROWTYPE; cash INTEGER; cost INTEGER; result JSONB;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL OR NULLIF(BTRIM(p_equipment_code),'') IS NULL
    OR p_expected_version IS NULL OR p_expected_version<0
    OR p_expected_cost_cents IS NULL OR p_expected_cost_cents<=0 THEN
    RAISE EXCEPTION 'culture_equipment_invalid_request';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || p_user_id::TEXT,0));
  SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'culture_equipment_not_owned'; END IF;
  SELECT * INTO old FROM public.kq_culture_equipment_replacements WHERE user_id=p_user_id AND request_key=p_request_key;
  IF FOUND THEN
    IF old.equipment_code<>p_equipment_code OR old.expected_version<>p_expected_version
      OR (old.receipt->>'paidCents')::INTEGER<>p_expected_cost_cents THEN
      RAISE EXCEPTION 'culture_equipment_request_mismatch';
    END IF;
    RETURN old.receipt || '{"replayed":true}'::JSONB;
  END IF;
  IF EXISTS (SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='active') THEN
    RAISE EXCEPTION 'culture_equipment_active_run';
  END IF;
  SELECT * INTO gear FROM public.kq_player_equipment WHERE user_id=p_user_id AND equipment_code=p_equipment_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'culture_equipment_not_owned'; END IF;
  SELECT * INTO catalog FROM public.kq_equipment_catalog WHERE code=p_equipment_code AND is_active AND is_purchasable;
  IF NOT FOUND OR gear.purchase_price_cents<=0 OR public.kq_culture_equipment_wear_delta(p_equipment_code,'balanced',0)=0 THEN
    RAISE EXCEPTION 'culture_equipment_unavailable';
  END IF;
  IF gear.culture_wear_version<>p_expected_version THEN RAISE EXCEPTION 'culture_equipment_condition_changed'; END IF;
  IF gear.culture_wear_percent<100 THEN RAISE EXCEPTION 'culture_equipment_not_due'; END IF;
  cost := CEIL(catalog.price_cents::NUMERIC*(100+(gear.level-1)*10)/100)::INTEGER;
  IF cost<>p_expected_cost_cents THEN RAISE EXCEPTION 'culture_equipment_condition_changed'; END IF;
  IF cash<cost THEN RAISE EXCEPTION 'culture_equipment_insufficient_cash'; END IF;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-cost,updated_at=now() WHERE user_id=p_user_id;
  UPDATE public.kq_player_equipment SET culture_wear_percent=0,culture_wear_version=culture_wear_version+1
    WHERE user_id=p_user_id AND equipment_code=p_equipment_code;
  IF to_regclass('public.kq_commerce_accounts') IS NOT NULL THEN
    UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
  END IF;
  result := jsonb_build_object('equipmentCode',p_equipment_code,'paidCents',cost,'cashAfterCents',cash-cost,
    'version',gear.culture_wear_version+1,'level',gear.level,'replayed',false);
  INSERT INTO public.kq_culture_equipment_replacements(user_id,request_key,equipment_code,expected_version,receipt)
    VALUES(p_user_id,p_request_key,p_equipment_code,p_expected_version,result);
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.kq_culture_equipment_wear_delta(TEXT,TEXT,INTEGER),
  public.kq_wear_culture_equipment_on_completion(),public.kq_guard_culture_equipment_start(),
  public.kq_guard_culture_equipment_loadout(),public.rpc_kq_replace_culture_equipment(UUID,TEXT,INTEGER,INTEGER,UUID)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_replace_culture_equipment(UUID,TEXT,INTEGER,INTEGER,UUID) TO service_role;

COMMIT;
