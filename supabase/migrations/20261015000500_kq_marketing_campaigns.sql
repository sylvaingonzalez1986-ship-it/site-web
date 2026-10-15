BEGIN;

-- Campaigns launched before this migration keep their original catalog and
-- completion rules. New campaigns freeze their paid, targeted terms at launch.
CREATE FUNCTION public.kq_online_marketing_v2_catalog(p_code TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE p_code
 WHEN 'introduction' THEN jsonb_build_object('preparationHours',0,'durationHours',24,'visitorMultiplier',1,'followersPerOrder',5,'goalOrders',3,'followersCap',15,'cooldownHours',0,'minimumOrders',0,'once',true)
 WHEN 'harvest' THEN jsonb_build_object('preparationHours',4,'durationHours',48,'visitorMultiplier',1.25,'followersPerOrder',4,'goalOrders',5,'followersCap',20,'cooldownHours',72,'minimumOrders',0,'once',false)
 WHEN 'behind-scenes' THEN jsonb_build_object('preparationHours',12,'durationHours',48,'visitorMultiplier',0.75,'followersPerOrder',10,'goalOrders',3,'followersCap',30,'cooldownHours',168,'minimumOrders',0,'once',false)
 WHEN 'feedback' THEN jsonb_build_object('preparationHours',4,'durationHours',48,'visitorMultiplier',0.5,'followersPerOrder',10,'goalOrders',4,'followersCap',40,'cooldownHours',168,'minimumOrders',5,'once',false)
 ELSE NULL END;
$$;

CREATE FUNCTION public.kq_online_marketing_budget(p_code TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE p_code
 WHEN 'local' THEN jsonb_build_object('costCents',3000,'visitorsPerDay',75)
 WHEN 'regional' THEN jsonb_build_object('costCents',8000,'visitorsPerDay',160)
 WHEN 'national' THEN jsonb_build_object('costCents',18000,'visitorsPerDay',280)
 ELSE NULL END;
$$;

CREATE FUNCTION public.kq_online_marketing_plan(p_user UUID,p_payload JSONB,p_at TIMESTAMPTZ) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.kq_online_accounts%ROWTYPE; a public.kq_commerce_accounts%ROWTYPE;
 l public.kq_online_listings%ROWTYPE; s public.kq_commerce_stock%ROWTYPE; lot public.kq_storage_lots%ROWTYPE;
 spec JSONB; budget JSONB; code TEXT:=p_payload->>'code'; angle TEXT:=p_payload->>'angle'; budget_code TEXT:=p_payload->>'budgetCode';
 listing UUID; source_flower UUID; label TEXT; cost INTEGER; visitors NUMERIC; launches TIMESTAMPTZ;
BEGIN
 IF p_payload->'version' IS DISTINCT FROM '2'::JSONB THEN RAISE EXCEPTION 'online_marketing_version'; END IF;
 spec:=public.kq_online_marketing_v2_catalog(code); budget:=public.kq_online_marketing_budget(budget_code);
 IF spec IS NULL OR budget IS NULL OR angle IS NULL OR angle NOT IN ('value','craft','premium') THEN RAISE EXCEPTION 'online_marketing_unknown'; END IF;
 IF code='introduction' AND budget_code<>'local' THEN RAISE EXCEPTION 'online_marketing_unknown'; END IF;
 BEGIN listing:=(p_payload->>'listingId')::UUID;
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'online_invalid_request'; END;
 IF listing IS NULL THEN RAISE EXCEPTION 'online_invalid_request'; END IF;
 SELECT * INTO o FROM public.kq_online_accounts WHERE user_id=p_user;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user;
 IF NOT a.computer_owned OR a.shop_created_at IS NULL OR o.site_tier='none'
  OR (o.site_tier<>'basic' AND (a.shop_suspended OR a.shop_paid_until IS NULL OR a.shop_paid_until<=p_at)) THEN RAISE EXCEPTION 'online_site_required'; END IF;
 IF o.marketing IS NOT NULL THEN RAISE EXCEPTION 'online_marketing_active'; END IF;
 IF o.total_packets<(spec->>'minimumOrders')::INTEGER OR EXISTS(
  SELECT 1 FROM jsonb_array_elements(o.marketing_history) e WHERE e->>'code'=code
   AND ((spec->>'once')::BOOLEAN OR (e->>'startedAt')::TIMESTAMPTZ
    +COALESCE(e->>'cooldownHours',spec->>'cooldownHours')::INTEGER*interval '1 hour'>p_at)
 ) THEN RAISE EXCEPTION 'online_progression_required'; END IF;
 SELECT * INTO l FROM public.kq_online_listings WHERE id=listing AND user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'online_listing_unknown'; END IF;
 IF l.status<>'active' OR l.remaining_packets<=0 OR public.kq_online_quality(l,p_at)<5.8 THEN RAISE EXCEPTION 'online_listing_inactive'; END IF;
 SELECT * INTO s FROM public.kq_commerce_stock WHERE id=l.stock_id AND user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'online_stock_unavailable'; END IF;
 SELECT variety_name INTO label FROM public.kq_flowers WHERE id=s.flower_id;
 IF code='harvest' THEN
  SELECT * INTO lot FROM public.kq_storage_lots WHERE flower_id=s.flower_id;
  IF lot.flower_id IS NULL OR (lot.state->>'readyAt') IS NULL OR p_at<(lot.state->>'readyAt')::TIMESTAMPTZ THEN RAISE EXCEPTION 'online_storage_not_ready'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(o.marketing_history) e WHERE e->>'flowerId'=s.flower_id::TEXT) THEN RAISE EXCEPTION 'online_progression_required'; END IF;
  source_flower:=s.flower_id;
 END IF;
 cost:=CASE WHEN code='introduction' THEN 0 ELSE (budget->>'costCents')::INTEGER END;
 visitors:=CASE WHEN code='introduction' THEN 35 ELSE (budget->>'visitorsPerDay')::NUMERIC*(spec->>'visitorMultiplier')::NUMERIC END;
 launches:=p_at+(spec->>'preparationHours')::INTEGER*interval '1 hour';
 RETURN jsonb_build_object('version',2,'id',gen_random_uuid(),'code',code,'angle',angle,'listingId',l.id,'listingName',label,
  'stockId',s.id,'flowerId',source_flower,'budgetCode',budget_code,'costCents',cost,'visitorsPerDay',visitors,
  'followersPerOrder',(spec->>'followersPerOrder')::INTEGER,'goalOrders',(spec->>'goalOrders')::INTEGER,
  'followersCap',(spec->>'followersCap')::INTEGER,'cooldownHours',(spec->>'cooldownHours')::INTEGER,
  'startedAt',p_at,'launchesAt',launches,'endsAt',launches+(spec->>'durationHours')::INTEGER*interval '1 hour');
END $$;

-- These are observed sales of the targeted listing during diffusion, not an
-- assertion that advertising caused every order. Preparation earns no reward.
CREATE FUNCTION public.kq_online_marketing_results(p_user UUID,p_campaign JSONB,p_at TIMESTAMPTZ) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('orders',count(*),'satisfiedOrders',count(*) FILTER (WHERE satisfaction_score>=75),
  'revenueCents',COALESCE(sum(payout_cents),0),'netRevenueCents',COALESCE(sum(net_payout_cents),0),
  'followersEarned',LEAST((p_campaign->>'followersCap')::INTEGER,
   count(*) FILTER (WHERE satisfaction_score>=75)*(p_campaign->>'followersPerOrder')::INTEGER))
 FROM public.kq_online_sales WHERE user_id=p_user AND listing_id=(p_campaign->>'listingId')::UUID
  AND occurred_at>=(p_campaign->>'launchesAt')::TIMESTAMPTZ
  AND occurred_at<(p_campaign->>'endsAt')::TIMESTAMPTZ AND occurred_at<=p_at;
$$;

DO $$ DECLARE body TEXT; fragment TEXT; replacement TEXT; start_at INTEGER; end_at INTEGER; BEGIN
 -- Retain the established financial lock, settlement-before-mutation, atomic
 -- debit and request receipts rather than adding a separate campaign wallet.
 SELECT pg_get_functiondef('public.rpc_kq_online_command(uuid,text,jsonb,uuid)'::regprocedure) INTO body;
 start_at:=strpos(body,' ELSIF p_action=''start-marketing'' THEN');
 end_at:=strpos(body,' ELSE RAISE EXCEPTION ''online_invalid_request''; END IF;'||E'\n IF cost>0 THEN');
 IF start_at=0 OR end_at<=start_at THEN RAISE EXCEPTION 'marketing_command_anchor_changed'; END IF;
 body:=substr(body,1,start_at-1)||$patch$
 ELSIF p_action='start-marketing' THEN
  spec:=public.kq_online_marketing_plan(p_user_id,p_payload,now());
  cost:=(spec->>'costCents')::INTEGER;
  UPDATE public.kq_online_accounts SET marketing=spec WHERE user_id=p_user_id;
  result:=result||jsonb_build_object('campaignId',spec->'id');
$patch$||substr(body,end_at);
 EXECUTE body;

 -- Patch only the campaign terms in the current offer; preserve the later
 -- variety-demand reference price, request matching and all other economics.
 SELECT pg_get_functiondef('public.kq_online_offer(uuid,public.kq_online_listings,timestamptz)'::regprocedure) INTO body;
 fragment:='mission_visitors NUMERIC; alignment NUMERIC;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'marketing_offer_variable_anchor_changed'; END IF;
 body:=replace(body,fragment,fragment||' targeted_visitors NUMERIC:=0;');
 start_at:=strpos(body,' IF o.marketing IS NOT NULL AND');
 end_at:=strpos(body,' conversion:=.025');
 IF start_at=0 OR end_at<=start_at THEN RAISE EXCEPTION 'marketing_offer_traffic_anchor_changed'; END IF;
 fragment:=substr(body,start_at,end_at-start_at);
 replacement:=$patch$
 IF o.marketing->'version'='2'::JSONB THEN
  -- Paid generic advertising multiplies organic discovery only. The targeted
  -- campaign owns its separate, prepaid audience and never boosts other lots.
  IF a.advertising IS NOT NULL AND (a.advertising->>'startedAt')::TIMESTAMPTZ<=p_at AND (a.advertising->>'endsAt')::TIMESTAMPTZ>p_at THEN
   audience:=audience*(1+LEAST(100,(a.advertising->>'boostPercent')::NUMERIC)/100);
  END IF;
  IF (o.marketing->>'listingId')::UUID=p_listing.id AND (o.marketing->>'launchesAt')::TIMESTAMPTZ<=p_at AND (o.marketing->>'endsAt')::TIMESTAMPTZ>p_at THEN
   alignment:=CASE o.marketing->>'angle'
    WHEN 'value' THEN CASE WHEN ratio<=1.05 THEN 1.15 ELSE .35 END
    WHEN 'premium' THEN CASE WHEN quality>=8.5 AND ratio BETWEEN 1 AND 1.5 THEN 1.15 ELSE .3 END
    ELSE CASE WHEN quality>=7.5 AND ratio<=1.3 THEN 1.15 ELSE .45 END END;
   targeted_visitors:=(o.marketing->>'visitorsPerDay')::NUMERIC*alignment;
   audience:=audience+targeted_visitors;
  END IF;
 ELSE
$patch$||fragment||E' END IF;\n';
 body:=substr(body,1,start_at-1)||replacement||substr(body,end_at);
 fragment:='audience*conversion*acceptance*(.75+.25*GREATEST(0,LEAST(1,(quality-5.8)/3.7)))*5/p_listing.format_grams/GREATEST(1,count_active)';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'marketing_offer_rate_anchor_changed'; END IF;
 body:=replace(body,fragment,'CASE WHEN o.marketing->''version''=''2''::JSONB THEN ((audience-targeted_visitors)/GREATEST(1,count_active)+targeted_visitors)*conversion*acceptance*(.75+.25*GREATEST(0,LEAST(1,(quality-5.8)/3.7)))*5/p_listing.format_grams ELSE '||fragment||' END');
 EXECUTE body;

 SELECT pg_get_functiondef('public.kq_online_settle_until(uuid,timestamptz)'::regprocedure) INTO body;
 fragment:=$patch$   mission:=public.kq_online_marketing_catalog(o.marketing->>'code');
   UPDATE public.kq_online_accounts SET followers=LEAST(100000,followers+(mission->>'followers')::INTEGER),
    marketing_history=marketing_history||jsonb_build_array(marketing||jsonb_build_object('completedAt',cursor_at)),marketing=NULL,revision=revision+1 WHERE user_id=p_user;$patch$;
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'marketing_completion_anchor_changed'; END IF;
 body:=replace(body,fragment,$patch$
   IF o.marketing->'version'='2'::JSONB THEN
    mission:=o.marketing||jsonb_build_object('results',public.kq_online_marketing_results(p_user,o.marketing,cursor_at));
    UPDATE public.kq_online_accounts SET followers=LEAST(100000,followers+(mission#>>'{results,followersEarned}')::INTEGER),
     marketing_history=marketing_history||jsonb_build_array(mission||jsonb_build_object('completedAt',cursor_at)),marketing=NULL,revision=revision+1 WHERE user_id=p_user;
   ELSE
$patch$||fragment||E'\n   END IF;');
 fragment:='  IF candidate>cursor_at THEN next_at:=LEAST(next_at,candidate); END IF;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'marketing_launch_boundary_anchor_changed'; END IF;
 body:=replace(body,fragment,fragment||$patch$
  IF o.marketing->'version'='2'::JSONB AND (o.marketing->>'launchesAt')::TIMESTAMPTZ>cursor_at THEN
   next_at:=LEAST(next_at,(o.marketing->>'launchesAt')::TIMESTAMPTZ);
  END IF;
$patch$);
 EXECUTE body;

 SELECT pg_get_functiondef('public.kq_online_snapshot(uuid)'::regprocedure) INTO body;
 fragment:='''marketing'',jsonb_build_object(''active'',o.marketing,';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'marketing_snapshot_anchor_changed'; END IF;
 body:=replace(body,fragment,$patch$'marketing',jsonb_build_object('version',2,
  'active',CASE WHEN o.marketing->'version'='2'::JSONB THEN o.marketing||jsonb_build_object('results',public.kq_online_marketing_results(p_user,o.marketing,now())) ELSE o.marketing END,
  'history',COALESCE((SELECT jsonb_agg(e.value ORDER BY e.ordinality DESC) FROM
   (SELECT value,ordinality FROM jsonb_array_elements(o.marketing_history) WITH ORDINALITY ORDER BY ordinality DESC LIMIT 10) e),'[]'::JSONB),$patch$);
 fragment:='(public.kq_online_marketing_catalog(e->>''code'')->>''cooldownHours'')::INTEGER';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'marketing_snapshot_cooldown_anchor_changed'; END IF;
 body:=replace(body,fragment,'COALESCE(e->>''cooldownHours'',public.kq_online_marketing_catalog(e->>''code'')->>''cooldownHours'')::INTEGER');
 EXECUTE body;

 SELECT pg_get_functiondef('public.kq_online_observe_cost()'::regprocedure) INTO body;
 fragment:='NEW.kind IN (''online-buy-upgrade'',''online-upgrade-site'')';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'marketing_ledger_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'NEW.kind IN (''online-buy-upgrade'',''online-upgrade-site'',''online-start-marketing'')');
END $$;

-- The private account/listing tables retain their existing zero Data API
-- privileges. Only the established server command is callable by service_role.
REVOKE ALL ON FUNCTION public.kq_online_marketing_v2_catalog(TEXT),public.kq_online_marketing_budget(TEXT),
 public.kq_online_marketing_plan(UUID,JSONB,TIMESTAMPTZ),public.kq_online_marketing_results(UUID,JSONB,TIMESTAMPTZ),
 public.kq_online_offer(UUID,public.kq_online_listings,TIMESTAMPTZ),public.kq_online_settle_until(UUID,TIMESTAMPTZ),
 public.kq_online_snapshot(UUID),public.kq_online_observe_cost(),public.rpc_kq_online_command(UUID,TEXT,JSONB,UUID)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_online_command(UUID,TEXT,JSONB,UUID) TO service_role;

COMMIT;
