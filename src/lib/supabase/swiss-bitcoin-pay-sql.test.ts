import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const owner = "11111111-1111-4111-8111-111111111111";
const checkout = "22222222-2222-4222-8222-222222222222";
const invoice = "33333333-3333-4333-8333-333333333333";
const secondInvoice = "44444444-4444-4444-8444-444444444444";
const reward = "55555555-5555-4555-8555-555555555555";
let db: PGlite;

function migration(name: string) {
  return readFileSync(`supabase/migrations/${name}.sql`, "utf8");
}

function definition(source: string, name: string) {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) throw new Error(`Fonction SQL introuvable : ${name}`);
  return source.slice(start, source.indexOf("$$;", start) + 3);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TYPE payment_state AS ENUM ('pending','paid','failed','not_configured');
    CREATE TYPE order_status AS ENUM ('new','pending_payment','paid','processing','shipped','cancelled');
    CREATE TABLE orders(id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT now(), payment_provider TEXT DEFAULT 'viva',
      payment_state payment_state NOT NULL, status order_status NOT NULL, total_amount NUMERIC NOT NULL,
      viva_order_code TEXT UNIQUE, viva_transaction_id TEXT UNIQUE, customer_id UUID, promo_code TEXT,
      archived_at TIMESTAMPTZ, archived_reason TEXT, checkout_attempt_id UUID,
      payment_review_required BOOLEAN NOT NULL DEFAULT FALSE, payment_review_reason TEXT,
      stock_applied_at TIMESTAMPTZ, tracking_number TEXT, paid_at TIMESTAMPTZ);
    CREATE TABLE products(id TEXT PRIMARY KEY, track_stock BOOLEAN, stock_quantity INTEGER, variant_options JSONB);
    CREATE TABLE order_items(id INTEGER, order_id TEXT, product_id TEXT, quantity INTEGER, unit_price NUMERIC);
    CREATE TABLE checkout_attempts(attempt_id UUID PRIMARY KEY, customer_id UUID, cart_fingerprint TEXT, order_id TEXT, state TEXT DEFAULT 'creating',
      updated_at TIMESTAMPTZ DEFAULT now(), last_error TEXT, viva_order_code TEXT, checkout_url TEXT, attempt_count INTEGER DEFAULT 1);
    CREATE TABLE promo_codes(customer_id UUID, code TEXT, used BOOLEAN, used_at TIMESTAMPTZ);
    CREATE TABLE lottery_reward_claims(id UUID PRIMARY KEY, user_id UUID, reward_line_id TEXT, status TEXT,
      reserved_order_id TEXT, reserved_at TIMESTAMPTZ, reserved_until TIMESTAMPTZ, used_at TIMESTAMPTZ, used_order_id TEXT,
      reward_snapshot JSONB);
    CREATE TABLE lottery_reward_lines(claim_id UUID, status TEXT, claimed_at TIMESTAMPTZ);
    CREATE TABLE lottery_audit_log(event_type TEXT, order_id TEXT, details JSONB, user_id UUID, reward_claim_id UUID);
    CREATE FUNCTION rpc_create_order(p_order JSONB, p_items JSONB, p_promo JSONB) RETURNS TEXT LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO orders(id, payment_provider, payment_state, status, total_amount, customer_id, promo_code)
      VALUES (p_order->>'id', p_order->>'payment_provider', (p_order->>'payment_state')::payment_state,
        (p_order->>'status')::order_status, (p_order->>'total_amount')::NUMERIC,
        (p_order->>'customer_id')::UUID, p_promo->>'code');
      UPDATE promo_codes SET used = TRUE WHERE code = p_promo->>'code' AND NOT used;
      INSERT INTO order_items VALUES (1, p_order->>'id', p_items->>'product_id', 2, 5);
      RETURN p_order->>'id';
    END; $$;
  `);
  const lottery = migration("20260228000800_lottery_dynamic_rewards");
  for (const name of ["lottery_release_expired_claim_reservations", "rpc_reserve_lottery_reward_claim",
    "rpc_consume_lottery_reward_claims_for_order", "rpc_release_lottery_reward_claims_for_order"]) {
    await db.exec(definition(lottery, name));
  }
  await db.exec(definition(migration("20260811000100_checkout_payment_security_hardening"), "rpc_begin_checkout_attempt"));
  await db.exec(definition(migration("20260826000100_arena_customer_reward_pool"), "arena_set_order_paid_at"));
  await db.exec(definition(migration("20261025000300_monthly_review_draw"), "monthly_review_draw_keep_order_reservation"));
  await db.exec(`
    CREATE TRIGGER trg_arena_set_order_paid_at BEFORE INSERT OR UPDATE OF payment_state ON public.orders
      FOR EACH ROW EXECUTE FUNCTION public.arena_set_order_paid_at();
    CREATE TRIGGER monthly_review_draw_order_reservation BEFORE INSERT OR UPDATE ON public.lottery_reward_claims
      FOR EACH ROW EXECUTE FUNCTION public.monthly_review_draw_keep_order_reservation();
  `);
  await db.exec(migration("20261110000300_security_payment_boundaries"));
  await db.exec(migration("20261121000100_swiss_bitcoin_pay"));
  await db.exec(migration("20261121000200_swiss_bitcoin_deferred_archive"));
}, 30_000);

beforeEach(async () => {
  await db.exec(`
    TRUNCATE orders, swiss_bitcoin_payment_attempts, products, order_items, checkout_attempts, promo_codes,
      lottery_reward_claims, lottery_reward_lines, lottery_audit_log;
    INSERT INTO checkout_attempts(attempt_id, customer_id, cart_fingerprint) VALUES ('${checkout}', '${owner}', repeat('1',64));
    INSERT INTO products VALUES ('product', TRUE, 5, NULL);
    INSERT INTO promo_codes VALUES ('${owner}', 'TEST', FALSE, NULL);
    INSERT INTO lottery_reward_claims(id, user_id, status) VALUES ('${reward}', '${owner}', 'available');
  `);
  await createOrder();
});

afterAll(async () => { await db?.close(); });

const createOrder = () => db.query("SELECT rpc_create_swiss_bitcoin_order($1, $2, $3, $4, $5)", [
  { id: "ORDER-1", customer_id: owner, total_amount: 10 }, { product_id: "product" }, { code: "TEST" }, checkout, reward,
]);

const checkoutBegin = (attemptId = checkout) => db.query<{ result: object }>(
  "SELECT rpc_begin_checkout_attempt($1, $2, repeat('1',64)) AS result", [attemptId, owner],
);

async function begin(retry = false) {
  return (await db.query<{ result: { action: string; attempt_id: string; expected_eur_minor: number } }>(
    "SELECT rpc_begin_swiss_bitcoin_payment('ORDER-1', $1) AS result", [retry],
  )).rows[0].result;
}

function attach(attemptId: string, invoiceId = invoice) {
  return db.query("SELECT rpc_attach_swiss_bitcoin_invoice($1, $2, 'https://app.swiss-bitcoin-pay.ch/checkout/test')",
    [attemptId, invoiceId]);
}

async function observe(attemptId: string, state: string, invoiceId = invoice, cents = 1000, currency = "EUR") {
  return (await db.query<{ result: object }>(`
    SELECT rpc_observe_swiss_bitcoin_payment($1, $2, $3, $4, $5, $3,
      CASE WHEN $3 = 'paid' THEN now() END, CASE WHEN $3 = 'paid' THEN 20000 END,
      'reference', now() + interval '5 minutes', NULL) AS result
  `, [attemptId, invoiceId, state, cents, currency])).rows[0].result;
}

const order = async () => (await db.query<{ swiss_bitcoin_archive_requested_at: Date | null; paid_at: Date | null }>(
  "SELECT * FROM orders WHERE id = 'ORDER-1'",
)).rows[0];
const stock = async () => (await db.query("SELECT stock_quantity FROM products")).rows[0];
const claim = async () => (await db.query("SELECT status, reserved_order_id, used_order_id FROM lottery_reward_claims")).rows[0];
const attempts = async () => (await db.query("SELECT id, state, issue, paid_sats, effects_pending FROM swiss_bitcoin_payment_attempts ORDER BY created_at")).rows;
const card = async () => (await db.query("SELECT rpc_claim_swiss_bitcoin_card_fallback('ORDER-1') AS claimed")).rows[0];
const requestArchive = async () => (await db.query("SELECT rpc_request_swiss_bitcoin_archive('ORDER-1') AS result")).rows[0];
const archiveIdle = async () => (await db.query("SELECT rpc_archive_idle_swiss_bitcoin_orders(25) AS count")).rows[0];

describe("Swiss Bitcoin Pay payment transitions", () => {
  it("commits order, checkout link and reserved reward once, shared by card and Bitcoin", async () => {
    await createOrder();
    expect(await order()).toMatchObject({ payment_provider: "swiss_bitcoin_pay", payment_state: "pending" });
    expect(await claim()).toMatchObject({ status: "reserved", reserved_order_id: "ORDER-1" });
    const expected = { action: "resume", order_id: "ORDER-1", checkout_url: "/checkout/bitcoin/ORDER-1" };
    expect((await checkoutBegin()).rows[0].result).toMatchObject(expected);
    expect((await checkoutBegin(secondInvoice)).rows[0].result).toMatchObject(expected);
  });

  it("allocates one payable invoice and applies inventory and rewards once on repeated confirmation", async () => {
    const results = await Promise.all([begin(), begin()]);
    const { attempt_id: attemptId } = results[0];
    expect(results).toEqual([
      { action: "create", attempt_id: attemptId, expected_eur_minor: 1000 },
      { action: "existing", attempt_id: attemptId },
    ]);
    await attach(attemptId);
    expect(await card()).toEqual({ claimed: false });
    await expect(db.exec("SELECT rpc_admin_update_order('ORDER-1','{\"payment_state\":\"paid\"}')"))
      .rejects.toThrow("order_transition_bitcoin_verification_required");
    expect(await observe(attemptId, "paid")).toEqual({ effects_pending: true });
    expect(await observe(attemptId, "paid")).toEqual({ effects_pending: true });
    expect(await order()).toMatchObject({ payment_state: "paid", status: "paid", payment_review_required: false });
    expect(await stock()).toEqual({ stock_quantity: 3 });
    expect(await claim()).toMatchObject({ status: "used", used_order_id: "ORDER-1" });
    await db.query("SELECT rpc_complete_swiss_bitcoin_effects($1)", [attemptId]);
    expect(await observe(attemptId, "expired")).toEqual({ effects_pending: false });
    expect(await stock()).toEqual({ stock_quantity: 3 });
  });

  it.each([[999, "EUR"], [1000, "CHF"]])("holds a reported payment with mismatched amount or currency (%s %s)", async (cents, currency) => {
    const { attempt_id: attemptId } = await begin();
    await attach(attemptId);
    expect(await observe(attemptId, "paid", invoice, cents, currency)).toEqual({ effects_pending: false });
    expect(await attempts()).toMatchObject([{ state: "review", issue: "payment_verification_mismatch" }]);
    expect(await order()).toMatchObject({ payment_state: "pending", payment_review_required: true });
    expect(await stock()).toEqual({ stock_quantity: 5 });
  });

  it("holds creation after an ambiguous timeout and learns an invoice only from matching evidence", async () => {
    const { attempt_id: attemptId } = await begin();
    await db.query("SELECT rpc_note_swiss_bitcoin_creation($1, FALSE)", [attemptId]);
    expect(await begin(true)).toEqual({ action: "existing", attempt_id: attemptId });
    expect(await card()).toEqual({ claimed: false });
    await expect(observe(attemptId, "paid", invoice, 1)).rejects.toThrow("bitcoin_invoice_mismatch");
    await observe(attemptId, "paid");
    expect(await order()).toMatchObject({ payment_state: "paid" });
    expect(await attempts()).toMatchObject([{ state: "paid", paid_sats: 20000 }]);
  });

  it("retains a recovered invoice for review when its payment time is ambiguous", async () => {
    const { attempt_id: attemptId } = await begin();
    await db.query("SELECT rpc_note_swiss_bitcoin_creation($1, FALSE)", [attemptId]);
    await db.query(`
      SELECT rpc_observe_swiss_bitcoin_payment($1, $2, 'review', 1000, 'EUR', 'paid',
        NULL, NULL, NULL, NULL, 'invoice_timing_unverified')
    `, [attemptId, invoice]);
    expect(await attempts()).toMatchObject([{ state: "review", issue: "invoice_timing_unverified" }]);
    expect(await order()).toMatchObject({ payment_state: "pending", payment_review_required: true });
  });

  it("permits a retry only after verified expiry and keeps a second payment visible for review", async () => {
    const { attempt_id: first } = await begin();
    await attach(first);
    await observe(first, "expired");
    const { attempt_id: second } = await begin(true);
    expect(second).not.toBe(first);
    await attach(second, secondInvoice);
    await observe(second, "paid", secondInvoice);
    await observe(first, "paid");
    expect(await stock()).toEqual({ stock_quantity: 3 });
    expect(await attempts()).toMatchObject([{ state: "review", issue: "duplicate_payment" }, { state: "paid" }]);
  });

  it("archives a safely expired order, releases its benefits and records a later capture without fulfillment", async () => {
    const { attempt_id: attemptId } = await begin();
    await attach(attemptId);
    await expect(db.exec("SELECT rpc_archive_incomplete_order('ORDER-1')")).rejects.toThrow("order_transition_bitcoin_open");
    await observe(attemptId, "expired");
    await db.exec("UPDATE orders SET created_at = now() - interval '61 minutes'; SELECT rpc_archive_idle_swiss_bitcoin_orders(25)");
    await observe(attemptId, "paid");
    expect(await attempts()).toMatchObject([{ state: "review", issue: "payment_after_cancellation", paid_sats: 20000 }]);
    expect(await order()).toMatchObject({ status: "cancelled", payment_review_required: true });
    expect(await claim()).toMatchObject({ status: "available" });
    expect((await db.query("SELECT used FROM promo_codes")).rows[0]).toEqual({ used: false });
    expect(await stock()).toEqual({ stock_quantity: 5 });
  });

  it("withholds processing and rewards when the stock is gone at payment time", async () => {
    const { attempt_id: attemptId } = await begin();
    await attach(attemptId);
    await db.exec("UPDATE products SET stock_quantity = 1");
    expect(await observe(attemptId, "paid")).toEqual({ effects_pending: false });
    expect(await order()).toMatchObject({ payment_state: "pending", payment_review_required: true, stock_applied_at: null });
    expect(await attempts()).toMatchObject([{ state: "review", issue: "inventory_insufficient_product:product", paid_sats: 20000 }]);
    expect(await claim()).toMatchObject({ status: "reserved" });
    expect(await stock()).toEqual({ stock_quantity: 1 });
  });

  it("uses the existing Viva finalization after a safe card switch and retains the old invoice", async () => {
    const { attempt_id: attemptId } = await begin();
    await attach(attemptId);
    await observe(attemptId, "expired");
    expect(await card()).toEqual({ claimed: true });
    expect(await card()).toEqual({ claimed: false });
    expect(await begin(true)).toEqual({ action: "blocked" });
    await db.exec("SELECT rpc_attach_swiss_bitcoin_card_fallback('ORDER-1','123456')");
    await db.query("SELECT rpc_finalize_viva_payment('123456',$1,1000,'978')", [secondInvoice]);
    expect(await order()).toMatchObject({ payment_provider: "viva", payment_state: "paid", viva_transaction_id: secondInvoice });
    await observe(attemptId, "paid");
    expect(await stock()).toEqual({ stock_quantity: 3 });
    expect(await attempts()).toMatchObject([{ state: "review", issue: "duplicate_payment" }]);
  });

  it.each(["failed", "expired"])("archives an admin request immediately after a verified %s attempt", async (state) => {
    const { attempt_id: attemptId } = await begin();
    if (state === "failed") {
      await db.query("SELECT rpc_note_swiss_bitcoin_creation($1, TRUE)", [attemptId]);
    } else {
      await attach(attemptId);
      await observe(attemptId, "expired");
    }
    expect(await requestArchive()).toEqual({ result: { action: "archived" } });
    expect(await order()).toMatchObject({ status: "cancelled", payment_state: "failed", archived_reason: "admin_removed_incomplete" });
    expect(await claim()).toMatchObject({ status: "available" });
    expect(await attempts()).toMatchObject([{ id: attemptId, state }]);
    expect(await requestArchive()).toEqual({ result: { action: "blocked" } });
  });

  it("keeps an active invoice payable, prevents replacement and archives as soon as expiry is verified", async () => {
    const { attempt_id: attemptId } = await begin();
    await attach(attemptId);
    await expect(db.exec("SELECT rpc_archive_incomplete_order('ORDER-1')")).rejects.toThrow("order_transition_bitcoin_open");
    expect(await requestArchive()).toEqual({ result: { action: "scheduled" } });
    const requested = (await order()).swiss_bitcoin_archive_requested_at;
    expect(requested).not.toBeNull();
    expect(await requestArchive()).toEqual({ result: { action: "scheduled" } });
    expect((await order()).swiss_bitcoin_archive_requested_at).toEqual(requested);
    expect(await archiveIdle()).toEqual({ count: 0 });
    expect(await claim()).toMatchObject({ status: "reserved" });
    await observe(attemptId, "expired");
    await expect(begin(true)).rejects.toThrow("order_transition_bitcoin_archive_requested");
    await expect(card()).rejects.toThrow("order_transition_bitcoin_archive_requested");
    expect(await archiveIdle()).toEqual({ count: 1 });
    expect(await order()).toMatchObject({ status: "cancelled", archived_reason: "admin_removed_incomplete" });
    expect(await claim()).toMatchObject({ status: "available" });
    await observe(attemptId, "paid");
    expect(await attempts()).toMatchObject([{ state: "review", issue: "payment_after_cancellation" }]);
    expect(await stock()).toEqual({ stock_quantity: 5 });
  });

  it("clears the request when an open invoice is paid and preserves the normal payment effects", async () => {
    const { attempt_id: attemptId } = await begin();
    await attach(attemptId);
    expect(await requestArchive()).toEqual({ result: { action: "scheduled" } });
    expect(await observe(attemptId, "paid")).toEqual({ effects_pending: true });
    expect(await order()).toMatchObject({ status: "paid", archived_at: null, swiss_bitcoin_archive_requested_at: null });
    expect((await order()).paid_at).not.toBeNull();
    expect(await stock()).toEqual({ stock_quantity: 3 });
    expect(await requestArchive()).toEqual({ result: { action: "blocked" } });
    expect(await archiveIdle()).toEqual({ count: 0 });
  });

  it("retains an ambiguous attempt indefinitely and withholds an archived outcome when review is required", async () => {
    const { attempt_id: attemptId } = await begin();
    expect(await requestArchive()).toEqual({ result: { action: "scheduled" } });
    await db.query("SELECT rpc_note_swiss_bitcoin_creation($1, FALSE)", [attemptId]);
    await db.exec("UPDATE orders SET created_at = now() - interval '2 hours'; UPDATE swiss_bitcoin_payment_attempts SET created_at = now() - interval '2 hours'");
    expect(await archiveIdle()).toEqual({ count: 0 });
    await expect(db.exec("SELECT rpc_archive_incomplete_order('ORDER-1')")).rejects.toThrow("order_transition_bitcoin_open");
    await attach(attemptId);
    await observe(attemptId, "paid", invoice, 999);
    expect(await requestArchive()).toEqual({ result: { action: "blocked" } });
    expect(await archiveIdle()).toEqual({ count: 0 });
    expect(await order()).toMatchObject({ payment_review_required: true, archived_at: null });
  });

  it("uses the existing archive only after Viva cancellation and records a late Viva capture under review", async () => {
    const { attempt_id: attemptId } = await begin();
    await attach(attemptId);
    await observe(attemptId, "expired");
    expect(await card()).toEqual({ claimed: true });
    expect(await requestArchive()).toEqual({ result: { action: "blocked" } });
    await expect(db.exec("SELECT rpc_archive_incomplete_order('ORDER-1')")).rejects.toThrow("order_transition_bitcoin_open");
    await db.exec("SELECT rpc_attach_swiss_bitcoin_card_fallback('ORDER-1','123456')");
    expect(await requestArchive()).toEqual({ result: { action: "blocked" } });
    await db.exec("SELECT rpc_archive_incomplete_order('ORDER-1')");
    await db.query("SELECT rpc_finalize_viva_payment('123456',$1,1000,'978')", [secondInvoice]);
    expect(await order()).toMatchObject({
      status: "cancelled", payment_state: "paid", payment_review_required: true, viva_transaction_id: secondInvoice,
    });
    expect(await stock()).toEqual({ stock_quantity: 5 });
    expect(await attempts()).toMatchObject([{ id: attemptId, state: "expired" }]);
  });

  it("gives Data API clients no access and limits service_role to reads and named operations", async () => {
    const result = await db.query(`
      SELECT has_table_privilege('anon', 'swiss_bitcoin_payment_attempts', 'SELECT') AS public_read,
        has_table_privilege('service_role', 'swiss_bitcoin_payment_attempts', 'SELECT') AS service_read,
        has_table_privilege('service_role', 'swiss_bitcoin_payment_attempts', 'UPDATE') AS service_write,
        has_function_privilege('authenticated', 'rpc_begin_swiss_bitcoin_payment(text,boolean)', 'EXECUTE') AS customer_begin,
        has_function_privilege('authenticated', 'rpc_request_swiss_bitcoin_archive(text)', 'EXECUTE') AS customer_archive,
        has_function_privilege('service_role', 'rpc_request_swiss_bitcoin_archive(text)', 'EXECUTE') AS service_archive
    `);
    expect(result.rows[0]).toEqual({
      public_read: false, service_read: true, service_write: false, customer_begin: false, customer_archive: false, service_archive: true,
    });
  });
});
