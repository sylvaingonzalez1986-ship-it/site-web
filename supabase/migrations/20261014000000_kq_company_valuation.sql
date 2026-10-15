BEGIN;

-- Read-only net company value. Transfers between cash, savings and portfolios
-- do not create value, and borrowing carries the full remaining contractual debt.
-- Market holdings use the last published quote; an absent/invalid quote falls
-- back to acquisition cost without triggering a provider refresh or settlement.
CREATE FUNCTION public.kq_company_net_value(p_user_id UUID) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH asset_value AS (
  SELECT COALESCE(SUM(GREATEST(0,a.cost_cents-GREATEST(a.recognized_cents,
   LEAST(a.cost_cents,FLOOR(a.cost_cents::NUMERIC
    *GREATEST(0,EXTRACT(EPOCH FROM(now()-a.starts_at)))
    /NULLIF(EXTRACT(EPOCH FROM(a.ends_at-a.starts_at)),0)))))),0) AS cents
  FROM public.kq_treasury_assets a
  WHERE a.user_id=p_user_id AND a.account IN ('equipment','website','prepaid') AND a.retired_at IS NULL
 ), online_value AS (
  -- Modern website tiers, photography and branding are expensed by the ledger,
  -- unlike the legacy website. Give these durable improvements the same 1,440h
  -- lifetime, without re-adding any source already capitalized as an asset.
  SELECT COALESCE(SUM(GREATEST(0,l.amount_cents-LEAST(l.amount_cents,
   FLOOR(l.amount_cents::NUMERIC*GREATEST(0,EXTRACT(EPOCH FROM(now()-l.occurred_at)))/(1440*3600))))),0) AS cents
  FROM public.kq_business_ledger l
  WHERE l.user_id=p_user_id AND l.kind IN ('online-upgrade-site','online-buy-upgrade') AND l.amount_cents>0
   AND l.occurred_at<=now() AND NOT EXISTS(SELECT 1 FROM public.kq_treasury_assets a
    WHERE a.user_id=l.user_id AND a.source_key IN ('kq_business_ledger:'||l.id::TEXT,'online-ledger:'||l.id::TEXT))
 ), storage_cost AS (
  -- Historical standalone storage requests did not record their paid amount.
  -- Freeze the prices actually charged by those RPCs, so a future catalog edit
  -- cannot revalue old purchases. Warehouse-bridged/free containers have no buy
  -- request and are already represented by the warehouse's charged asset cost.
  SELECT r.created_at,CASE WHEN r.payload->>'containerCode' IS NOT NULL THEN
   CASE WHEN jsonb_typeof(r.payload->'quantity')='number'
    AND (r.payload->>'quantity')::NUMERIC BETWEEN 1 AND 1000
    AND trunc((r.payload->>'quantity')::NUMERIC)=(r.payload->>'quantity')::NUMERIC
   THEN (r.payload->>'quantity')::NUMERIC*CASE r.payload->>'containerCode'
    WHEN 'GLASS-1L' THEN 500 WHEN 'GLASS-2L' THEN 900 WHEN 'GLASS-3L' THEN 1200
    WHEN 'GROVE-1OZ' THEN 300 WHEN 'GROVE-1LB' THEN 1500 WHEN 'BOVEDA-1L' THEN 900
    WHEN 'CVAULT-2OZ' THEN 3500 WHEN 'CVAULT-1LB' THEN 12000 WHEN 'CANNATROL' THEN 180000
    WHEN 'CURTEC-60L' THEN 8550 ELSE 0 END ELSE 0 END
   ELSE CASE r.payload->>'methodCode' WHEN 'STORAGE-GROVE' THEN 2500 WHEN 'STORAGE-BOVEDA' THEN 4500
    WHEN 'STORAGE-CVAULT' THEN 12000 WHEN 'STORAGE-CANNATROL' THEN 180000 ELSE 0 END END AS cents
  FROM public.kq_storage_requests r WHERE r.user_id=p_user_id AND r.payload->>'action'='buy' AND r.created_at<=now()
   AND NOT EXISTS(SELECT 1 FROM public.kq_treasury_assets a
    WHERE a.user_id=r.user_id AND a.source_key='kq_storage_requests:'||r.request_key::TEXT)
 ), storage_value AS (
  SELECT COALESCE(SUM(GREATEST(0,cents-LEAST(cents,
   FLOOR(cents*GREATEST(0,EXTRACT(EPOCH FROM(now()-created_at)))/(4320*3600))))),0) AS cents
  FROM storage_cost
 ), care_cost AS (
  -- Unused care supplies are separate from harvested/packaged product stock.
  -- Use recorded acquisition cost, not a catalog price that could later change.
  SELECT product_code,SUM(quantity)::NUMERIC AS quantity,SUM(total_price_cents)::NUMERIC AS cents
  FROM public.kq_care_purchases WHERE user_id=p_user_id
  GROUP BY product_code
 ), care_value AS (
  SELECT COALESCE(SUM(FLOOR(LEAST(i.quantity,c.quantity)*c.cents/NULLIF(c.quantity,0))),0) AS cents
  FROM public.kq_care_inventory i JOIN care_cost c USING(product_code)
  WHERE i.user_id=p_user_id AND i.quantity>0 AND c.quantity>0
 ), production_value AS (
  -- Delivered inputs are work in progress at their actual invoiced cost. The
  -- full cost belongs to the asset; unpaid amounts remain a separate liability.
  -- Completed harvests move into kq_treasury_stock_cost; abandoned runs have no
  -- remaining asset. Do not estimate future yields, energy or selling prices.
  SELECT COALESCE(SUM(i.amount_cents),0) AS cents
  FROM public.kq_supplier_invoices i JOIN public.kq_runs r ON r.id=i.run_id
  WHERE i.user_id=p_user_id AND r.user_id=p_user_id AND r.status::TEXT='active'
 ), legacy_production_value AS (
  -- Before supplier invoicing, warehouse inputs were paid immediately. The
  -- matching journal debit proves that historical cost; the opposite suspense
  -- leg is not another asset. An invoice always takes precedence for its run.
  SELECT COALESCE(SUM(GREATEST(0,(posting->>'deltaCents')::NUMERIC)),0) AS cents
  FROM public.kq_runs r JOIN public.kq_treasury_journal j
   ON j.user_id=r.user_id AND j.source_key='warehouse-consumables:'||r.id::TEXT
  CROSS JOIN LATERAL jsonb_array_elements(j.postings) posting
  WHERE r.user_id=p_user_id AND r.status::TEXT='active' AND j.kind='warehouse-consumables'
   AND posting->>'account'='expense_other'
   AND NOT EXISTS(SELECT 1 FROM public.kq_supplier_invoices i WHERE i.run_id=r.id)
 ), crypto_value AS (
  SELECT COALESCE(SUM(CASE WHEN q.price_eur>0 AND q.quoted_at<=now()+interval '60 seconds'
   THEN FLOOR(p.quantity*q.price_eur*100) ELSE p.cost_basis_cents END),0) AS cents
  FROM public.kq_crypto_positions p LEFT JOIN public.kq_crypto_quotes q USING(asset_id)
  WHERE p.user_id=p_user_id AND p.quantity>0
 ), securities_value AS (
  SELECT COALESCE(SUM(CASE WHEN q.price_eur>0 AND q.quoted_at<=now()+interval '60 seconds'
   THEN FLOOR(p.quantity*q.price_eur*100) ELSE p.cost_basis_cents END),0) AS cents
  FROM public.kq_stock_positions p LEFT JOIN public.kq_stock_quotes q USING(asset_id)
  WHERE p.user_id=p_user_id AND p.quantity>0
 ) SELECT
   COALESCE((SELECT cash_cents FROM public.kq_equipment_wallets WHERE user_id=p_user_id),0)::NUMERIC
  +COALESCE((SELECT SUM(balance_cents) FROM public.arena_chanvrier_savings_deposits WHERE user_id=p_user_id),0)
  +(SELECT cents FROM crypto_value)+(SELECT cents FROM securities_value)
  +(SELECT cents FROM asset_value)+(SELECT cents FROM online_value)+(SELECT cents FROM storage_value)
  +(SELECT cents FROM care_value)+(SELECT cents FROM production_value)
  +(SELECT cents FROM legacy_production_value)
  +COALESCE(public.kq_treasury_stock_cost(p_user_id),0)
  -COALESCE((SELECT SUM(total_cents-paid_cents) FROM public.kq_bank_loans WHERE user_id=p_user_id),0)
  -COALESCE((SELECT SUM(remaining_cents) FROM public.kq_lab_invoices WHERE user_id=p_user_id),0)
  -COALESCE((SELECT SUM(remaining_cents) FROM public.kq_energy_invoices WHERE user_id=p_user_id),0)
  -COALESCE((SELECT SUM(remaining_cents) FROM public.kq_supplier_invoices WHERE user_id=p_user_id),0);
 -- VAT is held outside wallet cash: its reserved asset and equal payable cancel.
 -- Warehouse conversion credit is not cash or an additional asset: the original
 -- basis stays in treasury_assets, and only new cash charges create another asset.
$$;
REVOKE ALL ON FUNCTION public.kq_company_net_value(UUID) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
