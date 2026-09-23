// Isolated PostgreSQL integration tests: no credentials, network or deployed writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const migration = name => readFile(`supabase/migrations/${name}`, "utf8");
const query = async (sql, values = []) => (await db.query(sql, values)).rows;
const one = async (sql, values = []) => (await query(sql, values))[0];
const rpc = async (sql, values = []) => (await one(`SELECT ${sql} AS value`, values)).value;
const user = randomUUID(), legacyUser = randomUUID();
const wallet = (owner = user) => one("SELECT cash_cents,production_units FROM kq_equipment_wallets WHERE user_id=$1", [owner]);
const expansion = (units, cost, key = randomUUID(), owner = user) => rpc("rpc_kq_expand_production($1,$2,$3,$4)", [owner, key, units, cost]);
const buy = (codes, owner = user, key = randomUUID()) => rpc("rpc_kq_purchase_equipment($1,$2,$3)", [owner, key, codes]);
const gear = code => one("SELECT * FROM kq_player_equipment WHERE user_id=$1 AND equipment_code=$2", [user, code]);
const starters = ["TENT-080-STARTER", "LED-150-STARTER", "AIR-STARTER"];
const start = async ({ owner = user, units = 1, energy = true, codes = starters, levels = {}, legacy = false } = {}) => {
  const state = { equipment: { codes, levels, ...(legacy ? {} : { productionUnits: units }) }, harvestGrams: 100 * units };
  if (energy) state.energy = { version: 1, mode: "balanced", totalCents: 603 * units, totalWattHours: 20100 * units };
  return (await one("INSERT INTO kq_runs(user_id,state) VALUES($1,$2) RETURNING id", [owner, JSON.stringify(state)])).id;
};
const finish = id => db.query("UPDATE kq_runs SET status='completed' WHERE id=$1", [id]);
const abandon = id => db.query("UPDATE kq_runs SET status='abandoned' WHERE id=$1", [id]);

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES auth.users(id),status TEXT NOT NULL DEFAULT 'active',state JSONB NOT NULL);
    CREATE UNIQUE INDEX one_active_run ON kq_runs(user_id) WHERE status='active';
    CREATE TABLE kq_flowers(id UUID PRIMARY KEY,owner_id UUID,status TEXT);
    CREATE TABLE kq_commerce_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users(id),revision BIGINT NOT NULL DEFAULT 0);
    CREATE TABLE kq_commerce_batches(user_id UUID,route TEXT);
    CREATE TABLE arena_chanvrier_profiles(user_id UUID,strength TEXT);
    -- Calendar/treasury fixtures record integration calls; equipment and invoice
    -- routines below are loaded from the actual migration chain.
    CREATE TABLE test_settlements(user_id UUID);
    CREATE TABLE test_assets(user_id UUID,source_key TEXT UNIQUE,cost BIGINT,equipment_code TEXT);
    CREATE FUNCTION kq_treasury_add_asset(p_user UUID,p_key TEXT,p_account TEXT,p_expense TEXT,p_cost BIGINT,p_start TIMESTAMPTZ,p_hours INTEGER,p_equipment TEXT DEFAULT NULL,p_opening BOOLEAN DEFAULT false)
      RETURNS BIGINT LANGUAGE plpgsql AS $$ BEGIN INSERT INTO test_assets VALUES(p_user,p_key,p_cost,p_equipment); RETURN p_cost; END $$;
  `);
  await db.exec(await migration("20260830000100_kq_durable_equipment_shop.sql"));
  await db.exec(await migration("20260830000200_kq_post_harvest_market.sql"));
  await db.exec("ALTER TABLE kq_market_sale_receipts ADD COLUMN sales_channel TEXT");
  const catalog = await migration("20260901000100_kq_us_processing_and_culture_systems.sql");
  await db.exec(catalog.split("ALTER TABLE public.kq_support_card_rules")[0] + "COMMIT;");
  for (const name of ["20260904000100_kq_equipment_route_goal.sql", "20260906000100_kq_equipment_purchase_guard.sql",
    "20260911000200_kq_equipment_levels.sql", "20260913001100_kq_flower_drying_room.sql", "20260914000200_kq_machine_maintenance.sql",
    "20260919000500_kq_culture_equipment_wear.sql"])
    await db.exec(await migration(name));
  const electricity = await migration("20260911000300_kq_cycle_electricity.sql");
  await db.exec(electricity.slice(electricity.indexOf("CREATE TABLE public.kq_energy_invoices"), electricity.indexOf("-- The existing sale transaction")));
  await db.exec(await migration("20260913000700_kq_security_equipment_care.sql"));
  const business = await migration("20260921000100_kq_business_calendar.sql");
  await db.exec(business.slice(business.indexOf("CREATE TABLE public.kq_lab_invoices"), business.indexOf("-- Advance in baseline-capacity units")));
  await db.exec(`CREATE FUNCTION kq_business_settle(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN
    PERFORM rpc_kq_ensure_equipment_profile(p_user);
    INSERT INTO kq_commerce_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
    INSERT INTO test_settlements VALUES(p_user);
  END $$;`);
  const labStart = business.indexOf("CREATE FUNCTION public.kq_invoice_completed_lab()");
  await db.exec(business.slice(labStart, business.indexOf("CREATE FUNCTION public.kq_business_sale_preview", labStart)));
  for (const owner of [user, legacyUser]) {
    await db.query("INSERT INTO auth.users VALUES($1)", [owner]);
    await db.query("SELECT kq_business_settle($1)", [owner]);
    await db.query("UPDATE kq_equipment_wallets SET cash_cents=100000000 WHERE user_id=$1", [owner]);
  }
  // Historical active runs have no production field and must retain their x1 cost.
  const legacy = await start({ owner: legacyUser, legacy: true });
  const legacyState = (await one("SELECT state FROM kq_runs WHERE id=$1", [legacy])).state;
  await db.exec(await migration("20260923001000_kq_production_expansion.sql"));
  assert.equal((await wallet()).production_units, 1);
  assert.deepEqual((await one("SELECT state FROM kq_runs WHERE id=$1", [legacy])).state, legacyState);
  await assert.rejects(() => expansion(1, 30000, randomUUID(), legacyUser), /production_active_run/);
  await finish(legacy);
  assert.equal((await one("SELECT amount_cents FROM kq_lab_invoices WHERE run_id=$1", [legacy])).amount_cents, 4500);

  // Capacity and quoted price must both match; rejected purchases are atomic.
  const initial = await wallet();
  await assert.rejects(() => expansion(2, 30000), /production_units_changed/);
  await assert.rejects(() => expansion(1, 29999), /production_price_changed/);
  assert.deepEqual(await wallet(), initial);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=29999 WHERE user_id=$1", [user]);
  await assert.rejects(() => expansion(1, 30000), /production_insufficient_cash/);
  assert.equal((await wallet()).production_units, 1);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=$2 WHERE user_id=$1", [user, initial.cash_cents]);
  const key = randomUUID(), expanded = await expansion(1, 30000, key);
  assert.deepEqual(expanded, { productionUnits: 2, previousUnits: 1, addedUnits: 1, priceCents: 30000, cashAfterCents: initial.cash_cents - 30000, replayed: false });
  assert.deepEqual(await expansion(1, 30000, key), { ...expanded, replayed: true });
  await assert.rejects(() => expansion(1, 30001, key), /production_request_mismatch/);
  assert.equal((await query("SELECT * FROM kq_production_expansions")).length, 1);
  const afterExpansion = await wallet();
  await assert.rejects(() => start({ units: 1 }), /kq_production_units_changed/);
  await assert.rejects(() => start({ legacy: true }), /kq_production_units_changed/);
  const active = await start({ units: 2, energy: false });
  await assert.rejects(() => db.query("UPDATE kq_runs SET state=jsonb_set(state,'{equipment,productionUnits}','4') WHERE id=$1", [active]), /kq_energy_quote_immutable/);
  await assert.rejects(() => expansion(2, 30000), /production_active_run/);
  assert.deepEqual(await wallet(), afterExpansion);
  await abandon(active);

  // Purchases and upgrades cover every unit; receipts store the actual debit.
  const purchase = await buy(["LED-300", "WASHER-25L"]);
  assert.equal(purchase.totalPriceCents, (35900 + 599500) * 2);
  assert.equal((await gear("LED-300")).purchase_price_cents, 71800);
  const upgradeKey = randomUUID();
  const upgrade = await rpc("rpc_kq_upgrade_equipment($1,$2,'LED-300',1)", [user, upgradeKey]);
  assert.equal(upgrade.priceCents, 3590 * 2);
  assert.equal((await rpc("rpc_kq_upgrade_equipment($1,$2,'LED-300',1)", [user, upgradeKey])).replayed, true);
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=40,culture_wear_version=3 WHERE user_id=$1 AND equipment_code='LED-300'", [user]);
  const beforeCloning = await gear("LED-300");
  // Paid LED removes the 12000 starter-light charge, and its level2 costs 39490.
  const cloneCost = 18000 + 39490 + 599500;
  assert.equal((await expansion(2, cloneCost)).priceCents, cloneCost);
  const afterCloning = await gear("LED-300");
  assert.equal(afterCloning.purchase_price_cents, 107700);
  for (const field of ["level", "culture_wear_percent", "culture_wear_version", "wear_cycles", "maintenance_version"])
    assert.equal(afterCloning[field], beforeCloning[field]);
  assert.equal((await one("SELECT sum(cost)::integer AS cost FROM test_assets WHERE user_id=$1", [user])).cost, 30000 + cloneCost);

  // Broken gear blocks expansion; repair/replacement debits are proportional.
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=100 WHERE user_id=$1 AND equipment_code='LED-300'", [user]);
  await assert.rejects(() => expansion(3, cloneCost), /production_equipment_maintenance/);
  await assert.rejects(() => rpc("rpc_kq_replace_culture_equipment($1,'LED-300',3,39490,$2)", [user, randomUUID()]), /culture_equipment_condition_changed/);
  const replacement = await rpc("rpc_kq_replace_culture_equipment($1,'LED-300',3,$2,$3)", [user, 39490 * 3, randomUUID()]);
  assert.equal(replacement.paidCents, 39490 * 3);
  assert.equal((await gear("LED-300")).culture_wear_percent, 0);
  await db.query("UPDATE kq_player_equipment SET wear_cycles=10,maintenance_version=4 WHERE user_id=$1 AND equipment_code='WASHER-25L'", [user]);
  await assert.rejects(() => expansion(3, cloneCost), /production_equipment_maintenance/);
  const repair = await rpc("rpc_kq_repair_machine($1,'WASHER-25L',4,60000,$2)", [user, randomUUID()]);
  assert.equal(repair.paidCents, 60000);
  await db.query("UPDATE kq_player_equipment SET wear_cycles=10,maintenance_version=5 WHERE user_id=$1 AND equipment_code='WASHER-25L'", [user]);
  await db.query("INSERT INTO arena_chanvrier_profiles VALUES($1,'handyperson')", [user]);
  assert.equal((await rpc("rpc_kq_repair_machine($1,'WASHER-25L',5,0,$2)", [user, randomUUID()])).paidCents, 0);
  await expansion(3, cloneCost);
  const beforeFinal = await wallet();
  await db.exec("BEGIN");
  await expansion(4, 2000000 + cloneCost * 4);
  await db.exec("ROLLBACK");
  assert.deepEqual(await wallet(), beforeFinal);
  assert.equal((await expansion(4, 2000000 + cloneCost * 4)).productionUnits, 8);
  await assert.rejects(() => expansion(8, 1), /production_max_units/);
  await assert.rejects(() => db.query("UPDATE kq_equipment_wallets SET production_units=5 WHERE user_id=$1", [user]), /check constraint/);

  // A stale browser cannot silently purchase eight items using a one-item quote.
  const guardedPurchaseKey = randomUUID();
  await assert.rejects(() => rpc("rpc_kq_purchase_production_equipment($1,$2,$3,4)", [user, guardedPurchaseKey, ["SECURITY-CAMERA"]]), /production_units_changed/);
  await assert.rejects(() => rpc("rpc_kq_purchase_production_equipment($1,$2,$3)", [user, guardedPurchaseKey, ["SECURITY-CAMERA"]]), /production_units_changed/);
  const guardedPurchase = await rpc("rpc_kq_purchase_production_equipment($1,$2,$3,8)", [user, guardedPurchaseKey, ["SECURITY-CAMERA"]]);
  assert.equal(guardedPurchase.totalPriceCents, 6999 * 8);
  const guardedUpgradeKey = randomUUID();
  await assert.rejects(() => rpc("rpc_kq_upgrade_production_equipment($1,$2,'SECURITY-CAMERA',1,4)", [user, guardedUpgradeKey]), /production_units_changed/);
  const guardedUpgrade = await rpc("rpc_kq_upgrade_production_equipment($1,$2,'SECURITY-CAMERA',1,8)", [user, guardedUpgradeKey]);
  assert.equal(guardedUpgrade.priceCents, 700 * 8); // Round the unit cost before multiplying.
  assert.equal((await rpc("rpc_kq_purchase_production_equipment($1,$2,$3,4)", [user, guardedPurchaseKey, ["SECURITY-CAMERA"]])).replayed, true);
  assert.equal((await rpc("rpc_kq_upgrade_production_equipment($1,$2,'SECURITY-CAMERA',1,4)", [user, guardedUpgradeKey])).replayed, true);

  // All eight copies cost money; lab/energy/dog charges use frozen culture units.
  assert.equal((await buy(["SECURITY-DOG"])).totalPriceCents, 800000);
  const snapshot = await rpc("rpc_kq_energy_snapshot($1)", [user]);
  assert.equal(snapshot.dogCare.nextTotalCents, 6400);
  const run = await start({ units: 8 });
  await finish(run);
  const bill = await one("SELECT total_cents,remaining_cents,dog_care FROM kq_energy_invoices WHERE run_id=$1", [run]);
  assert.equal(bill.total_cents, 603 * 8 + 800 * 8);
  assert.equal(bill.remaining_cents, 603 * 8);
  assert.equal(bill.dog_care.foodCents, 6400);
  assert.equal((await one("SELECT amount_cents,remaining_cents FROM kq_lab_invoices WHERE run_id=$1", [run])).amount_cents, 36000);
  const beforeReplay = await wallet();
  await finish(run);
  assert.deepEqual(await wallet(), beforeReplay);
  assert.equal((await query("SELECT * FROM kq_lab_invoices WHERE run_id=$1", [run])).length, 1);
  for (let cycle = 2; cycle <= 10; cycle++) await finish(await start({ units: 8 }));
  const careBills = await query("SELECT dog_care FROM kq_energy_invoices WHERE user_id=$1", [user]);
  const tenth = careBills.find(row => row.dog_care.cycle === 10).dog_care;
  assert.equal(tenth.vetCents, 32000);
  assert.equal(tenth.totalCents, 38400);
  // Even privileged future profile changes cannot reprice a saved legacy run.
  await buy(["SECURITY-DOG"], legacyUser);
  const frozenLegacy = await start({ owner: legacyUser, legacy: true });
  await db.query("UPDATE kq_equipment_wallets SET production_units=4 WHERE user_id=$1", [legacyUser]);
  await finish(frozenLegacy);
  assert.equal((await one("SELECT dog_care FROM kq_energy_invoices WHERE run_id=$1", [frozenLegacy])).dog_care.foodCents, 800);
  assert.equal((await one("SELECT amount_cents FROM kq_lab_invoices WHERE run_id=$1", [frozenLegacy])).amount_cents, 4500);

  // Scaled harvests can reach all the way through preparation into market stock.
  const flower = randomUUID();
  await db.query("INSERT INTO kq_flowers VALUES($1,$2,'burned')", [flower, user]);
  const lot = await rpc("rpc_kq_prepare_market_lot($1,$2,4000,8,'premium',$3,'[]')", [user, flower, starters]);
  assert.equal(lot.harvest_grams, 4000);
  await assert.rejects(() => rpc("rpc_kq_prepare_market_lot($1,$2,4000.1,8,'premium',$3,'[]')", [user, flower, starters]), /invalid_market_lot/);

  // Roles cannot write capacity receipts; only the service RPC is executable.
  for (const role of ["anon", "authenticated", "service_role"]) {
    assert.equal(await rpc("has_table_privilege($1,'public.kq_production_expansions','SELECT')", [role]), false);
    assert.equal(await rpc("has_table_privilege($1,'public.kq_production_expansions','INSERT')", [role]), false);
    assert.equal(await rpc("has_function_privilege($1,'public.rpc_kq_expand_production(uuid,uuid,integer,integer)','EXECUTE')", [role]), role === "service_role");
    assert.equal(await rpc("has_function_privilege($1,'public.rpc_kq_purchase_production_equipment(uuid,uuid,text[],integer)','EXECUTE')", [role]), role === "service_role");
    assert.equal(await rpc("has_function_privilege($1,'public.rpc_kq_upgrade_production_equipment(uuid,uuid,text,integer,integer)','EXECUTE')", [role]), role === "service_role");
  }
  assert((await query("SELECT * FROM test_settlements WHERE user_id=$1", [user])).length > 10);
  console.log("Production expansion PostgreSQL: pricing, stale quotes, idempotency, rollback, fleet maintenance, run guards, invoices, 4000g lots and API grants passed.");
} finally {
  await db.close();
}
