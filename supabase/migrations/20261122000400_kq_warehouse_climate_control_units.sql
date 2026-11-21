BEGIN;

-- Each sale unit belongs to one zone. Capacities are game areas. The older
-- references continue to represent square metres at their recorded cost basis.
CREATE FUNCTION public.kq_warehouse_zone_unit(p_code text) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
 SELECT jsonb_build_object('unit','device','capacityM2',capacity,'unitPriceCents',price,'installationIncluded',portable)
 FROM (VALUES
   ('SIM-CLIMATE-UNIT-01',20,28999,true), ('SIM-CLIMATE-UNIT-02',50,251600,false),
   ('SIM-CLIMATE-UNIT-03',100,2336329,false), ('SIM-CONTROL-UNIT-01',10,1649,true),
   ('SIM-CONTROL-UNIT-02',50,44900,false), ('SIM-CONTROL-UNIT-03',100,298900,false)
 ) offer(code,capacity,price,portable) WHERE code=p_code;
$$;

ALTER FUNCTION public.kq_warehouse_retail_price(text) RENAME TO kq_warehouse_retail_before_zone_units;
CREATE FUNCTION public.kq_warehouse_retail_price(p_code text) RETURNS integer
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
 SELECT coalesce((public.kq_warehouse_zone_unit(p_code)->>'unitPriceCents')::integer,
                 public.kq_warehouse_retail_before_zone_units(p_code));
$$;

CREATE OR REPLACE FUNCTION public.kq_warehouse_option(p_code text) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 WITH unit AS (SELECT public.kq_warehouse_zone_unit(p_code) AS offer),
 profile AS (SELECT offer, public.kq_warehouse_option_before_retail(
   CASE WHEN offer IS NULL THEN p_code ELSE replace(p_code,'-UNIT-','-') END) AS options FROM unit)
 SELECT CASE WHEN offer IS NOT NULL THEN
   (options-'equipmentCentsPerM2') || offer || jsonb_build_object('code',p_code)
 ELSE options || jsonb_build_object(
   'equipmentCentsPerM2',coalesce(public.kq_warehouse_retail_price(p_code),(options->>'equipmentCentsPerM2')::int),
   'unitPriceCents',coalesce(public.kq_warehouse_retail_price(p_code),(options->>'equipmentCentsPerM2')::int),
   'purchasable', options->>'family' NOT IN ('climate','control'))
 END FROM profile WHERE options IS NOT NULL;
$$;

CREATE FUNCTION public.kq_warehouse_option_quantity(p_area integer,p_option jsonb) RETURNS integer
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
 SELECT ceil(p_area::numeric/coalesce((p_option->>'capacityM2')::integer,1))::integer;
$$;

CREATE FUNCTION public.kq_warehouse_option_purchase(p_code text,p_previous numeric,p_next numeric,p_state jsonb) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path='' AS $$
DECLARE item jsonb:=public.kq_warehouse_option(p_code); required integer;
BEGIN
 IF item IS NULL THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
 IF p_next<=p_previous THEN RETURN 0; END IF;
 IF item->'purchasable'='false'::jsonb THEN RAISE EXCEPTION 'warehouse_device_retired'; END IF;
 IF item ? 'capacityM2' THEN
   SELECT coalesce(sum(public.kq_warehouse_option_quantity((z->>'width')::int*(z->>'height')::int,item)),0) INTO required
   FROM jsonb_array_elements(p_state->'zones') z WHERE z->'optionCodes' ? p_code;
   IF p_next>required THEN RAISE EXCEPTION 'warehouse_options_invalid'; END IF;
 END IF;
 RETURN (p_next-p_previous)::bigint*(item->>'unitPriceCents')::integer;
END $$;

ALTER FUNCTION public.kq_warehouse_included_installation_basis(jsonb,jsonb) RENAME TO kq_warehouse_included_before_zone_units;
CREATE FUNCTION public.kq_warehouse_included_installation_basis(p_previous jsonb,p_next jsonb) RETURNS bigint
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT public.kq_warehouse_included_before_zone_units(p_previous,p_next) + coalesce(sum(
   greatest(0,(entry->>'quantity')::integer-public.kq_warehouse_handling_quantity(p_previous,entry->>'code'))::bigint
     * (unit.offer->>'unitPriceCents')::integer),0)::bigint
 FROM jsonb_array_elements(p_next->'optionInventory') entry
 CROSS JOIN LATERAL (SELECT public.kq_warehouse_zone_unit(entry->>'code') AS offer) unit
 WHERE (unit.offer->>'installationIncluded')::boolean;
$$;

