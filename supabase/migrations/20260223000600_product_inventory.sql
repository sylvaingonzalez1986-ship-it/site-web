BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS track_stock BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_stock_quantity_non_negative;

ALTER TABLE public.products
  ADD CONSTRAINT products_stock_quantity_non_negative
  CHECK (stock_quantity IS NULL OR stock_quantity >= 0);

UPDATE public.products
SET track_stock = FALSE
WHERE track_stock IS NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_applied_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_track_stock
  ON public.products(track_stock);

CREATE INDEX IF NOT EXISTS idx_orders_stock_applied_at
  ON public.orders(stock_applied_at);

CREATE OR REPLACE FUNCTION public.rpc_apply_order_inventory(
  p_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_product RECORD;
  v_base_product_id TEXT;
  v_variant_id TEXT;
  v_variant_options JSONB;
  v_variant_option JSONB;
  v_variant_index INTEGER;
  v_variant_stock INTEGER;
  v_new_variant_stock INTEGER;
  v_product_stock INTEGER;
  v_processed_count INTEGER := 0;
BEGIN
  IF p_order_id IS NULL OR btrim(p_order_id) = '' THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('inventory:' || p_order_id, 0));

  SELECT id, payment_state, stock_applied_at
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_order.payment_state NOT IN ('paid', 'not_configured') THEN
    RAISE EXCEPTION 'order_not_paid';
  END IF;

  IF v_order.stock_applied_at IS NOT NULL THEN
    RETURN jsonb_build_object('applied', FALSE, 'reason', 'already_applied');
  END IF;

  FOR v_item IN
    SELECT product_id, quantity
    FROM public.order_items
    WHERE order_id = p_order_id
    ORDER BY id ASC
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      CONTINUE;
    END IF;

    v_base_product_id := split_part(v_item.product_id, '::', 1);
    v_variant_id := NULLIF(split_part(v_item.product_id, '::', 2), '');

    SELECT id, track_stock, stock_quantity, variant_options
    INTO v_product
    FROM public.products
    WHERE id = v_base_product_id
    FOR UPDATE;

    -- Ignore non-catalog order lines (shipping, gift lines, deleted products).
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_variant_id IS NOT NULL
      AND v_product.variant_options IS NOT NULL
      AND jsonb_typeof(v_product.variant_options) = 'array'
    THEN
      v_variant_index := NULL;
      v_variant_option := NULL;

      SELECT elem, ordinality::INTEGER - 1
      INTO v_variant_option, v_variant_index
      FROM jsonb_array_elements(v_product.variant_options) WITH ORDINALITY AS t(elem, ordinality)
      WHERE elem->>'id' = v_variant_id
      LIMIT 1;

      IF v_variant_index IS NOT NULL AND v_variant_option IS NOT NULL THEN
        IF (v_variant_option ? 'stockQuantity')
          AND (v_variant_option->>'stockQuantity') ~ '^\d+$'
        THEN
          v_variant_stock := (v_variant_option->>'stockQuantity')::INTEGER;
        ELSE
          v_variant_stock := NULL;
        END IF;

        IF v_variant_stock IS NOT NULL THEN
          IF v_variant_stock < v_item.quantity THEN
            RAISE EXCEPTION 'inventory_insufficient_variant:%:%', v_base_product_id, v_variant_id;
          END IF;

          v_new_variant_stock := v_variant_stock - v_item.quantity;
          v_variant_option := jsonb_set(
            v_variant_option,
            '{stockQuantity}',
            to_jsonb(v_new_variant_stock),
            TRUE
          );
          v_variant_option := jsonb_set(
            v_variant_option,
            '{inStock}',
            to_jsonb(v_new_variant_stock > 0),
            TRUE
          );

          v_variant_options := jsonb_set(
            v_product.variant_options,
            ARRAY[v_variant_index::TEXT],
            v_variant_option,
            FALSE
          );

          UPDATE public.products
          SET variant_options = v_variant_options
          WHERE id = v_product.id;

          v_processed_count := v_processed_count + 1;
          CONTINUE;
        END IF;
      END IF;
    END IF;

    IF COALESCE(v_product.track_stock, FALSE) THEN
      v_product_stock := COALESCE(v_product.stock_quantity, 0);
      IF v_product_stock < v_item.quantity THEN
        RAISE EXCEPTION 'inventory_insufficient_product:%', v_base_product_id;
      END IF;

      UPDATE public.products
      SET stock_quantity = v_product_stock - v_item.quantity
      WHERE id = v_product.id;

      v_processed_count := v_processed_count + 1;
    END IF;
  END LOOP;

  UPDATE public.orders
  SET stock_applied_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'applied', TRUE,
    'processed_items', v_processed_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_apply_order_inventory(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_apply_order_inventory(TEXT) TO service_role;

COMMIT;


