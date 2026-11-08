BEGIN;

-- Every partner adds purchasing capacity. Quality, the 24-hour recruitment
-- allowance and the existing maximum +4 price points remain unchanged.
ALTER TABLE public.kq_commerce_accounts DROP CONSTRAINT kq_commerce_accounts_shop_partners_check;
ALTER TABLE public.kq_commerce_accounts ADD CONSTRAINT kq_commerce_accounts_shop_partners_check CHECK(shop_partners>=0);
ALTER TABLE public.kq_commerce_campaigns DROP CONSTRAINT kq_commerce_campaigns_shop_partners_start_check;
ALTER TABLE public.kq_commerce_campaigns ADD CONSTRAINT kq_commerce_campaigns_shop_partners_start_check CHECK(shop_partners_start>=0);

-- Patch the live implementations, preserving all intervening storage, demand,
-- invoice, trim and payroll guards. Abort atomically if a prerequisite drifts.
CREATE FUNCTION pg_temp.kq_unbounded_partners_patch(p_signature TEXT,p_before TEXT,p_after TEXT,p_count INTEGER) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE body TEXT;
BEGIN
 SELECT replace(pg_get_functiondef(p_signature::regprocedure),E'\r\n',E'\n') INTO body;
 IF (length(body)-length(replace(body,p_before,'')))/length(p_before)<>p_count
 THEN RAISE EXCEPTION 'unbounded_partners_patch_drift: %',p_signature; END IF;
 EXECUTE replace(body,p_before,p_after);
END $$;

DO $$ BEGIN
 IF position('kq_commerce_command_before_invoice_batch' IN pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure))=0
 THEN RAISE EXCEPTION 'unbounded_partners_wrapper_drift'; END IF;
END $$;
SELECT pg_temp.kq_unbounded_partners_patch('public.kq_commerce_command_before_invoice_batch(uuid,text,jsonb,uuid)',
 'shop_after:=GREATEST(0,LEAST(20,c.shop_partners_start+FLOOR(shop_recruit/6000)-FLOOR(shop_churn_value/6000)));',
 'shop_after:=GREATEST(0,c.shop_partners_start+FLOOR(shop_recruit/6000)-FLOOR(shop_churn_value/6000));',1);
SELECT pg_temp.kq_unbounded_partners_patch('public.kq_commerce_capacity(uuid)',
 'LEAST(20,GREATEST(0,shop_partners_start))','GREATEST(0,shop_partners_start)::NUMERIC',1);
SELECT pg_temp.kq_unbounded_partners_patch('public.kq_warehouse_wholesale_budget(uuid)',
 'LEAST(20,GREATEST(0,COALESCE(a.shop_partners,0)))','GREATEST(0,COALESCE(a.shop_partners,0))::NUMERIC',2);
SELECT pg_temp.kq_unbounded_partners_patch('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)',
 'SELECT LEAST(20-shop_partners,(effect->>''shopPartners'')::INTEGER) INTO delta',
 'SELECT (effect->>''shopPartners'')::INTEGER INTO delta',1);
SELECT pg_temp.kq_unbounded_partners_patch('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)',
 'shop_partners_start=LEAST(20,shop_partners_start+delta)',
 'shop_partners_start=shop_partners_start+delta',1);
DROP FUNCTION pg_temp.kq_unbounded_partners_patch(TEXT,TEXT,TEXT,INTEGER);

-- Any offer that could cross the former ceiling must be requested again,
-- including a merchant starting at 19 with carried recruitment. Existing
-- receipts, partners, fractional progress, demand debt and cash are preserved.
UPDATE public.kq_commerce_accounts SET revision=revision+1;

-- CREATE OR REPLACE preserves privileges; explicitly retain each original API
-- boundary. Helpers called only by SECURITY DEFINER commands stay private.
REVOKE ALL ON FUNCTION public.kq_commerce_command_before_invoice_batch(UUID,TEXT,JSONB,UUID) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_warehouse_wholesale_budget(UUID) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_commerce_capacity(UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.kq_commerce_capacity(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_staff_commit(UUID,INTEGER,UUID,JSONB,JSONB,INTEGER,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_staff_commit(UUID,INTEGER,UUID,JSONB,JSONB,INTEGER,JSONB) TO service_role;

COMMIT;
