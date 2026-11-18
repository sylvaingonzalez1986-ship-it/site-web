BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE FUNCTION public.kq_player_planned_hours(p_state JSONB,p_day INTEGER) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT COALESCE(sum((p#>>'{assignment,hours}')::NUMERIC),0)
 FROM jsonb_array_elements(COALESCE(p_state->'dayPlans','[]'::JSONB)) p
 WHERE p->>'assigneeId'='player' AND (p->>'day')::INTEGER=p_day;
$$;
REVOKE ALL ON FUNCTION public.kq_player_planned_hours(JSONB,INTEGER) FROM PUBLIC,anon,authenticated,service_role;

-- Use the same reservations inside the locked debit and the independent quotes.
DO $$ DECLARE spec RECORD; body TEXT; BEGIN
 FOR spec IN SELECT * FROM (VALUES
  ('public.kq_player_work_charge(uuid,numeric)','IF used+p_hours>12','IF used+public.kq_player_planned_hours(next_state,current_day)+p_hours>12'),
  ('public.kq_culture_work_preview_before_actor_choice(uuid,uuid,text)','12-COALESCE((staff->''playerWorkDays''','12-public.kq_player_planned_hours(staff,current_day)-COALESCE((staff->''playerWorkDays'''),
  ('public.kq_processing_work_preview_actor(uuid,uuid,jsonb,text)','12-COALESCE((staff->''playerWorkDays''','12-public.kq_player_planned_hours(staff,current_day)-COALESCE((staff->''playerWorkDays'''),
  ('public.kq_processing_work_preview(uuid,uuid,jsonb)','12-COALESCE((staff->''playerWorkDays''','12-public.kq_player_planned_hours(staff,current_day)-COALESCE((staff->''playerWorkDays''')
 ) s(signature,anchor,replacement) LOOP
  body:=pg_get_functiondef(spec.signature::regprocedure);
  IF (length(body)-length(replace(body,spec.anchor,'')))/length(spec.anchor)<>1 THEN RAISE EXCEPTION 'team_workday_migration_drift: %',spec.signature; END IF;
  EXECUTE replace(body,spec.anchor,spec.replacement);
 END LOOP;
END $$;

-- Instant work has no running interval. Record the actual amount at charge time,
-- after the original domain's receipt/no-op guards and inside its transaction.
CREATE FUNCTION public.kq_player_work_record_action(p_user UUID,p_hours NUMERIC,p_domain TEXT,p_action TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE current_day INTEGER; entry JSONB;
BEGIN
 PERFORM public.kq_player_work_charge(p_user,p_hours);
 IF p_hours=0 THEN RETURN; END IF;
 current_day:=public.kq_player_work_day(p_user);
 entry:=jsonb_build_object('at',now(),'domain',p_domain,'action',p_action,'hours',p_hours);
 UPDATE public.kq_staff_accounts SET state=jsonb_set(state,'{playerActions}',
   jsonb_build_object('day',current_day,'entries',
    (CASE WHEN state#>>'{playerActions,day}'=current_day::TEXT THEN state#>'{playerActions,entries}' ELSE '[]'::JSONB END)
    ||jsonb_build_array(entry))) WHERE user_id=p_user;
END $$;
REVOKE ALL ON FUNCTION public.kq_player_work_record_action(UUID,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon,authenticated,service_role;

-- Keep both the legacy base cost and the skill-based cost exactly as installed.
-- The dynamic inventory includes guarded wrappers that were renamed by later
-- migrations. Explicit charge calls in the culture and workshop ledgers remain intact.
DO $$ DECLARE proc RECORD; body TEXT; updated TEXT;
 pattern TEXT:=$pattern$PERFORM public\.kq_player_work_charge\(p_user_id,(public\.kq_player_work_cost\((?:p_user_id,)?('[a-z]+'),([^;]+?)\))\);$pattern$;
BEGIN
 FOR proc IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosrc LIKE '%PERFORM public.kq_player_work_charge(p_user_id,public.kq_player_work_cost(%'
 LOOP
  body:=pg_get_functiondef(proc.oid);
  updated:=regexp_replace(body,pattern,'PERFORM public.kq_player_work_record_action(p_user_id,\1,\2,\3);','g');
  IF updated=body OR position('PERFORM public.kq_player_work_charge(p_user_id,public.kq_player_work_cost(' IN updated)>0
   THEN RAISE EXCEPTION 'team_workday_action_drift: %',proc.oid::regprocedure; END IF;
  EXECUTE updated;
 END LOOP;
END $$;

-- Read the original receipts, including earlier segments of a lot. The passive
-- machine/drying deadline never identifies time worked by a person.
CREATE FUNCTION public.kq_team_work_receipts(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH today AS (SELECT public.kq_player_work_day(p_user) AS game_day), entries AS (
  SELECT jsonb_build_object('id','segment-'||j.flower_id::TEXT||'-'||n::TEXT,'kind','processing',
   'assigneeId',COALESCE(s#>>'{actor,id}','player'),'target',COALESCE(f.variety_name,'Lot en transformation'),
   'hours',(s->>'bookedHours')::NUMERIC,'startedAt',s->'startedAt','completesAt',s->'readyAt') entry
  FROM public.kq_processing_jobs j JOIN public.kq_flowers f ON f.id=j.flower_id
  CROSS JOIN LATERAL jsonb_array_elements(j.segments) WITH ORDINALITY AS segments(s,n) CROSS JOIN today
  WHERE j.user_id=p_user AND j.updated_at>=now()-interval '4 hours' AND (s->>'day')::INTEGER=today.game_day
  UNION ALL
  SELECT jsonb_build_object('id','stage-'||c.run_id::TEXT||'-'||c.stage_index::TEXT,'kind','culture',
   'assigneeId',COALESCE(c.work#>>'{employee,id}','player'),'target',COALESCE(r.state->>'varietyName','Culture'),
   'stage',c.stage_index,'hours',(c.work->>'stepHours')::NUMERIC,'startedAt',c.created_at,'completesAt',c.created_at)
  FROM public.kq_culture_work_steps c JOIN public.kq_runs r ON r.id=c.run_id CROSS JOIN today
  WHERE c.user_id=p_user AND c.created_at>=now()-interval '4 hours' AND (c.work->>'day')::INTEGER=today.game_day
    AND c.work->>'source' IN ('player','employee')
 ) SELECT COALESCE(jsonb_agg(entry ORDER BY (entry->>'startedAt')::TIMESTAMPTZ,entry->>'id'),'[]'::JSONB) FROM entries;
$$;
REVOKE ALL ON FUNCTION public.kq_team_work_receipts(UUID) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.kq_staff_snapshot(UUID) RENAME TO kq_staff_snapshot_before_team_receipts;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot_before_team_receipts(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_staff_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_set(s,'{context,teamWork}',public.kq_team_work_receipts(p_user))
 FROM (SELECT public.kq_staff_snapshot_before_team_receipts(p_user) s) source;
$$;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
