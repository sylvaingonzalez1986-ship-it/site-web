BEGIN;

-- Six fictional work units per new harvest. Existing flowers are deliberately
-- grandfathered: no retrospective task, changed evidence or new sales gate.
CREATE TABLE public.kq_staff_trim_lots (
 flower_id UUID PRIMARY KEY REFERENCES public.kq_flowers(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 required_work NUMERIC(12,2) NOT NULL DEFAULT 6 CHECK(required_work=6),
 completed_work NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(completed_work BETWEEN 0 AND required_work),
 mode TEXT CHECK(mode IN ('manual','machine')),
 quality_weighted_total NUMERIC(14,2) NOT NULL DEFAULT 0,
 quality_delta INTEGER NOT NULL DEFAULT 0 CHECK(quality_delta BETWEEN -3 AND 3),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 completed_at TIMESTAMPTZ,
 CHECK((completed_work=0 AND mode IS NULL) OR (completed_work>0 AND mode IS NOT NULL)),
 CHECK((completed_work=required_work)=(completed_at IS NOT NULL))
);
CREATE INDEX kq_staff_trim_pending ON public.kq_staff_trim_lots(user_id,created_at,flower_id) WHERE completed_at IS NULL;
ALTER TABLE public.kq_staff_trim_lots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_staff_trim_lots FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_staff_trim_after_harvest() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 INSERT INTO public.kq_staff_trim_lots(flower_id,user_id) VALUES(NEW.id,NEW.owner_id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_trim_after_harvest() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER aaa_kq_staff_trim_after_harvest AFTER INSERT ON public.kq_flowers
 FOR EACH ROW EXECUTE FUNCTION public.kq_staff_trim_after_harvest();

CREATE FUNCTION public.kq_staff_assert_trim(p_flower UUID) RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.kq_staff_trim_lots WHERE flower_id=p_flower AND completed_at IS NULL)
 THEN RAISE EXCEPTION 'staff_trim_required'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_assert_trim(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_staff_trim_guard_flower() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.status::TEXT='available' AND NEW.status::TEXT IN ('locked','burned') THEN
  PERFORM public.kq_staff_assert_trim(OLD.id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_trim_guard_flower() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER aaa_kq_staff_trim_guard_flower BEFORE UPDATE OF status ON public.kq_flowers
 FOR EACH ROW EXECUTE FUNCTION public.kq_staff_trim_guard_flower();

-- Guard every physical commerce boundary as well as the jury, including paths
-- that operate on storage overflow or existing API quotes.
CREATE FUNCTION public.kq_staff_trim_guard_sale() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.kq_staff_assert_trim(NEW.flower_id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_trim_guard_sale() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER aaa_kq_staff_trim_guard_market BEFORE INSERT OR UPDATE OF status ON public.kq_market_lots
 FOR EACH ROW EXECUTE FUNCTION public.kq_staff_trim_guard_sale();
CREATE TRIGGER aaa_kq_staff_trim_guard_batch BEFORE INSERT ON public.kq_commerce_batches
 FOR EACH ROW EXECUTE FUNCTION public.kq_staff_trim_guard_sale();
CREATE TRIGGER aaa_kq_staff_trim_guard_receipt BEFORE INSERT ON public.kq_market_sale_receipts
 FOR EACH ROW EXECUTE FUNCTION public.kq_staff_trim_guard_sale();
CREATE TRIGGER aaa_kq_staff_trim_guard_overflow BEFORE INSERT ON public.kq_storage_overflow_sales
 FOR EACH ROW EXECUTE FUNCTION public.kq_staff_trim_guard_sale();

CREATE FUNCTION public.kq_staff_trim_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH visible AS (
  SELECT * FROM public.kq_staff_trim_lots WHERE user_id=p_user AND completed_at IS NULL
  UNION ALL
  (SELECT * FROM public.kq_staff_trim_lots WHERE user_id=p_user AND completed_at IS NOT NULL ORDER BY completed_at DESC,flower_id LIMIT 30)
 ) SELECT COALESCE(jsonb_agg(jsonb_build_object('flowerId',t.flower_id,'name',f.variety_name,
  'requiredWork',t.required_work,'completedWork',t.completed_work,'mode',t.mode,
  'qualityDelta',t.quality_delta,'completedAt',t.completed_at) ORDER BY t.created_at,t.flower_id),'[]'::JSONB)
 FROM visible t JOIN public.kq_flowers f ON f.id=t.flower_id;
$$;
REVOKE ALL ON FUNCTION public.kq_staff_trim_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.kq_staff_snapshot(UUID) RENAME TO kq_staff_snapshot_before_trim;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot_before_trim(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_staff_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_set(public.kq_staff_snapshot_before_trim(p_user),'{context,trimLots}',public.kq_staff_trim_snapshot(p_user));
$$;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_staff_apply_trim(p_user UUID,p_effect JSONB,p_staff JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE flower public.kq_flowers%ROWTYPE; lot public.kq_staff_trim_lots%ROWTYPE; storage public.kq_storage_lots%ROWTYPE;
 work NUMERIC; credit NUMERIC; weighted NUMERIC; delta INTEGER; appearance NUMERIC; next_appearance NUMERIC; trim_mode TEXT;
BEGIN
 IF COALESCE(p_effect->>'flowerId','') !~* '^[0-9a-f-]{36}$'
  OR jsonb_typeof(p_effect->'work') IS DISTINCT FROM 'number'
  OR (p_effect->>'work')::NUMERIC NOT BETWEEN .01 AND 100
  OR round((p_effect->>'work')::NUMERIC,2)<>(p_effect->>'work')::NUMERIC
  OR jsonb_typeof(p_effect->'qualityDelta') IS DISTINCT FROM 'number'
  OR COALESCE(p_effect->>'qualityDelta','') !~ '^-?[1-3]$'
  OR COALESCE(p_effect->>'mode','') NOT IN ('manual','machine')
 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
 trim_mode:=p_effect->>'mode'; delta:=(p_effect->>'qualityDelta')::INTEGER;
 IF (trim_mode='manual' AND delta<1) OR (trim_mode='machine' AND delta>-1)
  OR (trim_mode='machine' AND p_staff->'trimmerOwned' IS DISTINCT FROM 'true'::JSONB) THEN RAISE EXCEPTION 'staff_invalid'; END IF;
 -- The outer commit already holds the player's equipment/wallet lock. Lock
 -- flower before its storage row, matching the established jury pipeline.
 SELECT * INTO flower FROM public.kq_flowers WHERE id=(p_effect->>'flowerId')::UUID AND owner_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'staff_trim_unavailable'; END IF;
 SELECT * INTO lot FROM public.kq_staff_trim_lots WHERE flower_id=flower.id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'staff_trim_unavailable'; END IF;
 IF lot.completed_at IS NOT NULL THEN RETURN; END IF;
 IF flower.status::TEXT<>'available' OR (lot.mode IS NOT NULL AND lot.mode<>trim_mode) THEN RAISE EXCEPTION 'staff_trim_changed'; END IF;
 work:=(p_effect->>'work')::NUMERIC; credit:=LEAST(work,lot.required_work-lot.completed_work);
 weighted:=lot.quality_weighted_total+credit*delta;
 UPDATE public.kq_staff_trim_lots SET completed_work=completed_work+credit,mode=trim_mode,
  quality_weighted_total=weighted,completed_at=CASE WHEN completed_work+credit=required_work THEN now() ELSE NULL END
  WHERE flower_id=flower.id;
 IF lot.completed_work+credit<lot.required_work THEN RETURN; END IF;
 delta:=round(weighted/lot.required_work)::INTEGER;
 IF jsonb_typeof(flower.battle_stats->'appearance') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'staff_trim_unavailable'; END IF;
 SELECT * INTO storage FROM public.kq_storage_lots WHERE flower_id=flower.id FOR UPDATE;
 IF NOT FOUND OR storage.state ? 'juryApplied' THEN RAISE EXCEPTION 'staff_trim_changed'; END IF;
 appearance:=(flower.battle_stats->>'appearance')::NUMERIC;
 next_appearance:=GREATEST(0,LEAST(99,appearance+delta));
 -- Modify the actual future jury input once. Harvest quality, history and the
 -- storage baseline stay immutable; the trim result has its own evidence.
 UPDATE public.kq_flowers SET battle_stats=jsonb_set(battle_stats,'{appearance}',to_jsonb(next_appearance)) WHERE id=flower.id;
 UPDATE public.kq_storage_lots SET state=state||jsonb_build_object('trim',jsonb_build_object(
  'mode',trim_mode,'qualityDelta',delta,'originalAppearance',appearance,'appearance',next_appearance,'completedAt',now())),revision=revision+1
  WHERE flower_id=flower.id;
 UPDATE public.kq_staff_trim_lots SET quality_delta=delta,completed_at=now() WHERE flower_id=flower.id;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_apply_trim(UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION pg_temp.kq_staff_trim_patch(p_signature TEXT,p_before TEXT,p_after TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE body TEXT;
BEGIN
 SELECT replace(pg_get_functiondef(p_signature::regprocedure),E'\r\n',E'\n') INTO body;
 IF (length(body)-length(replace(body,p_before,'')))/length(p_before)<>1 THEN RAISE EXCEPTION 'staff_trim_patch_drift: %',p_signature; END IF;
 EXECUTE replace(body,p_before,p_after);
END $$;
SELECT pg_temp.kq_staff_trim_patch('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)',
 '''leave'',''cancel-leave'',''settle''','''leave'',''cancel-leave'',''trim'',''buy-trimmer'',''settle''');
SELECT pg_temp.kq_staff_trim_patch('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)',
 'IF effect_kind=''culture'' THEN',
 'IF effect_kind=''trim-work'' THEN PERFORM public.kq_staff_apply_trim(p_user_id,effect,p_state); ELSIF effect_kind=''culture'' THEN');
SELECT pg_temp.kq_staff_trim_patch('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)',
 'IF cash<p_debit_cents THEN RAISE EXCEPTION ''staff_cash''; END IF;',
 $patch$IF p_command->>'action'='buy-trimmer' AND (p_command->'expectedCostCents' IS DISTINCT FROM '150000'::JSONB
  OR p_debit_cents<>150000 OR p_state->'trimmerOwned' IS DISTINCT FROM 'true'::JSONB
  OR account.state->'trimmerOwned'='true'::JSONB) THEN RAISE EXCEPTION 'staff_changed'; END IF;
 IF cash<p_debit_cents THEN RAISE EXCEPTION 'staff_cash'; END IF;$patch$);
SELECT pg_temp.kq_staff_trim_patch('public.kq_storage_prepare_jury(uuid,jsonb)',
 'SELECT * INTO lot FROM public.kq_storage_lots WHERE flower_id=p_flower FOR UPDATE;',
 'PERFORM public.kq_staff_assert_trim(p_flower); SELECT * INTO lot FROM public.kq_storage_lots WHERE flower_id=p_flower FOR UPDATE;');

CREATE OR REPLACE FUNCTION public.rpc_kq_jury_readiness(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object(
  'availableFlowerCount',count(*) FILTER(WHERE (s.state->>'readyAt')::TIMESTAMPTZ<=now() AND (t.flower_id IS NULL OR t.completed_at IS NOT NULL)),
  'curingFlowerCount',count(*) FILTER(WHERE s.flower_id IS NULL OR (s.state->>'readyAt')::TIMESTAMPTZ>now()),
  'trimFlowerCount',count(*) FILTER(WHERE t.flower_id IS NOT NULL AND t.completed_at IS NULL))
 FROM public.kq_flowers f LEFT JOIN public.kq_storage_lots s ON s.flower_id=f.id
 LEFT JOIN public.kq_staff_trim_lots t ON t.flower_id=f.id
 WHERE f.owner_id=p_user_id AND f.status::TEXT='available'
  AND NOT EXISTS(SELECT 1 FROM public.kq_random_battle_queue q WHERE q.flower_id=f.id);
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_jury_readiness(UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_jury_readiness(UUID) TO service_role;
DROP FUNCTION pg_temp.kq_staff_trim_patch(TEXT,TEXT,TEXT);

COMMIT;
