BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Receipts exist only after payment settles, including each online packet.
-- Cancelled/unpaid offers create no receipt. The online-sales mirror and cash
-- ledger must not be added again. Keep net sales before operating expenses.
CREATE INDEX IF NOT EXISTS kq_business_sales_season
 ON public.kq_market_sale_receipts(owner_id,created_at) INCLUDE(payout_cents,vat_cents);

-- A whole-room run (v1), a single zone (v2), or the frozen legacy tent list.
-- Never infer old cultivated area from today's purchased equipment or layout.
CREATE FUNCTION public.kq_business_run_areas(p_state JSONB)
RETURNS TABLE(space_key TEXT,area_m2 NUMERIC)
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN p_state->'warehouse'->>'version'='2'
   THEN 'zone:'||(p_state->'warehouse'->>'zoneId') ELSE 'whole-warehouse' END,
  CASE WHEN jsonb_typeof(p_state->'warehouse'->'activeAreaM2')='number'
   THEN GREATEST(0,(p_state->'warehouse'->>'activeAreaM2')::NUMERIC) ELSE 0 END
 WHERE p_state ? 'warehouse'
 UNION ALL
 SELECT 'tent:'||tent.tent_number::TEXT,MAX(CASE code.value
   WHEN 'TENT-080-STARTER' THEN 0.81 WHEN 'TENT-120' THEN 1.44 WHEN 'TENT-150' THEN 2.25 ELSE 0 END)
 FROM public.kq_run_tents(p_state) tent
 CROSS JOIN LATERAL jsonb_array_elements_text(tent.codes) code(value)
 WHERE NOT(p_state ? 'warehouse')
 GROUP BY tent.tent_number;
