import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const user = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const flower = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
const sql = (name: string) => readFileSync(`supabase/migrations/${name}`, "utf8");
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${user}'), ('${other}');
    CREATE TABLE public.kq_random_battle_queue(flower_id UUID PRIMARY KEY, owner_id UUID UNIQUE,
      queued_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE public.reward_calls(kind TEXT, user_id UUID, transaction_id BIGINT DEFAULT txid_current());
    CREATE FUNCTION public.rpc_kq_sync_order_cash_rewards(p_user_id UUID) RETURNS JSONB LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO public.reward_calls(kind,user_id) VALUES ('cash', p_user_id);
      IF current_setting('test.cash_failure', true) = 'yes' THEN RAISE EXCEPTION 'synthetic failure'; END IF;
      RETURN '{}'::JSONB;
    END $$;
    CREATE FUNCTION public.rpc_kq_sync_contest_bundle_rewards(p_user_id UUID) RETURNS JSONB LANGUAGE plpgsql AS $$
    BEGIN INSERT INTO public.reward_calls(kind,user_id) VALUES ('bundle', p_user_id); RETURN '{}'::JSONB; END $$;
  `);
  await db.exec(sql("20261011000400_random_queue_budget.sql"));
  await db.exec(sql("20261011000500_bootstrap_reward_budget.sql"));
}, 30000);
afterAll(async () => { await db?.close(); });

async function poll(owner = user, id = flower) {
  const result = await db.query<{ result: { matchStatus: string; retryMatch?: boolean } }>(
    "SELECT public.rpc_kq_poll_random_battle_queue($1,$2) AS result", [owner, id]);
  return result.rows[0].result;
}
async function sync(kind: "cash" | "bundle", owner = user) {
  const result = await db.query<{ result: { ok: boolean; reused: boolean } }>(
    "SELECT public.rpc_kq_sync_bootstrap_reward($1,$2) AS result", [owner, kind]);
  return result.rows[0].result;
}

describe("bounded queue recovery", () => {
  it("keeps ownership private and does no recovery work when alone", async () => {
    await db.exec(`INSERT INTO public.kq_random_battle_queue(flower_id,owner_id,reconcile_after)
      VALUES ('${flower}','${user}',now()-interval '1 hour')`);
    expect(await poll(other)).toEqual({ matchStatus: "idle" });
    expect(await poll()).toMatchObject({ matchStatus: "queued", retryMatch: false });
    const before = (await db.query("SELECT reconcile_after FROM public.kq_random_battle_queue")).rows;
    for (let i = 0; i < 5; i++) await poll();
    expect((await db.query("SELECT reconcile_after FROM public.kq_random_battle_queue")).rows).toEqual(before);
  });
  it("claims at most one recovery per two minutes when another entry exists", async () => {
    await db.exec(`INSERT INTO public.kq_random_battle_queue(flower_id,owner_id) VALUES ('${other}','${other}')`);
    expect(await poll()).toMatchObject({ retryMatch: true });
    const results = await Promise.all(Array.from({ length: 10 }, () => poll()));
    expect(results.every(result => result.retryMatch === false)).toBe(true);
    await db.exec(`UPDATE public.kq_random_battle_queue SET reconcile_after=now()-interval '1 second' WHERE owner_id='${user}'`);
    expect(await poll()).toMatchObject({ retryMatch: true });
    await db.exec(`DELETE FROM public.kq_random_battle_queue WHERE owner_id='${user}'`);
    expect(await poll()).toEqual({ matchStatus: "idle" });
  });
});

describe("bootstrap reward reconciliation", () => {
  it("runs each repair in its own transaction and reuses checks across subsequent visits", async () => {
    expect(await sync("cash")).toEqual({ ok: true, reused: false });
    expect(await sync("bundle")).toEqual({ ok: true, reused: false });
    expect(await sync("cash")).toEqual({ ok: true, reused: true });
    expect(await sync("bundle")).toEqual({ ok: true, reused: true });
    expect((await db.query("SELECT * FROM public.reward_calls WHERE user_id=$1", [user])).rows).toHaveLength(2);
    const transactions = await db.query<{ count: number }>(
      "SELECT COUNT(DISTINCT transaction_id)::INTEGER AS count FROM public.reward_calls WHERE user_id=$1", [user]);
    expect(transactions.rows[0].count).toBe(2);
    await db.exec(`UPDATE public.kq_reward_sync_checks SET cash_checked_at=now()-interval '6 minutes', bundle_checked_at=now()-interval '6 minutes'`);
    await sync("cash");
    await sync("bundle");
    expect((await db.query("SELECT * FROM public.reward_calls WHERE user_id=$1", [user])).rows).toHaveLength(4);
  });
  it("isolates failed rewards, rolls back partial grants, retries failure and keeps users separate", async () => {
    await db.exec("SET test.cash_failure='yes'");
    expect(await sync("cash", other)).toEqual({ ok: false, reused: false });
    expect(await sync("bundle", other)).toEqual({ ok: true, reused: false });
    expect((await db.query("SELECT kind FROM public.reward_calls WHERE user_id=$1", [other])).rows).toEqual([{ kind: "bundle" }]);
    await db.exec("SET test.cash_failure='no'");
    expect(await sync("cash", other)).toEqual({ ok: true, reused: false });
    expect(await sync("bundle", other)).toEqual({ ok: true, reused: true });
    expect((await db.query("SELECT kind FROM public.reward_calls WHERE user_id=$1 ORDER BY kind", [other])).rows).toEqual([{ kind: "bundle" }, { kind: "cash" }]);
  });
  it("keeps checkpoints inaccessible to Data API roles and grants only service RPC execution", async () => {
    const permissions = await db.query<{ readable: boolean; callable: boolean; anonymous: boolean }>(`SELECT
      has_table_privilege('service_role','public.kq_reward_sync_checks','SELECT') AS readable,
      has_function_privilege('service_role','public.rpc_kq_sync_bootstrap_reward(uuid,text)','EXECUTE') AS callable,
      has_function_privilege('anon','public.rpc_kq_sync_bootstrap_reward(uuid,text)','EXECUTE') AS anonymous`);
    expect(permissions.rows[0]).toEqual({ readable: false, callable: true, anonymous: false });
  });
});
