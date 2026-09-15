BEGIN;
-- Serialize with profile creation and wallet operations while updating the one-time grant.
LOCK TABLE public.kq_equipment_wallets, public.arena_chanvrier_profiles IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE original TEXT; definition TEXT;
BEGIN
 SELECT pg_get_functiondef('public.rpc_arena_save_chanvrier(uuid,jsonb)'::regprocedure) INTO original;
 definition:=replace(original,'bonus:=35000;','bonus:=165000;');
 IF definition=original THEN RAISE EXCEPTION 'chanvrier_treasurer_bonus_drift'; END IF;
 EXECUTE definition;
END $$;
-- Existing treasurers already received 350 euros. Add only the 1300-euro difference,
-- preserving their purchases and earnings. This runs once with the migration.
UPDATE public.kq_equipment_wallets w SET cash_cents=w.cash_cents+130000,updated_at=now()
FROM public.arena_chanvrier_profiles p WHERE p.user_id=w.user_id AND p.strength='treasurer';
UPDATE public.kq_commerce_accounts a SET revision=a.revision+1
FROM public.arena_chanvrier_profiles p WHERE p.user_id=a.user_id AND p.strength='treasurer';
COMMIT;
