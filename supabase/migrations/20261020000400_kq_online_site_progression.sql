BEGIN;

-- Extend the existing website asset. Existing tiers, prices, paid periods,
-- orders and request receipts retain their original meaning.
ALTER TABLE public.kq_online_accounts
 DROP CONSTRAINT kq_online_accounts_site_tier_check,
 ADD CONSTRAINT kq_online_accounts_site_tier_check
 CHECK(site_tier IN ('none','basic','improved','pro','studio','signature','flagship'));

CREATE OR REPLACE FUNCTION public.kq_online_site_catalog(p_tier TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE p_tier
 WHEN 'basic' THEN jsonb_build_object('tier',p_tier,'level',1,'costCents',0,'monthlyCents',0,'feePercent',2.5,'conversion',1,'requiredPackets',0,'requiredConfidence',0,'requiredFollowers',0,'requiresPhotography',false,'requiresBranding',false)
 WHEN 'improved' THEN jsonb_build_object('tier',p_tier,'level',2,'costCents',90000,'monthlyCents',3000,'feePercent',2.5,'conversion',1.25,'requiredPackets',5,'requiredConfidence',45,'requiredFollowers',0,'requiresPhotography',false,'requiresBranding',false)
 WHEN 'pro' THEN jsonb_build_object('tier',p_tier,'level',3,'costCents',300000,'monthlyCents',6000,'feePercent',2.5,'conversion',1.6,'requiredPackets',30,'requiredConfidence',60,'requiredFollowers',0,'requiresPhotography',false,'requiresBranding',false)
 WHEN 'studio' THEN jsonb_build_object('tier',p_tier,'level',4,'costCents',650000,'monthlyCents',11000,'feePercent',2.5,'conversion',1.9,'requiredPackets',80,'requiredConfidence',70,'requiredFollowers',50,'requiresPhotography',true,'requiresBranding',false)
 WHEN 'signature' THEN jsonb_build_object('tier',p_tier,'level',5,'costCents',1200000,'monthlyCents',18000,'feePercent',2.5,'conversion',2.2,'requiredPackets',180,'requiredConfidence',80,'requiredFollowers',150,'requiresPhotography',true,'requiresBranding',true)
 WHEN 'flagship' THEN jsonb_build_object('tier',p_tier,'level',6,'costCents',2000000,'monthlyCents',28000,'feePercent',2.5,'conversion',2.5,'requiredPackets',350,'requiredConfidence',88,'requiredFollowers',300,'requiresPhotography',true,'requiresBranding',true)
 ELSE NULL END;
$$;

DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 -- Patch the current command, retaining later marketing changes, the common
 -- financial lock, settlement before mutation and receipt replay before guards.
 SELECT pg_get_functiondef('public.rpc_kq_online_command(uuid,text,jsonb,uuid)'::regprocedure) INTO body;
 fragment:=$anchor$  IF o.total_packets<(spec->>'requiredPackets')::INTEGER OR o.confidence<(spec->>'requiredConfidence')::NUMERIC THEN RAISE EXCEPTION 'online_progression_required'; END IF;$anchor$;
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'online_site_progression_command_anchor_changed'; END IF;
 body:=replace(body,fragment,$patch$  IF (spec->>'level')::INTEGER IS DISTINCT FROM COALESCE((public.kq_online_site_catalog(o.site_tier)->>'level')::INTEGER,0)+1 THEN
   RAISE EXCEPTION 'online_progression_required';
  END IF;
  IF o.total_packets<(spec->>'requiredPackets')::INTEGER
   OR o.confidence<(spec->>'requiredConfidence')::NUMERIC
   OR o.followers<(spec->>'requiredFollowers')::INTEGER
   OR ((spec->>'requiresPhotography')::BOOLEAN AND NOT o.photography)
   OR ((spec->>'requiresBranding')::BOOLEAN AND NOT o.branding) THEN
   RAISE EXCEPTION 'online_progression_required';
  END IF;$patch$);
 EXECUTE body;

 -- Clients can distinguish this catalogue from an older server without
 -- enabling purchases that the older database cannot execute.
 SELECT pg_get_functiondef('public.kq_online_snapshot(uuid)'::regprocedure) INTO body;
 fragment:=$anchor$'site',jsonb_build_object('tier',CASE WHEN o.site_tier='none' THEN 'basic' ELSE o.site_tier END,$anchor$;
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'online_site_progression_snapshot_anchor_changed'; END IF;
 EXECUTE replace(body,fragment,$patch$'site',jsonb_build_object('maxLevel',6,'tier',CASE WHEN o.site_tier='none' THEN 'basic' ELSE o.site_tier END,$patch$);
END $$;

-- Private data and helpers remain inaccessible through the Data API.
REVOKE ALL ON public.kq_online_accounts FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_online_site_catalog(TEXT),public.kq_online_snapshot(UUID)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_online_command(UUID,TEXT,JSONB,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_online_command(UUID,TEXT,JSONB,UUID) TO service_role;

COMMIT;
