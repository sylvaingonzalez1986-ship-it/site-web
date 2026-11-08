BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- One ledger, shared with personal trim and Personnel missions. Calendar days
-- are the farm's four-real-hour days, never browser dates or employee weekdays.
CREATE FUNCTION public.kq_player_work_day(p_user UUID, p_at TIMESTAMPTZ DEFAULT now()) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT (floor(GREATEST(0,extract(epoch FROM p_at-COALESCE(c.business_started_at,w.created_at)))/14400)+1)::INTEGER
 FROM public.kq_equipment_wallets w LEFT JOIN public.kq_commerce_accounts c USING(user_id) WHERE w.user_id=p_user;
$$;
REVOKE ALL ON FUNCTION public.kq_player_work_day(UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_player_work_cost(p_domain TEXT,p_action TEXT) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT CASE
 WHEN p_domain='culture' AND p_action='start' THEN 1
 WHEN p_domain='culture' AND p_action IN ('roll','resolve','advance','redraw','heritage','card','heritage-swap','care','buy-care') THEN 0.5
 WHEN p_domain='commerce' AND p_action='prepare' THEN 1
 WHEN p_domain='commerce' AND p_action='advertise' THEN 2
 WHEN p_domain='commerce' AND p_action IN ('sell','create-shop','rename-shop','pay-lab','pay-supplier','pay-all-invoices','buy-computer','renew-shop') THEN 0.5
 WHEN p_domain='online' AND p_action='create-listing' THEN 1
 WHEN p_domain='online' AND p_action='start-marketing' THEN 2
 WHEN p_domain='online' AND p_action IN ('buy-packaging','update-listing','upgrade-site','buy-upgrade','buy-studio-level','choose-studio-style','buy-merch-module','buy-merch-stock','update-merch') THEN 0.5
 WHEN p_domain='social' AND p_action='sponsor-post' THEN 2
 WHEN p_domain='social' AND p_action IN ('choose','sponsor-accept') THEN 0.5
 WHEN p_domain='storage' AND p_action IN ('buy','assign','place','sell-overflow') THEN 0.5
 WHEN p_domain='warehouse' AND p_action IN ('save','remove-zone') THEN 0.5
 WHEN p_domain='equipment' AND p_action IN ('purchase','upgrade','repair','replace','install','workshop-tier') THEN 0.5
 WHEN p_domain='administration' AND p_action='pay-energy' THEN 0.5
 ELSE 0 END;
$$;
REVOKE ALL ON FUNCTION public.kq_player_work_cost(TEXT,TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_player_work_charge(p_user UUID,p_hours NUMERIC) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE account public.kq_staff_accounts%ROWTYPE; current_day INTEGER; used NUMERIC; next_state JSONB; days JSONB;
BEGIN
 IF p_hours IS NULL OR p_hours<0 OR p_hours>12 OR mod(p_hours,0.5)<>0 THEN RAISE EXCEPTION 'player_work_invalid'; END IF;
 IF p_hours=0 THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 -- Preserve wallet-before-staff ordering, including the payroll accounting trigger.
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'staff_profile'; END IF;
 current_day:=public.kq_player_work_day(p_user);
 INSERT INTO public.kq_staff_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
 SELECT * INTO account FROM public.kq_staff_accounts WHERE user_id=p_user FOR UPDATE;
 next_state:=COALESCE(account.state,jsonb_build_object('version',1,'employees','[]'::JSONB,'tasks','[]'::JSONB,
  'payroll','[]'::JSONB,'lastSettledAt',now(),'supplierDiscountPercent',0,'supplierDiscountUntil',NULL,
  'prospecting','{}'::JSONB,'trimmerOwned',false,'playerWorkDays','{}'::JSONB,'playerProcessingXp',0));
 days:=COALESCE(next_state->'playerWorkDays','{}'::JSONB);
 IF jsonb_typeof(days) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'player_work_changed'; END IF;
 used:=COALESCE((days->current_day::TEXT->>'usedHours')::NUMERIC,0);
 IF used<0 OR used>12 OR mod(used,0.5)<>0 THEN RAISE EXCEPTION 'player_work_changed'; END IF;
 IF used+p_hours>12 THEN RAISE EXCEPTION 'player_work_exhausted'; END IF;
 days:=days||jsonb_build_object(current_day::TEXT,jsonb_build_object('usedHours',used+p_hours));
 UPDATE public.kq_staff_accounts SET state=jsonb_set(next_state,'{playerWorkDays}',days),revision=revision+1,updated_at=now() WHERE user_id=p_user;
END $$;
REVOKE ALL ON FUNCTION public.kq_player_work_charge(UUID,NUMERIC) FROM PUBLIC,anon,authenticated,service_role;

-- Called after receipt replay and staff CAS, before any cost/effect. An old
-- application cannot silently restore hours spent in another game screen.
CREATE FUNCTION public.kq_player_work_validate_staff(p_user UUID,p_command JSONB,p_state JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous JSONB; old_days JSONB; new_days JSONB; item RECORD; current_day INTEGER; earliest_day INTEGER;
 used NUMERIC; next_used NUMERIC; hours NUMERIC:=0; personal BOOLEAN; task_count INTEGER;
BEGIN
 current_day:=public.kq_player_work_day(p_user);
 IF current_day IS NULL THEN RAISE EXCEPTION 'staff_profile'; END IF;
 IF public.kq_player_work_day(p_user,(p_state->>'lastSettledAt')::TIMESTAMPTZ) IS DISTINCT FROM current_day
 THEN RAISE EXCEPTION 'player_work_changed'; END IF;
 SELECT state INTO previous FROM public.kq_staff_accounts WHERE user_id=p_user;
 old_days:=COALESCE(previous->'playerWorkDays','{}'::JSONB);
 new_days:=COALESCE(p_state->'playerWorkDays','{}'::JSONB);
 IF jsonb_typeof(old_days) IS DISTINCT FROM 'object' OR jsonb_typeof(new_days) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'player_work_changed'; END IF;
 personal:=p_command->>'action'='player-assign' OR (p_command->>'action'='trim' AND p_command->'employeeId'='null'::JSONB);
 IF personal THEN
  IF jsonb_typeof(p_command->'hours') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'player_work_invalid'; END IF;
  hours:=(p_command->>'hours')::NUMERIC;
  IF hours<0.5 OR hours>12 OR mod(hours,0.5)<>0 THEN RAISE EXCEPTION 'player_work_invalid'; END IF;
  IF p_command->>'action'='player-assign' AND (p_command->>'kind' IS NULL OR p_command->>'kind' NOT IN ('culture','processing','communication','sales','administration','countryside')
   OR (p_command->>'kind'='countryside' AND hours<>12)) THEN RAISE EXCEPTION 'player_work_invalid'; END IF;
  SELECT count(*) INTO task_count FROM jsonb_array_elements(p_state->'tasks') t
   WHERE t->>'employeeId'='player' AND (t->>'day')::INTEGER=current_day AND (t->>'hours')::NUMERIC=hours
    AND t->>'status'='running' AND t->>'kind'=CASE WHEN p_command->>'action'='trim' THEN 'trim' ELSE p_command->>'kind' END
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(previous->'tasks','[]'::JSONB)) old WHERE old->>'id'=t->>'id');
  IF task_count<>1 THEN RAISE EXCEPTION 'player_work_changed'; END IF;
 END IF;
 used:=COALESCE((old_days->current_day::TEXT->>'usedHours')::NUMERIC,0);
 next_used:=COALESCE((new_days->current_day::TEXT->>'usedHours')::NUMERIC,0);
 IF used+hours>12 THEN RAISE EXCEPTION 'player_work_exhausted'; END IF;
 IF next_used IS DISTINCT FROM used+hours THEN RAISE EXCEPTION 'player_work_changed'; END IF;
 -- The engine retains this and the previous game week. It may compact older
 -- rows, but cannot alter retained history or pre-spend a future day's hours.
 earliest_day:=GREATEST(1,(floor((current_day-1)::NUMERIC/7)::INTEGER-1)*7+1);
 FOR item IN SELECT key,value FROM jsonb_each(old_days) LOOP
  IF item.key !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'player_work_changed'; END IF;
  IF item.key::INTEGER<>current_day AND (item.key::INTEGER>=earliest_day OR new_days ? item.key)
   AND new_days->item.key IS DISTINCT FROM item.value THEN RAISE EXCEPTION 'player_work_changed'; END IF;
 END LOOP;
 FOR item IN SELECT key,value FROM jsonb_each(new_days) LOOP
  IF item.key !~ '^[1-9][0-9]*$' OR jsonb_typeof(item.value->'usedHours') IS DISTINCT FROM 'number'
   THEN RAISE EXCEPTION 'player_work_changed'; END IF;
  IF item.key::INTEGER<>current_day AND old_days->item.key IS DISTINCT FROM item.value THEN RAISE EXCEPTION 'player_work_changed'; END IF;
  IF (item.value->>'usedHours')::NUMERIC NOT BETWEEN 0 AND 12 OR mod((item.value->>'usedHours')::NUMERIC,0.5)<>0
   THEN RAISE EXCEPTION 'player_work_changed'; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.kq_player_work_validate_staff(UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 body:=pg_get_functiondef('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure);
 anchor:='''trim'',''buy-trimmer'',''settle''';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'player_work_staff_whitelist_drift'; END IF;
 body:=replace(body,anchor,'''trim'',''buy-trimmer'',''player-assign'',''settle''');
 anchor:='IF account.revision<>p_expected_revision THEN RAISE EXCEPTION ''staff_changed''; END IF;';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'player_work_staff_cas_drift'; END IF;
 EXECUTE replace(body,anchor,anchor||E'\n PERFORM public.kq_player_work_validate_staff(p_user_id,p_command,p_state);');
END $$;

-- Capture the exact current signatures/defaults and call each existing business
-- implementation unchanged. Only public entrypoints are wrapped: campaign
-- internals, automatic settlement and employee effects never spend player hours.
CREATE FUNCTION pg_temp.kq_player_work_wrap(p_signature TEXT,p_domain TEXT,p_action_expression TEXT,p_noop_expression TEXT DEFAULT 'false') RETURNS VOID
LANGUAGE plpgsql AS $installer$
DECLARE proc OID; original_name TEXT; inner_name TEXT; arguments TEXT; identity_arguments TEXT; call_arguments TEXT;
BEGIN
 proc:=p_signature::regprocedure;
 SELECT proname,pg_get_function_arguments(oid),pg_get_function_identity_arguments(oid),
  (SELECT string_agg(quote_ident(n),',' ORDER BY ordinal) FROM unnest(proargnames) WITH ORDINALITY a(n,ordinal))
 INTO original_name,arguments,identity_arguments,call_arguments FROM pg_proc WHERE oid=proc;
 IF call_arguments IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=proc AND prorettype='jsonb'::regtype AND proargnames[1]='p_user_id')
 THEN RAISE EXCEPTION 'player_work_wrapper_signature: %',p_signature; END IF;
 inner_name:='kq_work_inner_'||substr(original_name,8);
 EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I',original_name,identity_arguments,inner_name);
 EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated,service_role',inner_name,identity_arguments);
 EXECUTE format($definition$
 CREATE FUNCTION public.%I(%s) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $wrapper$
 DECLARE result JSONB; no_work BOOLEAN;
 BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  no_work:=(%s);
  result:=public.%I(%s);
  IF NOT COALESCE(no_work,false) AND result->'replayed' IS DISTINCT FROM 'true'::JSONB
   AND result->'receipt'->'replayed' IS DISTINCT FROM 'true'::JSONB THEN
   PERFORM public.kq_player_work_charge(p_user_id,public.kq_player_work_cost(%L,%s));
  END IF;
  RETURN result;
 END $wrapper$;
 $definition$,original_name,arguments,p_noop_expression,inner_name,call_arguments,p_domain,p_action_expression);
 EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated,service_role',original_name,identity_arguments);
 EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',original_name,identity_arguments);
END $installer$;

-- Registration list is also exercised by the isolated SQL fixture.
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_start_zone_run(uuid,text,uuid,jsonb,text,integer,text[],text[],jsonb,integer,text)','culture','''start''');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_start_campaign(uuid,uuid,jsonb,jsonb,integer,text)','culture','''start''');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_start_run_with_heritage(uuid,text,integer,text[],text[],jsonb,integer,text)','culture','''start''');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_update_run_state(uuid,uuid,timestamptz,text,jsonb,jsonb)','culture','p_action');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_update_campaign_state(uuid,uuid,timestamptz,text,jsonb,jsonb)','culture','p_action');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_play_support_card(uuid,uuid,text,smallint,text,timestamptz,jsonb)','culture','''card''');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_swap_heritage_hand(uuid,uuid,timestamptz,jsonb)','culture','''heritage-swap''');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_apply_care(uuid,uuid,text,uuid,timestamptz,jsonb,integer)','culture','''care''');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_purchase_care(uuid,text,integer,uuid)','culture','''buy-care''');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)','commerce','p_action');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_online_command(uuid,text,jsonb,uuid)','online','p_action');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_social_v2_commit(uuid,jsonb,integer,integer,jsonb,integer)','social','p_command->>''action''');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_storage_capacity_command(uuid,text,text,text,integer,uuid,uuid)','storage','p_action');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_warehouse_save(uuid,uuid,jsonb,integer,jsonb,jsonb,integer)','warehouse','''save''','p_previous_state IS NOT DISTINCT FROM p_next_state');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_warehouse_save_condition(uuid,uuid,jsonb,integer,jsonb,jsonb,integer,jsonb,jsonb)','warehouse','''save''','p_previous_state IS NOT DISTINCT FROM p_next_state AND p_previous_assets IS NOT DISTINCT FROM p_next_assets');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_warehouse_remove_zone(uuid,uuid,jsonb,integer,jsonb,jsonb,jsonb,jsonb,integer)','warehouse','''remove-zone''');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_purchase_tent_equipment(uuid,uuid,text[],integer)','equipment','''purchase''');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_upgrade_tent_equipment(uuid,uuid,text,integer,integer)','equipment','''upgrade''');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_repair_tent_machine(uuid,text,integer,integer,uuid,integer)','equipment','''repair''');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_replace_tent_culture_equipment(uuid,text,integer,integer,uuid,integer)','equipment','''replace''');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_purchase_workshop_tier(uuid,uuid,text,integer,integer,integer)','equipment','''workshop-tier''');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_equip_tent_equipment(uuid,text,integer)','equipment','''install''',
 'EXISTS(SELECT 1 FROM public.kq_equipment_loadouts WHERE user_id=p_user_id AND equipment_code=p_equipment_code AND tent_number=public.kq_equipment_storage_tent_for_user(p_user_id,p_equipment_code,p_tent_number))');
SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_pay_energy(uuid,uuid,integer)','administration','''pay-energy''');
DROP FUNCTION pg_temp.kq_player_work_wrap(TEXT,TEXT,TEXT,TEXT);

-- These two composite commands are one confirmed action. Their child receipts
-- remain unchanged, but child work costs must not be charged a second time.
DO $$ DECLARE spec RECORD; body TEXT; anchor TEXT; BEGIN
 FOR spec IN SELECT * FROM (VALUES
  ('public.kq_commerce_command_before_invoice_batch(uuid,text,jsonb,uuid)','public.rpc_kq_online_command(','public.kq_work_inner_online_command('),
  ('public.kq_work_inner_purchase_workshop_tier(uuid,uuid,text,integer,integer,integer)','public.rpc_kq_purchase_tent_equipment(','public.kq_work_inner_purchase_tent_equipment('),
  ('public.kq_work_inner_purchase_workshop_tier(uuid,uuid,text,integer,integer,integer)','public.rpc_kq_upgrade_tent_equipment(','public.kq_work_inner_upgrade_tent_equipment(')
 ) AS patches(signature,before_text,after_text) LOOP
  body:=pg_get_functiondef(spec.signature::regprocedure);
  IF (length(body)-length(replace(body,spec.before_text,'')))/length(spec.before_text)<>1
   THEN RAISE EXCEPTION 'player_work_composite_drift: %',spec.signature; END IF;
  EXECUTE replace(body,spec.before_text,spec.after_text);
 END LOOP;
 -- Bank reads also settle. Acquire the same first lock before its existing
 -- wallet lock, avoiding wallet -> advisory / advisory -> wallet inversion.
 body:=replace(pg_get_functiondef('public.rpc_kq_bank(uuid,jsonb)'::regprocedure),chr(13),'');
 anchor:=E'\nBEGIN\n';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'player_work_bank_lock_drift'; END IF;
 EXECUTE replace(body,anchor,anchor||E' PERFORM pg_advisory_xact_lock(hashtextextended(''kq-equipment:''||p_user_id::TEXT,0));\n');
END $$;

COMMIT;
