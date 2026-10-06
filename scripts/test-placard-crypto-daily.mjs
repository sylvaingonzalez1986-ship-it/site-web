// Exercise the real migrations in isolated PostgreSQL, with a database-local
// deterministic clock. This script never reads env files or contacts a server.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const owner = randomUUID();
const dailyMigration = await readFile("supabase/migrations/20261005000100_kq_crypto_daily_refresh.sql", "utf8");
const query = async (sql, values = []) => (await db.query(sql, values)).rows[0];
const setClock = at => db.query("SELECT set_config('test.crypto_now',$1,false)", [at]);
const command = async (action = "state", payload = {}, enabled = true) =>
  (await query("SELECT rpc_kq_crypto_command($1,$2,$3::jsonb,$4) data", [owner, action, JSON.stringify(payload), enabled])).data;
const claim = async () => (await query("SELECT rpc_kq_crypto_refresh_claim() data")).data;
const status = async () => (await query("SELECT rpc_kq_crypto_refresh_status() data")).data;
const publish = async (leaseId, assets, retryAfter) => (await query(
  retryAfter === undefined ? "SELECT rpc_kq_crypto_refresh_publish($1,$2::jsonb) data" : "SELECT rpc_kq_crypto_refresh_publish($1,$2::jsonb,$3) data",
  retryAfter === undefined ? [leaseId, JSON.stringify(assets)] : [leaseId, JSON.stringify(assets), retryAfter],
)).data;
const fail = async (leaseId, code, retryAfter = null) =>
  (await query("SELECT rpc_kq_crypto_refresh_fail($1,$2,$3) data", [leaseId, code, retryAfter])).data;
const buy = assetId => command("preview", { side: "buy", assetId, amountCents: 10000 });
const confirm = (orderId, enabled = true) => command("confirm", { orderId }, enabled);
const assetsAt = quotedAt => Array.from({ length: 100 }, (_, i) => ({
  id: i + 1, rank: i + 1, name: `Coin ${i + 1}`, symbol: `C${i + 1}`,
  priceEur: "10", change24h: 1.5, quotedAt, inTop100: true,
}));
const seed = async (at = "2026-10-05T17:00:02Z", quotedAt = at) => {
  await setClock(at);
  const lease = await claim();
  assert(lease?.leaseId, "a due daily batch must claim a lease");
  assert.equal(await publish(lease.leaseId, assetsAt(quotedAt)), true);
  return lease;
};
const iso = value => new Date(value).toISOString();
let checks = 0;
async function check(name, fn) {
  await db.exec("BEGIN");
  try { await fn(); console.log(`PASS ${name}`); checks++; }
  finally { await db.exec("ROLLBACK"); }
}
async function rejects(run, pattern) {
  await db.exec("SAVEPOINT expected_rejection");
  try { await assert.rejects(run, pattern); }
  finally { await db.exec("ROLLBACK TO SAVEPOINT expected_rejection; RELEASE SAVEPOINT expected_rejection"); }
}

