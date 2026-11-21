BEGIN;

-- Unit costs after splitting the public packs. Verified against the retail
-- references in src/lib/kanab-quest-warehouse-retail-supplies.json.
CREATE FUNCTION public.kq_warehouse_retail_supply_price(p_code text) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT cents FROM (VALUES
    ('WAREHOUSE-VACUUM', 7990),
    ('WAREHOUSE-MOP', 4890),
    ('WAREHOUSE-NUTRITION-BASE', 15),
    ('WAREHOUSE-NUTRITION-SUPPLEMENT', 5),
    ('WAREHOUSE-PBI', 119),
    ('WAREHOUSE-MAINTENANCE', 2),
    ('CARE-COMPOST-TEA', 100),
    ('CARE-VERMICOMPOST', 55),
    ('CARE-ORGANIC-FEED', 6),
    ('CARE-SEAWEED', 19),
    ('CARE-APHIDIUS', 4),
    ('CARE-PHYTOSEIULUS', 68),
    ('CARE-SWIRSKII', 13),
    ('CARE-ORIUS', 20),
    ('CARE-CHRYSOPERLA', 42),
    ('CARE-COCCINELLA', 218),
    ('WAREHOUSE-INJECTOR', 9600),
    ('WAREHOUSE-CAMERA', 10900),
    ('WAREHOUSE-ALARM', 44900),
    ('WAREHOUSE-MONITORING', 999)
  ) AS offers(code,cents) WHERE code=p_code;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_retail_supply_price(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.kq_care_price(p_code text) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT public.kq_warehouse_retail_supply_price(p_code) WHERE p_code LIKE 'CARE-%';
$$;

CREATE OR REPLACE FUNCTION public.kq_warehouse_security_prices() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT jsonb_build_object(
    'cameraCents',public.kq_warehouse_retail_supply_price('WAREHOUSE-CAMERA'),
    'alarmCents',public.kq_warehouse_retail_supply_price('WAREHOUSE-ALARM'),
    'monitoringCents',public.kq_warehouse_retail_supply_price('WAREHOUSE-MONITORING'));
$$;

-- Keep all existing catalog names, eligibility, installation and receipt rules.
ALTER FUNCTION public.kq_warehouse_preparation_catalog() RENAME TO kq_warehouse_preparation_descriptions;
CREATE FUNCTION public.kq_warehouse_preparation_catalog()
RETURNS TABLE(code text,name text,kind text,price_cents integer,unit text)
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT d.code,d.name,d.kind,public.kq_warehouse_retail_supply_price(d.code),d.unit
  FROM public.kq_warehouse_preparation_descriptions() d;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_preparation_catalog(),
  public.kq_warehouse_preparation_descriptions(),public.kq_warehouse_security_prices(),
  public.kq_care_price(text) FROM PUBLIC,anon,authenticated,service_role;

-- Keep server quotes and charges on the same price, with stale quotes rejected
-- before the debit and after the original idempotency receipt lookup.
DO $migration$
DECLARE body text; item record;
BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('public.rpc_kq_warehouse_preparations(uuid)'::regprocedure,
  '''injectorPriceCents'',1800',
  '''injectorPriceCents'',public.kq_warehouse_retail_supply_price(''WAREHOUSE-INJECTOR'')'),
 ('public.rpc_kq_warehouse_preparation_command(uuid,uuid,jsonb)'::regprocedure,
  'CASE WHEN spare IS NULL THEN 1800 ELSE 0 END',
  'CASE WHEN spare IS NULL THEN public.kq_warehouse_retail_supply_price(''WAREHOUSE-INJECTOR'') ELSE 0 END'),
 ('public.kq_warehouse_preparation_before_injectors(uuid,uuid,jsonb)'::regprocedure,
  'total:=item.price_cents*amount;',
  $new$total:=item.price_cents*amount;
  IF p_command->'expectedCents' IS DISTINCT FROM to_jsonb(total) THEN RAISE EXCEPTION 'kq_preparation_price_changed'; END IF;$new$)
 ) steps(signature,anchor,replacement)
 LOOP
   body:=pg_get_functiondef(item.signature);
   IF (length(body)-length(replace(body,item.anchor,'')))<>length(item.anchor) THEN
     RAISE EXCEPTION 'warehouse_retail_definition_changed: %',item.signature;
   END IF;
   EXECUTE replace(body,item.anchor,item.replacement);
 END LOOP;
END $migration$;

CREATE OR REPLACE FUNCTION public.rpc_kq_purchase_care_v2(
  p_user_id uuid,p_product_code text,p_quantity integer,p_request_key uuid,p_run_id uuid,p_expected_price_cents integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE total integer; unit_price integer; snapshot jsonb; command jsonb; previous jsonb; replay boolean;
BEGIN
  IF p_run_id IS NOT NULL THEN RAISE EXCEPTION 'warehouse_care_locked'; END IF;
  unit_price:=public.kq_care_price(p_product_code);
  IF unit_price IS NULL OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::text,0));
  command:=jsonb_build_object('action','purchase','code',p_product_code,'quantity',p_quantity,'requestKey',p_request_key);
  SELECT r.command INTO previous FROM public.kq_warehouse_preparation_receipts r
    WHERE r.user_id=p_user_id AND r.request_key=p_request_key;
  replay:=FOUND;
  IF replay THEN
    IF previous-'expectedCents' IS DISTINCT FROM command THEN RAISE EXCEPTION 'kq_preparation_request_mismatch'; END IF;
    command:=previous;
    total:=(previous->>'expectedCents')::integer;
    IF total IS NULL THEN
      SELECT (postings#>>'{0,deltaCents}')::integer INTO STRICT total FROM public.kq_treasury_journal
        WHERE user_id=p_user_id AND source_key='warehouse-input:'||p_request_key::text;
    END IF;
  ELSE
    total:=unit_price*p_quantity;
    IF p_expected_price_cents IS DISTINCT FROM total THEN RAISE EXCEPTION 'kq_care_price_changed'; END IF;
    command:=command||jsonb_build_object('expectedCents',total);
  END IF;
  snapshot:=public.rpc_kq_warehouse_preparation_command(p_user_id,p_request_key,command);
  RETURN jsonb_build_object('cashCents',snapshot->'cashCents','inventory',public.kq_warehouse_care_inventory(p_user_id,NULL),
    'totalPriceCents',total,'replayed',replay);
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_purchase_care_v2(uuid,text,integer,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_purchase_care_v2(uuid,text,integer,uuid,uuid,integer) TO service_role;

COMMIT;
