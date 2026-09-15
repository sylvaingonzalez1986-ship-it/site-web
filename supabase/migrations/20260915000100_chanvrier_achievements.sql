BEGIN;

CREATE TABLE public.chanvrier_achievement_catalog (
  code TEXT PRIMARY KEY, category TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL,
  thresholds INTEGER[] NOT NULL, title TEXT
);
INSERT INTO public.chanvrier_achievement_catalog VALUES
('triple-spark','dice','Triple étincelle','Obtiens trois 6 sur les dés finaux d’une étape. La culture doit être terminée.',ARRAY[1,5,20],'Porte-étincelles'),
('spark-collector','dice','Collectionneur d’étincelles','Cumule les faces 6 conservées dans tes cultures terminées.',ARRAY[25,100,300],NULL),
('perfect-culture','culture','Culture exemplaire','Réussis les six étapes d’une culture, sans résultat fragile ni échec.',ARRAY[1,5,20],NULL),
('cool-head','culture','Sang-froid','Termine une culture avec une pression finale à zéro.',ARRAY[1,10,30],NULL),
('natural-defense','culture','Défense naturelle','Déclenche le combo PBI ciblée dans une culture terminée.',ARRAY[1,5,15],NULL),
('jury-favorite','arena','Jury conquis','Présente des fleurs distinctes qui obtiennent au moins 9/10 au jury d’un duel.',ARRAY[1,5,15],NULL),
('versatile-artisan','commerce','Artisan polyvalent','Vends un produit transformé dans trois filières différentes. Fleurs brutes et biomasse exclues.',ARRAY[3],NULL),
('perfect-victory','arena','Victoire parfaite','Gagne les trois manches d’un duel officiel contre un autre joueur.',ARRAY[1,5,15],'Invincible du jury');
CREATE TABLE public.chanvrier_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  metrics JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.chanvrier_progress_events (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(user_id,event_key)
);
CREATE TABLE public.chanvrier_showcases (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  badges TEXT[] NOT NULL DEFAULT '{}', title TEXT, tracked TEXT,
  seen_badge_count INTEGER NOT NULL DEFAULT 0 CHECK (seen_badge_count >= 0),
  CHECK (cardinality(badges) <= 3)
);
ALTER TABLE public.chanvrier_achievement_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chanvrier_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chanvrier_progress_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chanvrier_showcases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chanvrier_achievement_catalog, public.chanvrier_progress,
  public.chanvrier_progress_events, public.chanvrier_showcases FROM anon, authenticated;
GRANT ALL ON public.chanvrier_achievement_catalog, public.chanvrier_progress,
  public.chanvrier_progress_events, public.chanvrier_showcases TO service_role;

INSERT INTO public.contest_badges(id,code,label,description,icon,is_active)
SELECT 'kq-ach-'||c.code||'-'||n, 'kq-ach-'||c.code||'-'||n,
  c.name||' · '||(ARRAY['Bronze','Argent','Or'])[n], c.description||' Objectif : '||c.thresholds[n]||'.', 'trophy', true
FROM public.chanvrier_achievement_catalog c CROSS JOIN LATERAL generate_subscripts(c.thresholds,1) n;

ALTER TABLE public.kq_support_booster_entitlements
  DROP CONSTRAINT kq_support_booster_entitlements_source_check,
  DROP CONSTRAINT kq_support_booster_entitlements_source_shape_check;
ALTER TABLE public.kq_support_booster_entitlements
  ADD CONSTRAINT kq_support_booster_entitlements_source_check CHECK (source IN
    ('ticket','arena_streak','notebook_badge','season_reward','points_purchase','welcome_pack','pvp_win','notebook_flower','mission','achievement')),
  ADD CONSTRAINT kq_support_booster_entitlements_source_shape_check CHECK (
    (source='ticket' AND ticket_id IS NOT NULL AND reward_key IS NULL) OR
    (source<>'ticket' AND ticket_id IS NULL AND reward_key IS NOT NULL));

