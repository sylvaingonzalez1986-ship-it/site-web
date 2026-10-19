BEGIN;

-- A harvest title is earned under the rules present when its culture starts.
-- Existing flowers and active cultures keep their original qualifications,
-- including mission progress which has not been claimed yet.
-- Six critical stages with the available Heritage/cards plus the historical
-- equipment cap can legitimately exceed the former 30-point storage limit.
ALTER TABLE public.kq_flowers DROP CONSTRAINT kq_flowers_quality_check;
ALTER TABLE public.kq_flowers ADD CONSTRAINT kq_flowers_quality_check CHECK (quality BETWEEN -6 AND 53);
ALTER TABLE public.kq_flowers
 ADD COLUMN harvest_tier_version SMALLINT NOT NULL DEFAULT 1 CHECK (harvest_tier_version IN (1,2)),
 ADD COLUMN successful_stages SMALLINT CHECK (successful_stages BETWEEN 0 AND 6),
 ADD COLUMN critical_stages SMALLINT CHECK (critical_stages BETWEEN 0 AND 6),
 ADD CONSTRAINT kq_flower_harvest_evidence CHECK (
  harvest_tier_version=1 OR (successful_stages IS NOT NULL AND critical_stages IS NOT NULL
   AND critical_stages<=successful_stages));

CREATE FUNCTION public.kq_harvest_tier_rank(p_quality INTEGER,p_version INTEGER,p_successful INTEGER,p_critical INTEGER)
RETURNS INTEGER LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_version=2 THEN
  CASE WHEN p_quality>=26 AND p_successful>=4 AND p_critical>=2 THEN 4
   WHEN p_quality>=20 THEN 3 WHEN p_quality>=14 THEN 2 WHEN p_quality>=8 THEN 1 ELSE 0 END
 ELSE CASE WHEN p_quality>=14 THEN 4 WHEN p_quality>=10 THEN 2 WHEN p_quality>=6 THEN 1 ELSE 0 END END;
$$;

CREATE FUNCTION public.kq_guard_harvest_tier_run() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous_count INTEGER; next_count INTEGER;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status::TEXT='active' THEN
   -- The database chooses the new version, regardless of a caller's marker.
   NEW.state:=NEW.state||'{"harvestTierVersion":2}'::JSONB;
   IF NEW.state->'history' IS DISTINCT FROM '[]'::JSONB
    THEN RAISE EXCEPTION 'kq_harvest_history_invalid'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.state->'harvestTierVersion' IS DISTINCT FROM OLD.state->'harvestTierVersion'
  THEN RAISE EXCEPTION 'kq_harvest_tier_version_immutable'; END IF;
 IF NEW.state->'harvestTierVersion' IS DISTINCT FROM '2'::JSONB THEN RETURN NEW; END IF;
 IF jsonb_typeof(NEW.state->'history') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'kq_harvest_history_invalid'; END IF;
 previous_count:=jsonb_array_length(OLD.state->'history');
 next_count:=jsonb_array_length(NEW.state->'history');
 IF next_count<previous_count OR next_count>LEAST(6,previous_count+1)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(OLD.state->'history') WITH ORDINALITY previous(entry,n)
    WHERE previous.entry IS DISTINCT FROM NEW.state->'history'->(previous.n::INTEGER-1))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.state->'history') entry
    WHERE entry->>'outcome' IS NULL OR entry->>'outcome' NOT IN ('failure','fragile','success','critical'))
  OR (NEW.status::TEXT='completed' AND (next_count<>6 OR NEW.state->'history' IS DISTINCT FROM OLD.state->'history'))
 THEN RAISE EXCEPTION 'kq_harvest_history_invalid'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_guard_harvest_tier_run BEFORE INSERT OR UPDATE OF state,status ON public.kq_runs
 FOR EACH ROW EXECUTE FUNCTION public.kq_guard_harvest_tier_run();

-- Heritage/rarity starters restore the validated starting XP after INSERT.
-- Retain the database-selected marker during that restoration, including
-- requests prepared by a server which does not yet send harvestTierVersion.
DO $$ DECLARE signature TEXT; body TEXT; anchor TEXT:='SET state = p_initial_state'; BEGIN
 FOREACH signature IN ARRAY ARRAY[
  'public.kq_start_run_with_heritage_internal(uuid,text,integer,text[],text[],jsonb,integer,text)',
  'public.kq_start_campaign_leader_internal(uuid,text,integer,text[],text[],jsonb,integer,text)'] LOOP
  body:=pg_get_functiondef(signature::REGPROCEDURE);
  IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'kq_harvest_start_restore_anchor_changed: %',signature; END IF;
  EXECUTE replace(body,anchor,anchor||'||''{"harvestTierVersion":2}''::JSONB');
 END LOOP;
