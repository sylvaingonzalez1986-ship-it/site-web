BEGIN;

-- Keep the supplier identity at the time of sale, even after catalog deletion.
-- Historical rows can only be attributed from products still in the catalog.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS producer_id_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS producer_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS producer_unit_weight_grams NUMERIC(12,3)
    CHECK (producer_unit_weight_grams IS NULL OR (producer_unit_weight_grams > 0 AND producer_unit_weight_grams <= 100000)),
  ADD COLUMN IF NOT EXISTS producer_attribution TEXT NOT NULL DEFAULT 'unknown'
    CHECK (producer_attribution IN ('producer', 'own', 'unknown'));

-- The commerce gram snapshot is independent from the existing game reward data.
-- Variant weights are accepted only when the entire variant label is a weight;
-- a base product's weight must never be mistaken for a different format.
CREATE OR REPLACE FUNCTION public.resolve_producer_settlement_weight(p_product_id TEXT, p_existing NUMERIC)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE product RECORD; variant_id TEXT := NULLIF(split_part(p_product_id, '::', 2), '');
  variant_label TEXT; weight_match TEXT[]; resolved_weight NUMERIC;
BEGIN
  SELECT p.id, p.weight_grams, p.variant_options INTO product
  FROM public.products p WHERE p.id = split_part(p_product_id, '::', 1);
  IF NOT FOUND THEN
    RETURN CASE WHEN p_existing > 0 AND p_existing <= 100000 THEN p_existing ELSE NULL END;
  END IF;
  IF variant_id IS NOT NULL THEN
    SELECT option->>'label' INTO variant_label FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(product.variant_options) = 'array' THEN product.variant_options ELSE '[]'::JSONB END
    ) option WHERE option->>'id' = variant_id LIMIT 1;
    weight_match := regexp_match(variant_label, '^[[:space:]]*([0-9]+(?:[.,][0-9]{1,3})?)[[:space:]]*[gG][[:space:]]*$');
    IF weight_match IS NULL THEN RETURN NULL; END IF;
    resolved_weight := replace(weight_match[1], ',', '.')::NUMERIC;
  ELSE
    resolved_weight := CASE WHEN p_existing > 0 AND p_existing <= 100000 THEN p_existing ELSE product.weight_grams END;
  END IF;
  RETURN CASE WHEN resolved_weight > 0 AND resolved_weight <= 100000 THEN resolved_weight ELSE NULL END;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_producer_settlement_weight(TEXT, NUMERIC) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.snapshot_order_item_producer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE catalog_product RECORD;
BEGIN
  NEW.producer_unit_weight_grams := public.resolve_producer_settlement_weight(NEW.product_id, NEW.unit_weight_grams);
  SELECT p.id, p.producer_id, supplier.name INTO catalog_product
  FROM public.products p LEFT JOIN public.producers supplier ON supplier.id = p.producer_id
  WHERE p.id = split_part(NEW.product_id, '::', 1);

  NEW.producer_id_snapshot := NULL;
  NEW.producer_name_snapshot := NULL;
  NEW.producer_attribution := 'unknown';
  IF FOUND THEN
    IF catalog_product.producer_id IS NULL OR catalog_product.producer_id = 'les-chanvriers-bretons' THEN
      NEW.producer_attribution := 'own';
    ELSE
      NEW.producer_id_snapshot := catalog_product.producer_id;
      NEW.producer_name_snapshot := COALESCE(catalog_product.name, catalog_product.producer_id);
      NEW.producer_attribution := 'producer';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.snapshot_order_item_producer() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER trg_snapshot_order_item_producer
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_item_producer();

-- The existing reward trigger fires on every item UPDATE. These accounting-only
-- backfills must not recalculate or grant unrelated contest rewards. The table
-- lock and transaction keep normal order writes outside this temporary change.
ALTER TABLE public.order_items DISABLE TRIGGER kq_contest_bundle_after_items;

UPDATE public.order_items item SET
  producer_id_snapshot = CASE WHEN p.producer_id IS NULL OR p.producer_id = 'les-chanvriers-bretons' THEN NULL ELSE p.producer_id END,
  producer_name_snapshot = CASE WHEN p.producer_id IS NULL OR p.producer_id = 'les-chanvriers-bretons' THEN NULL ELSE COALESCE(supplier.name, p.producer_id) END,
  producer_attribution = CASE WHEN p.producer_id IS NULL OR p.producer_id = 'les-chanvriers-bretons' THEN 'own' ELSE 'producer' END
