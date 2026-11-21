BEGIN;

-- The entrance package includes the installed airlock. Previously funded stock
-- and acquisition receipts keep their original quantities and cost basis.
CREATE FUNCTION public.kq_warehouse_included_installation_basis(p_previous jsonb,p_next jsonb) RETURNS bigint
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT public.kq_warehouse_new_handling_cost(p_previous,p_next)::bigint
    + CASE WHEN p_next ? 'stationPlacements' THEN
      greatest(0,public.kq_warehouse_handling_quantity(p_next,'SIM-HYGIENE-03')
                -public.kq_warehouse_handling_quantity(p_previous,'SIM-HYGIENE-03'))::bigint
      * public.kq_warehouse_retail_price('SIM-HYGIENE-03')
    ELSE 0 END;
$$;
REVOKE ALL ON FUNCTION public.kq_warehouse_included_installation_basis(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

DO $migration$
DECLARE step record; body text;
BEGIN
  FOR step IN SELECT * FROM (VALUES
    ('public.kq_warehouse_retail_price(text)'::regprocedure,
      '(''SIM-HYGIENE-03'', 832810)', '(''SIM-HYGIENE-03'', 1500000)'),
    -- This projection provides the area that must be prepared for a save or launch.
    -- An irrigation station still needs a prepared square metre. The threshold already exists.
    ('public.kq_warehouse_catalog_before_postharvest(jsonb)'::regprocedure,
      'allocated+coalesce(jsonb_array_length(p_state->''stationPlacements''),0)',
      'allocated+(SELECT count(*) FROM jsonb_array_elements(p_state->''stationPlacements'') s WHERE s->>''code''<>''SIM-HYGIENE-03'')'),
    ('public.kq_warehouse_validate_catalog_change(jsonb,jsonb,integer)'::regprocedure,
      'public.kq_warehouse_new_handling_cost(p_previous,p_next)', 'public.kq_warehouse_included_installation_basis(p_previous,p_next)'),
    ('public.kq_warehouse_validate_options_change(jsonb,jsonb,integer)'::regprocedure,
      'public.kq_warehouse_new_handling_cost(p_previous,p_next)', 'public.kq_warehouse_included_installation_basis(p_previous,p_next)'),
    -- A dedicated crop keeps the protection established at sowing. Moving the
    -- entrance equipment can still change the historical hygiene area in the cache.
    ('public.kq_warehouse_check_stations()'::regprocedure,
      'public.kq_warehouse_station_metrics(OLD.state,r.warehouse_zone_id)',
      '(public.kq_warehouse_station_metrics(OLD.state,r.warehouse_zone_id)-''hygieneAreaM2'')'),
    ('public.kq_warehouse_check_stations()'::regprocedure,
      'public.kq_warehouse_station_metrics(NEW.state,r.warehouse_zone_id)',
      '(public.kq_warehouse_station_metrics(NEW.state,r.warehouse_zone_id)-''hygieneAreaM2'')'),
    ('public.kq_staff_production_layout_guard()'::regprocedure,
      'public.kq_warehouse_station_metrics(OLD.state,zone_id)',
      '(public.kq_warehouse_station_metrics(OLD.state,zone_id)-''hygieneAreaM2'')'),
    ('public.kq_staff_production_layout_guard()'::regprocedure,
      'public.kq_warehouse_station_metrics(NEW.state,zone_id)',
      '(public.kq_warehouse_station_metrics(NEW.state,zone_id)-''hygieneAreaM2'')')
  ) changes(signature,anchor,replacement) LOOP
    body:=pg_get_functiondef(step.signature);
    IF length(body)-length(replace(body,step.anchor,''))<>length(step.anchor) THEN
      RAISE EXCEPTION 'warehouse_airlock_price_definition_changed: %',step.signature;
    END IF;
    EXECUTE replace(body,step.anchor,step.replacement);
  END LOOP;
END $migration$;

COMMIT;
