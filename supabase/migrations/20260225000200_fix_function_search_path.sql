-- Fix mutable search_path warnings on trigger/helper functions in public schema.

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_pack_component_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pack_is_pack BOOLEAN;
  component_is_pack BOOLEAN;
BEGIN
  IF NEW.pack_id = NEW.product_id THEN
    RAISE EXCEPTION 'pack_components: pack_id and product_id cannot be identical';
  END IF;

  SELECT is_pack INTO pack_is_pack FROM products WHERE id = NEW.pack_id;
  IF COALESCE(pack_is_pack, FALSE) = FALSE THEN
    RAISE EXCEPTION 'pack_components: pack_id % must reference a product with is_pack=true', NEW.pack_id;
  END IF;

  SELECT is_pack INTO component_is_pack FROM products WHERE id = NEW.product_id;
  IF COALESCE(component_is_pack, FALSE) = TRUE THEN
    RAISE EXCEPTION 'pack_components: product_id % cannot reference another pack', NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_lottery_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_lottery_probability_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_sum NUMERIC(12, 6);
BEGIN
  SELECT COALESCE(SUM(probability), 0)
  INTO v_sum
  FROM lottery_prizes
  WHERE is_active = TRUE
    AND id <> COALESCE(NEW.id, OLD.id);

  IF TG_OP <> 'DELETE' AND NEW.is_active = TRUE THEN
    v_sum := v_sum + NEW.probability;
  END IF;

  IF v_sum > 1 THEN
    RAISE EXCEPTION 'LOTTERY_PROBABILITY_SUM_EXCEEDED';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMIT;
