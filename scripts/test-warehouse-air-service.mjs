// Projection parity on an isolated Postgres instance using the deployed function bodies.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "vite";

const db = new PGlite();
const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { "@": path.resolve("src") } },
  server: { middlewareMode: true, watch: null, hmr: false, ws: false } });
const migration = file => readFile(new URL("../supabase/migrations/" + file + ".sql", import.meta.url), "utf8");
async function install(file, name, alias = name) {
  const source = await migration(file);
  const body = source.match(new RegExp("CREATE (?:OR REPLACE )?FUNCTION public\\." + name + "\\([\\s\\S]*?\\$\\$;","i"));
  assert(body, name);
  await db.exec(body[0].replace(name + "(", alias + "("));
}
const scalar = async (name, value) => (await db.query("select public." + name + "($1) value", [value])).rows[0].value;
try {
  await db.exec("create role anon; create role authenticated; create role service_role; create table public.kq_warehouse_layouts(user_id uuid, state jsonb); create table public.kq_runs(user_id uuid,status text,warehouse_zone_id text); set check_function_bodies=off");
  const catalog = "20261012000900_kq_warehouse_equipment_tiers", options = "20261012000800_kq_warehouse_simulation_options";
  const tiers = "20261015000400_kq_warehouse_tier_balance", condition = "20261030000100_kq_warehouse_condition_and_resale";
  await install(catalog,"kq_warehouse_device");
  await install(catalog,"kq_warehouse_catalog_projection","kq_warehouse_catalog_before_postharvest");
  await install(catalog,"kq_warehouse_validate_catalog_change");
  await db.exec("create function public.kq_warehouse_catalog_projection(jsonb) returns jsonb language sql as 'select public.kq_warehouse_catalog_before_postharvest($1)'");
  await install(options,"kq_warehouse_option","kq_warehouse_option_v1");
  await install(tiers,"kq_warehouse_option");
  await install(options,"kq_warehouse_options_projection","kq_warehouse_options_projection_v1");
  await install(options,"kq_warehouse_validate_options_change");
  await install(tiers,"kq_warehouse_device_quality");
  await install(tiers,"kq_warehouse_options_projection");
  await install(catalog,"kq_warehouse_drying_capacity_grams");
  await install("20261012000500_kq_warehouse_service_zones","kq_warehouse_installed_containers");
  await install("20261012000500_kq_warehouse_service_zones","kq_warehouse_storage_capacity_units");
  await install("20261010000300_storage_capacity","kq_storage_container");
  await install(condition,"kq_warehouse_validate_assets");
  await install(condition,"rpc_kq_warehouse_remove_zone");
  await install("20261111000200_kq_production_equipment","kq_staff_production_layout_guard");
  await db.exec(await migration("20261120000300_kq_warehouse_air_service"));
  await db.exec(`
    alter table public.kq_warehouse_layouts add column migration_credit_cents bigint, add column legacy_archive jsonb;
    create table public.kq_equipment_wallets(user_id uuid primary key, cash_cents integer default 35000, production_units integer default 1);
    create table public.kq_player_equipment(user_id uuid, tent_number int, equipment_code text, purchase_price_cents int);
    create table public.kq_equipment_loadouts(user_id uuid, tent_number int, slot text);
    create table public.kq_equipment_upgrade_receipts(user_id uuid,price_cents int,created_at timestamptz);
    create table public.kq_production_expansions(user_id uuid,price_cents int,created_at timestamptz);
    create table public.kq_flowers(owner_id uuid);
    create function public.kq_warehouse_stock_units(uuid) returns numeric language sql as 'select 0::numeric';
    create function public.kq_treasury_initialize(uuid) returns void language sql as 'select null::void';
    create function public.rpc_kq_ensure_equipment_profile(uuid) returns void language sql as
      'insert into public.kq_equipment_wallets(user_id) values ($1) on conflict do nothing';
    create function public.kq_warehouse_snapshot(uuid) returns jsonb language sql as
      'select jsonb_build_object(''cashCents'',w.cash_cents,''state'',l.state,''credit'',l.migration_credit_cents)
       from public.kq_equipment_wallets w left join public.kq_warehouse_layouts l using(user_id) where w.user_id=$1';
  `);
  await db.exec(await migration("20261019000300_kq_starting_budget"));
  await install("20261012000100_kq_warehouse_layouts","rpc_kq_warehouse_initialize");
  await db.exec(await migration("20261120000400_kq_warehouse_empty_onboarding"));
  await db.exec(await migration("20261120000500_kq_warehouse_wall_extraction"));
  await db.exec(await migration("20261121002200_kq_warehouse_retail_prices"));
  const engine = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse.ts");
  const ledger = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse-condition.ts");
  const starter = engine.createKqWarehouseStarter(true);
  const sample = starter.zones[0];
  const empty = engine.createKqWarehouseEmpty();
  const mountedPartitions = [
    { id: "support", x: 1, y: 3, axis: "x", length: 4 },
    { id: "obstacle", x: 2, y: 5, axis: "x", length: 1 },
  ];
  const mountedZones = [
    { ...sample, id: "north", x: 2, y: 2 },
    { ...sample, id: "south", x: 2, y: 4 },
    { ...sample, id: "behind", x: 2, y: 6 },
    { ...sample, id: "edge", x: 8, y: 4 },
  ];
  const mountedFan = { id: "internal", code: "SIM-AIR-01", x: 2, y: 3, mount: { kind: "wall", face: "south", partitionId: "support" } };
  const envelopeFan = { id: "external", code: "SIM-AIR-01", x: 9, y: 4, mount: { kind: "wall", face: "west" } };
  const mountedPlan = engine.getKqWarehouseQuote({ ...empty, partitions: mountedPartitions,
    zones: mountedZones, airPlacements: [mountedFan, envelopeFan] }).nextState;
  assert.deepEqual(await scalar("kq_warehouse_air_service", mountedPlan), mountedPlan.airService);
  assert.equal(mountedPlan.airService.south.coveredAreaM2, 1);
  assert.equal(mountedPlan.airService.north.coveredAreaM2, 0);
  assert.equal(mountedPlan.airService.behind.coveredAreaM2, 0);
  assert.equal(mountedPlan.airService.edge.coveredAreaM2, 1);
  for (const altered of [
    { ...mountedPlan, partitions: mountedPartitions.slice(1) },
    { ...mountedPlan, airPlacements: [{ ...mountedFan, mount: { ...mountedFan.mount, face: "east" } }] },
    { ...mountedPlan, airPlacements: [{ ...envelopeFan, x: 8 }] },
    { ...mountedPlan, airPlacements: [{ ...envelopeFan, mount: null }] },
  ]) await assert.rejects(scalar("kq_warehouse_air_service", altered), /warehouse_invalid_request/);
  const initialize = async owner => (await db.query("select public.rpc_kq_warehouse_initialize_onboarding($1,$2,$3) value", [owner, starter, empty])).rows[0].value;
  const newOwner = randomUUID(), previousOwner = randomUUID();
  await db.query("select public.rpc_kq_ensure_equipment_profile($1)", [previousOwner]);
  await db.exec(await migration("20261122001600_kq_starting_budget_2000"));
  const opening = await initialize(newOwner);
  assert.deepEqual(opening, { state: empty, cashCents: 200000, credit: 0 });
  const { proposeFirstWarehousePlan } = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse-first-plan.ts");
  const firstPlan = proposeFirstWarehousePlan(empty);
  assert(firstPlan, "the empty warehouse is eligible for the first plan");
  const firstQuote = engine.getKqWarehouseQuote(firstPlan, empty);
  const firstSummary = engine.getKqWarehouseSummary(firstQuote.nextState);
  const firstProjection = await scalar("kq_warehouse_options_projection", firstQuote.nextState);
  await db.query("select public.kq_warehouse_validate_catalog_change($1,$2,$3)", [empty, firstQuote.nextState, firstQuote.totalCostCents]);
  await db.query("select public.kq_warehouse_validate_options_change($1,$2,$3)", [empty, firstQuote.nextState, firstQuote.totalCostCents]);
  await db.query("select public.kq_warehouse_validate_assets($1,$2)", [firstQuote.nextState, ledger.initializeKqWarehouseCondition(firstQuote.nextState).assets]);
  for (const key of ["activeAreaM2", "consumablesCostCents", "estimatedHarvestGrams"]) {
    assert.equal(firstProjection[key], firstSummary[key], key);
  }
  assert.equal((await scalar("kq_warehouse_catalog_projection", firstQuote.nextState)).energyCostCents, firstSummary.energyCostCents);
  assert.equal(Number(await scalar("kq_warehouse_drying_capacity_grams", firstQuote.nextState)), firstSummary.dryingCapacityGrams);
  const firstStorage = await db.query("select public.kq_warehouse_storage_capacity_units($1,$2)/10 value", [newOwner, firstQuote.nextState]);
  assert.equal(Number(firstStorage.rows[0].value), firstSummary.storageCapacityGrams);
  assert(firstSummary.dryingCapacityGrams >= firstSummary.estimatedHarvestGrams);
  assert(firstSummary.storageCapacityGrams >= firstSummary.estimatedHarvestGrams);
  assert(firstQuote.totalCostCents + firstSummary.operatingCostCents <= opening.cashCents);
  console.log("Premier plan validé par PostgreSQL", {
    installationCents: firstQuote.totalCostCents, operatingCents: firstSummary.operatingCostCents,
    estimatedHarvestGrams: firstSummary.estimatedHarvestGrams, dryingGrams: firstSummary.dryingCapacityGrams, storageGrams: firstSummary.storageCapacityGrams,
  });
  await db.query("insert into public.kq_player_equipment values ($1,1,'LED-300',35900)", [previousOwner]);
  assert.deepEqual(await initialize(previousOwner), { state: starter, cashCents: 100000, credit: 35900 });
  const onboardingZone = { ...sample, lightingCode: engine.KQ_WAREHOUSE_UNLIT_CODE, active: false, optionCodes: ["SIM-SUBSTRATE-01"] };
  const support = engine.getKqWarehouseQuote({ ...empty, zones: [onboardingZone] }, empty);
  assert.equal(support.totalCostCents, 16760);
  await db.query("select public.kq_warehouse_validate_catalog_change($1,$2,$3)", [empty, support.nextState, support.totalCostCents]);
  await db.query("select public.kq_warehouse_validate_assets($1,$2)", [support.nextState, ledger.initializeKqWarehouseCondition(support.nextState).assets]);
  await db.query("update public.kq_warehouse_layouts set state=$2 where user_id=$1", [newOwner, support.nextState]);
  assert.deepEqual((await initialize(newOwner)).state, support.nextState);
  assert.equal((await scalar("kq_warehouse_options_projection", support.nextState)).estimatedHarvestGrams, 0);
  await assert.rejects(scalar("kq_warehouse_catalog_before_postharvest", {
    ...support.nextState, zones: [{ ...onboardingZone, active: true }],
  }), /warehouse_invalid_request/);
  const lit = engine.getKqWarehouseQuote({ ...support.nextState, zones: [{ ...onboardingZone, active: true, lightingCode: sample.lightingCode }] }, support.nextState);
  assert.equal(lit.totalCostCents, 22189);
  await db.query("select public.kq_warehouse_validate_catalog_change($1,$2,$3)", [support.nextState, lit.nextState, lit.totalCostCents]);
  await db.query("select public.kq_warehouse_validate_assets($1,$2)", [lit.nextState, ledger.initializeKqWarehouseCondition(lit.nextState).assets]);
  const zones = [{ ...sample, id:"left", x:0, y:0, width:3, height:2, optionCodes:["SIM-SECURITY-03","SIM-HYGIENE-02"] },
    { ...sample, id:"right", x:4, y:1, width:3, height:4, optionCodes:["SIM-WATER-03","SIM-SUBSTRATE-03"] },
    { ...sample, id:"paused", x:2, y:4, width:1, height:2, active:false }];
  for (const fans of [[], [{ id:"A", code:"SIM-AIR-01", x:2, y:0 }], [
    { id:"A", code:"SJ-DF16E350", x:2, y:0 }, { id:"B", code:"SIM-AIR-03", x:5, y:5 }]]) {
    const quote = engine.getKqWarehouseQuote({ ...starter, zones, airPlacements: fans,
      partitions:[{id:"wall",axis:"y",x:3,y:2,length:3}] },starter);
    const state = quote.nextState;
    await db.query("select public.kq_warehouse_validate_catalog_change($1,$2,$3)",[starter,state,quote.totalCostCents]);
    assert.deepEqual(await scalar("kq_warehouse_air_service",state),state.airService);
    const owner = randomUUID();
    await db.query("insert into public.kq_warehouse_layouts(user_id,state) values ($1,$2)",[owner,state]);
    await assert.rejects(db.query("insert into public.kq_warehouse_layouts(state) values ($1)",[{ ...state,airService:{} }]),/warehouse_layout_changed/);
    const assets = ledger.initializeKqWarehouseCondition(state).assets;
    await db.query("select public.kq_warehouse_validate_assets($1,$2)", [state,assets]);
    for (const id of [undefined,"left","right"]) {
      const snapshot = engine.getKqWarehouseRunSnapshot(state,1,id);
      const selected = { ...state,zones:snapshot.zones };
      const costs = await scalar("kq_warehouse_catalog_before_postharvest",selected);
      const effects = await scalar("kq_warehouse_options_projection",selected);
      for (const field of ["energyKwh","energyCostCents","powerWatts"]) assert.equal(costs[field],snapshot[field],field);
      assert.equal(effects.qualityBonus,snapshot.qualityBonus ?? 0);
      assert.equal(effects.consumablesCostCents,snapshot.consumablesCostCents);
      assert.equal(effects.estimatedHarvestGrams,snapshot.estimatedHarvestGrams);
    }
    const next = engine.getKqWarehouseQuote({ ...state,airPlacements:[] },state);
    assert.equal(next.totalCostCents,0);
    if (fans.length) {
      await db.query("insert into public.kq_runs values ($1,'active','left')",[owner]);
      await assert.rejects(db.query("update public.kq_warehouse_layouts set state=$2 where user_id=$1",[owner,next.nextState]),/warehouse_zone_in_use/);
      await db.query("update public.kq_runs set status='completed' where user_id=$1",[owner]);
    }
    await db.query("update public.kq_warehouse_layouts set state=$2 where user_id=$1",[owner,next.nextState]);
    assert.deepEqual((await db.query("select state from public.kq_warehouse_layouts where user_id=$1",[owner])).rows[0].state,next.nextState);
  }
  console.log("SQL et TypeScript concordent pour les achats, surfaces, puissances, charges, rendements et qualités des plans testés.");
} finally { await db.close(); await vite.close(); }
