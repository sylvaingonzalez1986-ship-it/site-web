import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { projectKqSocialCultureContext } from "../kanab-quest-social-culture";

const db = new PGlite();
const owner = "10000000-0000-4000-8000-000000000001", other = "10000000-0000-4000-8000-000000000002";
const runId = "20000000-0000-4000-8000-000000000001", flowerId = "30000000-0000-4000-8000-000000000001";
const now = Date.parse("2026-10-24T12:00:00Z");
const sql = (file: string) => readFile(resolve("supabase/migrations", file), "utf8");
async function read(user = owner) {
  return (await db.query<{ result: unknown }>("SELECT public.rpc_kq_social_culture($1) AS result", [user])).rows[0].result;
}

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE kq_runs(id uuid PRIMARY KEY,user_id uuid,state jsonb,status text,updated_at timestamptz,completed_at timestamptz);
    CREATE TABLE kq_flowers(id uuid PRIMARY KEY,run_id uuid,owner_id uuid,variety_code text,variety_name text,created_at timestamptz);
    CREATE TABLE kq_storage_lots(flower_id uuid PRIMARY KEY,user_id uuid,state jsonb,original_units integer,overflow_sold_units integer);
    CREATE TABLE kq_commerce_batches(flower_id uuid PRIMARY KEY);
    CREATE TABLE kq_commerce_stock(flower_id uuid,remaining_units integer,equivalent_units integer,initial_units integer);
    CREATE TABLE kq_market_lots(flower_id uuid PRIMARY KEY,status text);
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
  `);
  // Run the actual existing remaining-stock helper rather than an approximation.
  const capacity = await sql("20261010000300_storage_capacity.sql");
  const helper = capacity.match(/CREATE FUNCTION public\.kq_storage_remaining\(p_flower UUID\)[\s\S]*?REVOKE ALL ON FUNCTION public\.kq_storage_remaining\(UUID\)[^;]*;/)?.[0];
  expect(helper).toBeTruthy();
  await db.exec(helper!);
  await db.exec(await sql("20261024000100_kq_social_culture_context.sql"));
  const state = {
    varietyCode: "BUD-001", varietyName: "Mon cultivar", stageIndex: 3, phase: "prepare", seed: 925, harvestGrams: 200,
    situationCodes: ["FUTURE-SECRET"], deckCodes: ["PRIVATE-CARD"],
    warehouse: { version: 2, zoneId: "zone-a", sourceState: { private: true }, zones: [{ id: "zone-a", name: "Mon indoor" }] },
    history: [{ stage: "Croissance", situation: "Feuillage ponctué", outcome: "fragile", trait: "Feuillage surveillé", dice: [1, 2, 3] }],
    care: { problems: [{ code: "MITES", status: "suspected", variant: 0, appearedAt: 2 },
      { code: "FUTURE-PROBLEM", status: "suspected", variant: 0, appearedAt: 4 },
      { code: "RESOLVED-PRIVATE", status: "resolved", variant: 0, appearedAt: 1 }] },
  };
  await db.query("INSERT INTO kq_runs VALUES($1,$2,$3,'active',$4,NULL)", [runId, owner, JSON.stringify(state), new Date(now).toISOString()]);
  await db.query("INSERT INTO kq_runs VALUES($1,$2,$3,'active',$4,NULL)", ["20000000-0000-4000-8000-000000000002", other, JSON.stringify({ ...state, varietyName: "PRIVATE-OTHER-OWNER" }), new Date(now).toISOString()]);
  await db.query("INSERT INTO kq_runs SELECT ('20000000-0000-4000-8001-'||lpad(n::text,12,'0'))::uuid,$1,$2,'completed',$3,$3 FROM generate_series(1,130) n",
    [owner, JSON.stringify({ ...state, phase: "complete", varietyName: "OLD-COMPLETED" }), new Date(now).toISOString()]);
  await db.query("INSERT INTO kq_flowers VALUES($1,$2,$3,'BUD-001','Mon cultivar',$4)", [flowerId, runId, owner, new Date(now - 3600000).toISOString()]);
  await db.query("INSERT INTO kq_storage_lots VALUES($1,$2,$3,2000,150)", [flowerId, owner, JSON.stringify({ harvestedAt: new Date(now - 3600000).toISOString(), readyAt: new Date(now + 3600000).toISOString(), private: "not exposed" })]);
}, 30000);
afterAll(() => db.close());

describe("read-only service culture projection", () => {
  it("filters ownership and selects only observed fields without transferring full game state", async () => {
    const raw = await read(), context = projectKqSocialCultureContext(raw, now, "own");
    expect(context.runs).toHaveLength(1); expect(context.lots).toHaveLength(1);
    expect(context.runs[0]).toMatchObject({ id: runId, zoneName: "Mon indoor", varietyName: "Mon cultivar", stageIndex: 3, cultivation: "indoor",
      problem: { diagnosis: null, status: "suspected" }, lastResolved: { stageIndex: 2, situation: "Feuillage ponctué" } });
    expect(JSON.stringify(raw)).not.toMatch(/FUTURE-SECRET|FUTURE-PROBLEM|RESOLVED-PRIVATE|OLD-COMPLETED|PRIVATE-CARD|PRIVATE-OTHER-OWNER|seed|situationCodes|sourceState|dice|not exposed/);
    expect(context.lots[0]).toMatchObject({ stage: "curing", cultivation: "indoor", harvestGrams: 200, remainingGrams: 185 });
    expect(projectKqSocialCultureContext(await read(other), now, "own").lots).toEqual([]);
  });
  it("is callable only by service_role and does not broaden private table access", async () => {
    const result = (await db.query<{ service: boolean; anon: boolean; authenticated: boolean; table_read: boolean; volatility: string; secured: boolean }>(`
      SELECT has_function_privilege('service_role','public.rpc_kq_social_culture(uuid)','EXECUTE') AS service,
        has_function_privilege('anon','public.rpc_kq_social_culture(uuid)','EXECUTE') AS anon,
        has_function_privilege('authenticated','public.rpc_kq_social_culture(uuid)','EXECUTE') AS authenticated,
        has_table_privilege('service_role','public.kq_storage_lots','SELECT') AS table_read,
        (SELECT provolatile::text FROM pg_proc WHERE oid='public.rpc_kq_social_culture(uuid)'::regprocedure) AS volatility,
        (SELECT prosecdef AND 'search_path=pg_catalog, public'=ANY(proconfig) FROM pg_proc WHERE oid='public.rpc_kq_social_culture(uuid)'::regprocedure) AS secured
    `)).rows[0];
    expect(result).toEqual({ service: true, anon: false, authenticated: false, table_read: false, volatility: "s", secured: true });
    await db.exec("SET ROLE service_role");
    try { expect(projectKqSocialCultureContext(await read(), now, "own").runs).toHaveLength(1); }
    finally { await db.exec("RESET ROLE"); }
  });
  it("executes inside a read-only transaction without settling storage, selling surplus or changing quantities", async () => {
    const before = (await db.query("SELECT to_jsonb(s) AS state FROM kq_storage_lots s")).rows;
    await db.exec("BEGIN READ ONLY");
    try { await read(); await read(); }
    finally { await db.exec("COMMIT"); }
    expect((await db.query("SELECT to_jsonb(s) AS state FROM kq_storage_lots s")).rows).toEqual(before);
  });
  it("uses remaining prepared stock and the actual maturation deadline rather than original harvest or sale assumptions", async () => {
    await db.query("INSERT INTO kq_commerce_batches VALUES($1)", [flowerId]);
    await db.query("INSERT INTO kq_commerce_stock VALUES($1,10,150,50)", [flowerId]);
    let context = projectKqSocialCultureContext(await read(), now + 3600000, "own");
    expect(context.lots[0]).toMatchObject({ stage: "ready", harvestGrams: 200, remainingGrams: 3 });
    await db.query("UPDATE kq_commerce_stock SET remaining_units=0 WHERE flower_id=$1", [flowerId]);
    context = projectKqSocialCultureContext(await read(), now + 3600000, "own");
    expect(context.lots).toEqual([]);
  });
  it("filters exhausted historical lots before limiting candidate subjects", async () => {
    await db.query("UPDATE kq_commerce_stock SET remaining_units=10 WHERE flower_id=$1", [flowerId]);
    await db.query(`INSERT INTO kq_flowers SELECT ('30000000-0000-4000-8001-'||lpad(n::text,12,'0'))::uuid,$1,$2,'BUD-OLD','Sold old harvest',$3 FROM generate_series(1,150) n`,
      [runId, owner, new Date(now).toISOString()]);
    await db.query(`INSERT INTO kq_storage_lots SELECT id,$1,$2,2000,2000 FROM kq_flowers WHERE variety_code='BUD-OLD'`,
      [owner, JSON.stringify({ harvestedAt: new Date(now).toISOString(), readyAt: new Date(now + 3600000).toISOString() })]);
    const context = projectKqSocialCultureContext(await read(), now, "own");
    expect(context.lots).toHaveLength(1);
    expect(context.lots[0]).toMatchObject({ id: flowerId, remainingGrams: 3, harvestGrams: 200 });
  });
});
