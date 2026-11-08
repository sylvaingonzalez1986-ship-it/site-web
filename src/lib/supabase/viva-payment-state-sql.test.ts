import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
const orderCode = "6810910170372602";
const failedTransaction = "b1a3067c-321b-4ec6-bc9d-1778aef2a19d";
const successfulTransaction = "11111111-1111-4111-8111-111111111111";

function definition(file: string, name: string) {
  const sql = readFileSync(`supabase/migrations/${file}.sql`, "utf8");
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) throw new Error(`Missing production function ${name}`);
  return sql.slice(start, sql.indexOf("$$;", sql.indexOf("AS $$", start)) + 3);
}

async function failed(code: string | null = orderCode, transaction: string | null = failedTransaction, state: string | null = "failed") {
  return (await db.query<{ result: boolean }>(
    "SELECT public.rpc_update_viva_payment($1,$2::public.payment_state,$3) AS result", [code, state, transaction],
  )).rows[0].result;
}
async function paid(amount = 2110) {
  return (await db.query<{ result: Record<string, unknown> }>(
    "SELECT public.rpc_finalize_viva_payment($1,$2,$3,'978') AS result", [orderCode, successfulTransaction, amount],
  )).rows[0].result;
}
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const table of ["orders", "checkout_attempts", "lottery_reward_claims", "lottery_audit_log", "invoices", "loyalty_receipts", "inventory_receipts"]) {
    result[table] = (await db.query(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY to_jsonb(t)::TEXT`)).rows;
  }
  return result;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TYPE public.payment_state AS ENUM ('pending','paid','failed','not_configured');
    CREATE TYPE public.order_status AS ENUM ('new','pending_payment','paid','processing','shipped','cancelled');
    CREATE TABLE public.orders(
      id TEXT PRIMARY KEY, viva_order_code TEXT UNIQUE, viva_transaction_id TEXT,
      payment_state public.payment_state NOT NULL, status public.order_status NOT NULL,
      archived_at TIMESTAMPTZ, total_amount NUMERIC NOT NULL,
      payment_review_required BOOLEAN NOT NULL DEFAULT FALSE, payment_review_reason TEXT,
      tracking_number TEXT, loyalty_bonus_applied BOOLEAN DEFAULT TRUE
    );
    CREATE TABLE public.checkout_attempts(order_id TEXT PRIMARY KEY,state TEXT,updated_at TIMESTAMPTZ);
    CREATE TABLE public.lottery_reward_claims(
      id TEXT PRIMARY KEY,status TEXT,reserved_order_id TEXT,reserved_at TIMESTAMPTZ,
      reserved_until TIMESTAMPTZ,used_at TIMESTAMPTZ,used_order_id TEXT
    );
    CREATE TABLE public.lottery_audit_log(event_type TEXT,order_id TEXT,details JSONB);
    CREATE TABLE public.invoices(order_id TEXT PRIMARY KEY,receipt TEXT);
    CREATE TABLE public.loyalty_receipts(order_id TEXT PRIMARY KEY,points INTEGER);
    CREATE TABLE public.inventory_receipts(order_id TEXT PRIMARY KEY);
    CREATE FUNCTION public.rpc_apply_order_inventory(TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
      BEGIN
        IF current_setting('test.fail_inventory',true) = 'on' THEN
          RAISE EXCEPTION 'test_inventory_unavailable';
        END IF;
        INSERT INTO public.inventory_receipts VALUES($1) ON CONFLICT DO NOTHING;
      END
    $$;
    CREATE FUNCTION public.test_fail_release() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF current_setting('test.fail_release',true) = 'on' THEN
          RAISE EXCEPTION 'test_claim_release_failed';
        END IF;
        RETURN NEW;
      END
    $$;
    CREATE TRIGGER test_release_failure BEFORE UPDATE ON public.lottery_reward_claims
      FOR EACH ROW EXECUTE FUNCTION public.test_fail_release();
  `);
  await db.exec(definition("20260228000800_lottery_dynamic_rewards", "rpc_release_lottery_reward_claims_for_order"));
  for (const name of ["rpc_update_payment", "rpc_finalize_viva_payment"]) {
    await db.exec(definition("20260811000100_checkout_payment_security_hardening", name));
  }
  await db.exec(`
    REVOKE ALL ON FUNCTION public.rpc_update_payment(TEXT,public.payment_state,TEXT) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.rpc_update_payment(TEXT,public.payment_state,TEXT) TO service_role;
    REVOKE ALL ON FUNCTION public.rpc_finalize_viva_payment(TEXT,TEXT,BIGINT,TEXT) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.rpc_finalize_viva_payment(TEXT,TEXT,BIGINT,TEXT) TO service_role;
  `);
  await db.exec(readFileSync("supabase/migrations/20261108000800_viva_payment_monotonicity.sql", "utf8"));
}, 30_000);

