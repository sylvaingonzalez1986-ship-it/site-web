// Local PostgreSQL only. Reuse the online commerce fixture and its real scheduler.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const sources = new URL("../supabase/migrations/", import.meta.url);
const sql = name => readFile(new URL(name, sources), "utf8");
const scalar = async (query, params = []) => Object.values((await db.query(query, params)).rows[0])[0];

try {
  const online = (await readFile(new URL("./test-placard-online.mjs", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  const start = online.indexOf(" await db.exec(`");
  const end = online.indexOf(" // A real pre-migration receipt and account must survive the new catalogue.");
  assert.ok(start >= 0 && end > start);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction("db", "sql", "scalar", online.slice(start, end))(db, sql, scalar);
  await db.exec(await sql("20261020000400_kq_online_site_progression.sql"));
  await db.exec(await sql("20261020000500_kq_online_merch.sql"));
  const layoutMigration = await sql("20261012000100_kq_warehouse_layouts.sql");
  await db.exec(layoutMigration.slice(layoutMigration.indexOf("CREATE TABLE public.kq_warehouse_layouts"), layoutMigration.indexOf("CREATE TABLE public.kq_warehouse_receipts")));
  // This fixture omits the unrelated depreciation and storage-climate tables.
  await db.exec(`
    CREATE FUNCTION kq_storage_climate_settle_until(UUID,TIMESTAMPTZ) RETURNS VOID LANGUAGE sql AS 'SELECT';
    CREATE TABLE security_test_assets(user_id UUID,source_key TEXT,cost BIGINT);
    CREATE FUNCTION kq_treasury_add_asset(UUID,TEXT,TEXT,TEXT,BIGINT,TIMESTAMPTZ,INTEGER,TEXT) RETURNS BIGINT LANGUAGE sql
    AS 'INSERT INTO security_test_assets VALUES($1,$2,$5) RETURNING cost';
  `);
  const timeline = await scalar("SELECT pg_get_functiondef('kq_online_settle_until(uuid,timestamptz)'::regprocedure)");
  const clock = "PERFORM public.kq_online_business_at(p_user,cursor_at);";
  assert.ok(timeline.includes(clock));
  await db.exec(timeline.replace(clock, `${clock} PERFORM public.kq_storage_climate_settle_until(p_user,cursor_at);`));

  const user = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [user]);
  await scalar("SELECT rpc_kq_online_state($1)", [user]);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=120000 WHERE user_id=$1", [user]);
  const layout = { version: 1, floor: { columns: 10, rows: 10 }, zones: [], equipment: [], preparedAreaM2: 0,
    optionInventory: [{ code: "SIM-SECURITY-02", quantity: 1 }],
    partitions: [{ id: "wall", x: 4, y: 5, axis: "x", length: 2 }], stationPlacements: [{ id: "station", code: "SIM-WATER-03", x: 1, y: 2 }] };
  await db.query("INSERT INTO kq_warehouse_layouts(user_id,state,legacy_archive) VALUES($1,$2,'{}')", [user, layout]);
  await db.exec(await sql("20261121001100_kq_warehouse_security.sql"));
  // Run the two actual retail function definitions needed by this security-only fixture.
  const retailSql = await sql("20261122000200_kq_warehouse_retail_supplies.sql");
  for (const name of ["kq_warehouse_retail_supply_price", "kq_warehouse_security_prices"]) {
    const definition = retailSql.match(new RegExp("CREATE (?:OR REPLACE )?FUNCTION public\\."+name+"\\([\\s\\S]*?\\$\\$;"));
    assert.ok(definition,name);
    await db.exec(definition[0]);
  }
  await db.exec(await sql("20261122000210_kq_warehouse_security_placement.sql"));

  const read = () => scalar("SELECT rpc_kq_warehouse_security_snapshot($1)", [user]);
  let current = await read();
  const send = (command, cost, key = randomUUID(), state = current) => scalar(
    "SELECT rpc_kq_warehouse_security_command($1,$2,$3,$4,$5,$6)", [user, key, state.revision, state.layoutRevision, cost, command]);
  const command = async (...args) => { current = await send(...args); return current; };
  assert.deepEqual(current.layout, layout);
  const key = randomUUID(), before = current;
  const prices = current.prices;
  await assert.rejects(send({ action: "buy-camera" }, 1), /warehouse_security_price_changed/);
  assert.deepEqual(await read(), before);
  assert.equal((await command({ action: "buy-camera" }, prices.cameraCents, key)).cashCents, 120000 - prices.cameraCents);
  assert.deepEqual((await send({ action: "buy-camera" }, prices.cameraCents, key, before)).receipt, { replayed: true, chargedCents: prices.cameraCents });
  assert.equal((await read()).cameras.length, 1);
  await assert.rejects(send({ action: "buy-camera" }, prices.cameraCents, randomUUID(), before), /warehouse_security_changed/);
  const place = (x, y, bearing) => ({ action: "place-camera", cameraId: key, placement: { x, y, bearing } });
  await assert.rejects(send(place(4, 5, 0), 0), /warehouse_security_camera_position/);
  await assert.rejects(send(place(1, 2, 0), 0), /warehouse_security_camera_position/);
  await assert.rejects(send(place(10, 0, 0), 0), /warehouse_security_camera_position/);
  await command(place(3, 5, 2), 0);
  assert.deepEqual(current.cameras[0].placement, { x: 3, y: 5, bearing: 2 });
  const blocked = { ...layout, partitions: [{ ...layout.partitions[0], x: 3 }] };
  await db.query("UPDATE kq_warehouse_layouts SET state=$2,revision=revision+1 WHERE user_id=$1", [user, blocked]);
  assert.equal((await read()).cameras[0].placement, null);
  await assert.rejects(send(place(2, 5, 2), 0), /warehouse_security_changed/);
  current = await read();
  for (const code of ["SIM-SECURITY-02", "SIM-NUTRITION-01", "SIM-HYGIENE-02"]) {
    await assert.rejects(db.query("UPDATE kq_warehouse_layouts SET state=$2 WHERE user_id=$1", [user, {
      ...blocked, optionInventory: [{ code, quantity: 2 }],
    }]), /warehouse_retired_option_purchase/);
  }
  const purchase = { action: "buy-place-camera", placement: { x: 1, y: 2, bearing: 4 } };
  const originalSnapshot = current;
  await assert.rejects(send(purchase, prices.cameraCents), /warehouse_security_camera_position/);
  assert.deepEqual(await read(), originalSnapshot);
  purchase.placement = { x: 2, y: 3, bearing: 4 };
  const secondKey = randomUUID();
  await command(purchase, prices.cameraCents, secondKey);
  assert.deepEqual(current.cameras.find(camera=>camera.id===secondKey).placement, purchase.placement);
  assert.equal(current.cashCents,originalSnapshot.cashCents-prices.cameraCents);
  assert.equal((await send(purchase, prices.cameraCents, secondKey, originalSnapshot)).receipt.replayed,true);
  await assert.rejects(send(purchase, prices.cameraCents), /warehouse_security_camera_position/);
  await assert.rejects(send({ action: "subscribe" }, prices.monitoringCents), /warehouse_security_alarm_required/);
  const beforeAlarm = current.cashCents;
  await command({ action: "buy-install-alarm" }, prices.alarmCents);
  assert.equal(current.cashCents,beforeAlarm-prices.alarmCents);
  assert.equal(current.alarm, "installed");
  await command({ action: "subscribe" }, prices.monitoringCents);
  const period = current.monitoring.paidUntil;
  assert.equal(current.monitoring.enabled, true);
  await command({ action: "pause" }, 0);
  assert.equal(current.monitoring.enabled, false);
  await command({ action: "subscribe" }, 0);
  assert.equal(current.monitoring.paidUntil, period);
  await command({ action: "cancel" }, 0);
  assert.deepEqual(current.monitoring, { status: "cancelled", enabled: true, paidUntil: period });
  await command({ action: "subscribe" }, 0);
  const cash = current.cashCents;

  async function makeDue() {
    await db.query("UPDATE kq_warehouse_security SET paid_until=now()-interval '1 hour' WHERE user_id=$1", [user]);
    await db.query("UPDATE kq_online_accounts SET settled_until=now()-interval '2 hours' WHERE user_id=$1", [user]);
  }
  await makeDue();
  assert.deepEqual(await scalar("SELECT rpc_kq_online_settle_due(100)"), { processedUsers: 1, failedUsers: 0, deferredUsers: 0 });
  current = await read();
  assert.equal(current.monitoring.status, "active");
  assert.equal(current.cashCents, cash - prices.monitoringCents);
  assert.equal((await read()).cashCents, current.cashCents);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1", [user]);
  await makeDue();
  current = await read();
  assert.equal(current.cashCents, 0);
  assert.equal(current.monitoring.status, "suspended");
  assert.equal(current.monitoring.enabled, false);
  assert.equal(current.alarm, "installed");
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=$2 WHERE user_id=$1", [user, prices.monitoringCents]);
  await command({ action: "subscribe" }, prices.monitoringCents);
  assert.equal(current.cashCents, 0);
  assert.equal(current.monitoring.enabled, true);
  assert.equal(await scalar("SELECT count(*)::integer FROM security_test_assets WHERE user_id=$1", [user]), 3);
  assert.equal(await scalar("SELECT count(*)::integer FROM audit_treasury_pairs WHERE user_id=$1 AND event='warehouse-security-monitoring'", [user]), 3);
  for (const role of ["anon", "authenticated", "service_role"]) {
    assert.equal(await scalar("SELECT has_table_privilege($1,'kq_warehouse_security','SELECT,INSERT,UPDATE,DELETE')", [role]), false);
    assert.equal(await scalar("SELECT has_function_privilege($1,'rpc_kq_warehouse_security_snapshot(uuid)','EXECUTE')", [role]), role === "service_role");
  }
  console.log("Warehouse security PostgreSQL checks passed.");
} finally { await db.close(); }
