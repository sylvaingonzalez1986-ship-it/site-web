// Isolated PostgreSQL rehearsal. No credentials, external services or production writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const migration = (name) => readFile(`supabase/migrations/${name}`, "utf8");
const user = randomUUID(), stranger = randomUUID();
const wearable = ["LED-300", "AIR-EC6", "CLIMATE-SMART", "TENT-120", "DRYING-ROOM", "SOLAR-BACKUP", "SECURITY-CAMERA"];
const rates = { eco: [2, 1, 1, 1, 1, 1, 1], balanced: [5, 3, 2, 2, 2, 2, 1], intensive: [10, 6, 4, 3, 4, 4, 1] };
const installed = [...wearable, "WASHER-25L"];
const gear = async (code = "LED-300", owner = user) => (await db.query(
  "SELECT level,culture_wear_percent AS wear,culture_wear_version AS version,wear_cycles AS processing_wear,maintenance_version FROM kq_player_equipment WHERE user_id=$1 AND equipment_code=$2", [owner, code])).rows[0];
const cash = async (owner = user) => (await db.query("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [owner])).rows[0].cash_cents;
const complete = (id) => db.query("UPDATE kq_runs SET status='completed' WHERE id=$1", [id]);
const abandon = (id) => db.query("UPDATE kq_runs SET status='abandoned' WHERE id=$1", [id]);
const equip = (code) => db.query("SELECT rpc_kq_equip_durable($1,$2)", [user, code]);
const start = async (mode = "balanced", codes = installed, owner = user, overrides = {}) => {
  const owned = (await db.query("SELECT equipment_code,level FROM kq_player_equipment WHERE user_id=$1", [owner])).rows;
  const state = {
    equipment: { codes, levels: Object.fromEntries(owned.filter(r => codes.includes(r.equipment_code)).map(r => [r.equipment_code, r.level])) },
    ...(mode ? { energy: { mode } } : {}), ...overrides,
  };
  return (await db.query("INSERT INTO kq_runs(user_id,state) VALUES($1,$2) RETURNING id", [owner, JSON.stringify(state)])).rows[0].id;
};
const replace = async ({ code = "LED-300", version, cost, key = randomUUID(), owner = user }) => (await db.query(
  "SELECT rpc_kq_replace_culture_equipment($1,$2,$3,$4,$5) AS receipt", [owner, code, version, cost, key])).rows[0].receipt;

try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES auth.users(id),status TEXT NOT NULL DEFAULT 'active',state JSONB NOT NULL);
    CREATE UNIQUE INDEX one_active_run ON kq_runs(user_id) WHERE status='active';
    CREATE TABLE kq_commerce_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users(id),revision BIGINT NOT NULL DEFAULT 0);
    CREATE TABLE kq_commerce_batches(user_id UUID,route TEXT);
    CREATE TABLE kq_market_sale_receipts(owner_id UUID,route TEXT,sales_channel TEXT);
    CREATE TABLE arena_chanvrier_profiles(user_id UUID,strength TEXT);`);
  await db.exec(await migration("20260830000100_kq_durable_equipment_shop.sql"));
  const catalog = await migration("20260901000100_kq_us_processing_and_culture_systems.sql");
  await db.exec(catalog.split("ALTER TABLE public.kq_support_card_rules")[0] + "COMMIT;");
  for (const name of ["20260904000100_kq_equipment_route_goal.sql", "20260906000100_kq_equipment_purchase_guard.sql",
    "20260911000200_kq_equipment_levels.sql", "20260913001100_kq_flower_drying_room.sql", "20260914000200_kq_machine_maintenance.sql"])
    await db.exec(await migration(name));
  const electricity = await migration("20260911000300_kq_cycle_electricity.sql");
  await db.exec(electricity.slice(electricity.indexOf("CREATE FUNCTION public.kq_lock_run_energy"), electricity.indexOf("CREATE FUNCTION public.kq_invoice_completed_cycle")));
  await db.exec("INSERT INTO kq_equipment_catalog(code,category,slot,price_cents) VALUES('SECURITY-DOG','security','security',45000)");
  for (const owner of [user, stranger]) {
    await db.query("INSERT INTO auth.users VALUES($1)", [owner]);
    await db.query("SELECT rpc_kq_ensure_equipment_profile($1)", [owner]);
    await db.query("UPDATE kq_equipment_wallets SET cash_cents=10000000 WHERE user_id=$1", [owner]);
    await db.query("INSERT INTO kq_commerce_accounts(user_id) VALUES($1)", [owner]);
  }
  await db.query("SELECT rpc_kq_purchase_equipment($1,$2,$3)", [user, randomUUID(), installed]);
  await db.query("SELECT rpc_kq_purchase_equipment($1,$2,$3)", [user, randomUUID(), ["SECURITY-DOG"]]);
  for (const code of installed) await equip(code);
  const historical = await start(); await complete(historical);
  const legacy = await start(null);
  await db.exec(await migration("20260919000500_kq_culture_equipment_wear.sql"));
  assert.equal((await gear()).wear, 0);
  assert.equal((await db.query("SELECT count(*)::int n FROM kq_culture_equipment_wear_receipts")).rows[0].n, 1);
  await complete(legacy);
  for (const [index, code] of wearable.entries()) assert.equal((await gear(code)).wear, rates.balanced[index]);
  const legacyWear = await gear();
  await complete(legacy);
  await db.query("UPDATE kq_runs SET status='active' WHERE id=$1", [legacy]); await complete(legacy);
  assert.deepEqual(await gear(), legacyWear);
  // Existing processing maintenance has its own behavior and remains untouched.
  await db.query("UPDATE kq_runs SET status='active' WHERE id=$1", [historical]); await complete(historical);
  assert.equal((await gear()).wear, legacyWear.wear);
  const expected = [...rates.balanced];
  for (const mode of ["eco", "balanced", "intensive"]) {
    const run = await start(mode); await complete(run);
    for (const [index, code] of wearable.entries()) {
      expected[index] += rates[mode][index];
      assert.equal((await gear(code)).wear, expected[index], `${code} ${mode}`);
    }
    const receipt = (await db.query("SELECT energy_mode,equipment FROM kq_culture_equipment_wear_receipts WHERE run_id=$1", [run])).rows[0];
    assert.equal(receipt.energy_mode, mode); assert.equal(receipt.equipment.length, 7);
  }
  assert.equal((await gear("WASHER-25L")).wear, 0);
  assert((await gear("WASHER-25L")).processing_wear > 0);
  assert.equal((await gear("TENT-080-STARTER")).wear, 0);
  const abandoned = await start("intensive"); const beforeAbandon = await gear(); await abandon(abandoned);
  assert.deepEqual(await gear(), beforeAbandon);
  assert.equal((await db.query("SELECT * FROM kq_culture_equipment_wear_receipts WHERE run_id=$1", [abandoned])).rows.length, 0);

  // Completion charges the original installation, even after a loadout change.
  const snapshotRun = await start("eco"); const snapshotBefore = await gear();
  await equip("LED-150-STARTER"); await equip("SECURITY-DOG"); await complete(snapshotRun);
  assert.equal((await gear()).wear, snapshotBefore.wear + 2);
  assert.equal((await gear("SECURITY-DOG")).wear, 0);
  await assert.rejects(() => start("eco"), /kq_culture_equipment_changed/);
  const dogCodes = installed.map(c => c === "LED-300" ? "LED-150-STARTER" : c === "SECURITY-CAMERA" ? "SECURITY-DOG" : c);
  const dogRun = await start("intensive", dogCodes); await complete(dogRun);
  assert.equal((await gear("SECURITY-DOG")).wear, 0);
  assert.equal((await gear("LED-150-STARTER")).wear, 0);
  await equip("LED-300"); await equip("SECURITY-CAMERA");

  // Snapshot validation rejects forged ownership, levels, duplicates and stale loadouts.
  await assert.rejects(() => start("eco", [...installed, "FREEZE-DRYER"]), /kq_culture_equipment_changed/);
  await assert.rejects(() => start("eco", [...installed, "LED-300"]), /kq_culture_equipment_changed/);
  await assert.rejects(() => start("eco", installed, user, { equipment: { codes: installed, levels: { "LED-300": 10 } } }), /kq_culture_equipment_changed/);
  await assert.rejects(() => start("eco", installed, user, { equipment: { codes: null } }), /kq_culture_equipment_changed/);
  const immutable = await start();
  await assert.rejects(() => db.query("UPDATE kq_runs SET state=jsonb_set(state,'{equipment,codes}','[]') WHERE id=$1", [immutable]), /kq_energy_quote_immutable/);
  await abandon(immutable);

  // Intensive wear accelerates strictly below 30% remaining condition, with rounding.
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=70 WHERE user_id=$1 AND equipment_code='LED-300'", [user]);
  let run = await start("intensive"); await complete(run); assert.equal((await gear()).wear, 80);
  run = await start("intensive"); await complete(run); assert.equal((await gear()).wear, 95);
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=71 WHERE user_id=$1 AND equipment_code='TENT-120'", [user]);
  run = await start("intensive");
  const beforeBreak = await gear();
  await assert.rejects(() => replace({ version: beforeBreak.version, cost: 35900 }), /culture_equipment_active_run/);
  await complete(run); assert.equal((await gear()).wear, 100); assert.equal((await gear("TENT-120")).wear, 76);
  assert.equal((await db.query("SELECT equipment_code FROM kq_equipment_loadouts WHERE user_id=$1 AND slot='lighting'", [user])).rows[0].equipment_code, "LED-300");
  await assert.rejects(() => equip("LED-300"), /kq_culture_equipment_broken/);
  await assert.rejects(() => start(), /kq_culture_equipment_broken/);
  const fallbackCodes = installed.map(c => c === "LED-300" ? "LED-150-STARTER" : c);
  run = await start("eco", fallbackCodes);
  await assert.rejects(async () => replace({ version: (await gear()).version, cost: 35900 }), /culture_equipment_active_run/);
  await abandon(run);

  // Upgrading never repairs wear and changes the replacement quote through its level.
  const broken = await gear();
  await db.query("SELECT rpc_kq_upgrade_equipment($1,$2,'LED-300',1)", [user, randomUUID()]);
  assert.equal((await gear()).level, 2); assert.equal((await gear()).wear, 100);
  assert.equal((await gear()).version, broken.version);
  await assert.rejects(() => replace({ version: broken.version, cost: 35900 }), /culture_equipment_condition_changed/);
  await assert.rejects(() => replace({ version: broken.version - 1, cost: 39490 }), /culture_equipment_condition_changed/);
  await assert.rejects(() => replace({ version: 0, cost: 35900, owner: stranger }), /culture_equipment_not_owned/);
  await assert.rejects(() => replace({ code: "WASHER-25L", version: 0, cost: 599500 }), /culture_equipment_unavailable/);
  await assert.rejects(async () => replace({ code: "AIR-EC6", version: (await gear("AIR-EC6")).version, cost: 14900 }), /culture_equipment_not_due/);
  const savedCash = await cash();
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1", [user]);
  await assert.rejects(() => replace({ version: broken.version, cost: 39490 }), /culture_equipment_insufficient_cash/);
  assert.equal((await gear()).wear, 100);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=$2 WHERE user_id=$1", [user, savedCash]);
  const revision = (await db.query("SELECT revision FROM kq_commerce_accounts WHERE user_id=$1", [user])).rows[0].revision;
  const key = randomUUID();
  const receipt = await replace({ version: broken.version, cost: 39490, key });
  assert.deepEqual(receipt, { equipmentCode: "LED-300", paidCents: 39490, cashAfterCents: savedCash - 39490, version: broken.version + 1, level: 2, replayed: false });
  assert.equal((await gear()).wear, 0); assert.equal((await gear()).level, 2);
  assert.equal((await db.query("SELECT revision FROM kq_commerce_accounts WHERE user_id=$1", [user])).rows[0].revision, revision + 1);
  assert.deepEqual(await replace({ version: broken.version, cost: 39490, key }), { ...receipt, replayed: true });
  assert.equal(await cash(), savedCash - 39490);
  await assert.rejects(() => replace({ code: "AIR-EC6", version: broken.version, cost: 39490, key }), /culture_equipment_request_mismatch/);
  await assert.rejects(() => replace({ version: broken.version, cost: 39491, key }), /culture_equipment_request_mismatch/);
  run = await start();
  assert.equal((await replace({ version: broken.version, cost: 39490, key })).replayed, true);
  await abandon(run);

  // Rollback restores wear, receipts, money and commerce revision together.
  const preRollback = await gear(); const receiptsBefore = (await db.query("SELECT count(*)::int n FROM kq_culture_equipment_wear_receipts")).rows[0].n;
  await db.exec("BEGIN"); run = await start("intensive"); await complete(run); await db.exec("ROLLBACK");
  assert.deepEqual(await gear(), preRollback);
  assert.equal((await db.query("SELECT count(*)::int n FROM kq_culture_equipment_wear_receipts")).rows[0].n, receiptsBefore);
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=100 WHERE user_id=$1 AND equipment_code='LED-300'", [user]);
  const cashBeforeRollback = await cash();
  await db.exec("BEGIN"); await replace({ version: preRollback.version, cost: 39490 }); await db.exec("ROLLBACK");
  assert.equal((await gear()).wear, 100); assert.equal(await cash(), cashBeforeRollback);

  // All essential starters remain usable with no money; dead optional gear is omitted.
  await db.exec("BEGIN");
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=100 WHERE user_id=$1 AND equipment_code=ANY($2)", [user, wearable]);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1", [user]);
  run = await start("eco", ["TENT-080-STARTER", "LED-150-STARTER", "AIR-STARTER", "WASHER-25L"]); await complete(run);
  assert.equal((await gear()).wear, 100); assert.equal(await cash(), 0);
  assert.deepEqual((await db.query("SELECT equipment FROM kq_culture_equipment_wear_receipts WHERE run_id=$1", [run])).rows[0].equipment, []);
  await db.exec("ROLLBACK");

  // Replacement rounding uses the catalog price and still works without commerce installed.
  await db.exec("BEGIN");
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=100,level=2 WHERE user_id=$1 AND equipment_code='SECURITY-CAMERA'", [user]);
  const camera = await gear("SECURITY-CAMERA");
  await db.exec("ALTER TABLE kq_commerce_accounts RENAME TO commerce_not_installed");
  const rounded = await replace({ code: "SECURITY-CAMERA", version: camera.version, cost: 7699 });
  assert.equal(rounded.paidCents, 7699); assert.equal((await gear("SECURITY-CAMERA")).level, 2);
  await db.exec("ROLLBACK");

  // Ownership isolation, constrained state and service-only access.
  run = await start("intensive", ["TENT-080-STARTER", "LED-150-STARTER", "AIR-STARTER"], stranger); await complete(run);
  assert.equal((await gear()).wear, 100);
  await assert.rejects(() => db.query("UPDATE kq_player_equipment SET culture_wear_percent=101 WHERE user_id=$1", [user]), /check constraint/);
  await assert.rejects(() => db.query("UPDATE kq_player_equipment SET culture_wear_version=-1 WHERE user_id=$1", [user]), /check constraint/);
  const permissions = (await db.query(`SELECT
    has_function_privilege('anon','rpc_kq_replace_culture_equipment(uuid,text,integer,integer,uuid)','EXECUTE') AS anon,
    has_function_privilege('authenticated','rpc_kq_replace_culture_equipment(uuid,text,integer,integer,uuid)','EXECUTE') AS authenticated,
    has_function_privilege('service_role','rpc_kq_replace_culture_equipment(uuid,text,integer,integer,uuid)','EXECUTE') AS service,
    has_table_privilege('authenticated','kq_culture_equipment_replacements','INSERT') AS client_write,
    (SELECT bool_and(relrowsecurity) FROM pg_class WHERE relname IN ('kq_culture_equipment_wear_receipts','kq_culture_equipment_replacements')) AS rls`)).rows[0];
  assert.deepEqual(permissions, { anon: false, authenticated: false, service: true, client_write: false, rls: true });
  console.log("PASS: 7 equipment rates, legacy/historical runs, durable completion replay, abandonment, snapshot/levels/loadout guards, intensive threshold and rounding, starter fallback, processing/dog exclusions, level preservation, exact replacement price, stale requests, insufficient funds, idempotent payments, rollback, ownership and permissions.");
} finally { await db.close(); }
