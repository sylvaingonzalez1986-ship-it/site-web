BEGIN;

-- Public French retail prices, converted to the game's sale unit. Sources and
-- pack sizes are in kanab-quest-warehouse-retail-equipment.json. Acquisition
-- receipts and the cost basis of previously purchased equipment stay historical.
CREATE FUNCTION public.kq_warehouse_retail_price(p_code text) RETURNS integer
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
 SELECT price FROM (VALUES
  ('MH-TS1000', 19295),
  ('SIM-LIGHT-02', 16999),
  ('SIM-LIGHT-03', 32999),
  ('SIM-AIR-01', 11531),
  ('SJ-DF16E350', 16200),
  ('SIM-AIR-03', 18900),
  ('SJ-DRYIT90', 4490),
  ('SIM-DRYING-02', 13320),
  ('SIM-DRYING-03', 19560),
  ('LP-SUPER-1L', 2870),
  ('BROR-JARS-48', 35960),
  ('CURTEC-60L', 3490),
  ('SIM-STORAGE-CLIMATE-01', 39500),
  ('SIM-STORAGE-CLIMATE-02', 57900),
  ('SIM-STORAGE-CLIMATE-03', 107900),
  ('SIM-WATER-01', 1288),
  ('SIM-WATER-02', 271),
  ('SIM-WATER-03', 80662),
  ('SIM-CLIMATE-01', 1450),
  ('SIM-CLIMATE-02', 2516),
  ('SIM-CLIMATE-03', 23363),
  ('SIM-CONTROL-01', 412),
  ('SIM-CONTROL-02', 2245),
  ('SIM-CONTROL-03', 2989),
  ('SIM-HYGIENE-03', 832810),
  ('SIM-LOGISTICS-01', 32990),
  ('SIM-LOGISTICS-02', 7240),
  ('SIM-LOGISTICS-03', 145080),
  ('SIM-SUBSTRATE-01', 4139),
  ('SIM-SUBSTRATE-02', 14845),
  ('SIM-SUBSTRATE-03', 1350),
  ('GV-GP50-7', 89900),
  ('GV-WASHER-36L', 9900)
 ) AS offer(code,price) WHERE code=p_code;
$$;

ALTER FUNCTION public.kq_warehouse_device(text) RENAME TO kq_warehouse_device_before_retail;
CREATE FUNCTION public.kq_warehouse_device(p_code text) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT public.kq_warehouse_device_before_retail(p_code)
   || jsonb_strip_nulls(jsonb_build_object('priceCents',public.kq_warehouse_retail_price(p_code)));
$$;

ALTER FUNCTION public.kq_warehouse_option(text) RENAME TO kq_warehouse_option_before_retail;
CREATE FUNCTION public.kq_warehouse_option(p_code text) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT public.kq_warehouse_option_before_retail(p_code)
   || jsonb_strip_nulls(jsonb_build_object('equipmentCentsPerM2',public.kq_warehouse_retail_price(p_code)));
$$;

REVOKE ALL ON FUNCTION public.kq_warehouse_retail_price(text),public.kq_warehouse_device(text),
 public.kq_warehouse_option(text),public.kq_warehouse_device_before_retail(text),
 public.kq_warehouse_option_before_retail(text) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
