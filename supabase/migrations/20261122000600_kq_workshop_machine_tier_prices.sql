BEGIN;

-- Catalogue amounts are complete-machine game prices in euro cents. Historical
-- purchase, upgrade and accounting receipts keep their original amounts.
ALTER TABLE public.kq_equipment_catalog
  ADD COLUMN workshop_standard_price_cents integer,
  ADD COLUMN workshop_premium_price_cents integer,
  ADD CONSTRAINT kq_equipment_workshop_price_order CHECK (
    (workshop_standard_price_cents IS NULL AND workshop_premium_price_cents IS NULL) OR
    (workshop_standard_price_cents IS NOT NULL AND workshop_premium_price_cents IS NOT NULL
      AND price_cents > 0 AND price_cents < workshop_standard_price_cents
      AND workshop_standard_price_cents < workshop_premium_price_cents)
  );

UPDATE public.kq_equipment_catalog AS catalog
SET price_cents = offer.economy, workshop_standard_price_cents = offer.standard,
    workshop_premium_price_cents = offer.premium, updated_at = now()
FROM (VALUES
  ('SIFT-TRAY',     504000,  630000,  834000),
  ('PRESS-0600',    450000, 1240000, 2160000),
  ('WASHER-25L',    630000, 3480000, 8580000),
  ('AUTO-SIEVE',    516000,  576000, 1860000),
  ('FREEZE-DRYER',  760000,  860000,  970000),
  ('STATIC-PLASMA',1800000, 4200000, 7800000)
) AS offer(code, economy, standard, premium)
WHERE catalog.code = offer.code;

-- Divide each workshop tier gap between three single-level purchases. Taking
-- differences of cumulative integer amounts puts every last cent on a step.
CREATE FUNCTION public.kq_equipment_upgrade_step_price(
  p_base integer, p_standard integer, p_premium integer, p_level integer
) RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE gap bigint; step integer;
BEGIN
  IF p_standard IS NULL OR p_level >= 7 THEN
    RETURN ceil(p_base::numeric * p_level / 10)::integer;
  END IF;
  IF p_level < 4 THEN
    gap := p_standard - p_base;
    step := p_level;
  ELSE
    gap := p_premium - p_standard;
    step := p_level - 3;
  END IF;
  RETURN (gap * step / 3 - gap * (step - 1) / 3)::integer;
END $$;
REVOKE ALL ON FUNCTION public.kq_equipment_upgrade_step_price(integer,integer,integer,integer) FROM PUBLIC,anon,authenticated,service_role;

-- Replace just the prices inside the two existing business functions. Both
-- public wrappers still handle player hours, locking and idempotent retries.
DO $$ DECLARE spec record; body text;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('public.kq_work_inner_purchase_workshop_tier(uuid,uuid,text,integer,integer,integer)',
     'base_price INTEGER;', 'base_price INTEGER; standard_price INTEGER; premium_price INTEGER;'),
    ('public.kq_work_inner_purchase_workshop_tier(uuid,uuid,text,integer,integer,integer)',
     'SELECT price_cents INTO base_price',
     'SELECT price_cents,workshop_standard_price_cents,workshop_premium_price_cents INTO base_price,standard_price,premium_price'),
    ('public.kq_work_inner_purchase_workshop_tier(uuid,uuid,text,integer,integer,integer)',
     'ceil(base_price::NUMERIC*step/10)::BIGINT',
     'public.kq_equipment_upgrade_step_price(base_price,standard_price,premium_price,step)'),
    ('public.kq_work_inner_upgrade_tent_equipment(uuid,uuid,text,integer,integer)',
     'CEIL(catalog.price_cents::NUMERIC * owned.level / 10)::INTEGER',
     'public.kq_equipment_upgrade_step_price(catalog.price_cents,catalog.workshop_standard_price_cents,catalog.workshop_premium_price_cents,owned.level)')
  ) AS patches(signature, previous_expression, next_expression) LOOP
    body := pg_get_functiondef(spec.signature::regprocedure);
    IF (length(body) - length(replace(body,spec.previous_expression,''))) / length(spec.previous_expression) <> 1 THEN
      RAISE EXCEPTION 'workshop_catalog_price_migration_drift: %',spec.signature;
    END IF;
    EXECUTE replace(body,spec.previous_expression,spec.next_expression);
  END LOOP;
