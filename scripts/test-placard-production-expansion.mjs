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
    CREATE TABLE kq_treasury_accounts(user_id UUID PRIMARY KEY,started_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE kq_treasury_assets(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,source_key TEXT,
      account TEXT,expense_account TEXT,equipment_code TEXT,cost_cents BIGINT,recognized_cents BIGINT DEFAULT 0,
      starts_at TIMESTAMPTZ,ends_at TIMESTAMPTZ,recognized_at TIMESTAMPTZ,retired_at TIMESTAMPTZ,
      UNIQUE(user_id,source_key),CHECK(recognized_cents BETWEEN 0 AND cost_cents));
    CREATE FUNCTION kq_treasury_add_asset(p_user UUID,p_key TEXT,p_account TEXT,p_expense TEXT,p_cost BIGINT,p_start TIMESTAMPTZ,p_hours INTEGER,p_equipment TEXT DEFAULT NULL,p_opening BOOLEAN DEFAULT false)
      RETURNS BIGINT LANGUAGE plpgsql AS $$ BEGIN
        INSERT INTO test_assets VALUES(p_user,p_key,p_cost,p_equipment);
        INSERT INTO kq_treasury_assets(user_id,source_key,account,expense_account,equipment_code,cost_cents,starts_at,ends_at,recognized_at)
          VALUES(p_user,p_key,p_account,p_expense,p_equipment,p_cost,p_start,p_start+p_hours*interval '1 hour',p_start);
        RETURN p_cost;
      END $$;
    CREATE FUNCTION kq_treasury_refresh(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN END $$;
    CREATE FUNCTION kq_treasury_queue(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN END $$;
    CREATE FUNCTION kq_treasury_pair(p_user UUID,p_kind TEXT,p_key TEXT,p_at TIMESTAMPTZ,p_debit TEXT,p_credit TEXT,p_amount BIGINT,p_reference TEXT DEFAULT NULL)
      RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN END $$;
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
  // Preserve already paid copies and exact historical replay while changing new purchases.
  await db.exec(`CREATE FUNCTION rpc_kq_commerce_command(p_user_id UUID,p_action TEXT,p_payload JSONB,p_request_key UUID) RETURNS JSONB
    LANGUAGE plpgsql AS $$ DECLARE installed TEXT[]; BEGIN
      installed:=(SELECT COALESCE(array_agg(equipment_code ORDER BY equipment_code),ARRAY[]::TEXT[]) FROM public.kq_equipment_loadouts WHERE user_id=p_user_id);
      RETURN to_jsonb(installed);
    END $$;`);
  const gearBeforeSplit = await query("SELECT * FROM kq_player_equipment WHERE user_id=$1 ORDER BY equipment_code", [user]);
  await db.query("UPDATE kq_treasury_assets SET recognized_cents=LEAST(cost_cents,73) WHERE user_id=$1", [user]);
  const assetBeforeSplit = await one("SELECT sum(cost_cents) AS cost,sum(recognized_cents) AS recognized FROM kq_treasury_assets WHERE user_id=$1", [user]);
  const walletBeforeSplit = await wallet();
  await db.exec(await migration("20260924000300_kq_individual_tents.sql"));
  assert.deepEqual(await wallet(), walletBeforeSplit);
  assert.deepEqual(await one("SELECT sum(cost_cents) AS cost,sum(recognized_cents) AS recognized FROM kq_treasury_assets WHERE user_id=$1", [user]), assetBeforeSplit);
  for (const original of gearBeforeSplit) {
    const copies = await query("SELECT * FROM kq_player_equipment WHERE user_id=$1 AND equipment_code=$2 ORDER BY tent_number", [user, original.equipment_code]);
    assert.equal(copies.length, 8);
    assert.equal(copies.reduce((sum, copy) => sum + copy.purchase_price_cents, 0), original.purchase_price_cents);
    for (const copy of copies) for (const field of ["level", "culture_wear_percent", "culture_wear_version", "wear_cycles", "maintenance_version"])
      assert.equal(copy[field], original[field]);
  }
  assert.deepEqual(await expansion(1, 30000, key), { ...expanded, replayed: true });
  assert.equal((await rpc("rpc_kq_upgrade_equipment($1,$2,'LED-300',1)", [user, upgradeKey])).replayed, true);
  await assert.rejects(() => buy(["AIR-EC6"]), /production_units_changed/);

  const individualUser = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [individualUser]);
  await db.query("SELECT kq_business_settle($1)", [individualUser]);
  await db.query("INSERT INTO kq_treasury_accounts(user_id) VALUES($1)", [individualUser]);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=100000000 WHERE user_id=$1", [individualUser]);
  await db.exec(`CREATE TRIGGER test_tent_purchase AFTER INSERT ON kq_equipment_purchase_receipts FOR EACH ROW EXECUTE FUNCTION kq_treasury_observe();
    CREATE TRIGGER test_tent_upgrade AFTER INSERT ON kq_equipment_upgrade_receipts FOR EACH ROW EXECUTE FUNCTION kq_treasury_observe();
    CREATE TRIGGER test_tent_replacement AFTER INSERT ON kq_culture_equipment_replacements FOR EACH ROW EXECUTE FUNCTION kq_treasury_observe();`);
  const tentBuy = (tent, codes, requestKey = randomUUID()) => rpc("rpc_kq_purchase_tent_equipment($1,$2,$3,$4)", [individualUser, requestKey, codes, tent]);
  const tentEquip = (tent, code) => rpc("rpc_kq_equip_tent_equipment($1,$2,$3)", [individualUser, code, tent]);
  const tentGear = (tent, code) => one("SELECT * FROM kq_player_equipment WHERE user_id=$1 AND tent_number=$2 AND equipment_code=$3", [individualUser, tent, code]);
  const expensivePurchase = await tentBuy(1, ["LED-300", "STATIC-PLASMA", "SECURITY-DOG"]);
  assert.equal(expensivePurchase.totalPriceCents, 35900 + 2280000 + 100000);
  await tentEquip(1, "LED-300");
  await tentEquip(1, "STATIC-PLASMA");
  await tentEquip(1, "SECURITY-DOG");
  const firstUpgrade = randomUUID();
  assert.equal((await rpc("rpc_kq_upgrade_tent_equipment($1,$2,'LED-300',1,1)", [individualUser, firstUpgrade])).priceCents, 3590);
  const beforeBasic = await wallet(individualUser), firstTent = await tentGear(1, "LED-300");
  await assert.rejects(() => expansion(1, 2_440_000, randomUUID(), individualUser), /production_price_changed/);
  const basicKey = randomUUID();
  assert.equal((await expansion(1, 30000, basicKey, individualUser)).priceCents, 30000);
  assert.equal((await wallet(individualUser)).cash_cents, beforeBasic.cash_cents - 30000);
  assert.deepEqual(await tentGear(1, "LED-300"), firstTent);
  assert.deepEqual((await query("SELECT equipment_code FROM kq_player_equipment WHERE user_id=$1 AND tent_number=2 ORDER BY equipment_code", [individualUser])).map(row => row.equipment_code), [...starters].sort());
  const afterBasic = await wallet(individualUser);
  assert.equal((await expansion(1, 30000, basicKey, individualUser)).replayed, true);
  assert.deepEqual(await wallet(individualUser), afterBasic);
  await assert.rejects(() => tentBuy(3, ["LED-300"]), /production_invalid_tent/);
  await assert.rejects(() => tentEquip(2, "STATIC-PLASMA"), /equipment_not_purchased/);
  const secondBuyKey = randomUUID();
  assert.equal((await tentBuy(2, ["LED-300"], secondBuyKey)).totalPriceCents, 35900);
  assert.equal((await tentBuy(2, ["LED-300"], secondBuyKey)).replayed, true);
  await assert.rejects(() => tentBuy(1, ["LED-300"], secondBuyKey), /equipment_purchase_request_mismatch/);
  assert.equal((await tentGear(2, "LED-300")).level, 1);
  await tentEquip(2, "LED-300");
  assert.equal((await tentGear(1, "LED-300")).level, 2);
  await assert.rejects(() => rpc("rpc_kq_upgrade_tent_equipment($1,$2,'LED-300',1,2)", [individualUser, firstUpgrade]), /equipment_upgrade_request_mismatch/);

  const individualSnapshot = async () => {
    const tents = [];
    for (let tentNumber = 1; tentNumber <= (await wallet(individualUser)).production_units; tentNumber++) {
      const rows = await query("SELECT e.equipment_code,e.level FROM kq_equipment_loadouts l JOIN kq_player_equipment e USING(user_id,tent_number,equipment_code) WHERE l.user_id=$1 AND l.tent_number=$2 ORDER BY e.equipment_code", [individualUser, tentNumber]);
      tents.push({ tentNumber, codes: rows.map(row => row.equipment_code), levels: Object.fromEntries(rows.map(row => [row.equipment_code, row.level])) });
    }
    return { equipment: { ...tents[0], tents, productionUnits: tents.length }, harvestGrams: 100 * tents.length, energy: { version: 1, mode: "balanced", totalCents: 1206, totalWattHours: 40200 } };
  };
  const mixedState = await individualSnapshot();
  const tampered = structuredClone(mixedState); tampered.equipment.tents[1].levels["LED-300"] = 2;
  await assert.rejects(() => db.query("INSERT INTO kq_runs(user_id,state) VALUES($1,$2)", [individualUser, JSON.stringify(tampered)]), /kq_culture_equipment_changed/);
  const mixedRun = (await one("INSERT INTO kq_runs(user_id,state) VALUES($1,$2) RETURNING id", [individualUser, JSON.stringify(mixedState)])).id;
  await assert.rejects(() => expansion(2, 30000, randomUUID(), individualUser), /production_active_run/);
  await assert.rejects(() => db.query("UPDATE kq_runs SET state=jsonb_set(state,'{equipment,tents,1,levels,LED-300}','2') WHERE id=$1", [mixedRun]), /kq_energy_quote_immutable/);
  await finish(mixedRun);
  assert.equal((await tentGear(1, "LED-300")).culture_wear_percent, 5);
  assert.equal((await tentGear(2, "LED-300")).culture_wear_percent, 5);
  assert.equal((await tentGear(1, "STATIC-PLASMA")).wear_cycles, 1);
  assert.equal((await one("SELECT dog_care FROM kq_energy_invoices WHERE run_id=$1", [mixedRun])).dog_care.foodCents, 800);
  assert.equal((await one("SELECT amount_cents FROM kq_lab_invoices WHERE run_id=$1", [mixedRun])).amount_cents, 9000);
  const wearAfter = await tentGear(2, "LED-300"); await finish(mixedRun); assert.deepEqual(await tentGear(2, "LED-300"), wearAfter);

  // Replacing one copy retires only that tent's assets and preserves the other.
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=100 WHERE user_id=$1 AND tent_number=2 AND equipment_code='LED-300'", [individualUser]);
  const firstAssets = await query("SELECT * FROM kq_treasury_assets WHERE user_id=$1 AND tent_number=1 AND equipment_code='LED-300' ORDER BY source_key", [individualUser]);
  const beforeReplacement = await wallet(individualUser);
  const replacementReceipt = await rpc("rpc_kq_replace_tent_culture_equipment($1,'LED-300',$2,35900,$3,2)", [individualUser, wearAfter.culture_wear_version, randomUUID()]);
  assert.equal(replacementReceipt.paidCents, 35900);
  assert.equal((await wallet(individualUser)).cash_cents, beforeReplacement.cash_cents - 35900);
  assert.equal((await tentGear(2, "LED-300")).culture_wear_percent, 0);
  assert.equal((await tentGear(1, "LED-300")).culture_wear_percent, 5);
  assert.deepEqual(await query("SELECT * FROM kq_treasury_assets WHERE user_id=$1 AND tent_number=1 AND equipment_code='LED-300' ORDER BY source_key", [individualUser]), firstAssets);
  assert.equal((await query("SELECT * FROM kq_treasury_assets WHERE user_id=$1 AND tent_number=2 AND equipment_code='LED-300' AND retired_at IS NOT NULL", [individualUser])).length, 1);

  await tentBuy(2, ["STATIC-PLASMA"]); await tentEquip(2, "STATIC-PLASMA");
  await db.query("UPDATE kq_player_equipment SET wear_cycles=10,maintenance_version=9 WHERE user_id=$1 AND tent_number=1 AND equipment_code='STATIC-PLASMA'", [individualUser]);
  await db.query("SELECT kq_assert_processing_maintenance($1,'static-sift')", [individualUser]);
  await db.query("UPDATE kq_player_equipment SET wear_cycles=10,maintenance_version=4 WHERE user_id=$1 AND tent_number=2 AND equipment_code='STATIC-PLASMA'", [individualUser]);
  await assert.rejects(() => db.query("SELECT kq_assert_processing_maintenance($1,'static-sift')", [individualUser]), /commerce_machine_maintenance/);
  assert.equal((await rpc("rpc_kq_repair_tent_machine($1,'STATIC-PLASMA',4,20000,$2,2)", [individualUser, randomUUID()])).paidCents, 20000);
  assert.equal((await tentGear(1, "STATIC-PLASMA")).wear_cycles, 10);
  assert.equal((await tentGear(2, "STATIC-PLASMA")).wear_cycles, 0);
  await db.query("SELECT kq_assert_processing_maintenance($1,'static-sift')", [individualUser]);
  const pool = await rpc("rpc_kq_commerce_command($1,'preview','{}',$2)", [individualUser, randomUUID()]);
  assert.equal(pool.length, new Set(pool).size);
  for (const units of [2, 3, 4]) assert.equal((await expansion(units, units === 4 ? 2120000 : 30000, randomUUID(), individualUser)).productionUnits, units === 4 ? 8 : units + 1);
  assert.equal((await query("SELECT * FROM kq_player_equipment WHERE user_id=$1 AND tent_number=8", [individualUser])).length, 3);
  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const signature of ["rpc_kq_purchase_tent_equipment(uuid,uuid,text[],integer)", "rpc_kq_upgrade_tent_equipment(uuid,uuid,text,integer,integer)", "rpc_kq_equip_tent_equipment(uuid,text,integer)", "rpc_kq_repair_tent_machine(uuid,text,integer,integer,uuid,integer)", "rpc_kq_replace_tent_culture_equipment(uuid,text,integer,integer,uuid,integer)"])
      assert.equal(await rpc("has_function_privilege($1,$2,'EXECUTE')", [role, `public.${signature}`]), role === "service_role");
  }
  console.log("Production PostgreSQL passed: historical fleet/replay, individual starter tents, scoped purchases/upgrades/repairs, frozen mixed cultures, wear, invoices, shared machines, asset isolation and grants.");
} finally {
  await db.close();
}
