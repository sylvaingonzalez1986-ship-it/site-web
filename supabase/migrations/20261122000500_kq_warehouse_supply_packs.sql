BEGIN;

-- Pack prices and game charges are independent. Historic per-charge prices
-- remain available for receipts and old saves.
CREATE FUNCTION public.kq_supply_packs()
RETURNS TABLE(code text,pack_price integer,charges integer) LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 VALUES ('WAREHOUSE-NUTRITION-BASE',1490,100),('WAREHOUSE-NUTRITION-SUPPLEMENT',450,100),
 ('WAREHOUSE-PBI',1188,10),('WAREHOUSE-MAINTENANCE',750,500),
 ('CARE-COMPOST-TEA',1990,20),('CARE-VERMICOMPOST',2200,40),('CARE-ORGANIC-FEED',590,100),
 ('CARE-SEAWEED',945,50),('CARE-APHIDIUS',2226,500),('CARE-PHYTOSEIULUS',1695,25),
 ('CARE-SWIRSKII',6330,500),('CARE-ORIUS',2532,125),('CARE-CHRYSOPERLA',2110,50),
 ('CARE-COCCINELLA',1090,5),('CARE-IRON',1390,100),('CARE-PERLITE',690,10),
 ('CARE-SHADE',2999,8),('CARE-BLUE-TRAPS',1188,10);
$$;
ALTER FUNCTION public.kq_warehouse_retail_supply_price(text) RENAME TO kq_retail_supply_price_before_packs;
CREATE FUNCTION public.kq_warehouse_retail_supply_price(p_code text) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(public.kq_retail_supply_price_before_packs(p_code),
   (SELECT round(pack_price::numeric/charges)::integer FROM public.kq_supply_packs() WHERE code=p_code));
$$;
CREATE OR REPLACE FUNCTION public.kq_warehouse_preparation_catalog()
RETURNS TABLE(code text,name text,kind text,price_cents integer,unit text) LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT d.code,d.name,d.kind,public.kq_warehouse_retail_supply_price(d.code),d.unit FROM public.kq_warehouse_preparation_descriptions() d
 UNION ALL
 SELECT p.code,p.name,'consumable',public.kq_warehouse_retail_supply_price(p.code),'charge'
 FROM (VALUES ('CARE-IRON','Fer chélaté'),('CARE-PERLITE','Perlite horticole'),('CARE-SHADE','Filet d’ombrage'),
   ('CARE-BLUE-TRAPS','Plaques bleues engluées')) p(code,name);
$$;

-- Persistent serial numbers identify interchangeable game charges without a
-- row per charge. A later purchase always appends beyond the highest serial
-- ever issued. A seed snapshot records which serials were free at that time.
ALTER TABLE public.kq_warehouse_input_stock ADD COLUMN issued bigint NOT NULL DEFAULT 0,
 ADD COLUMN remaining_units int8multirange NOT NULL DEFAULT '{}';
ALTER TABLE public.kq_warehouse_run_inputs ADD COLUMN held_units int8multirange NOT NULL DEFAULT '{}',
 ADD COLUMN seed_units int8multirange;
ALTER TABLE public.kq_warehouse_irrigation_programs ADD COLUMN held_units jsonb NOT NULL DEFAULT '{}';
UPDATE public.kq_warehouse_input_stock s SET issued=quantity, remaining_units=int8multirange(int8range(0,quantity))
 WHERE EXISTS(SELECT FROM public.kq_supply_packs() p WHERE p.code=s.code);

CREATE FUNCTION public.kq_supply_count(p_units int8multirange) RETURNS bigint LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(sum(upper(r)-lower(r)),0)::bigint FROM unnest(p_units) r;
$$;
CREATE FUNCTION public.kq_supply_first(p_units int8multirange,p_count bigint) RETURNS int8multirange
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE r int8range; take bigint; result int8multirange:='{}';
BEGIN
 FOR r IN SELECT unnest(p_units) LOOP
  EXIT WHEN p_count=0;
  take:=least(upper(r)-lower(r),p_count);
  result:=result+int8multirange(int8range(lower(r),lower(r)+take));
  p_count:=p_count-take;
 END LOOP;
 IF p_count<>0 THEN RAISE EXCEPTION 'kq_preparation_stock'; END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.kq_supply_free(p_user uuid) RETURNS TABLE(code text,units int8multirange)
