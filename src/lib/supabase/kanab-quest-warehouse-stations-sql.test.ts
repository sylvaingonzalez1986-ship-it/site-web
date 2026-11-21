import retailEquipment from "../kanab-quest-warehouse-retail-equipment.json";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeKqWarehouseCondition, reconcileKqWarehouseCondition } from "../kanab-quest-warehouse-condition";
import { createKqWarehouseEmpty, createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot } from "../kanab-quest-warehouse";
import { quoteKqWarehouseEnergy } from "../kanab-quest-warehouse-run";
import { summarizeKqEquipmentLoadout } from "../kanab-quest-equipment";
import { getKqStaffSharedTrimQuote } from "../kanab-quest-staff-trim";
import { createKqProcessingPlan } from "../kanab-quest-processing-profiles";
import { KQ_WAREHOUSE_HANDLING, placeKqWarehouseHandling, type KqWarehouseHandlingPlacement } from "../kanab-quest-warehouse-handling";

let db: PGlite;
const migration = (file: string) => readFileSync(`supabase/migrations/${file}.sql`, "utf8");
async function install(file: string, name: string, alias = name) {
  const body = migration(file).match(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`, "i"))?.[0];
  if (!body) throw new Error(`Missing SQL function: ${name}`);
  await db.exec(body.replace(name + "(", alias + "("));
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.kq_warehouse_layouts(user_id uuid PRIMARY KEY,state jsonb);
    CREATE TABLE public.kq_runs(user_id uuid,status text,warehouse_zone_id text);
    SET check_function_bodies=off;`);
  const catalog = "20261012000900_kq_warehouse_equipment_tiers";
  const options = "20261012000800_kq_warehouse_simulation_options";
  const tiers = "20261015000400_kq_warehouse_tier_balance";
  const condition = "20261030000100_kq_warehouse_condition_and_resale";
  await install(catalog, "kq_warehouse_device");
  await install(catalog, "kq_warehouse_catalog_projection", "kq_warehouse_catalog_before_postharvest");
  await install(catalog, "kq_warehouse_validate_catalog_change");
  await db.exec("CREATE FUNCTION public.kq_warehouse_catalog_projection(jsonb) RETURNS jsonb LANGUAGE sql AS 'SELECT public.kq_warehouse_catalog_before_postharvest($1)'");
  await install(options, "kq_warehouse_option", "kq_warehouse_option_v1");
  await install(tiers, "kq_warehouse_option");
  await install(options, "kq_warehouse_options_projection", "kq_warehouse_options_projection_v1");
  // Install the original lookup used by historical unversioned snapshots.
  const legacyLookup = migration(tiers).match(/DO \$\$ DECLARE body TEXT; BEGIN[\s\S]*?END \$\$;/)?.[0];
  if (!legacyLookup) throw new Error("Missing historical option projection");
  await db.exec(legacyLookup);
  await install(options, "kq_warehouse_validate_options_change");
  await install(tiers, "kq_warehouse_device_quality");
  await install(tiers, "kq_warehouse_options_projection");
  await install(condition, "kq_warehouse_validate_assets");
  await install(condition, "rpc_kq_warehouse_remove_zone");
  await install(condition, "rpc_kq_warehouse_save_condition", "kq_work_inner_warehouse_save_condition");
  await install(condition, "kq_warehouse_condition_projection");
  await install(tiers, "kq_warehouse_validate_options_run", "kq_warehouse_validate_options_before_condition");
  await install(condition, "kq_warehouse_validate_options_run");
  await install("20261111000200_kq_production_equipment", "kq_staff_production_layout_guard");
  for (const file of ["20261120000300_kq_warehouse_air_service", "20261120000400_kq_warehouse_empty_onboarding",
    "20261120000500_kq_warehouse_wall_extraction", "20261120000600_kq_warehouse_service_stations"]) await db.exec(migration(file));
  await db.exec(`
    ALTER TABLE public.kq_warehouse_layouts ADD COLUMN culture_assets jsonb, ADD COLUMN migration_credit_cents bigint DEFAULT 0,
      ADD COLUMN revision integer DEFAULT 1, ADD COLUMN updated_at timestamptz;
    CREATE TABLE public.kq_equipment_wallets(user_id uuid PRIMARY KEY);
    CREATE TABLE public.kq_commerce_accounts(user_id uuid,revision integer);
    CREATE TABLE public.kq_staff_accounts(user_id uuid PRIMARY KEY,state jsonb,revision integer,updated_at timestamptz);
    CREATE FUNCTION public.kq_player_work_day(uuid,timestamptz) RETURNS integer LANGUAGE sql AS 'SELECT 1';
    CREATE FUNCTION public.kq_player_work_day(uuid) RETURNS integer LANGUAGE sql AS 'SELECT 1';
    CREATE FUNCTION public.kq_team_work_receipts(uuid) RETURNS jsonb LANGUAGE sql AS 'SELECT ''[]''::jsonb';
    CREATE FUNCTION public.kq_staff_production_reservation(uuid) RETURNS jsonb LANGUAGE sql AS 'SELECT NULL::jsonb';
    CREATE FUNCTION public.kq_staff_snapshot(uuid) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{"context":{}}''::jsonb';
    CREATE FUNCTION public.kq_warehouse_snapshot(uuid) RETURNS jsonb LANGUAGE sql AS
      'SELECT to_jsonb(l) FROM public.kq_warehouse_layouts l WHERE user_id=$1';
    CREATE FUNCTION public.rpc_kq_staff_commit(p_user_id uuid,p_expected_revision integer,p_request_key uuid,
      p_command jsonb,p_state jsonb,p_debit_cents integer,p_effects jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
    DECLARE account record;
    BEGIN PERFORM public.kq_staff_validate_task_results(p_user_id,p_state); RETURN '{}'::jsonb; END $$;
    CREATE FUNCTION public.kq_warehouse_queue_processing() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE quote jsonb;
    BEGIN
      INSERT INTO public.kq_processing_jobs(flower_id,user_id,route,input_grams,nominal_hours,passive_hours,work,equipment_codes)
      VALUES (NEW.flower_id,NEW.user_id,NEW.route,1,1,0,'{}','{}');
      RETURN NEW;
    END $$;
  `);
  await db.exec(migration("20261120000200_kq_warehouse_handling_cart"));
  await db.exec(migration("20261121001200_kq_warehouse_handling_equipment"));
  const cleaningTable = migration("20261121001000_kq_warehouse_preparations")
    .match(/CREATE TABLE public\.kq_warehouse_cleaning_work \([\s\S]*?\n\);/)?.[0];
  if (!cleaningTable) throw new Error("Missing cleaning table definition");
  await db.exec(cleaningTable);
  await install("20261107000500_kq_player_workday", "kq_player_work_charge");
  await install("20261108000300_kq_culture_work_steps", "kq_culture_work_preview", "kq_culture_work_preview_before_actor_choice");
  await install("20261108001200_kq_culture_work_choice", "kq_culture_work_preview");
  await install("20261108000400_kq_processing_work", "kq_processing_work_preview");
  const actorPreview = migration("20261108001300_kq_processing_work_choice").match(/DO \$\$[\s\S]*?END \$\$;/)?.[0];
  if (!actorPreview) throw new Error("Missing processing actor preview definition");
  await db.exec(actorPreview);
  await db.exec(migration("20261121001210_kq_cleaning_work_schedule"));
  await db.exec(migration("20261121002200_kq_warehouse_retail_prices"));
  await db.exec(migration("20261122000300_kq_warehouse_airlock_price"));
  await db.exec(migration("20261122000400_kq_warehouse_climate_control_units"));
}, 30_000);

