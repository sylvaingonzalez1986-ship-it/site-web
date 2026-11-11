import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
const successId = "11111111-1111-4111-8111-111111111111";
const failureId = "22222222-2222-4222-8222-222222222222";
function definition(file: string, name: string) {
  const sql = readFileSync(`supabase/migrations/${file}.sql`, "utf8");
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  return sql.slice(start, sql.indexOf("$$;", start) + 3);
}
const admin = (patch: unknown) => db.query("SELECT rpc_admin_update_order('ORDER-1',$1::JSONB)", [JSON.stringify(patch)]);
const paid = async (amount: number | null = 1000, currency: string | null = "978", transaction = successId) =>
  (await db.query<{ result: Record<string, unknown> }>("SELECT rpc_finalize_viva_payment('123456',$1,$2,$3) AS result", [transaction, amount, currency])).rows[0].result;
const failed = () => db.query("SELECT rpc_update_viva_payment('123456','failed',$1)", [failureId]);
const archive = () => db.query("SELECT rpc_archive_incomplete_order('ORDER-1','admin_removed_incomplete')");
const row = async () => (await db.query<Record<string, unknown>>("SELECT * FROM orders WHERE id='ORDER-1'")).rows[0];
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const table of ["orders", "products", "checkout_attempts", "lottery_reward_claims", "lottery_audit_log", "reward_observations", "promo_codes"]) {
    result[table] = (await db.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::TEXT`)).rows;
  }
  return result;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TYPE payment_state AS ENUM ('pending','paid','failed','not_configured');
    CREATE TYPE order_status AS ENUM ('new','pending_payment','paid','processing','shipped','cancelled');
    CREATE TABLE orders(id TEXT PRIMARY KEY, payment_state payment_state NOT NULL, status order_status NOT NULL,
      viva_order_code TEXT UNIQUE, viva_transaction_id TEXT UNIQUE, total_amount NUMERIC NOT NULL,
      customer_id UUID, promo_code TEXT, archived_at TIMESTAMPTZ, archived_reason TEXT,
      payment_review_required BOOLEAN NOT NULL DEFAULT FALSE, payment_review_reason TEXT,
      stock_applied_at TIMESTAMPTZ, tracking_number TEXT);
    CREATE TABLE products(id TEXT PRIMARY KEY,track_stock BOOLEAN,stock_quantity INTEGER,variant_options JSONB);
    CREATE UNIQUE INDEX first_discount_once ON orders(customer_id) WHERE promo_code='AUTO-FILLEUL-10' AND archived_at IS NULL;
    CREATE TABLE order_items(id INTEGER,order_id TEXT,product_id TEXT,quantity INTEGER,unit_price NUMERIC);
    CREATE TABLE checkout_attempts(order_id TEXT PRIMARY KEY,state TEXT,updated_at TIMESTAMPTZ,last_error TEXT,attempt_id UUID,customer_id UUID);
    CREATE TABLE promo_codes(customer_id UUID,code TEXT,used BOOLEAN,used_at TIMESTAMPTZ);
    CREATE TABLE lottery_reward_claims(id TEXT PRIMARY KEY,user_id UUID,reward_line_id TEXT,status TEXT,
      reserved_order_id TEXT,reserved_at TIMESTAMPTZ,reserved_until TIMESTAMPTZ,used_at TIMESTAMPTZ,used_order_id TEXT);
    CREATE TABLE lottery_reward_lines(claim_id TEXT,status TEXT,claimed_at TIMESTAMPTZ);
    CREATE TABLE lottery_audit_log(event_type TEXT,order_id TEXT,details JSONB);
    -- Minimal deferred observer checks the transaction boundary used by real
    -- order reward triggers, without bootstrapping unrelated game schemas.
    CREATE TABLE reward_observations(order_id TEXT PRIMARY KEY);
    CREATE FUNCTION observe_final_payment() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
      INSERT INTO reward_observations SELECT id FROM orders WHERE id=NEW.id
        AND payment_state='paid' AND status<>'cancelled' AND archived_at IS NULL AND NOT payment_review_required
        ON CONFLICT DO NOTHING;
      RETURN NULL;
    END $$;
    CREATE CONSTRAINT TRIGGER observe_rewards AFTER UPDATE ON orders DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION observe_final_payment();
    CREATE FUNCTION fail_claim_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
      IF current_setting('test.fail_claims',true)='on' THEN RAISE EXCEPTION 'test_claim_failure'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER test_claim_failure BEFORE UPDATE ON lottery_reward_claims FOR EACH ROW EXECUTE FUNCTION fail_claim_change();
  `);
  for (const name of ["rpc_release_lottery_reward_claims_for_order", "rpc_consume_lottery_reward_claims_for_order"]) {
    await db.exec(definition("20260228000800_lottery_dynamic_rewards", name));
  }
  await db.exec(definition("20261108000800_viva_payment_monotonicity", "rpc_update_viva_payment"));
  await db.exec(readFileSync("supabase/migrations/20261110000300_security_payment_boundaries.sql", "utf8"));
}, 30_000);
beforeEach(async () => {
  await db.exec(`RESET ROLE; SELECT set_config('test.fail_claims','off',false);
    TRUNCATE orders,products,order_items,checkout_attempts,promo_codes,lottery_reward_claims,lottery_reward_lines,lottery_audit_log,reward_observations;
    INSERT INTO orders(id,payment_state,status,viva_order_code,total_amount,customer_id,promo_code)
      VALUES('ORDER-1','pending','pending_payment','123456',10,'33333333-3333-4333-8333-333333333333','PROMO');
    INSERT INTO products VALUES('product',TRUE,5,NULL);
    INSERT INTO order_items VALUES(1,'ORDER-1','product',2,5);
    INSERT INTO checkout_attempts VALUES('ORDER-1','ready','2026-11-10T12:00:00Z',NULL,
      '44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333');
    INSERT INTO promo_codes VALUES('33333333-3333-4333-8333-333333333333','PROMO',TRUE,now());
    INSERT INTO lottery_reward_claims(id,status,reserved_order_id) VALUES('claim','reserved','ORDER-1');`);
});
afterAll(async () => { await db?.close(); });