LANGUAGE sql STABLE SET search_path='' AS $$
 WITH layout AS (SELECT w.state FROM public.kq_warehouse_layouts w WHERE w.user_id=p_user),
 held AS (
  SELECT i.code,i.held_units FROM public.kq_warehouse_run_inputs i JOIN public.kq_runs r ON r.id=i.run_id
   WHERE r.user_id=p_user AND r.status='active' AND i.reserved>0
  UNION ALL
  SELECT e.key,e.value::int8multirange FROM layout, LATERAL public.kq_warehouse_live_programs(p_user,layout.state,
   CASE WHEN layout.state ? 'stationPlacements' THEN public.kq_warehouse_preparation_station_coverage(layout.state) ELSE '{}'::jsonb END,now()) p
   CROSS JOIN LATERAL jsonb_each_text(p.held_units) e
 ), totals AS (SELECT h.code,range_agg(h.held_units) AS units FROM held h GROUP BY h.code)
 SELECT s.code,s.remaining_units-coalesce(t.units,'{}'::int8multirange) FROM public.kq_warehouse_input_stock s
 LEFT JOIN totals t ON t.code=s.code WHERE s.user_id=p_user AND s.issued>0;
$$;

-- Assign existing dedicated balances real serials before taking new seed
-- snapshots. Expired programs release their units through the existing clock.
DO $$
DECLARE row record;
BEGIN
 FOR row IN SELECT i.run_id,i.code,i.reserved,r.user_id FROM public.kq_warehouse_run_inputs i
  JOIN public.kq_runs r ON r.id=i.run_id WHERE i.reserved>0 AND r.status='active' ORDER BY i.run_id,i.code LOOP
  UPDATE public.kq_warehouse_run_inputs SET held_units=public.kq_supply_first(
   (SELECT f.units FROM public.kq_supply_free(row.user_id) f WHERE f.code=row.code),row.reserved)
   WHERE run_id=row.run_id AND code=row.code;
 END LOOP;
END $$;
CREATE FUNCTION public.kq_supply_hold_program() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 SELECT jsonb_object_agg(q.key,public.kq_supply_first(f.units,q.value::bigint)::text) INTO NEW.held_units
 FROM jsonb_each(NEW.quantities) q LEFT JOIN public.kq_supply_free(NEW.user_id) f ON f.code=q.key;
 RETURN NEW;
END $$;
CREATE TRIGGER kq_supply_hold_program BEFORE INSERT OR UPDATE OF quantities ON public.kq_warehouse_irrigation_programs
 FOR EACH ROW EXECUTE FUNCTION public.kq_supply_hold_program();
DO $$
DECLARE row record;
BEGIN
 FOR row IN SELECT p.* FROM public.kq_warehouse_layouts w CROSS JOIN LATERAL public.kq_warehouse_live_programs(
  w.user_id,w.state,CASE WHEN w.state ? 'stationPlacements' THEN public.kq_warehouse_preparation_station_coverage(w.state)
    ELSE '{}'::jsonb END,now()) p ORDER BY w.user_id,p.station_id,p.zone_id LOOP
  UPDATE public.kq_warehouse_irrigation_programs SET quantities=row.quantities
   WHERE user_id=row.user_id AND station_id=row.station_id AND zone_id=row.zone_id;
 END LOOP;
END $$;

CREATE FUNCTION public.kq_supply_consume_program(p_user uuid,p_zone text,p_plan jsonb,p_coverage jsonb,p_at timestamptz)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE item record;
BEGIN
 FOR item IN SELECT e.key,range_agg(e.value::int8multirange) units FROM
  public.kq_warehouse_live_programs(p_user,p_plan,p_coverage,p_at) p CROSS JOIN LATERAL jsonb_each_text(p.held_units) e
  WHERE p.zone_id=p_zone GROUP BY e.key LOOP
  UPDATE public.kq_warehouse_input_stock SET remaining_units=remaining_units-item.units
   WHERE user_id=p_user AND code=item.key AND remaining_units @> item.units;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_preparation_stock'; END IF;
 END LOOP;
END $$;

