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

  const legacyUser = await createUser();
  const legacyLot = await createLot(legacyUser, "dry-sift", 7.5, null);
  const legacyReceipt = await settle(legacyLot);
  await db.exec(await migration("20260909000100_kq_quality_reputation.sql"));
  assert.deepEqual(await settle(legacyLot), { ...legacyReceipt, replayed: true });

  const { calculateKqMarketReputation, KQ_MARKET_ROUTE_CODES } = await vite.ssrLoadModule("/src/lib/kanab-quest-market.ts");
  const cases = KQ_MARKET_ROUTE_CODES.flatMap((route) => Array.from({ length: 101 }, (_, n) => ({ route, score: n / 10 })));
  const sqlResults = await db.query(`SELECT route, score, kq_market_reputation_delta(route,score) AS delta
    FROM jsonb_to_recordset($1::jsonb) AS x(route TEXT,score NUMERIC)`, [JSON.stringify(cases)]);
  for (const row of sqlResults.rows) assert.equal(row.delta, calculateKqMarketReputation(row.route, Number(row.score)), `${row.route} ${row.score}`);
  console.log("PASS: 1,010 SQL/TypeScript score comparisons; historical receipt unchanged.");

  for (const [route, score, expectedBase] of [["rosin-selection", 7.5, -4], ["dry-sift", 7.5, 0], ["dry-sift", 8.8, 10]]) {
    const user = await createUser();
    let expectedBalance = 100;
    for (let count = 1; count <= 10; count++) {
      const lot = await createLot(user, route, score);
      const receipt = await settle(lot);
      const bonus = expectedBase > 0 ? ({ 3: 5, 6: 12, 10: 25 }[count] ?? 0) : 0;
      expectedBalance += expectedBase + bonus;
      assert.equal(receipt.reputationGain, expectedBase + bonus);
      assert.equal(receipt.reputationAfter, expectedBalance);
      assert.equal(receipt.cashAfterCents, count * 1000);
      assert.equal(receipt.routeMastery.expertiseBonusReputation, bonus);
      assert.equal(receipt.routeMastery.routeSales, count);
      assert.deepEqual(await settle(lot), { ...receipt, replayed: true });
      await assert.rejects(() => settle({ ...lot, key: randomUUID() }), /market_lot_unavailable/);
    }
    const mastery = (await db.query("SELECT total_reputation FROM kq_player_route_masteries WHERE user_id=$1 AND route=$2", [user, route])).rows[0];
    assert.equal(mastery.total_reputation, expectedBalance - 100);
  }
  for (const initial of [0, 2]) {
    const user = await createUser(initial);
    const lot = await createLot(user, "rosin-selection", 7.5);
    const receipt = await settle(lot);
    assert.equal(receipt.reputationAfter, 0);
    assert.equal(receipt.reputationGain, initial === 0 ? 0 : -initial);
    assert.deepEqual(await settle(lot), { ...receipt, replayed: true });
  }
  const user = await createUser();
  const staleLot = await createLot(user, "dry-sift", 7.5, null);
  await assert.rejects(() => settle(staleLot), /market_reputation_quote_outdated/);
  const lotState = (await db.query("SELECT status FROM kq_market_lots WHERE flower_id=$1", [staleLot.flower])).rows[0];
  assert.equal(lotState.status, "ready");
  console.log("PASS: 30 sales, quality-gated milestones, signed mastery totals, zero floor, replays and stale quote rejection.");
} finally {
  await vite.close();
  await db.close();
}
