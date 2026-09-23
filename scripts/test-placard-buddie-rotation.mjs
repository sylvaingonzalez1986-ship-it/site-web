// Isolated PostgreSQL checks; no credentials, network or deployed database writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const migration = (name) => readFile(`supabase/migrations/${name}`, "utf8");
const codes = Array.from({ length: 6 }, (_, i) => `HH2026-0${20 + i}`);
const scenarios = Array.from({ length: 6 }, (_, i) => `SIT-00${i + 1}`);
const rotation = async (owner) => (await db.query(
  "SELECT recent_buddie_codes FROM kq_buddie_rotation WHERE user_id=$1", [owner],
)).rows[0]?.recent_buddie_codes ?? [];
const balance = async (owner) => (await db.query(
  "SELECT balance FROM kq_culture_token_wallets WHERE user_id=$1", [owner],
)).rows[0].balance;
const finish = (id, status = "completed") => db.query(
  "UPDATE kq_runs SET status=$2, completed_at=CASE WHEN $2='completed' THEN now() ELSE NULL END WHERE id=$1", [id, status],
);
const start = async (owner, code, { tokens = 0, heritage = true } = {}) => {
  const initial = { xp: 1 + tokens, deckCodes: [], usedCards: [], playedThisStage: [] };
  const name = heritage ? "rpc_kq_start_run_with_heritage" : "rpc_kq_start_run";
  return (await db.query(`SELECT ${name}($1,$2,123,$3::TEXT[],$4::TEXT[],$5::JSONB,$6) AS data`,
    [owner, code, [], scenarios, JSON.stringify(initial), tokens])).rows[0].data;
};
const player = async () => {
  const owner = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [owner]);
  await db.query("INSERT INTO kq_culture_token_wallets(user_id,balance) VALUES($1,10)", [owner]);
  // Owning multiple physical copies must not circumvent a card-code cooldown.
  await db.query("INSERT INTO lottery_card_instances(user_id,card_definition_id) SELECT $1,id FROM lottery_card_definitions CROSS JOIN generate_series(1,2)", [owner]);
  return owner;
};
const history = async (owner, sequence) => {
  for (const [i, code] of sequence.entries()) await db.query(
    `INSERT INTO kq_runs(user_id,buddie_card_definition_id,seed,deck_codes,scenario_codes,state,status,started_at)
     SELECT $1,id,1,ARRAY[]::TEXT[],$3::TEXT[],'{}','abandoned',TIMESTAMPTZ '2026-09-01' + $4 * INTERVAL '1 day'
     FROM lottery_card_definitions WHERE code=$2`, [owner, code, scenarios, i],
  );
};
const locked = (owner, code, remaining, options) => assert.rejects(() => start(owner, code, options), error => {
  assert.equal(error.message, "kq_buddie_rotation_locked");
  assert.deepEqual(JSON.parse(error.detail), { buddieCode: code, remainingDistinctBuddies: remaining });
  return true;
});

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TABLE lottery_card_definitions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT UNIQUE,is_active BOOLEAN DEFAULT true,updated_at TIMESTAMPTZ);
    CREATE TABLE lottery_card_instances(id UUID DEFAULT gen_random_uuid(),user_id UUID,card_definition_id UUID);
    CREATE TABLE kq_support_card_rules(card_definition_id UUID,category TEXT);
    CREATE TABLE kq_heritage_card_definitions(code TEXT,name TEXT,timing TEXT,effect_code TEXT,producer_id UUID,producer_name TEXT,image_url TEXT,is_active BOOLEAN);
    CREATE TABLE kq_heritage_draws(user_id UUID,card_code TEXT);
    CREATE TABLE kq_culture_token_wallets(user_id UUID PRIMARY KEY,balance INTEGER DEFAULT 0,updated_at TIMESTAMPTZ);
    CREATE TABLE kq_culture_token_ledger(user_id UUID,run_id UUID,amount INTEGER,reason TEXT,reward_key TEXT UNIQUE);
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES auth.users(id),
      buddie_card_definition_id UUID NOT NULL REFERENCES lottery_card_definitions(id),seed INTEGER,deck_codes TEXT[],scenario_codes TEXT[],
      state JSONB,status TEXT DEFAULT 'active',culture_tokens_spent INTEGER DEFAULT 0,heritage_code TEXT,
      started_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ DEFAULT now(),completed_at TIMESTAMPTZ,
      CONSTRAINT kq_runs_deck_codes_check CHECK(cardinality(deck_codes)>=1));
    CREATE UNIQUE INDEX one_active_run ON kq_runs(user_id) WHERE status='active';
  `);
  await db.exec(await migration("20260910000100_kq_living_soil_default.sql"));
  const heritageMigration = await migration("20260906000500_kq_dynamic_producer_heritages.sql");
  const heritageStart = heritageMigration.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_start_run_with_heritage(");
  await db.exec(heritageMigration.slice(heritageStart, heritageMigration.indexOf("$$;", heritageStart) + 3));
  for (const code of codes) await db.query("INSERT INTO lottery_card_definitions(code) VALUES($1)", [code]);

  const legacy = await player(), older = await player(), owner = await player(), stranger = await player();
  await history(legacy, [codes[0], codes[1], codes[1], codes[2], codes[3], codes[4]]);
  await history(older, [...codes, codes[5], codes[5]]);
  const sql = await migration("20260923000100_kq_buddie_rotation.sql");
  await db.exec(sql);
  assert.deepEqual(await rotation(legacy), codes.slice(0, 5).reverse());
  assert.deepEqual(await rotation(older), codes.slice(1).reverse());
  await locked(legacy, codes[0], 1);
  const olderRun = await start(older, codes[0]); await finish(olderRun.run.id);
  assert.deepEqual(await rotation(owner), []);

  const first = await start(owner, codes[0]);
  assert.deepEqual(await rotation(owner), [codes[0]]);
  await finish(first.run.id);
  await finish(first.run.id); // Replayed completion must not advance history.
  await locked(owner, codes[0], 5);
  await locked(owner, codes[0], 5, { heritage: false });
  assert.equal(await balance(owner), 10);
  assert.deepEqual(await rotation(owner), [codes[0]]);
  for (let i = 1; i <= 5; i++) {
    const result = await start(owner, codes[i], { heritage: i % 2 === 0 });
    await finish(result.run.id, i === 2 ? "abandoned" : "completed");
    if (i < 5) await locked(owner, codes[0], 5 - i);
  }
  assert.deepEqual(await rotation(owner), codes.slice(1).reverse());
  const favorite = await start(owner, codes[0]); await finish(favorite.run.id);
  assert.deepEqual(await rotation(owner), [codes[0], ...codes.slice(2).reverse()]);
  await locked(owner, codes[0], 5);
  await locked(owner, codes[2], 1);

  // A different account can use the same Buddie immediately.
  const other = await start(stranger, codes[0]); await finish(other.run.id);
  assert.deepEqual(await rotation(stranger), [codes[0]]);

  // Failed transactions cannot consume tokens or unlock another Buddie.
  const before = await rotation(owner);
  await db.exec("BEGIN");
  const rolledBack = await start(owner, codes[1], { tokens: 1 });
  assert.equal(await balance(owner), 9);
  await db.exec("ROLLBACK");
  assert.equal(await balance(owner), 10);
  assert.deepEqual(await rotation(owner), before);
  assert.equal((await db.query("SELECT id FROM kq_runs WHERE id=$1", [rolledBack.run.id])).rows.length, 0);
  assert.equal((await db.query("SELECT * FROM kq_culture_token_ledger WHERE user_id=$1", [owner])).rows.length, 0);

  // A skipped INSERT replay neither fails the guard nor advances its history.
  await db.query(`INSERT INTO kq_runs SELECT * FROM kq_runs WHERE id=$1 ON CONFLICT (id) DO NOTHING`, [favorite.run.id]);
  assert.deepEqual(await rotation(owner), before);
  await db.exec(sql); // Reapplying the migration preserves already tracked history.
  assert.deepEqual(await rotation(owner), before);
  const privileges = (await db.query(`SELECT
    has_table_privilege('authenticated','kq_buddie_rotation','UPDATE') AS client_write,
    has_table_privilege('authenticated','kq_buddie_rotation','SELECT') AS client_read,
    has_table_privilege('service_role','kq_buddie_rotation','SELECT') AS server_read,
    has_table_privilege('service_role','kq_buddie_rotation','UPDATE') AS server_write,
    has_function_privilege('authenticated','kq_guard_buddie_rotation()','EXECUTE') AS client_execute,
    (SELECT relrowsecurity FROM pg_class WHERE oid='kq_buddie_rotation'::regclass) AS rls`)).rows[0];
  assert.deepEqual(privileges, { client_write: false, client_read: false, server_read: true, server_write: false, client_execute: false, rls: true });
  console.log("Buddie rotation: PASS (actual starter RPCs, distinct backfill, five-other unlock, failed cultures, duplicate copies, rollback, replay and permissions).");
} finally {
  await db.close();
}
