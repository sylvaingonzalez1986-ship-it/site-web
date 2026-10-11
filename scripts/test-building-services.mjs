// Isolated PostgreSQL integration checks: no credentials, network or deployed writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const migration = name => readFile(`supabase/migrations/${name}`, "utf8");
const rows = async (sql, values = []) => (await db.query(sql, values)).rows;
const one = async (sql, values = []) => (await rows(sql, values))[0];
const rpc = async (sql, values = []) => (await one(`SELECT ${sql} AS value`, values)).value;
const cash = owner => rpc("(SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1)", [owner]);
const gear = (owner, code, tent = 1) => one("SELECT * FROM kq_player_equipment WHERE user_id=$1 AND equipment_code=$2 AND tent_number=$3", [owner, code, tent]);
const buy = (owner, codes, tent = 1, key = randomUUID()) => rpc("rpc_kq_purchase_tent_equipment($1,$2,$3,$4)", [owner, key, codes, tent]);
const equip = (owner, code, tent = 1) => rpc("rpc_kq_equip_tent_equipment($1,$2,$3)", [owner, code, tent]);
const expand = (owner, units, cost, key = randomUUID()) => rpc("rpc_kq_expand_production($1,$2,$3,$4)", [owner, key, units, cost]);
const addCompleted = (owner, count) => db.query(`INSERT INTO kq_runs(user_id,status,state,completed_at)
  SELECT $1,'completed'::kq_run_status,'{}',now() FROM generate_series(1,$2::INTEGER)`, [owner, count]);
