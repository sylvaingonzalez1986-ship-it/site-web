BEGIN;
-- Award four XP on new cultures; preserve the XP of already-started runs.
DO $$
DECLARE original TEXT; definition TEXT;
BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_start_run_with_heritage(uuid,text,integer,text[],text[],jsonb,integer,text)'::regprocedure) INTO original;
 definition:=replace(original,
  'CASE WHEN EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength=''green-thumb'') THEN 2 ELSE 0 END;',
  'CASE WHEN EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength=''green-thumb'') THEN 4 ELSE 0 END;');
 IF definition=original THEN RAISE EXCEPTION 'chanvrier_green_thumb_xp_drift'; END IF;
 EXECUTE definition;
END $$;
COMMIT;