END $$;

CREATE FUNCTION public.kq_guard_flower_harvest_evidence() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE run public.kq_runs%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.harvest_tier_version IS DISTINCT FROM OLD.harvest_tier_version
   OR NEW.successful_stages IS DISTINCT FROM OLD.successful_stages
   OR NEW.critical_stages IS DISTINCT FROM OLD.critical_stages
   OR NEW.quality IS DISTINCT FROM OLD.quality OR NEW.run_id IS DISTINCT FROM OLD.run_id
   OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
  THEN RAISE EXCEPTION 'kq_flower_harvest_evidence_immutable'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO run FROM public.kq_runs WHERE id=NEW.run_id AND user_id=NEW.owner_id;
 IF NOT FOUND OR run.status::TEXT<>'completed'
  THEN RAISE EXCEPTION 'kq_flower_harvest_run_invalid'; END IF;
 NEW.harvest_tier_version:=CASE WHEN run.state->'harvestTierVersion'='2'::JSONB THEN 2 ELSE 1 END;
 NEW.successful_stages:=NULL; NEW.critical_stages:=NULL;
 IF NEW.harvest_tier_version=2 THEN
  IF jsonb_typeof(run.state->'history') IS DISTINCT FROM 'array'
   THEN RAISE EXCEPTION 'kq_harvest_history_invalid'; END IF;
  IF jsonb_array_length(run.state->'history')<>6
   OR run.state->'quality' IS DISTINCT FROM to_jsonb(NEW.quality)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(run.state->'history') entry
     WHERE entry->>'outcome' IS NULL OR entry->>'outcome' NOT IN ('failure','fragile','success','critical'))
   THEN RAISE EXCEPTION 'kq_harvest_history_invalid'; END IF;
  SELECT count(*) FILTER(WHERE entry->>'outcome' IN ('success','critical')),
   count(*) FILTER(WHERE entry->>'outcome'='critical')
   INTO NEW.successful_stages,NEW.critical_stages FROM jsonb_array_elements(run.state->'history') entry;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_guard_flower_harvest_evidence BEFORE INSERT OR UPDATE ON public.kq_flowers
 FOR EACH ROW EXECUTE FUNCTION public.kq_guard_flower_harvest_evidence();

-- Preserve the existing mission/commerce evidence query and all mission IDs.
-- Its old flowers still qualify under 6/10/14, without requiring prior claims.
DO $$ DECLARE body TEXT; threshold INTEGER; rank INTEGER; anchor TEXT; BEGIN
 body:=pg_get_functiondef('public.kq_mission_metrics(uuid)'::REGPROCEDURE);
 FOREACH threshold IN ARRAY ARRAY[6,10,14] LOOP
  rank:=CASE threshold WHEN 6 THEN 1 WHEN 10 THEN 2 ELSE 4 END;
  anchor:='f.quality>='||threshold;
  IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'kq_harvest_mission_anchor_changed: %',threshold; END IF;
  body:=replace(body,anchor,'public.kq_harvest_tier_rank(f.quality,f.harvest_tier_version,f.successful_stages,f.critical_stages)>='||rank);
 END LOOP;
 EXECUTE body;
END $$;

-- Full row RPCs automatically return the new columns. The compact snapshot
-- needs both its camelCase inventory and snake_case battle snapshots extended.
DO $$ DECLARE body TEXT; relation TEXT; anchor TEXT; BEGIN
 body:=pg_get_functiondef('public.rpc_kq_player_core_snapshot(uuid)'::REGPROCEDURE);
 anchor:='''stats'', flower.battle_stats,';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'kq_harvest_snapshot_anchor_changed'; END IF;
 body:=replace(body,anchor,anchor||' ''harvestTierVersion'', flower.harvest_tier_version, ''successfulStages'', flower.successful_stages, ''criticalStages'', flower.critical_stages,');
 FOREACH relation IN ARRAY ARRAY['flower_one','flower_two','flower'] LOOP
  anchor:='''battle_stats'', '||relation||'.battle_stats,';
  IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'kq_harvest_battle_snapshot_anchor_changed: %',relation; END IF;
  body:=replace(body,anchor,anchor||' ''harvest_tier_version'', '||relation||'.harvest_tier_version, ''successful_stages'', '||relation||'.successful_stages, ''critical_stages'', '||relation||'.critical_stages,');
 END LOOP;
 EXECUTE body;
END $$;

REVOKE ALL ON FUNCTION public.kq_harvest_tier_rank(INTEGER,INTEGER,INTEGER,INTEGER),
 public.kq_guard_harvest_tier_run(),public.kq_guard_flower_harvest_evidence()
 FROM PUBLIC,anon,authenticated,service_role;
-- No new API tables or RPCs: existing named grants remain authoritative.
COMMIT;
