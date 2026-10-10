BEGIN;

-- Fictional game installations cover the shared warehouse, without container
-- capacity management. Sixty game days are ten real days (4h/game day).
CREATE FUNCTION public.kq_storage_method(p_code TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE p_code
 WHEN 'STORAGE-GLASS' THEN '{"priceCents":0,"aromaRate":100,"chemistryRate":100}'::JSONB
 WHEN 'STORAGE-GROVE' THEN '{"priceCents":2500,"aromaRate":75,"chemistryRate":80}'::JSONB
 WHEN 'STORAGE-BOVEDA' THEN '{"priceCents":4500,"aromaRate":60,"chemistryRate":65}'::JSONB
 WHEN 'STORAGE-CVAULT' THEN '{"priceCents":12000,"aromaRate":45,"chemistryRate":50}'::JSONB
 WHEN 'STORAGE-CANNATROL' THEN '{"priceCents":180000,"aromaRate":25,"chemistryRate":30}'::JSONB END
$$;
REVOKE ALL ON FUNCTION public.kq_storage_method(TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.kq_storage_accounts (
 user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 owned_method_codes TEXT[] NOT NULL DEFAULT ARRAY['STORAGE-GLASS'],
 default_method_code TEXT NOT NULL DEFAULT 'STORAGE-GLASS',
 CHECK(default_method_code=ANY(owned_method_codes)),
 CHECK(owned_method_codes <@ ARRAY['STORAGE-GLASS','STORAGE-GROVE','STORAGE-BOVEDA','STORAGE-CVAULT','STORAGE-CANNATROL'])
);
CREATE TABLE public.kq_storage_lots (
 flower_id UUID PRIMARY KEY REFERENCES public.kq_flowers(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 state JSONB NOT NULL CHECK(state->'version'='1'::JSONB AND state->>'flowerId'=flower_id::TEXT),
 revision BIGINT NOT NULL DEFAULT 1 CHECK(revision>0)
);
CREATE INDEX kq_storage_lots_owner ON public.kq_storage_lots(user_id,flower_id);
CREATE TABLE public.kq_storage_requests (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_key UUID NOT NULL,
 payload JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_key)
);
ALTER TABLE public.kq_storage_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_storage_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_storage_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_storage_accounts FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON TABLE public.kq_storage_lots FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON TABLE public.kq_storage_requests FROM PUBLIC,anon,authenticated,service_role;

-- Both SQL and the pure TypeScript model accumulate weighted elapsed exposure.
-- Changing containers settles the OLD method at the exact server timestamp;
-- neither an upgrade nor repeated switches can remove exposure already earned.
CREATE FUNCTION public.kq_storage_settle(p_state JSONB,p_until TIMESTAMPTZ) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE elapsed NUMERIC; method JSONB;
BEGIN
 elapsed:=GREATEST(0,EXTRACT(EPOCH FROM(p_until-(p_state->>'lastSettledAt')::TIMESTAMPTZ))*1000);
 method:=public.kq_storage_method(p_state->>'methodCode');
 IF method IS NULL THEN RAISE EXCEPTION 'storage_invalid_method'; END IF;
 RETURN p_state||jsonb_build_object('lastSettledAt',GREATEST(p_until,(p_state->>'lastSettledAt')::TIMESTAMPTZ),
  'exposure',jsonb_build_object(
   'aromaWeightedMs',(p_state->'exposure'->>'aromaWeightedMs')::NUMERIC+elapsed*(method->>'aromaRate')::INTEGER,
   'chemistryWeightedMs',(p_state->'exposure'->>'chemistryWeightedMs')::NUMERIC+elapsed*(method->>'chemistryRate')::INTEGER));
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_settle(JSONB,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_storage_condition(p_state JSONB,p_jury NUMERIC,p_now TIMESTAMPTZ) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE start_at TIMESTAMPTZ:=(p_state->>'curingStartedAt')::TIMESTAMPTZ;
 last_at TIMESTAMPTZ:=(p_state->>'lastSettledAt')::TIMESTAMPTZ;
 ready_at TIMESTAMPTZ:=(p_state->>'readyAt')::TIMESTAMPTZ;
 eval_at TIMESTAMPTZ; next_at TIMESTAMPTZ; settled JSONB; aroma_loss NUMERIC; chemistry_loss NUMERIC; loss NUMERIC;
BEGIN
 eval_at:=GREATEST(last_at,start_at+floor(GREATEST(0,EXTRACT(EPOCH FROM(GREATEST(p_now,last_at)-start_at)))/14400)*interval '4 hours');
 settled:=public.kq_storage_settle(p_state,eval_at);
 aroma_loss:=LEAST(40,floor((settled->'exposure'->>'aromaWeightedMs')::NUMERIC/(15*14400000::NUMERIC*100)));
 chemistry_loss:=LEAST(64,floor((settled->'exposure'->>'chemistryWeightedMs')::NUMERIC/(60*14400000::NUMERIC*100)));
 loss:=round((LEAST(aroma_loss,GREATEST(0,(p_state->'baseline'->>'aroma')::NUMERIC-35))+
  LEAST(chemistry_loss,GREATEST(0,(p_state->'baseline'->'care'->>'cannabinoidExpression')::NUMERIC-35)))/25,2);
 next_at:=start_at+(floor(GREATEST(0,EXTRACT(EPOCH FROM(GREATEST(p_now,last_at)-start_at)))/14400)+1)*interval '4 hours';
 IF ready_at>p_now THEN next_at:=LEAST(next_at,ready_at); END IF;
 RETURN jsonb_build_object('conditionScore',GREATEST(0,round(p_jury-loss,2)),'qualityDelta',-loss,
  'readyAt',ready_at,'nextChangeAt',next_at,'stage',CASE WHEN p_now>=ready_at THEN 'ready' ELSE 'curing' END);
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_condition(JSONB,NUMERIC,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_storage_create_lot(p_flower UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.kq_flowers%ROWTYPE; run public.kq_runs%ROWTYPE; method TEXT; anchor TIMESTAMPTZ; harvest TIMESTAMPTZ;
 care JSONB; score NUMERIC; aroma NUMERIC;
BEGIN
 SELECT * INTO f FROM public.kq_flowers WHERE id=p_flower;
 IF NOT FOUND OR f.status::TEXT<>'burned' OR f.burned_at IS NULL THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.kq_storage_lots WHERE flower_id=f.id) THEN RETURN; END IF;
 SELECT * INTO run FROM public.kq_runs WHERE id=f.run_id;
 INSERT INTO public.kq_storage_accounts(user_id) VALUES(f.owner_id) ON CONFLICT DO NOTHING;
 SELECT default_method_code INTO method FROM public.kq_storage_accounts WHERE user_id=f.owner_id;
 anchor:=date_trunc('milliseconds',f.burned_at);
 harvest:=date_trunc('milliseconds',COALESCE(run.completed_at,f.created_at,anchor));
 care:=COALESCE(run.state->'care','{}'::JSONB);
 aroma:=GREATEST(35,LEAST(99,COALESCE((f.battle_stats->>'aroma')::NUMERIC,55)));
 SELECT round(COALESCE(avg(value::NUMERIC)/10,5.5),1) INTO score FROM jsonb_each_text(COALESCE(f.battle_stats,'{}'))
  WHERE key IN ('appearance','aroma','vigor','mastery','regularity','cannabinoids');
 INSERT INTO public.kq_storage_lots(flower_id,user_id,state) VALUES(f.id,f.owner_id,jsonb_build_object(
  'version',1,'flowerId',f.id,'harvestedAt',harvest,'curingStartedAt',anchor,'readyAt',anchor+interval '240 hours',
  'lastSettledAt',anchor,'methodCode',method,'exposure',jsonb_build_object('aromaWeightedMs',0,'chemistryWeightedMs',0),
  'baseline',jsonb_build_object('varietyCode',f.variety_code,'juryScore',score,'aroma',aroma,'care',jsonb_build_object(
   'terpenes',COALESCE((care->>'terpenes')::INTEGER,aroma::INTEGER),
   'cannabinoidExpression',COALESCE((care->>'cannabinoidExpression')::INTEGER,55),
   'cannabinoidConversion',COALESCE((care->>'cannabinoidConversion')::INTEGER,5),
   'cannabinoidOxidation',COALESCE((care->>'cannabinoidOxidation')::INTEGER,0))))) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_create_lot(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_storage_after_verdict() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.kq_storage_create_lot(NEW.id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_after_verdict() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER kq_storage_after_verdict AFTER INSERT OR UPDATE OF status,burned_at ON public.kq_flowers
 FOR EACH ROW WHEN(NEW.status::TEXT='burned' AND NEW.burned_at IS NOT NULL) EXECUTE FUNCTION public.kq_storage_after_verdict();
-- Historical verdict timestamps remain authoritative; deploying is not a reset.
DO $$ DECLARE flower UUID; BEGIN
 FOR flower IN SELECT id FROM public.kq_flowers WHERE status::TEXT='burned' AND burned_at IS NOT NULL LOOP
  PERFORM public.kq_storage_create_lot(flower);
 END LOOP;
END $$;

-- The verdict may be written after the flower trigger in the same transaction.
-- Read its final rounds here, before the first market-lot preparation exists.
CREATE FUNCTION public.kq_storage_verdict_score(p_flower UUID) RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE rounds JSONB; score_key TEXT;
BEGIN
 SELECT b.rounds,CASE WHEN b.flower_one_id=p_flower THEN 'playerScore' ELSE 'opponentScore' END INTO rounds,score_key
  FROM public.kq_battles b WHERE b.status::TEXT='verdict' AND (b.flower_one_id=p_flower OR b.flower_two_id=p_flower)
  ORDER BY b.verdict_at DESC LIMIT 1;
 IF NOT FOUND THEN
  SELECT b.rounds,'playerScore' INTO rounds,score_key FROM public.kq_bot_battles b WHERE b.flower_id=p_flower ORDER BY b.verdict_at DESC LIMIT 1;
 END IF;
 RETURN (SELECT CASE WHEN count(*)=0 THEN NULL ELSE round(GREATEST(0,LEAST(10,avg((entry->>score_key)::NUMERIC)/10)),1) END
  FROM jsonb_array_elements(COALESCE(rounds,'[]'::JSONB)) entry WHERE jsonb_typeof(entry->score_key)='number');
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_verdict_score(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_storage_state(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_storage_accounts%ROWTYPE; cash INTEGER;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'storage_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM public.kq_business_settle(p_user_id);
 INSERT INTO public.kq_storage_accounts(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM public.kq_storage_accounts WHERE user_id=p_user_id;
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
 RETURN jsonb_build_object('serverNow',now(),'cashCents',cash,'ownedMethodCodes',a.owned_method_codes,
  'defaultMethodCode',a.default_method_code,'lots',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'flowerId',s.flower_id,'varietyName',f.variety_name,'flowerStatus',f.status,'harvestGrams',COALESCE((r.state->>'harvestGrams')::NUMERIC,m.harvest_grams,0),
   'state',s.state,'revision',s.revision,'juryScore',COALESCE(m.jury_score,public.kq_storage_verdict_score(s.flower_id)),'marketStatus',m.status) ORDER BY f.burned_at DESC,s.flower_id)
   FROM public.kq_storage_lots s JOIN public.kq_flowers f ON f.id=s.flower_id LEFT JOIN public.kq_runs r ON r.id=f.run_id
   LEFT JOIN public.kq_market_lots m ON m.flower_id=s.flower_id
   WHERE s.user_id=p_user_id),'[]'::JSONB));
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_storage_state(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_storage_state(UUID) TO service_role;

CREATE FUNCTION public.rpc_kq_storage_command(p_user_id UUID,p_action TEXT,p_method_code TEXT,p_flower_id UUID,p_request_key UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_storage_accounts%ROWTYPE; lot public.kq_storage_lots%ROWTYPE; old JSONB; payload JSONB; price INTEGER; cash INTEGER;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR p_action IS NULL OR p_action NOT IN ('buy','select-default','assign')
  OR public.kq_storage_method(p_method_code) IS NULL OR (p_action='assign') IS DISTINCT FROM(p_flower_id IS NOT NULL) THEN RAISE EXCEPTION 'storage_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 PERFORM public.kq_business_settle(p_user_id);
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 INSERT INTO public.kq_storage_accounts(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM public.kq_storage_accounts WHERE user_id=p_user_id FOR UPDATE;
 payload:=jsonb_build_object('action',p_action,'methodCode',p_method_code,'flowerId',p_flower_id);
 SELECT r.payload INTO old FROM public.kq_storage_requests r WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF old IS DISTINCT FROM payload THEN RAISE EXCEPTION 'storage_request_mismatch'; END IF;
  RETURN public.rpc_kq_storage_state(p_user_id)||jsonb_build_object('replayed',true);
 END IF;
 IF p_action='buy' THEN
  IF p_method_code=ANY(a.owned_method_codes) THEN RAISE EXCEPTION 'storage_already_owned'; END IF;
  price:=(public.kq_storage_method(p_method_code)->>'priceCents')::INTEGER;
  IF cash<price THEN RAISE EXCEPTION 'storage_insufficient_cash'; END IF;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-price,updated_at=now() WHERE user_id=p_user_id;
  UPDATE public.kq_storage_accounts SET owned_method_codes=array_append(owned_method_codes,p_method_code) WHERE user_id=p_user_id;
 ELSE
  IF NOT p_method_code=ANY(a.owned_method_codes) THEN RAISE EXCEPTION 'storage_not_owned'; END IF;
  IF p_action='select-default' THEN
   UPDATE public.kq_storage_accounts SET default_method_code=p_method_code WHERE user_id=p_user_id;
  ELSE
   SELECT * INTO lot FROM public.kq_storage_lots WHERE flower_id=p_flower_id AND user_id=p_user_id FOR UPDATE;
   IF NOT FOUND OR EXISTS(SELECT 1 FROM public.kq_market_lots WHERE flower_id=p_flower_id AND status='sold') THEN RAISE EXCEPTION 'storage_lot_unavailable'; END IF;
   IF lot.state->>'methodCode' IS DISTINCT FROM p_method_code THEN
    UPDATE public.kq_storage_lots SET state=public.kq_storage_settle(lot.state,date_trunc('milliseconds',now()))||jsonb_build_object('methodCode',p_method_code),revision=revision+1 WHERE flower_id=p_flower_id;
   END IF;
  END IF;
 END IF;
 INSERT INTO public.kq_storage_requests(user_id,request_key,payload) VALUES(p_user_id,p_request_key,payload);
 RETURN public.rpc_kq_storage_state(p_user_id)||jsonb_build_object('replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_storage_command(UUID,TEXT,TEXT,UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_storage_command(UUID,TEXT,TEXT,UUID,UUID) TO service_role;

ALTER TABLE public.kq_commerce_quotes ADD COLUMN storage_revision BIGINT;
-- Server-only quote inputs; no client can author the storage revision or TTL.
CREATE FUNCTION public.kq_storage_check_offer(p_user UUID,p_flower UUID,p_jury NUMERIC,p_revision BIGINT,p_deadline TIMESTAMPTZ,p_channel TEXT) RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lot public.kq_storage_lots%ROWTYPE; condition JSONB;
BEGIN
 SELECT * INTO lot FROM public.kq_storage_lots WHERE flower_id=p_flower AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR p_revision IS DISTINCT FROM lot.revision OR p_deadline IS NULL OR p_deadline<=now() THEN RAISE EXCEPTION 'commerce_storage_changed'; END IF;
 condition:=public.kq_storage_condition(lot.state,p_jury,now());
 IF p_channel IS NOT NULL AND p_channel<>'wholesale' AND now()<(lot.state->>'readyAt')::TIMESTAMPTZ THEN RAISE EXCEPTION 'commerce_curing_required'; END IF;
 RETURN (condition->>'conditionScore')::NUMERIC;
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_check_offer(UUID,UUID,NUMERIC,BIGINT,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon,authenticated,service_role;

-- Patch only narrow, asserted anchors in the live definitions. All existing
-- wallet, demand, fiscal, partial-sale and idempotency protections survive.
DO $$ DECLARE definition TEXT; fragment TEXT; BEGIN
 definition:=pg_get_functiondef('public.rpc_kq_commerce_state(uuid)'::regprocedure);
 fragment:='''juryScore'',l.jury_score,';
 IF position(fragment IN definition)=0 THEN RAISE EXCEPTION 'storage_commerce_state_anchor_missing'; END IF;
 definition:=replace(definition,fragment,fragment||'''storageState'',(SELECT state FROM public.kq_storage_lots WHERE flower_id=s.flower_id),''storageRevision'',(SELECT revision FROM public.kq_storage_lots WHERE flower_id=s.flower_id),');
 EXECUTE definition;
 definition:=pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure);
 fragment:='l public.kq_market_lots%ROWTYPE;';
 IF position(fragment IN definition)=0 THEN RAISE EXCEPTION 'storage_command_variable_anchor_missing'; END IF;
 definition:=replace(definition,fragment,'storage_jury_score NUMERIC; '||fragment);
 -- A NUMERIC(3,1) row field would round the live condition score too early.
 definition:=replace(definition,'l.jury_score','storage_jury_score');
 fragment:='SELECT value INTO opt FROM jsonb_array_elements(l.options) WHERE value->>''route''=route_code;';
 IF position(fragment IN definition)=0 THEN RAISE EXCEPTION 'storage_prepare_anchor_missing'; END IF;
 definition:=replace(definition,fragment,fragment||E'\n  storage_jury_score:=public.kq_storage_check_offer(p_user_id,fid,l.jury_score,(opt->>''storageRevision'')::BIGINT,(opt->>''storageChangeAt'')::TIMESTAMPTZ,NULL);');
 fragment:='offer:=q.offer; units:=(offer->>''units'')::INTEGER; channel:=offer->>''channel''; payout:=(offer->>''payoutCents'')::INTEGER;';
 IF position(fragment IN definition)=0 THEN RAISE EXCEPTION 'storage_sell_anchor_missing'; END IF;
 definition:=replace(definition,fragment,fragment||E'\n  storage_jury_score:=public.kq_storage_check_offer(p_user_id,s.flower_id,l.jury_score,q.storage_revision,q.expires_at,channel);');
 EXECUTE definition;
END $$;

COMMIT;
