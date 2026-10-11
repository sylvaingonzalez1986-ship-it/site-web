BEGIN;

ALTER TABLE public.kq_equipment_wallets DROP CONSTRAINT kq_equipment_wallets_production_units_check;
ALTER TABLE public.kq_equipment_wallets ADD CONSTRAINT kq_equipment_wallets_production_units_check CHECK(production_units BETWEEN 1 AND 8);
ALTER TABLE public.kq_production_expansions DROP CONSTRAINT kq_production_expansions_previous_units_check;
ALTER TABLE public.kq_production_expansions ADD CONSTRAINT kq_production_expansions_previous_units_check CHECK(previous_units BETWEEN 1 AND 7);
ALTER TABLE public.kq_production_expansions DROP CONSTRAINT kq_production_expansions_check;
-- The old 4 -> 8 receipts remain valid, immutable and replayable. New purchases
-- below always add exactly one independent starter tent.
ALTER TABLE public.kq_production_expansions ADD CONSTRAINT kq_production_expansions_production_units_check
CHECK(production_units=previous_units+1 OR (previous_units=4 AND production_units=8));

CREATE OR REPLACE FUNCTION public.kq_run_production_units(p_state JSONB) RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE WHEN p_state->'equipment'->>'productionUnits' IN ('1','2','3','4','5','6','7','8')
    THEN (p_state->'equipment'->>'productionUnits')::INTEGER ELSE 1 END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_expand_production(p_user_id UUID,p_request_key UUID,p_expected_units INTEGER,p_expected_cost_cents INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.kq_production_expansions%ROWTYPE; units INTEGER; target INTEGER; cash INTEGER; cost INTEGER; result JSONB;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL OR p_expected_units IS NULL OR p_expected_units NOT BETWEEN 1 AND 8
    OR p_expected_cost_cents IS NULL OR p_expected_cost_cents<=0 THEN RAISE EXCEPTION 'production_invalid_request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  SELECT * INTO old FROM public.kq_production_expansions WHERE user_id=p_user_id AND request_key=p_request_key;
  IF FOUND THEN
    IF old.previous_units<>p_expected_units OR old.price_cents<>p_expected_cost_cents THEN RAISE EXCEPTION 'production_request_mismatch'; END IF;
    RETURN old.receipt||'{"replayed":true}'::JSONB;
  END IF;
  PERFORM public.kq_business_settle(p_user_id);
  SELECT production_units,cash_cents INTO units,cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
  IF units IS NULL THEN RAISE EXCEPTION 'production_invalid_request'; END IF;
  IF units<>p_expected_units THEN RAISE EXCEPTION 'production_units_changed'; END IF;
  IF units=8 THEN RAISE EXCEPTION 'production_max_units'; END IF;
  IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='active') THEN RAISE EXCEPTION 'production_active_run'; END IF;
  target:=units+1;
  cost:=30000+CASE WHEN target=5 THEN 2000000 ELSE 0 END;
  IF cost<>p_expected_cost_cents THEN RAISE EXCEPTION 'production_price_changed'; END IF;
  IF cash<cost THEN RAISE EXCEPTION 'production_insufficient_cash'; END IF;
  -- The career trigger checks the new tent count in this same transaction.
  UPDATE public.kq_equipment_wallets SET production_units=target,cash_cents=cash_cents-cost,updated_at=now() WHERE user_id=p_user_id;
  PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
  PERFORM public.kq_treasury_add_tent_asset(p_user_id,'production:'||p_request_key::TEXT||':tent:'||target,30000,now(),'TENT-CAPACITY',target);
  IF target=5 THEN
    PERFORM public.kq_treasury_add_asset(p_user_id,'production:'||p_request_key::TEXT||':warehouse','equipment','expense_depreciation',2000000,now(),4320,'WAREHOUSE-EXTENSION');
  END IF;
  UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
  result:=jsonb_build_object('productionUnits',target,'previousUnits',units,'addedUnits',1,'priceCents',cost,'cashAfterCents',cash-cost,'replayed',false);
  INSERT INTO public.kq_production_expansions(user_id,request_key,previous_units,production_units,price_cents,receipt)
  VALUES(p_user_id,p_request_key,units,target,cost,result);
  RETURN result;
END $$;

-- Old clients still pass the displayed count to these compatibility wrappers.
DO $$ DECLARE target REGPROCEDURE; definition TEXT; fragment TEXT; BEGIN
  FOREACH target IN ARRAY ARRAY[
    'public.rpc_kq_purchase_production_equipment(uuid,uuid,text[],integer)'::REGPROCEDURE,
    'public.rpc_kq_upgrade_production_equipment(uuid,uuid,text,integer,integer)'::REGPROCEDURE
  ] LOOP
    SELECT pg_get_functiondef(target) INTO definition;
    fragment:='p_expected_units NOT IN (1,2,3,4,8)';
    IF strpos(definition,fragment)=0 THEN RAISE EXCEPTION 'gradual_production_patch_target_changed: %',target; END IF;
    EXECUTE replace(definition,fragment,'p_expected_units NOT BETWEEN 1 AND 8');
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.kq_run_production_units(JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_expand_production(UUID,UUID,INTEGER,INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_expand_production(UUID,UUID,INTEGER,INTEGER) TO service_role;
COMMENT ON COLUMN public.kq_equipment_wallets.production_units IS
  'One to eight independent tents, expanded one at a time; the fifth tent opens the second warehouse. Processing machines remain shared.';

COMMIT;