-- Only trusted database events call this function. Serialize each account before
-- inserting its event key; replay and concurrent deliveries cannot award twice.
CREATE FUNCTION public.kq_apply_progress(p_user UUID,p_key TEXT,p_delta JSONB,p_at TIMESTAMPTZ,p_jury NUMERIC DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m JSONB; d RECORD; c RECORD; n INTEGER; families INTEGER:=0;
BEGIN
  INSERT INTO public.chanvrier_progress(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
  SELECT metrics INTO m FROM public.chanvrier_progress WHERE user_id=p_user FOR UPDATE;
  INSERT INTO public.chanvrier_progress_events(user_id,event_key,occurred_at) VALUES(p_user,p_key,COALESCE(p_at,now())) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;
  FOR d IN SELECT * FROM jsonb_each_text(p_delta) LOOP
    m:=jsonb_set(m,ARRAY[d.key],to_jsonb(COALESCE((m->>d.key)::NUMERIC,0)+d.value::NUMERIC));
  END LOOP;
  m:=jsonb_set(m,'{bestJury}',to_jsonb(GREATEST(COALESCE((m->>'bestJury')::NUMERIC,0),p_jury)));
  UPDATE public.chanvrier_progress SET metrics=m,updated_at=now() WHERE user_id=p_user;
  FOR c IN SELECT * FROM public.chanvrier_achievement_catalog LOOP
    IF COALESCE((m->>c.code)::NUMERIC,0)>=c.thresholds[1] THEN families:=families+1; END IF;
    FOR n IN 1..cardinality(c.thresholds) LOOP
      IF COALESCE((m->>c.code)::NUMERIC,0)>=c.thresholds[n] THEN
        INSERT INTO public.contest_profile_badges(customer_id,badge_id,awarded_at,reward_pack_count)
        VALUES(p_user,'kq-ach-'||c.code||'-'||n,COALESCE(p_at,now()),0)
        ON CONFLICT(customer_id,badge_id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH n IN ARRAY ARRAY[5,8] LOOP
    IF families>=n THEN
      INSERT INTO public.kq_support_booster_entitlements(user_id,source,reward_key,card_count)
      VALUES(p_user,'achievement','kq-achievement:v1:'||p_user||':families:'||n,10)
      ON CONFLICT(reward_key) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION public.kq_progress_run(r public.kq_runs)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h JSONB; e JSONB; die JSONB; triples INTEGER:=0; sparks INTEGER:=0; successes INTEGER:=0;
BEGIN
  IF r.status::TEXT<>'completed' THEN RETURN; END IF;
  h:=CASE WHEN jsonb_typeof(r.state->'history')='array' THEN r.state->'history' ELSE '[]'::JSONB END;
  FOR e IN SELECT * FROM jsonb_array_elements(h) LOOP
    IF e->'dice'='[6,6,6]'::JSONB THEN triples:=triples+1; END IF;
    IF jsonb_typeof(e->'dice')='array' AND jsonb_array_length(e->'dice')=3 THEN
      FOR die IN SELECT * FROM jsonb_array_elements(e->'dice') LOOP
        IF die='6'::JSONB THEN sparks:=sparks+1; END IF;
      END LOOP;
    END IF;
    IF e->>'outcome' IN ('success','critical') THEN successes:=successes+1; END IF;
  END LOOP;
  PERFORM public.kq_apply_progress(r.user_id,'run:'||r.id,jsonb_build_object(
    'cultures',1,'triple-spark',triples,'spark-collector',sparks,
    'perfect-culture',CASE WHEN jsonb_array_length(h)=6 AND successes=6 THEN 1 ELSE 0 END,
    'cool-head',CASE WHEN r.state->'pressure'='0'::JSONB THEN 1 ELSE 0 END,
    'natural-defense',CASE WHEN r.state->'combos' ? 'PBI ciblée' THEN 1 ELSE 0 END
  ),r.completed_at);
END;
$$;

CREATE FUNCTION public.kq_progress_jury(p_user UUID,p_flower UUID,p_rounds JSONB,p_side TEXT,p_at TIMESTAMPTZ)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE score NUMERIC;
BEGIN
  IF jsonb_typeof(p_rounds)<>'array' OR jsonb_array_length(p_rounds)<>3 THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rounds) r WHERE jsonb_typeof(r->p_side) IS DISTINCT FROM 'number') THEN RETURN; END IF;
  SELECT ROUND(LEAST(10,GREATEST(0,AVG((r->>p_side)::NUMERIC)/10)),1) INTO score FROM jsonb_array_elements(p_rounds) r;
  PERFORM public.kq_apply_progress(p_user,'jury-record:'||p_flower||':'||score,'{}',p_at,score);
  IF score>=9 THEN
    PERFORM public.kq_apply_progress(p_user,'jury-qualified:'||p_flower,'{"jury-favorite":1}',p_at,score);
  END IF;
END;
$$;

CREATE FUNCTION public.kq_progress_battle(b public.kq_battles)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p RECORD; perfect BOOLEAN;
BEGIN
  IF b.status::TEXT<>'verdict' OR b.winner_id IS NULL THEN RETURN; END IF;
  -- Deterministic account lock order for the two participants.
  FOR p IN SELECT * FROM (VALUES(b.player_one_id,b.flower_one_id,'player','playerScore'),
    (b.player_two_id,b.flower_two_id,'opponent','opponentScore')) v(user_id,flower_id,side,score_key) ORDER BY user_id LOOP
    perfect:=jsonb_array_length(b.rounds)=3 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b.rounds) r WHERE r->>'winner' IS DISTINCT FROM p.side);
    PERFORM public.kq_apply_progress(p.user_id,'battle:'||b.id,jsonb_build_object(
      'wins',CASE WHEN b.winner_id=p.user_id THEN 1 ELSE 0 END,
      'losses',CASE WHEN b.winner_id<>p.user_id THEN 1 ELSE 0 END,
      'perfect-victory',CASE WHEN b.winner_id=p.user_id AND perfect THEN 1 ELSE 0 END),b.verdict_at);
    PERFORM public.kq_progress_jury(p.user_id,p.flower_id,b.rounds,p.score_key,b.verdict_at);
  END LOOP;
