BEGIN;

-- Permanent investments extend the two historical upgrades. Their first level
-- keeps the exact cost and effect already paid by existing players.
ALTER TABLE public.kq_online_accounts
 ADD COLUMN studio_photography_level INTEGER NOT NULL DEFAULT 0 CHECK(studio_photography_level BETWEEN 0 AND 3),
 ADD COLUMN studio_branding_level INTEGER NOT NULL DEFAULT 0 CHECK(studio_branding_level BETWEEN 0 AND 3),
 ADD COLUMN studio_editorial_level INTEGER NOT NULL DEFAULT 0 CHECK(studio_editorial_level BETWEEN 0 AND 3),
 ADD COLUMN studio_style TEXT NOT NULL DEFAULT 'craft' CHECK(studio_style IN ('clear','craft','signature'));
UPDATE public.kq_online_accounts SET studio_photography_level=CASE WHEN photography THEN 1 ELSE 0 END,
 studio_branding_level=CASE WHEN branding THEN 1 ELSE 0 END;

CREATE FUNCTION public.kq_online_studio_catalog(p_track TEXT,p_level INTEGER) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT jsonb_build_object('track',p_track,'level',p_level,'costCents',x.cost_cents,
  'minimumLevel',x.site_level,'minimumOrders',x.orders,'minimumConfidence',x.confidence,
  'requiresPhotography',x.photography,'requiresBranding',x.branding)
 FROM (VALUES
  ('photography',1,30000,1,0,0,0,0),('photography',2,55000,2,15,55,0,0),('photography',3,110000,4,80,70,0,0),
  ('branding',1,70000,1,0,0,0,0),('branding',2,100000,3,40,65,1,0),('branding',3,180000,5,180,80,2,0),
  ('editorial',1,18000,2,5,45,1,0),('editorial',2,45000,3,30,60,0,1),('editorial',3,95000,4,80,75,2,2)
 ) x(track,level,cost_cents,site_level,orders,confidence,photography,branding)
 WHERE x.track=p_track AND x.level=p_level;
$$;

CREATE FUNCTION public.kq_online_studio_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('version',1,'levels',jsonb_build_object(
  'photography',GREATEST(studio_photography_level,CASE WHEN photography THEN 1 ELSE 0 END),
  'branding',GREATEST(studio_branding_level,CASE WHEN branding THEN 1 ELSE 0 END),
  'editorial',studio_editorial_level),'style',studio_style)
 FROM public.kq_online_accounts WHERE user_id=p_user;
$$;

CREATE FUNCTION public.kq_online_studio_editorial_multiplier(p_level INTEGER,p_match BOOLEAN) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN p_level=0 THEN 1 WHEN p_match THEN 1+.04*p_level ELSE 1-.02*p_level END;
$$;

CREATE FUNCTION public.kq_online_studio_flower_multiplier(p_user UUID,p_quality NUMERIC,p_ratio NUMERIC) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT (ARRAY[1,1.10,1.18,1.26]::NUMERIC[])[GREATEST(o.studio_photography_level,CASE WHEN o.photography THEN 1 ELSE 0 END)+1]
  *(ARRAY[1,1.08,1.14,1.20]::NUMERIC[])[GREATEST(o.studio_branding_level,CASE WHEN o.branding THEN 1 ELSE 0 END)+1]
  *public.kq_online_studio_editorial_multiplier(o.studio_editorial_level,CASE o.studio_style
   WHEN 'clear' THEN p_quality>=5.8 AND p_ratio<=1.05 WHEN 'craft' THEN p_quality>=7.5 AND p_ratio<=1.3
   WHEN 'signature' THEN p_quality>=8.5 AND p_ratio BETWEEN 1 AND 1.5 ELSE false END)
 FROM public.kq_online_accounts o WHERE o.user_id=p_user;
$$;

