BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Keep the established automatic policy and its in-flight tokens. Explicit
-- choices reuse every volume, machine, contract and payroll guard, and can
-- only fund the next segment. Historical segments are never reassigned.
DO $$ DECLARE body TEXT; spec RECORD; BEGIN
 body:=pg_get_functiondef('public.kq_processing_work_preview(uuid,uuid,jsonb)'::regprocedure);
 FOR spec IN SELECT * FROM (VALUES
  ('public.kq_processing_work_preview(p_user uuid, p_flower uuid, p_work jsonb)',
   'public.kq_processing_work_preview_actor(p_user uuid, p_flower uuid, p_work jsonb, p_actor text)'),
  (' WHERE t->''processingShift''=''true''::JSONB',
   ' WHERE p_actor<>''player'' AND (p_actor=''auto'' OR (t->>''employeeId''=p_actor AND (t->>''day'')::INTEGER=current_day)) AND t->''processingShift''=''true''::JSONB'),
  (' WHERE h.user_id=p_user AND h.kind=''task'' AND h.payload->''processingShift''=''true''::JSONB',
   ' WHERE p_actor<>''player'' AND (p_actor=''auto'' OR (h.payload->>''employeeId''=p_actor AND (h.payload->>''day'')::INTEGER=current_day)) AND h.user_id=p_user AND h.kind=''task'' AND h.payload->''processingShift''=''true''::JSONB'),
  ('  available_hours:=player_remaining;', E'  available_hours:=player_remaining;\n  IF p_actor NOT IN (''auto'',''player'') THEN reason:=''Ce salarié ne dispose pas de réserve Transformation pour ce lot aujourd’hui.''; END IF;'),
  ('  IF delegated THEN reason:=', '  IF delegated AND p_actor=''auto'' THEN reason:='),
  -- Other personal actions spend hundredths; processing books half-hours.
  -- Keep the displayed real balance and preserve its unbookable remainder.
  (' available_hours:=LEAST(available_hours,GREATEST(', ' available_hours:=LEAST(CASE WHEN mod(available_hours,.5)=0 THEN available_hours ELSE floor(available_hours*2)/2 END,GREATEST('),
  (' RETURN result||jsonb_build_object(''token'',', E' IF p_actor<>''auto'' THEN result:=result||jsonb_build_object(''actorId'',p_actor); END IF;\n RETURN result||jsonb_build_object(''token'',')
 ) s(before_text,after_text) LOOP
  IF (length(body)-length(replace(body,spec.before_text,'')))/length(spec.before_text)<>1
   THEN RAISE EXCEPTION 'processing_actor_preview_drift: %',spec.before_text; END IF;
  body:=replace(body,spec.before_text,spec.after_text);
 END LOOP;
 EXECUTE body;
END $$;
REVOKE ALL ON FUNCTION public.kq_processing_work_preview_actor(UUID,UUID,JSONB,TEXT) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_processing_work_quote(p_user_id UUID,p_flower_id UUID,p_work JSONB,p_actor_id TEXT) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE selected TEXT:=COALESCE(p_actor_id,'auto'); result JSONB; choice JSONB; choices JSONB:='[]'; person RECORD;
BEGIN
 IF selected !~ '^[A-Za-z0-9_-]{1,128}$' THEN RAISE EXCEPTION 'processing_work_changed'; END IF;
 result:=public.kq_processing_work_preview_actor(p_user_id,p_flower_id,p_work,selected);
 choice:=public.kq_processing_work_preview_actor(p_user_id,p_flower_id,p_work,'player');
 choices:=jsonb_build_array(jsonb_build_object('id','player','name','Toi','employee',NULL,
  'remainingHours',choice->'playerRemainingHours','available',choice->>'source'<>'blocked','reason',choice->'blockedReason'));
 FOR person IN
  SELECT DISTINCT e->>'id' id,e->>'name' name
   FROM public.kq_staff_accounts a CROSS JOIN LATERAL jsonb_array_elements(a.state->'employees') e
   CROSS JOIN LATERAL jsonb_array_elements(a.state->'tasks') t
   WHERE a.user_id=p_user_id AND e->>'status'='active' AND t->>'employeeId'=e->>'id'
    AND t->'processingShift'='true'::JSONB AND (t->>'day')::INTEGER=public.kq_player_work_day(p_user_id)
    AND (t->>'targetId' IS NULL OR t->>'targetId'=p_flower_id::TEXT)
   ORDER BY name,id
 LOOP
  choice:=public.kq_processing_work_preview_actor(p_user_id,p_flower_id,p_work,person.id);
  choices:=choices||jsonb_build_array(jsonb_build_object('id',person.id,'name',person.name,'employee',choice->'employee',
   'remainingHours',COALESCE(choice#>'{employee,remainingHours}','0'::JSONB),
   'available',choice->>'source'='employee','reason',choice->'blockedReason'));
 END LOOP;
 RETURN result||jsonb_build_object('actorChoiceVersion',1,'actorId',selected,'actors',choices);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_processing_work_quote(UUID,UUID,JSONB,TEXT) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_processing_work_quote(UUID,UUID,JSONB,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_processing_work_quote(p_user_id UUID,p_flower_id UUID,p_work JSONB) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.rpc_kq_processing_work_quote(p_user_id,p_flower_id,p_work,'auto');
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_processing_work_quote(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_processing_work_quote(UUID,UUID,JSONB) TO service_role;

-- The existing commerce transaction carries the requested actor through its
-- preparation trigger. Atomic locking, strict payload replay, exact token
-- checks, employee-reserve debit and XP receipt stay in their original code.
DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 body:=pg_get_functiondef('public.kq_processing_work_start(uuid,uuid,text)'::regprocedure);
 anchor:='quote:=public.kq_processing_work_preview(p_user,p_flower,job.work);';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'processing_actor_start_drift'; END IF;
 EXECUTE replace(body,anchor,'quote:=public.kq_processing_work_preview_actor(p_user,p_flower,job.work,COALESCE(NULLIF(current_setting(''kq.processing_actor'',true),''''),''auto''));');

 body:=pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure);
 anchor:=' fid:=(p_payload->>''flowerId'')::UUID;';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'processing_actor_command_drift'; END IF;
 body:=replace(body,anchor,anchor||$guard$
 IF p_payload ? 'actorId' AND (jsonb_typeof(p_payload->'actorId') IS DISTINCT FROM 'string'
  OR (p_payload->>'actorId') !~ '^[A-Za-z0-9_-]{1,128}$') THEN RAISE EXCEPTION 'processing_work_changed'; END IF;
 IF COALESCE(p_payload->>'actorId','auto')<>'auto' AND p_action='prepare' AND NOT EXISTS(
  SELECT 1 FROM public.kq_market_lots l,jsonb_array_elements(l.options) q
   WHERE l.flower_id=fid AND l.owner_id=p_user_id AND q->>'route'=p_payload->>'route'
    AND q->'processingWork'->'version'='1'::JSONB)
  THEN RAISE EXCEPTION 'processing_work_unavailable'; END IF;
 PERFORM set_config('kq.processing_actor',COALESCE(p_payload->>'actorId','auto'),true);$guard$);
 anchor:=' RETURN result||jsonb_build_object(''processingJobs'',public.kq_processing_jobs_snapshot(p_user_id));';
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'processing_actor_cleanup_drift'; END IF;
 EXECUTE replace(body,anchor,E' PERFORM set_config(''kq.processing_actor'','''',true);\n'||anchor);
END $$;

COMMIT;