END;
$$;
CREATE FUNCTION public.kq_progress_sale(s public.kq_market_sale_receipts)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF s.route NOT IN ('raw','biomass') AND s.harvest_grams>0 AND s.payout_cents>0 THEN
    PERFORM public.kq_apply_progress(s.owner_id,'sold-route:'||s.route,'{"versatile-artisan":1}',s.created_at);
  END IF;
END;
$$;
CREATE FUNCTION public.kq_progress_event_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'kq_runs' THEN PERFORM public.kq_progress_run(NEW);
    WHEN 'kq_battles' THEN PERFORM public.kq_progress_battle(NEW);
    WHEN 'kq_bot_battles' THEN PERFORM public.kq_progress_jury(NEW.user_id,NEW.flower_id,NEW.rounds,'playerScore',NEW.verdict_at);
    WHEN 'kq_market_sale_receipts' THEN PERFORM public.kq_progress_sale(NEW);
  END CASE;
  RETURN NEW;
END;
$$;
CREATE TRIGGER chanvrier_completed_culture AFTER INSERT OR UPDATE OF status ON public.kq_runs FOR EACH ROW
  WHEN(NEW.status::TEXT='completed') EXECUTE FUNCTION public.kq_progress_event_trigger();
CREATE TRIGGER chanvrier_official_verdict AFTER INSERT OR UPDATE OF status ON public.kq_battles FOR EACH ROW
  WHEN(NEW.status::TEXT='verdict') EXECUTE FUNCTION public.kq_progress_event_trigger();
CREATE TRIGGER chanvrier_bot_jury AFTER INSERT ON public.kq_bot_battles FOR EACH ROW EXECUTE FUNCTION public.kq_progress_event_trigger();
CREATE TRIGGER chanvrier_sale AFTER INSERT ON public.kq_market_sale_receipts FOR EACH ROW EXECUTE FUNCTION public.kq_progress_event_trigger();

