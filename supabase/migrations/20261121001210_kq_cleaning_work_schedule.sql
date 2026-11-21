BEGIN;

CREATE FUNCTION public.kq_warehouse_actor_cleaning_until(p_user UUID,p_actor TEXT,p_at TIMESTAMPTZ) RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT max(ends_at) FROM public.kq_warehouse_cleaning_work
 WHERE user_id=p_user AND actor=CASE WHEN p_actor='player' THEN p_actor ELSE 'employee:'||p_actor END
  AND starts_at<=p_at AND ends_at>p_at;
$$;

ALTER FUNCTION public.kq_team_work_receipts(UUID) RENAME TO kq_team_work_before_cleaning;
CREATE FUNCTION public.kq_team_work_receipts(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH entries AS (
  SELECT entry FROM jsonb_array_elements(public.kq_team_work_before_cleaning(p_user)) entry
  UNION ALL
  SELECT jsonb_build_object('id','cleaning-'||request_key::TEXT,'kind','cleaning',
   'assigneeId',CASE WHEN actor='player' THEN actor ELSE substring(actor FROM 10) END,
   'target',CASE step WHEN 'vacuum' THEN 'Passer l’aspirateur' ELSE 'Passer la serpillière' END,
   'hours',extract(epoch FROM ends_at-starts_at)/600,'startedAt',starts_at,'completesAt',ends_at)
  FROM public.kq_warehouse_cleaning_work
  WHERE user_id=p_user AND starts_at>=now()-interval '4 hours'
   AND public.kq_player_work_day(p_user,starts_at)=public.kq_player_work_day(p_user)
 ) SELECT COALESCE(jsonb_agg(entry ORDER BY (entry->>'startedAt')::TIMESTAMPTZ,entry->>'id'),'[]'::JSONB) FROM entries;
$$;

CREATE FUNCTION public.kq_validate_new_work_during_cleaning(p_user UUID,p_previous JSONB,p_next JSONB) RETURNS VOID
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF EXISTS(
  SELECT 1 FROM jsonb_array_elements(p_next->'tasks') task
  JOIN public.kq_warehouse_cleaning_work cleaning ON cleaning.user_id=p_user
   AND cleaning.actor=CASE WHEN task->>'employeeId'='player' THEN 'player' ELSE 'employee:'||(task->>'employeeId') END
   AND cleaning.starts_at<(task->>'completesAt')::TIMESTAMPTZ AND cleaning.ends_at>(task->>'startedAt')::TIMESTAMPTZ
  WHERE task->'cultureShift' IS DISTINCT FROM 'true'::JSONB AND task->'processingShift' IS DISTINCT FROM 'true'::JSONB
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_previous->'tasks') old WHERE old->>'id'=task->>'id')
 ) THEN RAISE EXCEPTION 'kq_preparation_operator_busy'; END IF;
END $$;

CREATE FUNCTION pg_temp.kq_cleaning_schedule_patch(p_target REGPROCEDURE,p_before TEXT,p_after TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE body TEXT:=pg_get_functiondef(p_target);
BEGIN
 IF (length(body)-length(replace(body,p_before,'')))/length(p_before)<>1
  THEN RAISE EXCEPTION 'cleaning_schedule_anchor_changed: %',p_target; END IF;
 EXECUTE replace(body,p_before,p_after);
END $$;

-- Instant player work uses the same equipment lock as the cleaning command.
-- Retried receipts have already been resolved before their charge is reached.
SELECT pg_temp.kq_cleaning_schedule_patch('public.kq_player_work_charge(uuid,numeric)',
 'PERFORM pg_advisory_xact_lock(hashtextextended(''kq-equipment:''||p_user::TEXT,0));',
 $patch$PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::TEXT,0));
 IF public.kq_warehouse_actor_cleaning_until(p_user,'player',now()) IS NOT NULL
 THEN RAISE EXCEPTION 'kq_preparation_operator_busy'; END IF;$patch$);

