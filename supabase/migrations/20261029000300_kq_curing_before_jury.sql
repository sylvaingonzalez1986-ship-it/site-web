BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- New harvests enter the existing six-hour storage cycle before their jury.
-- Existing storage clocks and verdict archives are never restarted or rebased.
-- Available beta harvests start now: their past protection cannot be invented.
DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 body:=pg_get_functiondef('public.kq_storage_create_lot_without_capacity(uuid)'::REGPROCEDURE);
 fragment:='IF NOT FOUND OR f.status::TEXT<>''burned'' OR f.burned_at IS NULL THEN RETURN; END IF;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'curing_constructor_status_anchor_missing'; END IF;
 body:=replace(body,fragment,'IF NOT FOUND OR f.status::TEXT NOT IN (''available'',''burned'') THEN RETURN; END IF;');
 fragment:='anchor:=date_trunc(''milliseconds'',f.burned_at);';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'curing_constructor_clock_anchor_missing'; END IF;
 body:=replace(body,fragment,'anchor:=date_trunc(''milliseconds'',COALESCE(f.burned_at,now()));');
 fragment:='''version'',1,''flowerId'',f.id';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'curing_constructor_marker_anchor_missing'; END IF;
 body:=replace(body,fragment,'''preJury'',f.status::TEXT=''available'','||fragment);
 EXECUTE body;
END $$;