beforeEach(async () => {
  await db.exec(`
    RESET ROLE;
    SELECT set_config('test.fail_release','off',false);
    SELECT set_config('test.fail_inventory','off',false);
    TRUNCATE public.orders, public.checkout_attempts, public.lottery_reward_claims,
      public.lottery_audit_log, public.invoices, public.loyalty_receipts, public.inventory_receipts;
    INSERT INTO public.orders(id,viva_order_code,payment_state,status,total_amount,tracking_number)
      VALUES('ORD-TEST','${orderCode}','pending','pending_payment',21.1,'tracking-preserved');
    INSERT INTO public.checkout_attempts VALUES('ORD-TEST','pending','2026-11-08T12:00:00Z');
    INSERT INTO public.lottery_reward_claims VALUES
      ('reserved','reserved','ORD-TEST','2026-11-08T12:00:00Z','2026-11-09T12:00:00Z',NULL,NULL),
      ('used','used',NULL,NULL,NULL,'2026-11-08T12:00:00Z','ORD-TEST'),
      ('other','reserved','ORD-OTHER','2026-11-08T12:00:00Z','2026-11-09T12:00:00Z',NULL,NULL);
    INSERT INTO public.invoices VALUES('ORD-TEST','receipt-preserved');
    INSERT INTO public.loyalty_receipts VALUES('ORD-TEST',42);
  `);
});
afterAll(async () => { await db?.close(); });