CREATE FUNCTION public.rpc_chanvrier_progress(p_user_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH state AS (SELECT COALESCE((SELECT metrics FROM public.chanvrier_progress WHERE user_id=p_user_id),'{}'::JSONB) m),
  ranking AS (SELECT * FROM public.kq_rank_profiles WHERE user_id=p_user_id),
  snapshot AS (SELECT leaderboard,generated_at FROM public.kq_leaderboard_snapshots
    WHERE season_code=COALESCE((SELECT season_code FROM ranking),'KQ-2026-S1') ORDER BY snapshot_date DESC LIMIT 1),
  badges AS (SELECT b.id,b.code,b.label,b.description,
      CASE WHEN b.code LIKE 'kq-ach-%' THEN 'game' WHEN b.season_id IS NOT NULL THEN 'season' ELSE 'notebook' END origin,
      pb.awarded_at
    FROM public.contest_badges b LEFT JOIN public.contest_profile_badges pb ON pb.badge_id=b.id AND pb.customer_id=p_user_id
    WHERE b.is_active OR pb.id IS NOT NULL),
  showcase AS (SELECT * FROM public.chanvrier_showcases WHERE user_id=p_user_id)
  SELECT jsonb_build_object(
    'metrics',state.m,
    'reputation',COALESCE((SELECT reputation FROM public.kq_equipment_wallets WHERE user_id=p_user_id),0),
    'rating',COALESCE((SELECT rating FROM ranking),1000),
    'rank',(SELECT (e->>'rank')::INTEGER FROM snapshot,jsonb_array_elements(leaderboard) e WHERE e->>'userId'=p_user_id::TEXT LIMIT 1),
    'rankAsOf',(SELECT generated_at FROM snapshot),
    'badges',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'code',code,'label',label,'description',description,'origin',origin,'awardedAt',awarded_at) ORDER BY awarded_at DESC NULLS LAST,label) FROM badges),'[]'::JSONB),
    'missions',public.rpc_kq_mission_state(p_user_id)->'missions',
    'showcase',jsonb_build_object('badges',COALESCE((SELECT to_jsonb(badges) FROM showcase),'[]'::JSONB),'title',(SELECT title FROM showcase),'tracked',(SELECT tracked FROM showcase)),
    'unlockedFamilies',(SELECT count(*) FROM public.chanvrier_achievement_catalog c WHERE COALESCE((state.m->>c.code)::NUMERIC,0)>=c.thresholds[1]),
    'packsGranted',(SELECT count(*) FROM public.kq_support_booster_entitlements WHERE user_id=p_user_id AND source='achievement'),
    'badgeCount',(SELECT count(*) FROM badges WHERE awarded_at IS NOT NULL),
    'newBadgeCount',GREATEST(0,(SELECT count(*) FROM badges WHERE awarded_at IS NOT NULL)-COALESCE((SELECT seen_badge_count FROM showcase),0))
  ) FROM state;