CREATE FUNCTION pg_temp.kq_supply_patch(signature regprocedure,anchor text,replacement text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE body text:=replace(pg_get_functiondef(signature),chr(13),'');
BEGIN
 IF length(body)-length(replace(body,anchor,''))<>length(anchor) THEN RAISE EXCEPTION 'supply_pack_definition_changed: % / %',signature,anchor; END IF;
 EXECUTE replace(body,anchor,replacement);
END $$;
SELECT pg_temp.kq_supply_patch('public.kq_warehouse_launch_preparations(uuid,uuid,uuid[],jsonb,text)',
 'SELECT * INTO STRICT leader', $body$PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::text,0));
 SELECT * INTO STRICT leader$body$);
SELECT pg_temp.kq_supply_patch('public.kq_warehouse_launch_preparations(uuid,uuid,uuid[],jsonb,text)',
 'SELECT coalesce(jsonb_object_agg(key,amount)', $body$IF manual<>'{}'::jsonb THEN RAISE EXCEPTION 'kq_preparation_manual_allocation'; END IF;
  SELECT coalesce(jsonb_object_agg(key,amount)$body$);
SELECT pg_temp.kq_supply_patch('public.kq_warehouse_launch_preparations(uuid,uuid,uuid[],jsonb,text)',
 'DELETE FROM public.kq_warehouse_irrigation_programs', $body$PERFORM public.kq_supply_consume_program(p_user,zone,plan,coverage,at);
  DELETE FROM public.kq_warehouse_irrigation_programs$body$);
SELECT pg_temp.kq_supply_patch('public.kq_warehouse_launch_preparations(uuid,uuid,uuid[],jsonb,text)',
 'UPDATE public.kq_runs SET state=state||', $body$INSERT INTO public.kq_warehouse_run_inputs(run_id,code,reserved,consumed,seed_units)
 SELECT r.id,p.code,0,0,coalesce(f.units,'{}'::int8multirange) FROM public.kq_runs r
 CROSS JOIN public.kq_supply_packs() p LEFT JOIN public.kq_supply_free(p_user) f ON f.code=p.code
 WHERE r.user_id=p_user AND r.id=ANY(p_runs)
 ON CONFLICT(run_id,code) DO UPDATE SET seed_units=excluded.seed_units;
 UPDATE public.kq_runs SET state=state||$body$);

-- On campaign members the leader owns the authoritative stage and the map of
-- zone effects. The member row owns its individual allocation and footprint.
CREATE FUNCTION public.kq_supply_runs(p_user uuid) RETURNS TABLE(run_id uuid,zone_id text,leader_id uuid,
 area integer,pricing_units integer,live boolean) LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT r.id,r.warehouse_zone_id,l.id,coalesce((r.state#>>'{warehouse,activeAreaM2}')::int,0),
   (public.kq_care_pricing(l.state)->>'pricingUnits')::int,
   l.state->'cultureDead' IS DISTINCT FROM 'true'::jsonb AND l.state->>'phase' IS DISTINCT FROM 'complete'
    AND coalesce((l.state->>'stageIndex')::int,0)<5 AND NOT(coalesce((l.state->>'stageIndex')::int,0)=4 AND coalesce(l.state->>'phase','')='resolved')
 FROM public.kq_runs r JOIN public.kq_runs l ON l.user_id=r.user_id AND
  (l.id=r.id AND r.campaign_id IS NULL OR l.campaign_id=r.campaign_id AND l.id::text=l.state#>>'{campaign,leaderRunId}')
 WHERE r.user_id=p_user AND r.status='active' AND l.status='active' AND l.state->'warehousePreparations' ? r.warehouse_zone_id;
$$;
CREATE FUNCTION public.kq_supply_run_stock(p_user uuid)
RETURNS TABLE(run_id uuid,zone_id text,leader_id uuid,code text,reserved integer,consumed integer,
 shared_units int8multirange,legacy_passes integer,legacy_area integer,legacy_charges bigint,available bigint)
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT r.run_id,r.zone_id,r.leader_id,p.code,coalesce(i.reserved,0),coalesce(i.consumed,0),stock.units,
  stock.passes,stock.square_metres,stock.passes::bigint*r.pricing_units+stock.square_metres,
  CASE WHEN NOT r.live THEN 0 WHEN p.code LIKE 'CARE-%' THEN coalesce(i.reserved,0)+public.kq_supply_count(stock.units)
    +stock.passes::bigint*r.pricing_units+stock.square_metres
   ELSE least(coalesce(i.reserved,0)+public.kq_supply_count(stock.units),greatest(0,r.area-coalesce(i.consumed,0))) END
 FROM public.kq_supply_runs(p_user) r CROSS JOIN public.kq_supply_packs() p
 LEFT JOIN public.kq_warehouse_run_inputs i ON i.run_id=r.run_id AND i.code=p.code
 LEFT JOIN public.kq_supply_free(p_user) f ON f.code=p.code
 LEFT JOIN public.kq_care_inventory old ON old.user_id=p_user AND old.product_code=p.code AND i.seed_units IS NOT NULL
 CROSS JOIN LATERAL (SELECT coalesce(i.seed_units*f.units,'{}'::int8multirange) units,
    coalesce(old.quantity,0) passes,coalesce(old.area_quantity,0) square_metres) stock;
$$;

CREATE OR REPLACE FUNCTION public.kq_warehouse_consume_inputs(p_user uuid,p_run uuid,p_quantities jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item record; own record; eligibility record; charge_count integer; from_hold integer; from_legacy integer;
 held int8multirange; used int8multirange;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user::text,0));
 SELECT * INTO own FROM public.kq_supply_runs(p_user) WHERE run_id=p_run AND live;
 IF NOT FOUND THEN RAISE EXCEPTION 'kq_preparation_run'; END IF;
 FOR item IN SELECT key,value::int AS amount FROM jsonb_each(public.kq_warehouse_quantities(p_quantities)) ORDER BY key LOOP
  SELECT * INTO STRICT eligibility FROM public.kq_supply_run_stock(p_user) WHERE run_id=p_run AND code=item.key;
  IF item.key NOT LIKE 'CARE-%' AND item.amount+eligibility.consumed>own.area THEN RAISE EXCEPTION 'kq_preparation_coverage'; END IF;
  IF item.amount>eligibility.available THEN RAISE EXCEPTION 'kq_preparation_reserved'; END IF;
  from_hold:=least(item.amount,eligibility.reserved);
  held:=public.kq_supply_first((SELECT i.held_units FROM public.kq_warehouse_run_inputs i
     WHERE i.run_id=p_run AND i.code=item.key),from_hold);
  from_legacy:=0;
  -- A historic pass opens at its original full-crop scale on first use.
  -- Only care application can reach this branch; one targeted use costs one.
  IF item.key LIKE 'CARE-%' AND item.amount>from_hold AND eligibility.legacy_charges>0 THEN
   IF item.amount<>1 THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
   UPDATE public.kq_care_inventory SET quantity=quantity-CASE WHEN area_quantity=0 THEN 1 ELSE 0 END,
    area_quantity=CASE WHEN area_quantity>0 THEN area_quantity-1 ELSE own.pricing_units-1 END,updated_at=now()
    WHERE user_id=p_user AND product_code=item.key AND (area_quantity>0 OR quantity>0);
   IF NOT FOUND THEN RAISE EXCEPTION 'kq_preparation_stock'; END IF;
   from_legacy:=1;
  END IF;
  charge_count:=item.amount-from_legacy;
  used:=held+public.kq_supply_first(eligibility.shared_units,charge_count-from_hold);
  IF charge_count>0 THEN
   UPDATE public.kq_warehouse_input_stock SET remaining_units=remaining_units-used,quantity=quantity-charge_count
    WHERE user_id=p_user AND code=item.key AND quantity>=charge_count AND remaining_units @> used;
   IF NOT FOUND THEN RAISE EXCEPTION 'kq_preparation_stock'; END IF;
  END IF;
  INSERT INTO public.kq_warehouse_run_inputs AS i(run_id,code,reserved,consumed) VALUES(p_run,item.key,0,item.amount)
   ON CONFLICT(run_id,code) DO UPDATE SET reserved=i.reserved-from_hold,held_units=i.held_units-held,consumed=i.consumed+excluded.consumed;
 END LOOP;
END $$;

SELECT pg_temp.kq_supply_patch('public.kq_warehouse_preparation_before_injectors(uuid,uuid,jsonb)',
 $anchor$IF NOT FOUND OR NOT(run.state ? 'warehousePreparations') THEN$anchor$,
 $body$IF NOT FOUND OR NOT EXISTS(SELECT FROM public.kq_supply_runs(p_user_id) s WHERE s.run_id=run.id AND s.live) THEN$body$);
SELECT pg_temp.kq_supply_patch('public.kq_warehouse_preparation_before_injectors(uuid,uuid,jsonb)',
 $anchor$leader:=coalesce((run.state#>>'{campaign,leaderRunId}')::uuid,run.id);$anchor$,
 $body$SELECT s.leader_id INTO STRICT leader FROM public.kq_supply_runs(p_user_id) s WHERE s.run_id=run.id;$body$);

CREATE OR REPLACE FUNCTION public.kq_warehouse_care_inventory(p_user uuid,p_run uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 WITH stock AS MATERIALIZED (SELECT * FROM public.kq_supply_run_stock(p_user) WHERE leader_id=p_run AND code LIKE 'CARE-%'),
 totals AS (SELECT s.code AS product,sum(s.reserved) AS reserved,range_agg(s.shared_units) AS shared_units,
    max(s.legacy_charges) AS legacy_charges,max(s.legacy_passes) AS passes,max(s.legacy_area) AS legacy_area,
    jsonb_object_agg(s.zone_id,s.available) AS zones,bool_or(s.available>0) AS actionable
    FROM stock s GROUP BY s.code),
 items AS (
  SELECT product,CASE WHEN actionable THEN reserved+public.kq_supply_count(shared_units)+legacy_charges ELSE 0 END AS quantity,
   passes,CASE WHEN actionable THEN reserved+public.kq_supply_count(shared_units)+legacy_area ELSE 0 END AS square_metres,zones FROM totals
  UNION ALL
  SELECT p.code,public.kq_supply_count(f.units)+coalesce(old.area_quantity,0)+coalesce(old.quantity,0),
   coalesce(old.quantity,0),public.kq_supply_count(f.units)+coalesce(old.area_quantity,0),'{}'::jsonb FROM public.kq_supply_packs() p
   LEFT JOIN public.kq_supply_free(p_user) f ON f.code=p.code LEFT JOIN public.kq_care_inventory old ON old.user_id=p_user AND old.product_code=p.code
   WHERE p_run IS NULL AND p.code LIKE 'CARE-%'
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('productCode',product,'quantity',quantity,'legacyQuantity',passes,
    'areaQuantity',square_metres,'zoneQuantities',zones) ORDER BY product),'[]'::jsonb) FROM items;
$$;

-- Keep existing equipment, injector and airlock snapshots. All four general
-- supplies have a per-zone use limit; shared quantities can appear in more
-- than one zone until the first successful debit.
ALTER FUNCTION public.rpc_kq_warehouse_preparations(uuid) RENAME TO kq_preparations_before_packs;
REVOKE ALL ON FUNCTION public.kq_preparations_before_packs(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.rpc_kq_warehouse_preparations(p_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH prior AS (SELECT public.kq_preparations_before_packs(p_user_id) snapshot), runs AS (
  SELECT run_id,zone_id,jsonb_object_agg(code,available) AS available,
   coalesce(jsonb_object_agg(code,reserved) FILTER(WHERE reserved>0),'{}') AS reserved,
   coalesce(jsonb_object_agg(code,consumed) FILTER(WHERE consumed>0),'{}') AS consumed
  FROM public.kq_supply_run_stock(p_user_id) GROUP BY run_id,zone_id
 )
 SELECT snapshot||jsonb_build_object('items',(SELECT jsonb_agg(item||CASE WHEN p.code IS NULL THEN '{}'::jsonb ELSE
   jsonb_build_object('packPriceCents',p.pack_price,'chargesPerPack',p.charges,'legacyPassQuantity',coalesce(old.quantity,0),
    'availableQuantity',(item->>'availableQuantity')::bigint+coalesce(old.area_quantity,0)) END ORDER BY n)
   FROM jsonb_array_elements(snapshot->'items') WITH ORDINALITY a(item,n) LEFT JOIN public.kq_supply_packs() p ON p.code=item->>'code'
   LEFT JOIN public.kq_care_inventory old ON old.user_id=p_user_id AND old.product_code=p.code),
  'runs',coalesce((SELECT jsonb_agg(jsonb_build_object('runId',run_id,'zoneId',zone_id,'available',available,
    'reserved',reserved,'consumed',consumed) ORDER BY zone_id) FROM runs),'[]'::jsonb)) FROM prior;
$$;

-- Both entry points acquire the existing wallet lock. Replays are looked up
-- before checking current prices and before issuing any new serials.
ALTER FUNCTION public.rpc_kq_warehouse_preparation_command(uuid,uuid,jsonb) RENAME TO kq_preparation_command_before_packs;
REVOKE ALL ON FUNCTION public.kq_preparation_command_before_packs(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.rpc_kq_warehouse_preparation_command(p_user_id uuid,p_request_key uuid,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE action text:=p_command->>'action'; sku text:=p_command->>'code'; offer record; previous jsonb;
 packs integer; credits bigint; total integer;
BEGIN
 IF action IS DISTINCT FROM 'purchasePack' AND (action IS DISTINCT FROM 'purchase' OR NOT EXISTS(SELECT FROM public.kq_supply_packs() WHERE code=sku)) THEN
  RETURN public.kq_preparation_command_before_packs(p_user_id,p_request_key,p_command);
 END IF;
 IF p_user_id IS NULL OR p_request_key IS NULL OR (p_command ? 'requestKey' AND p_command->>'requestKey' IS DISTINCT FROM p_request_key::text)
  THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::text,0));
 SELECT r.command INTO previous FROM public.kq_warehouse_preparation_receipts r WHERE r.user_id=p_user_id AND r.request_key=p_request_key;
 IF FOUND THEN
  IF previous IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'kq_preparation_request_mismatch'; END IF;
  RETURN public.rpc_kq_warehouse_preparations(p_user_id);
 END IF;
 IF action='purchase' THEN RAISE EXCEPTION 'kq_preparation_pack_required'; END IF;
 IF EXISTS(SELECT FROM public.kq_care_purchases h WHERE h.user_id=p_user_id AND h.request_key=p_request_key) THEN RAISE EXCEPTION 'kq_preparation_request_mismatch'; END IF;
 SELECT p.*,c.name INTO offer FROM public.kq_supply_packs() p JOIN public.kq_warehouse_preparation_catalog() c USING(code) WHERE p.code=sku;
 IF NOT FOUND OR jsonb_typeof(p_command->'quantity') IS DISTINCT FROM 'number'
  OR (p_command->>'quantity') !~ '^[1-9][0-9]{0,2}$' OR (p_command->>'quantity')::int>100 THEN RAISE EXCEPTION 'kq_preparation_invalid'; END IF;
 packs:=(p_command->>'quantity')::int;
 total:=offer.pack_price*packs; credits:=offer.charges::bigint*packs;
 IF p_command->'expectedCents' IS DISTINCT FROM to_jsonb(total) THEN RAISE EXCEPTION 'kq_preparation_price_changed'; END IF;
 PERFORM public.kq_treasury_initialize(p_user_id);
 UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents-total,updated_at=now() WHERE user_id=p_user_id AND cash_cents>=total;
 IF NOT FOUND THEN RAISE EXCEPTION 'kq_preparation_cash'; END IF;
 INSERT INTO public.kq_warehouse_input_stock AS s(user_id,code,quantity,issued,remaining_units)
 VALUES(p_user_id,sku,credits,credits,int8multirange(int8range(0,credits)))
 ON CONFLICT(user_id,code) DO UPDATE SET quantity=s.quantity+credits,issued=s.issued+credits,
  remaining_units=s.remaining_units+int8multirange(int8range(s.issued,s.issued+credits));
 PERFORM public.kq_treasury_pair(p_user_id,'culture-input','warehouse-input:'||p_request_key::text,
   now(),'expense_other','suspense',total,offer.name);
 INSERT INTO public.kq_warehouse_preparation_receipts(user_id,request_key,command) VALUES(p_user_id,p_request_key,p_command);
 RETURN public.rpc_kq_warehouse_preparations(p_user_id);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_purchase_care_v2(
 p_user_id uuid,p_product_code text,p_quantity integer,p_request_key uuid,p_run_id uuid,p_expected_price_cents integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE history public.kq_care_purchases%ROWTYPE; previous jsonb; purchase jsonb; snapshot jsonb; total integer; replay boolean;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 20 OR public.kq_care_price(p_product_code) IS NULL
  THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::text,0));
 SELECT * INTO history FROM public.kq_care_purchases WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF history.product_code<>p_product_code OR history.quantity<>p_quantity OR (history.pricing_units IS NOT NULL AND history.run_id IS DISTINCT FROM p_run_id)
   THEN RAISE EXCEPTION 'kq_care_request_mismatch'; END IF;
  RETURN jsonb_build_object('cashCents',(SELECT cash_cents FROM public.kq_equipment_wallets WHERE user_id=p_user_id),
   'inventory',public.kq_warehouse_care_inventory(p_user_id,NULL),'totalPriceCents',history.total_price_cents,'replayed',true);
 END IF;
 IF p_run_id IS NOT NULL THEN RAISE EXCEPTION 'warehouse_care_locked'; END IF;
 SELECT r.command INTO previous FROM public.kq_warehouse_preparation_receipts r WHERE r.user_id=p_user_id AND r.request_key=p_request_key;
 replay:=FOUND;
 IF replay THEN
  IF previous->>'action' NOT IN ('purchase','purchasePack') OR previous->>'code' IS DISTINCT FROM p_product_code
    OR previous->'quantity' IS DISTINCT FROM to_jsonb(p_quantity) THEN RAISE EXCEPTION 'kq_preparation_request_mismatch'; END IF;
  total:=(previous->>'expectedCents')::int;
  IF total IS NULL THEN SELECT (postings#>>'{0,deltaCents}')::int INTO STRICT total FROM public.kq_treasury_journal
   WHERE user_id=p_user_id AND source_key='warehouse-input:'||p_request_key::text; END IF;
  purchase:=previous;
 ELSE
  SELECT p.pack_price*p_quantity INTO STRICT total FROM public.kq_supply_packs() p WHERE p.code=p_product_code;
  IF total IS DISTINCT FROM p_expected_price_cents THEN RAISE EXCEPTION 'kq_care_price_changed'; END IF;
  purchase:=jsonb_build_object('action','purchasePack','code',p_product_code,'quantity',p_quantity,'requestKey',p_request_key,'expectedCents',total);
 END IF;
 snapshot:=public.rpc_kq_warehouse_preparation_command(p_user_id,p_request_key,purchase);
 RETURN jsonb_build_object('cashCents',snapshot->'cashCents','inventory',public.kq_warehouse_care_inventory(p_user_id,NULL),
  'totalPriceCents',total,'replayed',replay);
END $$;

-- Give the care shop the public package quote regardless of the area of the
-- current crop. The basic-care price and historical treatment scales stay intact.
SELECT pg_temp.kq_supply_patch('public.rpc_kq_care_shop_v2(uuid,uuid)',
 $anchor$SELECT jsonb_object_agg(code,public.kq_care_price(code)*(pricing->>'pricingUnits')::INTEGER) INTO prices
 FROM unnest(ARRAY['CARE-COMPOST-TEA','CARE-VERMICOMPOST','CARE-ORGANIC-FEED','CARE-SEAWEED','CARE-APHIDIUS','CARE-PHYTOSEIULUS','CARE-SWIRSKII','CARE-ORIUS','CARE-CHRYSOPERLA','CARE-COCCINELLA']) code;$anchor$,
 $body$SELECT jsonb_object_agg(code,pack_price) INTO prices FROM public.kq_supply_packs() WHERE code LIKE 'CARE-%';$body$);

-- Older spatial saves derive their first affected pot from the original
-- deterministic draw until plant positions are stored on the next turn.
CREATE FUNCTION public.kq_supply_problem_cell(p_state jsonb,p_problem jsonb,p_target jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE h bigint:=2166136261; input text; n int; area int; cell int; z jsonb; width int;
BEGIN
 IF p_target IS NULL THEN RETURN true; END IF;
 IF p_problem ? 'plants' THEN RETURN EXISTS(SELECT FROM jsonb_array_elements(p_problem->'plants') plant WHERE plant @> p_target); END IF;
 input:=concat_ws('/',p_state->>'seed',p_problem->>'appearedAt',p_problem->>'code','origin');
 FOR n IN 1..length(input) LOOP h:=((h # ascii(substr(input,n,1)))*16777619) % 4294967296; END LOOP;
 h:=mod((h # (h >> 16))::numeric*2246822507,4294967296)::bigint;
 h:=h # (h >> 13);
 SELECT sum((v->>'width')::int*(v->>'height')::int)::int INTO area FROM public.kq_care_crop_zones(p_state) v;
 IF coalesce(area,0)=0 THEN RETURN false; END IF;
 cell:=(h%(4*area))/4;
 FOR z IN SELECT * FROM public.kq_care_crop_zones(p_state) LOOP
  width:=(z->>'width')::int;
  IF cell<width*(z->>'height')::int THEN RETURN z->>'id'=p_target->>'zoneId' AND cell%width=(p_target->>'x')::int AND cell/width=(p_target->>'y')::int; END IF;
  cell:=cell-width*(z->>'height')::int;
 END LOOP;
 RETURN false;
END $$;
SELECT pg_temp.kq_supply_patch('public.kq_work_inner_apply_care(uuid,uuid,text,uuid,timestamptz,jsonb,integer)',
 $anchor$application:=jsonb_build_object('productCode',p_product_code,'stageIndex',step);$anchor$,
 $body$IF p_product_code IN ('CARE-IRON','CARE-PERLITE','CARE-SHADE','CARE-BLUE-TRAPS') AND (
   (p_product_code='CARE-IRON' AND care->'problems' @> '[{"code":"SALTS"}]'::jsonb) OR NOT EXISTS(
   SELECT FROM jsonb_array_elements(care->'problems') prob WHERE prob->>'code'=CASE p_product_code WHEN 'CARE-IRON' THEN 'IRON'
    WHEN 'CARE-PERLITE' THEN 'ROOTS' WHEN 'CARE-SHADE' THEN 'HEAT' WHEN 'CARE-BLUE-TRAPS' THEN 'THRIPS' END
    AND public.kq_supply_problem_cell(run.state,prob,target))) THEN RAISE EXCEPTION 'kq_care_invalid_request'; END IF;
   application:=jsonb_build_object('productCode',p_product_code,'stageIndex',step);$body$);

-- Integrate purchases in the original history and cursor. Both pre-pack
-- warehouse receipts and new packs use the immutable accounting timestamp.
SELECT pg_temp.kq_supply_patch('public.rpc_kq_care_purchase_register(uuid,timestamptz,text)',
 'FROM public.kq_care_purchases WHERE user_id=p_user_id', $body$FROM public.kq_care_purchases WHERE user_id=p_user_id
  UNION ALL
  SELECT 'warehouse:'||r.request_key::text,CASE WHEN cardinality(public.kq_care_pbi_pests(r.command->>'code'))>0 THEN 'pbi' ELSE 'input' END,
   r.command->>'code',(r.command->>'quantity')::int,(j.postings#>>'{0,deltaCents}')::int,j.occurred_at,NULL::uuid,NULL::int,NULL::smallint
  FROM public.kq_warehouse_preparation_receipts r JOIN public.kq_treasury_journal j ON j.user_id=r.user_id AND j.source_key='warehouse-input:'||r.request_key::text
  WHERE r.user_id=p_user_id AND r.command->>'action' IN ('purchase','purchasePack') AND r.command->>'code' LIKE 'CARE-%'$body$);

REVOKE ALL ON FUNCTION public.kq_supply_packs(),public.kq_retail_supply_price_before_packs(text),
 public.kq_warehouse_retail_supply_price(text),public.kq_supply_count(int8multirange),public.kq_supply_first(int8multirange,bigint),
 public.kq_supply_free(uuid),public.kq_supply_hold_program(),public.kq_supply_consume_program(uuid,text,jsonb,jsonb,timestamptz),
 public.kq_supply_runs(uuid),public.kq_supply_run_stock(uuid),public.kq_supply_problem_cell(jsonb,jsonb,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_warehouse_preparations(uuid),public.rpc_kq_warehouse_preparation_command(uuid,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_warehouse_preparations(uuid),public.rpc_kq_warehouse_preparation_command(uuid,uuid,jsonb) TO service_role;

COMMIT;
