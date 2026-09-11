// Isolated PostgreSQL rehearsal: no credentials, network or production writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";
const db = new PGlite();
const migration = (name) => readFile(`supabase/migrations/${name}`, "utf8");
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';`);
  await db.exec(await migration("20260830000100_kq_durable_equipment_shop.sql"));
  // Only the equipment section of the historical mixed card/catalog migration.
  const catalogMigration = await migration("20260901000100_kq_us_processing_and_culture_systems.sql");
  await db.exec(catalogMigration.split("ALTER TABLE public.kq_support_card_rules")[0] + "COMMIT;");
  await db.exec(await migration("20260904000100_kq_equipment_route_goal.sql"));
  await db.exec(await migration("20260906000100_kq_equipment_purchase_guard.sql"));
  const user = randomUUID(), stranger = randomUUID();
  for (const id of [user, stranger]) {
    await db.query("INSERT INTO auth.users VALUES($1)", [id]);
    await db.query("SELECT rpc_kq_ensure_equipment_profile($1)", [id]);
  }
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=10000000 WHERE user_id=$1", [user]);
  await db.query("SELECT rpc_kq_purchase_equipment($1,$2,$3)", [user, randomUUID(), ["WASHER-25L", "WASHER-75G", "PRESS-2T", "PRESS-20T", "SECURITY-CAMERA"]]);
  await db.query("SELECT rpc_kq_equip_durable($1,'WASHER-75G')", [user]);
  await db.query("SELECT rpc_kq_set_equipment_route_plan($1,'rosin-signature','PRESS-20T')", [user]);
  const cashBefore = (await db.query("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [user])).rows[0].cash_cents;
  await db.exec(await migration("20260911000200_kq_equipment_levels.sql"));
  const owned = (await db.query("SELECT equipment_code,level FROM kq_player_equipment WHERE user_id=$1", [user])).rows;
  assert.equal(owned.find(r => r.equipment_code === "WASHER-25L").level, 5);
  assert.equal(owned.find(r => r.equipment_code === "PRESS-0600").level, 10);
  assert.equal(owned.find(r => r.equipment_code === "SECURITY-CAMERA").level, 1);
  assert(!owned.some(r => ["WASHER-75G", "PRESS-2T", "PRESS-20T"].includes(r.equipment_code)));
  assert.equal((await db.query("SELECT equipment_code FROM kq_equipment_loadouts WHERE user_id=$1 AND slot='washing'", [user])).rows[0].equipment_code, "WASHER-25L");
  assert.deepEqual((await db.query("SELECT cash_cents,planned_equipment_code FROM kq_equipment_wallets WHERE user_id=$1", [user])).rows[0], { cash_cents: cashBefore, planned_equipment_code: "PRESS-0600" });
  assert.equal((await db.query("SELECT COUNT(*)::INTEGER AS count FROM kq_equipment_catalog WHERE is_active AND is_purchasable")).rows[0].count, 12);
  const upgrade = async (level, key = randomUUID(), code = "SECURITY-CAMERA", id = user) =>
    (await db.query("SELECT rpc_kq_upgrade_equipment($1,$2,$3,$4) AS receipt", [id, key, code, level])).rows[0].receipt;
  let balance = cashBefore;
  for (let level = 1; level < 10; level++) {
    const key = randomUUID();
    const receipt = await upgrade(level, key);
    balance -= Math.ceil(6999 * level / 10);
    assert.deepEqual(receipt, { equipmentCode: "SECURITY-CAMERA", level: level+1, priceCents: Math.ceil(6999 * level / 10), cashAfterCents: balance, replayed: false });
    assert.deepEqual(await upgrade(level, key), { ...receipt, replayed: true });
    await assert.rejects(() => upgrade(level, key, "WASHER-25L"), /request_mismatch/);
    await assert.rejects(() => upgrade(level), /equipment_level_changed|equipment_max_level/);
  }
  await assert.rejects(() => upgrade(10), /invalid_equipment_upgrade/);
  await assert.rejects(() => upgrade(1, randomUUID(), "WASHER-25L", stranger), /equipment_not_purchased/);
  await assert.rejects(() => upgrade(1, randomUUID(), "LED-150-STARTER"), /equipment_not_purchased/);
  await assert.rejects(() => db.query("SELECT rpc_kq_purchase_equipment($1,$2,$3)", [user, randomUUID(), ["WASHER-75G"]]), /equipment_unavailable/);
  await db.query("SELECT rpc_kq_purchase_equipment($1,$2,$3)", [stranger, randomUUID(), ["SECURITY-CAMERA"]]);
  assert.equal((await db.query("SELECT level FROM kq_player_equipment WHERE user_id=$1 AND equipment_code='SECURITY-CAMERA'", [stranger])).rows[0].level, 1);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1", [stranger]);
  await assert.rejects(() => upgrade(1, randomUUID(), "SECURITY-CAMERA", stranger), /insufficient_equipment_cash/);
  assert.equal((await db.query("SELECT level FROM kq_player_equipment WHERE user_id=$1 AND equipment_code='SECURITY-CAMERA'", [stranger])).rows[0].level, 1);
  assert.equal((await db.query("SELECT COUNT(*)::INTEGER AS count FROM kq_equipment_upgrade_receipts")).rows[0].count, 9);
  await assert.rejects(() => db.query("UPDATE kq_player_equipment SET level=11 WHERE user_id=$1", [user]), /check constraint/);
  const permissions = (await db.query(`SELECT
    has_function_privilege('anon','rpc_kq_upgrade_equipment(uuid,uuid,text,integer)','EXECUTE') AS anon,
    has_function_privilege('authenticated','rpc_kq_upgrade_equipment(uuid,uuid,text,integer)','EXECUTE') AS authenticated,
    has_function_privilege('service_role','rpc_kq_upgrade_equipment(uuid,uuid,text,integer)','EXECUTE') AS service`)).rows[0];
  assert.deepEqual(permissions, { anon: false, authenticated: false, service: true });
  console.log("PASS: consolidation, unchanged cash, slots/goals, 9 upgrades, exact prices, replays, stale requests, ownership, insufficient balance, maximum level and RPC permissions.");
} finally { await db.close(); }
