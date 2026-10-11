BEGIN;

-- Permanent career progress is earned by server-recorded play, never by the
-- spendable culture XP, reputation, sales slices, equipment purchases or seasons.
CREATE TABLE public.kq_chanvrier_career_events (
  run_id UUID PRIMARY KEY REFERENCES public.kq_runs(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('completed','failed')),
  xp INTEGER NOT NULL CHECK (xp BETWEEN 1 AND 100),
  occurred_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX kq_chanvrier_career_events_owner ON public.kq_chanvrier_career_events(user_id);
ALTER TABLE public.kq_chanvrier_career_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_chanvrier_career_events FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.kq_chanvrier_processing_practice (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flower_id UUID NOT NULL REFERENCES public.kq_flowers(id) ON DELETE RESTRICT,
  family TEXT NOT NULL CHECK (family IN ('sifting','washing','pressing')),
  route TEXT NOT NULL,
  equipment_codes TEXT[] NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id,flower_id,family)
);
ALTER TABLE public.kq_chanvrier_processing_practice ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_chanvrier_processing_practice FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.kq_chanvrier_run_xp(p_status TEXT,p_state JSONB) RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE
    WHEN p_status='completed' AND p_state->'cultureDead' IS DISTINCT FROM 'true'::JSONB THEN 100
    WHEN p_status='abandoned' AND p_state->'cultureDead'='true'::JSONB
      AND jsonb_typeof(p_state->'history')='array'
      THEN LEAST(6,jsonb_array_length(p_state->'history'))*10
    ELSE 0 END;
$$;