describe("Viva payment monotonicity in isolated PostgreSQL", () => {
  it.each(["paid", "processing", "shipped", "cancelled"])("preserves a paid order and all claims with fulfilment status %s", async (status) => {
    await paid();
    await db.query("UPDATE public.orders SET status=$1::public.order_status,payment_review_required=true,payment_review_reason='review-preserved'", [status]);
    const before = await snapshot();

    expect(await failed()).toBe(true);
    expect(await failed()).toBe(true);
    expect(await snapshot()).toEqual(before);
  });

  it("records an unpaid failure and releases only its unused reservations exactly once", async () => {
    expect(await failed()).toBe(true);
    expect((await db.query("SELECT payment_state,status,viva_transaction_id FROM public.orders")).rows[0]).toEqual({
      payment_state: "failed", status: "pending_payment", viva_transaction_id: failedTransaction,
    });
    expect((await db.query("SELECT id,status,reserved_order_id FROM public.lottery_reward_claims ORDER BY id")).rows).toEqual([
      { id: "other", status: "reserved", reserved_order_id: "ORD-OTHER" },
      { id: "reserved", status: "available", reserved_order_id: null },
      { id: "used", status: "used", reserved_order_id: null },
    ]);
    expect((await db.query("SELECT count(*)::INTEGER AS count FROM public.lottery_audit_log")).rows[0]).toEqual({ count: 1 });
    const firstFailure = await snapshot();
    expect(await failed()).toBe(true);
    expect(await snapshot()).toEqual(firstFailure);
  });

  it("allows a verified success after a failure and ignores a later failed attempt", async () => {
    expect(await failed()).toBe(true);
    expect(await paid()).toMatchObject({ updated: true, order_id: "ORD-TEST", review_required: true,
      review_reason: "reward_claim_released_before_payment" });
    expect((await db.query("SELECT payment_state,viva_transaction_id FROM public.orders")).rows[0]).toEqual({
      payment_state: "paid", viva_transaction_id: successfulTransaction,
    });
    const afterSuccess = await snapshot();
    expect(await failed()).toBe(true);
    expect(await snapshot()).toEqual(afterSuccess);
  });

  it.each(["available", "reserved", "used"])("keeps released claims %s without reclaiming them when payment later succeeds", async (claimState) => {
    await failed();
    if (claimState === "reserved") {
      await db.exec("UPDATE public.lottery_reward_claims SET status='reserved',reserved_order_id='ORD-OTHER' WHERE id='reserved'");
    } else if (claimState === "used") {
      await db.exec("UPDATE public.lottery_reward_claims SET status='used',used_order_id='ORD-OTHER',used_at='2026-11-08T14:00:00Z' WHERE id='reserved'");
    }
    const claimsBefore = (await snapshot()).lottery_reward_claims;

    expect(await paid()).toMatchObject({ review_required: true, review_reason: "reward_claim_released_before_payment" });
    expect((await snapshot()).lottery_reward_claims).toEqual(claimsBefore);
    const afterSuccess = await snapshot();
    expect(await paid()).toMatchObject({ updated: false, reason: "already_paid", review_required: true });
    expect(await snapshot()).toEqual(afterSuccess);
  });

  it("preserves existing and inventory review reasons alongside release evidence", async () => {
    await failed();
    await db.exec("UPDATE public.orders SET payment_review_required=true,payment_review_reason='prior-review'");
    await db.exec("SELECT set_config('test.fail_inventory','on',false)");

    const result = await paid();
    expect(result).toMatchObject({ review_required: true, order_id: "ORD-TEST" });
    expect(result.review_reason).toBe("prior-review; reward_claim_released_before_payment; test_inventory_unavailable");
    expect((await db.query("SELECT payment_state,payment_review_required,payment_review_reason FROM public.orders")).rows[0]).toEqual({
      payment_state: "paid", payment_review_required: true, payment_review_reason: result.review_reason,
    });
    const afterSuccess = await snapshot();
    expect(await paid()).toMatchObject({ updated: false, review_required: true, review_reason: result.review_reason });
    expect(await snapshot()).toEqual(afterSuccess);
  });

  it("does not request review for unrelated, empty or malformed release evidence", async () => {
    await db.exec(`INSERT INTO public.lottery_audit_log VALUES
      ('reward_claim_released','ORD-OTHER','{"claims_count":1}'),
      ('other_event','ORD-TEST','{"claims_count":1}'),
      ('reward_claim_released','ORD-TEST','{"claims_count":0}'),
      ('reward_claim_released','ORD-TEST','{"claims_count":"invalid"}'),
      ('reward_claim_released','ORD-TEST','{}')`);
    expect(await paid()).toMatchObject({ updated: true, review_required: false });
    expect(await paid()).toMatchObject({ updated: false, review_required: false });
  });

  it("does not mutate absent or archived orders or their claims", async () => {
    const beforeMissing = await snapshot();
    expect(await failed("999999")).toBe(false);
    expect(await snapshot()).toEqual(beforeMissing);
    await db.exec("UPDATE public.orders SET archived_at='2026-11-08T13:00:00Z'");
    const beforeArchived = await snapshot();
    expect(await failed()).toBe(false);
    expect(await snapshot()).toEqual(beforeArchived);
  });

  it.each(["", "bad-code", "1".repeat(33), null])("rejects invalid order code %s before mutation", async (code) => {
    const before = await snapshot();
    await expect(failed(code)).rejects.toThrow("viva_order_code_invalid");
    expect(await snapshot()).toEqual(before);
  });

  it.each(["", "not-a-transaction", null])("rejects invalid transaction %s before mutation", async (transaction) => {
    const before = await snapshot();
    await expect(failed(orderCode, transaction)).rejects.toThrow("viva_transaction_id_invalid");
    expect(await snapshot()).toEqual(before);
  });

  it.each(["pending", "paid", "not_configured", null])("rejects unsupported callback state %s without downgrading a paid order", async (state) => {
    await paid();
    const before = await snapshot();
    await expect(failed(orderCode, failedTransaction, state)).rejects.toThrow("viva_payment_state_invalid");
    expect(await snapshot()).toEqual(before);
  });

  it("rolls back payment and claim changes when reservation release fails", async () => {
    const before = await snapshot();
    await db.exec("SELECT set_config('test.fail_release','on',false)");
    await expect(failed()).rejects.toThrow("test_claim_release_failed");
    expect(await snapshot()).toEqual(before);
  });

  it("restricts the new RPC to service_role and retires the old API entry point", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      const permissions = (await db.query<{ current: boolean; obsolete: boolean }>(`
        SELECT has_function_privilege($1,'public.rpc_update_viva_payment(text,public.payment_state,text)','EXECUTE') AS current,
          has_function_privilege($1,'public.rpc_update_payment(text,public.payment_state,text)','EXECUTE') AS obsolete
      `, [role])).rows[0];
      expect(permissions).toEqual({ current: role === "service_role", obsolete: false });
    }
    await db.exec("SET ROLE service_role");
    await expect(db.query("SELECT public.rpc_update_payment($1,'failed',$2)", [orderCode, failedTransaction])).rejects.toThrow("permission denied");
    expect(await failed()).toBe(true);
    expect(await paid()).toMatchObject({ order_id: "ORD-TEST", updated: true });
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT payment_state FROM public.orders")).rows[0]).toEqual({ payment_state: "paid" });
  });

  it("keeps the verified success amount check and the existing explicit release operation", async () => {
    const before = await snapshot();
    await expect(paid(1)).rejects.toThrow("payment_amount_mismatch");
    expect(await snapshot()).toEqual(before);
    expect((await db.query<{ count: number }>("SELECT public.rpc_release_lottery_reward_claims_for_order('ORD-TEST') AS count")).rows[0].count).toBe(1);
  });
});
