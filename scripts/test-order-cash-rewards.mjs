// Isolated PostgreSQL checks. Pass the installed @electric-sql/pglite dist/index.js.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(process.argv[2] ? pathToFileURL(path.resolve(process.argv[2])).href : "@electric-sql/pglite");
const db = new PGlite();
const checks = [];
const ids = {};
const query = (sql, args = []) => db.query(sql, args);
const exec = (sql) => db.exec(sql);
const scalar = async (sql, args = []) => Object.values((await query(sql, args)).rows[0])[0];
const read = (file) => readFile(path.resolve(file), "utf8");
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const get = (name = null) => scalar("SELECT rpc_kq_get_order_cash_rewards($1)", [ids[name] ?? name]);
const sync = (name) => scalar("SELECT rpc_kq_sync_order_cash_rewards($1)", [ids[name] ?? name]);
const receipts = (name) => get(name).then((result) => result.receipts);
const wallet = (name) => scalar("SELECT COALESCE((SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1),0)", [ids[name]]);
const countReceipt = (id) => scalar("SELECT count(*)::INTEGER FROM kq_order_cash_reward_grants WHERE order_id=$1", [id]);
const addUser = async (name, email = `${name}@example.test`, verified = true) => {
  ids[name] = crypto.randomUUID();
  await query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,$3)", [ids[name], email, verified ? new Date() : null]);
};
const order = (id, name, total = 55, options = {}) => query(`INSERT INTO orders
  (id,customer_id,customer_email,total_amount,delivery_fee,discount_amount,payment_state,status,archived_at,payment_review_required,paid_at)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [id, ids[name] ?? null, options.email ?? `${name}@example.test`, total,
  options.shipping ?? 5, options.discount ?? 0, options.state ?? "paid", options.status ?? "paid", options.archivedAt ?? null,
  options.review ?? false, options.paidAt ?? null]);
const rows = async () => {
  const result = {};
  for (const { tablename } of (await query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows) {
    assert.match(tablename, /^[a-z_]+$/);
    result[tablename] = (await query(`SELECT to_jsonb(row) AS row FROM public."${tablename}" row ORDER BY to_jsonb(row)::text`)).rows;
  }
  return result;
};

try {
  await exec(`
    CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE auth.users(id UUID PRIMARY KEY,email TEXT,email_confirmed_at TIMESTAMPTZ);
    CREATE TABLE orders(id TEXT PRIMARY KEY,customer_id UUID REFERENCES auth.users ON DELETE SET NULL,customer_email TEXT,
      total_amount NUMERIC(10,2) NOT NULL,delivery_fee NUMERIC(10,2),discount_amount NUMERIC(10,2),payment_state TEXT NOT NULL,
      status TEXT NOT NULL,archived_at TIMESTAMPTZ,payment_review_required BOOLEAN NOT NULL DEFAULT FALSE,
      paid_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
      cash_cents INTEGER NOT NULL DEFAULT 35000 CHECK(cash_cents>=0),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE test_refresh_failures(user_id UUID PRIMARY KEY,error_code TEXT NOT NULL DEFAULT 'P0001');
    CREATE TABLE kq_commerce_accounts(user_id UUID PRIMARY KEY,business_started_at TIMESTAMPTZ,
      computer_owned BOOLEAN DEFAULT FALSE,shop_created_at TIMESTAMPTZ,vat_reserved_cents INTEGER DEFAULT 0);
    CREATE TABLE kq_player_equipment(user_id UUID,equipment_code TEXT,tent_number INTEGER,purchase_price_cents INTEGER,acquired_at TIMESTAMPTZ);
    CREATE TABLE kq_culture_equipment_replacements(user_id UUID,equipment_code TEXT,tent_number INTEGER,created_at TIMESTAMPTZ,request_key UUID,receipt JSONB);
    CREATE TABLE kq_equipment_upgrade_receipts(user_id UUID,equipment_code TEXT,tent_number INTEGER,created_at TIMESTAMPTZ,id UUID,price_cents INTEGER);
    CREATE TABLE kq_commerce_requests(user_id UUID,created_at TIMESTAMPTZ,action TEXT);
    CREATE TABLE kq_business_ledger(user_id UUID,id UUID,amount_cents INTEGER,kind TEXT,occurred_at TIMESTAMPTZ);
    CREATE TABLE arena_chanvrier_savings_deposits(user_id UUID,balance_cents INTEGER);
    CREATE TABLE kq_lab_invoices(user_id UUID,remaining_cents INTEGER);
    CREATE TABLE kq_energy_invoices(user_id UUID,remaining_cents INTEGER);
  `);
  const arena = await read("supabase/migrations/20260826000100_arena_customer_reward_pool.sql");
  await exec(arena.slice(arena.indexOf("CREATE OR REPLACE FUNCTION public.arena_set_order_paid_at()"), arena.indexOf("UPDATE public.orders")));
  const treasury = await read("supabase/migrations/20260921000200_kq_treasury_accounting.sql");
  // Actual latest initialization/observer and original journal, posting
  // validation, pairing, queue, flush and refresh. Unrelated stock is empty.
  await exec(treasury.split("-- Actual production cost only.")[0] + "COMMIT;");
  const tents = await read("supabase/migrations/20260924000300_kq_individual_tents.sql");
  await exec("CREATE FUNCTION kq_treasury_stock_cost(p_user UUID) RETURNS BIGINT LANGUAGE sql AS $$ SELECT 0::BIGINT $$;");
  await exec(tents.slice(tents.indexOf("CREATE OR REPLACE FUNCTION public.kq_treasury_initialize"), tents.indexOf("REVOKE ALL ON FUNCTION public.kq_assert_owned_tent")));
  await exec(treasury.slice(treasury.indexOf("CREATE FUNCTION public.kq_treasury_refresh"), treasury.indexOf("CREATE FUNCTION public.kq_treasury_observe")));
  await exec(`
    ALTER FUNCTION kq_treasury_refresh(UUID) RENAME TO test_real_treasury_refresh;
    CREATE FUNCTION kq_treasury_refresh(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ DECLARE code TEXT; BEGIN
      SELECT error_code INTO code FROM test_refresh_failures WHERE user_id=p_user;
      IF FOUND THEN RAISE EXCEPTION 'simulated_treasury_failure' USING ERRCODE=code; END IF;
      PERFORM test_real_treasury_refresh(p_user);
    END $$;
    CREATE TRIGGER kq_treasury_wallet AFTER INSERT OR UPDATE OF cash_cents ON kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION kq_treasury_observe();
  `);
  for (const name of ["alice", "bob", "legacy", "overflow", "treasury", "zero", "deleted"]) await addUser(name);
  await addUser("guest", "guest@example.test");
  await addUser("unverified", "unverified@example.test", false);
  await addUser("ambiguous-one", "duplicate@example.test");
  await addUser("ambiguous-two", " DUPLICATE@example.test ");
  await order("historical", "legacy", 100, { paidAt: "2026-01-01T00:00:00Z" });
  await order("pending-before-activation", "legacy", 55, { state: "pending", status: "pending_payment" });
  const beforeMigration = await rows();
  await exec(await read("supabase/migrations/20260927000500_kq_order_cash_rewards.sql"));
  const afterMigration = await rows();
  delete afterMigration.kq_order_cash_reward_grants;
  delete afterMigration.kq_order_cash_reward_settings;
  check("migration preserves historical orders, wallets and ledger", afterMigration, beforeMigration);
  const config = await get();
  check("anonymous config discloses rate without receipts", [config.available, config.gameEurosPerEuro, config.receipts], [true, 10, []]);
  check("activation timestamp is persisted and stable", (await get()).startsAt, config.startsAt);
  check("no retrospective reward on account synchronization", (await sync("legacy")).receipts, []);
  check("historical orders never open a wallet", await wallet("legacy"), 0);
  await exec("UPDATE orders SET payment_state='paid',status='paid' WHERE id='pending-before-activation'");
  check("old pending order becomes eligible when newly paid", (await receipts("legacy")).map((row) => row.cashCents), [50000]);

  await order("alice-first", "alice", 55, { discount: 20 });
  const first = (await receipts("alice"))[0];
  check("50 EUR products after discounts and 5 EUR shipping earn 500 game EUR", [first.productsAmountCents, first.cashCents, first.ruleVersion], [5000, 50000, "order-cash-v1"]);
  check("normal opening wallet is preserved in addition to purchase reward", await wallet("alice"), 85000);
  await order("alice-repeat", "alice");
  check("another order of the same value grants the full recurring bonus", [await wallet("alice"), (await receipts("alice")).length], [135000, 2]);
  await exec("UPDATE orders SET payment_state='paid' WHERE id='alice-first'");
  await exec("UPDATE orders SET payment_state='failed' WHERE id='alice-first'; UPDATE orders SET payment_state='paid' WHERE id='alice-first'");
  await Promise.all(Array.from({ length: 6 }, () => sync("alice")));
  check("payment replay and repeated sync credit each order once", [await wallet("alice"), await countReceipt("alice-first")], [135000, 1]);
  await exec("UPDATE orders SET total_amount=999,delivery_fee=0,customer_id=NULL,customer_email='bob@example.test' WHERE id='alice-first'");
  await sync("bob");
  check("receipt freezes value, user and rule after order edits", (await receipts("alice")).find((row) => row.orderId === "alice-first"), first);
  check("reassigning an already rewarded order never grants the new owner", await wallet("bob"), 0);
  check("wallet matches double-entry cash balance", await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='cash'", [ids.alice]), 135000);
  check("reward revenue totals exactly both orders", await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='revenue_rewards'", [ids.alice]), -100000);
  check("reward classification clears wallet suspense", await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='suspense'", [ids.alice]), 0);
  check("one treasury reward source per receipt", await scalar("SELECT count(*)::INTEGER FROM kq_treasury_journal WHERE user_id=$1 AND source_key LIKE 'order-cash:%'", [ids.alice]), 2);
  check("reward flush leaves no deferred treasury work", await scalar("SELECT count(*)::INTEGER FROM kq_treasury_pending"), 0);

  for (const [id, options] of [
    ["pending", { state: "pending" }], ["failed", { state: "failed" }], ["unconfigured", { state: "not_configured" }],
    ["cancelled", { status: "cancelled" }], ["archived", { archivedAt: new Date() }], ["review", { review: true }],
    ["historic-paid-date", { paidAt: "2026-01-01T00:00:00Z" }], ["future-paid-date", { paidAt: "2099-01-01T00:00:00Z" }],
  ]) {
    await order(id, "bob", 55, options);
    await sync("bob");
    check(`${id} creates no reward receipt`, await countReceipt(id), 0);
  }
  check("ineligible orders never create a wallet", await wallet("bob"), 0);
  await exec("BEGIN");
  await order("inventory-review", "bob", 55, { state: "pending" });
  await exec("UPDATE orders SET payment_state='paid',status='paid' WHERE id='inventory-review'");
  check("paid transition does not reward before transaction final state", await countReceipt("inventory-review"), 0);
  await exec("UPDATE orders SET payment_review_required=TRUE WHERE id='inventory-review'; COMMIT");
  check("inventory failure marked after paid suppresses reward", [await countReceipt("inventory-review"), await wallet("bob")], [0, 0]);
  await exec("UPDATE orders SET payment_review_required=FALSE WHERE id='inventory-review'");
  check("resolved payment review credits exactly once", [await countReceipt("inventory-review"), await wallet("bob")], [1, 85000]);
  await exec("BEGIN");
  await order("cancel-within-payment", "bob");
  await exec("UPDATE orders SET status='cancelled' WHERE id='cancel-within-payment'; COMMIT");
  check("cancellation within payment transaction suppresses reward", await countReceipt("cancel-within-payment"), 0);
  await exec("UPDATE orders SET status='cancelled' WHERE id='alice-repeat'");
  await sync("alice");
  check("post-grant cancellation cannot create a second reward or rewrite receipt", [await wallet("alice"), await countReceipt("alice-repeat")], [135000, 1]);

  await order("cent", "bob", 5.01);
  check("one real cent produces ten game cents without rounding incentive", (await receipts("bob")).find((row) => row.orderId === "cent").cashCents, 10);
  await order("shipping-only", "zero", 5);
  await order("over-shipping", "zero", 4);
  check("zero product spend freezes zero reward with no wallet", [await wallet("zero"), (await receipts("zero")).map((row) => row.cashCents)], [0, [0, 0]]);
  await order("free-delivery", "bob", 10, { shipping: 0 });
  check("free shipping keeps the full product basis", (await receipts("bob")).find((row) => row.orderId === "free-delivery").cashCents, 10000);
  await order("invalid-shipping", "bob", 10, { shipping: -5 });
  check("negative delivery cannot inflate bonus but payment persists", [await countReceipt("invalid-shipping"), await scalar("SELECT payment_state FROM orders WHERE id='invalid-shipping'")], [0, "paid"]);
  await order("nan-total", "bob", "NaN");
  await order("nan-shipping", "bob", 55, { shipping: "NaN" });
  check("non-finite total or delivery never freezes a misleading receipt", [await countReceipt("nan-total"), await countReceipt("nan-shipping")], [0, 0]);

  await order("guest-verified", null, 55, { email: " GUEST@EXAMPLE.TEST " });
  check("verified guest email matches normalized exact owner", [await wallet("guest"), await countReceipt("guest-verified")], [85000, 1]);
  await order("guest-unverified", null, 55, { email: "unverified@example.test" });
  await sync("unverified");
  check("unverified email cannot claim guest order", [await wallet("unverified"), await countReceipt("guest-unverified")], [0, 0]);
  await query("UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1", [ids.unverified]);
  await sync("unverified");
  check("later email verification can recover an unpaid reward", [await wallet("unverified"), await countReceipt("guest-unverified")], [85000, 1]);
  await order("guest-ambiguous", null, 55, { email: "duplicate@example.test" });
  await sync("ambiguous-one");
  check("ambiguous normalized emails grant nobody", await countReceipt("guest-ambiguous"), 0);
  await order("guest-missing", null, 55, { email: "missing@example.test" });
  await order("guest-blank", null, 55, { email: "  " });
  check("unknown or blank guest email remains unclaimed", [await countReceipt("guest-missing"), await countReceipt("guest-blank")], [0, 0]);
  await order("direct-owner-wins", "alice", 6, { email: "bob@example.test" });
  check("explicit customer ID takes precedence over mismatching email", [(await receipts("alice")).some((row) => row.orderId === "direct-owner-wins"), (await receipts("bob")).some((row) => row.orderId === "direct-owner-wins")], [true, false]);

  await query("INSERT INTO kq_equipment_wallets(user_id,cash_cents) VALUES($1,2147480000)", [ids.overflow]);
  const overflowWallet = await wallet("overflow");
  await order("overflow-payment", "overflow");
  check("wallet overflow never rolls back real payment", await scalar("SELECT payment_state FROM orders WHERE id='overflow-payment'"), "paid");
  check("overflow rolls back receipt and entire optional credit", [await wallet("overflow"), await countReceipt("overflow-payment")], [overflowWallet, 0]);
  await query("UPDATE kq_equipment_wallets SET cash_cents=100000 WHERE user_id=$1", [ids.overflow]);
  await sync("overflow");
  check("sync recovers deferred reward after wallet has room", [await wallet("overflow"), await countReceipt("overflow-payment")], [150000, 1]);
  await order("oversized-order", "overflow", 99999999);
  check("huge persisted amount is checked before integer cast and preserves payment", [await countReceipt("oversized-order"), await scalar("SELECT payment_state FROM orders WHERE id='oversized-order'")], [0, "paid"]);
  await query("INSERT INTO test_refresh_failures VALUES($1)", [ids.treasury]);
  await order("treasury-failure", "treasury");
  check("failure in deferred wallet accounting cannot undo real payment", await scalar("SELECT payment_state FROM orders WHERE id='treasury-failure'"), "paid");
  check("accounting failure rolls back wallet, receipt and journal together", [await wallet("treasury"), await countReceipt("treasury-failure"), await scalar("SELECT count(*)::INTEGER FROM kq_treasury_journal WHERE user_id=$1", [ids.treasury])], [0, 0, 0]);
  await exec("DELETE FROM test_refresh_failures");
  await sync("treasury");
  check("transient accounting failure recovers exactly once through sync", [await wallet("treasury"), await countReceipt("treasury-failure")], [85000, 1]);
  await sync("treasury");
  check("recovered reward is idempotent", await wallet("treasury"), 85000);
  await query("INSERT INTO test_refresh_failures(user_id,error_code) VALUES($1,'57014')", [ids.treasury]);
  await order("treasury-timeout", "treasury");
  check("query cancellation in optional reward preserves captured payment", [await scalar("SELECT payment_state FROM orders WHERE id='treasury-timeout'"), await countReceipt("treasury-timeout"), await wallet("treasury")], ["paid", 0, 85000]);
  await sync("treasury");
  check("canceled sync remains safe and can be retried", [await countReceipt("treasury-timeout"), await wallet("treasury")], [0, 85000]);
  await exec("DELETE FROM test_refresh_failures");
  await sync("treasury");
  check("canceled reward recovers after a later successful sync", [await countReceipt("treasury-timeout"), await wallet("treasury")], [1, 135000]);

  await order("deleted-account-order", "deleted");
  const deletedId = ids.deleted;
  await query("DELETE FROM auth.users WHERE id=$1", [deletedId]);
  await addUser("replacement", "deleted@example.test");
  await sync("replacement");
  check("account deletion and verified email reuse cannot duplicate old reward", [await wallet("replacement"), await scalar("SELECT user_id FROM kq_order_cash_reward_grants WHERE order_id='deleted-account-order'")], [0, deletedId]);
  await exec("DELETE FROM orders WHERE id='deleted-account-order'");
  await order("deleted-account-order", "replacement");
  check("deleting and importing same order ID cannot bypass idempotency", [await wallet("replacement"), await countReceipt("deleted-account-order")], [0, 1]);
  const beforeRead = await rows();
  await get(); await get("alice"); await get("bob");
  check("GET config and receipts are strictly read-only", await rows(), beforeRead);
  check("anonymous config never leaks customer receipts", (await get()).receipts, []);
  check("receipts are scoped to requested user", (await receipts("guest")).every((row) => row.orderId === "guest-verified"), true);
  await assert.rejects(() => sync(null), /kq_order_cash_invalid_user/); checks.push("sync rejects null customer");
  await assert.rejects(() => sync(crypto.randomUUID()), /kq_order_cash_invalid_user/); checks.push("sync rejects missing customer");
  check("every actual journal entry is balanced", await scalar(`SELECT NOT EXISTS(SELECT 1 FROM kq_treasury_journal entry
    WHERE (SELECT sum((line->>'deltaCents')::BIGINT) FROM jsonb_array_elements(entry.postings) line)<>0)`), true);
  for (const table of ["kq_order_cash_reward_settings", "kq_order_cash_reward_grants"]) {
    for (const role of ["anon", "authenticated", "service_role"]) {
      check(`${table} is private to ${role}`, await scalar("SELECT NOT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE')", [role, table]), true);
    }
    check(`${table} enables RLS`, await scalar("SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass", [table]), true);
  }
  for (const rpc of ["rpc_kq_get_order_cash_rewards(uuid)", "rpc_kq_sync_order_cash_rewards(uuid)"]) {
    check(`${rpc} is executable only by server`, await scalar(`SELECT has_function_privilege('service_role',$1,'EXECUTE')
      AND NOT has_function_privilege('anon',$1,'EXECUTE') AND NOT has_function_privilege('authenticated',$1,'EXECUTE')`, [rpc]), true);
    check(`${rpc} pins definer search path`, await scalar("SELECT prosecdef AND 'search_path=public'=ANY(proconfig) FROM pg_proc WHERE oid=$1::regprocedure", [rpc]), true);
  }
  for (const helper of ["kq_order_cash_reward_owner(uuid,text)", "kq_grant_order_cash_reward(text,uuid)", "kq_order_cash_reward_after_payment()"]) {
    check(`${helper} cannot be called through API`, await scalar(`SELECT NOT has_function_privilege('service_role',$1,'EXECUTE')
      AND NOT has_function_privilege('anon',$1,'EXECUTE') AND NOT has_function_privilege('authenticated',$1,'EXECUTE')`, [helper]), true);
  }
  const report = { result: "passed", checks: checks.length, details: checks, engine: "PGlite isolated PostgreSQL",
    concurrency: "Requests queue on PGlite's single connection; simultaneous transaction lock waits require a separate PostgreSQL environment.",
    fixtures: "Real paid_at trigger and latest treasury initialization/observer plus postings/queue/flush/refresh; empty equipment/stock fixtures, injected refresh errors.", checkedAt: new Date().toISOString() };
  await mkdir("output/order-cash-rewards", { recursive: true });
  await writeFile("output/order-cash-rewards/sql-verification.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error.message);
  if (error.detail) console.error(error.detail);
  if (error.query) console.error(error.query);
  process.exitCode = 1;
} finally {
  await db.close();
}
