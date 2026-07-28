BEGIN;

DO $$
DECLARE
  v_signature REGPROCEDURE :=
    'public.rpc_kq_play_support_card(uuid,uuid,text,smallint,text,timestamptz,jsonb)'::REGPROCEDURE;
  v_definition TEXT;
  v_old_check TEXT := 'OR v_category <> p_use_kind';
  v_new_check TEXT := 'OR (p_use_kind = ''pbi'') IS DISTINCT FROM (v_category = ''pbi'')';
BEGIN
  v_definition := pg_get_functiondef(v_signature);

  IF STRPOS(v_definition, v_old_check) = 0 THEN
    RAISE EXCEPTION 'kq_support_card_category_check_not_found';
  END IF;

  EXECUTE REPLACE(v_definition, v_old_check, v_new_check);
END;
$$;

COMMIT;