CREATE FUNCTION public.kq_chanvrier_processing_family(p_route TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE
    WHEN p_route IN ('dry-sift','static-sift') THEN 'sifting'
    WHEN p_route IN ('ice-water-hash','hash-signature') THEN 'washing'
    WHEN p_route IN ('rosin-trial','rosin-selection','rosin-premium','rosin-signature') THEN 'pressing'
    ELSE NULL END;
$$;

-- Take the migration lock before the backfill and trigger installation, so a
-- culture or transformation cannot slip between the two sources of evidence.
LOCK TABLE public.kq_runs,public.kq_commerce_batches,public.kq_market_sale_receipts
  IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO public.kq_chanvrier_career_events(run_id,user_id,outcome,xp,occurred_at)
SELECT id,user_id,CASE WHEN status::TEXT='completed' THEN 'completed' ELSE 'failed' END,
  public.kq_chanvrier_run_xp(status::TEXT,state),COALESCE(completed_at,updated_at,started_at)
FROM public.kq_runs WHERE public.kq_chanvrier_run_xp(status::TEXT,state)>0
ON CONFLICT(run_id) DO NOTHING;

-- Modern batches describe a transformation even when none of its stock has
-- been sold. Only pre-channel receipts describe an additional legacy source.
-- The same flower/family can never earn practice twice, including on migration.
INSERT INTO public.kq_chanvrier_processing_practice(user_id,flower_id,family,route,equipment_codes,occurred_at)
SELECT b.user_id,b.flower_id,public.kq_chanvrier_processing_family(b.route),b.route,l.equipment_codes,b.created_at
FROM public.kq_commerce_batches b JOIN public.kq_market_lots l ON l.flower_id=b.flower_id AND l.owner_id=b.user_id
WHERE public.kq_chanvrier_processing_family(b.route) IS NOT NULL
ON CONFLICT(user_id,flower_id,family) DO NOTHING;
INSERT INTO public.kq_chanvrier_processing_practice(user_id,flower_id,family,route,equipment_codes,occurred_at)
SELECT s.owner_id,s.flower_id,public.kq_chanvrier_processing_family(s.route),s.route,l.equipment_codes,s.created_at
FROM public.kq_market_sale_receipts s JOIN public.kq_market_lots l ON l.flower_id=s.flower_id AND l.owner_id=s.owner_id
WHERE s.sales_channel IS NULL AND public.kq_chanvrier_processing_family(s.route) IS NOT NULL
ON CONFLICT(user_id,flower_id,family) DO NOTHING;

CREATE FUNCTION public.kq_award_chanvrier_career() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE earned INTEGER;
BEGIN
  IF TG_OP='UPDATE' AND OLD.status::TEXT<>'active' THEN RETURN NEW; END IF;
  earned:=public.kq_chanvrier_run_xp(NEW.status::TEXT,NEW.state);
  IF earned>0 THEN
    INSERT INTO public.kq_chanvrier_career_events(run_id,user_id,outcome,xp,occurred_at)
    VALUES(NEW.id,NEW.user_id,CASE WHEN NEW.status::TEXT='completed' THEN 'completed' ELSE 'failed' END,
      earned,COALESCE(NEW.completed_at,NEW.updated_at,NEW.started_at))
    ON CONFLICT(run_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER kq_award_chanvrier_career AFTER INSERT OR UPDATE OF status ON public.kq_runs
FOR EACH ROW EXECUTE FUNCTION public.kq_award_chanvrier_career();

CREATE FUNCTION public.rpc_kq_chanvrier_career(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE thresholds INTEGER[]:=ARRAY[0,200,400,700,1200,1800,2400,3000,3700,4500];
  total BIGINT; completed BIGINT; career_level INTEGER:=1; practice JSONB;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'invalid_career_user'; END IF;
  SELECT COALESCE(sum(xp),0),count(*) FILTER(WHERE outcome='completed') INTO total,completed
    FROM public.kq_chanvrier_career_events WHERE user_id=p_user_id;
  WHILE career_level<10 AND total>=thresholds[career_level+1] LOOP career_level:=career_level+1; END LOOP;
  SELECT jsonb_build_object('sifting',count(*) FILTER(WHERE family='sifting'),
    'washing',count(*) FILTER(WHERE family='washing'),'pressing',count(*) FILTER(WHERE family='pressing'))
    INTO practice FROM public.kq_chanvrier_processing_practice WHERE user_id=p_user_id;
  RETURN jsonb_build_object('xp',total,'level',career_level,'completedCultures',completed,'processingPractice',practice,
    'nextLevel',CASE WHEN career_level<10 THEN career_level+1 ELSE NULL END,
    'nextLevelXp',thresholds[career_level+1],
    'xpToNextLevel',CASE WHEN career_level<10 THEN thresholds[career_level+1]-total ELSE 0 END,
    'progressPercent',CASE WHEN career_level=10 THEN 100 ELSE
      floor((total-thresholds[career_level])*100::NUMERIC/(thresholds[career_level+1]-thresholds[career_level]))::INTEGER END);
END $$;

CREATE FUNCTION public.kq_equipment_required_career_level(p_code TEXT,p_target_level INTEGER DEFAULT 1) RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE WHEN required_level IS NULL OR p_target_level IS NULL OR p_target_level NOT BETWEEN 1 AND 10
    OR (p_target_level>1 AND p_code IN ('TENT-080-STARTER','LED-150-STARTER','AIR-STARTER')) THEN NULL
    ELSE GREATEST(required_level,CASE WHEN p_target_level>=7 THEN 8 WHEN p_target_level>=4 THEN 5 ELSE 1 END) END
  FROM (SELECT CASE
    WHEN p_code IN ('TENT-080-STARTER','LED-150-STARTER','AIR-STARTER','SECURITY-CAMERA') THEN 1
    WHEN p_code IN ('TENT-120','LED-300','AIR-EC6','CLIMATE-SMART','DRYING-ROOM') THEN 2
    WHEN p_code IN ('SIFT-TRAY','SOLAR-BACKUP','SECURITY-DOG') THEN 3
    WHEN p_code='PRESS-0600' THEN 4
    WHEN p_code='WASHER-25L' THEN 5
    WHEN p_code='AUTO-SIEVE' THEN 6
    WHEN p_code='FREEZE-DRYER' THEN 8
    WHEN p_code='STATIC-PLASMA' THEN 10
    ELSE NULL END AS required_level) requirement;
$$;

CREATE FUNCTION public.kq_assert_equipment_career(p_user UUID,p_code TEXT,p_target_level INTEGER) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE career JSONB; required_level INTEGER; family TEXT; required_practice INTEGER;
BEGIN
  career:=public.rpc_kq_chanvrier_career(p_user);
  required_level:=public.kq_equipment_required_career_level(p_code,p_target_level);
  IF required_level IS NULL THEN RAISE EXCEPTION 'equipment_career_unavailable'; END IF;
  IF (career->>'level')::INTEGER<required_level THEN
    RAISE EXCEPTION 'equipment_career_level_required_%',required_level USING DETAIL=jsonb_build_object('equipmentCode',p_code,'requiredLevel',required_level)::TEXT;
  END IF;
  IF p_target_level=1 THEN
    family:=CASE WHEN p_code IN ('AUTO-SIEVE','FREEZE-DRYER') THEN 'washing' WHEN p_code='STATIC-PLASMA' THEN 'sifting' ELSE NULL END;
    required_practice:=CASE p_code WHEN 'AUTO-SIEVE' THEN 3 WHEN 'FREEZE-DRYER' THEN 6 WHEN 'STATIC-PLASMA' THEN 10 ELSE 0 END;
    IF family IS NOT NULL AND (career->'processingPractice'->>family)::INTEGER<required_practice THEN
      RAISE EXCEPTION 'equipment_career_practice_required' USING DETAIL=jsonb_build_object('family',family,'requiredLots',required_practice)::TEXT;
    END IF;
  END IF;
END $$;

-- Gate the actual mutations, covering both current and legacy RPC entry points.
-- Owned equipment is neither removed nor downgraded. Receipt replays make no
-- mutation, and installation/repair/replacement do not acquire a new model.
CREATE FUNCTION public.kq_guard_equipment_career() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.purchase_price_cents>0 THEN
      PERFORM public.kq_assert_equipment_career(NEW.user_id,NEW.equipment_code,1);
    END IF;
  ELSIF NEW.level>OLD.level THEN
    PERFORM public.kq_assert_equipment_career(NEW.user_id,NEW.equipment_code,NEW.level);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER kq_guard_equipment_career BEFORE INSERT OR UPDATE OF level ON public.kq_player_equipment
FOR EACH ROW EXECUTE FUNCTION public.kq_guard_equipment_career();

CREATE FUNCTION public.kq_guard_production_career() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE required_level INTEGER;
BEGIN
  IF NEW.production_units>OLD.production_units THEN
    required_level:=CASE NEW.production_units WHEN 2 THEN 3 WHEN 3 THEN 5 WHEN 4 THEN 7 ELSE 10 END;
    IF (public.rpc_kq_chanvrier_career(NEW.user_id)->>'level')::INTEGER<required_level THEN
      RAISE EXCEPTION 'production_career_level_required_%',required_level USING DETAIL=jsonb_build_object('requiredLevel',required_level)::TEXT;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER kq_guard_production_career BEFORE UPDATE OF production_units ON public.kq_equipment_wallets
FOR EACH ROW EXECUTE FUNCTION public.kq_guard_production_career();

CREATE FUNCTION public.kq_processing_route_uses_equipment(p_route TEXT,p_code TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE
    WHEN p_route IN ('dry-sift','static-sift') AND p_code='SIFT-TRAY' THEN true
    WHEN p_route='static-sift' AND p_code='STATIC-PLASMA' THEN true
    WHEN p_route IN ('ice-water-hash','hash-signature') AND p_code='WASHER-25L' THEN true
    WHEN p_route='hash-signature' AND p_code IN ('AUTO-SIEVE','FREEZE-DRYER') THEN true
    WHEN public.kq_chanvrier_processing_family(p_route)='pressing' AND p_code='PRESS-0600' THEN true
    ELSE false END;
$$;

DROP TRIGGER kq_wear_machines_on_completion ON public.kq_runs;

CREATE FUNCTION public.kq_record_chanvrier_processing() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner UUID; processing_family TEXT; used_codes TEXT[]; recorded INTEGER;
BEGIN
  IF TG_TABLE_NAME='kq_market_sale_receipts' THEN
    IF NEW.sales_channel IS NOT NULL THEN RETURN NEW; END IF;
    owner:=NEW.owner_id;
  ELSE owner:=NEW.user_id;
  END IF;
  processing_family:=public.kq_chanvrier_processing_family(NEW.route);
  IF processing_family IS NULL THEN RETURN NEW; END IF;
  -- Existing commerce RPCs serialize on this same wallet before preparing stock.
  PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=owner FOR UPDATE;
  SELECT equipment_codes INTO used_codes FROM public.kq_market_lots WHERE flower_id=NEW.flower_id AND owner_id=owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'career_processing_lot_mismatch'; END IF;
  INSERT INTO public.kq_chanvrier_processing_practice(user_id,flower_id,family,route,equipment_codes,occurred_at)
  VALUES(owner,NEW.flower_id,processing_family,NEW.route,used_codes,NEW.created_at)
  ON CONFLICT(user_id,flower_id,family) DO NOTHING RETURNING 1 INTO recorded;
  IF recorded=1 THEN
    UPDATE public.kq_player_equipment e
    SET wear_cycles=LEAST(e.wear_cycles+1,public.kq_machine_interval(e.equipment_code,e.level)),
      maintenance_version=e.maintenance_version+1
    WHERE e.user_id=owner AND e.tent_number=1 AND e.equipment_code=ANY(used_codes)
      AND public.kq_processing_route_uses_equipment(NEW.route,e.equipment_code);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER kq_record_chanvrier_processing AFTER INSERT ON public.kq_commerce_batches
FOR EACH ROW EXECUTE FUNCTION public.kq_record_chanvrier_processing();
CREATE TRIGGER kq_record_chanvrier_legacy_processing AFTER INSERT ON public.kq_market_sale_receipts
FOR EACH ROW EXECUTE FUNCTION public.kq_record_chanvrier_processing();

-- Preserve the existing maintenance guard, with its wallet lock before checking
-- remaining uses, including callers which insert a batch through an old RPC.
CREATE OR REPLACE FUNCTION public.kq_assert_processing_maintenance(p_user_id UUID,p_route TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.kq_player_equipment e JOIN public.kq_equipment_loadouts l USING(user_id,tent_number,equipment_code)
    JOIN public.kq_equipment_catalog c ON c.code=e.equipment_code
    WHERE e.user_id=p_user_id AND e.tent_number=1 AND public.kq_is_shared_processing_equipment(c.code)
      AND public.kq_processing_route_uses_equipment(p_route,c.code)
      AND e.wear_cycles>=public.kq_machine_interval(e.equipment_code,e.level)
      AND NOT EXISTS(SELECT 1 FROM public.kq_player_equipment usable
        JOIN public.kq_equipment_loadouts installed USING(user_id,tent_number,equipment_code)
        JOIN public.kq_equipment_catalog alternative ON alternative.code=usable.equipment_code
        WHERE usable.user_id=e.user_id AND alternative.is_active AND alternative.slot=c.slot
          AND usable.wear_cycles<public.kq_machine_interval(usable.equipment_code,usable.level))
  ) THEN RAISE EXCEPTION 'commerce_machine_maintenance'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.kq_guard_processing_maintenance() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id FOR UPDATE;
  PERFORM public.kq_assert_processing_maintenance(NEW.user_id,NEW.route);
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.kq_guard_legacy_processing_maintenance() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.sales_channel IS NULL THEN
    PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=NEW.owner_id FOR UPDATE;
    PERFORM public.kq_assert_processing_maintenance(NEW.owner_id,NEW.route);
  END IF;
  RETURN NEW;
END $$;

-- A preventive service has the same clearly quoted price as a repair. It is
-- available after the first real use; a pristine machine cannot be serviced.
DO $$ DECLARE definition TEXT; fragment TEXT; BEGIN
  SELECT pg_get_functiondef('public.rpc_kq_repair_tent_machine(uuid,text,integer,integer,uuid,integer)'::regprocedure) INTO definition;
  fragment:='IF gear.wear_cycles<public.kq_machine_interval(gear.equipment_code,gear.level) THEN RAISE EXCEPTION ''machine_not_due''; END IF;';
  IF strpos(definition,fragment)=0 THEN RAISE EXCEPTION 'career_maintenance_patch_target_changed'; END IF;
  definition:=replace(definition,fragment,'IF gear.wear_cycles<=0 THEN RAISE EXCEPTION ''machine_not_due''; END IF;');
  fragment:=' AND code<>''SIFT-TRAY''';
  IF strpos(definition,fragment)=0 THEN RAISE EXCEPTION 'career_pollinator_patch_target_changed'; END IF;
  EXECUTE replace(definition,fragment,'');
END $$;

REVOKE ALL ON FUNCTION public.kq_chanvrier_run_xp(TEXT,JSONB),
  public.kq_chanvrier_processing_family(TEXT),public.kq_award_chanvrier_career(),
  public.kq_equipment_required_career_level(TEXT,INTEGER),public.kq_assert_equipment_career(UUID,TEXT,INTEGER),
  public.kq_guard_equipment_career(),public.kq_guard_production_career(),
  public.kq_processing_route_uses_equipment(TEXT,TEXT),public.kq_record_chanvrier_processing(),
  public.kq_assert_processing_maintenance(UUID,TEXT),public.kq_guard_processing_maintenance(),public.kq_guard_legacy_processing_maintenance(),
  public.rpc_kq_chanvrier_career(UUID)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_chanvrier_career(UUID) TO service_role;

COMMIT;