afterAll(async () => { await db?.close(); });

const empty = createKqWarehouseEmpty();
const nextZone = { ...createKqWarehouseStarter(true).zones[0], id: "main", x: 5, y: 6, width: 4, height: 1 };
const stations = [
  { id: "water", code: "SIM-WATER-03", x: 5, y: 2 },
  { id: "sas", code: "SIM-HYGIENE-03", x: 5, y: 9 },
] as const;
const paid = getKqWarehouseQuote({ ...empty, zones: [nextZone], stationPlacements: [...stations] }, empty);
const owner = "9e9b4d9c-1e25-4e75-ba69-899db6166a7f";
async function projection(name: string, value: unknown) {
  return (await db.query<{ value: unknown }>(`SELECT public.${name}($1) AS value`, [value])).rows[0].value;
}

describe("physical station SQL invariants", () => {
  it("charges exactly 15,000 euros for the entrance and preserves separately priced works and paid stock", async () => {
    const airlock = stations[1];
    const validatePrice = (previous: typeof empty, next: typeof empty, cents: number) => db.query(
      "SELECT kq_warehouse_validate_options_change($1,$2,$3), kq_warehouse_validate_catalog_change($1,$2,$3)", [previous, next, cents]);
    for (const previous of [empty, { ...empty, preparedAreaM2: 7 }]) {
      const purchase = getKqWarehouseQuote({ ...previous, stationPlacements: [airlock] }, previous);
      expect(purchase).toMatchObject({ installationCostCents: 0, preparationCostCents: 0, totalCostCents: 1_500_000,
        nextState: { preparedAreaM2: previous.preparedAreaM2 } });
      await validatePrice(previous, purchase.nextState, 1_500_000);
      const oldPrice = Math.round(832_810 * 1.15) + (previous.preparedAreaM2 ? 0 : 12_000);
      await expect(validatePrice(previous, purchase.nextState, oldPrice)).rejects.toThrow("warehouse_price_changed");
      const stored = getKqWarehouseQuote({ ...purchase.nextState, stationPlacements: [] }, purchase.nextState);
      const reused = getKqWarehouseQuote({ ...stored.nextState, stationPlacements: [airlock] }, stored.nextState);
      expect([stored.totalCostCents, reused.totalCostCents]).toEqual([0, 0]);
      await validatePrice(purchase.nextState, stored.nextState, 0);
      await validatePrice(stored.nextState, reused.nextState, 0);
    }
    const otherWorks = getKqWarehouseQuote({ ...empty, zones: [nextZone], stationPlacements: [stations[0]] }, empty);
    expect(paid.totalCostCents).toBe(1_500_000 + otherWorks.totalCostCents);
    expect(paid.preparationCostCents).toBe(otherWorks.preparationCostCents);
    expect(paid.installationCostCents).toBe(otherWorks.installationCostCents);
    await validatePrice(empty, paid.nextState, paid.totalCostCents);
  });
  it("quotes public prices for each warehouse sale unit", async () => {
    for (const [code, offer] of Object.entries(retailEquipment)) {
      const result = await db.query<{ price: number }>("SELECT public.kq_warehouse_retail_price($1) AS price", [code]);
      expect(result.rows[0].price, code).toBe(offer.unitPriceCents);
    }
  });
  it("agrees on procurement and selected-zone effects and rejects unfunded stations", async () => {
    const plan = paid.nextState;
    const run = getKqWarehouseRunSnapshot(plan, 2, nextZone.id);
    expect(await projection("kq_warehouse_station_service", plan)).toEqual(plan.stationService);
    expect(await projection("kq_warehouse_options_projection", { ...plan, zones: run.zones })).toMatchObject({
      estimatedHarvestGrams: run.estimatedHarvestGrams, consumablesCostCents: run.consumablesCostCents, qualityBonus: run.qualityBonus,
    });
    await db.query("SELECT public.kq_warehouse_validate_catalog_change($1,$2,$3)", [empty, plan, paid.totalCostCents]);
    await db.query("SELECT public.kq_warehouse_validate_options_change($1,$2,$3)", [empty, plan, paid.totalCostCents]);
    await db.query("SELECT public.kq_warehouse_validate_assets($1,$2)", [plan, JSON.stringify(initializeKqWarehouseCondition(plan).assets)]);
    await expect(db.query("SELECT public.kq_warehouse_validate_catalog_change($1,$2,$3)", [empty, plan, paid.totalCostCents - 1])).rejects.toThrow(/warehouse_price_changed/);
    await expect(projection("kq_warehouse_options_projection", { ...plan, optionInventory: [] })).rejects.toThrow(/warehouse_options_missing/);
    await expect(db.query("SELECT public.kq_warehouse_validate_options_change($1,$2,$3)", [empty,
      { ...plan, optionInventory: plan.optionInventory!.map(item => item.code === "SIM-WATER-03" ? { ...item, quantity: 2 } : item) },
      paid.totalCostCents + 3680])).rejects.toThrow(/warehouse_options_invalid/);
  });

  it("guards collisions, the door, cache authenticity and live zone coverage", async () => {
    const plan = paid.nextState;
    for (const changed of [
      { ...plan, stationPlacements: [{ ...stations[0], y: 6 }] },
      { ...plan, stationPlacements: [{ ...stations[1], x: 4 }] },
      { ...plan, stationPlacements: [stations[1], { ...stations[1], id: "duplicate" }] },
      { ...plan, airPlacements: [{ ...stations[0], id: "fan", code: "SIM-AIR-01" }] },
    ]) await expect(projection("kq_warehouse_station_service", changed)).rejects.toThrow(/warehouse_options_invalid/);
    await expect(db.query("INSERT INTO public.kq_warehouse_layouts values($1,$2)", [owner, { ...plan, stationService: {} }])).rejects.toThrow(/warehouse_layout_changed/);
    await db.query("INSERT INTO public.kq_warehouse_layouts values($1,$2)", [owner, plan]);
    await db.query("INSERT INTO public.kq_runs values($1,'active',$2)", [owner, nextZone.id]);
    const noAirlock = getKqWarehouseQuote({ ...plan, stationPlacements: [stations[0]] }, plan).nextState;
    await db.query("UPDATE public.kq_warehouse_layouts set state=$2 where user_id=$1", [owner, noAirlock]);
    await db.query("UPDATE public.kq_warehouse_layouts set state=$2 where user_id=$1", [owner, plan]);
    const released = getKqWarehouseQuote({ ...plan, stationPlacements: [] }, plan).nextState;
    await expect(db.query("UPDATE public.kq_warehouse_layouts set state=$2 where user_id=$1", [owner, released])).rejects.toThrow(/warehouse_zone_in_use/);
    await db.query("UPDATE public.kq_runs set status='completed' where user_id=$1", [owner]);
    await db.query("UPDATE public.kq_warehouse_layouts set state=$2 where user_id=$1", [owner, released]);
  });

  it("allows entrance changes during employee production and keeps its irrigation locked", async () => {
    const user = "d3f5a23c-7d66-401a-8911-006cc302d59b";
    const plan = paid.nextState;
    await db.exec(`CREATE OR REPLACE FUNCTION public.kq_staff_production_reservation(uuid) RETURNS jsonb LANGUAGE sql AS $$
      SELECT state->'production' FROM public.kq_staff_accounts WHERE user_id=$1 $$;
      CREATE TRIGGER aaa_staff_production_layout_guard BEFORE UPDATE OR DELETE ON public.kq_warehouse_layouts
        FOR EACH ROW EXECUTE FUNCTION public.kq_staff_production_layout_guard();`);
    await db.query("INSERT INTO kq_staff_accounts(user_id,state) VALUES($1,$2)", [user,
      { production: { facility: { zoneId: nextZone.id }, lots: [{}], jobs: [] } }]);
    await db.query("INSERT INTO kq_warehouse_layouts(user_id,state) VALUES($1,$2)", [user, plan]);
    const setStations = (stationPlacements: typeof plan.stationPlacements) => db.query(
      "UPDATE kq_warehouse_layouts SET state=$2 WHERE user_id=$1", [user, getKqWarehouseQuote({ ...plan, stationPlacements }, plan).nextState]);
    await setStations([stations[0]]);
    await setStations([...stations]);
    await expect(setStations([])).rejects.toThrow("staff_production_equipment_busy");
  });
});