$$;
REVOKE ALL ON FUNCTION public.kq_business_run_areas(JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_business_development_score_for_season(
 p_user_id UUID,p_season_code TEXT,p_at TIMESTAMPTZ DEFAULT statement_timestamp()
) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH season AS (
  SELECT MAX(COALESCE(starts_at,activated_at,created_at)) AS starts_at,
   MAX(LEAST(ends_at,closed_at)) AS ends_at
  FROM public.kq_seasons WHERE season_code=p_season_code
 ), calculation_window AS (
  SELECT starts_at,ends_at,LEAST(COALESCE(p_at,statement_timestamp()),ends_at) AS as_of FROM season
 ), run_intervals AS MATERIALIZED (
  SELECT area.space_key,area.area_m2,
   GREATEST(run.started_at,calculation_window.as_of-INTERVAL '720 hours') AS from_at,
   LEAST(calculation_window.as_of,CASE WHEN run.status='active' THEN calculation_window.as_of
     WHEN run.status='completed' THEN run.completed_at ELSE run.updated_at END) AS to_at
  FROM calculation_window JOIN public.kq_runs run ON run.user_id=p_user_id AND run.started_at<calculation_window.as_of
  CROSS JOIN LATERAL public.kq_business_run_areas(run.state) area
  WHERE area.area_m2>0 AND (run.status='active' OR
   COALESCE(run.completed_at,run.updated_at)>calculation_window.as_of-INTERVAL '720 hours')
 ), boundaries AS (
  SELECT space_key,from_at AS at FROM run_intervals WHERE to_at>from_at
  UNION SELECT space_key,to_at FROM run_intervals WHERE to_at>from_at
 ), segments AS (
  SELECT space_key,at,LEAD(at) OVER(PARTITION BY space_key ORDER BY at) AS next_at FROM boundaries
 ), occupied AS (
  -- Consecutive crops and simultaneous distinct zones count naturally. A
  -- duplicate/overlapping history for the same physical space counts once.
  SELECT segment.space_key,segment.at,segment.next_at,MAX(run.area_m2) AS area_m2
  FROM segments segment JOIN run_intervals run USING(space_key)
  WHERE segment.next_at>segment.at AND run.from_at<=segment.at AND run.to_at>=segment.next_at
  GROUP BY segment.space_key,segment.at,segment.next_at
 ), inputs AS (
  SELECT COALESCE((SELECT SUM(area_m2*EXTRACT(EPOCH FROM next_at-at))/2592000 FROM occupied),0) AS area,
   COALESCE((SELECT SUM(GREATEST(0,receipt.payout_cents::BIGINT-receipt.vat_cents))
    FROM public.kq_market_sale_receipts receipt
    WHERE receipt.owner_id=p_user_id AND receipt.created_at>=calculation_window.starts_at
      AND receipt.created_at<calculation_window.as_of),0) AS sales_ht_cents,
   GREATEST(0,COALESCE((SELECT reputation FROM public.kq_equipment_wallets WHERE user_id=p_user_id),0)) AS reputation_points
  FROM calculation_window
 ), components AS (
  SELECT *,ROUND(27*LOG(2,1+area/50),1) AS production,
   ROUND(36*LOG(2,1+sales_ht_cents/1000000),1) AS sales,
   ROUND(27*LOG(2,1+reputation_points::NUMERIC/600),1) AS reputation FROM inputs
 ) SELECT jsonb_build_object('score',production+sales+reputation,
  'production',production,'sales',sales,'reputation',reputation,
  'productionAreaM2',area,'salesHtCents',sales_ht_cents,'reputationPoints',reputation_points,
  'seasonCode',p_season_code,'calculatedAt',calculation_window.as_of,
  'areaWindowStartsAt',calculation_window.as_of-INTERVAL '720 hours',
  'seasonStartedAt',calculation_window.starts_at,'seasonEndedAt',calculation_window.ends_at)
 FROM components CROSS JOIN calculation_window;
$$;
REVOKE ALL ON FUNCTION public.kq_business_development_score_for_season(UUID,TEXT,TIMESTAMPTZ)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.kq_business_development_score_for_season(UUID,TEXT,TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.kq_business_development_score(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.kq_business_development_score_for_season(p_user_id,
  (SELECT season_code FROM public.kq_seasons WHERE status='active'),statement_timestamp());
$$;
REVOKE ALL ON FUNCTION public.kq_business_development_score(UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.kq_business_development_score(UUID) TO service_role;

-- Decimal contributions must survive every old consumer until the new Arena
-- ranking readers are installed. Keep the separate legacy rating formula.
DO $$
DECLARE target RECORD; body TEXT; anchor TEXT;
BEGIN
 FOR target IN SELECT * FROM (VALUES
  ('public.rpc_kq_refresh_daily_leaderboard(text)','profile'),
  ('public.rpc_kq_player_core_snapshot(uuid)','profile'),
  ('public.rpc_kq_get_arena_leaderboard(text,boolean)','rank_profile'),
  ('public.rpc_kq_get_arena_category_leaderboard(text,text)','candidate')
 ) definitions(signature,alias) LOOP
  body:=pg_get_functiondef(target.signature::REGPROCEDURE);
  anchor:='(public.kq_business_development_score('||target.alias||'.user_id)->>''score'')::INTEGER';
  IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'business_decimal_consumer_changed: %',target.signature; END IF;
  body:=replace(body,anchor,replace(anchor,'::INTEGER','::NUMERIC'));
  IF target.signature<>'public.rpc_kq_player_core_snapshot(uuid)' THEN
   body:=replace(body,'public.kq_business_development_score('||target.alias||'.user_id)',
    'public.kq_business_development_score_for_season('||target.alias||'.user_id,p_season_code,statement_timestamp())');
  END IF;
  EXECUTE body;
 END LOOP;
END;
$$;

-- Invalidate the live daily cache only; archived rankings and rewards retain
-- their recorded numbers. The next Arena migration versions its own cache.
UPDATE public.kq_leaderboard_snapshots snapshot
SET generated_at=LEAST(snapshot.generated_at,clock_timestamp()-INTERVAL '61 seconds')
WHERE snapshot.season_code IN (SELECT season_code FROM public.kq_seasons WHERE status='active')
 AND snapshot.snapshot_date=(SELECT MAX(recent.snapshot_date) FROM public.kq_leaderboard_snapshots recent
  WHERE recent.season_code=snapshot.season_code);

COMMIT;