const newUser = async () => {
  const owner = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [owner]);
  await db.query("SELECT kq_business_settle($1)", [owner]);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=100000000 WHERE user_id=$1", [owner]);
  return owner;
};

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';
    CREATE TYPE kq_run_status AS ENUM('active','completed','abandoned');
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES auth.users(id),
      status kq_run_status NOT NULL DEFAULT 'active',state JSONB NOT NULL,started_at TIMESTAMPTZ DEFAULT now(),
      completed_at TIMESTAMPTZ,updated_at TIMESTAMPTZ DEFAULT now(),integrity_code TEXT);
    CREATE UNIQUE INDEX one_active_run ON kq_runs(user_id) WHERE status='active';
    CREATE TABLE kq_flowers(id UUID PRIMARY KEY,owner_id UUID,status TEXT);
    CREATE TABLE kq_commerce_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users(id),revision BIGINT NOT NULL DEFAULT 0);
    CREATE TABLE kq_commerce_batches(flower_id UUID PRIMARY KEY,user_id UUID,route TEXT,original_units INTEGER,
      processing_cents INTEGER,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE arena_chanvrier_profiles(user_id UUID,strength TEXT);
    -- Calendar/accounting fixtures record external calls. Actual equipment,
    -- ownership, wear, prices, locks, receipts and RPC bodies are loaded below.
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
    "20260919000500_kq_culture_equipment_wear.sql"]) await db.exec(await migration(name));
  const prices = await migration("20260912000300_kq_distinct_talents.sql");
  await db.exec(prices.slice(prices.indexOf("UPDATE public.kq_equipment_catalog"), prices.lastIndexOf("COMMIT;")));
  const electricity = await migration("20260911000300_kq_cycle_electricity.sql");
  await db.exec(electricity.slice(electricity.indexOf("CREATE TABLE public.kq_energy_invoices"), electricity.indexOf("-- The existing sale transaction")));
  await db.exec(await migration("20260913000700_kq_security_equipment_care.sql"));
  const business = await migration("20260921000100_kq_business_calendar.sql");
  await db.exec(business.slice(business.indexOf("CREATE TABLE public.kq_lab_invoices"), business.indexOf("-- Advance in baseline-capacity units")));
  await db.exec(`CREATE FUNCTION kq_business_settle(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN
    PERFORM rpc_kq_ensure_equipment_profile(p_user);
    INSERT INTO kq_commerce_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
  END $$;`);
  const labStart = business.indexOf("CREATE FUNCTION public.kq_invoice_completed_lab()");
  await db.exec(business.slice(labStart, business.indexOf("CREATE FUNCTION public.kq_business_sale_preview", labStart)));
  await db.exec(await migration("20260923001000_kq_production_expansion.sql"));
  await db.exec(`CREATE FUNCTION rpc_kq_commerce_command(p_user_id UUID,p_action TEXT,p_payload JSONB,p_request_key UUID) RETURNS JSONB
    LANGUAGE plpgsql AS $$ DECLARE installed TEXT[]; BEGIN
      installed:=(SELECT COALESCE(array_agg(equipment_code ORDER BY equipment_code),ARRAY[]::TEXT[]) FROM public.kq_equipment_loadouts WHERE user_id=p_user_id);
      RETURN to_jsonb(installed);
    END $$;`);
  for (const name of ["20260924000300_kq_individual_tents.sql", "20260927000600_kq_shared_processing_workshop.sql",
    "20260928000100_kq_shared_installation_equipment.sql", "20261001000200_kq_tent_equipment_and_shared_workshop.sql"]) await db.exec(await migration(name));
  // Use the real terminal-state validation before the new XP trigger, including
  // invalid completion/death requests that must never award permanent progress.
  const careSql = await migration("20261010000100_kq_culture_care.sql");
  const careValidStart = careSql.indexOf("CREATE FUNCTION public.kq_care_state_valid(");
  await db.exec(careSql.slice(careValidStart, careSql.indexOf("$$;", careValidStart) + 3));
  const updateStart = careSql.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_update_run_state(");
  const updateGrant = careSql.indexOf("GRANT EXECUTE ON FUNCTION public.rpc_kq_update_run_state", updateStart);
  await db.exec(careSql.slice(updateStart, careSql.indexOf(";", updateGrant) + 1));

  const isBuilding = code => ["DRYING-ROOM", "SOLAR-BACKUP", "SECURITY-CAMERA", "SECURITY-DOG"].includes(code);
  const anchor = tent => 1 + 4 * Math.floor((tent - 1) / 4);
  const stateFor = async (owner, scope) => {
    const { production_units: count } = await one("SELECT production_units FROM kq_equipment_wallets WHERE user_id=$1", [owner]);
    const installed = await rows(`SELECT l.tent_number,l.equipment_code,e.level,c.category FROM kq_equipment_loadouts l
      JOIN kq_player_equipment e USING(user_id,tent_number,equipment_code) JOIN kq_equipment_catalog c ON c.code=e.equipment_code
      WHERE l.user_id=$1 AND (e.culture_wear_percent<100 OR kq_culture_equipment_wear_delta(e.equipment_code,'balanced',0)=0)`, [owner]);
    const profile = items => ({ codes: items.map(item => item.equipment_code), levels: Object.fromEntries(items.map(item => [item.equipment_code, item.level])) });
    const tents = Array.from({ length: count }, (_, i) => ({ tentNumber: i + 1, ...profile(installed.filter(item =>
      item.category !== "processing" && item.tent_number === (scope === "building" && isBuilding(item.equipment_code) ? anchor(i + 1) : i + 1))) }));
    return { equipment: { scope, productionUnits: count, tents, shared: profile(installed.filter(item => item.category === "processing")) },
      harvestGrams: 100 * count, energy: { version: 1, mode: "balanced", totalCents: 1234, totalWattHours: 40000 } };
  };
  const startState = async (owner, state) => (await one("INSERT INTO kq_runs(user_id,state) VALUES($1,$2) RETURNING id", [owner, state])).id;
  const start = async (owner, scope = "building") => startState(owner, await stateFor(owner, scope));
  const finish = id => db.query("UPDATE kq_runs SET status='completed',completed_at=now() WHERE id=$1", [id]);
  const scope = owner => rpc("(SELECT equipment_scope_version FROM kq_equipment_wallets WHERE user_id=$1)", [owner]);
  const legacy = async count => {
    const owner = await newUser();
    await db.query("UPDATE kq_equipment_wallets SET production_units=$2 WHERE user_id=$1", [owner, count]);
    await rpc("rpc_kq_ensure_equipment_profile($1)", [owner]);
    // Accounting initialization is outside this isolated equipment fixture. Its
    // real assets, costs and receipt triggers are exercised below.
    await db.query("INSERT INTO kq_treasury_accounts(user_id) VALUES($1)", [owner]);
    return owner;
  };
  const old = await legacy(8), active = await legacy(4), broken = await legacy(1);
  await buy(broken, ["DRYING-ROOM"]);
  await equip(broken, "DRYING-ROOM");
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=100 WHERE user_id=$1 AND equipment_code='DRYING-ROOM'", [broken]);
  const oldPurchaseKey = randomUUID();
  const oldPurchase = await buy(old, ["DRYING-ROOM", "SOLAR-BACKUP", "SECURITY-CAMERA", "SECURITY-DOG"], 4, oldPurchaseKey);
  for (let tent = 1; tent <= 8; tent++) {
    if (tent !== 4) await buy(old, ["DRYING-ROOM", "SOLAR-BACKUP", "SECURITY-CAMERA", "SECURITY-DOG"], tent);
    for (const code of ["DRYING-ROOM", "SOLAR-BACKUP", tent % 2 ? "SECURITY-CAMERA" : "SECURITY-DOG"]) await equip(old, code, tent);
    if (tent <= 4) { await buy(active, ["DRYING-ROOM", "SECURITY-DOG"], tent); await equip(active, "DRYING-ROOM", tent); await equip(active, "SECURITY-DOG", tent); }
  }
  await db.query("UPDATE kq_player_equipment SET level=CASE tent_number WHEN 2 THEN 8 ELSE 3 END,culture_wear_percent=CASE tent_number WHEN 3 THEN 12 ELSE 75 END WHERE user_id=$1 AND equipment_code='DRYING-ROOM'", [old]);
  const oldUpgradeKey = randomUUID();
  const oldUpgrade = await rpc("rpc_kq_upgrade_tent_equipment($1,$2,'SECURITY-CAMERA',1,3)", [old, oldUpgradeKey]);
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=100 WHERE user_id=$1 AND tent_number=3 AND equipment_code='SECURITY-CAMERA'", [old]);
  const oldReplacementKey = randomUUID();
  const cameraPrice = await rpc("(SELECT CEIL(price_cents*1.1)::INTEGER FROM kq_equipment_catalog WHERE code='SECURITY-CAMERA')");
  const oldReplacement = await rpc("rpc_kq_replace_tent_culture_equipment($1,'SECURITY-CAMERA',0,$2,$3,3)", [old, cameraPrice, oldReplacementKey]);
  const assetId = (await one(`INSERT INTO kq_treasury_assets(user_id,source_key,account,expense_account,equipment_code,cost_cents,recognized_cents,
    starts_at,ends_at,recognized_at,tent_number) VALUES($1,'historical-drying','equipment','depreciation','DRYING-ROOM',12345,456,now(),now()+interval '100 hour',now(),3) RETURNING id`, [old])).id;
  const oldState = await stateFor(active, "tent");
  const oldRun = await startState(active, oldState);
  const before = { cash: await cash(old), owned: await rows("SELECT * FROM kq_player_equipment WHERE user_id=$1 AND equipment_code IN ('DRYING-ROOM','SOLAR-BACKUP','SECURITY-CAMERA','SECURITY-DOG') ORDER BY tent_number,equipment_code", [old]),
    asset: await one("SELECT * FROM kq_treasury_assets WHERE id=$1", [assetId]),
    receipts: await rows("SELECT * FROM kq_equipment_purchase_receipts WHERE user_id=$1 ORDER BY id", [old]) };
  await db.exec(await migration("20261011120000_kq_chanvrier_career.sql"));
  await db.exec(await migration("20261011120100_kq_gradual_production_expansion.sql"));
  await db.exec(await migration("20261011130000_kq_building_services.sql"));

  assert.equal(await scope(old), 3);
  assert.equal((await gear(broken, "DRYING-ROOM")).culture_wear_percent, 100, "Already-broken equipment retains its condition");
  assert.equal((await one("SELECT equipment_code FROM kq_equipment_loadouts WHERE user_id=$1 AND slot='flower-drying'", [broken])).equipment_code, "DRYING-ROOM");
  assert.equal(await scope(active), 2, "Active legacy culture defers conversion");
  await assert.rejects(() => startState(active, { ...oldState, equipment: { ...oldState.equipment, scope: "building" } }), /kq_culture_equipment_changed/);
  assert.deepEqual((await one("SELECT state FROM kq_runs WHERE id=$1", [oldRun])).state, oldState);
  assert.equal(await cash(old), before.cash, "Consolidation is free");
  const archived = await one("SELECT * FROM kq_building_service_archive WHERE user_id=$1", [old]);
  assert.deepEqual(archived.equipment.map(item => ({ ...item, acquired_at: new Date(item.acquired_at).toISOString() })), JSON.parse(JSON.stringify(before.owned)), "Every original acquisition is archived exactly");
  assert.equal((await rows("SELECT * FROM kq_player_equipment WHERE user_id=$1 AND kq_is_building_equipment(equipment_code)", [old])).length, 8);
  const drying = await gear(old, "DRYING-ROOM", 1);
  assert.equal(drying.level, 8);
  assert.equal(drying.culture_wear_percent, 12);
  assert.equal(drying.purchase_price_cents, before.owned.filter(e => e.equipment_code === "DRYING-ROOM" && e.tent_number <= 4).reduce((total, e) => total + e.purchase_price_cents, 0));
  assert.deepEqual(await one("SELECT * FROM kq_treasury_assets WHERE id=$1", [assetId]), { ...before.asset, tent_number: 1 });
  assert.deepEqual(await rows("SELECT * FROM kq_equipment_purchase_receipts WHERE user_id=$1 ORDER BY id", [old]), before.receipts);
  await assert.rejects(() => db.query("UPDATE kq_building_service_archive SET equipment='[]' WHERE user_id=$1", [old]), /building_service_archive_immutable/);
  await assert.rejects(() => db.query("DELETE FROM kq_building_service_archive WHERE user_id=$1", [old]), /building_service_archive_immutable/);
  assert.deepEqual(await buy(old, oldPurchase.equipmentCodes, 4, oldPurchaseKey), { ...oldPurchase, replayed: true });
  assert.deepEqual(await rpc("rpc_kq_upgrade_tent_equipment($1,$2,'SECURITY-CAMERA',1,3)", [old, oldUpgradeKey]), { ...oldUpgrade, replayed: true });
  assert.deepEqual(await rpc("rpc_kq_replace_tent_culture_equipment($1,'SECURITY-CAMERA',0,$2,$3,3)", [old, cameraPrice, oldReplacementKey]), { ...oldReplacement, replayed: true });
  await assert.rejects(() => buy(old, ["DRYING-ROOM"], 4), /equipment_already_owned/);
  await equip(old, "SECURITY-DOG", 4);
  assert.equal((await one("SELECT equipment_code FROM kq_equipment_loadouts WHERE user_id=$1 AND tent_number=1 AND slot='security'", [old])).equipment_code, "SECURITY-DOG");
  assert.equal((await rpc("rpc_kq_energy_snapshot($1)", [old])).dogCare.foodCents, 1600, "Owned dogs are cared for even when the camera is installed");
  await assert.rejects(() => db.query("UPDATE kq_player_equipment SET tent_number=2 WHERE user_id=$1 AND tent_number=1 AND equipment_code='DRYING-ROOM'", [old]), /equipment_shared_storage_only/);

  // Original four dogs and four physical drying rooms finish at original rates.
  await rpc("rpc_kq_ensure_equipment_profile($1)", [active]);
  assert.equal(await scope(active), 2);
  await finish(oldRun);
  assert.equal(await scope(active), 2, "Neither completion trigger converts half-way through the old bills");
  const invoice = await one("SELECT * FROM kq_energy_invoices WHERE run_id=$1", [oldRun]);
  assert.equal(invoice.dog_care.foodCents, 3200);
  assert.deepEqual(invoice.quote, oldState.energy);
  const oldWear = (await one("SELECT equipment FROM kq_culture_equipment_wear_receipts WHERE run_id=$1", [oldRun])).equipment;
  assert.equal(oldWear.filter(item => item.equipmentCode === "DRYING-ROOM").length, 4);
  await rpc("rpc_kq_ensure_equipment_profile($1)", [active]);
  assert.equal(await scope(active), 3);
  assert.deepEqual(await one("SELECT * FROM kq_energy_invoices WHERE run_id=$1", [oldRun]), invoice);
  const afterLegacyConversion = await gear(active, "DRYING-ROOM");
  const buildingRun = await start(active);
  await finish(buildingRun);
  const newWear = (await one("SELECT equipment FROM kq_culture_equipment_wear_receipts WHERE run_id=$1", [buildingRun])).equipment;
  assert.equal(newWear.filter(item => item.equipmentCode === "DRYING-ROOM").length, 1, "Effective codes on four tents wear the physical room once");
  assert.equal((await gear(active, "DRYING-ROOM")).culture_wear_version, afterLegacyConversion.culture_wear_version + 1);
  assert.equal((await one("SELECT dog_care FROM kq_energy_invoices WHERE run_id=$1", [buildingRun])).dog_care.foodCents, 800);
  const completedVersion = (await gear(active, "DRYING-ROOM")).culture_wear_version;
  await finish(buildingRun);
  assert.equal((await gear(active, "DRYING-ROOM")).culture_wear_version, completedVersion, "Completion replay cannot wear again");
  const compat = await start(active, "tent");
  await finish(compat);
  const invalid = await stateFor(active, "building");
  invalid.equipment.tents[2].codes = invalid.equipment.tents[2].codes.filter(code => code !== "DRYING-ROOM");
  await assert.rejects(() => startState(active, invalid), /kq_culture_equipment_changed/);

  // Current mutations use the selected building, retain gates and debit once.
  await addCompleted(old, 45);
  const levelBefore = (await gear(old, "DRYING-ROOM", 5)).level;
  const upgradeKey = randomUUID(), cashBeforeUpgrade = await cash(old);
  const upgraded = await rpc("rpc_kq_upgrade_tent_equipment($1,$2,'DRYING-ROOM',$3,8)", [old, upgradeKey, levelBefore]);
  assert.equal(upgraded.tentNumber, 5);
  assert.equal((await gear(old, "DRYING-ROOM", 5)).level, levelBefore + 1);
  assert.equal((await gear(old, "DRYING-ROOM", 1)).level, 8);
  assert.equal(await cash(old), cashBeforeUpgrade - upgraded.priceCents);
  assert.deepEqual(await rpc("rpc_kq_upgrade_tent_equipment($1,$2,'DRYING-ROOM',$3,6)", [old, upgradeKey, levelBefore]), { ...upgraded, replayed: true });
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=100 WHERE user_id=$1 AND tent_number=5 AND equipment_code='DRYING-ROOM'", [old]);
  const worn = await gear(old, "DRYING-ROOM", 5), replacementKey = randomUUID();
  const replacementCost = await rpc("(SELECT CEIL(price_cents::NUMERIC*(100+($1::INTEGER-1)*10)/100)::INTEGER FROM kq_equipment_catalog WHERE code='DRYING-ROOM')", [worn.level]);
  const replaced = await rpc("rpc_kq_replace_tent_culture_equipment($1,'DRYING-ROOM',$2,$3,$4,8)", [old, worn.culture_wear_version, replacementCost, replacementKey]);
  assert.equal(replaced.tentNumber, 5);
  assert.equal((await gear(old, "DRYING-ROOM", 5)).culture_wear_percent, 0);
  assert.deepEqual(await rpc("rpc_kq_replace_tent_culture_equipment($1,'DRYING-ROOM',$2,$3,$4,7)", [old, worn.culture_wear_version, replacementCost, replacementKey]), { ...replaced, replayed: true });
  const fresh = await newUser();
  assert.equal(await scope(fresh), 3);
  await addCompleted(fresh, 45);
  for (let count = 1; count < 5; count++) await expand(fresh, count, count === 4 ? 2030000 : 30000);
  const first = await buy(fresh, ["SECURITY-CAMERA"], 4);
  assert.ok(await gear(fresh, "SECURITY-CAMERA", 1));
  assert.equal(await gear(fresh, "SECURITY-CAMERA", 4), undefined);
  await buy(fresh, ["SECURITY-CAMERA"], 5);
  assert.ok(await gear(fresh, "SECURITY-CAMERA", 5));
  await assert.rejects(() => buy(fresh, ["SECURITY-CAMERA"], 2), /equipment_already_owned/);
  assert.equal(first.totalPriceCents, (await one("SELECT price_cents FROM kq_equipment_catalog WHERE code='SECURITY-CAMERA'")).price_cents);
  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const table of ["kq_building_service_archive", "kq_building_service_conversions"]) {
      assert.equal(await rpc("has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE')", [role, table]), false);
    }
    assert.equal(await rpc("has_function_privilege($1,'kq_migrate_building_services(uuid)','EXECUTE')", [role]), false);
  }
  await db.exec("SET ROLE service_role");
  assert.equal((await rpc("rpc_kq_ensure_equipment_profile($1)", [fresh])).ready, true);
  await assert.rejects(() => rows("SELECT * FROM kq_building_service_archive"), /permission denied/);
  await db.exec("RESET ROLE");
  const erased = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [erased]);
  await db.query("INSERT INTO kq_building_service_archive(user_id,equipment,loadouts,assets) VALUES($1,'[]','[]','[]')", [erased]);
  await db.query("DELETE FROM auth.users WHERE id=$1", [erased]);
  assert.equal((await rows("SELECT user_id FROM kq_building_service_archive WHERE user_id=$1", [erased])).length, 0, "Account deletion still cascades to private history");
  console.log("PASS: building consolidation preserves acquisitions, accounting and historical replays; active legacy runs defer conversion; canonical atomic purchases/upgrades/installation/replacement; effective snapshot validation; one wear and dog charge per building; private immutable archive and service RPC access.");
} catch (error) {
  console.error(error.stack ?? error);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally { await db.close(); }