describe("zone climate and control equipment", () => {
  const zone = { ...nextZone, x: 0, y: 0, width: 1, height: 1 };
  const largeFloor = { ...empty };
  delete largeFloor.floor;
  const validateQuote = (previous: typeof empty, next: typeof empty, cents: number) => db.query(
    "SELECT kq_warehouse_validate_catalog_change($1,$2,$3), kq_warehouse_validate_options_change($1,$2,$3)", [previous, next, cents]);
  const checkAssets = (state: typeof empty, assets: ReturnType<typeof initializeKqWarehouseCondition>["assets"]) =>
    db.query("SELECT kq_warehouse_validate_assets($1,$2)", [state, JSON.stringify(assets)]);

  it.each([
    ["SIM-CLIMATE-UNIT-01", 20, 28_999, true], ["SIM-CLIMATE-UNIT-02", 50, 251_600, false], ["SIM-CLIMATE-UNIT-03", 100, 2_336_329, false],
    ["SIM-CONTROL-UNIT-01", 10, 1_649, true], ["SIM-CONTROL-UNIT-02", 50, 44_900, false], ["SIM-CONTROL-UNIT-03", 100, 298_900, false],
  ] as const)("charges whole %s units and validates the funded threshold", async (code, capacity, price, portable) => {
    for (const [height, quantity] of [[capacity / 10, 1], [capacity / 10 + 1, 2]]) {
      const prepared = getKqWarehouseQuote({ ...largeFloor, zones: [{ ...zone, width: 10, height }] }, largeFloor).nextState;
      const purchase = getKqWarehouseQuote({ ...prepared, zones: [{ ...prepared.zones[0], optionCodes: [code] }] }, prepared);
      const installation = portable ? 0 : Math.round(quantity * price * 0.15);
      expect(purchase.nextState.optionInventory).toEqual([{ code, quantity }]);
      expect(purchase.totalCostCents).toBe(quantity * price + installation);
      await validateQuote(prepared, purchase.nextState, purchase.totalCostCents);
      await expect(validateQuote(prepared, purchase.nextState, purchase.totalCostCents - 1)).rejects.toThrow("warehouse_price_changed");
      await expect(projection("kq_warehouse_options_projection", { ...purchase.nextState, optionInventory: [{ code, quantity: quantity - 1 }] }))
        .rejects.toThrow("warehouse_options_missing");
      await expect(validateQuote(prepared, { ...purchase.nextState, optionInventory: [{ code, quantity: quantity + 1 }] },
        (quantity + 1) * price + (portable ? 0 : Math.round((quantity + 1) * price * 0.15)))).rejects.toThrow("warehouse_options_invalid");
    }
  });

  it("charges two zones separately, reuses reserves and authenticates sowing costs and wear", async () => {
    const codes = ["SIM-CLIMATE-UNIT-02", "SIM-CONTROL-UNIT-01"];
    const zones = [{ ...zone, width: 3 }, { ...zone, id: "second", x: 4, width: 4 }];
    const prepared = getKqWarehouseQuote({ ...empty, zones }, empty).nextState;
    const purchase = getKqWarehouseQuote({ ...prepared, zones: zones.map(z => ({ ...z, optionCodes: codes })) }, prepared);
    const state = purchase.nextState;
    expect(state.optionInventory).toEqual(codes.map(code => ({ code, quantity: 2 })));
    expect(purchase.totalCostCents).toBe(2 * (251_600 + 1_649) + Math.round(2 * 251_600 * 0.15));
    await validateQuote(prepared, state, purchase.totalCostCents);
    const requestKey = crypto.randomUUID();
    const previousAssets = initializeKqWarehouseCondition(prepared);
    const condition = reconcileKqWarehouseCondition(prepared, state, previousAssets, { requestKey, fundedFraction: 1 });
    await checkAssets(state, condition.assets);
    const options = condition.assets.filter(a => a.kind === "option");
    expect(options).toHaveLength(4);
    expect(options.every(a => a.quantity === 1 && a.purchaseUnitCents === (a.code === codes[0] ? 251_600 : 1_649))).toBe(true);
    await expect(checkAssets(state, condition.assets.map(a => a === options[0] ? { ...a, zoneId: null } : a)))
      .rejects.toThrow("warehouse_condition_inventory");
    const underfunded = { ...state, optionInventory: codes.map(code => ({ code, quantity: 1 })) };
    await expect(projection("kq_warehouse_options_projection", underfunded)).rejects.toThrow("warehouse_options_missing");
    for (const selected of state.zones) {
      const snapshot = getKqWarehouseRunSnapshot(state, 1, selected.id, 2, 2, 2, condition);
      await projection("kq_warehouse_validate_options_run", snapshot);
      await expect(projection("kq_warehouse_validate_options_run", { ...snapshot, consumablesCostCents: snapshot.consumablesCostCents - 1 }))
        .rejects.toThrow("warehouse_layout_changed");
      await expect(projection("kq_warehouse_validate_options_run", { ...snapshot, yieldFactor: .7 }))
        .rejects.toThrow("warehouse_condition_changed");
    }
    const released = getKqWarehouseQuote({ ...state, zones }, state);
    await validateQuote(state, released.nextState, 0);
    const back = getKqWarehouseQuote({ ...released.nextState, zones: state.zones }, released.nextState);
    await validateQuote(released.nextState, back.nextState, 0);
    const replaced = getKqWarehouseQuote({ ...state, zones: [{ ...state.zones[0], optionCodes: ["SIM-CLIMATE-UNIT-01"] }, state.zones[1]] }, state);
    await validateQuote(state, replaced.nextState, 28_999);
    expect(replaced.nextState.optionInventory).toContainEqual({ code: codes[0], quantity: 2 });
  });

  it("authenticates historical area stock in both balances and refuses additional retired purchases", async () => {
    const oldCode = "SIM-CLIMATE-02";
    const historic = createKqWarehouseStarter();
    const prepared = getKqWarehouseQuote({ ...historic, zones: [{ ...zone, width: 3 }] }, historic).nextState;
    const old = { ...prepared, optionInventory: [{ code: oldCode, quantity: 3 }] };
    const reassigned = getKqWarehouseQuote({ ...old, zones: [{ ...old.zones[0], optionCodes: [oldCode] }] }, old).nextState;
    await validateQuote(old, reassigned, 0);
    await checkAssets(reassigned, initializeKqWarehouseCondition(reassigned).assets);
    for (const version of [1, 2] as const) {
      const snapshot = getKqWarehouseRunSnapshot(reassigned, 1, undefined, version);
      await projection("kq_warehouse_validate_options_run", snapshot);
    }
    await expect(validateQuote(prepared, reassigned, Math.round(3 * 2_516 * 1.15))).rejects.toThrow("warehouse_device_retired");
    await expect(projection("kq_warehouse_options_projection", { ...reassigned, optionInventory: [{ code: oldCode, quantity: 2 }] }))
      .rejects.toThrow("warehouse_options_missing");
    for (const signature of ["kq_warehouse_zone_unit(text)", "kq_warehouse_funded_options(jsonb,boolean)", "kq_warehouse_option_purchase(text,numeric,numeric,jsonb)"]) {
      expect((await db.query<{ allowed: boolean }>("SELECT has_function_privilege('service_role',$1,'EXECUTE') AS allowed", [signature])).rows[0].allowed).toBe(false);
    }
  });

  it("checks a paid unit's acquisition basis and freezes the saved assignment at sowing", async () => {
    const conditionFile = "20261030000100_kq_warehouse_condition_and_resale";
    const catalogFile = "20261012000900_kq_warehouse_equipment_tiers";
    await install(conditionFile, "kq_validate_warehouse_run_start");
    await install("20261013000100_kq_zone_cultures", "kq_validate_warehouse_run_start", "kq_validate_warehouse_start_before_condition");
    await install(catalogFile, "kq_warehouse_validate_catalog_run");
    await install(catalogFile, "kq_warehouse_drying_capacity_grams");
    // This player has four empty starter jars (1,200 g), no prior harvests or pending reservations.
    await db.exec(`ALTER TABLE kq_runs ADD COLUMN id uuid, ADD COLUMN state jsonb;
      CREATE TABLE kq_flowers(owner_id uuid,run_id uuid,status text);
      CREATE TABLE kq_storage_lots(user_id uuid,flower_id uuid,state jsonb);
      CREATE FUNCTION kq_warehouse_storage_capacity_units(uuid,jsonb) RETURNS numeric LANGUAGE sql AS 'SELECT 12000';
      CREATE FUNCTION kq_warehouse_storage_capacity_units(uuid) RETURNS numeric LANGUAGE sql AS 'SELECT 12000';
      CREATE FUNCTION kq_warehouse_stock_units(uuid) RETURNS numeric LANGUAGE sql AS 'SELECT 0';
      CREATE FUNCTION kq_warehouse_reserved_storage_units(uuid) RETURNS numeric LANGUAGE sql AS 'SELECT 0';
      CREATE FUNCTION kq_warehouse_packed_stock_units(uuid) RETURNS numeric LANGUAGE sql AS 'SELECT 0';
      CREATE FUNCTION kq_storage_remaining(uuid) RETURNS numeric LANGUAGE sql AS 'SELECT 0';
      CREATE FUNCTION kq_zone_reserved_harvest(uuid) RETURNS numeric LANGUAGE sql AS 'SELECT 0';
      CREATE FUNCTION kq_warehouse_pending_shortage_units(uuid,uuid,numeric) RETURNS numeric LANGUAGE sql AS 'SELECT 0';
      CREATE FUNCTION rpc_kq_warehouse_receipt(uuid,uuid,jsonb) RETURNS jsonb LANGUAGE sql AS 'SELECT NULL::jsonb';
      CREATE FUNCTION kq_warehouse_save_before_condition(uuid,uuid,jsonb,integer,jsonb,jsonb,integer) RETURNS jsonb LANGUAGE sql AS $$
        UPDATE kq_warehouse_layouts SET state=$6,revision=revision+1 WHERE user_id=$1;
        SELECT '{"receipt":{}}'::jsonb $$;`);
    const previous = createKqWarehouseStarter(), user = crypto.randomUUID(), key = crypto.randomUUID();
    const code = "SIM-CONTROL-UNIT-01", initial = initializeKqWarehouseCondition(previous);
    const quote = getKqWarehouseQuote({ ...previous, zones: [{ ...previous.zones[0], optionCodes: [code] }] }, previous);
    const condition = reconcileKqWarehouseCondition(previous, quote.nextState, initial, { requestKey: key, fundedFraction: 1 });
    await db.query("INSERT INTO kq_warehouse_layouts(user_id,state,culture_assets) VALUES($1,$2,$3)", [user, previous, JSON.stringify(initial.assets)]);
    const save = (assets: typeof condition.assets) => db.query(
      "SELECT kq_work_inner_warehouse_save_condition($1,$2,'{}',1,$3,$4,$5,$6,$7)",
      [user, key, previous, quote.nextState, quote.totalCostCents, JSON.stringify(initial.assets), JSON.stringify(assets)]);
    await expect(save(condition.assets.map(a => a.code === code ? { ...a, purchaseUnitCents: 412 } : a))).rejects.toThrow("warehouse_condition_invalid");
    await save(condition.assets);
    const state = getKqWarehouseRunSnapshot(quote.nextState, 2, previous.zones[0].id, 2, 2, 2, condition);
    const game = { warehouse: state, equipment: { codes: [], levels: {}, ...summarizeKqEquipmentLoadout([]) }, energy: quoteKqWarehouseEnergy(state) };
    const sow = (warehouse: typeof state) => db.query("SELECT kq_validate_warehouse_run_start($1,$2,$3)", [user, crypto.randomUUID(), { ...game, warehouse }]);
    await sow(state);
    await expect(sow({ ...state, sourceState: previous })).rejects.toThrow("warehouse_layout_changed");
    await expect(sow({ ...state, consumablesCostCents: state.consumablesCostCents + 1 })).rejects.toThrow("warehouse_layout_changed");
    await expect(sow({ ...state, cultureEquipment: initial })).rejects.toThrow("warehouse_condition_changed");
  });
});

