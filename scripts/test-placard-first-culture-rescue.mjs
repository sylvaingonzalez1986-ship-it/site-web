// Execute the real grant trigger and heritage wrapper in an isolated PostgreSQL
// engine. No environment files, network connections or production data are used.
// PGlite is sequential: the shared advisory-lock contract is checked separately
// by kanab-quest-first-culture-rescue-schema.test.ts, not claimed as a race test.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
let checks = 0;
const query = async (sql, values = []) => (await db.query(sql, values)).rows[0];
const initialState = { phase: "prepare", xp: 1, history: [], deckCodes: [], usedCards: [] };
const insertRun = async (owner, state = initialState, status = "active") => query(
  "INSERT INTO public.kq_runs(user_id,state,status) VALUES($1,$2::jsonb,$3) RETURNING *",
  [owner, JSON.stringify(state), status],
);
async function check(name, run) {
  await db.exec("BEGIN");
  try { await run(); console.log(`PASS ${name}`); checks++; }
  finally { await db.exec("ROLLBACK"); }
}

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.kq_runs(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL,
      state JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'active',
      heritage_code TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX uq_kq_one_active_run_per_user ON public.kq_runs(user_id) WHERE status='active';
    CREATE TABLE public.kq_heritage_card_definitions(
      code TEXT, name TEXT, timing TEXT, effect_code TEXT, producer_name TEXT,
      image_url TEXT, is_active BOOLEAN, producer_id UUID
    );
    CREATE TABLE public.kq_heritage_draws(user_id UUID,card_code TEXT);
    -- Only the base start fixture is minimal. The wrapper loaded below is real,
    -- including its post-insert overwrite and RETURNING persisted run state.
    CREATE FUNCTION public.rpc_kq_start_run(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER)
    RETURNS JSONB LANGUAGE plpgsql AS $$
    DECLARE started public.kq_runs%ROWTYPE;
    BEGIN
      INSERT INTO public.kq_runs(user_id,state) VALUES($1,$6) RETURNING * INTO started;
      RETURN jsonb_build_object('run',to_jsonb(started));
    END;
    $$;
  `);
  const legacyOwner = randomUUID();
  const legacy = await insertRun(legacyOwner);
  const migration = await readFile("supabase/migrations/20261007000200_kq_first_culture_rescue.sql", "utf8");
  await db.exec(migration);
  const heritage = await readFile("supabase/migrations/20260906000500_kq_dynamic_producer_heritages.sql", "utf8");
  await db.exec(heritage.slice(
    heritage.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_start_run_with_heritage("),
    heritage.indexOf("CREATE OR REPLACE FUNCTION public.kq_protect_run_heritage_identity()"),
  ));

  await check("first run receives the database-owned rescue even if input denies it", async () => {
    const run = await insertRun(randomUUID(), { ...initialState, firstCultureRescue: false });
    assert.equal(run.state.firstCultureRescue, true);
    assert.deepEqual(run.state.history, []);
  });

  await check("the real heritage wrapper preserves and returns the inserted grant", async () => {
    const { result } = await query(
      "SELECT public.rpc_kq_start_run_with_heritage($1,'HH2026-100',1,ARRAY[]::TEXT[],ARRAY[]::TEXT[],$2::JSONB,0,NULL) result",
      [randomUUID(), JSON.stringify(initialState)],
    );
    assert.equal(result.run.state.firstCultureRescue, true);
    assert.equal(result.run.state.xp, 1);
    const saved = await query("SELECT state FROM public.kq_runs WHERE id=$1", [result.run.id]);
    assert.deepEqual(result.run.state, saved.state);
  });

  for (const previousStatus of ["completed", "abandoned"]) {
    await check(`${previousStatus} history prevents any grant on the next run`, async () => {
      const owner = randomUUID();
      await insertRun(owner, initialState, previousStatus);
      const second = await insertRun(owner, { ...initialState, firstCultureRescue: true });
      assert.equal(Object.hasOwn(second.state, "firstCultureRescue"), false);
    });
  }

  await check("legacy runs are untouched and cannot acquire a grant through state updates", async () => {
    const before = await query("SELECT state FROM public.kq_runs WHERE id=$1", [legacy.id]);
    assert.deepEqual(before.state, initialState);
    const after = await query("UPDATE public.kq_runs SET state=$2::JSONB WHERE id=$1 RETURNING state", [
      legacy.id, JSON.stringify({ ...initialState, firstCultureRescue: true }),
    ]);
    assert.deepEqual(after.state, initialState);
  });

  await check("saving a consumed rescue retains its grant and consumption across reload", async () => {
    const run = await insertRun(randomUUID());
    const history = [{ total: 0 }, { total: 0, rescued: true }];
    const state = { ...initialState, phase: "resolved", history };
    const saved = await query("UPDATE public.kq_runs SET state=$2::JSONB WHERE id=$1 RETURNING state", [run.id, JSON.stringify(state)]);
    assert.equal(saved.state.firstCultureRescue, true);
    assert.deepEqual(saved.state.history, history);
    const reloaded = await query("SELECT state FROM public.kq_runs WHERE id=$1", [run.id]);
    assert.deepEqual(reloaded.state, saved.state);
  });

  await check("API roles cannot call the trigger routine directly", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      const privilege = await query("SELECT has_function_privilege($1,'public.kq_guard_first_culture_rescue()','EXECUTE') allowed", [role]);
      assert.equal(privilege.allowed, false);
    }
  });
  console.log(`${checks} isolated PostgreSQL checks passed (sequential engine).`);
} finally {
  await db.close();
}
