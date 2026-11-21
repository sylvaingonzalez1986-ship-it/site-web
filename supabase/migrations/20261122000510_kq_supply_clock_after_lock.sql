BEGIN;

-- A transaction may wait for the player lock while another player action
-- programs irrigation. Check eligibility at acquisition of the lock so that
-- a newly committed hold is already visible when the waiting action resumes.
-- The one-argument callers use the live clock; a seed passes its exact time.
DROP FUNCTION public.kq_supply_free(uuid);
CREATE FUNCTION public.kq_supply_free(p_user uuid,p_at timestamptz DEFAULT clock_timestamp()) RETURNS TABLE(code text,units int8multirange)
LANGUAGE sql STABLE SET search_path='' AS $$
 WITH layout AS (SELECT w.state FROM public.kq_warehouse_layouts w WHERE w.user_id=p_user),
 held AS (
  SELECT i.code,i.held_units FROM public.kq_warehouse_run_inputs i JOIN public.kq_runs r ON r.id=i.run_id
   WHERE r.user_id=p_user AND r.status='active' AND i.reserved>0
  UNION ALL
  SELECT e.key,e.value::int8multirange FROM layout, LATERAL public.kq_warehouse_live_programs(p_user,layout.state,
   CASE WHEN layout.state ? 'stationPlacements' THEN public.kq_warehouse_preparation_station_coverage(layout.state) ELSE '{}'::jsonb END,p_at) p
   CROSS JOIN LATERAL jsonb_each_text(p.held_units) e
 ), totals AS (SELECT h.code,range_agg(h.held_units) AS units FROM held h GROUP BY h.code)
 SELECT s.code,s.remaining_units-coalesce(t.units,'{}'::int8multirange) FROM public.kq_warehouse_input_stock s
 LEFT JOIN totals t ON t.code=s.code WHERE s.user_id=p_user AND s.issued>0;
$$;
REVOKE ALL ON FUNCTION public.kq_supply_free(uuid,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

DO $migration$
DECLARE
 body text:=replace(pg_get_functiondef('public.kq_warehouse_launch_preparations(uuid,uuid,uuid[],jsonb,text)'::regprocedure),chr(13),'');
 lock_call text:=$anchor$PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::text,0));$anchor$;
 stock_lookup text:='LEFT JOIN public.kq_supply_free(p_user) f ON f.code=p.code';
BEGIN
 IF length(body)-length(replace(body,lock_call,''))<>length(lock_call) OR
    length(body)-length(replace(body,stock_lookup,''))<>length(stock_lookup) THEN
  RAISE EXCEPTION 'supply_clock_launch_definition_changed';
 END IF;
 body:=replace(body,lock_call,lock_call||chr(10)||' at:=clock_timestamp();');
 EXECUTE replace(body,stock_lookup,'LEFT JOIN public.kq_supply_free(p_user,at) f ON f.code=p.code');
END $migration$;

COMMIT;