describe("shared handling SQL invariants", () => {
  const userId = "d3f5a23c-7d66-401a-8911-006cc302d59a";
  const inventory = Object.keys(KQ_WAREHOUSE_HANDLING).map(code => ({ code, quantity: 1 }));
  const quote = getKqWarehouseQuote({ ...empty, optionInventory: inventory }, empty);
  const wear = () => projection("kq_warehouse_handling_condition", userId);
  it("requires the three exact unit prices, without pose, and rejects an extra unit", async () => {
    await db.query("SELECT public.kq_warehouse_validate_options_change($1,$2,$3), public.kq_warehouse_validate_catalog_change($1,$2,$3)",
      [empty, quote.nextState, quote.totalCostCents]);
    await expect(db.query("SELECT public.kq_warehouse_validate_catalog_change($1,$2,$3)",
      [empty, quote.nextState, quote.totalCostCents - 1])).rejects.toThrow(/warehouse_price_changed/);
    const duplicated = { ...quote.nextState, optionInventory: [{ ...inventory[0], quantity: 2 }, ...inventory.slice(1)] };
    await expect(db.query("SELECT public.kq_warehouse_validate_options_change($1,$2,$3)",
      [empty, duplicated, quote.totalCostCents + 700])).rejects.toThrow(/warehouse_options_invalid/);
  });

  it("converts historic assignments and credits only documented duplicates", async () => {
    const owner = "579afdd3-40d5-4170-982a-16f2dfa74e37";
    const code = "SIM-LOGISTICS-03";
    const starter = createKqWarehouseStarter();
    const state = { ...starter, zones: [{ ...starter.zones[0], optionCodes: [code] }], optionInventory: [{ code, quantity: 3 }] };
    const condition = initializeKqWarehouseCondition(state);
    condition.assets = condition.assets.flatMap(asset => asset.code === code
      ? asset.zoneId === null ? [
        { ...asset, id: "table-worn", quantity: 1, purchaseUnitCents: 2800, wearPercent: 60 },
        { ...asset, id: "table-unknown", quantity: 1, wearPercent: 30 },
      ] : [{ ...asset, wearPercent: 5 }] : [asset]);
    await db.query("INSERT INTO public.kq_warehouse_layouts(user_id,state,culture_assets) VALUES($1,$2,$3)", [owner, state, JSON.stringify(condition.assets)]);
    await db.query("INSERT INTO public.kq_runs VALUES($1,'active','starter')", [owner]);
    const conversion = () => db.query<{ value: unknown }>("SELECT public.rpc_kq_warehouse_convert_handling($1,1) AS value", [owner]);
    expect((await conversion()).rows[0].value).toMatchObject({ revision: 1, state });
    await db.query("UPDATE public.kq_runs SET status='completed' WHERE user_id=$1", [owner]);
    const converted = (await conversion()).rows[0].value;
    expect(converted).toMatchObject({ revision: 2, migration_credit_cents: 2800,
      state: { optionInventory: [{ code, quantity: 1 }], zones: [{ optionCodes: [] }] },
      handling_equipment_conversions: { [code]: { unknownBasisQuantity: 1, creditCents: 2800 } } });
    expect(await projection("kq_warehouse_handling_condition", owner)).toEqual({ [code]: 5 });
    expect((await conversion()).rows[0].value).toEqual(converted);
  });

  it("pins accepted trim rates, applies each tool once and preserves passive dryer time", async () => {
    await db.query("INSERT INTO public.kq_warehouse_layouts(user_id,state,culture_assets) VALUES($1,$2,$3)", [
      userId, quote.nextState, JSON.stringify(initializeKqWarehouseCondition(quote.nextState).assets),
    ]);
    const initial = { "SIM-LOGISTICS-01": 0, "SIM-LOGISTICS-02": 0, "SIM-LOGISTICS-03": 0 };
    expect(await wear()).toEqual(initial);
    const rate = getKqStaffSharedTrimQuote({ mode: "manual", hours: 1, level: 1, handling: initial }).gramsPerHour;
    const task = { id: "trim-session", kind: "trim", trimQueue: true, trimMode: "manual", skillLevel: 1, trimRateGramsPerHour: rate };
    const trim = (previous: unknown[], next: unknown[]) => db.query("SELECT public.kq_staff_apply_trim_handling($1,$2,$3)",
      [userId, { tasks: previous }, { tasks: next }]);
    await expect(trim([], [{ ...task, trimRateGramsPerHour: 60 }])).rejects.toThrow(/staff_trim_changed/);
    expect(await wear()).toEqual(initial);
    await trim([], [task]);
    await trim([task], [task]);
    expect(await wear()).toEqual({ ...initial, "SIM-LOGISTICS-01": 1, "SIM-LOGISTICS-03": 1 });
    const plan = createKqProcessingPlan({ inputGrams: 5_000, productGrams: 1_400, equipmentCodes: ["FREEZE-DRYER"], dryerHandlingSaving: .25 })!;
    expect(plan).toMatchObject({ nominalHours: .75, passiveHours: 48 });
    await db.query("SELECT public.kq_processing_apply_cart_wear($1,$2,$3)", [userId, plan, 1_400]);
    expect(await wear()).toEqual({ "SIM-LOGISTICS-01": 1, "SIM-LOGISTICS-02": 2, "SIM-LOGISTICS-03": 1 });
    await db.query("SELECT public.kq_warehouse_apply_handling_wear($1,$2)", [userId, { "SIM-LOGISTICS-01": 200 }]);
    expect(await wear()).toEqual({ "SIM-LOGISTICS-01": 100, "SIM-LOGISTICS-02": 2, "SIM-LOGISTICS-03": 1 });
  });
});

