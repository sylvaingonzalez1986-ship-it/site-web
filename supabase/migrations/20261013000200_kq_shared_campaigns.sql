BEGIN;

-- One decision stream, with one existing run/flower/accounting lot per zone.
-- Historical runs and their receipts remain unchanged.
CREATE TABLE public.kq_culture_campaigns (
 id UUID PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 leader_run_id UUID NOT NULL UNIQUE,
 request_key UUID NOT NULL,
 request JSONB NOT NULL CHECK(jsonb_typeof(request)='object'),
 manifest JSONB NOT NULL CHECK(jsonb_typeof(manifest)='object'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id,request_key)
);
ALTER TABLE public.kq_culture_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_culture_campaigns FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.kq_runs ADD COLUMN campaign_id UUID REFERENCES public.kq_culture_campaigns(id) ON DELETE RESTRICT;
CREATE INDEX kq_runs_campaign ON public.kq_runs(campaign_id) WHERE campaign_id IS NOT NULL;
ALTER TABLE public.kq_culture_campaigns ADD CONSTRAINT kq_campaign_leader_fk
 FOREIGN KEY(leader_run_id) REFERENCES public.kq_runs(id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE public.kq_campaign_action_receipts (
 campaign_id UUID NOT NULL REFERENCES public.kq_culture_campaigns(id) ON DELETE CASCADE,
 expected_updated_at TIMESTAMPTZ NOT NULL,
 action TEXT NOT NULL,
 next_state JSONB NOT NULL,
 members JSONB NOT NULL,
 result JSONB NOT NULL,
 PRIMARY KEY(campaign_id,expected_updated_at)
);
ALTER TABLE public.kq_campaign_action_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_campaign_action_receipts FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.kq_flowers ADD COLUMN cultivation_profile JSONB,ADD COLUMN terpene_report JSONB;

-- Exact immutable v1 counterpart of kanab-quest-buddie-cultivation.ts. Real
-- cultivar chemistry is not encoded by these fictional balancing profiles.
CREATE FUNCTION public.kq_campaign_round(p_value DOUBLE PRECISION) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT floor(p_value*10000+0.5)::NUMERIC/10000 $$;
REVOKE ALL ON FUNCTION public.kq_campaign_round(DOUBLE PRECISION) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_campaign_cultivation_profile(p_code TEXT) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE n INTEGER; rarity TEXT; rank INTEGER; specialization INTEGER; individuality DOUBLE PRECISION; expression DOUBLE PRECISION;
 notes TEXT[]:=ARRAY['Agrumes','Pin','Fruits rouges','Bois','Fleurs','Épices','Menthe','Terre'];
BEGIN
 IF p_code IS NULL OR p_code !~ '^HH2026-(00[1-9]|0[1-4][0-9]|05[0-2])$' THEN RETURN NULL; END IF;
 n:=right(p_code,3)::INTEGER;
 rarity:=CASE WHEN n=1 THEN 'legendary' WHEN n<=4 THEN 'epic' WHEN n<=9 THEN 'gold' WHEN n<=19 THEN 'silver' ELSE 'common' END;
 rank:=CASE rarity WHEN 'legendary' THEN 4 WHEN 'epic' THEN 3 WHEN 'gold' THEN 2 WHEN 'silver' THEN 1 ELSE 0 END;
 specialization:=(n-1)%3; individuality:=((n*17)%53)::DOUBLE PRECISION/52;
 expression:=(0.88+specialization*0.1+individuality*0.015)*(1+rank::DOUBLE PRECISION/100);
 RETURN jsonb_build_object('version',1,'buddieCode',p_code,'rarity',rarity,
  'archetype',(ARRAY['yield','balanced','expression'])[specialization+1],
  'yieldFactor',public.kq_campaign_round(LEAST(1,(0.96-specialization*0.08+individuality*0.012)*(1+rank::DOUBLE PRECISION/100))),
  'cannabinoidTargets',jsonb_build_object('cbd',public.kq_campaign_round((9+(n%4)*1.4)*expression),
    'cbg',public.kq_campaign_round((0.7+((n*3)%7)*0.23)*expression),'thc',public.kq_campaign_round((0.1+(n%5)*0.02)*expression),
    'cbdv',public.kq_campaign_round((0.12+((n*5)%9)*0.035)*expression),'thcv',public.kq_campaign_round((0.01+(n%3)*0.01)*expression),
    'cbc',public.kq_campaign_round((0.22+(n%6)*0.035)*expression),'cbn',0),
  'terpenePotentialPercent',public.kq_campaign_round((1.5+specialization*0.65+individuality*0.12)*(1+rank::DOUBLE PRECISION/100)),
  'terpeneNotes',jsonb_build_array(notes[(n-1)%8+1],notes[(n+2)%8+1]));
END $$;
REVOKE ALL ON FUNCTION public.kq_campaign_cultivation_profile(TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_campaign_project_state(p_shared JSONB,p_own JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT p_shared || jsonb_build_object('varietyCode',p_own->'varietyCode','varietyName',p_own->'varietyName',
  'warehouse',p_own->'warehouse','energy',p_own->'energy','cultivationProfile',p_own->'cultivationProfile')
  || CASE WHEN p_shared ? 'quality' THEN jsonb_build_object('quality',CASE WHEN p_shared->'cultureDead'='true'::JSONB
    THEN (p_shared->>'quality')::INTEGER ELSE (p_shared->>'quality')::INTEGER
      -COALESCE((p_shared->'warehouse'->>'qualityBonus')::INTEGER,0)
      +COALESCE((p_own->'warehouse'->>'qualityBonus')::INTEGER,0) END) ELSE '{}'::JSONB END;
$$;
REVOKE ALL ON FUNCTION public.kq_campaign_project_state(JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_campaign_run_identity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE campaign public.kq_culture_campaigns%ROWTYPE; member JSONB;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.campaign_id IS DISTINCT FROM OLD.campaign_id OR NEW.state->'campaign' IS DISTINCT FROM OLD.state->'campaign'
   OR NEW.state->'cultivationProfile' IS DISTINCT FROM OLD.state->'cultivationProfile'
  THEN RAISE EXCEPTION 'kq_campaign_identity_immutable'; END IF;
  RETURN NEW;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||NEW.user_id::TEXT,0));
 IF NOT(NEW.state ? 'campaign') THEN
  IF NEW.campaign_id IS NOT NULL THEN RAISE EXCEPTION 'kq_campaign_invalid'; END IF;
  IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=NEW.user_id AND status='active' AND campaign_id IS NOT NULL)
   THEN RAISE EXCEPTION 'kq_campaign_active'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO campaign FROM public.kq_culture_campaigns WHERE id=(NEW.state->'campaign'->>'id')::UUID AND user_id=NEW.user_id;
 IF NOT FOUND OR NEW.state->'campaign' IS DISTINCT FROM campaign.manifest THEN RAISE EXCEPTION 'kq_campaign_invalid'; END IF;
 SELECT m INTO member FROM jsonb_array_elements(campaign.manifest->'members') m
  WHERE m->>'zoneId'=NEW.state->'warehouse'->>'zoneId' AND m->>'buddieCode'=NEW.state->>'varietyCode';
 IF member IS NULL OR member->'warehouse' IS DISTINCT FROM NEW.state->'warehouse'
  OR member->'cultivationProfile' IS DISTINCT FROM NEW.state->'cultivationProfile'
 THEN RAISE EXCEPTION 'kq_campaign_member_invalid'; END IF;
 NEW.id:=(member->>'runId')::UUID;
 NEW.campaign_id:=campaign.id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_campaign_run_identity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER aaa_kq_campaign_identity BEFORE INSERT OR UPDATE ON public.kq_runs
 FOR EACH ROW EXECUTE FUNCTION public.kq_campaign_run_identity();

CREATE FUNCTION public.kq_campaign_sync_state() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.campaign_id IS NULL OR NEW.id::TEXT IS DISTINCT FROM NEW.state->'campaign'->>'leaderRunId'
  OR NEW.status<>'active' OR NEW.state->>'phase'='complete' THEN RETURN NEW; END IF;
 UPDATE public.kq_runs r SET state=public.kq_campaign_project_state(NEW.state,r.state),updated_at=NEW.updated_at
  WHERE r.campaign_id=NEW.campaign_id AND r.id<>NEW.id AND r.status='active';
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_campaign_sync_state() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zzz_kq_campaign_sync_state AFTER UPDATE OF state ON public.kq_runs
 FOR EACH ROW EXECUTE FUNCTION public.kq_campaign_sync_state();

-- These effects belong to the common campaign, not every projected row. The
-- full original bodies (including newer commerce patches) remain in place.
DO $$ DECLARE signature TEXT; body TEXT; anchor INTEGER; guard TEXT; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.kq_guard_buddie_rotation()','public.kq_zone_reserve_deck()',
  'public.kq_award_chanvrier_career()','public.kq_commerce_completed_cycle()','public.kq_progress_event_trigger()'] LOOP
  IF to_regprocedure(signature) IS NULL THEN RAISE EXCEPTION 'campaign_trigger_missing: %',signature; END IF;
  body:=replace(pg_get_functiondef(signature::regprocedure),chr(13),''); anchor:=strpos(body,E'\nBEGIN\n');
  IF anchor=0 THEN RAISE EXCEPTION 'campaign_trigger_anchor_changed: %',signature; END IF;
  guard:=CASE WHEN signature='public.kq_guard_buddie_rotation()' THEN
    E' IF NEW.campaign_id IS NOT NULL THEN RETURN NEW; END IF;\n'
   WHEN signature='public.kq_progress_event_trigger()' THEN
    E' IF TG_TABLE_NAME=''kq_runs'' THEN\n  IF NEW.campaign_id IS NOT NULL AND NEW.id::TEXT<>NEW.state->''campaign''->>''leaderRunId'' THEN RETURN NEW; END IF;\n END IF;\n'
   ELSE E' IF NEW.campaign_id IS NOT NULL AND NEW.id::TEXT<>NEW.state->''campaign''->>''leaderRunId'' THEN RETURN NEW; END IF;\n' END;
  EXECUTE overlay(body placing E'\nBEGIN\n'||guard from anchor for 7);
 END LOOP;
 -- Welcome rescue is one common decision privilege, inherited from the leader.
 body:=pg_get_functiondef('public.kq_guard_first_culture_rescue()'::regprocedure);
 guard:='NEW.state := NEW.state - ''firstCultureRescue'';';
 IF strpos(body,guard)=0 THEN RAISE EXCEPTION 'campaign_rescue_anchor_changed'; END IF;
 EXECUTE replace(body,guard,E'IF NEW.campaign_id IS NOT NULL AND NEW.id::TEXT<>NEW.state->''campaign''->>''leaderRunId'' THEN\n NEW.state:=NEW.state-''firstCultureRescue'';\n IF EXISTS(SELECT 1 FROM public.kq_runs r WHERE r.id=(NEW.state->''campaign''->>''leaderRunId'')::UUID AND r.user_id=NEW.user_id AND r.state->''firstCultureRescue''=''true''::JSONB) THEN NEW.state:=NEW.state||''{"firstCultureRescue":true}''::JSONB; END IF;\n RETURN NEW;\n END IF;\n '||guard);