-- Share the funded-inventory and station checks with the historical balance.
-- Its entry point still restricts the catalogue to the original 24 area codes.
DO $migration$
DECLARE body text; step record;
BEGIN
 SELECT prosrc INTO STRICT body FROM pg_proc WHERE oid='public.kq_warehouse_options_projection_v1(jsonb)'::regprocedure;
 FOR step IN SELECT * FROM (VALUES
   ('jsonb_array_length(inventory)>24','jsonb_array_length(inventory)>(CASE WHEN whole_units THEN 30 ELSE 24 END)',1),
   ('public.kq_warehouse_option_v1(code)',
    'CASE WHEN whole_units THEN public.kq_warehouse_option(code) ELSE public.kq_warehouse_option_v1(code) END',2),
   ('COALESCE((demand->>code)::INTEGER,0)+area',
    'COALESCE((demand->>code)::INTEGER,0)+public.kq_warehouse_option_quantity(area,option)',1)
 ) edits(anchor,replacement,occurrences) LOOP
   IF length(body)-length(replace(body,step.anchor,''))<>length(step.anchor)*step.occurrences THEN
     RAISE EXCEPTION 'warehouse_zone_unit_projection_changed: %',step.anchor;
   END IF;
   body:=replace(body,step.anchor,step.replacement);
 END LOOP;
 EXECUTE format('CREATE FUNCTION public.kq_warehouse_funded_options(p_state jsonb,whole_units boolean) RETURNS jsonb
   LANGUAGE plpgsql IMMUTABLE SET search_path='''' AS %L',body);
END $migration$;

CREATE OR REPLACE FUNCTION public.kq_warehouse_options_projection_v1(p_state jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT public.kq_warehouse_funded_options(p_state,false);
$$;

-- Both save guards price purchased quantities. The condition ledger uses the
-- same price before applying the portion of the invoice actually paid in cash.
DO $migration$
DECLARE body text; step record;
BEGIN
 FOR step IN SELECT * FROM (VALUES
   ('public.kq_warehouse_options_projection(jsonb)'::regprocedure,
    'public.kq_warehouse_options_projection_v1(p_state)', 'public.kq_warehouse_funded_options(p_state,true)'),
   ('public.kq_warehouse_validate_assets(jsonb,jsonb)'::regprocedure,
    'IF amount<>(zone->>''width'')::NUMERIC*(zone->>''height'')::NUMERIC THEN',
    'IF amount<>public.kq_warehouse_option_quantity((zone->>''width'')::int*(zone->>''height'')::int,public.kq_warehouse_option(code)) THEN'),
   ('public.kq_warehouse_validate_options_change(jsonb,jsonb,integer)'::regprocedure,
    'GREATEST(0,(item->>''quantity'')::INTEGER-old_quantity)*(public.kq_warehouse_option(item->>''code'')->>''equipmentCentsPerM2'')::BIGINT',
    'public.kq_warehouse_option_purchase(item->>''code'',old_quantity,(item->>''quantity'')::int,p_next)'),
   ('public.kq_warehouse_validate_catalog_change(jsonb,jsonb,integer)'::regprocedure,
    E'GREATEST(0,(item->>''quantity'')::NUMERIC-old_quantity)\n   *(public.kq_warehouse_option(item->>''code'')->>''equipmentCentsPerM2'')::NUMERIC',
    'public.kq_warehouse_option_purchase(item->>''code'',old_quantity,(item->>''quantity'')::numeric,p_next)'),
   ('public.kq_work_inner_warehouse_save_condition(uuid,uuid,jsonb,integer,jsonb,jsonb,integer,jsonb,jsonb)'::regprocedure,
    '->>''equipmentCentsPerM2''', '->>''unitPriceCents''')
 ) edits(signature,anchor,replacement) LOOP
   body:=replace(pg_get_functiondef(step.signature),E'\r\n',E'\n');
   IF length(body)-length(replace(body,step.anchor,''))<>length(step.anchor) THEN
     RAISE EXCEPTION 'warehouse_zone_unit_definition_changed: % %',step.signature,step.anchor;
   END IF;
   EXECUTE replace(body,step.anchor,step.replacement);
 END LOOP;
END $migration$;

REVOKE ALL ON FUNCTION public.kq_warehouse_zone_unit(text),public.kq_warehouse_option_quantity(integer,jsonb),
 public.kq_warehouse_option_purchase(text,numeric,numeric,jsonb),
 public.kq_warehouse_funded_options(jsonb,boolean),public.kq_warehouse_retail_before_zone_units(text),
 public.kq_warehouse_retail_price(text),public.kq_warehouse_included_before_zone_units(jsonb,jsonb),
 public.kq_warehouse_included_installation_basis(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
