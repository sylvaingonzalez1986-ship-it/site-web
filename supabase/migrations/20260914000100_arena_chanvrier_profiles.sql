BEGIN;

CREATE TABLE public.arena_chanvrier_profiles (
 user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 nickname TEXT NOT NULL CHECK(nickname ~ '^[A-Za-z0-9._-]{3,24}$'),
 gender TEXT NOT NULL CHECK(gender IN ('male','female')),
 clothing TEXT NOT NULL CHECK(clothing IN ('teal','blue','ochre','berry','sage','violet')),
 skin TEXT NOT NULL CHECK(skin IN ('ivory','peach','honey','copper','brown','ebony')),
 strength TEXT NOT NULL CHECK(strength IN ('green-thumb','treasurer','merchant','handyperson')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id) REFERENCES public.kq_equipment_wallets(user_id) ON DELETE CASCADE
);
ALTER TABLE public.arena_chanvrier_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.arena_chanvrier_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.arena_chanvrier_profiles TO service_role;

CREATE FUNCTION public.rpc_arena_save_chanvrier(p_user_id UUID,p_profile JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous public.arena_chanvrier_profiles%ROWTYPE; saved public.arena_chanvrier_profiles%ROWTYPE;
 bonus INTEGER:=0; fresh BOOLEAN; nickname_value TEXT:=btrim(p_profile->>'nickname');
BEGIN
 IF p_user_id IS NULL OR jsonb_typeof(p_profile) IS DISTINCT FROM 'object'
  OR nickname_value IS NULL OR nickname_value !~ '^[A-Za-z0-9._-]{3,24}$'
  OR COALESCE(p_profile->>'gender','') NOT IN ('male','female')
  OR COALESCE(p_profile->>'clothing','') NOT IN ('teal','blue','ochre','berry','sage','violet')
  OR COALESCE(p_profile->>'skin','') NOT IN ('ivory','peach','honey','copper','brown','ebony')
  OR COALESCE(p_profile->>'strength','') NOT IN ('green-thumb','treasurer','merchant','handyperson')
 THEN RAISE EXCEPTION 'chanvrier_invalid_profile'; END IF;
 -- Same wallet lock as purchases, sales and cycle completion. Concurrent retries cannot grant twice.
 PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO previous FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id FOR UPDATE;
 fresh:=NOT FOUND;
 IF NOT fresh AND previous.strength<>p_profile->>'strength' THEN RAISE EXCEPTION 'chanvrier_strength_locked'; END IF;
 INSERT INTO public.contest_profiles(customer_id,pseudo) VALUES(p_user_id,nickname_value)
 ON CONFLICT(customer_id) DO UPDATE SET pseudo=EXCLUDED.pseudo,updated_at=now();
 INSERT INTO public.arena_chanvrier_profiles(user_id,nickname,gender,clothing,skin,strength)
 VALUES(p_user_id,nickname_value,p_profile->>'gender',p_profile->>'clothing',p_profile->>'skin',p_profile->>'strength')
 ON CONFLICT(user_id) DO UPDATE SET nickname=EXCLUDED.nickname,gender=EXCLUDED.gender,clothing=EXCLUDED.clothing,skin=EXCLUDED.skin,updated_at=now()
 RETURNING * INTO saved;
 IF fresh AND saved.strength='treasurer' THEN
  bonus:=35000;
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+bonus,updated_at=now() WHERE user_id=p_user_id;
 END IF;
 -- Any quote made before choosing the commercial specialty must be refreshed.
 IF fresh THEN UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id; END IF;
 RETURN jsonb_build_object('profile',to_jsonb(saved)-'user_id'-'created_at'-'updated_at','startingBonusCents',bonus,'created',fresh);
END $$;
REVOKE ALL ON FUNCTION public.rpc_arena_save_chanvrier(UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_arena_save_chanvrier(UUID,JSONB) TO service_role;

CREATE FUNCTION public.arena_sync_chanvrier_nickname() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN UPDATE public.arena_chanvrier_profiles SET nickname=NEW.pseudo,updated_at=now() WHERE user_id=NEW.customer_id; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.arena_sync_chanvrier_nickname() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER arena_sync_chanvrier_nickname AFTER UPDATE OF pseudo ON public.contest_profiles
FOR EACH ROW EXECUTE FUNCTION public.arena_sync_chanvrier_nickname();

-- Extend the existing rare-Buddie/heritage validation without changing those bonuses or the base RPC.
DO $$
DECLARE definition TEXT; original TEXT;
BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_start_run_with_heritage(uuid,text,integer,text[],text[],jsonb,integer,text)'::regprocedure) INTO original;
 definition:=replace(original,'v_expected_xp := v_base_xp + v_buddie_xp + v_heritage_xp;',
  'v_expected_xp := v_base_xp + v_buddie_xp + v_heritage_xp + CASE WHEN EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength=''green-thumb'') THEN 2 ELSE 0 END;');
 definition:=replace(definition,'IF v_buddie_xp > 0 OR v_heritage_xp > 0 THEN','IF v_expected_xp > v_base_xp THEN');
 IF definition=original OR position('v_expected_xp := v_base_xp + v_buddie_xp + v_heritage_xp;' in definition)>0
  OR position('IF v_buddie_xp > 0 OR v_heritage_xp > 0 THEN' in definition)>0 THEN RAISE EXCEPTION 'chanvrier_start_function_drift'; END IF;
 EXECUTE definition;
END $$;

-- Add the immutable specialty to the existing commerce read, without an extra round trip.
DO $$
DECLARE definition TEXT; original TEXT;
BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_commerce_state(uuid)'::regprocedure) INTO original;
 definition:=replace(original,'''revision'',a.revision,''cashCents'',w.cash_cents',
  '''strength'',(SELECT strength FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id),''revision'',a.revision,''cashCents'',w.cash_cents');
 IF definition=original THEN RAISE EXCEPTION 'chanvrier_commerce_state_drift'; END IF;
 EXECUTE definition;
 -- Match the authoritative shop recruitment validation to the new specialty.
 SELECT pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure) INTO original;
 definition:=replace(original,'shop_good:=c.shop_good_units+equivalent_qty*CASE',
  'shop_good:=c.shop_good_units+equivalent_qty*(CASE WHEN EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength=''merchant'') THEN 2 ELSE 1 END)*CASE');
 definition:=replace(definition,'shop_recruit:=c.shop_recruitment_start+LEAST(6000,shop_good);',
  'shop_recruit:=c.shop_recruitment_start+LEAST(CASE WHEN EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength=''merchant'') THEN 12000 ELSE 6000 END,shop_good);');
 IF definition=original OR position('shop_recruit:=c.shop_recruitment_start+LEAST(6000,shop_good);' in definition)>0 THEN RAISE EXCEPTION 'chanvrier_commerce_command_drift'; END IF;
 EXECUTE definition;
END $$;
COMMIT;