$$;
CREATE FUNCTION public.rpc_chanvrier_showcase(p_user_id UUID,p_showcase JSONB DEFAULT NULL,p_seen INTEGER DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ids TEXT[]; count_owned INTEGER;
BEGIN
  IF p_showcase IS NOT NULL THEN
    IF jsonb_typeof(p_showcase->'badges') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'showcase_invalid'; END IF;
    SELECT array_agg(value) INTO ids FROM jsonb_array_elements_text(p_showcase->'badges');
    ids:=COALESCE(ids,'{}');
    IF cardinality(ids)>3 OR cardinality(ids)<>(SELECT count(DISTINCT v) FROM unnest(ids) v) THEN RAISE EXCEPTION 'showcase_invalid'; END IF;
    IF EXISTS(SELECT 1 FROM unnest(ids) AS wanted(badge) WHERE NOT EXISTS(SELECT 1 FROM public.contest_profile_badges pb WHERE pb.customer_id=p_user_id AND pb.badge_id=wanted.badge)) THEN RAISE EXCEPTION 'showcase_not_owned'; END IF;
    IF p_showcase->>'title' IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.chanvrier_achievement_catalog c JOIN public.contest_profile_badges b
        ON b.badge_id='kq-ach-'||c.code||'-'||cardinality(c.thresholds) AND b.customer_id=p_user_id
      WHERE c.code=p_showcase->>'title' AND c.title IS NOT NULL) THEN RAISE EXCEPTION 'showcase_not_owned'; END IF;
    IF p_showcase->>'tracked' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.chanvrier_achievement_catalog WHERE code=p_showcase->>'tracked') THEN RAISE EXCEPTION 'showcase_invalid'; END IF;
  END IF;
  INSERT INTO public.chanvrier_showcases(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
  IF p_showcase IS NOT NULL THEN
    UPDATE public.chanvrier_showcases SET badges=ids,title=p_showcase->>'title',tracked=p_showcase->>'tracked' WHERE user_id=p_user_id;
  END IF;
  IF p_seen IS NOT NULL THEN
    SELECT count(*) INTO count_owned FROM public.contest_profile_badges WHERE customer_id=p_user_id;
    UPDATE public.chanvrier_showcases SET seen_badge_count=GREATEST(seen_badge_count,LEAST(count_owned,GREATEST(0,p_seen))) WHERE user_id=p_user_id;
  END IF;
END;
$$;

-- Backfill is explicit, bounded and restartable. The caller persists the returned
-- cursor; replaying any page uses the same event keys as live play.
CREATE FUNCTION public.rpc_chanvrier_backfill(p_kind TEXT,p_after UUID DEFAULT NULL,p_limit INTEGER DEFAULT 100)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.kq_runs; b public.kq_battles; bot public.kq_bot_battles; sale public.kq_market_sale_receipts; last_id UUID:=p_after; processed INTEGER:=0; limit_rows INTEGER:=LEAST(200,GREATEST(1,p_limit));
BEGIN
  IF p_kind='runs' THEN
    FOR r IN SELECT * FROM public.kq_runs WHERE (p_after IS NULL OR id>p_after) AND status::TEXT='completed' ORDER BY id LIMIT limit_rows LOOP
      PERFORM public.kq_progress_run(r); last_id:=r.id; processed:=processed+1;
    END LOOP;
  ELSIF p_kind='battles' THEN
    FOR b IN SELECT * FROM public.kq_battles WHERE (p_after IS NULL OR id>p_after) AND status::TEXT='verdict' ORDER BY id LIMIT limit_rows LOOP
      PERFORM public.kq_progress_battle(b); last_id:=b.id; processed:=processed+1;
    END LOOP;
  ELSIF p_kind='bots' THEN
    FOR bot IN SELECT * FROM public.kq_bot_battles WHERE (p_after IS NULL OR id>p_after) ORDER BY id LIMIT limit_rows LOOP
      PERFORM public.kq_progress_jury(bot.user_id,bot.flower_id,bot.rounds,'playerScore',bot.verdict_at); last_id:=bot.id; processed:=processed+1;
    END LOOP;
  ELSIF p_kind='sales' THEN
    FOR sale IN SELECT * FROM public.kq_market_sale_receipts WHERE (p_after IS NULL OR id>p_after) ORDER BY id LIMIT limit_rows LOOP
      PERFORM public.kq_progress_sale(sale); last_id:=sale.id; processed:=processed+1;
    END LOOP;
  ELSE RAISE EXCEPTION 'invalid_backfill_kind'; END IF;
  RETURN jsonb_build_object('after',last_id,'processed',processed,'done',processed<limit_rows);
END;
$$;
REVOKE ALL ON FUNCTION public.kq_apply_progress(UUID,TEXT,JSONB,TIMESTAMPTZ,NUMERIC),
  public.kq_progress_run(public.kq_runs),public.kq_progress_jury(UUID,UUID,JSONB,TEXT,TIMESTAMPTZ),
  public.kq_progress_battle(public.kq_battles),public.kq_progress_sale(public.kq_market_sale_receipts),public.kq_progress_event_trigger(),
  public.rpc_chanvrier_progress(UUID),public.rpc_chanvrier_showcase(UUID,JSONB,INTEGER),public.rpc_chanvrier_backfill(TEXT,UUID,INTEGER)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_chanvrier_progress(UUID),public.rpc_chanvrier_showcase(UUID,JSONB,INTEGER),
  public.rpc_chanvrier_backfill(TEXT,UUID,INTEGER) TO service_role;
COMMIT;
