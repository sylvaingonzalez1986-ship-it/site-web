BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Keep the existing writer lock order while adding the mass ledger. The six
-- legacy work units, launched tasks, permanent receipts and archives survive.
LOCK TABLE public.kq_equipment_wallets IN EXCLUSIVE MODE;
LOCK TABLE public.kq_staff_accounts IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.kq_staff_trim_lots
 ADD COLUMN total_grams NUMERIC(18,6),
 ADD COLUMN completed_grams NUMERIC(18,6),
 ADD COLUMN quality_gram_weighted_total NUMERIC(18,6);

-- Stored harvest mass is authoritative for an existing lot. Before the storage
-- AFTER trigger has run, its canonical constructor helper supplies the same
-- quantity: one stock unit is one tenth of a gram, never one trim work unit.
WITH masses AS (
 SELECT t.flower_id,COALESCE(s.original_units,public.kq_storage_harvest_units(t.flower_id))::NUMERIC/10 AS grams
 FROM public.kq_staff_trim_lots t LEFT JOIN public.kq_storage_lots s USING(flower_id)
)
UPDATE public.kq_staff_trim_lots t SET total_grams=m.grams,
 completed_grams=CASE WHEN t.completed_at IS NOT NULL THEN m.grams
  ELSE GREATEST(0,LEAST(m.grams-0.000001,round(m.grams*t.completed_work/t.required_work,6))) END,
 quality_gram_weighted_total=round(m.grams*t.quality_weighted_total/t.required_work,6)
FROM masses m WHERE m.flower_id=t.flower_id;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.kq_staff_trim_lots WHERE total_grams IS NULL OR total_grams<0)
 THEN RAISE EXCEPTION 'staff_trim_mass_unavailable'; END IF;
END $$;
-- A genuinely empty harvest has nothing to trim. Do not change a previously
-- completed timestamp, appearance, storage evidence or historical work record.
UPDATE public.kq_staff_trim_lots SET completed_work=required_work,mode=COALESCE(mode,'manual'),
 completed_at=now(),completed_grams=0,quality_gram_weighted_total=0
 WHERE total_grams=0 AND completed_at IS NULL;

ALTER TABLE public.kq_staff_trim_lots
 ALTER COLUMN total_grams SET NOT NULL,
 ALTER COLUMN completed_grams SET DEFAULT 0,
 ALTER COLUMN completed_grams SET NOT NULL,
 ALTER COLUMN quality_gram_weighted_total SET DEFAULT 0,
 ALTER COLUMN quality_gram_weighted_total SET NOT NULL,
 ADD CONSTRAINT kq_staff_trim_grams_valid CHECK(total_grams>=0 AND completed_grams BETWEEN 0 AND total_grams
  AND ((completed_at IS NULL AND completed_grams<total_grams) OR (completed_at IS NOT NULL AND completed_grams=total_grams)));
REVOKE ALL ON TABLE public.kq_staff_trim_lots FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.kq_staff_trim_after_harvest() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE grams NUMERIC;
BEGIN
 SELECT original_units::NUMERIC/10 INTO grams FROM public.kq_storage_lots WHERE flower_id=NEW.id;
 IF grams IS NULL THEN grams:=public.kq_storage_harvest_units(NEW.id)::NUMERIC/10; END IF;
 IF grams IS NULL OR grams<0 THEN RAISE EXCEPTION 'staff_trim_mass_unavailable'; END IF;
 INSERT INTO public.kq_staff_trim_lots(flower_id,user_id,total_grams,completed_grams,completed_work,mode,completed_at)
 VALUES(NEW.id,NEW.owner_id,grams,0,CASE WHEN grams=0 THEN 6 ELSE 0 END,
  CASE WHEN grams=0 THEN 'manual' ELSE NULL END,CASE WHEN grams=0 THEN now() ELSE NULL END);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_trim_after_harvest() FROM PUBLIC,anon,authenticated,service_role;
-- Retain aaa_kq_staff_trim_after_harvest: its pending guard must exist before
-- storage allocation can attempt an overflow sale in the same transaction.

CREATE OR REPLACE FUNCTION public.kq_staff_trim_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH visible AS (
  SELECT * FROM public.kq_staff_trim_lots WHERE user_id=p_user AND completed_at IS NULL
  UNION ALL
  (SELECT * FROM public.kq_staff_trim_lots WHERE user_id=p_user AND completed_at IS NOT NULL ORDER BY completed_at DESC,flower_id LIMIT 30)
 ) SELECT COALESCE(jsonb_agg(jsonb_build_object('flowerId',t.flower_id,'name',f.variety_name,
  'requiredWork',t.required_work,'completedWork',t.completed_work,'mode',t.mode,
  'totalGrams',t.total_grams,'completedGrams',t.completed_grams,'createdAt',t.created_at,
  'qualityDelta',t.quality_delta,'completedAt',t.completed_at) ORDER BY t.created_at,t.flower_id),'[]'::JSONB)
 FROM visible t JOIN public.kq_flowers f ON f.id=t.flower_id;
