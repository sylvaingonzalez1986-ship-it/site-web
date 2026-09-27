// Isolated PostgreSQL regression for the published flat snapshot / individual-tent mismatch.
// No credentials, network access or writes outside the in-memory database and test report.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? "output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";
const { PGlite } = await import(pathToFileURL(resolve(modulePath)).href);
const db = new PGlite();
const migration = name => readFile(`supabase/migrations/${name}`, "utf8");
const tentsSql = await migration("20260924000300_kq_individual_tents.sql");
const expansionSql = await migration("20260923001000_kq_production_expansion.sql");
const wearSql = await migration("20260919000500_kq_culture_equipment_wear.sql");
const functionSql = (source, name) => {
  const start = source.search(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\(`));
  assert.ok(start >= 0, `Missing actual migration function: ${name}`);
  const end = source.indexOf("$$;", start);
  assert.ok(end > start, `Missing SQL function terminator: ${name}`);
  return source.slice(start, end + 3);
};
const rows = async (sql, values = []) => (await db.query(sql, values)).rows;
const scalar = async (sql, values = []) => (await rows(sql, values))[0].value;
const checks = [];
const check = async (name, run) => { await run(); checks.push(name); };
const starterPairs = [["tent", "TENT-080-STARTER"], ["lighting", "LED-150-STARTER"], ["air", "AIR-STARTER"]];
const starters = starterPairs.map(([, code]) => code);
// Anonymized structure of the affected production account: tent 1 advanced, tent 2 starter.
const advanced = [
  ["air", "AIR-EC6", 10, 21], ["climate-controller", "CLIMATE-SMART", 10, 14],
  ["energy", "SOLAR-BACKUP", 5, 14], ["filtration", "AUTO-SIEVE", 1, 0],
  ["flower-drying", "DRYING-ROOM", 5, 14], ["lighting", "LED-300", 10, 35],
  ["press", "PRESS-0600", 5, 0], ["security", "SECURITY-CAMERA", 9, 6],
  ["sifting", "SIFT-TRAY", 7, 0], ["tent", "TENT-120", 10, 13],
  ["washing", "WASHER-25L", 9, 0],
];
const start = (owner, equipment) => db.query(
  "INSERT INTO kq_runs(user_id,state) VALUES($1,$2) RETURNING id",
  [owner, JSON.stringify({ equipment })],
);
const snapshot = async owner => {
  const productionUnits = await scalar("SELECT production_units AS value FROM kq_equipment_wallets WHERE user_id=$1", [owner]);
  const tents = [];
  for (let tentNumber = 1; tentNumber <= productionUnits; tentNumber++) {
    const items = await rows(`SELECT e.equipment_code,e.level FROM kq_equipment_loadouts l
      JOIN kq_player_equipment e USING(user_id,tent_number,equipment_code)
      WHERE l.user_id=$1 AND l.tent_number=$2 ORDER BY l.slot`, [owner, tentNumber]);
    tents.push({ tentNumber, codes: items.map(row => row.equipment_code), levels: Object.fromEntries(items.map(row => [row.equipment_code, row.level])) });
  }
  return { codes: tents[0].codes, levels: tents[0].levels, productionUnits, tents };
};
// HEAD 92d1f8d reads every loadout without tent_number, deduplicates codes, and
// turns all owned rows into one level map. This projection is exact for healthy
// fixture equipment; unrelated game-state fields are not read by the SQL guard.
const publishedSnapshot = async owner => {
  const equipment = await snapshot(owner);
  const owned = await rows("SELECT equipment_code,level FROM kq_player_equipment WHERE user_id=$1 ORDER BY tent_number,equipment_code", [owner]);
  return { productionUnits: equipment.productionUnits, codes: [...new Set(equipment.tents.flatMap(tent => tent.codes))], levels: Object.fromEntries(owned.map(row => [row.equipment_code, row.level])) };
};
const createPlayer = async units => {
  const owner = randomUUID();
  await db.query("INSERT INTO kq_equipment_wallets(user_id,production_units) VALUES($1,$2)", [owner, units]);
  await db.query("SELECT rpc_kq_ensure_equipment_profile($1)", [owner]);
  return owner;
};
const equipAdvanced = async (owner, tentNumber) => {
  for (const [slot, code, level, wear] of advanced) {
    await db.query("INSERT INTO kq_player_equipment(user_id,tent_number,equipment_code,level,culture_wear_percent,purchase_price_cents) VALUES($1,$2,$3,$4,$5,10000)", [owner, tentNumber, code, level, wear]);
    await db.query("INSERT INTO kq_equipment_loadouts(user_id,tent_number,slot,equipment_code) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,tent_number,slot) DO UPDATE SET equipment_code=EXCLUDED.equipment_code", [owner, tentNumber, slot, code]);
  }
};

try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY,production_units INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE kq_equipment_catalog(code TEXT PRIMARY KEY,slot TEXT NOT NULL,is_active BOOLEAN NOT NULL DEFAULT true,is_purchasable BOOLEAN NOT NULL);
    CREATE TABLE kq_player_equipment(user_id UUID,tent_number INTEGER,equipment_code TEXT,level INTEGER NOT NULL DEFAULT 1,culture_wear_percent INTEGER NOT NULL DEFAULT 0,purchase_price_cents INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,tent_number,equipment_code));
    CREATE TABLE kq_equipment_loadouts(user_id UUID,tent_number INTEGER,slot TEXT,equipment_code TEXT,PRIMARY KEY(user_id,tent_number,slot));
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL,status TEXT NOT NULL DEFAULT 'active',state JSONB NOT NULL);`);
  for (const [slot, code] of [...starterPairs, ...advanced]) {
    await db.query("INSERT INTO kq_equipment_catalog(code,slot,is_purchasable) VALUES($1,$2,$3)", [code, slot, !starters.includes(code)]);
  }
  for (const [source, name] of [
    [wearSql, "kq_culture_equipment_wear_delta"], [expansionSql, "kq_run_production_units"],
    [tentsSql, "rpc_kq_ensure_equipment_profile"], [expansionSql, "kq_guard_culture_equipment_start"],
  ]) await db.exec(functionSql(source, name));
  // Existing guard permissions survive CREATE OR REPLACE, exactly as in migration 003.
  await db.exec("REVOKE ALL ON FUNCTION kq_guard_culture_equipment_start() FROM PUBLIC,anon,authenticated,service_role");
  await db.exec(functionSql(tentsSql, "kq_run_tents"));
  await db.exec(functionSql(tentsSql, "kq_guard_culture_equipment_start"));
  await db.exec("CREATE TRIGGER culture_start_guard BEFORE INSERT ON kq_runs FOR EACH ROW EXECUTE FUNCTION kq_guard_culture_equipment_start()");

  const single = await createPlayer(1);
  await check("Historical one-tent snapshot without productionUnits still starts", () => start(single, { codes: starters, levels: {} }));
  const identical = await createPlayer(2);
  await check("Historical identical two-tent flat snapshot still starts", async () => start(identical, await publishedSnapshot(identical)));
  const mixed = await createPlayer(2);
  await equipAdvanced(mixed, 1);
  const flat = await publishedSnapshot(mixed), correct = await snapshot(mixed);
  await check("Production fixture reproduces HEAD equipment mismatch", () => assert.rejects(() => start(mixed, flat), /kq_culture_equipment_changed/));
  await check("Rejected start inserts no run", async () => assert.equal(await scalar("SELECT count(*)::INTEGER AS value FROM kq_runs WHERE user_id=$1", [mixed]), 0));
  await check("The same mixed installation starts with per-tent state", () => start(mixed, correct));
  await check("Stored snapshot preserves each tent's actual codes and levels", async () => assert.deepEqual(await scalar("SELECT state->'equipment' AS value FROM kq_runs WHERE user_id=$1", [mixed]), correct));
  const twoAdvanced = await createPlayer(2);
  await equipAdvanced(twoAdvanced, 1); await equipAdvanced(twoAdvanced, 2);
  await check("Identically upgraded tents remain compatible with legacy state", async () => start(twoAdvanced, await publishedSnapshot(twoAdvanced)));
  await db.query("UPDATE kq_player_equipment SET level=1 WHERE user_id=$1 AND tent_number=2 AND equipment_code='LED-300'", [twoAdvanced]);
  await check("Same codes with divergent levels reject the flat snapshot", async () => assert.rejects(() => publishedSnapshot(twoAdvanced).then(value => start(twoAdvanced, value)), /kq_culture_equipment_changed/));
  await check("Same codes with divergent levels accept per-tent state", async () => start(twoAdvanced, await snapshot(twoAdvanced)));
  for (const [label, tamper, error] of [
    ["Wrong production capacity", value => { value.productionUnits = 1; }, /kq_production_units_changed/],
    ["Missing tent", value => { value.tents.pop(); }, /kq_culture_equipment_changed/],
    ["Duplicate tent number", value => { value.tents[1].tentNumber = 1; }, /kq_culture_equipment_changed/],
    ["Unowned tent number", value => { value.tents[1].tentNumber = 3; }, /kq_culture_equipment_changed/],
    ["Invented equipment", value => { value.tents[1].codes.push("LED-300"); }, /kq_culture_equipment_changed/],
    ["Invented level", value => { value.tents[0].levels["LED-300"] = 9; }, /kq_culture_equipment_changed/],
    ["Missing equipped item", value => { value.tents[0].codes.pop(); }, /kq_culture_equipment_changed/],
    ["Malformed codes", value => { value.tents[0].codes = {}; }, /kq_culture_equipment_changed/],
  ]) await check(`${label} remains rejected`, async () => {
    const altered = structuredClone(correct); tamper(altered);
    await assert.rejects(() => start(mixed, altered), error);
  });
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=100 WHERE user_id=$1 AND tent_number=1 AND equipment_code='LED-300'", [mixed]);
  await check("Broken equipped item remains rejected", () => assert.rejects(() => start(mixed, correct), /kq_culture_equipment_broken/));
  const fallback = structuredClone(correct);
  fallback.tents[0].codes = fallback.tents[0].codes.filter(code => code !== "LED-300").concat("LED-150-STARTER");
  fallback.tents[0].levels["LED-150-STARTER"] = 1;
  await check("Broken lighting can use the valid starter fallback in its own tent", () => start(mixed, fallback));
  for (const role of ["anon", "authenticated", "service_role"]) {
    await check(`Private trigger has no direct EXECUTE for ${role}`, async () => assert.equal(await scalar("SELECT has_function_privilege($1,'kq_guard_culture_equipment_start()','EXECUTE') AS value", [role]), false));
  }
  const report = {
    passed: true, checks: checks.length, assertions: checks, remoteWrites: 0,
    sourceCommit: "92d1f8d", migration: "20260924000300_kq_individual_tents.sql",
    migrationSha256: createHash("sha256").update(tentsSql).digest("hex"),
    scope: "Actual migration helpers and start guard; minimal local tables; no energy or full gameplay simulation.",
    publishedEquipment: flat, correctedEquipment: correct,
  };
  await mkdir("output/culture-start-fix", { recursive: true });
  await writeFile("output/culture-start-fix/sql-reproduction.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Culture-start compatibility: ${checks.length} checks passed; flat production payload rejected, per-tent payload accepted.`);
} finally {
  await db.close();
}
