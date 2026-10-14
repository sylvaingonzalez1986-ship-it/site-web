// Isolated PostgreSQL integration. No credentials or deployed database access.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { "@": path.resolve("src") } }, server: { middlewareMode: true, watch: null } });
const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const scalar = async (query, values = []) => Object.values((await db.query(query, values)).rows[0])[0];
let checks = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const reject = async (fn, code) => {
  await db.exec("SAVEPOINT expected_failure");
  try { await assert.rejects(fn, error => error.message.includes(code), `Expected PostgreSQL rejection: ${code}`); checks++; }
  finally { await db.exec("ROLLBACK TO SAVEPOINT expected_failure"); }
};
const definition = async (file, name) => {
  const source = await sql(file);
  const found = source.match(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`));
  assert(found, `Missing actual migration function ${name}`);
  return found[0].replace(/^CREATE FUNCTION/, "CREATE OR REPLACE FUNCTION");
};

try {
  // Reuse the exact online-commerce fixture, including its real chronological
  // market, storage, bank and online migrations. Only its unrelated test cases
  // are omitted. Marker assertions make fixture drift fail visibly.
  const onlineSource = await readFile(new URL("./test-placard-online.mjs", import.meta.url), "utf8");
  const customerDemandMigration = "20261012002000_kq_variety_market_demands.sql";
  assert(onlineSource.includes(`,'${customerDemandMigration}'`), "customer demand fixture migration marker changed");
  // This migration follows the warehouse migrations in production. Defer it
  // until those migrations have exercised their historical implementations.
  const online = onlineSource.replace(`,'${customerDemandMigration}'`, "");
  const start = online.indexOf(" await db.exec(`");
  const end = online.indexOf(" // All relative timestamps");
  assert(start >= 0 && end > start, "online fixture bootstrap markers changed");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction("db", "sql", "scalar", online.slice(start, end))(db, sql, scalar);
  await db.exec(`
    ALTER TABLE kq_equipment_wallets ADD COLUMN production_units INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE kq_equipment_loadouts ADD COLUMN tent_number INTEGER DEFAULT 1, ADD COLUMN slot TEXT;
    CREATE TABLE kq_player_equipment(user_id UUID,tent_number INTEGER,equipment_code TEXT,purchase_price_cents INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,wear_cycles INTEGER DEFAULT 0,maintenance_version INTEGER DEFAULT 0,
      culture_wear_percent INTEGER DEFAULT 0,culture_wear_version INTEGER DEFAULT 0,PRIMARY KEY(user_id,tent_number,equipment_code));
    CREATE TABLE kq_equipment_upgrade_receipts(user_id UUID,price_cents INTEGER,created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_production_expansions(user_id UUID,price_cents INTEGER,created_at TIMESTAMPTZ DEFAULT now());
    ALTER TABLE kq_runs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE kq_energy_invoices ADD COLUMN IF NOT EXISTS dog_care JSONB;
    CREATE TABLE test_assets(user_id UUID,source_key TEXT,cost BIGINT);
    CREATE FUNCTION kq_treasury_add_asset(UUID,TEXT,TEXT,TEXT,BIGINT,TIMESTAMPTZ,INTEGER,TEXT) RETURNS BIGINT LANGUAGE plpgsql AS $$BEGIN
      INSERT INTO test_assets VALUES($1,$2,$5); RETURN $5; END$$;
  `);
  // Real equipment definitions are needed to exercise the corrective workshop
  // migration against the same purchase, upgrade and installation RPCs as prod.
  await db.exec(`
    CREATE TABLE kq_equipment_catalog(code TEXT PRIMARY KEY,category TEXT,slot TEXT,price_cents INTEGER,
      is_purchasable BOOLEAN DEFAULT true,is_active BOOLEAN DEFAULT true,sort_order INTEGER DEFAULT 0,updated_at TIMESTAMPTZ DEFAULT now());
    ALTER TABLE kq_player_equipment ADD COLUMN acquired_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE kq_equipment_loadouts ADD COLUMN equipped_at TIMESTAMPTZ DEFAULT now(),ADD UNIQUE(user_id,tent_number,slot);
    ALTER TABLE kq_equipment_upgrade_receipts ADD COLUMN request_key UUID,ADD COLUMN equipment_code TEXT,
      ADD COLUMN previous_level INTEGER,ADD COLUMN level INTEGER,ADD COLUMN cash_after_cents INTEGER,ADD COLUMN tent_number INTEGER,
      ADD UNIQUE(user_id,request_key);
    CREATE TABLE kq_equipment_purchase_receipts(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),request_key UUID,user_id UUID,
      equipment_codes TEXT[],total_price_cents INTEGER,cash_after_cents INTEGER,tent_number INTEGER,created_at TIMESTAMPTZ DEFAULT now(),UNIQUE(user_id,request_key));
    CREATE TABLE kq_machine_repairs(user_id UUID,request_key UUID,equipment_code TEXT,expected_version INTEGER,receipt JSONB,
      tent_number INTEGER,created_at TIMESTAMPTZ DEFAULT now(),PRIMARY KEY(user_id,request_key));
    CREATE TABLE kq_culture_equipment_replacements(user_id UUID,request_key UUID,equipment_code TEXT,expected_version INTEGER,
      receipt JSONB,tent_number INTEGER,created_at TIMESTAMPTZ DEFAULT now(),PRIMARY KEY(user_id,request_key));
  `);
  const catalogSource = await sql("20260901000100_kq_us_processing_and_culture_systems.sql");
  const catalogInsert = catalogSource.match(/INSERT INTO public\.kq_equipment_catalog\([\s\S]*?updated_at = now\(\);/);
  assert(catalogInsert, "real equipment catalogue insert changed");
  await db.exec(catalogInsert[0]);
  const gamePrices = (await sql("20260912000300_kq_distinct_talents.sql")).match(/UPDATE public\.kq_equipment_catalog SET price_cents = \d+ WHERE code = '[^']+';/g);
  assert(gamePrices?.length === 3, "real workshop progression price patches changed");
  await db.exec(gamePrices.join("\n"));
  await db.exec("DROP FUNCTION rpc_kq_ensure_equipment_profile(UUID)");
  await db.exec(await definition("20261001000200_kq_tent_equipment_and_shared_workshop.sql", "rpc_kq_ensure_equipment_profile"));
  for (const [file, name] of [
    ["20261001000200_kq_tent_equipment_and_shared_workshop.sql", "kq_guard_culture_equipment_start"],
    ["20261001000200_kq_tent_equipment_and_shared_workshop.sql", "kq_invoice_completed_cycle"],
    ["20261011130000_kq_building_services.sql", "kq_wear_culture_equipment_on_completion"],
    ["20261011120000_kq_chanvrier_career.sql", "kq_assert_processing_maintenance"],
    ["20261011120000_kq_chanvrier_career.sql", "kq_record_chanvrier_processing"],
    ["20261011120100_kq_gradual_production_expansion.sql", "kq_run_production_units"],
    ["20260924000300_kq_individual_tents.sql", "kq_run_tents"],
  ]) await db.exec(await definition(file, name));
  await db.exec("CREATE TRIGGER test_guard_culture_start BEFORE INSERT ON kq_runs FOR EACH ROW EXECUTE FUNCTION kq_guard_culture_equipment_start()");
  // Apply the two actual historical compatibility edits on the full commerce
  // function loaded above; do not replace the function with a dummy test body.
  let prepare = await scalar("SELECT pg_get_functiondef('rpc_kq_prepare_market_lot(uuid,uuid,numeric,numeric,text,text[],jsonb)'::regprocedure)");
  prepare = prepare.replace("p_harvest_grams NOT BETWEEN 0.1 AND 500", "p_harvest_grams NOT BETWEEN 0.1 AND 4000");
  await db.exec(prepare);
  let commerce = await scalar("SELECT pg_get_functiondef('rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure)");
  commerce = commerce.replace("array_agg(equipment_code ORDER BY equipment_code)", "array_agg(DISTINCT equipment_code ORDER BY equipment_code)");
  await db.exec(commerce);
  for (const file of ["20261011000200_storage_budget.sql", "20261012000100_kq_warehouse_layouts.sql", "20261012000200_kq_warehouse_run_integration.sql", "20261012000300_kq_warehouse_storage.sql"]) {
    await db.exec(await sql(file));
    console.log(`Applied ${file}`);
  }
  const { createKqWarehouseStarter: createCurrentStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot } = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse.ts");
  // These chronological tests predate floor adoption. Preserve their exact
  // historical geometry; the dedicated floor runner tests the new 100 m² start.
  const createKqWarehouseStarter = () => {
    const state = createCurrentStarter();
    delete state.floor;
    state.serviceZones = state.serviceZones.map(zone => ({ ...zone, y: 24 }));
    return state;
  };
  const { quoteKqWarehouseEnergy } = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse-run.ts");
  const { summarizeKqEquipmentLoadout } = await vite.ssrLoadModule("/src/lib/kanab-quest-equipment.ts");
  const { quoteKqMarketRoutes } = await vite.ssrLoadModule("/src/lib/kanab-quest-market.ts");
  // Keep the exact historical one-room starter for the 001–004 assertions.
  // New service-zone starters are exercised after 005 below.
  const starter = getKqWarehouseQuote({ version: 1, preparedAreaM2: 0,
    zones: createKqWarehouseStarter().zones,
    equipment: [{ code: "SJ-DRYIT90", quantity: 1 }, { code: "LP-SUPER-1L", quantity: 1 }],
  }).nextState;
  // Reconstruct already-issued historical quotes before the physical-zone
  // adoption requirement, while sharing the current purchase arithmetic.
  const historicalQuote = (candidate, previous) => {
    const quote = getKqWarehouseQuote({ ...candidate, serviceZones: [] }, { ...previous, serviceZones: [] });
    delete quote.nextState.serviceZones;
    return quote;
  };
  const seedHistoricalCultures = owner => db.query(`INSERT INTO kq_runs(id,user_id,state,status,completed_at)
    SELECT gen_random_uuid(),$1,'{"harvestGrams":20,"workshopCareerFixture":true}','completed',now()-interval '30 days' FROM generate_series(1,45)`, [owner]);
  await db.exec("BEGIN");
  const user = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [user]);
  await scalar("SELECT rpc_kq_commerce_state($1)", [user]);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=1000000 WHERE user_id=$1", [user]);
  const initialize = () => scalar("SELECT rpc_kq_warehouse_initialize($1,$2)", [user, starter]);
  equal((await initialize()).revision, 1, "starter conversion installed once");
  const containers = () => scalar("SELECT quantity FROM kq_storage_containers WHERE user_id=$1 AND container_code='GLASS-1L'", [user]);
  equal(await containers(), 8, "two historical starter jars plus six new pack jars");
  await initialize();
  equal(await containers(), 8, "conversion replay does not duplicate containers");
  equal(Number((await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [user])).storageCapacityGrams), 400, "capacity includes preserved jars and the new pack");
  const warehouse = getKqWarehouseRunSnapshot(starter, 1);
  const initial = { warehouse, equipment: { codes: [], levels: {}, ...summarizeKqEquipmentLoadout([], {}) }, energy: quoteKqWarehouseEnergy(warehouse) };
  const beginner = randomUUID(), beginnerRun = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [beginner]);
  await scalar("SELECT rpc_kq_commerce_state($1)", [beginner]);
  // Production's durable-equipment wallet starts at 350 EUR without gifts.
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=35000 WHERE user_id=$1", [beginner]);
  await seedHistoricalCultures(beginner);
  equal((await scalar("SELECT rpc_kq_warehouse_initialize($1,$2)", [beginner, starter])).cashCents, 35000, "initial warehouse does not consume the beginner wallet");
  await db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3,'active')", [beginnerRun, beginner, initial]);
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [beginner]), 32800, "350 EUR beginner balance funds the 22 EUR first-cycle inputs");
  await db.query("UPDATE kq_runs SET state=state||'{\"harvestGrams\":250}',status='completed',completed_at=now() WHERE id=$1", [beginnerRun]);
  equal(await scalar("SELECT w.cash_cents-i.remaining_cents FROM kq_equipment_wallets w JOIN kq_energy_invoices i ON i.user_id=w.user_id WHERE w.user_id=$1 AND i.run_id=$2", [beginner, beginnerRun]), 27790, "the first cycle remains solvent after reserving its 50.10 EUR energy invoice before any sale");
  const startRun = state => scalar("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3,'active') RETURNING id", [randomUUID(), user, state]);
  await reject(() => startRun({ ...initial, warehouse: { ...warehouse, revision: 99 } }), "warehouse_layout_changed");
  await reject(() => startRun({ ...initial, equipment: { ...initial.equipment, quantityPercent: 999 } }), "warehouse_layout_changed");
  const run = await startRun(initial);
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [user]), 1000000 - warehouse.consumablesCostCents, "consumables charged on actual start");
  await reject(() => db.query("UPDATE kq_runs SET state=jsonb_set(state,'{warehouse,revision}','2') WHERE id=$1", [run]), "warehouse_snapshot_immutable");
  await reject(() => db.query("UPDATE kq_runs SET state=jsonb_set(state,'{harvestGrams}','999999') WHERE id=$1", [run]), "warehouse_harvest_invalid");
  await db.query("UPDATE kq_runs SET state=state||'{\"harvestGrams\":250}',status='completed',completed_at=now() WHERE id=$1", [run]);
  equal(await scalar("SELECT total_cents FROM kq_energy_invoices WHERE run_id=$1", [run]), warehouse.energyCostCents, "physical energy produces the terminal invoice");
  const failedRun = await startRun(initial);
  await db.query("UPDATE kq_runs SET state=state||'{\"cultureDead\":true}',status='abandoned' WHERE id=$1", [failedRun]);
  equal(await scalar("SELECT total_cents FROM kq_energy_invoices WHERE run_id=$1", [failedRun]), warehouse.energyCostCents, "failed cultures still pay the physical energy consumed");
  await db.query("UPDATE kq_runs SET status='abandoned' WHERE id=$1", [failedRun]);
  equal(await scalar("SELECT count(*)::INTEGER FROM kq_energy_invoices WHERE run_id=$1", [failedRun]), 1, "failed culture invoice cannot be duplicated");
  const candidate = { ...starter, equipment: [...starter.equipment, { code: "GV-GP50-7", quantity: 1 }] };
  const quote = historicalQuote(candidate, starter);
  const key = randomUUID();
  const request = { state: candidate, expectedRevision: 1, expectedCostCents: quote.totalCostCents };
  const save = () => scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,1,$4,$5,$6)", [user, key, request, starter, quote.nextState, quote.totalCostCents]);
  equal((await save()).revision, 2, "real machine purchase persists quantified stock");
  equal((await save()).receipt.replayed, true, "layout retry reuses its receipt");
  equal(await containers(), 8, "unrelated layout update leaves jar counts unchanged");
  equal(await scalar("SELECT kq_warehouse_processing_codes($1)", [user]), ["PRESS-0600", "TENT-080-STARTER"], "market sees only physical machines and raw-sale compatibility");
  equal(Number((await scalar("SELECT kq_warehouse_wholesale_budget($1)", [user])).remainingEquivalentUnits), 10000, "shared wholesale budget is finite");
  await scalar("SELECT kq_warehouse_consume_wholesale($1,$2,7000)", [user, randomUUID()]);
  await reject(() => scalar("SELECT kq_warehouse_consume_wholesale($1,$2,4000)", [user, randomUUID()]), "warehouse_wholesale_exhausted");
  equal(Number((await scalar("SELECT kq_warehouse_wholesale_budget($1)", [user])).remainingEquivalentUnits), 3000, "splitting lots cannot reset wholesale allowance");
  const flower = randomUUID();
  await db.query("INSERT INTO kq_flowers(id,owner_id,run_id,status,burned_at) VALUES($1,$2,$3,'burned',now())", [flower, user, run]);
  const options = [{ route: "rosin-trial", warehouseRevision: 2, warehouseState: quote.nextState, processingDurationSeconds: 3600 }];
  await scalar("SELECT rpc_kq_prepare_market_lot($1,$2,250,9,'signature',$3,$4)", [user, flower, ["PRESS-0600", "TENT-080-STARTER"], options]);
  equal(await scalar("SELECT state->'capacity'->'automaticOverflowSale' FROM kq_storage_lots WHERE flower_id=$1", [flower]), false, "new harvest never schedules automatic overflow buyers");
  equal(await scalar("SELECT kq_storage_sell_overflow($1,true)", [flower]), null, "automatic overflow sales are disabled for warehouse harvests");
  const processingKey = randomUUID();
  const processingRequest = { flowerId: flower, route: "rosin-trial", expectedCostCents: 0 };
  const prepareProcessing = payload => scalar("SELECT rpc_kq_commerce_command($1,'prepare',$2,$3)", [user, payload, processingKey]);
  const beforeDryingCash = await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [user]);
  await reject(() => prepareProcessing(processingRequest), "warehouse_drying_required");
  await reject(() => db.query("INSERT INTO kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES($1,$2,'rosin-trial',2500,0)", [flower, user]), "warehouse_drying_required");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [user]), beforeDryingCash, "premature processing never debits the wallet");
  equal(await scalar("SELECT count(*)::INTEGER FROM kq_commerce_batches WHERE flower_id=$1", [flower]), 0, "drying creates no processing batch or running workshop timer");
  await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb(now()-interval '1 hour')) WHERE flower_id=$1", [flower]);
  await db.exec("SAVEPOINT missing_storage_probe");
  await db.query("UPDATE kq_storage_containers SET quantity=1 WHERE user_id=$1 AND container_code='GLASS-1L'", [user]);
  await scalar("SELECT kq_storage_allocate($1,NULL,true)", [flower]);
  await reject(() => prepareProcessing(processingRequest), "commerce_storage_overflow");
  await reject(() => db.query("INSERT INTO kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES($1,$2,'rosin-trial',2500,0)", [flower, user]), "commerce_storage_overflow");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [user]), beforeDryingCash, "a dry but unprotected lot cannot charge processing fees");
  await db.exec("ROLLBACK TO SAVEPOINT missing_storage_probe");
  // Exercise the actual command with a full server quote, then restore this
  // fixture so the independent stock-mass scenarios below keep their fixed units.
  await db.exec("SAVEPOINT mature_processing_probe");
  const processingStorage = (await db.query("SELECT revision,now()+interval '1 hour' AS expires_at FROM kq_storage_lots WHERE flower_id=$1", [flower])).rows[0];
  const processingQuote = quoteKqMarketRoutes({ juryScore: 9, harvestGrams: 250,
    equipmentCodes: ["PRESS-0600", "TENT-080-STARTER"], equipmentLevels: { "PRESS-0600": 1 }, processingBatchGrams: { "PRESS-0600": 80 },
    marketContext: { reputation: 0, routeSales: {}, recentSales: {}, marketVolumes: {}, window: 0 },
  }).find(item => item.route === "rosin-trial");
  Object.assign(processingQuote, { storageRevision: Number(processingStorage.revision), storageChangeAt: new Date(processingStorage.expires_at).toISOString(),
    warehouseRevision: 2, warehouseState: quote.nextState, processingDurationSeconds: 14400 });
  await db.query("UPDATE kq_market_lots SET options=$2 WHERE flower_id=$1", [flower, [processingQuote]]);
  const readyRequest = { ...processingRequest, expectedCostCents: processingQuote.market.processingCostCents };
  const preparedProcessing = await prepareProcessing(readyRequest);
  equal(preparedProcessing.paidCents, processingQuote.market.processingCostCents, "mature protected stock can start actual processing");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [user]), beforeDryingCash - processingQuote.market.processingCostCents, "processing charges its confirmed cost only after drying");
  equal(await scalar("SELECT b.processing_started_at>= (s.state->>'readyAt')::TIMESTAMPTZ AND b.processing_started_at=now() AND b.processing_ready_at=b.processing_started_at+interval '4 hours' FROM kq_commerce_batches b JOIN kq_storage_lots s USING(flower_id) WHERE b.flower_id=$1", [flower]), true, "workshop time starts after storage readiness and runs for its own duration");
  equal((await prepareProcessing(readyRequest)).replayed, true, "retrying mature processing returns its original receipt");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [user]), beforeDryingCash - processingQuote.market.processingCostCents, "a processing retry cannot charge again");
  await db.exec("ROLLBACK TO SAVEPOINT mature_processing_probe");
  await db.query("INSERT INTO kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES($1,$2,'rosin-trial',2500,0)", [flower, user]);
  equal(Number(await scalar("SELECT extract(epoch FROM processing_ready_at-processing_started_at) FROM kq_commerce_batches WHERE flower_id=$1", [flower])), 3600, "processing uses an actual one-hour queue");
  const stock = randomUUID();
  await db.query("INSERT INTO kq_commerce_stock(id,flower_id,user_id,route,initial_units,remaining_units,equivalent_units,base_unit_cents) VALUES($1,$2,$3,'rosin-trial',500,500,2500,100)", [stock, flower, user]);
  const onlineCommand = (action, payload) => scalar("SELECT rpc_kq_online_command($1,$2,$3,$4)", [user, action, payload, randomUUID()]);
  await db.query("UPDATE kq_commerce_accounts SET computer_owned=true WHERE user_id=$1", [user]);
  await onlineCommand("upgrade-site", { tier: "basic", name: "Warehouse integration" });
  await onlineCommand("buy-packaging", { code: "kraft-5", quantity: 10 });
  const listingRequest = { stockId: stock, formatGrams: 5, packagingCode: "kraft-5", packets: 10, packetPriceCents: 500 };
  await reject(() => onlineCommand("create-listing", listingRequest), "warehouse_processing_pending");
  await db.query("UPDATE kq_commerce_batches SET processing_ready_at=now()-interval '1 second' WHERE flower_id=$1", [flower]);
  await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb(now()-interval '1 hour')) WHERE flower_id=$1", [flower]);
  const beforePacking = Number((await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [user])).stockGrams);
  const listing = (await onlineCommand("create-listing", listingRequest)).listingId;
  equal(await scalar("SELECT remaining_units FROM kq_commerce_stock WHERE id=$1", [stock]), 0, "packing the complete batch removes all loose product");
  equal(Number((await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [user])).stockGrams), beforePacking, "unsold packets still occupy the same physical warehouse capacity");
  equal(Number((await scalar("SELECT kq_online_snapshot($1)", [user])).listings.find(item => item.id === listing).equivalentUnitsPerProductUnit), 5, "fully packed transformed goods retain their raw-equivalent forecast ratio");
  const updatedWarehouse = getKqWarehouseRunSnapshot(quote.nextState, 2);
  const updatedInitial = { ...initial, warehouse: updatedWarehouse, energy: quoteKqWarehouseEnergy(updatedWarehouse) };
  await reject(() => startRun(updatedInitial), "warehouse_capacity");
  await onlineCommand("pause-listing", { listingId: listing });
  equal(Number((await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [user])).stockGrams), beforePacking, "pausing a listing keeps its physical stock reservation");
  await onlineCommand("resume-listing", { listingId: listing });
  await db.query("UPDATE kq_online_listings SET order_progress=1 WHERE id=$1", [listing]);
  await scalar("SELECT kq_online_dispatch($1,$2,now())", [user, listing]);
  equal(Number((await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [user])).stockGrams), beforePacking - 25, "shipping one transformed packet releases only its material equivalent");
  const workshopCandidate = { ...quote.nextState, equipment: [
    ...quote.nextState.equipment.map(item => item.code === "LP-SUPER-1L" ? { ...item, quantity: 3 } : item),
    { code: "GV-WASHER-36L", quantity: 1 },
  ] };
  const workshopQuote = historicalQuote(workshopCandidate, quote.nextState);
  await scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,2,$4,$5,$6)", [user, randomUUID(),
    { state: workshopCandidate, expectedRevision: 2, expectedCostCents: workshopQuote.totalCostCents },
    quote.nextState, workshopQuote.nextState, workshopQuote.totalCostCents]);
  const workshopWarehouse = getKqWarehouseRunSnapshot(workshopQuote.nextState, 3);
  const workshopInitial = { ...initial, warehouse: workshopWarehouse, energy: quoteKqWarehouseEnergy(workshopWarehouse) };
  const workshopCodes = await scalar("SELECT kq_warehouse_processing_codes($1)", [user]);
  const queueBatch = async (route, seconds) => {
    const cycle = await startRun(workshopInitial), lot = randomUUID();
    await db.query("UPDATE kq_runs SET state=state||'{\"harvestGrams\":250}',status='completed',completed_at=now() WHERE id=$1", [cycle]);
    await db.query("INSERT INTO kq_flowers(id,owner_id,run_id,status,burned_at) VALUES($1,$2,$3,'burned',now())", [lot, user, cycle]);
    await scalar("SELECT rpc_kq_prepare_market_lot($1,$2,250,9,'signature',$3,$4)", [user, lot, workshopCodes,
      [{ route, warehouseRevision: 3, warehouseState: workshopQuote.nextState, processingDurationSeconds: seconds }]]);
    await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb(now()-interval '1 hour')) WHERE flower_id=$1", [lot]);
    await db.query("INSERT INTO kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES($1,$2,$3,2500,0)", [lot, user, route]);
    return (await db.query("SELECT extract(epoch FROM processing_started_at-now())::INTEGER AS starts,extract(epoch FROM processing_ready_at-processing_started_at)::INTEGER AS duration FROM kq_commerce_batches WHERE flower_id=$1", [lot])).rows[0];
  };
  equal(await queueBatch("rosin-trial", 100800), { starts: 0, duration: 100800 }, "server-approved batches longer than 24 hours are accepted");
  equal(await queueBatch("ice-water-hash", 7200), { starts: 0, duration: 7200 }, "washing can run while the independent press is occupied");
  equal(await queueBatch("rosin-selection", 3600), { starts: 100800, duration: 3600 }, "all press routes share the same occupied machine queue");
  const legacyOwner = randomUUID(), legacyRun = randomUUID(), legacyFlower = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [legacyOwner]);
  await scalar("SELECT rpc_kq_commerce_state($1)", [legacyOwner]);
  await db.query("INSERT INTO kq_runs(id,user_id,state,status,completed_at) VALUES($1,$2,'{\"harvestGrams\":3000}','completed',now())", [legacyRun, legacyOwner]);
  await db.query("INSERT INTO kq_flowers(id,owner_id,run_id,status,burned_at) VALUES($1,$2,$3,'burned',now())", [legacyFlower, legacyOwner, legacyRun]);
  await scalar("SELECT rpc_kq_prepare_market_lot($1,$2,3000,9,'signature',ARRAY[]::TEXT[],'[]'::JSONB)", [legacyOwner, legacyFlower]);
  await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{capacity,overflowDeadlineAt}',to_jsonb(now()-interval '1 hour')) WHERE flower_id=$1", [legacyFlower]);
  await scalar("SELECT rpc_kq_warehouse_initialize($1,$2)", [legacyOwner, starter]);
  equal(await scalar("SELECT state->'capacity'->'automaticOverflowSale' FROM kq_storage_lots WHERE flower_id=$1", [legacyFlower]), false, "conversion immediately protects old lots from automatic sale");
  equal(await scalar("SELECT kq_storage_sell_overflow($1,true)", [legacyFlower]), null, "expired historical surplus cannot auto-sell after conversion");
  equal(Number((await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [legacyOwner])).stockGrams), 3000, "conversion keeps the entire historical harvest");
  const legacyStorage = await scalar("SELECT rpc_kq_storage_state($1)", [legacyOwner]);
  equal(legacyStorage.lots.find(item => item.flowerId === legacyFlower).overflowOffer.units, 10000, "surplus preview is capped at today's shared wholesale demand");
  const surplusKey = randomUUID();
  const sellSurplus = () => scalar("SELECT rpc_kq_storage_capacity_command($1,'sell-overflow',NULL,NULL,NULL,$2,$3)", [legacyOwner, legacyFlower, surplusKey]);
  await sellSurplus();
  equal(Number((await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [legacyOwner])).stockGrams), 2000, "a large historical surplus sells partially without destroying the remainder");
  equal((await sellSurplus()).replayed, true, "partial surplus sale retries do not consume a second quota");
  equal(Number((await scalar("SELECT kq_warehouse_wholesale_budget($1)", [legacyOwner])).remainingEquivalentUnits), 0, "manual legacy surplus uses the same account-wide quota");
  await reject(() => scalar("SELECT kq_storage_sell_overflow($1,false)", [legacyFlower]), "warehouse_wholesale_exhausted");
  for (const role of ["anon", "authenticated", "service_role"]) equal(await scalar("SELECT has_table_privilege($1,'kq_warehouse_layouts','SELECT')", [role]), false, `${role} has no direct layout Data API access`);

  // Materialize profiles as they existed before the corrective migration. The
  // legacy workshop keeps its paid machines, installed slots, levels and wear.
  for (const [file, name] of [
    ["20260927000600_kq_shared_processing_workshop.sql", "kq_is_shared_processing_equipment"],
    ["20261001000200_kq_tent_equipment_and_shared_workshop.sql", "kq_equipment_storage_tent"],
    ["20260924000300_kq_individual_tents.sql", "kq_assert_owned_tent"],
    ["20261001000200_kq_tent_equipment_and_shared_workshop.sql", "rpc_kq_purchase_tent_equipment"],
    ...["rpc_kq_upgrade_tent_equipment", "rpc_kq_repair_tent_machine", "rpc_kq_equip_tent_equipment"].map(name => ["20260927000600_kq_shared_processing_workshop.sql", name]),
    ...["rpc_kq_purchase_equipment", "rpc_kq_upgrade_equipment", "rpc_kq_repair_machine", "rpc_kq_equip_durable"].map(name => ["20260928000100_kq_shared_installation_equipment.sql", name]),
    ["20260914000200_kq_machine_maintenance.sql", "kq_machine_interval"],
  ]) await db.exec(await definition(file, name));
  // The current career migration permits preventive maintenance after one use.
  const careerMigration = await sql("20261011120000_kq_chanvrier_career.sql");
  const servicePatch = careerMigration.indexOf("DO $$ DECLARE definition TEXT; fragment TEXT;");
  assert(servicePatch > 0, "real preventive maintenance patch changed");
  await db.exec(careerMigration.slice(servicePatch, careerMigration.indexOf("END $$;", servicePatch) + 7));
  const workshopCodesAll = ["AUTO-SIEVE", "FREEZE-DRYER", "PRESS-0600", "SIFT-TRAY", "STATIC-PLASMA", "WASHER-25L"];
  const makeHistoricalWorkshop = async convert => {
    const owner = randomUUID();
    await db.query("INSERT INTO auth.users VALUES($1)", [owner]);
    await scalar("SELECT rpc_kq_commerce_state($1)", [owner]);
    await db.query("UPDATE kq_equipment_wallets SET cash_cents=100000000 WHERE user_id=$1", [owner]);
    await seedHistoricalCultures(owner);
    await db.query(`INSERT INTO kq_player_equipment(user_id,tent_number,equipment_code,purchase_price_cents,level,wear_cycles,maintenance_version)
      SELECT $1,1,c.code,c.price_cents,CASE WHEN c.code='LED-300' THEN 2 ELSE 3+array_position($2::TEXT[],c.code) END,
      CASE WHEN c.code='LED-300' THEN 0 ELSE array_position($2::TEXT[],c.code) END,4
      FROM kq_equipment_catalog c WHERE c.code=ANY($2::TEXT[]) OR c.code='LED-300'`, [owner, workshopCodesAll]);
    await db.query(`INSERT INTO kq_equipment_loadouts(user_id,tent_number,slot,equipment_code)
      SELECT $1,1,slot,code FROM kq_equipment_catalog WHERE code=ANY($2::TEXT[]) OR code='LED-300'
      ON CONFLICT(user_id,tent_number,slot) DO UPDATE SET equipment_code=EXCLUDED.equipment_code`, [owner, workshopCodesAll]);
    await db.query(`INSERT INTO kq_equipment_upgrade_receipts(user_id,request_key,equipment_code,previous_level,level,price_cents,cash_after_cents,tent_number)
      VALUES($1,$2,'PRESS-0600',5,6,42500,100000000,1),($1,$3,'LED-300',1,2,3590,100000000,1)`, [owner, randomUUID(), randomUUID()]);
    if (convert) await scalar("SELECT rpc_kq_warehouse_initialize($1,$2)", [owner, starter]);
    return owner;
  };
  const retainedWorkshop = await makeHistoricalWorkshop(true);
  const spentWorkshop = await makeHistoricalWorkshop(true);
  const futureWorkshop = await makeHistoricalWorkshop(false);
  await db.query("UPDATE kq_player_equipment SET level=3 WHERE user_id=$1 AND equipment_code='TENT-080-STARTER'", [futureWorkshop]);
  const duplicateWorkshop = await makeHistoricalWorkshop(true);
  const duplicatePlan = { ...starter, equipment: [...starter.equipment, { code: "GV-GP50-7", quantity: 2 }] };
  const duplicateQuote = historicalQuote(duplicatePlan, starter);
  await scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,1,$4,$5,$6)", [duplicateWorkshop, randomUUID(),
    { state: duplicatePlan, expectedRevision: 1, expectedCostCents: duplicateQuote.totalCostCents }, starter, duplicateQuote.nextState, duplicateQuote.totalCostCents]);
  const spentPlan = { ...starter, zones: starter.zones.map(zone => ({ ...zone, x: 0, y: 0, width: 40, height: 25, active: false })) };
  const spentQuote = historicalQuote(spentPlan, starter);
  await scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,1,$4,$5,$6)", [spentWorkshop, randomUUID(),
    { state: spentPlan, expectedRevision: 1, expectedCostCents: spentQuote.totalCostCents }, starter, spentQuote.nextState, spentQuote.totalCostCents]);
  equal(Number((await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [spentWorkshop])).migrationCreditCents), 0, "fixture spends its historical conversion credit through the real purchase RPC");
  const oldMachineRows = owner => scalar("SELECT jsonb_agg(to_jsonb(e) ORDER BY equipment_code) FROM kq_player_equipment e WHERE user_id=$1", [owner]);
  const retainedBefore = await oldMachineRows(retainedWorkshop);
  const archiveBefore = await scalar("SELECT legacy_archive FROM kq_warehouse_layouts WHERE user_id=$1", [retainedWorkshop]);
  const spentArchiveBefore = await scalar("SELECT legacy_archive FROM kq_warehouse_layouts WHERE user_id=$1", [spentWorkshop]);
  const cashBeforeCorrection = await scalar("SELECT jsonb_object_agg(user_id,cash_cents) FROM kq_equipment_wallets");
  const deadlinesBeforeCorrection = await scalar("SELECT jsonb_object_agg(flower_id,state->'readyAt') FROM kq_storage_lots");
  await db.exec(`
    CREATE TABLE kq_chanvrier_career_events(run_id UUID PRIMARY KEY,user_id UUID,outcome TEXT,xp INTEGER,occurred_at TIMESTAMPTZ);
    CREATE TABLE kq_chanvrier_processing_practice(user_id UUID,flower_id UUID,family TEXT,route TEXT,equipment_codes TEXT[],occurred_at TIMESTAMPTZ,PRIMARY KEY(user_id,flower_id,family));
  `);
  for (const name of ["kq_chanvrier_processing_family", "rpc_kq_chanvrier_career", "kq_equipment_required_career_level", "kq_assert_equipment_career",
    "kq_guard_equipment_career", "kq_processing_route_uses_equipment", "kq_guard_processing_maintenance", "kq_guard_legacy_processing_maintenance"])
    await db.exec(await definition("20261011120000_kq_chanvrier_career.sql", name));
  await db.exec(`
    CREATE TRIGGER kq_guard_equipment_career BEFORE INSERT OR UPDATE OF level ON kq_player_equipment FOR EACH ROW EXECUTE FUNCTION kq_guard_equipment_career();
    CREATE TRIGGER kq_guard_processing_maintenance BEFORE INSERT ON kq_commerce_batches FOR EACH ROW EXECUTE FUNCTION kq_guard_processing_maintenance();
    CREATE TRIGGER kq_guard_legacy_processing_maintenance BEFORE INSERT ON kq_market_sale_receipts FOR EACH ROW EXECUTE FUNCTION kq_guard_legacy_processing_maintenance();
    CREATE TRIGGER kq_record_chanvrier_processing AFTER INSERT ON kq_commerce_batches FOR EACH ROW EXECUTE FUNCTION kq_record_chanvrier_processing();
  `);
  const correctiveMigration = "20261012000400_kq_warehouse_legacy_workshop.sql";
  await db.exec(await sql(correctiveMigration));
  console.log(`Applied ${correctiveMigration}`);
  await db.exec("BEGIN");
  equal(await scalar("SELECT jsonb_object_agg(user_id,cash_cents) FROM kq_equipment_wallets"), cashBeforeCorrection, "workshop correction never debits or credits the cash wallet");
  equal(await scalar("SELECT jsonb_object_agg(flower_id,state->'readyAt') FROM kq_storage_lots"), deadlinesBeforeCorrection, "workshop reconciliation cannot restart or finish any lot's drying clock");
  equal(await oldMachineRows(retainedWorkshop), retainedBefore, "all six installed legacy machines preserve ownership, levels, maintenance and acquisition dates");
  equal(await scalar("SELECT legacy_archive FROM kq_warehouse_layouts WHERE user_id=$1", [retainedWorkshop]), archiveBefore, "corrective migration preserves the original conversion evidence exactly");
  equal(await scalar("SELECT legacy_archive FROM kq_warehouse_layouts WHERE user_id=$1", [spentWorkshop]), spentArchiveBefore, "spent-credit archives are also immutable");
  equal(Number((await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [retainedWorkshop])).migrationCreditCents), 39490, "remaining conversion credit excludes restored workshop purchase and upgrade principal");
  equal(Number((await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [spentWorkshop])).migrationCreditCents), 0, "previously spent credit never becomes a debt or a second credit");
  equal(await scalar("SELECT workshop_reconciliation->>'previouslySpentCreditCents' FROM kq_warehouse_layouts WHERE user_id=$1", [spentWorkshop]), String(Number(spentArchiveBefore.creditCents) - 39490), "the correction records workshop credit already spent without changing historical receipts");
  equal(Number((await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [duplicateWorkshop])).migrationCreditCents), 73998, "duplicate physical presses return only their two paid device principals as layout credit");
  equal(await scalar("SELECT level FROM kq_player_equipment WHERE user_id=$1 AND equipment_code='PRESS-0600'", [duplicateWorkshop]), 6, "physical conversion preserves a better existing press without lowering or duplicating it");
  const workshopSnapshot = owner => scalar("SELECT kq_warehouse_workshop_snapshot($1)", [owner]);
  const retainedSnapshot = await workshopSnapshot(retainedWorkshop);
  equal(await workshopSnapshot(beginner), { equippedCodes: ["TENT-080-STARTER"], levels: { "TENT-080-STARTER": 1 } }, "starter snapshot has exactly the same level-one compatibility code as the server quote");
  equal(retainedSnapshot.equippedCodes, [...workshopCodesAll, "TENT-080-STARTER"].sort(), "all six workshop machines remain available in their installed slots");
  equal(retainedSnapshot.levels["PRESS-0600"], 6, "recipe quotes use the preserved press level");
  const oldRoutes = quoteKqMarketRoutes({ juryScore: 9, harvestGrams: 20, equipmentCodes: retainedSnapshot.equippedCodes, equipmentLevels: retainedSnapshot.levels });
  equal(oldRoutes.find(item => item.route === "rosin-selection").available, true, "an owned level-six press retains its unlocked recipe");
  equal(oldRoutes.find(item => item.route === "rosin-premium").available, false, "a higher recipe still requires its original level-seven improvement");
  equal(oldRoutes.find(item => item.route === "hash-signature").available, true, "washer, sieve and freeze dryer still unlock their combined recipe");
  equal((await scalar("SELECT rpc_kq_warehouse_initialize($1,$2)", [futureWorkshop, starter])).migrationCreditCents, 39490, "future conversions exclude workshop value from new layout credit");
  equal((await workshopSnapshot(futureWorkshop)).levels, retainedSnapshot.levels, "future conversions preserve all legacy workshop levels");
  equal(await scalar("SELECT level FROM kq_player_equipment WHERE user_id=$1 AND equipment_code='TENT-080-STARTER'", [futureWorkshop]), 3, "raw-sale compatibility stays level one without rewriting an anomalous historical starter level");
  await reject(() => db.query("UPDATE kq_warehouse_layouts SET legacy_archive='{}' WHERE user_id=$1", [retainedWorkshop]), "warehouse_archive_immutable");
  await reject(() => db.query("UPDATE kq_player_equipment SET culture_wear_percent=1 WHERE user_id=$1 AND equipment_code='LED-300'", [retainedWorkshop]), "warehouse_legacy_equipment_archived");
  await reject(() => db.query("UPDATE kq_equipment_wallets SET production_units=2 WHERE user_id=$1", [retainedWorkshop]), "warehouse_legacy_equipment_archived");
  equal((await workshopSnapshot(user)).equippedCodes, ["PRESS-0600", "TENT-080-STARTER", "WASHER-25L"], "the two already purchased physical machines are imported into the shared workshop");
  equal((await db.query("SELECT equipment_code,purchase_price_cents,level FROM kq_player_equipment WHERE user_id=$1 AND purchase_price_cents>0 ORDER BY equipment_code", [user])).rows,
    [{ equipment_code: "PRESS-0600", purchase_price_cents: 36999, level: 1 }, { equipment_code: "WASHER-25L", purchase_price_cents: 12799, level: 1 }], "imports keep the actual acquisition principal without gifting premium levels");
  equal(await scalar("SELECT count(*)::INTEGER FROM kq_warehouse_layouts l,LATERAL jsonb_array_elements(l.state->'equipment') e WHERE e->>'code' IN ('GV-GP50-7','GV-WASHER-36L')"), 0, "physical workshop copies cannot remain available in a second inventory");
  equal(await scalar("SELECT quantity FROM kq_storage_containers WHERE user_id=$1 AND container_code='GLASS-1L'", [user]), 20, "workshop migration cannot duplicate or remove storage containers");
  const postCorrection = await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [user]);
  await reject(() => scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,$4,$5,$6,0)", [user, randomUUID(), { expectedCostCents: 0 }, postCorrection.revision,
    postCorrection.state, { ...postCorrection.state, equipment: [...postCorrection.state.equipment, { code: "GV-GP50-7", quantity: 1 }] }]), "warehouse_workshop_purchase");
  const earnCareer = async (owner, cultures = 45) => db.query(`INSERT INTO kq_chanvrier_career_events(run_id,user_id,outcome,xp,occurred_at)
    SELECT id,$1,'completed',100,completed_at FROM kq_runs WHERE user_id=$1 AND state->>'workshopCareerFixture'='true'
    ORDER BY id LIMIT $2`, [owner, cultures]);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=10000000 WHERE user_id=$1", [beginner]);
  const purchaseKey = randomUUID();
  const purchaseSift = () => scalar("SELECT rpc_kq_purchase_tent_equipment($1,$2,ARRAY['SIFT-TRAY'],1)", [beginner, purchaseKey]);
  await reject(purchaseSift, "equipment_career_level_required_3");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [beginner]), 10000000, "a blocked novice purchase rolls back its debit");
  await earnCareer(beginner, 4);
  equal((await purchaseSift()).totalPriceCents, 55000, "the real workshop purchase RPC accepts an eligible converted player");
  equal((await purchaseSift()).replayed, true, "workshop purchases preserve receipt replay protection");
  await scalar("SELECT rpc_kq_equip_tent_equipment($1,'SIFT-TRAY',1)", [beginner]);
  equal((await workshopSnapshot(beginner)).equippedCodes, ["SIFT-TRAY", "TENT-080-STARTER"], "a purchased machine becomes usable only after installation");
  const upgradeKey = randomUUID();
  const upgradeSift = () => scalar("SELECT rpc_kq_upgrade_tent_equipment($1,$2,'SIFT-TRAY',1,1)", [beginner, upgradeKey]);
  equal((await upgradeSift()).level, 2, "converted players can improve their installed workshop");
  equal((await upgradeSift()).replayed, true, "workshop upgrades cannot charge twice");
  await scalar("SELECT rpc_kq_upgrade_tent_equipment($1,$2,'SIFT-TRAY',2,1)", [beginner, randomUUID()]);
  await reject(() => scalar("SELECT rpc_kq_upgrade_tent_equipment($1,$2,'SIFT-TRAY',3,1)", [beginner, randomUUID()]), "equipment_career_level_required_5");
  await earnCareer(retainedWorkshop);
  const createWorkshopLot = async (owner, route, seconds, dry = true) => {
    const cycle = await scalar("SELECT id FROM kq_runs r WHERE user_id=$1 AND state->>'workshopCareerFixture'='true' AND NOT EXISTS(SELECT 1 FROM kq_flowers f WHERE f.run_id=r.id) ORDER BY id LIMIT 1", [owner]);
    const lot = randomUUID();
    await db.query("INSERT INTO kq_flowers(id,owner_id,run_id,status,burned_at) VALUES($1,$2,$3,'burned',now())", [lot, owner, cycle]);
    const snapshot = await workshopSnapshot(owner);
    const layout = await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [owner]);
    const required = await scalar("SELECT array_agg(code ORDER BY code) FROM unnest($2::TEXT[]) code WHERE kq_processing_route_uses_equipment($1,code)", [route, workshopCodesAll]);
    await scalar("SELECT rpc_kq_prepare_market_lot($1,$2,20,9,'signature',$3,$4)", [owner, lot, snapshot.equippedCodes,
      [{ route, workshopSnapshot: snapshot, warehouseRevision: layout.revision, warehouseState: layout.state,
        processingEquipmentCodes: required, processingDurationSeconds: seconds }]]);
    if (dry) await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb(now()-interval '1 second')) WHERE flower_id=$1", [lot]);
    const prepare = () => db.query("INSERT INTO kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES($1,$2,$3,200,0)", [lot, owner, route]);
    return { lot, prepare };
  };
  const wetLot = await createWorkshopLot(retainedWorkshop, "rosin-trial", 3600, false);
  await reject(wetLot.prepare, "warehouse_drying_required");
  await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb(now()-interval '1 second')) WHERE flower_id=$1", [wetLot.lot]);
  await db.exec("SAVEPOINT workshop_storage_probe");
  await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{capacity,allocations}','[]') WHERE flower_id=$1", [wetLot.lot]);
  await reject(wetLot.prepare, "commerce_storage_overflow");
  await db.exec("ROLLBACK TO SAVEPOINT workshop_storage_probe");
  await db.query("UPDATE kq_player_equipment SET wear_cycles=kq_machine_interval(equipment_code,level) WHERE user_id=$1 AND equipment_code='PRESS-0600'", [retainedWorkshop]);
  await reject(wetLot.prepare, "commerce_machine_maintenance");
  const serviceCost = Number(await scalar("SELECT LEAST(20000,GREATEST(1000,ceil(c.price_cents*.06*(1+(e.level-1)*.05)))) FROM kq_player_equipment e JOIN kq_equipment_catalog c ON c.code=e.equipment_code WHERE e.user_id=$1 AND e.equipment_code='PRESS-0600'", [retainedWorkshop]));
  const repairKey = randomUUID();
  const repairPress = () => scalar("SELECT rpc_kq_repair_tent_machine($1,'PRESS-0600',4,$2,$3,1)", [retainedWorkshop, serviceCost, repairKey]);
  equal((await repairPress()).paidCents, serviceCost, "real maintenance can restore a converted player's worn machine");
  equal((await repairPress()).replayed, true, "maintenance receipt replay cannot debit twice");
  equal(await scalar("SELECT wear_cycles FROM kq_player_equipment WHERE user_id=$1 AND equipment_code='PRESS-0600'", [retainedWorkshop]), 0, "maintenance resets only the serviced machine's wear");
  await wetLot.prepare();
  equal(await scalar("SELECT wear_cycles FROM kq_player_equipment WHERE user_id=$1 AND equipment_code='PRESS-0600'", [retainedWorkshop]), 1, "an actual processed batch wears the restored legacy machine once");
  equal(await scalar("SELECT count(*)::INTEGER FROM kq_chanvrier_processing_practice WHERE user_id=$1 AND flower_id=$2", [retainedWorkshop, wetLot.lot]), 1, "converted processing earns real career practice");
  const staleLot = await createWorkshopLot(retainedWorkshop, "rosin-selection", 7200);
  await scalar("SELECT rpc_kq_upgrade_tent_equipment($1,$2,'PRESS-0600',6,1)", [retainedWorkshop, randomUUID()]);
  await reject(staleLot.prepare, "commerce_offer_changed");
  equal(await scalar("SELECT count(*)::INTEGER FROM kq_commerce_batches WHERE flower_id=$1", [staleLot.lot]), 0, "a concurrent workshop upgrade invalidates the old offer before reserving machines");
  const queue = async (route, seconds) => {
    const lot = await createWorkshopLot(retainedWorkshop, route, seconds);
    await lot.prepare();
    return (await db.query("SELECT extract(epoch FROM processing_started_at-now())::INTEGER AS starts,extract(epoch FROM processing_ready_at-processing_started_at)::INTEGER AS duration,processing_equipment_codes AS machines FROM kq_commerce_batches WHERE flower_id=$1", [lot.lot])).rows[0];
  };
  equal(await queue("ice-water-hash", 7200), { starts: 0, duration: 7200, machines: ["WASHER-25L"] }, "independent washer starts while the press is busy");
  equal(await queue("hash-signature", 32400), { starts: 7200, duration: 32400, machines: ["AUTO-SIEVE", "FREEZE-DRYER", "WASHER-25L"] }, "a composite recipe waits for and reserves all three required workshop machines");
  equal(await queue("ice-water-hash", 7200), { starts: 39600, duration: 7200, machines: ["WASHER-25L"] }, "later washing cannot bypass an already queued composite recipe");
  equal(await queue("dry-sift", 3600), { starts: 0, duration: 3600, machines: ["SIFT-TRAY"] }, "the sifting station is independent of washing and pressing");
  equal(await queue("static-sift", 7200), { starts: 3600, duration: 7200, machines: ["SIFT-TRAY", "STATIC-PLASMA"] }, "static separation shares the sifting station and reserves both machines");
  equal(await queue("rosin-selection", 7200), { starts: 3600, duration: 7200, machines: ["PRESS-0600"] }, "the original press queue still serializes different press recipes");
  // The UI deployed before migration005 could sell these paid devices while
  // migration004's container trigger still understood only the old jar packs.
  const preBridgeAccount = async (deviceCode = "CURTEC-60L", withStock = true) => {
    const owner = randomUUID(), lots = [], pastRuns = [];
    await db.query("INSERT INTO auth.users VALUES($1)", [owner]);
    await scalar("SELECT rpc_kq_commerce_state($1)", [owner]);
    await db.query("UPDATE kq_equipment_wallets SET cash_cents=10000000 WHERE user_id=$1", [owner]);
    await scalar("SELECT kq_storage_initialize($1)", [owner]);
    if (withStock) {
      await db.query("INSERT INTO kq_storage_containers(user_id,container_code,quantity) VALUES($1,'CVAULT-1LB',2),($1,'GROVE-1LB',2)", [owner]);
      await db.query("UPDATE kq_storage_accounts SET default_method_code='STORAGE-GROVE',owned_method_codes=ARRAY['STORAGE-GLASS','STORAGE-GROVE','STORAGE-CVAULT'] WHERE user_id=$1", [owner]);
      for (const grams of [624.2, 522.4, 71]) {
        const cycle = randomUUID(), lot = randomUUID();
        await db.query("INSERT INTO kq_runs(id,user_id,state,status,completed_at) VALUES($1,$2,$3,'completed',now()-interval '2 days')", [cycle, owner, { harvestGrams: grams }]);
        await db.query("INSERT INTO kq_flowers(id,owner_id,run_id,status,burned_at) VALUES($1,$2,$3,$4,CASE WHEN $4='burned' THEN now() END)", [lot, owner, cycle, grams === 71 ? "available" : "burned"]);
        pastRuns.push(cycle); if (grams !== 71) lots.push(lot);
      }
      await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb(now()-interval '1 hour')) WHERE user_id=$1", [owner]);
      const preparedStock = randomUUID();
      await db.query("INSERT INTO kq_market_lots(flower_id,owner_id,harvest_grams,jury_score,quality_band,equipment_codes,options,status,selected_route) VALUES($1,$2,624.2,9,'signature',ARRAY[]::TEXT[],'[]','stocked','raw')", [lots[0], owner]);
      await db.query("INSERT INTO kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES($1,$2,'raw',6242,0)", [lots[0], owner]);
      await db.query("INSERT INTO kq_commerce_stock(id,flower_id,user_id,route,initial_units,remaining_units,equivalent_units,base_unit_cents) VALUES($1,$2,$3,'raw',6242,5992,6242,180)", [preparedStock, lots[0], owner]);
      await db.query("INSERT INTO kq_online_listings(user_id,stock_id,format_grams,packaging_code,packet_price_cents,initial_packets,remaining_packets,packaging_cost_cents,packed_quality,status) VALUES($1,$2,5,'kraft-5',1000,5,5,125,9,'paused')", [owner, preparedStock]);
      for (const [index, code, units] of [[0, "CVAULT-1LB", 5992], [1, "GROVE-1LB", 5224]]) {
        await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{capacity}',$2) WHERE flower_id=$1", [lots[index],
          { totalUnits: units, allocations: [{ containerCode: code, quantity: 2, storedUnits: units }], overflowDeadlineAt: null, automaticOverflowSale: false }]);
      }
    }
    const starterPlan = createKqWarehouseStarter();
    await scalar("SELECT rpc_kq_warehouse_initialize($1,$2)", [owner, starterPlan]);
    const candidate = { ...starterPlan, zones: starterPlan.zones.map(zone => ({ ...zone, width: withStock ? 6 : 1 })),
      serviceZones: starterPlan.serviceZones.map(zone => zone.kind === "drying" ? { ...zone, width: withStock ? 12 : 1 }
        : { ...zone, x: 20, width: withStock ? 9 : 1, deviceCode }) };
    const quote = getKqWarehouseQuote(candidate, starterPlan);
    const layout = await scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,1,$4,$5,$6)", [owner, randomUUID(), { expectedCostCents: quote.totalCostCents }, starterPlan, quote.nextState, quote.totalCostCents]);
    return { owner, lots, pastRuns, layout, cash: layout.cashCents };
  };
  const missingDrums = await preBridgeAccount(), missingShelf = await preBridgeAccount("BROR-JARS-48", false), reserveAllocations = await preBridgeAccount();
  equal(missingDrums.layout.receipt.chargedCents > 0, true, "the regression restores an actual confirmed and charged purchase");
  equal(await scalar("SELECT count(*)::INTEGER FROM kq_storage_containers WHERE user_id=$1 AND container_code='CURTEC-60L'", [missingDrums.owner]), 0, "migration004's trigger could miss drums already paid and present on the plan");
  await db.exec(await sql("20261012000500_kq_warehouse_service_zones.sql"));
  console.log("Applied 20261012000500_kq_warehouse_service_zones.sql");
  await db.exec("BEGIN");
  equal(Number((await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [missingDrums.owner])).storageCapacityGrams), 108000, "migration005 displays paid installed capacity before repairing the missing owned pool");
  equal(Number(await scalar("SELECT kq_warehouse_pending_shortage_units($1,NULL,15000)", [missingDrums.owner])), 15710, "reproduce the reported1571g shortage despite108kg shown on the plan");
  const missingFrozen = getKqWarehouseRunSnapshot(missingDrums.layout.state, missingDrums.layout.revision);
  const brokenStart = { warehouse: missingFrozen, equipment: initial.equipment, energy: quoteKqWarehouseEnergy(missingFrozen) };
  await reject(() => db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3,'active')", [randomUUID(), missingDrums.owner, brokenStart]), "warehouse_capacity");
  await db.query("INSERT INTO kq_storage_containers(user_id,container_code,quantity) VALUES($1,'CURTEC-60L',36)", [reserveAllocations.owner]);
  const reconciliationBefore = await scalar("SELECT jsonb_build_object('wallet',w.cash_cents,'archive',l.legacy_archive,'state',l.state,'revision',l.revision,'mass',kq_warehouse_stock_units(l.user_id),'lots',(SELECT jsonb_agg(jsonb_build_object('id',flower_id,'readyAt',state->'readyAt','curingStartedAt',state->'curingStartedAt','originalUnits',original_units) ORDER BY flower_id) FROM kq_storage_lots WHERE user_id=l.user_id),'runs',(SELECT jsonb_agg(state ORDER BY id) FROM kq_runs WHERE user_id=l.user_id)) FROM kq_warehouse_layouts l JOIN kq_equipment_wallets w USING(user_id) WHERE l.user_id=$1", [missingDrums.owner]);
  const unaffectedRevision = await scalar("SELECT revision FROM kq_warehouse_layouts WHERE user_id=$1", [user]);
  await db.exec(await sql("20261012000600_kq_warehouse_reconcile_service_inventory.sql"));
  console.log("Applied 20261012000600_kq_warehouse_reconcile_service_inventory.sql");
  await db.exec("BEGIN");
  const reconciled = await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [missingDrums.owner]);
  equal(reconciled.revision, missingDrums.layout.revision + 1, "repair invalidates stale quotes exactly once");
  equal(reconciled.cashCents, reconciliationBefore.wallet, "paid devices are restored without debiting the wallet");
  equal(reconciled.state, reconciliationBefore.state, "repair preserves the authoritative paid plan");
  equal(await scalar("SELECT legacy_archive FROM kq_warehouse_layouts WHERE user_id=$1", [missingDrums.owner]), reconciliationBefore.archive, "repair preserves conversion evidence unchanged");
  equal(Number(await scalar("SELECT kq_warehouse_stock_units($1)", [missingDrums.owner])), 11466, "repair preserves1146.6g including25g of paused packets");
  equal(await scalar("SELECT jsonb_agg(jsonb_build_object('id',flower_id,'readyAt',state->'readyAt','curingStartedAt',state->'curingStartedAt','originalUnits',original_units) ORDER BY flower_id) FROM kq_storage_lots WHERE user_id=$1", [missingDrums.owner]), reconciliationBefore.lots, "repair preserves drying deadlines and original harvest quantities");
  equal(await scalar("SELECT jsonb_agg(state ORDER BY id) FROM kq_runs WHERE user_id=$1", [missingDrums.owner]), reconciliationBefore.runs, "repair never rewrites historical culture snapshots");
  equal(await scalar("SELECT quantity FROM kq_storage_containers WHERE user_id=$1 AND container_code='CURTEC-60L'", [missingDrums.owner]), 36, "all36 paid drums enter the usable pool exactly once");
  equal(await scalar("SELECT quantity FROM kq_storage_containers WHERE user_id=$1 AND container_code='GLASS-1L'", [missingDrums.owner]), 26, "restoring drums does not duplicate old jar packs");
  equal((await db.query("SELECT container_code,quantity FROM kq_storage_containers WHERE user_id=$1 AND container_code IN ('CVAULT-1LB','GROVE-1LB') ORDER BY container_code", [missingDrums.owner])).rows,
    [{ container_code: "CVAULT-1LB", quantity: 2 }, { container_code: "GROVE-1LB", quantity: 2 }], "legacy devices remain owned in reserve after rearrangement");
  equal(await scalar("SELECT array_agg(DISTINCT a->>'containerCode') FROM kq_storage_lots s,LATERAL jsonb_array_elements(s.state->'capacity'->'allocations') a WHERE s.user_id=$1", [missingDrums.owner]), ["CURTEC-60L"], "legacy CVault and Grove reservations move into the paid installed drums");
  equal(await scalar("SELECT default_method_code FROM kq_storage_accounts WHERE user_id=$1", [missingDrums.owner]), "STORAGE-GROVE", "automatic repair does not change the player's saved method preference");
  equal(Number(await scalar("SELECT kq_warehouse_pending_shortage_units($1,NULL,15000)", [missingDrums.owner])), 0, "existing lots,71g pending and1500g next harvest now fit their actual containers");
  equal(await scalar("SELECT quantity FROM kq_storage_containers WHERE user_id=$1 AND container_code='GLASS-1L'", [missingShelf.owner]), 72, "paid shelving restores its48jars plus the24paid pack jars without replaying old ownership");
  equal(await scalar("SELECT array_agg(DISTINCT a->>'containerCode') FROM kq_storage_lots s,LATERAL jsonb_array_elements(s.state->'capacity'->'allocations') a WHERE s.user_id=$1", [reserveAllocations.owner]), ["CURTEC-60L"], "off-plan allocations are repaired even when no inventory rows were missing");
  const repairedFrozen = getKqWarehouseRunSnapshot(reconciled.state, reconciled.revision);
  await db.exec("SAVEPOINT repaired_start_probe");
  await db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3,'active')", [randomUUID(), missingDrums.owner,
    { warehouse: repairedFrozen, equipment: initial.equipment, energy: quoteKqWarehouseEnergy(repairedFrozen) }]);
  equal(await scalar("SELECT count(*)::INTEGER FROM kq_runs WHERE user_id=$1 AND status='active'", [missingDrums.owner]), 1, "the formerly blocked culture can start after repair");
  await db.exec("ROLLBACK TO SAVEPOINT repaired_start_probe");
  equal(await scalar("SELECT kq_warehouse_reconcile_service_inventory($1)", [missingDrums.owner]), false, "reconciliation is a no-op when repeated");
  equal((await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [missingDrums.owner])).revision, reconciled.revision, "a repeated repair cannot invalidate quotes or change the revision again");
  equal((await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [missingDrums.owner])).cashCents, reconciliationBefore.wallet, "repeated repair still never touches money");
  equal(await scalar("SELECT revision FROM kq_warehouse_layouts WHERE user_id=$1", [user]), unaffectedRevision, "consistent historical accounts keep their existing layout revision");
  const physical = randomUUID(), physicalStarter = createKqWarehouseStarter();
  await db.query("INSERT INTO auth.users VALUES($1)", [physical]);
  await scalar("SELECT rpc_kq_commerce_state($1)", [physical]);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=10000000 WHERE user_id=$1", [physical]);
  await scalar("SELECT rpc_kq_warehouse_initialize($1,$2)", [physical, physicalStarter]);
  const readPhysical = () => scalar("SELECT rpc_kq_warehouse_snapshot($1)", [physical]);
  const savePhysical = async (candidate, current, requestKey = randomUUID()) => {
    current ??= await readPhysical();
    const quote = getKqWarehouseQuote(candidate, current.state);
    const request = { state: candidate, expectedRevision: current.revision, expectedCostCents: quote.totalCostCents };
    return scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,$4,$5,$6,$7)",
      [physical, requestKey, request, current.revision, current.state, quote.nextState, quote.totalCostCents]);
  };
  equal((await readPhysical()).state.serviceZones, physicalStarter.serviceZones, "new accounts persist their drying and storage cells");
  equal(Number((await readPhysical()).storageCapacityGrams), 1200, "four installed jar packs use one square metre");
  equal(await scalar("SELECT quantity FROM kq_storage_containers WHERE user_id=$1 AND container_code='GLASS-1L'", [physical]), 26, "four bought packs plus historical starter jars are owned once");
  let physicalStorage = await scalar("SELECT rpc_kq_warehouse_storage_state($1)", [physical]);
  equal(physicalStorage.installedContainers, { "GLASS-1L": 24 }, "unplaced starter jars do not create floor capacity");
  equal(physicalStorage.capacity.totalUnits, 12000, "storage API exposes installed capacity in commerce units");
  const snapshotBeforeMove = getKqWarehouseRunSnapshot(physicalStarter, 1);
  const serviceRun = { warehouse: snapshotBeforeMove, equipment: initial.equipment, energy: quoteKqWarehouseEnergy(snapshotBeforeMove) };
  await reject(() => db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3,'active')",
    [randomUUID(), physical, { ...serviceRun, warehouse: { ...snapshotBeforeMove, dryingCapacityGrams: 5000 } }]), "warehouse_layout_changed");
  const physicalRun = randomUUID();
  await db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3,'active')", [physicalRun, physical, serviceRun]);
  await reject(() => savePhysical({ ...physicalStarter, serviceZones: physicalStarter.serviceZones.map(zone => ({ ...zone, x: zone.x + 5 })) }), "warehouse_active_run");
  await db.query("UPDATE kq_runs SET state=state||'{\"harvestGrams\":250}',status='completed',completed_at=now() WHERE id=$1", [physicalRun]);
  const physicalFlower = randomUUID();
  await db.query("INSERT INTO kq_flowers(id,owner_id,run_id,status,burned_at) VALUES($1,$2,$3,'burned',now())", [physicalFlower, physical, physicalRun]);
  await scalar("SELECT kq_storage_create_lot($1)", [physicalFlower]);
  const preservedLot = await scalar("SELECT state FROM kq_storage_lots WHERE flower_id=$1", [physicalFlower]);
  equal(preservedLot.capacity.allocations, [{ containerCode: "GLASS-1L", quantity: 5, storedUnits: 2500 }], "new harvest reserves only installed jars");
  await reject(() => savePhysical({ ...physicalStarter, serviceZones: physicalStarter.serviceZones.filter(zone => zone.kind !== "drying") }), "warehouse_service_capacity_in_use");
  await reject(() => savePhysical({ ...physicalStarter, serviceZones: physicalStarter.serviceZones.filter(zone => zone.kind !== "storage") }), "warehouse_service_capacity_in_use");
  const removedServiceField = { ...physicalStarter }; delete removedServiceField.serviceZones;
  await reject(() => scalar("SELECT rpc_kq_warehouse_save($1,$2,'{\"expectedCostCents\":0}',1,$3,$4,0)", [physical, randomUUID(), physicalStarter, removedServiceField]), "warehouse_service_plan_required");
  const moved = await savePhysical({ ...physicalStarter, serviceZones: physicalStarter.serviceZones.map(zone => ({ ...zone, x: zone.x + 5 })) });
  equal(moved.receipt.chargedCents, 0, "moving existing service equipment is free");
  equal(await scalar("SELECT quantity FROM kq_storage_containers WHERE user_id=$1 AND container_code='GLASS-1L'", [physical]), 26, "moving zones does not duplicate owned containers");
  equal(await scalar("SELECT state->'warehouse' FROM kq_runs WHERE id=$1", [physicalRun]), snapshotBeforeMove, "a new physical plan never rewrites a completed run snapshot");
  const converted = await savePhysical({ ...moved.state, serviceZones: moved.state.serviceZones.map(zone => zone.kind === "storage" ? { ...zone, deviceCode: "CURTEC-60L" } : zone) });
  equal(Number(converted.storageCapacityGrams), 12000, "four installed sixty-litre drums give twelve kilograms of game capacity");
  equal(converted.receipt.investmentCents, 39330, "only new drums plus their fifteen-percent installation are charged during a swap");
  equal(await scalar("SELECT quantity FROM kq_storage_containers WHERE user_id=$1 AND container_code='CURTEC-60L'", [physical]), 4, "drums enter the canonical owned pool exactly once");
  const repackedLot = await scalar("SELECT state FROM kq_storage_lots WHERE flower_id=$1", [physicalFlower]);
  equal(repackedLot.capacity.allocations, [{ containerCode: "CURTEC-60L", quantity: 1, storedUnits: 2500 }], "changing device types repacks existing mass into installed equipment");
  equal([repackedLot.readyAt, repackedLot.curingStartedAt, repackedLot.exposure], [preservedLot.readyAt, preservedLot.curingStartedAt, preservedLot.exposure], "repacking preserves chronology and accrued exposure");
  physicalStorage = await scalar("SELECT rpc_kq_warehouse_storage_state($1)", [physical]);
  equal(physicalStorage.installedContainers, { "GLASS-1L": 0, "CURTEC-60L": 4 }, "owned jars in reserve no longer remain operational");
  equal(physicalStorage.capacity.reservedUnits, 30000, "one partially filled drum reserves its whole volume");
  await reject(() => scalar("SELECT rpc_kq_storage_capacity_command($1,'buy',NULL,'CANNATROL',1,NULL,$2)", [physical, randomUUID()]), "warehouse_storage_purchase");
  const shelf = await savePhysical({ ...converted.state, serviceZones: converted.state.serviceZones.map(zone => zone.kind === "storage" ? { ...zone, deviceCode: "BROR-JARS-48" } : zone) });
  equal(Number(shelf.storageCapacityGrams), 2400, "one shelving module installs exactly forty-eight jars");
  equal(await scalar("SELECT quantity FROM kq_storage_containers WHERE user_id=$1 AND container_code='GLASS-1L'", [physical]), 74, "shelving adds its own forty-eight jars without recounting prior packs");
  equal(await scalar("SELECT state->'capacity'->'allocations' FROM kq_storage_lots WHERE flower_id=$1", [physicalFlower]), [{ containerCode: "GLASS-1L", quantity: 5, storedUnits: 2500 }], "shelf swap replaces drum reservations without losing mass");
  const newPhysicalLot = async (grams = 50, burned = true) => {
    const layout = await readPhysical(), frozen = getKqWarehouseRunSnapshot(layout.state, layout.revision), cycle = randomUUID(), lot = randomUUID();
    const state = { warehouse: frozen, equipment: initial.equipment, energy: quoteKqWarehouseEnergy(frozen) };
    await db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3,'active')", [cycle, physical, state]);
    await db.query("UPDATE kq_runs SET state=state||jsonb_build_object('harvestGrams',$2::INTEGER),status='completed',completed_at=now() WHERE id=$1", [cycle, grams]);
    await db.query("INSERT INTO kq_flowers(id,owner_id,run_id,status,burned_at) VALUES($1,$2,$3,$4,CASE WHEN $4='burned' THEN now() END)", [lot, physical, cycle, burned ? "burned" : "available"]);
    if (burned) await scalar("SELECT kq_storage_create_lot($1)", [lot]);
    return lot;
  };
  await newPhysicalLot(); await newPhysicalLot();
  const pendingPhysicalLot = await newPhysicalLot(50, false);
  await db.exec("SAVEPOINT physical_pending_probe");
  await newPhysicalLot(50, false);
  const toDrums = { ...shelf.state, serviceZones: shelf.state.serviceZones.map(zone => zone.kind === "storage" ? { ...zone, deviceCode: "CURTEC-60L" } : zone) };
  const cashBeforeFragmentation = await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [physical]);
  await reject(() => savePhysical(toDrums), "warehouse_service_capacity_in_use");
  equal((await readPhysical()).revision, shelf.revision, "five distinct harvests cannot be promised four drums, even with ample mass capacity");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [physical]), cashBeforeFragmentation, "failed prospective reservations roll back every purchase and debit");
  await db.exec("ROLLBACK TO SAVEPOINT physical_pending_probe");
  const drumsWithPending = await savePhysical(toDrums);
  equal(Number(await scalar("SELECT kq_warehouse_pending_shortage_units($1)", [physical])), 0, "one pending harvest reserves the fourth whole drum");
  const frozenPending = getKqWarehouseRunSnapshot(drumsWithPending.state, drumsWithPending.revision);
  const statePending = { warehouse: frozenPending, equipment: initial.equipment, energy: quoteKqWarehouseEnergy(frozenPending) };
  await reject(() => db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3,'active')", [randomUUID(), physical, statePending]), "warehouse_capacity");
  equal(Number(await scalar("SELECT kq_warehouse_pending_shortage_units($1,NULL,2500)", [physical])), 30000, "a new harvest cannot share the same partly filled future drum");
  const beforeRenameRevision = await scalar("SELECT revision FROM kq_storage_lots WHERE flower_id=$1", [physicalFlower]);
  await savePhysical({ ...drumsWithPending.state, serviceZones: drumsWithPending.state.serviceZones.map(zone => ({ ...zone, name: `${zone.name} déplacé`, x: zone.x + 3 })) });
  equal(await scalar("SELECT revision FROM kq_storage_lots WHERE flower_id=$1", [physicalFlower]), beforeRenameRevision, "renaming or moving unchanged service devices does not repack stock or invalidate its offers");
  equal(Number((await readPhysical()).storageReservedGrams), 9000, "overview exposes three entire reserved drums while the mass remains separate");
  equal(Number((await readPhysical()).stockGrams), 350, "reserved volume never inflates actual harvested mass");
  await db.query("UPDATE kq_flowers SET status='burned',burned_at=now() WHERE id=$1", [pendingPhysicalLot]);
  await scalar("SELECT kq_storage_create_lot($1)", [pendingPhysicalLot]);
  equal(Number((await readPhysical()).storageReservedGrams), 12000, "the last pending harvest eventually reserves the fourth drum");
  // No automatic adoption for existing paid stock or future harvests.
  const convertOld = async (pending = false) => {
    const owner = randomUUID(), cycle = randomUUID(), lot = randomUUID();
    await db.query("INSERT INTO auth.users VALUES($1)", [owner]);
    await scalar("SELECT rpc_kq_commerce_state($1)", [owner]);
    await db.query("INSERT INTO kq_runs(id,user_id,state,status,completed_at) VALUES($1,$2,'{\"harvestGrams\":50}','completed',now())", [cycle, owner]);
    await db.query("INSERT INTO kq_flowers(id,owner_id,run_id,status,burned_at) VALUES($1,$2,$3,$4,CASE WHEN $4='burned' THEN now() END)", [lot, owner, cycle, pending ? "available" : "burned"]);
    if (!pending) await scalar("SELECT kq_storage_create_lot($1)", [lot]);
    return { owner, snapshot: await scalar("SELECT rpc_kq_warehouse_initialize($1,$2)", [owner, physicalStarter]) };
  };
  const existingStock = await convertOld();
  equal(Object.hasOwn(existingStock.snapshot.state, "serviceZones"), false, "historical stock keeps its old capacity until explicit plan adoption");
  equal(Object.hasOwn((await convertOld(true)).snapshot.state, "serviceZones"), false, "harvests waiting for a verdict also defer physical adoption");
  const historicalState = existingStock.snapshot.state;
  const increasedHistorical = { ...historicalState, equipment: historicalState.equipment.map(item => item.code === "LP-SUPER-1L" ? { ...item, quantity: item.quantity + 1 } : item) };
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=10000 WHERE user_id=$1", [existingStock.owner]);
  const previousServerQuote = historicalQuote(increasedHistorical, historicalState);
  const updatedHistorical = await scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,1,$4,$5,$6)", [existingStock.owner, randomUUID(), { expectedCostCents: previousServerQuote.totalCostCents }, historicalState, previousServerQuote.nextState, previousServerQuote.totalCostCents]);
  equal(updatedHistorical.receipt.chargedCents, previousServerQuote.totalCostCents, "older servers retain their pre-adoption layout purchase contract during deployment");
  equal((await scalar("SELECT rpc_kq_storage_capacity_command($1,'buy',NULL,'GLASS-1L',1,NULL,$2)", [existingStock.owner, randomUUID()])).replayed, false, "legacy plans can still buy containers before adopting physical service zones");
  const adoptionQuote = getKqWarehouseQuote({ ...updatedHistorical.state, serviceZones: physicalStarter.serviceZones }, updatedHistorical.state);
  const adoption = await scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,2,$4,$5,$6)", [existingStock.owner, randomUUID(), { expectedCostCents: adoptionQuote.totalCostCents }, updatedHistorical.state, adoptionQuote.nextState, adoptionQuote.totalCostCents]);
  equal(Number(adoption.storageCapacityGrams), 1200, "explicit first adoption installs the existing reserve without granting duplicate capacity");
  equal(await scalar("SELECT quantity FROM kq_storage_containers WHERE user_id=$1 AND container_code='GLASS-1L'", [existingStock.owner]), 33, "adopting existing packs does not credit jars a second time or discard legacy purchases");
  await reject(() => scalar("SELECT rpc_kq_storage_capacity_command($1,'select-default','STORAGE-CANNATROL',NULL,NULL,NULL,$2)", [physical, randomUUID()]), "warehouse_storage_method_not_installed");
  await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb(now()-interval '1 hour')) WHERE user_id=$1", [physical]);
  await db.query("INSERT INTO kq_market_lots(flower_id,owner_id,harvest_grams,jury_score,quality_band,equipment_codes,options,status,selected_route) VALUES($1,$2,250,9,'signature',ARRAY[]::TEXT[],'[]','stocked','raw')", [physicalFlower, physical]);
  await db.query("INSERT INTO kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES($1,$2,'raw',2500,0)", [physicalFlower, physical]);
  const physicalStock = randomUUID();
  await db.query("INSERT INTO kq_commerce_stock(id,flower_id,user_id,route,initial_units,remaining_units,equivalent_units,base_unit_cents) VALUES($1,$2,$3,'raw',2500,2500,2500,180)", [physicalStock, physicalFlower, physical]);
  const physicalOnline = (action, payload) => scalar("SELECT rpc_kq_online_command($1,$2,$3,$4)", [physical, action, payload, randomUUID()]);
  await db.query("UPDATE kq_commerce_accounts SET computer_owned=true WHERE user_id=$1", [physical]);
  await physicalOnline("upgrade-site", { tier: "basic", name: "Physical storage" });
  await physicalOnline("buy-packaging", { code: "kraft-5", quantity: 50 });
  const physicalListing = await physicalOnline("create-listing", { stockId: physicalStock, formatGrams: 5, packagingCode: "kraft-5", packets: 50, packetPriceCents: 1000 });
  await physicalOnline("close-listing", { listingId: physicalListing.listingId });
  equal(await scalar("SELECT remaining_units FROM kq_commerce_stock WHERE id=$1", [physicalStock]), 0, "the packed flower no longer remains duplicated in loose stock");
  equal(Number((await readPhysical()).stockGrams), 400, "paused unsold packets retain their full physical mass");
  equal(Number((await readPhysical()).storageReservedGrams), 9250, "three whole drums and packaged stock share the same floor budget");
  equal(Number(await scalar("SELECT kq_warehouse_pending_shortage_units($1,NULL,2500)", [physical])), 2500, "packets prevent installing an additional whole drum beyond the shared floor budget");
  const packedLayout = await readPhysical();
  await reject(() => savePhysical({ ...packedLayout.state, serviceZones: packedLayout.state.serviceZones.filter(zone => zone.kind !== "storage") }), "warehouse_service_capacity_in_use");
  const jarsAgain = await savePhysical({ ...packedLayout.state, serviceZones: packedLayout.state.serviceZones.map(zone => zone.kind === "storage" ? { ...zone, deviceCode: "LP-SUPER-1L" } : zone) });
  equal(jarsAgain.receipt.chargedCents, 0, "reinstalling owned packs costs nothing and compacts smaller lots safely");
  equal(Number(jarsAgain.storageReservedGrams), 400, "repacking counts the three jar lots plus existing packets exactly once");
  equal(Number(jarsAgain.storageCapacityGrams), 1200, "reserve drums and spare shelf jars no longer increase installed capacity");
  const servicesValid = jarsAgain.state.serviceZones;
  const rawSave = next => scalar("SELECT rpc_kq_warehouse_save($1,$2,'{\"expectedCostCents\":0}',$3,$4,$5,0)", [physical, randomUUID(), jarsAgain.revision, jarsAgain.state, next]);
  await reject(() => rawSave({ ...jarsAgain.state, serviceZones: servicesValid.map(zone => ({ ...zone, x: 0, y: 0 })) }), "warehouse_service_layout_invalid");
  await reject(() => rawSave({ ...jarsAgain.state, serviceZones: servicesValid.map(zone => zone.kind === "drying" ? { ...zone, width: 2 } : zone) }), "warehouse_service_equipment_missing");
  const compatibility = await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [retainedWorkshop]);
  equal(Object.hasOwn(compatibility.state, "serviceZones"), false, "migration005 does not silently upgrade existing plans");
  equal(Number(compatibility.storageCapacityGrams), Number(await scalar("SELECT sum(quantity::NUMERIC*(kq_storage_container(container_code)->>'capacityUnits')::NUMERIC)/10 FROM kq_storage_containers WHERE user_id=$1", [retainedWorkshop])), "old plans retain exactly their previous owned-container capacity");
  const unconverted = randomUUID(), oldStorageReceipt = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [unconverted]);
  await scalar("SELECT rpc_kq_commerce_state($1)", [unconverted]);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=10000 WHERE user_id=$1", [unconverted]);
  const replayOldStoragePurchase = () => scalar("SELECT rpc_kq_storage_capacity_command($1,'buy',NULL,'GLASS-1L',1,NULL,$2)", [unconverted, oldStorageReceipt]);
  equal((await replayOldStoragePurchase()).replayed, false, "players without any layout retain the legacy storage purchase API");
  await scalar("SELECT rpc_kq_warehouse_initialize($1,$2)", [unconverted, physicalStarter]);
  const cashAfterOldPurchase = await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [unconverted]);
  equal((await replayOldStoragePurchase()).replayed, true, "pre-adoption storage receipts still replay after purchases move to the plan");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [unconverted]), cashAfterOldPurchase, "replaying an old purchase cannot charge it twice");
  await db.exec("SAVEPOINT conservative_mixed_fixture");
  const mixed = await savePhysical({ ...jarsAgain.state, serviceZones: [...jarsAgain.state.serviceZones,
    { id: "bulk-drums", name: "Fûts", x: 15, y: 24, width: 1, height: 1, kind: "storage", deviceCode: "CURTEC-60L" }] });
  await newPhysicalLot(101, false);
  // Isolate two free drums and two free jars using historical reservation rows.
  // A chronological or ascending simulation wrongly accepts 101 g + 3,051 g:
  // the larger verdict first consumes both drums, leaving 1 g unprotected.
  await db.query("UPDATE kq_online_listings SET remaining_packets=0 WHERE user_id=$1", [physical]);
  await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{capacity,allocations}','[]'::JSONB) WHERE user_id=$1", [physical]);
  await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{capacity,allocations}',$2) WHERE flower_id=$1", [physicalFlower,
    [{ containerCode: "CURTEC-60L", quantity: 2, storedUnits: 60000 }, { containerCode: "GLASS-1L", quantity: 22, storedUnits: 11000 }]]);
  equal(Number(await scalar("SELECT kq_warehouse_pending_shortage_units($1,NULL,30510)", [physical])), 30000, "independent traces reject an order-sensitive promise of the same drum to two harvests");
  equal(Number(await scalar("SELECT kq_warehouse_pending_shortage_units($1,NULL,30000)", [physical])), 0, "separate one-drum traces fit safely regardless of which verdict arrives first");
  equal(mixed.state.serviceZones.length, 3, "mixed storage devices still occupy distinct physical cells");
  await db.exec("ROLLBACK TO SAVEPOINT conservative_mixed_fixture");
  // Supplier terms are prospective. Keep every preceding regression on the
  // exact 001–006 cash-upfront behavior, then install the corrective migration.
  await db.exec("COMMIT");
  const treasurySource = await sql("20260921000200_kq_treasury_accounting.sql");
  await db.exec(treasurySource.slice(treasurySource.indexOf("CREATE TABLE public.kq_treasury_accounts"), treasurySource.indexOf("CREATE FUNCTION public.kq_treasury_post")));
  await db.exec(await definition("20260921000200_kq_treasury_accounting.sql", "kq_treasury_post"));
  await db.exec("DROP FUNCTION kq_treasury_pair(UUID,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT,BIGINT,TEXT)");
  await db.exec(await definition("20260921000200_kq_treasury_accounting.sql", "kq_treasury_pair"));
  // The dedicated treasury runner covers real opening balances and every cash
  // observer; here use its actual journal writer while opening a bare account.
  await db.exec("CREATE OR REPLACE FUNCTION kq_treasury_initialize(UUID) RETURNS VOID LANGUAGE sql AS 'INSERT INTO kq_treasury_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING'");
  await db.exec(await definition("20260923000800_kq_stock_market.sql", "kq_treasury_balances_at"));
  await db.exec(await definition("20260923000800_kq_stock_market.sql", "rpc_kq_treasury_snapshot"));
  await db.exec(await definition("20261001000200_kq_tent_equipment_and_shared_workshop.sql", "rpc_kq_energy_snapshot"));
  await db.exec(await sql("20261012000700_kq_warehouse_supplier_invoices.sql"));
  console.log("Applied 20261012000700_kq_warehouse_supplier_invoices.sql");
  await db.exec(await sql("20261012000800_kq_warehouse_simulation_options.sql"));
  console.log("Applied 20261012000800_kq_warehouse_simulation_options.sql");
  await db.exec("BEGIN");
  equal(Number(await scalar("SELECT count(*) FROM kq_supplier_invoices")), 0, "migration never invoices old warehouse campaigns retroactively");
  const creditOwner = randomUUID(), creditRun = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [creditOwner]);
  await scalar("SELECT rpc_kq_commerce_state($1)", [creditOwner]);
  const creditLayout = await scalar("SELECT rpc_kq_warehouse_initialize($1,$2)", [creditOwner, physicalStarter]);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1", [creditOwner]);
  const creditFrozen = getKqWarehouseRunSnapshot(creditLayout.state, creditLayout.revision);
  const creditState = { warehouse: creditFrozen, equipment: initial.equipment, energy: quoteKqWarehouseEnergy(creditFrozen) };
  const creditStart = (runId = randomUUID(), runState = creditState) => db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3,'active')", [runId, creditOwner, runState]);
  await reject(() => creditStart(randomUUID(), { ...creditState, warehouse: { ...creditFrozen, revision: 99 } }), "warehouse_layout_changed");
  equal(Number(await scalar("SELECT count(*) FROM kq_supplier_invoices WHERE user_id=$1", [creditOwner])), 0, "failed startup cannot issue a supplier bill");
  await creditStart(creditRun);
  const creditInvoice = () => scalar("SELECT to_jsonb(i) FROM kq_supplier_invoices i WHERE run_id=$1", [creditRun]);
  const issued = await creditInvoice();
  equal(issued.amount_cents, creditFrozen.consumablesCostCents, "zero-cash startup invoices exactly the immutable consumables quote");
  equal(issued.remaining_cents, issued.amount_cents, "the entire delivered input cost becomes a payable");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [creditOwner]), 0, "startup does not debit cash or create a negative wallet");
  equal(new Date(issued.due_at) - new Date(issued.issued_at), 120 * 3600000, "payment term is thirty four-hour game days");
  equal((await scalar("SELECT rpc_kq_energy_snapshot($1)", [creditOwner])).supplierInvoice.runId, creditRun, "active culture energy panel identifies its supplier bill without rewriting the run");
  await reject(() => creditStart(creditRun), "duplicate key");
  equal(Number(await scalar("SELECT count(*) FROM kq_supplier_invoices WHERE run_id=$1", [creditRun])), 1, "run retry cannot duplicate the invoice");
  await db.query("UPDATE kq_runs SET status='abandoned' WHERE id=$1", [creditRun]);
  equal((await creditInvoice()).remaining_cents, issued.amount_cents, "abandoning a campaign does not cancel already delivered inputs");
  equal((await scalar("SELECT rpc_kq_energy_snapshot($1)", [creditOwner])).supplierInvoice, null, "there is no misleading current invoice after campaign abandonment");
  const nextCreditRun = randomUUID();
  await creditStart(nextCreditRun);
  await db.query("UPDATE kq_runs SET status='abandoned' WHERE id=$1", [nextCreditRun]);
  equal(Number(await scalar("SELECT count(*) FROM kq_supplier_invoices WHERE user_id=$1", [creditOwner])), 2, "outstanding supplier debt never prevents the next culture");
  equal(Number(await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='expense_other'", [creditOwner])), issued.amount_cents * 2, "each delivered cycle records its full consumables expense once");
  const freshAccount = async () => {
    const owner = randomUUID();
    await db.query("INSERT INTO auth.users VALUES($1)", [owner]);
    await scalar("SELECT rpc_kq_commerce_state($1)", [owner]);
    return owner;
  };
  const bill = async (owner, amount, issuedAt, dueAt) => {
    const cycle = randomUUID();
    await db.query("INSERT INTO kq_runs(id,user_id,state,status,completed_at) VALUES($1,$2,'{}','completed',now())", [cycle, owner]);
    return scalar("INSERT INTO kq_supplier_invoices(run_id,user_id,amount_cents,remaining_cents,issued_at,due_at) VALUES($1,$2,$3,$3,$4,$5) RETURNING id", [cycle, owner, amount, issuedAt, dueAt]);
  };
  const clockNow = new Date(await scalar("SELECT now()"));
  const ago = hours => new Date(+clockNow - hours * 3600000).toISOString();
  const dueOwner = await freshAccount();
  const dueBill = await bill(dueOwner, 2200, ago(121), ago(1));
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=700 WHERE user_id=$1", [dueOwner]);
  await db.query("UPDATE kq_online_accounts SET settled_until=$2 WHERE user_id=$1", [dueOwner, ago(2)]);
  await scalar("SELECT kq_online_settle_until($1,$2)", [dueOwner, ago(1.001)]);
  equal(await scalar("SELECT remaining_cents FROM kq_supplier_invoices WHERE id=$1", [dueBill]), 2200, "historical catch-up cannot collect before the due instant");
  await scalar("SELECT kq_online_settle_until($1,$2)", [dueOwner, ago(1)]);
  equal(await scalar("SELECT remaining_cents FROM kq_supplier_invoices WHERE id=$1", [dueBill]), 1500, "the exact due instant collects available cash partially");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [dueOwner]), 0, "partial deadline collection cannot overdraft the wallet");
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=400 WHERE user_id=$1", [dueOwner]);
  await scalar("SELECT kq_online_settle_until($1,now())", [dueOwner]);
  await scalar("SELECT kq_online_settle_until($1,now())", [dueOwner]);
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [dueOwner]), 400, "subsequent polling does not repeatedly drain new cash for an already processed deadline");
  equal(Number((await scalar("SELECT kq_business_snapshot($1)", [dueOwner])).suppliers.overdueCents), 1500, "business snapshot exposes the unpaid overdue balance");
  const preview = await scalar("SELECT kq_business_sale_preview($1,1200)", [dueOwner]);
  equal(preview, { vatCents: 200, labPaidCents: 0, electricityPaidCents: 0, supplierPaidCents: 500, netPayoutCents: 500 }, "supplier payment shares the fifty-percent budget after VAT");
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=cash_cents+1200 WHERE user_id=$1", [dueOwner]);
  equal(await scalar("SELECT kq_business_collect_sale($1,1200)", [dueOwner]), preview, "server settlement matches the supplier sale preview");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [dueOwner]), 900, "half of net sale proceeds remains available to play");
  const manualKey = randomUUID();
  const manual = () => scalar("SELECT rpc_kq_commerce_command($1,'pay-supplier',$2,$3)", [dueOwner, { invoiceId: dueBill, amountCents: 1 }, manualKey]);
  await reject(manual, "commerce_supplier_cash");
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=2000 WHERE user_id=$1", [dueOwner]);
  const paidManual = await manual();
  equal(paidManual.paidCents, 1000, "manual payment ignores an invented client amount and settles the real remainder");
  await manual();
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [dueOwner]), 1000, "replaying the manual command never pays twice");
  equal(await scalar("SELECT remaining_cents FROM kq_supplier_invoices WHERE id=$1", [dueBill]), 0, "manual settlement clears the supplier debt");
  const onlineDebtOwner = await freshAccount();
  const historicalBill = await bill(onlineDebtOwner, 10000, ago(121), ago(1));
  equal((await scalar("SELECT kq_online_collect($1,1200,$2)", [onlineDebtOwner, ago(2)])).supplierPaidCents, 0, "old online orders do not repay invoices that were not due at their sale time");
  const onlineCharges = await scalar("SELECT kq_online_collect($1,1200,$2)", [onlineDebtOwner, ago(0.5)]);
  equal(onlineCharges, { vatCents: 200, feesCents: 30, labPaidCents: 0, electricityPaidCents: 0, supplierPaidCents: 485, netPayoutCents: 485 }, "online fees and VAT are removed before the shared debt budget");
  equal(await scalar("SELECT last_paid_at=$2::timestamptz FROM kq_supplier_invoices WHERE id=$1", [historicalBill, ago(0.5)]), true, "supplier accounting retains the actual historical sale timestamp");
  const priorityOwner = await freshAccount();
  const prioritySupplier = await bill(priorityOwner, 2200, ago(121), ago(1));
  const priorityRun = randomUUID();
  await db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,'{}','completed')", [priorityRun, priorityOwner]);
  await db.query("INSERT INTO kq_lab_invoices(run_id,user_id,remaining_cents,issued_at,due_at) VALUES($1,$2,100,$3,$4)", [priorityRun, priorityOwner, ago(121), ago(1)]);
  await db.query("INSERT INTO kq_energy_invoices(run_id,user_id,total_cents,remaining_cents,harvest_grams,quote,created_at) VALUES($1,$2,200,200,0,'{}',$3)", [priorityRun, priorityOwner, ago(1)]);
  const priority = await scalar("SELECT kq_online_collect($1,1200,now())", [priorityOwner]);
  equal([priority.labPaidCents, priority.electricityPaidCents, priority.supplierPaidCents, priority.netPayoutCents], [100, 200, 185, 485], "laboratory, energy and supplier share one collection limit in that order");
  equal(await scalar("SELECT remaining_cents FROM kq_supplier_invoices WHERE id=$1", [prioritySupplier]), 2015, "supplier receives only the budget left after earlier debts");
  // Use the established online player's real listing/stock setup, then compare
  // one long catch-up with many reads crossing the same supplier deadline.
  const playerSourceStart = online.indexOf(" async function player() {");
  const playerSourceEnd = online.indexOf(" const p=await player();", playerSourceStart);
  assert(playerSourceStart >= 0 && playerSourceEnd > playerSourceStart, "online player fixture markers changed");
  const supplierOnlineCommand = (owner, action, payload = {}) => scalar("SELECT rpc_kq_online_command($1,$2,$3,$4)", [owner, action, payload, randomUUID()]);
  const makeOnlinePlayer = new AsyncFunction("db", "randomUUID", "state", "command", `${online.slice(playerSourceStart, playerSourceEnd)}\nreturn player();`);
  const prepareSupplierTimeline = async () => {
    const account = await makeOnlinePlayer(db, randomUUID, async owner => {
      const current = await scalar("SELECT rpc_kq_online_state($1)", [owner]);
      await scalar("SELECT kq_treasury_initialize($1)", [owner]);
      return current;
    }, supplierOnlineCommand);
    await supplierOnlineCommand(account.user, "buy-packaging", { code: "kraft-5", quantity: 20 });
    await supplierOnlineCommand(account.user, "create-listing", { stockId: account.stock, formatGrams: 5, packagingCode: "kraft-5", packets: 20, packetPriceCents: 1000 });
    account.invoice = await bill(account.user, 100000, ago(250), ago(130));
    await db.query("UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1", [account.user]);
    await db.query("UPDATE kq_online_accounts SET settled_until=$2,growth_day=$2::timestamptz::date,clients_start=15 WHERE user_id=$1", [account.user, ago(200)]);
    await db.query("UPDATE kq_online_listings SET created_at=$2,changed_at=$2 WHERE user_id=$1", [account.user, ago(200)]);
    await db.query("UPDATE kq_commerce_accounts SET shop_created_at=$2,business_started_at=$2,demand_updated_at=$2,clients=15 WHERE user_id=$1", [account.user, ago(200)]);
    return account;
  };
  const supplierBatch = await prepareSupplierTimeline(), supplierFrequent = await prepareSupplierTimeline();
  for (let hours = 193; hours > 0; hours -= 7) await scalar("SELECT kq_online_settle_until($1,$2)", [supplierFrequent.user, ago(hours)]);
  for (const account of [supplierBatch, supplierFrequent]) await scalar("SELECT kq_online_settle_until($1,now())", [account.user]);
  const timelineFacts = owner => db.query("SELECT packet_number,occurred_at,payout_cents,vat_cents,fee_cents,lab_paid_cents,electricity_paid_cents,supplier_paid_cents,net_payout_cents FROM kq_online_sales WHERE user_id=$1 ORDER BY packet_number", [owner]).then(result => result.rows);
  equal(await timelineFacts(supplierBatch.user), await timelineFacts(supplierFrequent.user), "supplier settlement and actual online receipts are independent of polling frequency");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [supplierBatch.user]), await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [supplierFrequent.user]), "fragmented online catch-up leaves exactly the same playable cash");
  equal(await scalar("SELECT remaining_cents FROM kq_supplier_invoices WHERE id=$1", [supplierBatch.invoice]), await scalar("SELECT remaining_cents FROM kq_supplier_invoices WHERE id=$1", [supplierFrequent.invoice]), "fragmented online catch-up leaves exactly the same supplier balance");
  equal(await scalar("SELECT bool_and(supplier_paid_cents=0) FROM kq_online_sales WHERE user_id=$1 AND occurred_at<$2", [supplierBatch.user, ago(130)]), true, "actual dispatched orders never collect a future supplier deadline");
  equal(await scalar("SELECT bool_or(supplier_paid_cents>0) FROM kq_online_sales WHERE user_id=$1 AND occurred_at>=$2", [supplierBatch.user, ago(130)]), true, "orders after the partial deadline payment repay the supplier progressively");
  equal(await scalar("SELECT bool_and(lab_paid_cents+electricity_paid_cents+supplier_paid_cents<=floor((payout_cents-vat_cents-fee_cents)/2.0)) FROM kq_online_sales WHERE user_id=$1", [supplierBatch.user]), true, "every dispatched order respects the common half-net collection cap");
  equal(await scalar("SELECT count(*)::integer FROM kq_market_sale_receipts WHERE owner_id=$1 AND supplier_paid_cents>0", [supplierBatch.user]), (await timelineFacts(supplierBatch.user)).filter(sale => sale.supplier_paid_cents > 0).length, "historical market receipts preserve the actual supplier amount collected online");
  equal((await scalar("SELECT kq_business_snapshot($1)", [dueOwner])).suppliers.invoices.some(invoice => invoice.id === dueBill && invoice.remainingCents === 0), true, "recent paid invoices remain visible alongside current debts");
  equal(await scalar("SELECT has_table_privilege('service_role','kq_supplier_invoices','SELECT')"), false, "supplier invoices stay private behind controlled RPCs");
  const { KQ_WAREHOUSE_OPTIONS } = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse-options.ts");
  for (const option of KQ_WAREHOUSE_OPTIONS) {
    equal(await scalar("SELECT kq_warehouse_option($1)", [option.code]), {
      code: option.code, family: option.family, equipmentCentsPerM2: option.equipmentCentsPerM2,
      consumablesCentsPerM2: option.consumablesCentsPerM2, yieldBonusPercent: option.yieldBonusPercent, qualityBonus: option.qualityBonus,
    }, `SQL and server game catalogue agree on ${option.code}`);
  }
  const moduleOwner = await freshAccount();
  const moduleOriginal = await scalar("SELECT rpc_kq_warehouse_initialize($1,$2)", [moduleOwner, physicalStarter]);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=1000000 WHERE user_id=$1", [moduleOwner]);
  const moduleDraft = { ...moduleOriginal.state, zones: moduleOriginal.state.zones.map(zone => ({ ...zone, optionCodes: ["SIM-CLIMATE-03", "SIM-NUTRITION-03"] })) };
  const moduleQuote = getKqWarehouseQuote(moduleDraft, moduleOriginal.state), moduleKey = randomUUID();
  const moduleRequest = { state: moduleDraft, expectedRevision: moduleOriginal.revision, expectedCostCents: moduleQuote.totalCostCents };
  const moduleSave = () => scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,$4,$5,$6,$7)", [moduleOwner, moduleKey, moduleRequest, moduleOriginal.revision, moduleOriginal.state, moduleQuote.nextState, moduleQuote.totalCostCents]);
  await reject(() => scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,$4,$5,$6,0)", [moduleOwner, randomUUID(), { ...moduleRequest, expectedCostCents: 0 }, moduleOriginal.revision, moduleOriginal.state, moduleQuote.nextState]), "warehouse_price_changed");
  const moduleSaved = await moduleSave();
  equal(moduleSaved.cashCents, 1000000 - 6325, "fictional coverage plus installation debits the exact confirmed quote");
  equal((await moduleSave()).cashCents, moduleSaved.cashCents, "module purchase retry never duplicates payment");
  const moduleFrozen = getKqWarehouseRunSnapshot(moduleSaved.state, moduleSaved.revision);
  const projection = await scalar("SELECT kq_warehouse_options_projection($1)", [moduleSaved.state]);
  equal(projection, { activeAreaM2: 1, estimatedHarvestGrams: 257.5, consumablesCostCents: 3060, qualityBonus: 2, hasOptions: true }, "SQL derives actual game costs and bonuses from the paid plan");
  const maxProfiles = KQ_WAREHOUSE_OPTIONS.filter(option => option.code.endsWith("03")).map(option => option.code);
  const fullModules = getKqWarehouseQuote({ ...physicalStarter, serviceZones: [], zones: [{ ...physicalStarter.zones[0], width: 40, height: 25, optionCodes: maxProfiles }] }).nextState;
  const fullFrozen = getKqWarehouseRunSnapshot(fullModules);
  equal(await scalar("SELECT kq_warehouse_options_projection($1)", [fullModules]), {
    activeAreaM2: fullFrozen.activeAreaM2, estimatedHarvestGrams: fullFrozen.estimatedHarvestGrams,
    consumablesCostCents: fullFrozen.consumablesCostCents, qualityBonus: fullFrozen.qualityBonus, hasOptions: true,
  }, "full 1,000m² and stacked caps agree between SQL and game snapshot");
  const weightedModules = getKqWarehouseQuote({ ...moduleSaved.state, zones: [
    { ...moduleSaved.state.zones[0], active: false },
    { ...moduleSaved.state.zones[0], id: "active-bare", x: 5, width: 3, optionCodes: [] },
  ] }, moduleSaved.state).nextState;
  equal(await scalar("SELECT kq_warehouse_options_projection($1)", [weightedModules]), {
    activeAreaM2: 3, estimatedHarvestGrams: 750, consumablesCostCents: 6600, qualityBonus: 0, hasOptions: true,
  }, "inactive profiles stay financed without producing bonuses or recurring supplies");
  const duplicateFamily = { ...moduleSaved.state, zones: moduleSaved.state.zones.map(zone => ({ ...zone, optionCodes: ["SIM-NUTRITION-01", "SIM-NUTRITION-02"] })) };
  await reject(() => scalar("SELECT kq_warehouse_options_projection($1)", [duplicateFamily]), "warehouse_options_invalid");
  await reject(() => scalar("SELECT kq_warehouse_options_projection($1)", [{ ...moduleSaved.state, optionInventory: [] }]), "warehouse_options_missing");
  await reject(() => scalar("SELECT kq_warehouse_validate_options_change($1,$2,0)", [moduleSaved.state, { ...moduleSaved.state, optionInventory: [], zones: moduleSaved.state.zones.map(zone => ({ ...zone, optionCodes: [] })) }]), "warehouse_inventory_loss");
  const moduleRun = randomUUID();
  const moduleRunState = { warehouse: moduleFrozen, equipment: initial.equipment, energy: quoteKqWarehouseEnergy(moduleFrozen) };
  await reject(() => db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3,'active')", [randomUUID(), moduleOwner, { ...moduleRunState, warehouse: { ...moduleFrozen, qualityBonus: 4 } }]), "warehouse_layout_changed");
  await reject(() => db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3,'active')", [randomUUID(), moduleOwner, { ...moduleRunState, warehouse: { ...moduleFrozen, consumablesCostCents: 2200, operatingCostCents: moduleFrozen.energyCostCents + 2200 } }]), "warehouse_layout_changed");
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1", [moduleOwner]);
  await db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3,'active')", [moduleRun, moduleOwner, moduleRunState]);
  const moduleInvoice = await scalar("SELECT to_jsonb(i) FROM kq_supplier_invoices i WHERE run_id=$1", [moduleRun]);
  equal(moduleInvoice.amount_cents, moduleFrozen.consumablesCostCents, "the supplier invoices selected module supplies plus historical inputs exactly once");
  equal(new Date(moduleInvoice.due_at) - new Date(moduleInvoice.issued_at), 120 * 3600000, "modules preserve the exact 120-hour payment term");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [moduleOwner]), 0, "modules do not introduce an upfront cash gate for cycle supplies");
  await reject(() => db.query("UPDATE kq_runs SET state=jsonb_set(state,'{warehouse,qualityBonus}','0') WHERE id=$1", [moduleRun]), "warehouse_snapshot_immutable");
  for (const signature of ["kq_warehouse_option(text)", "kq_warehouse_options_projection(jsonb)", "kq_warehouse_validate_options_change(jsonb,jsonb,integer)", "kq_warehouse_validate_options_run(jsonb)"]) {
    equal(await scalar("SELECT has_function_privilege('service_role',$1,'EXECUTE')", [signature]), false, `${signature} stays private behind named RPCs`);
  }
  await db.exec("COMMIT");
  const preservedBeforeTiers = await scalar("SELECT jsonb_agg(jsonb_build_object('user',user_id,'state',state,'revision',revision) ORDER BY user_id) FROM kq_warehouse_layouts");
  const frozenBeforeTiers = await scalar("SELECT state FROM kq_runs WHERE id=$1", [moduleRun]);
  await db.exec(await sql("20261012000900_kq_warehouse_equipment_tiers.sql"));
  console.log("Applied 20261012000900_kq_warehouse_equipment_tiers.sql");
  await db.exec("BEGIN");
  equal(await scalar("SELECT jsonb_agg(jsonb_build_object('user',user_id,'state',state,'revision',revision) ORDER BY user_id) FROM kq_warehouse_layouts"), preservedBeforeTiers, "tier catalogue never rewrites existing ownership or plans");
  equal(await scalar("SELECT state FROM kq_runs WHERE id=$1", [moduleRun]), frozenBeforeTiers, "new tiers preserve active frozen runs exactly");
  const { KQ_WAREHOUSE_CATALOG: tierDevices } = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse-catalog.ts");
  for (const device of tierDevices) {
    const expected = { code: device.code, kind: device.kind, tier: device.tier, priceCents: device.priceCents, watts: device.watts,
      purchasable: device.purchasable !== false, gameCapacity: { unit: device.gameCapacity.unit, value: device.gameCapacity.value },
      ...(device.zoneLayout ? { zoneLayout: { unitsPerM2: device.zoneLayout.unitsPerM2, capacityGramsPerUnit: device.zoneLayout.capacityGramsPerUnit } } : {}) };
    equal(await scalar("SELECT kq_warehouse_device($1)", [device.code]), expected, `SQL exactly prices and sizes ${device.code}`);
  }
  for (const option of KQ_WAREHOUSE_OPTIONS) equal((await scalar("SELECT kq_warehouse_option($1)", [option.code])).tier, option.tier, `Module tier agrees on ${option.code}`);
  const tierOwner = await freshAccount();
  await scalar("SELECT rpc_kq_warehouse_initialize($1,$2)", [tierOwner, physicalStarter]);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=100000000 WHERE user_id=$1", [tierOwner]);
  let tierSaved = await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [tierOwner]);
  for (const device of tierDevices.filter(item => item.code.startsWith("SIM-"))) {
    const draft = { ...tierSaved.state,
      zones: tierSaved.state.zones.map(zone => ({ ...zone, x:0, y:0, width:4, height:2,
        ...(device.kind === "lighting" ? { lightingCode:device.code } : device.kind === "air" ? { airCode:device.code } : {}) })),
      serviceZones: tierSaved.state.serviceZones.map(zone => zone.kind === "drying"
        ? { ...zone, x:0, y:20, width:2, height:1, ...(device.kind === "drying" ? { deviceCode:device.code } : {}) }
        : { ...zone, x:5, y:20, width:1, height:1, deviceCode:"CURTEC-60L" }),
    };
    const quote = getKqWarehouseQuote(draft,tierSaved.state), key = randomUUID();
    const request = { state:draft,expectedRevision:tierSaved.revision,expectedCostCents:quote.totalCostCents };
    const saveTier = (cost=quote.totalCostCents,requestKey=key) => scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,$4,$5,$6,$7)",
      [tierOwner,requestKey,{...request,expectedCostCents:cost},tierSaved.revision,tierSaved.state,quote.nextState,cost]);
    await reject(() => saveTier(quote.totalCostCents-1,randomUUID()),"warehouse_price_changed");
    const before=tierSaved, after=await saveTier();
    equal(after.cashCents,before.cashCents-quote.totalCostCents,`${device.code} actually spends its confirmed price once`);
    equal((await saveTier()).receipt.replayed,true,`${device.code} purchase replay stays idempotent`);
    const snapshot=getKqWarehouseRunSnapshot(after.state,after.revision);
    equal(Number(await scalar("SELECT kq_warehouse_drying_capacity_grams($1)",[after.state])),snapshot.dryingCapacityGrams,`${device.code} drying capacity is operational in SQL`);
    const projected=await scalar("SELECT kq_warehouse_catalog_projection($1)",[after.state]);
    for(const field of ["powerWatts","energyKwh","energyCostCents"]) equal(projected[field],snapshot[field],`${device.code} ${field} matches the charged simulation`);
    await scalar("SELECT kq_warehouse_validate_catalog_run($1)",[snapshot]);
    await reject(() => scalar("SELECT kq_warehouse_validate_catalog_run($1)",[{...snapshot,energyCostCents:0}]),"warehouse_layout_changed");
    tierSaved=after;
  }
  const retiredBase={...physicalStarter,equipment:[...physicalStarter.equipment,{code:"MH-FCE3000",quantity:1}]};
  const reuseLegacy={...retiredBase,zones:retiredBase.zones.map(zone=>({...zone,lightingCode:"MH-FCE3000"}))};
  const reuseLegacyQuote=getKqWarehouseQuote(reuseLegacy,retiredBase);
  equal(reuseLegacyQuote.totalCostCents,0,"retired lamp reuse does not create a purchase or erase the previous lamp");
  await scalar("SELECT kq_warehouse_validate_catalog_change($1,$2,0)",[retiredBase,reuseLegacyQuote.nextState]);
  await reject(() => scalar("SELECT kq_warehouse_validate_catalog_change($1,$2,22885)",[physicalStarter,reuseLegacyQuote.nextState]),"warehouse_device_retired");
  const tierFrozen=getKqWarehouseRunSnapshot(tierSaved.state,tierSaved.revision), tierCycle=randomUUID();
  await db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3,'active')",[tierCycle,tierOwner,{warehouse:tierFrozen,equipment:initial.equipment,energy:quoteKqWarehouseEnergy(tierFrozen)}]);
  equal((await scalar("SELECT to_jsonb(i) FROM kq_supplier_invoices i WHERE run_id=$1",[tierCycle])).amount_cents,tierFrozen.consumablesCostCents,"a fully tiered installation really starts and bills only its simulated supplies");
  for(const signature of ["kq_warehouse_device(text)","kq_warehouse_catalog_projection(jsonb)","kq_warehouse_validate_catalog_change(jsonb,jsonb,integer)","kq_warehouse_validate_catalog_run(jsonb)"])
    equal(await scalar("SELECT has_function_privilege('service_role',$1,'EXECUTE')",[signature]),false,`${signature} stays internal`);
  await db.exec("COMMIT");
  await db.exec(await sql("20261012001000_kq_workshop_tiers.sql"));
  console.log("Applied 20261012001000_kq_workshop_tiers.sql");
  await db.exec("BEGIN");
  const prepareTierWorkshop = async (career=true,practice=true) => {
    const owner=await freshAccount();
    await seedHistoricalCultures(owner);
    if(career)await earnCareer(owner);
    if(practice)await db.query("INSERT INTO kq_chanvrier_processing_practice(user_id,flower_id,family,route,equipment_codes,occurred_at) SELECT $1,gen_random_uuid(),f,'fixture','{}',now() FROM unnest(ARRAY['washing','sifting']) f,generate_series(1,10)",[owner]);
    await db.query("UPDATE kq_equipment_wallets SET cash_cents=100000000 WHERE user_id=$1",[owner]);
    await scalar("SELECT rpc_kq_warehouse_initialize($1,$2)",[owner,physicalStarter]);
    return owner;
  };
  const buyWorkshopTier=(owner,code,target,previous,price,key=randomUUID())=>scalar("SELECT rpc_kq_purchase_workshop_tier($1,$2,$3,$4,$5,$6)",[owner,key,code,target,previous,price]);
  const tierPrice=(base,previous,target)=>{let price=previous===0?base:0;for(let level=Math.max(1,previous);level<target;level++)price+=Math.ceil(base*level/10);return price;};
  for(const code of workshopCodesAll){
    const base=await scalar("SELECT price_cents FROM kq_equipment_catalog WHERE code=$1",[code]);
    for(const target of [1,4,7]){
      const owner=await prepareTierWorkshop(), key=randomUUID(),price=tierPrice(base,0,target);
      const receipt=await buyWorkshopTier(owner,code,target,0,price,key);
      equal(receipt,{equipmentCode:code,previousLevel:0,level:target,priceCents:price,cashAfterCents:100000000-price,replayed:false},`${code} tier ${target} is an atomic direct purchase`);
      equal(await scalar("SELECT level FROM kq_player_equipment WHERE user_id=$1 AND equipment_code=$2",[owner,code]),target,"machine really reaches the selected tier");
      equal(Number(await scalar("SELECT COALESCE((SELECT sum(total_price_cents) FROM kq_equipment_purchase_receipts WHERE user_id=$1),0)+COALESCE((SELECT sum(price_cents) FROM kq_equipment_upgrade_receipts WHERE user_id=$1),0)",[owner])),price,"child receipts feeding existing accounting exactly match the debit");
      equal(await scalar("SELECT count(*)::INTEGER FROM kq_equipment_upgrade_receipts WHERE user_id=$1",[owner]),target-1,"each existing upgrade step keeps its receipt");
      equal((await buyWorkshopTier(owner,code,target,0,price,key)).replayed,true,"parent replay does not run its children again");
      await reject(()=>buyWorkshopTier(owner,code,target,0,price+1,key),"workshop_tier_request_mismatch");
    }
  }
  const evolving=await prepareTierWorkshop(),baseSift=55000;
  await buyWorkshopTier(evolving,"SIFT-TRAY",1,0,baseSift);
  await scalar("SELECT rpc_kq_upgrade_tent_equipment($1,$2,'SIFT-TRAY',1,1)",[evolving,randomUUID()]);
  await db.query("UPDATE kq_player_equipment SET wear_cycles=1,maintenance_version=9 WHERE user_id=$1 AND equipment_code='SIFT-TRAY'",[evolving]);
  const evolutionKey=randomUUID(),evolutionPrice=tierPrice(baseSift,2,4);
  await buyWorkshopTier(evolving,"SIFT-TRAY",4,2,evolutionPrice,evolutionKey);
  equal(await scalar("SELECT jsonb_build_object('wear',wear_cycles,'version',maintenance_version,'level',level) FROM kq_player_equipment WHERE user_id=$1 AND equipment_code='SIFT-TRAY'",[evolving]),{wear:1,version:9,level:4},"switching tier preserves accumulated wear and maintenance identity");
  await scalar("SELECT rpc_kq_upgrade_tent_equipment($1,$2,'SIFT-TRAY',4,1)",[evolving,randomUUID()]);
  await buyWorkshopTier(evolving,"SIFT-TRAY",7,5,tierPrice(baseSift,5,7));
  equal((await buyWorkshopTier(evolving,"SIFT-TRAY",4,2,evolutionPrice,evolutionKey)).replayed,true,"old parent replay survives later progression");
  await reject(()=>buyWorkshopTier(evolving,"SIFT-TRAY",7,5,tierPrice(baseSift,5,7)),"equipment_level_changed");
  const poorTier=await prepareTierWorkshop(), facts=owner=>scalar("SELECT jsonb_build_object('cash',(SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1),'machines',(SELECT count(*) FROM kq_player_equipment WHERE user_id=$1 AND purchase_price_cents>0),'receipts',(SELECT count(*) FROM kq_workshop_tier_receipts WHERE user_id=$1),'upgrades',(SELECT count(*) FROM kq_equipment_upgrade_receipts WHERE user_id=$1),'assets',(SELECT count(*) FROM test_assets WHERE user_id=$1))",[owner]);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=55000 WHERE user_id=$1",[poorTier]);
  const poorBefore=await facts(poorTier);
  await reject(()=>buyWorkshopTier(poorTier,"SIFT-TRAY",7,0,tierPrice(baseSift,0,7)),"insufficient_equipment_cash");
  equal(await facts(poorTier),poorBefore,"insufficient funds leave no partial base purchase, upgrade, asset or receipt");
  await reject(()=>buyWorkshopTier(poorTier,"SIFT-TRAY",1,0,baseSift-1),"workshop_tier_price_changed");
  const noviceTier=await prepareTierWorkshop(false);
  await reject(()=>buyWorkshopTier(noviceTier,"SIFT-TRAY",1,0,baseSift),"equipment_career_level_required_3");
  const noPractice=await prepareTierWorkshop(true,false);
  await reject(()=>buyWorkshopTier(noPractice,"AUTO-SIEVE",4,0,tierPrice(499500,0,4)),"equipment_career_practice_required");
  const worn=await prepareTierWorkshop();await buyWorkshopTier(worn,"SIFT-TRAY",1,0,baseSift);
  await db.query("UPDATE kq_player_equipment SET wear_cycles=kq_machine_interval(equipment_code,level) WHERE user_id=$1 AND equipment_code='SIFT-TRAY'",[worn]);
  await reject(()=>buyWorkshopTier(worn,"SIFT-TRAY",4,1,tierPrice(baseSift,1,4)),"workshop_tier_maintenance");
  const rollbackOwner=await prepareTierWorkshop(),rollbackBefore=await facts(rollbackOwner);
  await db.exec("CREATE FUNCTION test_reject_tier_step() RETURNS TRIGGER LANGUAGE plpgsql AS $$BEGIN IF NEW.equipment_code='SIFT-TRAY' AND NEW.level=3 THEN RAISE EXCEPTION 'fixture_mid_purchase_failure'; END IF; RETURN NEW; END$$; CREATE TRIGGER test_reject_tier_step BEFORE UPDATE ON kq_player_equipment FOR EACH ROW EXECUTE FUNCTION test_reject_tier_step()");
  await reject(()=>buyWorkshopTier(rollbackOwner,"SIFT-TRAY",7,0,tierPrice(baseSift,0,7)),"fixture_mid_purchase_failure");
  equal(await facts(rollbackOwner),rollbackBefore,"failure after the base purchase and first upgrade rolls back the entire tier transaction");
  await db.exec("DROP TRIGGER test_reject_tier_step ON kq_player_equipment; DROP FUNCTION test_reject_tier_step()");
  for(const role of ["anon","authenticated","service_role"]){
    equal(await scalar("SELECT has_table_privilege($1,'kq_workshop_tier_receipts','SELECT')",[role]),false,"tier receipts remain private for "+role);
    equal(await scalar("SELECT has_function_privilege($1,'rpc_kq_purchase_workshop_tier(uuid,uuid,text,integer,integer,integer)','EXECUTE')",[role]),role==="service_role","only server RPC execution is allowed for "+role);
  }
  await db.exec("COMMIT");
  await db.exec(await sql(customerDemandMigration));
  await db.exec("BEGIN");
  const demandOwner = await makeOnlinePlayer(db, randomUUID, owner => scalar("SELECT rpc_kq_online_state($1)", [owner]), supplierOnlineCommand);
  const demandBefore = await scalar("SELECT rpc_kq_commerce_state($1)", [demandOwner.user]);
  const wholesaleRequest = demandBefore.customerDemand.requests.find(request => request.channel === "wholesale");
  await db.query("UPDATE kq_flowers SET variety_code=$2 WHERE id=$1", [demandOwner.flower, wholesaleRequest.varietyCode]);
  const demandSnapshot = await scalar("SELECT rpc_kq_commerce_state($1)", [demandOwner.user]);
  const demandStock = demandSnapshot.stocks.find(stock => stock.id === demandOwner.stock);
  equal(demandStock.varietyCode, wholesaleRequest.varietyCode, "final migration enriches stocks through all warehouse snapshot wrappers");
  const { quoteKqCommerce } = await vite.ssrLoadModule("/src/lib/kanab-quest-commerce.ts");
  const { projectKqStorageLot } = await vite.ssrLoadModule("/src/lib/kanab-quest-storage.ts");
  const { previewKqBusinessPayment } = await vite.ssrLoadModule("/src/lib/kanab-quest-business.ts");
  const demandNow = Date.parse(demandSnapshot.business.serverNow);
  const demandOffer = quoteKqCommerce(demandSnapshot, { ...demandStock, storage: projectKqStorageLot(demandStock.storageState, demandNow, demandStock.juryScore) }, "wholesale", "advised", 50, demandNow);
  Object.assign(demandOffer, previewKqBusinessPayment(demandOffer.payoutCents, demandSnapshot.business, 0));
  const demandQuoteId = randomUUID(), demandRequestKey = randomUUID();
  await db.query(`INSERT INTO kq_commerce_quotes(id,user_id,stock_id,account_revision,campaign_id,campaign_revision,stock_units,reputation,offer,expires_at,storage_revision)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+interval '1 minute',$10)`,
    [demandQuoteId,demandOwner.user,demandOwner.stock,demandSnapshot.revision,demandSnapshot.campaign?.id ?? null,demandSnapshot.campaign?.revision ?? null,demandStock.remainingUnits,demandSnapshot.reputation,demandOffer,demandStock.storageRevision]);
  const demandSale = await scalar("SELECT rpc_kq_commerce_command($1,'sell',$2,$3)", [demandOwner.user,{quoteId:demandQuoteId,expectedPayoutCents:demandOffer.payoutCents},demandRequestKey]);
  equal(demandSale.payoutCents, demandOffer.payoutCents, "demand premium settles after real warehouse and supplier migration patches");
  equal((await scalar("SELECT rpc_kq_commerce_state($1)", [demandOwner.user])).customerDemand.requests.find(request => request.channel === "wholesale").remainingUnits, 4950, "full chronological schema consumes the demand quota once");
  equal((await scalar("SELECT rpc_kq_commerce_command($1,'sell',$2,$3)", [demandOwner.user,{quoteId:demandQuoteId,expectedPayoutCents:demandOffer.payoutCents},demandRequestKey])).replayed, true, "warehouse demand sale remains idempotent");
  await db.exec("ROLLBACK");
  console.log(`Warehouse: ${checks} PostgreSQL integration checks passed.`);
} catch (error) {
  console.error(error.message, error.where ?? "");
  process.exitCode = 1;
} finally { await db.close(); await vite.close(); }
