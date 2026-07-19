DO $permissions$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.rpc_create_contest_review_atomic(text, text, uuid, text, public.contest_consumption_method, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated';
  EXECUTE 'REVOKE ALL ON FUNCTION public.rpc_update_contest_review_atomic(uuid, uuid, text, public.contest_consumption_method, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.rpc_create_contest_review_atomic(text, text, uuid, text, public.contest_consumption_method, text, text, jsonb, jsonb, jsonb) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.rpc_update_contest_review_atomic(uuid, uuid, text, public.contest_consumption_method, text, text, jsonb, jsonb, jsonb) TO service_role';
END
$permissions$;