describe("cleaning occupies the actor’s work schedule", () => {
  it.each(["player", "employee:alice"])("projects and protects %s’s scheduled interval", async actor => {
    const user = crypto.randomUUID(), request = crypto.randomUUID();
    const assigneeId = actor === "player" ? actor : "alice";
    await db.query("INSERT INTO public.kq_equipment_wallets VALUES($1)", [user]);
    const { starts_at: start, ends_at: end } = (await db.query<{ starts_at: Date; ends_at: Date }>(`
      INSERT INTO public.kq_warehouse_cleaning_work VALUES($1,$2,'vacuum',$3,date_trunc('milliseconds',now()),date_trunc('milliseconds',now())+interval '5 minutes')
      RETURNING starts_at,ends_at
    `, [user, request, actor])).rows[0];
    expect(await projection("kq_team_work_receipts", user)).toMatchObject([
      { id: `cleaning-${request}`, kind: "cleaning", assigneeId, target: "Passer l’aspirateur", hours: .5 },
    ]);
    const task = { id: "overlap", employeeId: assigneeId, startedAt: start, completesAt: end };
    const validate = (candidate: object) => db.query("SELECT public.kq_validate_new_work_during_cleaning($1,$2,$3)",
      [user, { tasks: [] }, { tasks: [candidate] }]);
    await expect(validate(task)).rejects.toThrow(/kq_preparation_operator_busy/);
    await validate({ ...task, employeeId: actor === "player" ? "alice" : "player" });
    await validate({ ...task, startedAt: end, completesAt: new Date(end.getTime() + 300_000) });
    await validate({ ...task, processingShift: true });
    if (actor === "player") {
      await expect(db.query("SELECT public.kq_player_work_charge($1,.5)", [user])).rejects.toThrow(/kq_preparation_operator_busy/);
      await db.query("SELECT public.kq_player_work_charge($1,0)", [user]);
    }
  });
});

