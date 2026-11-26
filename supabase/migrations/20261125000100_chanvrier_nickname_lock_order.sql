BEGIN;

-- Both nickname writers take the contest row before the character row.
-- The wallet remains the first lock for game saves, including first-time grants.
DO $migration$
DECLARE
  definition text := replace(pg_get_functiondef('public.rpc_arena_save_chanvrier(uuid,jsonb)'::regprocedure), E'\r\n', E'\n');
  read_character constant text := concat_ws(E'\n',
    ' SELECT * INTO previous FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id FOR UPDATE;',
    ' fresh:=NOT FOUND;',
    $sql$ IF NOT fresh AND previous.strength<>p_profile->>'strength' THEN RAISE EXCEPTION 'chanvrier_strength_locked'; END IF;$sql$);
  write_contest constant text := concat_ws(E'\n',
    ' INSERT INTO public.contest_profiles(customer_id,pseudo) VALUES(p_user_id,nickname_value)',
    ' ON CONFLICT(customer_id) DO UPDATE SET pseudo=EXCLUDED.pseudo,updated_at=now();');
  old_order constant text := read_character || E'\n' || write_contest;
  new_order constant text := write_contest || E'\n' || read_character;
BEGIN
  IF strpos(definition, old_order) = 0 THEN
    RAISE EXCEPTION 'chanvrier_nickname_lock_order_drift';
  END IF;
  EXECUTE replace(definition, old_order, new_order);
END $migration$;

COMMIT;
