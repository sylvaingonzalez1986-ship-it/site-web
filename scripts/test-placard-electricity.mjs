// In-memory PostgreSQL only. No .env, Supabase client or network connection.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PGlite } from "../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const vite = await createServer({
  configFile: false, envDir: false,
  resolve: { alias: { "@": path.resolve("src") } },
  server: { middlewareMode: true, watch: null },
});
const migration = (name) => readFile(path.resolve("supabase/migrations", name), "utf8");

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';
    CREATE TABLE public.lottery_card_definitions(id UUID PRIMARY KEY, code TEXT, description TEXT, updated_at TIMESTAMPTZ);
    CREATE TABLE public.kq_support_card_rules(card_definition_id UUID, advantage TEXT, rules_version INTEGER, updated_at TIMESTAMPTZ);
    CREATE TABLE public.kq_runs(id UUID PRIMARY KEY, user_id UUID, state JSONB, status TEXT);
    CREATE TABLE public.kq_flowers(id UUID PRIMARY KEY, owner_id UUID, status TEXT);
    CREATE TABLE public.kq_equipment_wallets(
      user_id UUID PRIMARY KEY, cash_cents INTEGER NOT NULL DEFAULT 0 CHECK(cash_cents >= 0),
      reputation INTEGER NOT NULL DEFAULT 0 CHECK(reputation >= 0),
      planned_route_code TEXT, planned_equipment_code TEXT, updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE FUNCTION public.rpc_kq_ensure_equipment_profile(p_user_id UUID) RETURNS VOID
      LANGUAGE sql AS 'INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING';
  `);
  for (const name of [
    "20260830000200_kq_post_harvest_market.sql",
    "20260904000200_kq_route_masteries.sql",
    "20260905000100_kq_route_expertise_rewards.sql",
  ]) await db.exec(await migration(name));

  const createUser = async (reputation = 100) => {
    const id = randomUUID();
    await db.query("INSERT INTO auth.users VALUES ($1)", [id]);
    await db.query("INSERT INTO kq_equipment_wallets(user_id, reputation) VALUES ($1, $2)", [id, reputation]);
    return id;
  };
  const createLot = async (user, route, score, version = 2) => {
    const flower = randomUUID();
    const key = randomUUID();
    await db.query("INSERT INTO kq_flowers VALUES ($1,$2,'burned')", [flower, user]);
    // Deliberately wrong positive gain: the new settlement must ignore this field.
    await db.query(`INSERT INTO kq_market_lots(flower_id,owner_id,harvest_grams,jury_score,quality_band,options)
      VALUES ($1,$2,100,$3,'selection',$4::jsonb)`, [flower, user, score, JSON.stringify([
      { route, available: true, payoutCents: 1000, reputationGain: 77, reputationPolicyVersion: version },
    ])]);
    return { user, flower, key, route };
  };
  const settle = async ({ user, flower, key, route }) => (await db.query(
    "SELECT rpc_kq_sell_market_lot($1,$2,$3,$4) AS receipt", [user, flower, key, route],
  )).rows[0].receipt;


  await db.exec(await migration("20260909000100_kq_quality_reputation.sql"));
  await db.exec(await migration("20260911000300_kq_cycle_electricity.sql"));
  const { quoteKqEnergy } = await vite.ssrLoadModule("/src/lib/kanab-quest-energy.ts");
  const quote = quoteKqEnergy(["LED-150-STARTER", "AIR-STARTER"]);
  const createRun = async (user, energy = quote) => {
    const id = randomUUID();
    await db.query("INSERT INTO kq_runs VALUES($1,$2,$3,'active')", [id, user, JSON.stringify({...(energy ? {energy} : {}), harvestGrams: 100, equipment: {codes: ["LED-150-STARTER","AIR-STARTER"]}})]);
    return id;
  };
  const finish = (id) => db.query("UPDATE kq_runs SET status='completed' WHERE id=$1", [id]);
  const snapshot = async user => (await db.query("SELECT rpc_kq_energy_snapshot($1) AS s", [user])).rows[0].s;
  const pay = async (user, key, amount) => (await db.query("SELECT rpc_kq_pay_energy($1,$2,$3) AS r", [user,key,amount])).rows[0].r;
  const user = await createUser();
  const other = await createUser();
  const run = await createRun(user);
  assert.equal((await snapshot(user)).outstandingCents, 0);
  await assert.rejects(() => db.query("UPDATE kq_runs SET state=jsonb_set(state,'{energy,totalCents}','0') WHERE id=$1", [run]), /kq_energy_quote_immutable/);
  await assert.rejects(() => db.query("UPDATE kq_runs SET state=jsonb_set(state,'{equipment}','{}') WHERE id=$1", [run]), /kq_energy_quote_immutable/);
  await finish(run); await finish(run);
  assert.equal((await snapshot(user)).outstandingCents, 603);
  assert.equal((await snapshot(user)).invoiceCount, 1);
  assert.equal((await snapshot(other)).outstandingCents, 0);
  const legacy = await createRun(user,null); await finish(legacy);
  assert.equal((await snapshot(user)).invoiceCount, 1);
  const aborted = await createRun(user);
  await db.exec('BEGIN'); await finish(aborted); await db.exec('ROLLBACK');
  assert.equal((await snapshot(user)).invoiceCount, 1);
  await assert.rejects(() => pay(user,randomUUID(),603), /insufficient_equipment_cash/);
  assert.equal((await snapshot(user)).outstandingCents,603);
  const second = await createRun(user); await finish(second);
  // Explicit dates make FIFO deterministic regardless of clock resolution.
  await db.query("UPDATE kq_energy_invoices SET created_at='2026-09-01' WHERE run_id=$1",[run]);
  const lot = await createLot(user,'dry-sift',8.8);
  const receipt = await settle(lot);
  assert.equal(receipt.payoutCents,1000); assert.equal(receipt.electricityPaidCents,500);
  assert.equal(receipt.netPayoutCents,500); assert.equal(receipt.cashAfterCents,500);
  assert.deepEqual(await settle(lot), {...receipt,replayed:true});
  let snap = await snapshot(user);
  assert.equal(snap.outstandingCents,706);
  assert.equal(snap.invoices.find(i=>i.runId===run).remainingCents,103);
  assert.equal(snap.invoices.find(i=>i.runId===second).remainingCents,603);
  await assert.rejects(() => pay(user,randomUUID(),603), /energy_balance_changed/);
  const receipt2 = await settle(await createLot(user,'dry-sift',8.8));
  assert.equal(receipt2.electricityPaidCents,500);
  assert.equal((await snapshot(user)).outstandingCents,206);
  const key = randomUUID(); const paid = await pay(user,key,206);
  assert.equal(paid.paidCents,206); assert.equal(paid.cashAfterCents,794);
  assert.deepEqual(await pay(user,key,206), {...paid,replayed:true});
  await assert.rejects(() => pay(user,key,207), /energy_request_mismatch/);
  assert.equal((await snapshot(user)).outstandingCents,0);
  const receipt3 = await settle(await createLot(user,'dry-sift',8.8));
  assert.equal(receipt3.electricityPaidCents,0); assert.equal(receipt3.netPayoutCents,1000);
  await finish(await createRun(other));
  const last = await settle(await createLot(other,'dry-sift',8.8));
  assert.equal(last.electricityPaidCents,500);
  const small = await settle(await createLot(other,'dry-sift',8.8));
  assert.equal(small.electricityPaidCents,103); assert.equal(small.netPayoutCents,897);
  assert.equal((await snapshot(user)).outstandingCents,0);
  const grants = await db.query("SELECT has_function_privilege('authenticated','public.rpc_kq_pay_energy(uuid,uuid,integer)','EXECUTE') AS allowed");
  assert.equal(grants.rows[0].allowed,false);
  console.log("PASS: cycle invoices, immutable quotes, legacy exemption, rollback, FIFO, capped sales deductions, account isolation, insufficient funds, stale amounts and idempotent payments/sales.");
} finally { await vite.close(); await db.close(); }