CREATE FUNCTION public.kq_storage_after_harvest() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.kq_storage_create_lot(NEW.id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_after_harvest() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_storage_after_harvest AFTER INSERT OR UPDATE OF status ON public.kq_flowers
 FOR EACH ROW WHEN(NEW.status::TEXT='available') EXECUTE FUNCTION public.kq_storage_after_harvest();

-- The flower transition is the final database guard, including direct PvP,
-- queue entry and bot verdicts. Previously queued/locked beta flowers retain
-- their original rules; only lots marked preJury use this preparation.
CREATE FUNCTION public.kq_storage_prepare_jury(p_flower UUID,p_stats JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lot public.kq_storage_lots%ROWTYPE; condition JSONB; delta NUMERIC; stats JSONB; settled JSONB;
BEGIN
 SELECT * INTO lot FROM public.kq_storage_lots WHERE flower_id=p_flower FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'kq_storage_required'; END IF;
 IF NOT COALESCE((lot.state->>'preJury')::BOOLEAN,false) THEN RETURN p_stats; END IF;
 IF now()<(lot.state->>'readyAt')::TIMESTAMPTZ THEN RAISE EXCEPTION 'kq_curing_required'; END IF;
 IF lot.state ? 'juryApplied' THEN RETURN lot.state->'juryApplied'->'stats'; END IF;
 settled:=public.kq_storage_settle(lot.state,date_trunc('milliseconds',now()));
 condition:=public.kq_storage_condition(settled,(lot.state->'baseline'->>'juryScore')::NUMERIC,now());
 delta:=(condition->>'qualityDelta')::NUMERIC;
 SELECT COALESCE(jsonb_object_agg(key,CASE WHEN key IN ('appearance','aroma','vigor','mastery','regularity','cannabinoids')
  AND jsonb_typeof(value)='number' THEN to_jsonb(GREATEST(0,LEAST(99,round(value::TEXT::NUMERIC+delta*10)))) ELSE value END),'{}'::JSONB)
 INTO stats FROM jsonb_each(p_stats);
 -- Freeze both the evidence and its net quality contribution exactly once.
 -- Exposure keeps running; the jury snapshot and six-hour clock stay fixed.
 UPDATE public.kq_storage_lots SET state=settled||jsonb_build_object('juryApplied',jsonb_build_object(
  'at',date_trunc('milliseconds',now()),'qualityDelta',delta,'originalStats',p_stats,'stats',stats)),revision=revision+1
 WHERE flower_id=p_flower;
 RETURN stats;
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_prepare_jury(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_flower_before_jury() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.status::TEXT='available' AND NEW.status::TEXT IN ('locked','burned') THEN
  NEW.battle_stats:=public.kq_storage_prepare_jury(OLD.id,OLD.battle_stats);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_flower_before_jury() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_flower_before_jury BEFORE UPDATE OF status ON public.kq_flowers
 FOR EACH ROW EXECUTE FUNCTION public.kq_flower_before_jury();

-- Bot rounds are calculated by the application. Prepare before reading its
-- battle stats; the status trigger verifies the same frozen evidence again.
CREATE FUNCTION public.rpc_kq_prepare_flower_jury(p_user_id UUID,p_flower_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE flower public.kq_flowers%ROWTYPE; stats JSONB;
BEGIN
 SELECT * INTO flower FROM public.kq_flowers WHERE id=p_flower_id AND owner_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR flower.status::TEXT<>'available' THEN RAISE EXCEPTION 'kq_flower_unavailable'; END IF;
 stats:=public.kq_storage_prepare_jury(flower.id,flower.battle_stats);
 IF stats IS DISTINCT FROM flower.battle_stats THEN UPDATE public.kq_flowers SET battle_stats=stats WHERE id=flower.id; END IF;
 RETURN jsonb_build_object('battleStats',stats);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_prepare_flower_jury(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_prepare_flower_jury(UUID,UUID) TO service_role;

CREATE FUNCTION public.rpc_kq_jury_readiness(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object(
  'availableFlowerCount',count(*) FILTER(WHERE (s.state->>'readyAt')::TIMESTAMPTZ<=now()),
  'curingFlowerCount',count(*) FILTER(WHERE s.flower_id IS NULL OR (s.state->>'readyAt')::TIMESTAMPTZ>now()))
 FROM public.kq_flowers f LEFT JOIN public.kq_storage_lots s ON s.flower_id=f.id
 WHERE f.owner_id=p_user_id AND f.status::TEXT='available'
  AND NOT EXISTS(SELECT 1 FROM public.kq_random_battle_queue q WHERE q.flower_id=f.id);
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_jury_readiness(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_jury_readiness(UUID) TO service_role;

-- The verdict already includes its acquired drying/curing contribution.
-- Subsequent trade quality receives only changes since that frozen evidence.
ALTER FUNCTION public.kq_storage_condition(JSONB,NUMERIC,TIMESTAMPTZ) RENAME TO kq_storage_condition_before_jury;
CREATE FUNCTION public.kq_storage_condition(p_state JSONB,p_jury NUMERIC,p_now TIMESTAMPTZ) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE result JSONB; score NUMERIC;
BEGIN
 IF NOT(p_state ? 'juryApplied') THEN RETURN public.kq_storage_condition_before_jury(p_state,p_jury,p_now); END IF;
 result:=public.kq_storage_condition_before_jury(p_state,(p_state->'baseline'->>'juryScore')::NUMERIC,p_now);
 score:=GREATEST(0,LEAST(10,round(p_jury+(result->>'qualityDelta')::NUMERIC-(p_state->'juryApplied'->>'qualityDelta')::NUMERIC,2)));
 RETURN result||jsonb_build_object('conditionScore',score,'qualityDelta',round(score-p_jury,2));
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_condition_before_jury(JSONB,NUMERIC,TIMESTAMPTZ),
 public.kq_storage_condition(JSONB,NUMERIC,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;

-- Unjudged stock is real stock, but cannot be sold or auto-cleared. Warehouse
-- lots keep their existing no-auto-sale policy after the verdict as well.
DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 body:=pg_get_functiondef('public.kq_storage_allocate(uuid,text,boolean)'::REGPROCEDURE);
 fragment:='IF public.kq_is_warehouse_flower(p_flower) THEN';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'curing_allocation_anchor_missing'; END IF;
 EXECUTE replace(body,fragment,'IF public.kq_is_warehouse_flower(p_flower) OR (COALESCE((lot.state->>''preJury'')::BOOLEAN,false) AND NOT EXISTS(SELECT 1 FROM public.kq_flowers WHERE id=p_flower AND status::TEXT=''burned'')) THEN');
 body:=pg_get_functiondef('public.kq_storage_sell_overflow(uuid,boolean)'::REGPROCEDURE);
 fragment:='IF NOT FOUND THEN RETURN NULL; END IF;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'curing_overflow_anchor_missing'; END IF;
 EXECUTE replace(body,fragment,fragment||E'\n IF NOT EXISTS(SELECT 1 FROM public.kq_flowers WHERE id=p_flower AND status::TEXT=''burned'') THEN\n  IF p_automatic THEN RETURN NULL; END IF;\n  RAISE EXCEPTION ''storage_jury_required'';\n END IF;');
 body:=pg_get_functiondef('public.kq_storage_overflow_offer(uuid,jsonb,integer)'::REGPROCEDURE);
 fragment:='units:=(p_state->''capacity''->>''totalUnits'')::INTEGER';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'curing_overflow_offer_anchor_missing'; END IF;
 EXECUTE replace(body,fragment,'IF COALESCE((p_state->>''preJury'')::BOOLEAN,false) AND NOT EXISTS(SELECT 1 FROM public.kq_flowers WHERE id=(p_state->>''flowerId'')::UUID AND status::TEXT=''burned'') THEN RETURN NULL; END IF;'||E'\n '||fragment);
END $$;

CREATE OR REPLACE FUNCTION public.kq_storage_after_verdict() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.kq_storage_create_lot(NEW.id);
 IF NOT public.kq_is_warehouse_flower(NEW.id) THEN
  UPDATE public.kq_storage_lots SET state=jsonb_set(state,'{capacity}',(state->'capacity')||jsonb_build_object(
   'automaticOverflowSale',true,'overflowDeadlineAt',date_trunc('milliseconds',NEW.burned_at)+interval '1 hour')),revision=revision+1
  WHERE flower_id=NEW.id AND COALESCE((state->>'preJury')::BOOLEAN,false)
   AND NOT COALESCE((state->'capacity'->>'automaticOverflowSale')::BOOLEAN,true);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_after_verdict() FROM PUBLIC,anon,authenticated,service_role;

-- A harvest already represented by a storage lot must not reserve a second
-- set of containers or drying capacity merely because its jury is pending.
DO $$ DECLARE name TEXT; body TEXT; fragment TEXT; BEGIN
 FOREACH name IN ARRAY ARRAY[
  'public.kq_warehouse_pending_shortage_units(uuid,jsonb,numeric)',
  'public.kq_warehouse_sync_containers()',
  'public.kq_warehouse_validate_service_change(uuid,jsonb,jsonb)',
  'public.kq_validate_warehouse_run_start_v1(uuid,uuid,jsonb)',
  'public.kq_validate_warehouse_run_start(uuid,uuid,jsonb)'
 ] LOOP
  IF to_regprocedure(name) IS NULL THEN RAISE EXCEPTION 'curing_reservation_function_missing: %',name; END IF;
  body:=pg_get_functiondef(name::REGPROCEDURE);
  fragment:='f.status::TEXT<>''burned''';
  IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'curing_reservation_anchor_missing: %',name; END IF;
  EXECUTE replace(body,fragment,fragment||' AND NOT EXISTS(SELECT 1 FROM public.kq_storage_lots stored_lot WHERE stored_lot.flower_id=f.id)');
 END LOOP;
END $$;

DO $$ DECLARE flower UUID; BEGIN
 FOR flower IN SELECT f.id FROM public.kq_flowers f WHERE f.status::TEXT='available'
  AND NOT EXISTS(SELECT 1 FROM public.kq_random_battle_queue q WHERE q.flower_id=f.id) ORDER BY f.created_at,f.id LOOP
  PERFORM public.kq_storage_create_lot(flower);
 END LOOP;
END $$;

COMMIT;