FROM public.products p LEFT JOIN public.producers supplier ON supplier.id = p.producer_id
WHERE p.id = split_part(item.product_id, '::', 1) AND item.producer_attribution = 'unknown';

UPDATE public.order_items SET producer_unit_weight_grams =
  public.resolve_producer_settlement_weight(product_id, unit_weight_grams);

ALTER TABLE public.order_items ENABLE TRIGGER kq_contest_bundle_after_items;

CREATE INDEX idx_order_items_producer_snapshot ON public.order_items(producer_id_snapshot, product_id)
  WHERE producer_attribution = 'producer';

-- Rates are effective by sales month. An exact product id includes its variant.
-- No catalog foreign keys: deleting a product must not delete its payable history.
CREATE TABLE public.producer_settlement_rates (
  producer_id TEXT NOT NULL CHECK (length(btrim(producer_id)) BETWEEN 1 AND 200),
  product_id TEXT NOT NULL CHECK (length(btrim(product_id)) BETWEEN 1 AND 400),
  effective_month DATE NOT NULL CHECK (isfinite(effective_month) AND extract(day FROM effective_month) = 1),
  mode TEXT NOT NULL CHECK (mode IN ('unit', 'gram', 'percent_ht')),
  rate NUMERIC(14,4) NOT NULL CHECK (rate BETWEEN 0 AND 1000000 AND rate::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')),
  grams_per_unit NUMERIC(14,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (producer_id, product_id, effective_month),
  CHECK (mode <> 'percent_ht' OR rate <= 100),
  CHECK ((mode = 'gram' AND grams_per_unit IS NOT NULL AND grams_per_unit > 0 AND grams_per_unit <= 100000 AND grams_per_unit::TEXT NOT IN ('NaN', 'Infinity', '-Infinity'))
    OR (mode <> 'gram' AND grams_per_unit IS NULL))
);
ALTER TABLE public.producer_settlement_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.producer_settlement_rates FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.producer_settlement_rates TO service_role;

CREATE TABLE public.producer_settlement_payments (
  id UUID PRIMARY KEY,
  producer_id TEXT NOT NULL CHECK (length(btrim(producer_id)) BETWEEN 1 AND 200),
  producer_name TEXT NOT NULL CHECK (length(btrim(producer_name)) BETWEEN 1 AND 300),
  sales_from_month DATE NOT NULL CHECK (isfinite(sales_from_month) AND extract(day FROM sales_from_month) = 1),
  sales_month DATE NOT NULL CHECK (isfinite(sales_month) AND extract(day FROM sales_month) = 1),
  amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 1 AND 100000000),
  paid_on DATE NOT NULL CHECK (isfinite(paid_on)),
  reference TEXT NOT NULL DEFAULT '' CHECK (length(reference) <= 200),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  CHECK (sales_from_month <= sales_month),
  CHECK ((voided_at IS NULL AND void_reason IS NULL)
    OR (voided_at IS NOT NULL AND void_reason IS NOT NULL AND length(btrim(void_reason)) BETWEEN 1 AND 500))
);
CREATE INDEX idx_producer_settlement_payments_month ON public.producer_settlement_payments(producer_id, sales_month);
ALTER TABLE public.producer_settlement_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.producer_settlement_payments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.producer_settlement_payments TO service_role;
GRANT UPDATE (voided_at, void_reason) ON public.producer_settlement_payments TO service_role;

CREATE OR REPLACE FUNCTION public.protect_producer_settlement_payment()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (to_jsonb(NEW) - 'voided_at' - 'void_reason') IS DISTINCT FROM (to_jsonb(OLD) - 'voided_at' - 'void_reason')
    OR OLD.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'producer_payment_immutable';
  END IF;
  IF NEW.voided_at IS NULL OR NEW.void_reason IS NULL OR length(btrim(NEW.void_reason)) = 0 THEN
    RAISE EXCEPTION 'producer_payment_void_reason_required';
  END IF;
  NEW.voided_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_producer_settlement_payment() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER trg_protect_producer_settlement_payment
BEFORE UPDATE ON public.producer_settlement_payments
FOR EACH ROW EXECUTE FUNCTION public.protect_producer_settlement_payment();

COMMIT;