CREATE FUNCTION public.kq_online_studio_merch_multiplier(p_user UUID,p_code TEXT,p_ratio NUMERIC) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT (ARRAY[1,1,1.08,1.16]::NUMERIC[])[GREATEST(o.studio_branding_level,CASE WHEN o.branding THEN 1 ELSE 0 END)+1]
  *public.kq_online_studio_editorial_multiplier(o.studio_editorial_level,CASE o.studio_style
   WHEN 'clear' THEN p_code IN ('stickers','poster') AND p_ratio<=1.05
   WHEN 'craft' THEN p_code IN ('tote','mug') AND p_ratio<=1.3
   WHEN 'signature' THEN p_code IN ('tshirt','cap') AND p_ratio BETWEEN 1 AND 1.5 ELSE false END)
 FROM public.kq_online_accounts o WHERE o.user_id=p_user;
$$;

-- Called only inside the financial RPC, after settlement and before its common
-- debit/receipt path. A rejected debit rolls back the level and ledger together.
CREATE FUNCTION public.kq_online_studio_command(p_user UUID,p_action TEXT,p_payload JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.kq_online_accounts%ROWTYPE; a public.kq_commerce_accounts%ROWTYPE;
 track TEXT:=p_payload->>'track'; style TEXT:=p_payload->>'style'; level INTEGER; current_level INTEGER;
 photo INTEGER; brand INTEGER; spec JSONB; cost INTEGER:=0;
BEGIN
 SELECT * INTO o FROM public.kq_online_accounts WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user FOR UPDATE;
 IF NOT a.computer_owned OR a.shop_created_at IS NULL OR o.site_tier='none' THEN RAISE EXCEPTION 'online_site_required'; END IF;
 photo:=GREATEST(o.studio_photography_level,CASE WHEN o.photography THEN 1 ELSE 0 END);
 brand:=GREATEST(o.studio_branding_level,CASE WHEN o.branding THEN 1 ELSE 0 END);
 IF p_action='choose-studio-style' THEN
  IF style IS NULL OR style NOT IN ('clear','craft','signature') THEN RAISE EXCEPTION 'online_studio_unknown'; END IF;
  IF brand<1 AND o.studio_editorial_level<1 THEN RAISE EXCEPTION 'online_studio_style_required'; END IF;
  UPDATE public.kq_online_accounts SET studio_style=style WHERE user_id=p_user;
  RETURN jsonb_build_object('style',style,'paidCents',0);
 ELSIF p_action='buy-studio-level' THEN
  level:=public.kq_online_integer(p_payload->'level',1,3);
  spec:=public.kq_online_studio_catalog(track,level);
  IF spec IS NULL THEN RAISE EXCEPTION 'online_studio_unknown'; END IF;
  current_level:=CASE track WHEN 'photography' THEN photo WHEN 'branding' THEN brand WHEN 'editorial' THEN o.studio_editorial_level END;
  IF level<>current_level+1 THEN RAISE EXCEPTION 'online_studio_sequence'; END IF;
  IF o.site_tier<>'basic' AND (a.shop_suspended OR a.shop_paid_until IS NULL OR a.shop_paid_until<=now()) THEN RAISE EXCEPTION 'online_site_required'; END IF;
  IF (public.kq_online_site_catalog(o.site_tier)->>'level')::INTEGER<(spec->>'minimumLevel')::INTEGER
   OR o.total_packets<(spec->>'minimumOrders')::INTEGER OR o.confidence<(spec->>'minimumConfidence')::INTEGER
   OR photo<(spec->>'requiresPhotography')::INTEGER OR brand<(spec->>'requiresBranding')::INTEGER
  THEN RAISE EXCEPTION 'online_studio_progression_required'; END IF;
  cost:=(spec->>'costCents')::INTEGER;
  UPDATE public.kq_online_accounts SET
   studio_photography_level=CASE WHEN track='photography' THEN level ELSE studio_photography_level END,
   studio_branding_level=CASE WHEN track='branding' THEN level ELSE studio_branding_level END,
   studio_editorial_level=CASE WHEN track='editorial' THEN level ELSE studio_editorial_level END,
   photography=photography OR track='photography',branding=branding OR track='branding' WHERE user_id=p_user;
  RETURN jsonb_build_object('track',track,'level',level,'paidCents',cost);
 END IF;
 RAISE EXCEPTION 'online_invalid_request';
END $$;

DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_online_command(uuid,text,jsonb,uuid)'::regprocedure) INTO body;
 fragment:=$anchor$ IF p_action IN ('buy-merch-module','buy-merch-stock','update-merch') THEN$anchor$;
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'studio_command_anchor_changed'; END IF;
 body:=replace(body,fragment,$patch$ IF p_action IN ('buy-studio-level','choose-studio-style') THEN
  result:=public.kq_online_studio_command(p_user_id,p_action,p_payload); cost:=(result->>'paidCents')::INTEGER;
 ELSIF p_action IN ('buy-merch-module','buy-merch-stock','update-merch') THEN$patch$);
 fragment:='SET photography=true WHERE user_id=p_user_id;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'studio_legacy_photography_anchor_changed'; END IF;
 body:=replace(body,fragment,'SET photography=true,studio_photography_level=GREATEST(studio_photography_level,1) WHERE user_id=p_user_id;');
 fragment:='SET branding=true WHERE user_id=p_user_id;';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'studio_legacy_branding_anchor_changed'; END IF;
 body:=replace(body,fragment,'SET branding=true,studio_branding_level=GREATEST(studio_branding_level,1) WHERE user_id=p_user_id;');
 EXECUTE body;

 SELECT pg_get_functiondef('public.kq_online_snapshot(uuid)'::regprocedure) INTO body;
 fragment:='''merch'',public.kq_online_merch_snapshot(p_user),';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'studio_snapshot_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'''studio'',public.kq_online_studio_snapshot(p_user),'||fragment);

 SELECT pg_get_functiondef('public.kq_online_offer(uuid,public.kq_online_listings,timestamptz)'::regprocedure) INTO body;
 fragment:=$anchor$*(CASE WHEN o.photography THEN 1.1 ELSE 1 END)
  *(CASE WHEN o.branding THEN 1.08 ELSE 1 END)$anchor$;
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'studio_flower_offer_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,'*public.kq_online_studio_flower_multiplier(p_user,quality,ratio)');

 SELECT pg_get_functiondef('public.kq_online_merch_rate(uuid,text,integer,timestamptz)'::regprocedure) INTO body;
 fragment:=$anchor$*(spec->>'demandMultiplier')::NUMERIC*acceptance/GREATEST(1,competing)$anchor$;
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'studio_merch_rate_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,fragment||'*public.kq_online_studio_merch_multiplier(p_user,p_code,ratio)');

 SELECT pg_get_functiondef('public.kq_online_observe_cost()'::regprocedure) INTO body;
 fragment:=$anchor$NEW.kind IN ('online-buy-upgrade','online-upgrade-site','online-start-marketing','online-buy-merch-module')$anchor$;
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'studio_cost_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,$patch$NEW.kind IN ('online-buy-upgrade','online-upgrade-site','online-start-marketing','online-buy-merch-module','online-buy-studio-level')$patch$);
END $$;

REVOKE ALL ON public.kq_online_accounts FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_online_studio_catalog(TEXT,INTEGER),public.kq_online_studio_snapshot(UUID),
 public.kq_online_studio_editorial_multiplier(INTEGER,BOOLEAN),public.kq_online_studio_flower_multiplier(UUID,NUMERIC,NUMERIC),
 public.kq_online_studio_merch_multiplier(UUID,TEXT,NUMERIC),public.kq_online_studio_command(UUID,TEXT,JSONB),
 public.kq_online_snapshot(UUID),public.kq_online_offer(UUID,public.kq_online_listings,TIMESTAMPTZ),
 public.kq_online_merch_rate(UUID,TEXT,INTEGER,TIMESTAMPTZ),public.kq_online_observe_cost()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_online_command(UUID,TEXT,JSONB,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_online_command(UUID,TEXT,JSONB,UUID) TO service_role;

COMMIT;