it("requires a free position on purchase, reuses old paid units and activates installed handling", async () => {
  const owner = crypto.randomUUID();
  const desk = { code: "SIM-LOGISTICS-03", x: 1, y: 1 } as const;
  const trolley = { code: "SIM-LOGISTICS-01", x: 2, y: 1 } as const;
  const old = getKqWarehouseQuote({ ...empty, optionInventory: [{ code: desk.code, quantity: 1 }] }, empty).nextState;
  const assets = initializeKqWarehouseCondition(old).assets;
  await db.query("INSERT INTO public.kq_warehouse_layouts(user_id,state,culture_assets) VALUES($1,$2,$3)", [owner, old, JSON.stringify(assets)]);
  await db.exec("SET check_function_bodies=on");
  await db.exec(migration("20261121002100_kq_warehouse_handling_placements"));
  const write = (state: typeof old) => db.query("UPDATE public.kq_warehouse_layouts SET state=$1 WHERE user_id=$2", [state, owner]);
  expect(await projection("kq_warehouse_handling_condition", owner)).toEqual({});
  const reuse = getKqWarehouseQuote(placeKqWarehouseHandling(old, desk), old);
  expect(reuse.totalCostCents).toBe(0);
  await write(reuse.nextState);
  expect(await projection("kq_warehouse_handling_condition", owner)).toEqual({ [desk.code]: 0 });
  const purchase = getKqWarehouseQuote(placeKqWarehouseHandling(reuse.nextState, trolley), reuse.nextState);
  expect(purchase.totalCostCents).toBe(KQ_WAREHOUSE_HANDLING[trolley.code].priceCents);
  const invalid = (placements: KqWarehouseHandlingPlacement[]) => write({ ...purchase.nextState, handlingPlacements: placements });
  await expect(invalid([desk])).rejects.toThrow("warehouse_handling_placement_required");
  await expect(invalid([desk, { ...trolley, x: desk.x }])).rejects.toThrow("warehouse_handling_placement_invalid");
  await expect(invalid([desk, { ...trolley, x: 5, y: 9 }])).rejects.toThrow("warehouse_handling_placement_invalid");
  await write(purchase.nextState);
  const moved = getKqWarehouseQuote(placeKqWarehouseHandling(purchase.nextState, { ...desk, x: 3 }), purchase.nextState);
  expect(moved.totalCostCents).toBe(0);
  await write(moved.nextState);
  expect((await db.query<{ positions: KqWarehouseHandlingPlacement[] }>("SELECT state->'handlingPlacements' AS positions FROM public.kq_warehouse_layouts WHERE user_id=$1", [owner])).rows[0].positions)
    .toEqual(moved.nextState.handlingPlacements);
});
