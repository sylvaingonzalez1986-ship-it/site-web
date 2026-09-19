BEGIN;

CREATE FUNCTION public.arena_valid_appearance(value JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE allowed JSONB := '{"hair":["crop","quiff","bob","long","curls","afro","braids","bun","ponytail","mohawk","buzz","bald"],"hairColor":["black","chestnut","blond","ginger","silver","pink","indigo","mint"],"face":["oval","round","square","heart","long","angular"],"eyes":["almond","round","relaxed","bright"],"eyeColor":["brown","blue","green","grey"],"eyebrows":["natural","thick","arched"],"nose":["small","round","wide"],"mouth":["smile","grin","calm"],"facialHair":["none","stubble","beard","moustache"],"top":["overalls","tee","hoodie","jacket","shirt","apron"],"bottom":["jeans","cargo","shorts","skirt"],"bottomColor":["teal","blue","ochre","berry","sage","violet"],"shoes":["boots","sneakers","high-tops","work"],"shoeColor":["teal","blue","ochre","berry","sage","violet"],"accessory":["none","glasses","round-glasses","earrings","scarf"]}'; entry RECORD;
BEGIN
 IF jsonb_typeof(value) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 FOR entry IN SELECT * FROM jsonb_each(value) LOOP
  IF NOT (allowed ? entry.key) OR jsonb_typeof(entry.value) <> 'string'
   OR NOT ((allowed->entry.key) @> jsonb_build_array(entry.value)) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.arena_valid_appearance(JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arena_valid_appearance(JSONB) TO service_role;
ALTER TABLE public.arena_chanvrier_profiles ADD COLUMN appearance JSONB NOT NULL DEFAULT '{}' CHECK(public.arena_valid_appearance(appearance));

-- Retain previously granted capital; only new treasurers receive the new 650-euro grant.
-- Updating appearance never re-grants it and preserves the immutable specialty.
DO $$
DECLARE original TEXT; definition TEXT;
BEGIN
 SELECT pg_get_functiondef('public.rpc_arena_save_chanvrier(uuid,jsonb)'::regprocedure) INTO original;
 IF position('bonus:=165000;' in original)=0 THEN RAISE EXCEPTION 'chanvrier_capital_drift'; END IF;
 definition:=replace(original,'bonus:=165000;','bonus:=65000;');
 IF position('arena_chanvrier_profiles(user_id,nickname,gender,clothing,skin,strength)' in definition)=0
  OR position('skin=EXCLUDED.skin,updated_at=now()' in definition)=0 THEN RAISE EXCEPTION 'chanvrier_appearance_drift'; END IF;
 definition:=replace(definition,'arena_chanvrier_profiles(user_id,nickname,gender,clothing,skin,strength)',
  'arena_chanvrier_profiles(user_id,nickname,gender,clothing,skin,strength,appearance)');
 definition:=replace(definition,'p_profile->>''skin'',p_profile->>''strength'')',
  'p_profile->>''skin'',p_profile->>''strength'',COALESCE(p_profile->''appearance'',previous.appearance,''{}''::jsonb))');
 definition:=replace(definition,'skin=EXCLUDED.skin,updated_at=now()', 'skin=EXCLUDED.skin,appearance=EXCLUDED.appearance,updated_at=now()');
 IF position('COALESCE(p_profile->''appearance''' in definition)=0 THEN RAISE EXCEPTION 'chanvrier_appearance_values_drift'; END IF;
 EXECUTE definition;

 SELECT pg_get_functiondef('public.rpc_kq_start_run_with_heritage(uuid,text,integer,text[],text[],jsonb,integer,text)'::regprocedure) INTO original;
 definition:=replace(original,'strength=''green-thumb'') THEN 4 ELSE 0 END;', 'strength=''green-thumb'') THEN 2 ELSE 0 END;');
 IF definition=original THEN RAISE EXCEPTION 'chanvrier_xp_drift'; END IF;
 EXECUTE definition;

 SELECT pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure) INTO original;
 definition:=replace(original,'strength=''merchant'') THEN 2 ELSE 1 END','strength=''merchant'') THEN 1.5 ELSE 1 END');
 IF definition=original THEN RAISE EXCEPTION 'chanvrier_commerce_multiplier_drift'; END IF;
 original:=definition;
 definition:=replace(definition,'strength=''merchant'') THEN 12000 ELSE 6000 END','strength=''merchant'') THEN 9000 ELSE 6000 END');
 IF definition=original THEN RAISE EXCEPTION 'chanvrier_commerce_recruitment_drift'; END IF;
 EXECUTE definition;

 SELECT pg_get_functiondef('public.kq_commerce_capacity(uuid)'::regprocedure) INTO original;
 definition:=replace(original,'p.strength=''merchant'' THEN 2 ELSE 1 END','p.strength=''merchant'' THEN 1.5 ELSE 1 END');
 IF definition=original THEN RAISE EXCEPTION 'chanvrier_capacity_drift'; END IF;
 EXECUTE definition;
END $$;
-- Discard quotes computed with the old capacity, recruitment or price bonus.
UPDATE public.kq_commerce_accounts a SET revision=revision+1
FROM public.arena_chanvrier_profiles p WHERE p.user_id=a.user_id AND p.strength='merchant';
COMMIT;
