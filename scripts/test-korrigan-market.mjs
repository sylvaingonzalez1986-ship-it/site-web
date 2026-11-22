// Run against the dedicated local PostgreSQL fixture cluster via KQ_TEST_POSTGRES_CLIENT.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";
import { openPlacardIsolatedPostgres } from "./lib/placard-isolated-postgres.mjs";

const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const fixtureUrl = new URL("./test-placard-customer-demand.mjs", import.meta.url);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const scalar = async (db, statement, parameters = []) => Object.values((await db.query(statement, parameters)).rows[0])[0];
const phaseAtMinute = async (db, user, minute) => {
  await db.query("UPDATE kq_commerce_accounts SET business_started_at=clock_timestamp()-$2::int*interval '10 seconds' WHERE user_id=$1", [user, minute]);
};

async function installRewards(db) {
  await db.exec(`
    CREATE SCHEMA extensions;
    CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE TYPE lottery_card_rarity AS ENUM ('common','silver','gold','epic','legendary');
    CREATE TABLE lottery_card_collections (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now());
    ALTER TABLE lottery_card_definitions ADD COLUMN collection_id uuid REFERENCES lottery_card_collections(id),
      ADD COLUMN card_number int, ADD COLUMN name text, ADD COLUMN is_active boolean DEFAULT true,
      ADD COLUMN rarity lottery_card_rarity, ADD COLUMN image_url text;
    CREATE TABLE lottery_tickets(id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid, order_id text,
      ticket_number text UNIQUE, order_amount numeric, status text);
    CREATE TABLE lottery_game_config(id integer PRIMARY KEY, is_active boolean);
    CREATE TABLE lottery_ticket_counter(id integer PRIMARY KEY, next_number integer);
    CREATE TABLE lottery_audit_log(event_type text, user_id uuid, details jsonb);
    CREATE TABLE lottery_card_instances(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, card_definition_id uuid REFERENCES lottery_card_definitions(id),
      pack_slot int, ticket_id uuid, kq_support_entitlement_id uuid, source_bot_battle_id uuid, pioneer_grant_id uuid,
      producer_purchase_buddie_grant_id uuid, community_mission_reward_id uuid, contest_bundle_order_id text,
      game_mission_reward_id uuid, starter_buddie_recovery_id uuid,
      CONSTRAINT lottery_card_instances_source_required CHECK (ticket_id IS NOT NULL OR kq_support_entitlement_id IS NOT NULL));
    CREATE TABLE kq_support_booster_entitlements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid, source text CONSTRAINT kq_support_booster_entitlements_source_check CHECK (source='ticket'), reward_key text UNIQUE,
      ticket_id uuid, card_count int, status text DEFAULT 'available', opened_at timestamptz);
    INSERT INTO lottery_game_config VALUES (1,true);
    INSERT INTO lottery_card_collections(code,created_at)
      VALUES ('HEMP_HEROES_2026',now()-interval '1 day'),('BOTTE_DU_CHANVRIER_2026',now());
    INSERT INTO lottery_card_definitions(id,collection_id,card_number,code,name,rarity)
      SELECT gen_random_uuid(),id,2,'HH2026-002','Buddie épique du fixture','epic'
      FROM lottery_card_collections WHERE code='HEMP_HEROES_2026';
    INSERT INTO lottery_card_definitions(id,collection_id,card_number,code,name,rarity)
      SELECT gen_random_uuid(),collection.id,v.n,'BOTTE-'||lpad(v.n::text,3,'0'),'Carte Botte du fixture',v.rarity::lottery_card_rarity
      FROM lottery_card_collections collection CROSS JOIN (VALUES (3,'common'),(5,'silver'),(6,'gold'),(39,'epic')) v(n,rarity)
      WHERE collection.code='BOTTE_DU_CHANVRIER_2026';
  `);
  const lottery = await sql("20260228000800_lottery_dynamic_rewards.sql");
  await db.exec(lottery.match(/CREATE OR REPLACE FUNCTION public\.rpc_admin_grant_lottery_tickets\([\s\S]*?\$\$;/)[0]);
  await db.exec(await sql("20260228000900_lottery_fix_random_bytes_schema.sql"));
  await db.exec(await sql("20260302000400_lottery_secure_random_int_range.sql"));
  const botte = await sql("20261010000500_botte_situations_epic.sql");
  for (const name of ["kq_pick_support_card", "rpc_kq_open_support_booster"]) {
    await db.exec(botte.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`))[0]);
  }
}

export async function openKorriganFixture() {
  const cluster = await openPlacardIsolatedPostgres();
  const db = cluster.open();
  const peer = cluster.open();
  let vite;
  try {
    const source = (await readFile(fixtureUrl, "utf8")).replaceAll("\r\n", "\n");
    const setupEnd = source.indexOf(" // All relative timestamps");
    const playerStart = source.indexOf(" async function player()");
    const playerEnd = source.indexOf(" const {quoteKqCommerce}", playerStart);
    assert(setupEnd > 0 && playerStart > setupEnd && playerEnd > playerStart, "commerce fixture anchors changed");
    const setup = source.slice(0, setupEnd)
      .replace(/^import .*;\n/gm, "")
      .replace("const db = new PGlite();", "")
      .replace("JSON.stringify(payload)", "payload")
      .replace('const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), \'utf8\');', "");
    assert(!setup.includes("import.meta"));
    const fixture = await new AsyncFunction("db", "sql", "path", "createServer", "assert", "randomUUID",
      `${setup}\n${source.slice(playerStart, playerEnd)}\n return {player, command, vite};\n } catch(error) {await vite.close(); throw error;}`
    )(db, sql, path, createServer, assert, randomUUID);
    vite = fixture.vite;
    await db.exec("ALTER TABLE kq_equipment_wallets ADD COLUMN created_at timestamptz NOT NULL DEFAULT now()");
    await db.exec(await sql("20261011000200_storage_budget.sql"));
    await installRewards(db);
    const treasury = await sql("20260921000200_kq_treasury_accounting.sql");
    await db.exec(treasury.slice(treasury.indexOf("CREATE TABLE public.kq_treasury_accounts"), treasury.indexOf("-- Actual production cost"))
      .replace("CREATE FUNCTION public.kq_treasury_pair", "CREATE OR REPLACE FUNCTION public.kq_treasury_pair"));
    await db.exec("CREATE OR REPLACE FUNCTION kq_treasury_initialize(uuid) RETURNS void LANGUAGE sql AS 'INSERT INTO public.kq_treasury_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING'");
    await db.exec(await sql("20261122001400_kq_korrigan_market.sql"));
    const player = async () => {
      const account = await fixture.player();
      await db.query("INSERT INTO kq_treasury_accounts(user_id) VALUES ($1)", [account.user]);
      await scalar(db, "SELECT rpc_kq_commerce_state($1)", [account.user]);
      await phaseAtMinute(db, account.user, 1340);
      return account;
    };
    return {
      db, peer, vite, player, command: fixture.command, database: await scalar(db, "SELECT current_database()"),
      close: async () => { try { await vite.close(); } finally { await cluster.close(); } },
    };
  } catch (error) {
    if (vite) await vite.close();
    await cluster.close();
    throw error;
  }
}

async function race(db, peer, first, second) {
  const [blocker, contender] = await Promise.all([scalar(db, "SELECT pg_backend_pid()"), scalar(peer, "SELECT pg_backend_pid()")]);
  await db.exec("BEGIN");
  let competing;
  try {
    const primary = await first();
    competing = second().then(value => ({ value }), error => ({ error }));
    const deadline = Date.now() + 3000;
    let blocked;
    while (!blocked && Date.now() < deadline) {
      blocked = await scalar(db, "SELECT $1::int=ANY(pg_blocking_pids($2::int))", [blocker, contender]);
      if (!blocked) await new Promise(resolve => setTimeout(resolve, 15));
    }
    assert(blocked, "the other PostgreSQL connection waits for the player's transaction");
    await db.exec("COMMIT");
    return { primary, competing: await competing };
  } catch (error) {
    await db.exec("ROLLBACK");
    await competing;
    throw error;
  }
}

async function verifyMarket() {
  const { db, peer, vite, player, command, close } = await openKorriganFixture();
  try {
    const { KQ_GAME_DAY_MS, previewKqBusinessPayment } = await vite.ssrLoadModule("/src/lib/kanab-quest-business.ts");
    const { getVillageCalendar, VILLAGE_PHASE_START } = await vite.ssrLoadModule("/src/components/placard/world/village-calendar.ts");
    const { quoteKqCommerce } = await vite.ssrLoadModule("/src/lib/kanab-quest-commerce.ts");
    const { projectKqStorageLot } = await vite.ssrLoadModule("/src/lib/kanab-quest-storage.ts");
    const { dawn, night } = VILLAGE_PHASE_START;
    const clock = { dayMs: KQ_GAME_DAY_MS, dawn, night };
    const call = (dbHandle, user, action, { lotId = null, grams = null, requestId = null, sessionId = null, draw = null, valueCents = null } = {}) =>
      scalar(dbHandle, "SELECT kq_korrigan_market($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9)",
        [user, action, clock, lotId, grams, requestId, sessionId, draw, valueCents]);
    const { KORRIGAN_ODDS: odds, KORRIGAN_MIN_VALUE_CENTS } = await vite.ssrLoadModule("/src/lib/kanab-quest-korrigan.ts");
    assert.deepEqual(await scalar(db, "SELECT kq_korrigan_odds()"), odds);
    assert.deepEqual(await scalar(db, `SELECT jsonb_object_agg(kind,weight) FROM (
      SELECT kq_korrigan_draw_kind(roll,kq_korrigan_odds()) AS kind,count(*) AS weight
      FROM generate_series(1,10000) roll GROUP BY 1
    ) weights`), odds);
    const origin = "2026-09-12T11:55:00.000Z";
    for (const minute of [0, 299, 300, 1259, 1260, 1439, 1440, 1739, 1740, 2699, 2700]) {
      const at = new Date(Date.parse(origin) + minute * 10_000).toISOString();
      const phase = getVillageCalendar(origin, Date.parse(at)).phase;
      assert.equal(await scalar(db, "SELECT is_night FROM kq_korrigan_clock($1,$2,$3::jsonb)", [origin, at, clock]), phase === "night");
    }

    const main = await player();
    const other = await player();
    const stockUnits = account => scalar(db, "SELECT remaining_units FROM kq_commerce_stock WHERE id=$1", [account.stock]);
    const wallet = account => scalar(db, "SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [account.user]);
    async function quoteShop(account, grams) {
      const snapshot = await scalar(db, "SELECT rpc_kq_commerce_state($1)", [account.user]);
      const stock = snapshot.stocks.find(row => row.id === account.stock);
      const storeNow = Date.parse(snapshot.business.serverNow);
      const offer = quoteKqCommerce(snapshot, { ...stock, storage: projectKqStorageLot(stock.storageState, storeNow, stock.juryScore) },
        "cbd-shop", "advised", grams * 10);
      return { offer, snapshot, stock };
    }
    const initialWallet = await wallet(main);
    const initialState = await call(db, main.user, "state");
    assert.equal(initialState.nextOfferAt, null);
    assert.equal(initialState.lots[0].id, main.stock);
    await assert.rejects(call(db, main.user, "quote", { lotId: other.stock, grams: 1 }), /korrigan_lot_unavailable/);
    const small = await call(db, main.user, "quote", { lotId: main.stock, grams: 1 });
    assert.equal(small.minimumValueCents, KORRIGAN_MIN_VALUE_CENTS);
    assert.deepEqual(small.quote, { valueCents: 300, eligible: false });
    await assert.rejects(call(db, main.user, "offer", { lotId: main.stock, grams: 1, valueCents: 300, requestId: randomUUID() }), /korrigan_minimum/);

    const request = await scalar(db, "SELECT kq_customer_demand_remaining($1,'cbd-shop',now())", [main.user]);
    await db.query("UPDATE kq_flowers SET variety_code=$2 WHERE id=$1", [main.flower, request.varietyCode]);
    await db.query("UPDATE kq_commerce_stock SET payout_exact=20.45,payout_rounded=20 WHERE id=$1", [main.stock]);
    const marketQuote = (await call(db, main.user, "quote", { lotId: main.stock, grams: 40 })).quote;
    const { offer: storeQuote } = await quoteShop(main, 40);
    assert.equal(storeQuote.reason, null);
    assert.equal(storeQuote.units, 400);
    assert.equal(marketQuote.valueCents, storeQuote.payoutCents);
    assert(marketQuote.valueCents > 12_000, "the real customer aroma premium participates");
    assert.equal(marketQuote.eligible, true);
    const offer = { lotId: main.stock, grams: 40, valueCents: marketQuote.valueCents, requestId: randomUUID() };
    await assert.rejects(call(db, main.user, "offer", { ...offer, valueCents: 1 }), /korrigan_offer_changed/);
    assert.equal(await stockUnits(main), 1000);

    const offers = await race(db, peer,
      () => call(db, main.user, "offer", offer),
      () => call(peer, main.user, "offer", { ...offer, requestId: randomUUID() }));
    assert.match(offers.competing.error?.message ?? "", /korrigan_session_active/);
    assert.equal(offers.primary.session.requestId, offer.requestId);
    assert.deepEqual(offers.primary.session.odds, odds);
    assert.equal(await scalar(db, "SELECT next_offer_at-offered_at=interval '168 hours' FROM kq_korrigan_sessions WHERE id=$1", [offers.primary.session.id]), true);
    assert.equal(offers.primary.nextOfferAt, offers.primary.session.nextOfferAt);
    assert.equal(await stockUnits(main), 600);
    assert.equal(await wallet(main), initialWallet);
    assert.equal(await scalar(db, "SELECT (state#>>'{capacity,totalUnits}')::int FROM kq_storage_lots WHERE flower_id=$1", [main.flower]), 600);
    assert.equal(await scalar(db, "SELECT payout_rounded FROM kq_commerce_stock WHERE id=$1", [main.stock]), 20);

    const seller = await player();
    const { offer: shop, snapshot: shopState, stock: shopStock } = await quoteShop(seller, 60);
    Object.assign(shop, previewKqBusinessPayment(shop.payoutCents, shopState.business, 0));
    const quoteId = randomUUID();
    await db.query(`INSERT INTO public.kq_commerce_quotes(id,user_id,stock_id,account_revision,campaign_id,campaign_revision,
      stock_units,reputation,offer,expires_at,storage_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,now()+interval '1 minute',$10)`,
      [quoteId,seller.user,seller.stock,shopState.revision,shopState.campaign.id,shopState.campaign.revision,
        shopStock.remainingUnits,shopState.reputation,shop,shopStock.storageRevision]);
    const sale = await race(db, peer,
      () => scalar(db, "SELECT rpc_kq_commerce_command($1,'sell',$2::jsonb,$3)",
        [seller.user, { quoteId, expectedPayoutCents: shop.payoutCents }, randomUUID()]),
      () => call(peer, seller.user, "offer", { lotId: seller.stock, grams: 60, valueCents: shop.payoutCents, requestId: randomUUID() }));
    assert.match(sale.competing.error?.message ?? "", /korrigan_lot_unavailable/);
    assert.equal(await stockUnits(seller), 400);
    assert.equal(await scalar(db, "SELECT count(*)::int FROM kq_market_sale_receipts WHERE owner_id=$1", [seller.user]), 1);
    assert.equal((await call(db, seller.user, "state")).session, null);

    const sessionId = (await call(db, main.user, "state")).session.id;
    const cooldown = (await call(db, main.user, "state")).nextOfferAt;
    await phaseAtMinute(db, main.user, 500);
    assert.equal((await call(db, main.user, "state")).nextOfferAt, cooldown);
    assert.equal((await call(peer, main.user, "offer", offer)).session.id, sessionId);
    await assert.rejects(call(db, main.user, "offer", { ...offer, grams: 41 }), /korrigan_request_conflict/);
    await assert.rejects(call(db, main.user, "draw", { sessionId, draw: 1 }), /korrigan_closed/);
    await assert.rejects(call(db, other.user, "draw", { sessionId, draw: 1 }), /korrigan_session_not_found/);
    await phaseAtMinute(db, main.user, 1340);
    await assert.rejects(call(db, main.user, "draw", { sessionId, draw: 2 }), /korrigan_draw_order/);
    await db.query("DELETE FROM kq_treasury_accounts WHERE user_id=$1", [main.user]);

    // Inject deterministic outcomes only in the local fixture and retain the
    // deployed cryptographic function for other draws and card selection.
    await db.exec(`
      ALTER FUNCTION lottery_secure_random_int(integer,integer) RENAME TO fixture_random_original;
      CREATE FUNCTION lottery_secure_random_int(first integer,last integer) RETURNS integer LANGUAGE sql AS $$
        SELECT CASE WHEN first=1 AND last=10000 THEN coalesce(nullif(current_setting('kq.fixture_roll',true),'')::integer,public.fixture_random_original(first,last))
          ELSE public.fixture_random_original(first,last) END;
      $$;
      CREATE FUNCTION fixture_reward_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'fixture award unavailable'; END;
      $$;
      CREATE TRIGGER fixture_fail_rewards BEFORE INSERT ON kq_treasury_journal FOR EACH ROW EXECUTE FUNCTION fixture_reward_failure();
      SET kq.fixture_roll='8501';
    `);
    await peer.exec("SET kq.fixture_roll='1'");
    const clicks = await race(db, peer,
      () => call(db, main.user, "draw", { sessionId, draw: 1 }),
      () => call(peer, main.user, "draw", { sessionId, draw: 1 }));
    const pending = clicks.primary;
    assert.deepEqual(clicks.competing.value?.session.draws, pending.session.draws);
    assert.equal(await scalar(db, "SELECT count(*)::int FROM kq_korrigan_draws WHERE session_id=$1", [sessionId]), 1);
    assert.deepEqual(pending.session.draws, [{ index: 1, kind: "x5", moneyCents: 5 * offer.valueCents, pending: true }]);
    assert.equal(await wallet(main), initialWallet, "delivery failure rolls the wallet update back");
    await assert.rejects(call(db, main.user, "draw", { sessionId, draw: 2 }), /korrigan_reward_pending/);
    await phaseAtMinute(db, main.user, 500);
    await db.exec("DROP TRIGGER fixture_fail_rewards ON kq_treasury_journal; SET kq.fixture_roll='1'");
    const [recovered, replay] = await Promise.all([
      call(db, main.user, "state"), call(peer, main.user, "draw", { sessionId, draw: 1 }),
    ]);
    assert.deepEqual(recovered.session.draws, replay.session.draws);
    assert.deepEqual(recovered.session.draws, [{ index: 1, kind: "x5", moneyCents: 5 * offer.valueCents }]);
    assert.equal(await wallet(main), initialWallet + 5 * offer.valueCents);
    assert.equal(await scalar(db, "SELECT count(*)::int FROM kq_treasury_journal WHERE user_id=$1", [main.user]), 1);
    await phaseAtMinute(db, main.user, 1340);
    await db.exec("SET kq.fixture_roll='9500'");
    assert.equal((await call(db, main.user, "draw", { sessionId, draw: 2 })).session.draws[1].kind, "botte");
    const botte = await scalar(db, "SELECT to_jsonb(e) FROM kq_support_booster_entitlements e WHERE user_id=$1", [main.user]);
    assert.equal(botte.status, "available");
    assert.equal(botte.card_count, 10);
    assert.equal((await scalar(db, "SELECT rpc_kq_open_support_booster($1,$2)", [botte.id, main.user])).cards.length, 10);
    await db.exec("SET kq.fixture_roll='10000'");
    await db.query("UPDATE lottery_game_config SET is_active=false");
    const buddyPending = await call(db, main.user, "draw", { sessionId, draw: 3 });
    assert.equal(buddyPending.session.draws[2].kind, "buddie");
    assert.equal(buddyPending.session.draws[2].pending, true);
    await db.query("UPDATE kq_korrigan_sessions SET offered_at=offered_at-interval '168 hours',next_offer_at=next_offer_at-interval '168 hours' WHERE id=$1", [sessionId]);
    await assert.rejects(call(db, main.user, "offer", { ...offer, requestId: randomUUID() }), /korrigan_session_active/);
    await db.query("UPDATE lottery_game_config SET is_active=true");
    assert.equal((await call(db, main.user, "state")).session.draws[2].pending, undefined);
    assert.equal(await scalar(db, "SELECT count(*)::int FROM lottery_tickets WHERE user_id=$1 AND status='available' AND order_id IS NULL", [main.user]), 1);
    await db.query("UPDATE kq_korrigan_sessions SET offered_at=offered_at+interval '168 hours',next_offer_at=next_offer_at+interval '168 hours' WHERE id=$1", [sessionId]);
    await assert.rejects(call(db, main.user, "offer", { ...offer, requestId: randomUUID() }), /korrigan_cooldown/);
    await db.query("UPDATE kq_korrigan_sessions SET offered_at=offered_at-interval '168 hours',next_offer_at=next_offer_at-interval '168 hours' WHERE id=$1", [sessionId]);
    const next = await call(db, main.user, "offer", { ...offer, requestId: randomUUID() });
    assert.notEqual(next.session.id, sessionId);
    await db.exec("SET kq.fixture_roll='8904'; CREATE TRIGGER fixture_fail_card BEFORE INSERT ON lottery_card_instances FOR EACH ROW EXECUTE FUNCTION fixture_reward_failure()");
    const epicPending = await call(db, main.user, "draw", { sessionId: next.session.id, draw: 1 });
    assert.equal(epicPending.session.draws[0].pending, true);
    assert.equal(epicPending.session.draws[0].itemLabel, "Buddie épique du fixture");
    const lockedCard = await scalar(db, "SELECT card_definition_id FROM kq_korrigan_draws WHERE session_id=$1", [next.session.id]);
    await db.exec("DROP TRIGGER fixture_fail_card ON lottery_card_instances; SET kq.fixture_roll='1'");
    assert.equal((await call(db, main.user, "state")).session.draws[0].kind, "epic");
    assert.equal(await scalar(db, "SELECT card_definition_id FROM lottery_card_instances WHERE user_id=$1 AND korrigan_draw_id IS NOT NULL", [main.user]), lockedCard);
    await db.exec("SET kq.fixture_roll='8904'");
    await call(db, main.user, "draw", { sessionId: next.session.id, draw: 2 });
    assert.equal(await scalar(db, "SELECT count(*)::int FROM lottery_card_instances WHERE user_id=$1 AND card_definition_id=$2", [main.user, lockedCard]), 2);
    await db.exec("SET kq.fixture_roll='8821'");
    const ten = await call(db, main.user, "draw", { sessionId: next.session.id, draw: 3 });
    assert.equal(ten.session.draws[2].moneyCents, 10 * ten.session.valueCents);
    const jackpots = await player();
    const jackpotOffer = { lotId: jackpots.stock, grams: 36, requestId: randomUUID() };
    jackpotOffer.valueCents = (await call(db, jackpots.user, "quote", jackpotOffer)).quote.valueCents;
    const paid = (await call(db, jackpots.user, "offer", jackpotOffer)).session;
    const beforeJackpots = await wallet(jackpots);
    await db.exec("SET kq.fixture_roll='8901'");
    for (const draw of [1, 2, 3]) {
      const result = await call(db, jackpots.user, "draw", { sessionId: paid.id, draw });
      assert.deepEqual(result.session.draws[draw - 1], { index: draw, kind: "x50", moneyCents: 50 * paid.valueCents });
    }
    assert.equal(await wallet(jackpots), beforeJackpots + 150 * paid.valueCents);
    await assert.rejects(call(db, jackpots.user, "draw", { sessionId: paid.id, draw: 4 }), /korrigan_invalid/);
    await db.query("UPDATE kq_korrigan_sessions SET offered_at=offered_at-interval '35 days',next_offer_at=next_offer_at-interval '35 days' WHERE id=$1", [paid.id]);
    await phaseAtMinute(db, jackpots.user, 600);
    await assert.rejects(call(db, jackpots.user, "offer", { ...jackpotOffer, requestId: randomUUID() }), /korrigan_closed/);
    await phaseAtMinute(db, jackpots.user, 1340);
    await call(db, jackpots.user, "offer", { ...jackpotOffer, requestId: randomUUID() });
    assert.equal(await scalar(db, "SELECT count(*)::int FROM kq_korrigan_sessions WHERE user_id=$1", [jackpots.user]), 2);
    await assert.rejects(call(db, jackpots.user, "offer", { ...jackpotOffer, requestId: randomUUID() }), /korrigan_session_active/);

    // Reserve through the real shop RPC under the shared lock, then verify that
    // a stale night quote cannot take a packet already committed to the shop.
    const reserve = await player();
    const full = (await call(db, reserve.user, "quote", { lotId: reserve.stock, grams: 100 })).quote;
    await command(reserve.user, "buy-packaging", { code: "kraft-5", quantity: 9 });
    await command(reserve.user, "create-listing", { stockId: reserve.stock, formatGrams: 5, packagingCode: "kraft-5", packets: 9, packetPriceCents: 4000 });
    assert.equal((await call(db, reserve.user, "state")).lots[0].availableGrams, 55);
    await assert.rejects(call(db, reserve.user, "offer", { lotId: reserve.stock, grams: 100, valueCents: full.valueCents, requestId: randomUUID() }), /korrigan_lot_unavailable/);
    assert.equal(await stockUnits(reserve), 550);
    const free = (await call(db, reserve.user, "quote", { lotId: reserve.stock, grams: 55 })).quote;
    const lastOffer = { lotId: reserve.stock, grams: 55, valueCents: free.valueCents, requestId: randomUUID() };
    const exhausted = await call(db, reserve.user, "offer", lastOffer);
    assert.deepEqual(exhausted.lots, []);
    assert.equal(await stockUnits(reserve), 0);
    assert.equal(await scalar(db, "SELECT remaining_packets FROM kq_online_listings WHERE user_id=$1", [reserve.user]), 9);
    await phaseAtMinute(db, reserve.user, 500);
    assert.equal((await call(peer, reserve.user, "offer", lastOffer)).session.id, exhausted.session.id);
    for (const role of ["anon", "authenticated", "service_role"]) {
      assert.equal(await scalar(db, "SELECT has_table_privilege($1,'kq_korrigan_sessions','SELECT,INSERT,UPDATE,DELETE')", [role]), false);
      assert.equal(await scalar(db, "SELECT has_table_privilege($1,'kq_korrigan_draws','SELECT,INSERT,UPDATE,DELETE')", [role]), false);
    }
    await db.exec("SET ROLE service_role");
    assert.equal((await call(db, main.user, "state")).session.id, next.session.id);
    await db.exec("RESET ROLE; SET ROLE authenticated");
    await assert.rejects(call(db, main.user, "state"), /permission denied/);
    await db.exec("RESET ROLE");
    console.log("Korrigans PostgreSQL: night boundaries, odds, CBD quote, stock locks, exact replay, award recovery, sealed packs and grants passed.");
  } finally {
    await close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await verifyMarket();
