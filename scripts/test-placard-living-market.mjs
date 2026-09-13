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


  await db.exec(await migration("20260909000100_kq_quality_reputation.sql"));
  await db.exec(await migration("20260911000300_kq_cycle_electricity.sql"));
  await db.exec(await migration("20260912000200_kq_living_market.sql"));
  const { quoteKqMarketRoutes } = await vite.ssrLoadModule("/src/lib/kanab-quest-market.ts");
  const { getKqMarketWindow } = await vite.ssrLoadModule("/src/lib/kanab-quest-market-demand.ts");
  const window = getKqMarketWindow();
  const user = randomUUID(), outsider = randomUUID();
  await db.query("INSERT INTO auth.users VALUES ($1),($2)", [user, outsider]);
  await db.query("INSERT INTO kq_equipment_wallets(user_id,reputation) VALUES ($1,0),($2,0)", [user, outsider]);
  const prepare = async (score, overrides = {}) => {
    const flower = randomUUID();
    const reputation = (await db.query("SELECT reputation FROM kq_equipment_wallets WHERE user_id=$1", [user])).rows[0].reputation;
    const routeSales = Object.fromEntries((await db.query("SELECT route, sale_count FROM kq_player_route_masteries WHERE user_id=$1",[user])).rows.map(row=>[row.route,row.sale_count]));
    const options = quoteKqMarketRoutes({ juryScore: score, harvestGrams: 120, equipmentCodes: ["TENT-080-STARTER"], marketContext: { window, reputation, routeSales, recentSales: {raw: 8}, marketVolumes: {raw: 20}, ...overrides } });
    await db.query("INSERT INTO kq_flowers VALUES($1,$2,'burned')", [flower, user]);
    await db.query("SELECT rpc_kq_prepare_market_lot($1,$2,120,$3,'standard',ARRAY['TENT-080-STARTER'],$4::jsonb)", [user, flower, score, JSON.stringify(options)]);
    return { flower, options };
  };
  const sell = (lot, policy, amount, key = randomUUID(), owner = user, period = window) => db.query("SELECT rpc_kq_sell_market_offer($1,$2,$3,'raw',$4,$5,$6) AS receipt", [owner,lot.flower,key,policy,amount,period]);
  const weak = await prepare(5.8);
  const raw = weak.options.find(q=>q.route === "raw");
  const quick = raw.market.offers[0], fair = raw.market.offers[1];
  assert.equal(fair.accepted, false);
  assert.equal(quick.accepted, true);
  await assert.rejects(() => sell(weak,"fair",fair.payoutCents), /market_no_buyer/);
  await assert.rejects(() => sell(weak,"clearance",quick.payoutCents+1), /market_offer_changed/);
  await assert.rejects(() => sell(weak,"clearance",quick.payoutCents,randomUUID(),user,window-1), /market_offer_changed/);
  await assert.rejects(() => sell(weak,"clearance",quick.payoutCents,randomUUID(),outsider), /market_lot_unavailable/);
  await assert.rejects(() => sell(weak,"made-up",quick.payoutCents), /market_offer_changed/);
  await assert.rejects(() => db.query("SELECT rpc_kq_sell_market_lot($1,$2,$3,'raw')",[user,weak.flower,randomUUID()]), /market_offer_changed/);
  assert.equal((await db.query("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1",[user])).rows[0].cash_cents, 0);
  const key = randomUUID();
  const receipt = (await sell(weak,"clearance",quick.payoutCents,key)).rows[0].receipt;
  assert.equal(receipt.payoutCents,quick.payoutCents);
  assert.equal(receipt.reputationAfter,0);
  const replay = (await sell(weak,"clearance",quick.payoutCents,key)).rows[0].receipt;
  assert.deepEqual(replay,{...receipt,replayed:true});
  await assert.rejects(()=>sell(weak,"clearance",quick.payoutCents),/market_lot_unavailable/);
  const pulse = (await db.query("SELECT rpc_kq_market_pulse($1) AS pulse",[user])).rows[0].pulse;
  assert.equal(pulse.recentSales.raw,1); assert.equal(pulse.marketVolumes.raw,1);
  const unrelated = await prepare(8);
  await assert.rejects(() => sell(unrelated,"clearance",quick.payoutCents,key), /invalid_market_sale/);
  const good = await prepare(8, {recentSales:{},marketVolumes:{}});
  const offer = good.options.find(q=>q.route==="raw").market.offers[0];
  await db.query("UPDATE kq_equipment_wallets SET reputation=100 WHERE user_id=$1",[user]);
  await assert.rejects(()=>sell(good,"clearance",offer.payoutCents), /market_offer_changed/);
  await db.query("UPDATE kq_equipment_wallets SET reputation=0 WHERE user_id=$1",[user]);
  const final = (await sell(good,"clearance",offer.payoutCents)).rows[0].receipt;
  assert.equal(final.cashAfterCents, receipt.cashAfterCents+offer.payoutCents);
  assert.ok(final.reputationGain>0);
  await db.exec(`ALTER TABLE public.kq_support_card_rules ADD COLUMN effect TEXT, ADD COLUMN timing TEXT, ADD COLUMN xp_cost INTEGER, ADD COLUMN drawback TEXT;
    CREATE TABLE public.kq_equipment_catalog(code TEXT PRIMARY KEY, price_cents INTEGER);`);
  const { KQ_CARDS, KQ_BUDDIES } = await vite.ssrLoadModule("/src/lib/kanab-quest-game.ts");
  for (const card of [...KQ_CARDS,...KQ_BUDDIES]) {
    const id=randomUUID();
    await db.query("INSERT INTO lottery_card_definitions(id,code) VALUES($1,$2)",[id,card.code]);
    if(card.code.startsWith("BOTTE")) await db.query("INSERT INTO kq_support_card_rules(card_definition_id,rules_version) VALUES($1,1)",[id]);
  }
  await db.query("INSERT INTO kq_equipment_catalog VALUES ('SIFT-TRAY',419500),('PRESS-0600',369500),('WASHER-25L',599500)");
  await db.exec(await migration("20260912000300_kq_distinct_talents.sql"));
  assert.equal((await db.query("SELECT count(DISTINCT effect)::int AS count FROM kq_support_card_rules")).rows[0].count,32);
  assert.equal((await db.query("SELECT price_cents FROM kq_equipment_catalog WHERE code='SIFT-TRAY'")).rows[0].price_cents,55000);
  // Previously deployed app versions can still settle their own legacy quotes.
  const legacyFlower = randomUUID();
  await db.query("INSERT INTO kq_flowers VALUES($1,$2,'burned')", [legacyFlower,user]);
  await db.query("SELECT rpc_kq_prepare_market_lot($1,$2,120,8,'selection',ARRAY['TENT-080-STARTER'],$3::jsonb)", [user,legacyFlower,JSON.stringify([{route:"raw",available:true,payoutCents:777,reputationPolicyVersion:2}])]);
  const legacyReceipt = (await db.query("SELECT rpc_kq_sell_market_lot($1,$2,$3,'raw') AS receipt",[user,legacyFlower,randomUUID()])).rows[0].receipt;
  assert.equal(legacyReceipt.payoutCents,777);
  // A loyal buyer settles a saturated premium offer, but cannot reuse its guarantee after demotion.
  await db.query("UPDATE kq_equipment_wallets SET reputation=1500 WHERE user_id=$1", [user]);
  const loyal = await prepare(5.8);
  const premium = loyal.options.find(q=>q.route === "raw").market.offers[2];
  assert.equal(premium.accepted, true);
  await db.query("UPDATE kq_equipment_wallets SET reputation=1499 WHERE user_id=$1", [user]);
  await assert.rejects(()=>sell(loyal,"premium",premium.payoutCents), /market_offer_changed/);
  await db.query("UPDATE kq_equipment_wallets SET reputation=1500 WHERE user_id=$1", [user]);
  const beforeLoyal = (await db.query("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [user])).rows[0].cash_cents;
  const loyalKey = randomUUID();
  const loyalReceipt = (await sell(loyal,"premium",premium.payoutCents,loyalKey)).rows[0].receipt;
  assert.equal(loyalReceipt.payoutCents,premium.payoutCents);
  assert.equal(loyalReceipt.cashAfterCents,beforeLoyal+premium.payoutCents);
  assert.equal((await sell(loyal,"premium",premium.payoutCents,loyalKey)).rows[0].receipt.replayed,true);
  console.log("Living market SQL: migrations, refused offers, repricing, stale quotes, ownership, replay, saturation, reputation tiers, loyal premium sales, catalog and EUR prices passed.");
} finally { await vite.close(); await db.close(); }