END $$;

-- Keep the current work-hour wrapper around the actual upgrade. The workshop
-- tier RPC already calls its inner child directly and charges composite time.
ALTER FUNCTION public.rpc_kq_upgrade_tent_equipment(uuid,uuid,text,integer,integer)
  RENAME TO kq_upgrade_tent_equipment_with_work;
REVOKE ALL ON FUNCTION public.kq_upgrade_tent_equipment_with_work(uuid,uuid,text,integer,integer)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_upgrade_workshop_machine(
  p_user_id uuid, p_request_key uuid, p_equipment_code text, p_expected_level integer, p_expected_price_cents integer,
  p_expected_units integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE catalog public.kq_equipment_catalog%ROWTYPE; old public.kq_equipment_upgrade_receipts%ROWTYPE;
  price integer; units integer;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL OR p_expected_level IS NULL OR p_expected_level NOT BETWEEN 1 AND 9 THEN
    RAISE EXCEPTION 'invalid_equipment_upgrade';
  END IF;
  IF p_expected_units IS NOT NULL AND p_expected_units NOT BETWEEN 1 AND 8 THEN RAISE EXCEPTION 'production_invalid_request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || p_user_id::text,0));
  SELECT * INTO catalog FROM public.kq_equipment_catalog
    WHERE code=p_equipment_code AND workshop_standard_price_cents IS NOT NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_equipment_upgrade'; END IF;
  SELECT * INTO old FROM public.kq_equipment_upgrade_receipts WHERE user_id=p_user_id AND request_key=p_request_key;
  IF FOUND THEN
    IF old.equipment_code IS DISTINCT FROM p_equipment_code OR old.previous_level IS DISTINCT FROM p_expected_level THEN
      RAISE EXCEPTION 'equipment_upgrade_request_mismatch';
    END IF;
    IF p_expected_price_cents IS NOT NULL AND old.price_cents IS DISTINCT FROM p_expected_price_cents THEN
      RAISE EXCEPTION 'workshop_upgrade_price_changed';
    END IF;
  ELSE
    price := public.kq_equipment_upgrade_step_price(catalog.price_cents,catalog.workshop_standard_price_cents,catalog.workshop_premium_price_cents,p_expected_level);
    IF p_expected_price_cents IS DISTINCT FROM price THEN RAISE EXCEPTION 'workshop_upgrade_price_changed'; END IF;
    IF p_expected_units IS NOT NULL THEN
      PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
      SELECT production_units INTO units FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
      IF units IS DISTINCT FROM p_expected_units THEN RAISE EXCEPTION 'production_units_changed'; END IF;
    END IF;
  END IF;
  RETURN public.kq_upgrade_tent_equipment_with_work(p_user_id,p_request_key,p_equipment_code,p_expected_level,1);
END $$;

-- Old clients and production-equipment aliases still use this signature.
-- Workshop retries recover their old receipt; a new expense needs a quote.
CREATE FUNCTION public.rpc_kq_upgrade_tent_equipment(
  p_user_id uuid, p_request_key uuid, p_equipment_code text, p_expected_level integer, p_tent_number integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.kq_equipment_catalog WHERE code=p_equipment_code AND workshop_standard_price_cents IS NOT NULL) THEN
    RETURN public.rpc_kq_upgrade_workshop_machine(p_user_id,p_request_key,p_equipment_code,p_expected_level,NULL);
  END IF;
  RETURN public.kq_upgrade_tent_equipment_with_work(p_user_id,p_request_key,p_equipment_code,p_expected_level,p_tent_number);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_upgrade_workshop_machine(uuid,uuid,text,integer,integer,integer),
  public.rpc_kq_upgrade_tent_equipment(uuid,uuid,text,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_upgrade_workshop_machine(uuid,uuid,text,integer,integer,integer),
  public.rpc_kq_upgrade_tent_equipment(uuid,uuid,text,integer,integer) TO service_role;

ALTER FUNCTION public.rpc_kq_purchase_tent_equipment(uuid,uuid,text[],integer)
  RENAME TO kq_purchase_tent_equipment_with_work;
REVOKE ALL ON FUNCTION public.kq_purchase_tent_equipment_with_work(uuid,uuid,text[],integer)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_purchase_workshop_cart(
  p_user_id uuid, p_request_key uuid, p_equipment_codes text[], p_tent_number integer,
  p_expected_price_cents integer, p_expected_units integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE old public.kq_equipment_purchase_receipts%ROWTYPE; price bigint; units integer;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.kq_equipment_catalog WHERE code=ANY(p_equipment_codes) AND workshop_standard_price_cents IS NOT NULL
  ) THEN RAISE EXCEPTION 'invalid_equipment_purchase'; END IF;
  IF p_tent_number IS NULL AND (p_expected_units IS NULL OR p_expected_units NOT BETWEEN 1 AND 8)
    THEN RAISE EXCEPTION 'production_invalid_request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:' || p_user_id::text,0));
  SELECT * INTO old FROM public.kq_equipment_purchase_receipts WHERE user_id=p_user_id AND request_key=p_request_key;
  IF FOUND THEN
    IF old.equipment_codes IS DISTINCT FROM p_equipment_codes THEN RAISE EXCEPTION 'equipment_purchase_request_mismatch'; END IF;
    IF p_expected_price_cents IS NOT NULL AND old.total_price_cents IS DISTINCT FROM p_expected_price_cents THEN
      RAISE EXCEPTION 'workshop_cart_price_changed';
    END IF;
    IF p_tent_number IS NULL AND old.tent_number IS NULL THEN
      RETURN public.rpc_kq_purchase_equipment(p_user_id,p_request_key,p_equipment_codes);
    END IF;
  ELSE
    -- Lock every quoted row, including non-workshop items in a mixed basket.
    SELECT sum(item.price_cents) INTO price FROM (
      SELECT price_cents FROM public.kq_equipment_catalog WHERE code=ANY(p_equipment_codes)
        AND is_active AND is_purchasable ORDER BY code FOR SHARE
    ) item;
    IF p_expected_price_cents IS NULL OR price IS DISTINCT FROM p_expected_price_cents::bigint THEN
      RAISE EXCEPTION 'workshop_cart_price_changed';
    END IF;
    IF p_tent_number IS NULL THEN
      PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
      SELECT production_units INTO units FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
      IF units IS DISTINCT FROM p_expected_units THEN RAISE EXCEPTION 'production_units_changed'; END IF;
    END IF;
  END IF;
  RETURN public.kq_purchase_tent_equipment_with_work(p_user_id,p_request_key,p_equipment_codes,COALESCE(p_tent_number,1));
END $$;

CREATE FUNCTION public.rpc_kq_purchase_tent_equipment(
  p_user_id uuid, p_request_key uuid, p_equipment_codes text[], p_tent_number integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.kq_equipment_catalog WHERE code=ANY(p_equipment_codes) AND workshop_standard_price_cents IS NOT NULL) THEN
    RETURN public.rpc_kq_purchase_workshop_cart(p_user_id,p_request_key,p_equipment_codes,p_tent_number,NULL);
  END IF;
  RETURN public.kq_purchase_tent_equipment_with_work(p_user_id,p_request_key,p_equipment_codes,p_tent_number);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_purchase_workshop_cart(uuid,uuid,text[],integer,integer,integer),
  public.rpc_kq_purchase_tent_equipment(uuid,uuid,text[],integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_purchase_workshop_cart(uuid,uuid,text[],integer,integer,integer),
  public.rpc_kq_purchase_tent_equipment(uuid,uuid,text[],integer) TO service_role;

COMMIT;
