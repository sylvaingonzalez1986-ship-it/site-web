-- Minimal dependencies shared by isolated PGlite valuation/ranking tests.
-- No roles are created here: the surrounding test controls its access model.
CREATE TABLE IF NOT EXISTS public.kq_equipment_wallets(user_id UUID PRIMARY KEY);
ALTER TABLE public.kq_equipment_wallets ADD COLUMN IF NOT EXISTS cash_cents BIGINT NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.kq_commerce_accounts(user_id UUID PRIMARY KEY);
ALTER TABLE public.kq_commerce_accounts ADD COLUMN IF NOT EXISTS vat_reserved_cents BIGINT NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.arena_chanvrier_savings_deposits(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,balance_cents BIGINT);
CREATE TABLE IF NOT EXISTS public.kq_crypto_positions(
 user_id UUID,asset_id INTEGER,quantity NUMERIC,cost_basis_cents BIGINT,PRIMARY KEY(user_id,asset_id));
CREATE TABLE IF NOT EXISTS public.kq_crypto_quotes(asset_id INTEGER PRIMARY KEY,price_eur NUMERIC,quoted_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS public.kq_stock_positions(
 user_id UUID,asset_id TEXT,quantity NUMERIC,cost_basis_cents BIGINT,PRIMARY KEY(user_id,asset_id));
CREATE TABLE IF NOT EXISTS public.kq_stock_quotes(asset_id TEXT PRIMARY KEY,price_eur NUMERIC,quoted_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS public.kq_treasury_assets(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,source_key TEXT,account TEXT,
 cost_cents BIGINT,recognized_cents BIGINT NOT NULL DEFAULT 0,starts_at TIMESTAMPTZ,ends_at TIMESTAMPTZ,
 retired_at TIMESTAMPTZ,UNIQUE(user_id,source_key));
CREATE TABLE IF NOT EXISTS public.kq_treasury_journal(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,source_key TEXT,kind TEXT,postings JSONB,
 UNIQUE(user_id,source_key));
CREATE TABLE IF NOT EXISTS public.kq_business_ledger(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,kind TEXT,amount_cents BIGINT,occurred_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.kq_storage_requests(
 user_id UUID,request_key UUID,payload JSONB,created_at TIMESTAMPTZ DEFAULT now(),PRIMARY KEY(user_id,request_key));
CREATE TABLE IF NOT EXISTS public.kq_care_inventory(
 user_id UUID,product_code TEXT,quantity INTEGER,PRIMARY KEY(user_id,product_code));
CREATE TABLE IF NOT EXISTS public.kq_care_purchases(
 user_id UUID,request_key UUID,product_code TEXT,quantity INTEGER,total_price_cents INTEGER,
 created_at TIMESTAMPTZ DEFAULT now(),PRIMARY KEY(user_id,request_key));
CREATE TABLE IF NOT EXISTS public.kq_bank_loans(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,total_cents BIGINT,paid_cents BIGINT DEFAULT 0);
CREATE TABLE IF NOT EXISTS public.kq_lab_invoices(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,remaining_cents BIGINT);
CREATE TABLE IF NOT EXISTS public.kq_energy_invoices(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,remaining_cents BIGINT);
CREATE TABLE IF NOT EXISTS public.kq_supplier_invoices(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,remaining_cents BIGINT);
ALTER TABLE public.kq_supplier_invoices ADD COLUMN IF NOT EXISTS run_id UUID;
ALTER TABLE public.kq_supplier_invoices ADD COLUMN IF NOT EXISTS amount_cents BIGINT NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.kq_runs(id UUID PRIMARY KEY,user_id UUID,status TEXT);
CREATE TABLE IF NOT EXISTS public.kq_company_value_test_stock(user_id UUID PRIMARY KEY,cost_cents BIGINT);
CREATE OR REPLACE FUNCTION public.kq_treasury_stock_cost(p_user UUID) RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((SELECT cost_cents FROM public.kq_company_value_test_stock WHERE user_id=p_user),0);
$$;
REVOKE ALL ON FUNCTION public.kq_treasury_stock_cost(UUID) FROM PUBLIC,anon,authenticated,service_role;