describe("Atomic payment security boundaries in isolated PostgreSQL", () => {
  it("commits manual payment, stock, claim consumption, tracking and final rewards together", async () => {
    await admin({ payment_state: "paid", status: "processing", tracking_number: " tracking " });
    expect(await row()).toMatchObject({ payment_state: "paid", status: "processing", tracking_number: "tracking", payment_review_required: false });
    expect((await db.query("SELECT stock_quantity FROM products")).rows[0]).toEqual({ stock_quantity: 3 });
    expect((await db.query("SELECT status,used_order_id FROM lottery_reward_claims")).rows[0]).toEqual({ status: "used", used_order_id: "ORDER-1" });
    expect((await db.query("SELECT * FROM reward_observations")).rows).toEqual([{ order_id: "ORDER-1" }]);
    await admin({ payment_state: "paid" });
    expect((await db.query("SELECT stock_quantity FROM products")).rows[0]).toEqual({ stock_quantity: 3 });
  });

  it("rolls back all manual changes and deferred rewards when stock validation fails", async () => {
    await db.exec("UPDATE products SET stock_quantity=1");
    const before = await snapshot();
    await expect(admin({ payment_state: "paid", status: "processing", tracking_number: "new" })).rejects.toThrow("inventory_insufficient_product");
    expect(await snapshot()).toEqual(before);
  });

  it("rolls back manual payment and stock if claim consumption fails", async () => {
    const before = await snapshot();
    await db.exec("SELECT set_config('test.fail_claims','on',false)");
    await expect(admin({ payment_state: "paid" })).rejects.toThrow("test_claim_failure");
    expect(await snapshot()).toEqual(before);
  });

  it.each(["paid", "processing", "shipped"])("rejects unpaid status %s without mutations", async (status) => {
    const before = await snapshot();
    await expect(admin({ status })).rejects.toThrow("order_transition_unpaid_fulfillment");
    expect(await snapshot()).toEqual(before);
  });

  it.each(["pending", "failed"])("rejects a stale admin downgrade to %s after webhook success", async (payment_state) => {
    await paid();
    const before = await snapshot();
    await expect(admin({ payment_state })).rejects.toThrow("order_transition_payment_regression");
    expect(await snapshot()).toEqual(before);
  });

  it("preserves a manually paid order when a delayed failed webhook arrives", async () => {
    await admin({ payment_state: "paid" });
    const before = await snapshot();
    await failed();
    expect(await snapshot()).toEqual(before);
  });

  it("attaches verified transaction evidence to a manually paid order without stock duplication", async () => {
    await admin({ payment_state: "paid" });
    expect(await paid()).toMatchObject({ updated: false, review_required: false });
    expect(await row()).toMatchObject({ viva_transaction_id: successId });
    expect((await db.query("SELECT stock_quantity FROM products")).rows[0]).toEqual({ stock_quantity: 3 });
    const before = await snapshot();
    await paid();
    expect(await snapshot()).toEqual(before);
  });

  it("keeps confirmed capture paid and suppresses deferred rewards if inventory fails", async () => {
    await db.exec("UPDATE products SET stock_quantity=1");
    expect(await paid()).toMatchObject({ updated: true, review_required: true });
    expect(await row()).toMatchObject({ payment_state: "paid", stock_applied_at: null, payment_review_required: true });
    expect((await db.query("SELECT * FROM reward_observations")).rows).toEqual([]);
    await expect(admin({ status: "processing" })).rejects.toThrow("order_transition_review_required");
  });

  it("closes archived attempts and reconciles a late capture visibly without stock or rewards", async () => {
    await archive();
    expect((await db.query("SELECT state FROM checkout_attempts")).rows[0]).toEqual({ state: "failed" });
    expect(await paid()).toMatchObject({ updated: true, review_required: true });
    expect(await row()).toMatchObject({ payment_state: "paid", status: "cancelled",
      archived_reason: "admin_removed_incomplete", stock_applied_at: null, viva_transaction_id: successId });
    expect((await row()).archived_at).not.toBeNull();
    expect((await row()).payment_review_reason).toContain("payment_after_cancellation");
    expect((await db.query("SELECT stock_quantity FROM products")).rows[0]).toEqual({ stock_quantity: 5 });
    expect((await db.query("SELECT status FROM lottery_reward_claims")).rows[0]).toEqual({ status: "available" });
    expect((await db.query("SELECT * FROM reward_observations")).rows).toEqual([]);
    const before = await snapshot();
    await paid(); await failed();
    expect(await snapshot()).toEqual(before);
  });

  it("rejects archival when payment wins the serialization order", async () => {
    await paid();
    const before = await snapshot();
    await expect(archive()).rejects.toThrow("completed_order_cannot_be_archived");
    expect(await snapshot()).toEqual(before);
  });

  it("records an archived capture after its first-order discount was reused without violating uniqueness", async () => {
    await db.exec("UPDATE orders SET promo_code='AUTO-FILLEUL-10'");
    await archive();
    await db.exec(`INSERT INTO orders(id,payment_state,status,viva_order_code,total_amount,customer_id,promo_code)
      VALUES('ORDER-2','pending','pending_payment','654321',10,'33333333-3333-4333-8333-333333333333','AUTO-FILLEUL-10');`);
    expect(await paid()).toMatchObject({ updated: true, review_required: true });
    expect((await row()).archived_at).not.toBeNull();
    expect((await db.query("SELECT payment_state FROM orders WHERE id='ORDER-2'")).rows[0]).toEqual({ payment_state: "pending" });
  });

  it("preserves a completed checkout attempt after a late initialization error", async () => {
    await paid();
    const before = await snapshot();
    await db.query("SELECT rpc_fail_checkout_attempt('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','late timeout')");
    expect(await snapshot()).toEqual(before);
  });

  it("does not let a manual failed-then-paid order reuse its released reward", async () => {
    await admin({ payment_state: "failed" });
    await admin({ payment_state: "paid" });
    expect(await row()).toMatchObject({ payment_state: "paid", payment_review_required: true });
    expect((await db.query("SELECT status FROM lottery_reward_claims")).rows[0]).toEqual({ status: "available" });
    expect((await db.query("SELECT * FROM reward_observations")).rows).toEqual([]);
  });

  it.each([{}, { payment_state: null }, { payment_state: "not_configured" }, { status: "invented" }, { tracking_number: 4 }, { payment_review_required: false }])("rejects invalid patch %j atomically", async (patch) => {
    const before = await snapshot();
    await expect(admin(patch)).rejects.toThrow("order_transition_invalid_patch");
    expect(await snapshot()).toEqual(before);
  });

  it.each([[null, "978"], [1, "978"], [1000, null], [1000, "840"]] as const)("rejects invalid verified amount/currency %s/%s even after archival", async (amount, currency) => {
    await archive();
    const before = await snapshot();
    await expect(paid(amount, currency)).rejects.toThrow(/payment_(amount|currency)_mismatch/);
    expect(await snapshot()).toEqual(before);
  });

  it("decrements an explicit variant exactly once and rejects a different nonexistent variant", async () => {
    await db.exec(`UPDATE products SET track_stock=FALSE,variant_options='[{"id":"large","stockQuantity":5,"enabled":true,"inStock":true}]';
      UPDATE order_items SET product_id='product::large';`);
    await admin({ payment_state: "paid" });
    await paid();
    expect((await db.query("SELECT variant_options->0->>'stockQuantity' AS remaining FROM products")).rows[0]).toEqual({ remaining: "3" });
    await db.exec("UPDATE orders SET stock_applied_at=NULL; UPDATE order_items SET product_id='product::missing'");
    await expect(db.query("SELECT rpc_apply_order_inventory('ORDER-1')")).rejects.toThrow("inventory_variant_invalid");
  });

  it("limits every exposed payment operation to the service role", async () => {
    for (const fn of ["rpc_admin_update_order(text,jsonb)", "rpc_archive_incomplete_order(text,text)", "rpc_finalize_viva_payment(text,text,bigint,text)", "rpc_apply_order_inventory(text)", "rpc_fail_checkout_attempt(uuid,uuid,text)"]) {
      for (const role of ["anon", "authenticated", "service_role"]) {
        expect((await db.query<{ allowed: boolean }>("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed", [role, fn])).rows[0].allowed).toBe(role === "service_role");
      }
    }
    await db.exec("SET ROLE service_role");
    await admin({ payment_state: "paid" });
  });
});