END $$;

-- The leader pays once; the existing starter still validates cards, Heritage,
-- the token wallet and career perks. Only the rare-Buddie XP aggregation changes.
DO $$ DECLARE body TEXT; anchor TEXT:='v_base_xp := 1 + p_culture_tokens;'; BEGIN
 body:=pg_get_functiondef('public.kq_start_run_with_heritage_internal(uuid,text,integer,text[],text[],jsonb,integer,text)'::regprocedure);
 body:=replace(body,'public.kq_start_run_with_heritage_internal(','public.kq_start_campaign_leader_internal(');
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'campaign_start_xp_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,E'SELECT max(CASE right(m->>''buddieCode'',3)::INTEGER WHEN 1 THEN 4 WHEN 2 THEN 3 WHEN 3 THEN 3 WHEN 4 THEN 3 ELSE CASE WHEN right(m->>''buddieCode'',3)::INTEGER BETWEEN 5 AND 9 THEN 2 WHEN right(m->>''buddieCode'',3)::INTEGER BETWEEN 10 AND 19 THEN 1 ELSE 0 END END) INTO v_buddie_xp FROM jsonb_array_elements(p_initial_state->''campaign''->''members'') m;\n '||anchor);
END $$;
REVOKE ALL ON FUNCTION public.kq_start_campaign_leader_internal(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER,TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_campaign_receipt(p_user_id UUID,p_request_key UUID,p_request JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE campaign public.kq_culture_campaigns%ROWTYPE; run public.kq_runs%ROWTYPE;
BEGIN
 SELECT * INTO campaign FROM public.kq_culture_campaigns WHERE user_id=p_user_id AND request_key=p_request_key;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF campaign.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'kq_campaign_request_mismatch'; END IF;
 SELECT * INTO STRICT run FROM public.kq_runs WHERE id=campaign.leader_run_id AND user_id=p_user_id;
 RETURN jsonb_build_object('run',to_jsonb(run),'burnReceipt',NULL,'freeSubstrate',true,'replayed',true,
  'cultureTokenBalance',COALESCE((SELECT balance FROM public.kq_culture_token_wallets WHERE user_id=p_user_id),0));
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_campaign_receipt(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_campaign_receipt(UUID,UUID,JSONB) TO service_role;

CREATE FUNCTION public.rpc_kq_start_campaign(p_user_id UUID,p_request_key UUID,p_request JSONB,p_members JSONB,
 p_culture_tokens INTEGER DEFAULT 0,p_heritage_code TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE replay JSONB; leader JSONB; campaign JSONB; member JSONB; state JSONB; result JSONB;
 layout public.kq_warehouse_layouts%ROWTYPE; leader_row public.kq_runs%ROWTYPE; definition_id UUID;
 expected_zones JSONB; requested_zones JSONB; previous_codes TEXT[]; new_codes TEXT[]; total_energy INTEGER;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'kq_campaign_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 replay:=public.rpc_kq_campaign_receipt(p_user_id,p_request_key,p_request);
 IF replay IS NOT NULL THEN RETURN replay; END IF;
 IF jsonb_typeof(p_members) IS DISTINCT FROM 'array' OR jsonb_array_length(p_members) NOT BETWEEN 1 AND 52
 THEN RAISE EXCEPTION 'kq_campaign_invalid_request'; END IF;
 SELECT m INTO leader FROM jsonb_array_elements(p_members) m ORDER BY m->'state'->'warehouse'->>'zoneId' LIMIT 1;
 state:=leader->'state'; campaign:=state->'campaign';
 IF p_request IS DISTINCT FROM jsonb_build_object('campaign',true,'buddieCode',state->'varietyCode',
  'deckCodes',state->'deckCodes','cultureTokens',p_culture_tokens,'heritageCode',p_heritage_code,
  'energyMode','balanced','expectedEnergyCents',p_request->'expectedEnergyCents')
  OR campaign->'version' IS DISTINCT FROM '1'::JSONB OR campaign->>'id' IS NULL
  OR campaign->>'leaderRunId' IS DISTINCT FROM leader->>'runId'
  OR jsonb_typeof(campaign->'members') IS DISTINCT FROM 'array'
  OR jsonb_array_length(campaign->'members')<>jsonb_array_length(p_members)
  OR state->'rulesVersion' IS DISTINCT FROM '3'::JSONB OR state->'stageIndex' IS DISTINCT FROM '0'::JSONB
  OR state->>'phase' IS DISTINCT FROM 'prepare' OR state->'history' IS DISTINCT FROM '[]'::JSONB
  OR state->'cultureDead'='true'::JSONB OR state ? 'harvestGrams'
  OR NOT public.kq_care_state_valid(state->'care')
 THEN RAISE EXCEPTION 'kq_campaign_invalid_request'; END IF;
 IF EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status='active') THEN RAISE EXCEPTION 'kq_active_run_exists'; END IF;
 SELECT * INTO layout FROM public.kq_warehouse_layouts WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'warehouse_layout_changed'; END IF;
 SELECT jsonb_agg(z->>'id' ORDER BY z->>'id') INTO expected_zones FROM jsonb_array_elements(layout.state->'zones') z
  WHERE z->'active'='true'::JSONB AND z->>'buddieCode' IS NOT NULL;
 SELECT jsonb_agg(m->'state'->'warehouse'->>'zoneId' ORDER BY m->'state'->'warehouse'->>'zoneId') INTO requested_zones
  FROM jsonb_array_elements(p_members) m;
 IF requested_zones IS DISTINCT FROM expected_zones
  OR (SELECT count(DISTINCT m->>'runId') FROM jsonb_array_elements(p_members) m)<>jsonb_array_length(p_members)
  OR (SELECT count(DISTINCT m->'state'->>'varietyCode') FROM jsonb_array_elements(p_members) m)<>jsonb_array_length(p_members)
 THEN RAISE EXCEPTION 'kq_campaign_members_changed'; END IF;
 SELECT recent_buddie_codes INTO previous_codes FROM public.kq_buddie_rotation WHERE user_id=p_user_id FOR UPDATE;
 previous_codes:=COALESCE(previous_codes,'{}');
 FOR member IN SELECT m FROM jsonb_array_elements(p_members) m ORDER BY m->'state'->'warehouse'->>'zoneId' LOOP
  IF member->'state'->'campaign' IS DISTINCT FROM campaign OR member->'state'->'warehouse'->>'version' IS DISTINCT FROM '2'
   OR member->'state' IS DISTINCT FROM public.kq_campaign_project_state(state,member->'state')
   OR member->'state'->'warehouse'->'sourceState' IS DISTINCT FROM layout.state
   OR member->'state'->'warehouse'->'revision' IS DISTINCT FROM to_jsonb(layout.revision)
   OR member->'state'->>'varietyCode' !~ '^HH2026-(00[1-9]|0[1-4][0-9]|05[0-2])$'
   OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(campaign->'members') m WHERE m=jsonb_build_object('runId',member->'runId',
    'zoneId',member->'state'->'warehouse'->'zoneId','buddieCode',member->'state'->'varietyCode',
    'warehouse',member->'state'->'warehouse','cultivationProfile',member->'state'->'cultivationProfile'))
  THEN RAISE EXCEPTION 'kq_campaign_member_invalid'; END IF;
  IF member->'state'->>'varietyCode'=ANY(previous_codes) THEN RAISE EXCEPTION 'kq_buddie_rotation_locked'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.lottery_card_instances i JOIN public.lottery_card_definitions d ON d.id=i.card_definition_id
   WHERE i.user_id=p_user_id AND d.code=member->'state'->>'varietyCode') THEN RAISE EXCEPTION 'kq_buddie_not_owned'; END IF;
  IF member->'state'->'cultivationProfile' IS DISTINCT FROM public.kq_campaign_cultivation_profile(member->'state'->>'varietyCode')
  THEN RAISE EXCEPTION 'kq_campaign_profile_invalid'; END IF;
 END LOOP;
 SELECT sum((m->'state'->'warehouse'->>'energyCostCents')::INTEGER) INTO total_energy FROM jsonb_array_elements(p_members) m;
 IF p_request->'expectedEnergyCents' IS DISTINCT FROM 'null'::JSONB AND p_request->'expectedEnergyCents' IS DISTINCT FROM to_jsonb(total_energy)
 THEN RAISE EXCEPTION 'kq_energy_quote_changed'; END IF;
 INSERT INTO public.kq_culture_campaigns(id,user_id,leader_run_id,request_key,request,manifest)
  VALUES((campaign->>'id')::UUID,p_user_id,(leader->>'runId')::UUID,p_request_key,p_request,campaign);
 result:=public.kq_start_campaign_leader_internal(p_user_id,state->>'varietyCode',(state->>'seed')::INTEGER,
  ARRAY(SELECT jsonb_array_elements_text(state->'deckCodes')),ARRAY(SELECT jsonb_array_elements_text(state->'situationCodes')),
  state,p_culture_tokens,p_heritage_code);
 SELECT * INTO STRICT leader_row FROM public.kq_runs WHERE id=(leader->>'runId')::UUID AND user_id=p_user_id;
 FOR member IN SELECT m FROM jsonb_array_elements(p_members) m WHERE m->>'runId'<>leader->>'runId'
  ORDER BY m->'state'->'warehouse'->>'zoneId' LOOP
  SELECT id INTO STRICT definition_id FROM public.lottery_card_definitions WHERE code=member->'state'->>'varietyCode';
  INSERT INTO public.kq_runs(id,user_id,buddie_card_definition_id,seed,deck_codes,scenario_codes,state,culture_tokens_spent)
   VALUES((member->>'runId')::UUID,p_user_id,definition_id,leader_row.seed,leader_row.deck_codes,leader_row.scenario_codes,
    public.kq_campaign_project_state(leader_row.state,member->'state'),0);
 END LOOP;
 -- Validate against the pre-start queue, then advance once in deterministic
 -- zone order. A failed member leaves neither the queue nor charges behind.
 SELECT array_agg(m->'state'->>'varietyCode' ORDER BY m->'state'->'warehouse'->>'zoneId' DESC) INTO new_codes
  FROM jsonb_array_elements(p_members) m;
 INSERT INTO public.kq_buddie_rotation(user_id,recent_buddie_codes) VALUES(p_user_id,(new_codes||previous_codes)[1:5])
  ON CONFLICT(user_id) DO UPDATE SET recent_buddie_codes=EXCLUDED.recent_buddie_codes,updated_at=now();
 RETURN result||jsonb_build_object('replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_start_campaign(UUID,UUID,JSONB,JSONB,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_start_campaign(UUID,UUID,JSONB,JSONB,INTEGER,TEXT) TO service_role;

-- Private copies allow the atomic campaign finalizer to reuse every existing
-- flower, energy, supplier, calendar and capacity check without a status/GUC bypass.
ALTER FUNCTION public.rpc_kq_update_run_state(UUID,UUID,TIMESTAMPTZ,TEXT,JSONB,JSONB) RENAME TO kq_update_run_before_campaign;
REVOKE ALL ON FUNCTION public.kq_update_run_before_campaign(UUID,UUID,TIMESTAMPTZ,TEXT,JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.rpc_kq_update_run_state(p_user_id UUID,p_run_id UUID,p_expected_updated_at TIMESTAMPTZ,p_action TEXT,p_next_state JSONB,p_flower JSONB DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.kq_runs WHERE id=p_run_id AND user_id=p_user_id AND campaign_id IS NOT NULL)
 THEN RAISE EXCEPTION 'kq_campaign_action_required'; END IF;
 RETURN public.kq_update_run_before_campaign(p_user_id,p_run_id,p_expected_updated_at,p_action,p_next_state,p_flower);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_update_run_state(UUID,UUID,TIMESTAMPTZ,TEXT,JSONB,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_update_run_state(UUID,UUID,TIMESTAMPTZ,TEXT,JSONB,JSONB) TO service_role;

CREATE FUNCTION public.kq_campaign_assert_leader(p_user UUID,p_run UUID,p_state JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.kq_runs%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 SELECT * INTO r FROM public.kq_runs WHERE id=p_run AND user_id=p_user FOR UPDATE;
 IF r.campaign_id IS NOT NULL AND (r.id::TEXT IS DISTINCT FROM r.state->'campaign'->>'leaderRunId'
   OR p_state->>'phase'='complete') THEN RAISE EXCEPTION 'kq_campaign_action_required'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.kq_campaign_assert_leader(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE signature TEXT; body TEXT; anchor INTEGER; BEGIN
 FOREACH signature IN ARRAY ARRAY[
  'public.rpc_kq_play_support_card(uuid,uuid,text,smallint,text,timestamptz,jsonb)',
  'public.rpc_kq_apply_care(uuid,uuid,text,uuid,timestamptz,jsonb,integer)',
  'public.rpc_kq_swap_heritage_hand(uuid,uuid,timestamptz,jsonb)'] LOOP
  body:=replace(pg_get_functiondef(signature::regprocedure),chr(13),''); anchor:=strpos(body,E'\nBEGIN\n');
  IF anchor=0 THEN RAISE EXCEPTION 'campaign_action_anchor_changed: %',signature; END IF;
  IF signature<>'public.rpc_kq_apply_care(uuid,uuid,text,uuid,timestamptz,jsonb,integer)' THEN
   IF strpos(body,'updated_at = now()')=0 THEN RAISE EXCEPTION 'campaign_action_clock_anchor_changed: %',signature; END IF;
   body:=replace(body,'updated_at = now()','updated_at = GREATEST(clock_timestamp(),v_run.updated_at+interval ''1 microsecond'')');
  END IF;
  EXECUTE overlay(body placing E'\nBEGIN\n PERFORM public.kq_campaign_assert_leader(p_user_id,p_run_id,p_next_state);\n' from anchor for 7);
 END LOOP;
 -- Old launch endpoints cannot smuggle an existing/new campaign manifest.
 FOREACH signature IN ARRAY ARRAY['public.rpc_kq_start_run(uuid,text,integer,text[],text[],jsonb,integer)',
  'public.rpc_kq_start_run_with_heritage(uuid,text,integer,text[],text[],jsonb,integer,text)',
  'public.rpc_kq_start_zone_run(uuid,text,uuid,jsonb,text,integer,text[],text[],jsonb,integer,text)'] LOOP
  body:=replace(pg_get_functiondef(signature::regprocedure),chr(13),''); anchor:=strpos(body,E'\nBEGIN\n');
  IF anchor=0 THEN RAISE EXCEPTION 'campaign_legacy_start_anchor_changed'; END IF;
  EXECUTE overlay(body placing E'\nBEGIN\n IF p_initial_state ? ''campaign'' THEN RAISE EXCEPTION ''kq_campaign_request_required''; END IF;\n' from anchor for 7);
 END LOOP;
END $$;

CREATE FUNCTION public.rpc_kq_update_campaign_state(p_user_id UUID,p_run_id UUID,p_expected_updated_at TIMESTAMPTZ,
 p_action TEXT,p_next_state JSONB,p_members JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE leader public.kq_runs%ROWTYPE; run public.kq_runs%ROWTYPE; receipt public.kq_campaign_action_receipts%ROWTYPE;
 member JSONB; projected JSONB; result JSONB; leader_result JSONB; flowers JSONB:='[]'; terminal BOOLEAN;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 SELECT * INTO leader FROM public.kq_runs WHERE id=p_run_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR leader.campaign_id IS NULL OR leader.id::TEXT IS DISTINCT FROM leader.state->'campaign'->>'leaderRunId'
 THEN RAISE EXCEPTION 'kq_campaign_unavailable'; END IF;
 SELECT * INTO receipt FROM public.kq_campaign_action_receipts WHERE campaign_id=leader.campaign_id AND expected_updated_at=p_expected_updated_at;
 IF FOUND THEN
  IF receipt.action IS DISTINCT FROM p_action OR receipt.next_state IS DISTINCT FROM p_next_state OR receipt.members IS DISTINCT FROM p_members
   THEN RAISE EXCEPTION 'kq_stale_run'; END IF;
  RETURN receipt.result||jsonb_build_object('replayed',true,'state',leader.state,'updatedAt',leader.updated_at,
   'flower',(SELECT to_jsonb(f) FROM public.kq_flowers f WHERE f.run_id=leader.id),
   'flowers',COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.run_id) FROM public.kq_flowers f
     JOIN public.kq_runs r ON r.id=f.run_id WHERE r.campaign_id=leader.campaign_id),'[]'::JSONB));
 END IF;
 IF leader.status<>'active' THEN RAISE EXCEPTION 'kq_run_unavailable'; END IF;
 IF leader.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'kq_stale_run'; END IF;
 IF p_action NOT IN ('roll','resolve','advance','redraw','heritage') OR p_next_state IS NULL
  OR jsonb_typeof(p_members) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_members)<>(SELECT count(*) FROM public.kq_runs WHERE campaign_id=leader.campaign_id)
  OR (SELECT count(DISTINCT m->>'runId') FROM jsonb_array_elements(p_members) m)<>jsonb_array_length(p_members)
 THEN RAISE EXCEPTION 'kq_campaign_members_changed'; END IF;
 terminal:=p_next_state->>'phase'='complete';
 FOR run IN SELECT * FROM public.kq_runs WHERE campaign_id=leader.campaign_id ORDER BY id FOR UPDATE LOOP
  SELECT m INTO member FROM jsonb_array_elements(p_members) m WHERE m->>'runId'=run.id::TEXT;
  projected:=public.kq_campaign_project_state(p_next_state,run.state);
  IF member IS NULL OR run.user_id<>p_user_id OR run.status<>'active'
   OR ((member->'state')-'harvestGrams') IS DISTINCT FROM (projected-'harvestGrams')
   OR (NOT terminal AND member->'state' IS DISTINCT FROM projected)
   OR (run.id=leader.id AND member->'state' IS DISTINCT FROM p_next_state)
  THEN RAISE EXCEPTION 'kq_campaign_member_invalid'; END IF;
  IF terminal AND p_next_state->'cultureDead' IS DISTINCT FROM 'true'::JSONB THEN
   IF member->'flower'->'cultivationProfile' IS DISTINCT FROM run.state->'cultivationProfile'
    OR member->'flower'->'terpeneReport' IS DISTINCT FROM jsonb_build_object(
      'potentialPercent',run.state->'cultivationProfile'->'terpenePotentialPercent',
      'totalPercent',round((run.state->'cultivationProfile'->>'terpenePotentialPercent')::NUMERIC
        *round((member->'state'->'care'->>'terpenes')::NUMERIC)/99,4),
      'score',round((member->'state'->'care'->>'terpenes')::NUMERIC),
      'notes',run.state->'cultivationProfile'->'terpeneNotes','simulated',true)
    OR member->'flower'->'cannabinoidReport'->'profile'->'targets' IS DISTINCT FROM run.state->'cultivationProfile'->'cannabinoidTargets'
    OR jsonb_typeof(member->'state'->'harvestGrams') IS DISTINCT FROM 'number'
    OR (member->'state'->>'harvestGrams')::NUMERIC NOT BETWEEN 0 AND
      round((run.state->'warehouse'->>'estimatedHarvestGrams')::NUMERIC*(run.state->'cultivationProfile'->>'yieldFactor')::NUMERIC,1)
   THEN RAISE EXCEPTION 'kq_campaign_flower_invalid'; END IF;
  ELSIF member->'flower' IS DISTINCT FROM 'null'::JSONB THEN RAISE EXCEPTION 'kq_flower_before_completion'; END IF;
 END LOOP;
 IF NOT terminal THEN
  leader_result:=public.kq_update_run_before_campaign(p_user_id,p_run_id,p_expected_updated_at,p_action,p_next_state,NULL);
 ELSE
  FOR run IN SELECT * FROM public.kq_runs WHERE campaign_id=leader.campaign_id ORDER BY (id=leader.id),id LOOP
   SELECT m INTO member FROM jsonb_array_elements(p_members) m WHERE m->>'runId'=run.id::TEXT;
   result:=public.kq_update_run_before_campaign(p_user_id,run.id,run.updated_at,p_action,member->'state',NULLIF(member->'flower','null'::JSONB));
   IF result->'flower' IS DISTINCT FROM 'null'::JSONB THEN
    UPDATE public.kq_flowers SET cultivation_profile=member->'flower'->'cultivationProfile',terpene_report=member->'flower'->'terpeneReport'
     WHERE run_id=run.id RETURNING to_jsonb(kq_flowers) INTO member;
    result:=jsonb_set(result,'{flower}',member); flowers:=flowers||jsonb_build_array(member);
   END IF;
   IF run.id=leader.id THEN leader_result:=result; END IF;
  END LOOP;
 END IF;
 SELECT leader_result||jsonb_build_object('flowers',flowers,'replayed',false,'updatedAt',updated_at) INTO result FROM public.kq_runs WHERE id=leader.id;
 INSERT INTO public.kq_campaign_action_receipts(campaign_id,expected_updated_at,action,next_state,members,result)
  VALUES(leader.campaign_id,p_expected_updated_at,p_action,p_next_state,p_members,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_update_campaign_state(UUID,UUID,TIMESTAMPTZ,TEXT,JSONB,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_update_campaign_state(UUID,UUID,TIMESTAMPTZ,TEXT,JSONB,JSONB) TO service_role;

DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 body:=pg_get_functiondef('public.kq_warehouse_snapshot(uuid)'::regprocedure);
 anchor:='''runId'',r.id,''zoneId'',r.warehouse_zone_id';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'campaign_warehouse_snapshot_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,anchor||',''campaignId'',r.campaign_id,''leaderRunId'',r.state->''campaign''->>''leaderRunId''');
 body:=pg_get_functiondef('public.rpc_kq_player_core_snapshot(uuid)'::regprocedure);
 anchor:='AND r.status = ''active''';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'campaign_core_active_anchor_changed'; END IF;
 body:=replace(body,anchor,anchor||' AND (r.campaign_id IS NULL OR r.id::TEXT=r.state->''campaign''->>''leaderRunId'')');
 anchor:='''cannabinoidReport'', flower.cannabinoid_report,';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'campaign_core_snapshot_anchor_changed'; END IF;
 EXECUTE replace(body,anchor,anchor||' ''cultivationProfile'', flower.cultivation_profile, ''terpeneReport'', flower.terpene_report,');
END $$;

COMMIT;
