BEGIN;

-- A fulfilled request is evidence from the actual dispatch, before its quota
-- is consumed. Never re-evaluate old sales against today's aromas or quota.
-- Old receipts stay NULL: their historical eligibility cannot be proven.
ALTER TABLE public.kq_online_sales ADD COLUMN customer_demand JSONB;
ALTER TABLE public.kq_online_sales ADD CONSTRAINT kq_online_sales_demand_shape CHECK (
 customer_demand IS NULL OR (
  jsonb_typeof(customer_demand)='object'
  AND customer_demand ?& ARRAY['id','period','matchedFlavorCount','units','bonusPercent','flavorCodes']
  AND jsonb_typeof(customer_demand->'period')='number'
  AND customer_demand->'matchedFlavorCount' IN ('1'::JSONB,'2'::JSONB)
  AND (customer_demand->>'units')::INTEGER>0
  AND jsonb_typeof(customer_demand->'flavorCodes')='array'
  AND jsonb_array_length(customer_demand->'flavorCodes')=2
  AND (customer_demand->>'period')::BIGINT=floor(extract(epoch FROM occurred_at)/259200)::BIGINT
 )
);
-- This remains private, including the new evidence column. Only the existing
-- SECURITY DEFINER dispatch writes sales; no new Data API access is needed.
REVOKE ALL ON TABLE public.kq_online_sales FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
 SELECT pg_get_functiondef('public.kq_online_dispatch(uuid,uuid,timestamptz)'::regprocedure) INTO body;
 fragment:='packaging_cost_cents,quality_score,value_ratio,satisfaction_score,satisfaction)';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'mission_demand_dispatch_columns_changed'; END IF;
 body:=replace(body,fragment,'packaging_cost_cents,quality_score,value_ratio,satisfaction_score,satisfaction,customer_demand)');
 fragment:='package_cost,score,(offer->>''valueRatio'')::NUMERIC,sat,offer->>''satisfaction'');';
 IF strpos(body,fragment)=0 THEN RAISE EXCEPTION 'mission_demand_dispatch_values_changed'; END IF;
 body:=replace(body,fragment,$patch$
 package_cost,score,(offer->>'valueRatio')::NUMERIC,sat,offer->>'satisfaction',
 CASE WHEN NULLIF(offer->'customerDemand','null'::JSONB) IS NOT NULL THEN
  (offer->'customerDemand')||jsonb_build_object('flavorCodes',
   public.kq_customer_demand_request((offer->'customerDemand'->>'period')::BIGINT,'online')->'flavorCodes')
 ELSE NULL END);
$patch$);
 EXECUTE body;
END $$;

-- Collection, stock and commerce facts have different lifetimes. Use durable
-- cultures, distinct transformed flowers and paid receipts, never client input
-- or the number of inventory/sale slices. Curing keeps the original jury mark;
-- a sold flower or later storage aging does not erase an earned milestone.
CREATE FUNCTION public.kq_mission_metrics(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH official_flowers AS (
  SELECT f.* FROM public.kq_flowers f JOIN public.kq_runs r ON r.id=f.run_id
  WHERE f.owner_id=p_user AND r.user_id=p_user AND r.status::TEXT='completed'
 ), cultures AS (
  SELECT count(*) AS harvests,count(DISTINCT f.variety_code) AS varieties,
   count(*) FILTER(WHERE f.quality>=6) AS beautiful_flowers,
   count(*) FILTER(WHERE f.quality>=10) AS contest_flowers,
   count(DISTINCT f.variety_code) FILTER(WHERE f.quality>=10) AS contest_varieties,
   count(*) FILTER(WHERE f.quality>=14) AS legendary_flowers,
   count(DISTINCT f.variety_code) FILTER(WHERE f.quality>=14) AS legendary_varieties
  FROM official_flowers f
 ), preparation AS (
  SELECT count(*) AS prepared_batches FROM public.kq_commerce_batches b
  JOIN official_flowers f ON f.id=b.flower_id WHERE b.user_id=p_user
 ), storage AS (
  SELECT count(*) AS cured_lots,
   count(*) FILTER(WHERE COALESCE(m.jury_score,public.kq_storage_verdict_score(s.flower_id),
    (s.state->'baseline'->>'juryScore')::NUMERIC)>=8) AS quality_cured_lots
  FROM public.kq_storage_lots s
  JOIN official_flowers f ON f.id=s.flower_id
  LEFT JOIN public.kq_market_lots m ON m.flower_id=s.flower_id AND m.owner_id=p_user
  WHERE s.user_id=p_user AND (s.state->>'readyAt')::TIMESTAMPTZ<=now()
   -- Wholesale and overflow may remove the entire harvest before curing ends.
   -- All paid channels (including overflow) write one equivalent-mass receipt;
   -- count the lot only if some flower remained at its maturation deadline.
   -- Later sales do not erase that historical achievement.
   AND s.original_units>COALESCE((SELECT sum(sale.harvest_grams*10)
    FROM public.kq_market_sale_receipts sale
    WHERE sale.flower_id=s.flower_id AND sale.owner_id=p_user
     AND sale.created_at<(s.state->>'readyAt')::TIMESTAMPTZ),0)
 ), processing AS (
  SELECT count(DISTINCT p.flower_id) AS transformed_batches,count(DISTINCT p.family) AS transformed_routes
  FROM public.kq_chanvrier_processing_practice p JOIN official_flowers f ON f.id=p.flower_id
  LEFT JOIN public.kq_commerce_batches b ON b.flower_id=p.flower_id AND b.user_id=p_user AND b.route=p.route
  WHERE p.user_id=p_user AND (b.processing_ready_at IS NULL OR b.processing_ready_at<=now())
 ), online AS (
  SELECT count(*) AS online_sales,
   count(*) FILTER(WHERE customer_demand->>'matchedFlavorCount'='2') AS online_dual_aroma_sales,
   count(DISTINCT customer_demand->>'period') FILTER(
    WHERE customer_demand->>'matchedFlavorCount'='2' AND satisfaction='satisfied') AS online_satisfied_dual_aroma_periods
  FROM public.kq_online_sales WHERE user_id=p_user
 ), shops AS (
  SELECT count(DISTINCT f.variety_code) FILTER(WHERE s.route='raw') AS shop_varieties,
   COALESCE(sum(s.harvest_grams) FILTER(WHERE s.route='raw' AND s.jury_score>=8),0) AS shop_quality_grams
  FROM public.kq_market_sale_receipts s JOIN official_flowers f ON f.id=s.flower_id
  WHERE s.owner_id=p_user AND s.sales_channel='cbd-shop'
 )
 SELECT to_jsonb(cultures)||to_jsonb(preparation)||to_jsonb(storage)||to_jsonb(processing)||to_jsonb(online)||to_jsonb(shops)
  ||jsonb_build_object('clients',COALESCE((SELECT clients FROM public.kq_commerce_accounts WHERE user_id=p_user),0),
   'partners',COALESCE((SELECT shop_partners FROM public.kq_commerce_accounts WHERE user_id=p_user),0))
 FROM cultures CROSS JOIN preparation CROSS JOIN storage CROSS JOIN processing CROSS JOIN online CROSS JOIN shops;
$$;
REVOKE ALL ON FUNCTION public.kq_mission_metrics(UUID) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