$$;
REVOKE ALL ON FUNCTION public.kq_staff_trim_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.kq_staff_snapshot(UUID) RENAME TO kq_staff_snapshot_before_shared_trim;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot_before_shared_trim(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_staff_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_set(public.kq_staff_snapshot_before_shared_trim(p_user),'{context,trimQueueVersion}','2'::JSONB);
$$;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.kq_staff_apply_trim(p_user UUID,p_effect JSONB,p_staff JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE flower public.kq_flowers%ROWTYPE; lot public.kq_staff_trim_lots%ROWTYPE; storage public.kq_storage_lots%ROWTYPE;
 grams_effect BOOLEAN:=COALESCE(p_effect->>'unit'='g',false); work NUMERIC; credit NUMERIC; weighted NUMERIC;
 next_grams NUMERIC; next_work NUMERIC; legacy_credit NUMERIC; legacy_weighted NUMERIC;
 delta INTEGER; appearance NUMERIC; next_appearance NUMERIC; trim_mode TEXT;
BEGIN
 IF COALESCE(p_effect->>'flowerId','') !~* '^[0-9a-f-]{36}$'
  OR (p_effect ? 'unit' AND p_effect->'unit' IS DISTINCT FROM '"g"'::JSONB)
  OR jsonb_typeof(p_effect->'work') IS DISTINCT FROM 'number'
  OR (grams_effect AND ((p_effect->>'work')::NUMERIC<=0 OR (p_effect->>'work')::NUMERIC>7200
   OR round((p_effect->>'work')::NUMERIC,6)<>(p_effect->>'work')::NUMERIC))
  OR (NOT grams_effect AND ((p_effect->>'work')::NUMERIC NOT BETWEEN .01 AND 100
   OR round((p_effect->>'work')::NUMERIC,2)<>(p_effect->>'work')::NUMERIC))
  OR jsonb_typeof(p_effect->'qualityDelta') IS DISTINCT FROM 'number'
  OR COALESCE(p_effect->>'qualityDelta','') !~ '^-?[1-3]$'
  OR COALESCE(p_effect->>'mode','') NOT IN ('manual','machine')
 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
 trim_mode:=p_effect->>'mode'; delta:=(p_effect->>'qualityDelta')::INTEGER;
 IF (trim_mode='manual' AND delta<1) OR (trim_mode='machine' AND delta>-1)
  OR (trim_mode='machine' AND p_staff->'trimmerOwned' IS DISTINCT FROM 'true'::JSONB) THEN RAISE EXCEPTION 'staff_invalid'; END IF;
 -- The enclosing commit retains receipt replay, CAS, shared player hours,
 -- accounting and archive guards. Lock flower before trim and storage.
 SELECT * INTO flower FROM public.kq_flowers WHERE id=(p_effect->>'flowerId')::UUID AND owner_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'staff_trim_unavailable'; END IF;
 SELECT * INTO lot FROM public.kq_staff_trim_lots WHERE flower_id=flower.id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'staff_trim_unavailable'; END IF;
 IF lot.completed_at IS NOT NULL THEN RETURN; END IF;
 IF flower.status::TEXT<>'available' OR (lot.mode IS NOT NULL AND lot.mode<>trim_mode) THEN RAISE EXCEPTION 'staff_trim_changed'; END IF;
 work:=(p_effect->>'work')::NUMERIC;
 IF grams_effect THEN
  credit:=LEAST(work,lot.total_grams-lot.completed_grams);
  next_grams:=lot.completed_grams+credit;
  -- The legacy scale has only two decimals. Keep it strictly below six until
  -- the actual final microgram is credited, and nonzero once a mode is set.
  next_work:=CASE WHEN next_grams=lot.total_grams THEN lot.required_work
   ELSE GREATEST(.01,LEAST(lot.required_work-.01,round(next_grams*lot.required_work/lot.total_grams,2))) END;
  weighted:=lot.quality_gram_weighted_total+credit*delta;
  legacy_weighted:=round(weighted*lot.required_work/lot.total_grams,2);
 ELSE
  -- Already launched jobs retain their original six-unit quote and deadline.
  -- Their fractional harvest contribution is translated once, under the same
  -- CAS/receipt transaction; a final legacy fragment closes rounding residue.
  legacy_credit:=LEAST(work,lot.required_work-lot.completed_work);
  next_work:=lot.completed_work+legacy_credit;
  next_grams:=CASE WHEN next_work=lot.required_work THEN lot.total_grams
   ELSE LEAST(lot.total_grams-.000001,lot.completed_grams+round(legacy_credit*lot.total_grams/lot.required_work,6)) END;
  credit:=next_grams-lot.completed_grams;
  weighted:=lot.quality_gram_weighted_total+credit*delta;
  legacy_weighted:=lot.quality_weighted_total+legacy_credit*delta;
 END IF;
 UPDATE public.kq_staff_trim_lots SET completed_grams=next_grams,completed_work=next_work,mode=trim_mode,
  quality_gram_weighted_total=weighted,quality_weighted_total=legacy_weighted,
  completed_at=CASE WHEN next_grams=total_grams THEN now() ELSE NULL END WHERE flower_id=flower.id;
 IF next_grams<lot.total_grams THEN RETURN; END IF;
 delta:=round(weighted/lot.total_grams)::INTEGER;
 IF jsonb_typeof(flower.battle_stats->'appearance') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'staff_trim_unavailable'; END IF;
 SELECT * INTO storage FROM public.kq_storage_lots WHERE flower_id=flower.id FOR UPDATE;
 IF NOT FOUND OR storage.state ? 'juryApplied' THEN RAISE EXCEPTION 'staff_trim_changed'; END IF;
 appearance:=(flower.battle_stats->>'appearance')::NUMERIC;
 next_appearance:=GREATEST(0,LEAST(99,appearance+delta));
 UPDATE public.kq_flowers SET battle_stats=jsonb_set(battle_stats,'{appearance}',to_jsonb(next_appearance)) WHERE id=flower.id;
 UPDATE public.kq_storage_lots SET state=state||jsonb_build_object('trim',jsonb_build_object(
  'mode',trim_mode,'qualityDelta',delta,'totalGrams',lot.total_grams,'completedGrams',next_grams,
  'originalAppearance',appearance,'appearance',next_appearance,'completedAt',now())),revision=revision+1
  WHERE flower_id=flower.id;
 UPDATE public.kq_staff_trim_lots SET quality_delta=delta WHERE flower_id=flower.id;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_apply_trim(UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
