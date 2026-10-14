BEGIN;

-- The layout is private. Only named service RPCs can read or mutate it.
CREATE TABLE public.kq_warehouse_layouts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  state JSONB NOT NULL CHECK (jsonb_typeof(state)='object' AND state->>'version'='1'),
  migration_credit_cents BIGINT NOT NULL DEFAULT 0 CHECK (migration_credit_cents >= 0),
  legacy_archive JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kq_warehouse_layouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_warehouse_layouts FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.kq_warehouse_receipts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_key UUID NOT NULL,
  request JSONB NOT NULL,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,request_key)
);
ALTER TABLE public.kq_warehouse_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_warehouse_receipts FROM PUBLIC, anon, authenticated, service_role;

-- Packing moves loose goods into listings, but does not ship them. Preserve
-- their physical room reservation until sale or an explicit discard, including
-- paused listings and transformed goods expressed in raw-flower equivalents.
CREATE FUNCTION public.kq_warehouse_stock_units(p_user_id UUID) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((SELECT sum(public.kq_storage_remaining(s.flower_id)) FROM public.kq_storage_lots s WHERE s.user_id=p_user_id),0)
    + COALESCE((SELECT sum(l.remaining_packets::NUMERIC*l.format_grams*10*s.equivalent_units/NULLIF(s.initial_units,0))
      FROM public.kq_online_listings l JOIN public.kq_commerce_stock s ON s.id=l.stock_id
      WHERE l.user_id=p_user_id AND l.remaining_packets>0),0);
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_stock_units(UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.kq_warehouse_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'state',l.state,'revision',COALESCE(l.revision,0),'cashCents',w.cash_cents,
    'migrationCreditCents',COALESCE(l.migration_credit_cents,0),
    'activeRun',EXISTS(SELECT 1 FROM public.kq_runs r WHERE r.user_id=p_user_id AND r.status::TEXT='active'),
    'legacyActiveRun',l.user_id IS NULL AND EXISTS(SELECT 1 FROM public.kq_runs r WHERE r.user_id=p_user_id AND r.status::TEXT='active'),
    'stockGrams',public.kq_warehouse_stock_units(p_user_id)/10,
    'storageCapacityGrams',COALESCE((SELECT sum(c.quantity*(public.kq_storage_container(c.container_code)->>'capacityUnits')::NUMERIC)/10 FROM public.kq_storage_containers c WHERE c.user_id=p_user_id),0),
    'salesGramsPerDay',NULL,'context',jsonb_build_object('available',true,'salesAvailable',false),
    'conversion',CASE WHEN l.user_id IS NOT NULL THEN jsonb_build_object(
      'convertedAt',l.created_at,'originalCreditCents',l.legacy_archive->'creditCents',
      'previousTentCount',l.legacy_archive->'productionUnits',
      'note','Ancien équipement et niveaux archivés. Leur investissement est repris en crédit réservé à l’aménagement, sans modifier la trésorerie. Les anciens lots et contenants sont conservés.') ELSE NULL END)
  FROM public.kq_equipment_wallets w LEFT JOIN public.kq_warehouse_layouts l ON l.user_id=w.user_id WHERE w.user_id=p_user_id;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_snapshot(UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.rpc_kq_warehouse_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
  RETURN public.kq_warehouse_snapshot(p_user_id);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_snapshot(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_snapshot(UUID) TO service_role;

CREATE FUNCTION public.rpc_kq_warehouse_initialize(p_user_id UUID,p_starter_state JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE basis BIGINT; archive JSONB;
BEGIN
  IF p_user_id IS NULL OR p_starter_state IS NULL OR p_starter_state->>'version' IS DISTINCT FROM '1'
    OR octet_length(p_starter_state::TEXT)>300000 THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
  PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=p_user_id) THEN RETURN public.kq_warehouse_snapshot(p_user_id); END IF;
  -- Conversion cannot invalidate a culture's immutable legacy equipment snapshot.
  IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='active') THEN RETURN public.kq_warehouse_snapshot(p_user_id); END IF;
  PERFORM public.kq_treasury_initialize(p_user_id);
  SELECT COALESCE((SELECT sum(purchase_price_cents) FROM public.kq_player_equipment WHERE user_id=p_user_id),0)
    +COALESCE((SELECT sum(price_cents) FROM public.kq_equipment_upgrade_receipts WHERE user_id=p_user_id),0)
    +COALESCE((SELECT sum(price_cents) FROM public.kq_production_expansions WHERE user_id=p_user_id),0) INTO basis;
  archive:=jsonb_build_object('creditCents',basis,'productionUnits',(SELECT production_units FROM public.kq_equipment_wallets WHERE user_id=p_user_id),
    'equipment',(SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.tent_number,e.equipment_code),'[]') FROM public.kq_player_equipment e WHERE user_id=p_user_id),
    'loadouts',(SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.tent_number,e.slot),'[]') FROM public.kq_equipment_loadouts e WHERE user_id=p_user_id),
    'upgrades',(SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at),'[]') FROM public.kq_equipment_upgrade_receipts e WHERE user_id=p_user_id),
    'expansions',(SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at),'[]') FROM public.kq_production_expansions e WHERE user_id=p_user_id));
  -- No cash is created and no historical record is deleted. The old asset basis
  -- stays in the treasury; credit-funded replacements must not capitalize it twice.
  INSERT INTO public.kq_warehouse_layouts(user_id,state,migration_credit_cents,legacy_archive)
    VALUES(p_user_id,p_starter_state,basis,archive);
  RETURN public.kq_warehouse_snapshot(p_user_id);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_initialize(UUID,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_initialize(UUID,JSONB) TO service_role;

CREATE FUNCTION public.rpc_kq_warehouse_receipt(p_user_id UUID,p_request_key UUID,p_request JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.kq_warehouse_receipts%ROWTYPE;
BEGIN
  SELECT * INTO old FROM public.kq_warehouse_receipts WHERE user_id=p_user_id AND request_key=p_request_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF old.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'warehouse_request_mismatch'; END IF;
  RETURN public.kq_warehouse_snapshot(p_user_id)||jsonb_build_object('receipt',old.receipt||'{"replayed":true}'::JSONB);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_receipt(UUID,UUID,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_receipt(UUID,UUID,JSONB) TO service_role;

CREATE FUNCTION public.rpc_kq_warehouse_save(
  p_user_id UUID,p_request_key UUID,p_request JSONB,p_expected_revision INTEGER,
  p_previous_state JSONB,p_next_state JSONB,p_cost_cents INTEGER
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE layout public.kq_warehouse_layouts%ROWTYPE; replay JSONB; cash INTEGER; credit_used BIGINT; charged INTEGER; result JSONB;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL OR p_request IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1
    OR p_cost_cents IS NULL OR p_cost_cents<0 OR p_next_state IS NULL OR p_next_state->>'version' IS DISTINCT FROM '1'
    OR octet_length(p_next_state::TEXT)>300000 OR jsonb_typeof(p_next_state->'zones') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_next_state->'equipment') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_next_state->'zones')>1000 OR jsonb_array_length(p_next_state->'equipment')>64
    THEN RAISE EXCEPTION 'warehouse_invalid_request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  replay:=public.rpc_kq_warehouse_receipt(p_user_id,p_request_key,p_request);
  IF replay IS NOT NULL THEN RETURN replay; END IF;
  PERFORM public.kq_business_settle(p_user_id);
  SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
  SELECT * INTO layout FROM public.kq_warehouse_layouts WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR layout.revision<>p_expected_revision OR layout.state IS DISTINCT FROM p_previous_state THEN RAISE EXCEPTION 'warehouse_revision_changed'; END IF;
  IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='active') THEN RAISE EXCEPTION 'warehouse_active_run'; END IF;
  -- The service computes the price from the validated catalogue. API callers
  -- cannot execute this function or supply a trusted cost. Compare-and-swap
  -- ensures its source plan still matches the quote under the wallet lock.
  IF p_request->'expectedCostCents' IS DISTINCT FROM to_jsonb(p_cost_cents) THEN RAISE EXCEPTION 'warehouse_price_changed'; END IF;
  IF (p_next_state->>'preparedAreaM2')::INTEGER < (layout.state->>'preparedAreaM2')::INTEGER
    OR (p_next_state->>'preparedAreaM2')::INTEGER NOT BETWEEN 0 AND 1000
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(layout.state->'equipment') e WHERE COALESCE(
      (SELECT (n->>'quantity')::INTEGER FROM jsonb_array_elements(p_next_state->'equipment') n WHERE n->>'code'=e->>'code'),0)<(e->>'quantity')::INTEGER)
    THEN RAISE EXCEPTION 'warehouse_inventory_loss'; END IF;
  credit_used:=LEAST(layout.migration_credit_cents,p_cost_cents);
  charged:=p_cost_cents-credit_used;
  IF cash IS NULL OR cash<charged THEN RAISE EXCEPTION 'warehouse_insufficient_cash'; END IF;
  PERFORM public.kq_treasury_initialize(p_user_id);
  IF charged>0 THEN
    UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-charged,updated_at=now() WHERE user_id=p_user_id;
    PERFORM public.kq_treasury_add_asset(p_user_id,'warehouse:'||p_request_key::TEXT,'equipment','expense_depreciation',charged,now(),4320,'WAREHOUSE-FITOUT');
  END IF;
  UPDATE public.kq_warehouse_layouts SET state=p_next_state,revision=revision+1,
    migration_credit_cents=migration_credit_cents-credit_used,updated_at=now() WHERE user_id=p_user_id;
  UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
  result:=jsonb_build_object('requestKey',p_request_key,'revision',layout.revision+1,'investmentCents',p_cost_cents,
    'creditUsedCents',credit_used,'chargedCents',charged,'replayed',false);
  INSERT INTO public.kq_warehouse_receipts(user_id,request_key,request,receipt) VALUES(p_user_id,p_request_key,p_request,result);
  RETURN public.kq_warehouse_snapshot(p_user_id)||jsonb_build_object('receipt',result);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_save(UUID,UUID,JSONB,INTEGER,JSONB,JSONB,INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_save(UUID,UUID,JSONB,INTEGER,JSONB,JSONB,INTEGER) TO service_role;

-- Keep conversion evidence immutable, while preserving account deletion.
CREATE FUNCTION public.kq_warehouse_protect_archive() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.legacy_archive IS DISTINCT FROM OLD.legacy_archive OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN RAISE EXCEPTION 'warehouse_archive_immutable'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_protect_archive() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER kq_warehouse_archive_immutable BEFORE UPDATE ON public.kq_warehouse_layouts FOR EACH ROW EXECUTE FUNCTION public.kq_warehouse_protect_archive();

-- An old browser cannot spend on obsolete equipment after its value became a
-- non-cash conversion credit. Idempotent ensure-profile inserts remain harmless.
CREATE FUNCTION public.kq_warehouse_guard_legacy_equipment() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner UUID:=COALESCE(NEW.user_id,OLD.user_id);
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=owner) THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM public.kq_player_equipment WHERE user_id=owner AND equipment_code=NEW.equipment_code AND tent_number=NEW.tent_number) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'warehouse_legacy_equipment_archived';
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_guard_legacy_equipment() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER kq_warehouse_legacy_equipment_guard BEFORE INSERT OR UPDATE ON public.kq_player_equipment FOR EACH ROW EXECUTE FUNCTION public.kq_warehouse_guard_legacy_equipment();

CREATE FUNCTION public.kq_warehouse_guard_legacy_expansion() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.production_units IS DISTINCT FROM OLD.production_units AND EXISTS(SELECT 1 FROM public.kq_warehouse_layouts WHERE user_id=NEW.user_id)
    THEN RAISE EXCEPTION 'warehouse_legacy_equipment_archived'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_warehouse_guard_legacy_expansion() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER kq_warehouse_legacy_expansion_guard BEFORE UPDATE OF production_units ON public.kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION public.kq_warehouse_guard_legacy_expansion();

COMMENT ON TABLE public.kq_warehouse_layouts IS 'Authoritative 1000 m² warehouse plan. All writes use service-only RPCs and the shared equipment wallet lock. Conversion preserves legacy archives and grants non-cash investment credit.';
COMMIT;