SELECT pg_temp.kq_cleaning_schedule_patch('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)',
 'PERFORM public.kq_staff_apply_trim_handling(p_user_id,account.state,p_state);',
 E'PERFORM public.kq_validate_new_work_during_cleaning(p_user_id,account.state,p_state);\n PERFORM public.kq_staff_apply_trim_handling(p_user_id,account.state,p_state);');

-- The machine may be free while its operator finishes cleaning. Quote and
-- commit both run the existing active-work calculation after that interval.
SELECT pg_temp.kq_cleaning_schedule_patch('public.kq_processing_work_preview_actor(uuid,uuid,jsonb,text)',
 'starts:=GREATEST(starts,COALESCE(employee_until,now()));',
 $patch$starts:=GREATEST(starts,COALESCE(employee_until,now()),
  public.kq_warehouse_actor_cleaning_until(p_user,COALESCE(actor->>'id','player'),now()));$patch$);
SELECT pg_temp.kq_cleaning_schedule_patch('public.kq_processing_work_preview(uuid,uuid,jsonb)',
 'starts:=GREATEST(starts,COALESCE(employee_until,now()));',
 $patch$starts:=GREATEST(starts,COALESCE(employee_until,now()),
  public.kq_warehouse_actor_cleaning_until(p_user,COALESCE(actor->>'id','player'),now()));$patch$);

-- A Culture reservation is a budget. Its skill and hours remain available,
-- while an instantaneous played step needs an operator who is free now.
SELECT pg_temp.kq_cleaning_schedule_patch('public.kq_culture_work_preview_before_actor_choice(uuid,uuid,text)',
 'AND e->>''status''=''active'' AND (e->>''hiredAt'')::TIMESTAMPTZ<=now()',
 $patch$AND e->>'status'='active' AND (e->>'hiredAt')::TIMESTAMPTZ<=now()
    AND public.kq_warehouse_actor_cleaning_until(p_user,e->>'id',now()) IS NULL$patch$);
SELECT pg_temp.kq_cleaning_schedule_patch('public.kq_culture_work_preview(uuid,uuid,text)',
 'AND e->>''status''=''active'' AND (e->>''hiredAt'')::TIMESTAMPTZ<=now()',
 $patch$AND e->>'status'='active' AND (e->>'hiredAt')::TIMESTAMPTZ<=now()
   AND public.kq_warehouse_actor_cleaning_until(p_user,e->>'id',now()) IS NULL$patch$);
SELECT pg_temp.kq_cleaning_schedule_patch('public.kq_culture_work_preview_before_actor_choice(uuid,uuid,text)',
 'IF run.state->>''phase''=''prepare'' AND source=''player'' AND remaining<.5',
 $patch$IF run.state->>'phase'='prepare' AND source='player' AND public.kq_warehouse_actor_cleaning_until(p_user,'player',now()) IS NOT NULL
 THEN source:='blocked'; reason:='Tu termines le nettoyage de l’entrepôt.';
 END IF;
 IF run.state->>'phase'='prepare' AND source='player' AND remaining<.5$patch$);
SELECT pg_temp.kq_cleaning_schedule_patch('public.kq_culture_work_preview(uuid,uuid,text)',
 'source:=''player'';',
 $patch$source:='player';
  IF public.kq_warehouse_actor_cleaning_until(p_user,'player',now()) IS NOT NULL
  THEN RETURN quote||jsonb_build_object('source','blocked','employee',NULL,'bonus',bonus,
    'reason','Tu termines le nettoyage de l’entrepôt.'); END IF;$patch$);

REVOKE ALL ON FUNCTION public.kq_warehouse_actor_cleaning_until(UUID,TEXT,TIMESTAMPTZ),public.kq_team_work_before_cleaning(UUID),
 public.kq_team_work_receipts(UUID),public.kq_validate_new_work_during_cleaning(UUID,JSONB,JSONB)
 FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
