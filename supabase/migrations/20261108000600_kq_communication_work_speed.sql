BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Only these three manual communication actions change their base duration.
-- Keep the already-installed Culture/Transformation work policies untouched.
DO $$ DECLARE body TEXT; anchor TEXT; spec RECORD; BEGIN
 body:=pg_get_functiondef('public.kq_player_work_cost(text,text)'::regprocedure);
 FOR spec IN SELECT * FROM (VALUES
  ('commerce','advertise'),('online','start-marketing'),('social','sponsor-post')
 ) s(domain,action) LOOP
  anchor:=format('WHEN p_domain=%L AND p_action=%L THEN 2',spec.domain,spec.action);
  IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1
   THEN RAISE EXCEPTION 'communication_work_base_drift: %/%',spec.domain,spec.action; END IF;
  body:=replace(body,anchor,format('WHEN p_domain=%L AND p_action=%L THEN 1',spec.domain,spec.action));
 END LOOP;
 EXECUTE body;
END $$;

-- Each manual gesture uses its own skill. Culture and machine/processing jobs
-- retain their dedicated workload rules. Free or unknown actions stay free.
CREATE FUNCTION public.kq_player_work_skill(p_domain TEXT,p_action TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT CASE
 WHEN public.kq_player_work_cost(p_domain,p_action)=0 OR p_domain='culture' THEN NULL
 WHEN p_domain='commerce' THEN CASE p_action
  WHEN 'prepare' THEN 'processing' WHEN 'sell' THEN 'sales' WHEN 'advertise' THEN 'communication' ELSE 'administration' END
 WHEN p_domain='online' THEN CASE
  WHEN p_action IN ('create-listing','update-listing','update-merch') THEN 'sales'
  WHEN p_action='start-marketing' THEN 'communication' ELSE 'administration' END
 WHEN p_domain='social' THEN 'communication'
 WHEN p_domain='storage' THEN CASE
  WHEN p_action IN ('assign','place') THEN 'processing' WHEN p_action='sell-overflow' THEN 'sales' ELSE 'administration' END
 WHEN p_domain='warehouse' THEN 'administration'
 WHEN p_domain='equipment' THEN CASE
  WHEN p_action IN ('repair','replace','install') THEN 'processing' ELSE 'administration' END
 WHEN p_domain='administration' THEN 'administration'
 ELSE NULL END;
$$;
REVOKE ALL ON FUNCTION public.kq_player_work_skill(TEXT,TEXT) FROM PUBLIC,anon,authenticated,service_role;

-- Same XP thresholds as getKqStaffLevel: 0,100,400,...,8100. Experience
-- belongs to the persisted player, never a command's payload or an employee.
-- Level 10 takes one tenth of each action's base time (30 min becomes 3 min).
-- Preserve the legacy playerProcessingXp fallback and all XP progression.
CREATE FUNCTION public.kq_player_work_cost(p_user UUID,p_domain TEXT,p_action TEXT) RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE experience NUMERIC; skill_level INTEGER;
 skill TEXT:=public.kq_player_work_skill(p_domain,p_action);
 base_hours NUMERIC:=public.kq_player_work_cost(p_domain,p_action);
BEGIN
 IF skill IS NULL THEN RETURN base_hours; END IF;
 SELECT GREATEST(0,COALESCE((state->'playerSkills'->>skill)::NUMERIC,0),
  CASE WHEN skill='processing' THEN COALESCE((state->>'playerProcessingXp')::NUMERIC,0) ELSE 0 END)
  INTO experience FROM public.kq_staff_accounts WHERE user_id=p_user;
 skill_level:=LEAST(10,1+floor(sqrt(COALESCE(experience,0)/100)))::INTEGER;
 RETURN base_hours*(11-skill_level)/10;
END $$;
REVOKE ALL ON FUNCTION public.kq_player_work_cost(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated,service_role;

-- Hundredths retain the proportional durations exactly (0.45 h at level 2,
-- 0.05 h at level 10). Personal missions and trim still book half-hour units.
DO $$ DECLARE body TEXT; spec RECORD; BEGIN
 FOR spec IN SELECT * FROM (VALUES
  ('public.kq_player_work_charge(uuid,numeric)','mod(p_hours,0.5)','mod(p_hours,0.01)'),
  ('public.kq_player_work_charge(uuid,numeric)','mod(used,0.5)','mod(used,0.01)'),
  ('public.kq_player_work_validate_staff(uuid,jsonb,jsonb)','mod((item.value->>''usedHours'')::NUMERIC,0.5)','mod((item.value->>''usedHours'')::NUMERIC,0.01)')
 ) s(signature,before_text,after_text) LOOP
  body:=pg_get_functiondef(spec.signature::regprocedure);
  IF (length(body)-length(replace(body,spec.before_text,'')))/length(spec.before_text)<>1
   THEN RAISE EXCEPTION 'communication_work_ledger_drift: %',spec.signature; END IF;
  EXECUTE replace(body,spec.before_text,spec.after_text);
 END LOOP;
END $$;

-- Preserve each existing lock, business call, replay check and atomic charge.
-- Processing renamed the commerce work wrapper; patch that delegated function
-- so its preparation exemption and the new outer job RPC are preserved.
DO $$ DECLARE body TEXT; anchor TEXT; spec RECORD; BEGIN
 FOR spec IN SELECT * FROM (VALUES
  ('public.kq_commerce_before_processing_work(uuid,text,jsonb,uuid)','commerce'),
  ('public.rpc_kq_online_command(uuid,text,jsonb,uuid)','online'),
  ('public.rpc_kq_social_v2_commit(uuid,jsonb,integer,integer,jsonb,integer)','social'),
  ('public.rpc_kq_storage_capacity_command(uuid,text,text,text,integer,uuid,uuid)','storage'),
  ('public.rpc_kq_warehouse_save(uuid,uuid,jsonb,integer,jsonb,jsonb,integer)','warehouse'),
  ('public.rpc_kq_warehouse_save_condition(uuid,uuid,jsonb,integer,jsonb,jsonb,integer,jsonb,jsonb)','warehouse'),
  ('public.rpc_kq_warehouse_remove_zone(uuid,uuid,jsonb,integer,jsonb,jsonb,jsonb,jsonb,integer)','warehouse'),
  ('public.rpc_kq_purchase_tent_equipment(uuid,uuid,text[],integer)','equipment'),
  ('public.rpc_kq_upgrade_tent_equipment(uuid,uuid,text,integer,integer)','equipment'),
  ('public.rpc_kq_repair_tent_machine(uuid,text,integer,integer,uuid,integer)','equipment'),
  ('public.rpc_kq_replace_tent_culture_equipment(uuid,text,integer,integer,uuid,integer)','equipment'),
  ('public.rpc_kq_purchase_workshop_tier(uuid,uuid,text,integer,integer,integer)','equipment'),
  ('public.rpc_kq_equip_tent_equipment(uuid,text,integer)','equipment'),
  ('public.rpc_kq_pay_energy(uuid,uuid,integer)','administration')
 ) s(signature,domain) LOOP
  body:=pg_get_functiondef(spec.signature::regprocedure);
  anchor:=format('public.kq_player_work_cost(%L,',spec.domain);
  IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1
   THEN RAISE EXCEPTION 'communication_work_wrapper_drift: %',spec.signature; END IF;
  EXECUTE replace(body,anchor,format('public.kq_player_work_cost(p_user_id,%L,',spec.domain));
 END LOOP;
END $$;

COMMIT;