async function prepare(engine, failing = false) {
  await engine.exec(`
    SELECT set_config('test.crypto_now','2026-10-05T16:00:00Z',false);
    CREATE OR REPLACE FUNCTION pg_catalog.now() RETURNS TIMESTAMPTZ LANGUAGE sql STABLE
      AS $$ SELECT current_setting('test.crypto_now')::TIMESTAMPTZ $$;
    CREATE OR REPLACE FUNCTION pg_catalog.clock_timestamp() RETURNS TIMESTAMPTZ LANGUAGE sql VOLATILE
      AS $$ SELECT current_setting('test.crypto_now')::TIMESTAMPTZ $$;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users(id),cash_cents INTEGER NOT NULL CHECK(cash_cents>=0),updated_at TIMESTAMPTZ);
    CREATE TABLE kq_commerce_accounts(user_id UUID PRIMARY KEY,revision INTEGER DEFAULT 0);
    CREATE TABLE kq_treasury_accounts(user_id UUID PRIMARY KEY);
    CREATE TABLE kq_treasury_journal(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,source_key TEXT,kind TEXT,reference TEXT,occurred_at TIMESTAMPTZ,postings JSONB,UNIQUE(user_id,source_key));
    CREATE TABLE kq_treasury_balances(user_id UUID,account TEXT,balance_cents BIGINT,PRIMARY KEY(user_id,account));
    CREATE FUNCTION kq_business_settle(UUID) RETURNS VOID LANGUAGE sql AS 'SELECT';
    CREATE FUNCTION kq_treasury_initialize(UUID) RETURNS VOID LANGUAGE sql AS 'SELECT';
  `);
  // Keep the production accounting primitive, including preceding bank accounts.
  const treasury = await readFile("supabase/migrations/20260921000200_kq_treasury_accounting.sql", "utf8");
  await engine.exec(treasury.slice(treasury.indexOf("CREATE FUNCTION public.kq_treasury_post("), treasury.indexOf("-- Actual production cost"))
    .replace("'expense_other'];", "'expense_other','loan_payable','expense_loan_interest'];"));
  for (const file of ["20260923000400_kq_crypto_portfolio.sql", "20260923000600_kq_crypto_refresh_recovery.sql", "20260924000200_kq_crypto_refresh_resilience.sql"]) {
    await engine.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await engine.exec(`UPDATE kq_crypto_refresh_state SET succeeded_at='2026-10-04T17:00:05Z',
    next_attempt_at='2026-10-05T16:01:00Z',failure_count=${failing ? 1 : 0},last_failure_code=${failing ? "'rate_limited'" : "NULL"};`);
  await engine.exec(dailyMigration);
}

try {
  await prepare(db);
  assert.equal(iso((await status()).nextAttemptAt), "2026-10-05T17:00:00.000Z", "migration replaces the old five-minute success deadline with the following local 19:00");
  console.log("PASS migration realigns an existing successful publication"); checks++;

  const failedDb = new PGlite();
  try {
    await prepare(failedDb, true);
    const migrated = (await failedDb.query("SELECT next_attempt_at,last_failure_code,failure_count FROM kq_crypto_refresh_state")).rows[0];
    assert.equal(iso(migrated.next_attempt_at), "2026-10-05T16:01:00.000Z");
    assert.equal(migrated.failure_count, 1);
    assert.equal(migrated.last_failure_code, "rate_limited");
    console.log("PASS migration preserves a provider failure deadline"); checks++;
  } finally { await failedDb.close(); }

  await db.exec("UPDATE kq_crypto_refresh_state SET attempted_at=NULL,succeeded_at=NULL,next_attempt_at=NULL");
  await db.query("INSERT INTO auth.users VALUES($1)", [owner]);
  await db.query("INSERT INTO kq_equipment_wallets VALUES($1,1000000,now())", [owner]);
  await db.query("INSERT INTO kq_commerce_accounts(user_id) VALUES($1)", [owner]);
  await db.query("INSERT INTO kq_treasury_accounts VALUES($1)", [owner]);
  await db.exec(`CREATE FUNCTION cash_observer() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
    PERFORM kq_treasury_pair(NEW.user_id,'cash-movement',gen_random_uuid()::TEXT,now(),'cash','suspense',(NEW.cash_cents-OLD.cash_cents)::BIGINT); RETURN NEW; END $$;
    CREATE TRIGGER wallet_cash AFTER UPDATE OF cash_cents ON kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION cash_observer();`);

  await check("19:00 Europe/Paris slots follow winter, summer, and both DST transitions", async () => {
    for (const [at, slot, next] of [
      ["2026-01-05T17:59:59Z", "2026-01-04T18:00:00Z", "2026-01-05T18:00:00Z"],
      ["2026-01-05T18:00:00Z", "2026-01-05T18:00:00Z", "2026-01-06T18:00:00Z"],
      ["2026-07-05T17:00:00Z", "2026-07-05T17:00:00Z", "2026-07-06T17:00:00Z"],
      ["2026-03-28T18:00:00Z", "2026-03-28T18:00:00Z", "2026-03-29T17:00:00Z"],
      ["2026-10-24T17:00:00Z", "2026-10-24T17:00:00Z", "2026-10-25T18:00:00Z"],
    ]) {
      const result = await query("SELECT kq_crypto_refresh_slot($1) slot,kq_crypto_next_refresh_at($1) next", [at]);
      assert.equal(iso(result.slot), iso(slot)); assert.equal(iso(result.next), iso(next));
    }
  });

  await check("an empty market can bootstrap during the day and refresh again at 19:00", async () => {
    await seed("2026-10-05T10:00:00Z");
    assert.equal(iso((await status()).nextAttemptAt), "2026-10-05T17:00:00.000Z");
    await setClock("2026-10-05T16:59:59Z"); assert.equal(await claim(), null);
    await setClock("2026-10-05T17:00:00Z"); assert((await claim())?.leaseId);
  });

  await check("one successful daily publication serves every request until the next 19:00", async () => {
    const lease = await seed();
    assert.equal(iso((await status()).nextAttemptAt), "2026-10-06T17:00:00.000Z");
    assert.equal(await publish(lease.leaseId, assetsAt("2026-10-05T17:00:02Z")), false, "completed leases cannot publish twice");
    await db.exec("UPDATE kq_crypto_refresh_state SET next_attempt_at=now()-interval '1 second'");
    assert.equal(await claim(), null, "success slot guard still holds if the retry deadline is old");
    for (const time of ["2026-10-05T22:00:00Z", "2026-10-06T08:00:00Z", "2026-10-06T16:59:59Z"]) {
      await setClock(time); assert.equal(await claim(), null);
      assert.equal((await command()).marketStatus, "live");
      assert.equal((await status()).freshQuoteCount, 100);
    }
    await setClock("2026-10-06T17:00:00Z");
    assert.equal((await command()).marketStatus, "stale");
    assert.equal((await status()).freshQuoteCount, 0);
    assert((await claim())?.leaseId);
  });

  await check("collection allowance retains an 18:55 quote until the following 19:00 only", async () => {
    await seed("2026-10-05T17:00:02Z", "2026-10-05T16:55:00Z");
    await setClock("2026-10-06T16:59:59Z");
    assert.equal((await command()).marketStatus, "live");
    const offer = await buy(1);
    assert.equal(iso(offer.expiresAt), "2026-10-06T17:00:00.000Z");
    await setClock("2026-10-06T17:00:00Z");
    await rejects(() => confirm(offer.orderId), /crypto_expired/);
    await rejects(() => buy(1), /crypto_stale/);
  });

  await check("day-old game prices remain usable while previews expire within 60 seconds", async () => {
    await seed(); await setClock("2026-10-06T12:00:00Z");
    const offer = await buy(1);
    assert.equal(iso(offer.expiresAt), "2026-10-06T12:01:00.000Z");
    await setClock("2026-10-06T12:00:59Z");
    const purchase = await confirm(offer.orderId);
    assert.equal(purchase.trade.amountCents, 10000);
    assert.equal((await command()).positions[0].valueCents, 10000);
    const staleOffer = await buy(2);
    await setClock("2026-10-06T12:01:59Z");
    await rejects(() => confirm(staleOffer.orderId), /crypto_expired/);
    await setClock("2026-10-06T17:00:00Z");
    assert.equal((await command()).positions[0].valueCents, null);
    await rejects(() => command("preview", { side: "sell", assetId: 1, quantity: offer.quantity }), /crypto_stale/);
    const replay = await confirm(offer.orderId, false);
    assert.equal(replay.replayed, true); assert.equal(replay.trade.cashAfterCents, 990000);
    assert.equal((await query("SELECT COUNT(*) count FROM kq_crypto_trades")).count, 1);
    assert.equal((await query("SELECT COALESCE(SUM(balance_cents),0)::INTEGER amount FROM kq_treasury_balances WHERE account='suspense'")).amount, 0);
  });

  await check("publication still rejects entirely old, future, malformed, and duplicate provider batches", async () => {
    await setClock("2026-10-05T17:15:00Z"); const lease = await claim();
    const fresh = assetsAt("2026-10-05T17:15:00Z");
    for (const invalid of [
      assetsAt("2026-10-05T17:05:00Z"), // exactly ten minutes is already stale ingestion
      assetsAt("2026-10-05T17:16:01Z"),
      fresh.map((asset, i) => i === 0 ? { ...asset, name: null } : asset),
      fresh.map(asset => ({ ...asset, id: 1 })),
    ]) await rejects(() => publish(lease.leaseId, invalid), /crypto_invalid_quotes/);
    assert.equal((await status()).succeededAt, null);
    assert.equal((await status()).quoteCount, 0);
    assert.equal(await publish(lease.leaseId, fresh), true);
  });

  await check("a previous-slot provider row stays visible and cannot be traded with 99 fresh quotes", async () => {
    await setClock("2026-10-05T17:00:02Z"); const lease = await claim();
    const partial = assetsAt("2026-10-05T17:00:02Z").map(asset => asset.id === 100 ? { ...asset, quotedAt: "2026-10-04T17:00:00Z" } : asset);
    assert.equal(await publish(lease.leaseId, partial), true);
    assert.equal((await status()).freshQuoteCount, 99);
    assert.equal((await command()).assets.length, 100);
    assert.equal((await command()).marketStatus, "stale");
    await rejects(() => buy(100), /crypto_stale/);
    assert((await buy(1)).orderId);
  });

  await check("failed and disappeared workers recover without duplicate leases or losing Retry-After", async () => {
    await setClock("2026-10-05T17:00:00Z");
    const first = await claim(); assert.equal(await claim(), null);
    assert.equal(await fail(first.leaseId, "rate_limited", 180), true);
    assert.equal(iso((await status()).nextAttemptAt), "2026-10-05T17:03:00.000Z");
    await setClock("2026-10-05T17:02:59Z"); assert.equal(await claim(), null);
    await setClock("2026-10-05T17:03:00Z"); const disappeared = await claim();
    await setClock("2026-10-05T17:03:59Z"); assert.equal(await claim(), null);
    await setClock("2026-10-05T17:04:00Z"); const replacement = await claim();
    assert.notEqual(replacement.leaseId, disappeared.leaseId);
    assert.equal(await fail(disappeared.leaseId, "rate_limited", 3600), false);
    assert.equal(await publish(disappeared.leaseId, assetsAt("2026-10-05T17:04:00Z")), false);
    assert.equal(await publish(replacement.leaseId, assetsAt("2026-10-05T17:04:00Z")), true);
    assert.equal((await status()).failureCount, 0);
    assert.equal(iso((await status()).nextAttemptAt), "2026-10-06T17:00:00.000Z");
    assert.equal(await fail(replacement.leaseId, "publish_failed"), false);
  });

  await check("partial provider throttling can defer the next daily call without replaying success", async () => {
    await setClock("2026-10-05T17:00:00Z"); const lease = await claim();
    assert.equal(await publish(lease.leaseId, assetsAt("2026-10-05T17:00:00Z"), 90000), true);
    assert.equal(iso((await status()).nextAttemptAt), "2026-10-06T18:00:00.000Z");
    await setClock("2026-10-06T17:00:00Z"); assert.equal(await claim(), null);
    assert.equal(await publish(lease.leaseId, assetsAt("2026-10-06T17:00:00Z"), 604800), false);
    assert.equal(iso((await status()).nextAttemptAt), "2026-10-06T18:00:00.000Z");
    await setClock("2026-10-06T18:00:00Z"); assert((await claim())?.leaseId);
  });

  await check("quote validity and completed orders still reject future timestamps and expired daily prices", async () => {
    await seed(); await setClock("2026-10-06T16:59:59Z");
    const offer = await buy(1);
    await db.query("UPDATE kq_crypto_orders SET expires_at='2026-10-06T18:00:00Z' WHERE id=$1", [offer.orderId]);
    await setClock("2026-10-06T17:00:00Z");
    await rejects(() => confirm(offer.orderId), /crypto_expired/);
    await db.exec("UPDATE kq_crypto_quotes SET quoted_at=now()+interval '61 seconds' WHERE asset_id=1");
    await rejects(() => buy(1), /crypto_stale/);
  });

  await check("private tables and helpers stay inaccessible while service-role RPCs remain usable", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      for (const table of ["kq_crypto_quotes", "kq_crypto_refresh_state", "kq_crypto_positions", "kq_crypto_orders", "kq_crypto_trades"]) {
        assert.equal((await query("SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') allowed", [role, table])).allowed, false);
      }
      for (const signature of ["kq_crypto_refresh_slot(timestamptz)", "kq_crypto_next_refresh_at(timestamptz)", "kq_crypto_quote_expires_at(timestamptz)", "kq_crypto_quote_is_fresh(timestamptz,timestamptz)"]) {
        assert.equal((await query("SELECT has_function_privilege($1,$2,'EXECUTE') allowed", [role, signature])).allowed, false);
      }
      for (const signature of ["rpc_kq_crypto_refresh_claim()", "rpc_kq_crypto_refresh_publish(uuid,jsonb)", "rpc_kq_crypto_refresh_publish(uuid,jsonb,integer)", "rpc_kq_crypto_refresh_fail(uuid,text,integer)", "rpc_kq_crypto_refresh_status()", "rpc_kq_crypto_command(uuid,text,jsonb,boolean)"]) {
        assert.equal((await query("SELECT has_function_privilege($1,$2,'EXECUTE') allowed", [role, signature])).allowed, role === "service_role");
      }
    }
    await setClock("2026-10-05T17:00:02Z"); await db.exec("SET ROLE service_role");
    try {
      const lease = await claim();
      assert.equal(await publish(lease.leaseId, assetsAt("2026-10-05T17:00:02Z")), true);
      assert.equal((await status()).freshQuoteCount, 100);
      assert.equal((await command()).marketStatus, "live");
      assert((await buy(1)).orderId);
    } finally { await db.exec("RESET ROLE"); }
  });
  console.log(`Daily crypto PostgreSQL: ${checks} checks passed.`);
} finally { await db.close(); }
