import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
const id = "11111111-1111-4111-8111-111111111111", tx = "22222222-2222-4222-8222-222222222222", refund = "33333333-3333-4333-8333-333333333333";
const code = "987654321012345678", token = "a".repeat(64);
async function begin(overrides: unknown[] = []) {
  const values = [id, token, "Breton", 1000, true, true, "4321"];
  overrides.forEach((value, index) => { if (value !== undefined) values[index] = value as never; });
  return (await db.query<{ value: { created: boolean } }>("SELECT public.rpc_begin_support_checkout($1,$2,$3,$4,$5,$6,$7) value", values)).rows[0].value;
}
async function bind() { await db.query("SELECT public.rpc_support_checkout_state($1,'ready',$2)", [id, code]); }
async function apply(amount = 1000, status = "F", transaction = tx, parent: string | null = null, source = "4321", currency = "EUR") {
  await db.query("SELECT public.rpc_support_apply_transaction($1,$2,$3,$4,$5,$6,$7,$8)", [id, code, transaction, source, amount, currency, status, parent]);
}
async function summary(offset = 0) {
  return (await db.query<{ value: { collectedCents: number; contributionCount: number; needsReconciliation: boolean; contributions: { pseudonym: string; amountCents: number | null; id: string }[]; nextOffset: number | null } }>("SELECT public.rpc_support_public_summary($1) value", [offset])).rows[0].value;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;");
  await db.exec(readFileSync("supabase/migrations/20261111000300_producer_support_campaign.sql", "utf8"));
}, 30_000);
beforeEach(async () => {
  await db.exec("RESET ROLE; TRUNCATE public.support_reversals, public.support_contributions, public.support_admin_audit; UPDATE public.support_campaigns SET active=true,goal_cents=NULL;");
});
afterAll(async () => { await db?.close(); });

describe("support ledger against full migration", () => {
  it("starts empty without inventing an objective or history", async () => {
    expect(await summary()).toMatchObject({ collectedCents: 0, contributionCount: 0, needsReconciliation: false, contributions: [], nextOffset: null });
  });
  it("creates one attempt across concurrent duplicate submissions and binds only one order", async () => {
    expect((await Promise.all([begin(), begin()])).map(value => value.created).sort()).toEqual([false, true]);
    await bind(); await bind();
    await expect(db.query("SELECT public.rpc_support_checkout_state($1,'ready','9999')", [id])).rejects.toThrow("support_conflict");
    expect((await summary()).collectedCents).toBe(0);
  });
  it("rejects replay with different owner, amount, pseudonym or privacy choices", async () => {
    await begin();
    for (const change of [[undefined, "b".repeat(64)], [undefined, undefined, "Autre"], [undefined, undefined, undefined, 2000], [undefined, undefined, undefined, undefined, false]]) {
      await expect(begin(change)).rejects.toThrow("support_conflict");
    }
  });
  it("validates nulls, integer bounds and campaign closure inside SQL", async () => {
    for (const change of [[null], [undefined, null], [undefined, undefined, "<script>"], [undefined, undefined, undefined, null], [undefined, undefined, undefined, 99], [undefined, undefined, undefined, undefined, null]]) {
      await expect(begin(change)).rejects.toThrow("support_invalid");
    }
    await db.exec("UPDATE public.support_campaigns SET active=false");
    await expect(begin()).rejects.toThrow("support_closed");
  });
  it("rejects mismatched money/source/currency and preserves the pending balance", async () => {
    await begin(); await bind();
    const cases: [number, string, string, string | null, string, string][] = [[999, "F", tx, null, "4321", "EUR"], [1000, "F", tx, null, "shop", "EUR"], [1000, "F", tx, null, "4321", "USD"]];
    for (const values of cases) {
      await expect(apply(...values)).rejects.toThrow("support_payment_mismatch");
    }
    expect((await summary()).collectedCents).toBe(0);
  });
  it("counts a confirmed payment once despite retries and delayed failures", async () => {
    await begin(); await bind(); await apply(); await apply(); await apply(1000, "E", refund);
    expect(await summary()).toMatchObject({ collectedCents: 1000, contributionCount: 1, contributions: [{ pseudonym: "Breton", amountCents: 1000 }] });
    await expect(apply(1000, "F", refund)).rejects.toThrow("support_payment_mismatch");
  });
  it("deducts partial refunds once and never restores them on a replayed capture", async () => {
    await begin(); await bind(); await apply(); await apply(-300, "F", refund, tx); await apply(-300, "F", refund, tx); await apply();
    expect(await summary()).toMatchObject({ collectedCents: 700, contributionCount: 1, contributions: [{ amountCents: 700 }] });
    await expect(apply(-400, "F", refund, tx)).rejects.toThrow("support_payment_mismatch");
    await expect(apply(-900, "F", "44444444-4444-4444-8444-444444444444", tx)).rejects.toThrow("support_refund_exceeds_payment");
    expect((await summary()).collectedCents).toBe(700);
  });
  it("accepts a verified reversal before capture while keeping it unpublished", async () => {
    await begin(); await bind(); await apply(-300, "F", refund, tx);
    expect((await summary()).collectedCents).toBe(0);
    await apply(); expect((await summary()).collectedCents).toBe(700);
  });
  it("removes a fully refunded contribution without deleting the payment history", async () => {
    await begin(); await bind(); await apply(); await apply(-1000, "F", refund, tx); await apply();
    expect(await summary()).toMatchObject({ collectedCents: 0, contributionCount: 0, contributions: [] });
    expect((await db.query("SELECT * FROM public.support_contributions")).rows).toHaveLength(1);
    expect((await db.query("SELECT * FROM public.support_reversals")).rows).toHaveLength(1);
  });
  it("flags an unresolved refund or dispute so the UI cannot present an exact total", async () => {
    await begin(); await bind(); await apply(1000, "R");
    expect((await summary()).needsReconciliation).toBe(true);
    expect((await summary()).contributions).toEqual([]);
    await apply(); expect((await summary()).needsReconciliation).toBe(true);
    await apply(-1000, "F", refund, tx); expect((await summary()).needsReconciliation).toBe(false);
  });
  it("flags capture after provider cancellation and disallows cancellation of a captured support", async () => {
    await begin(); await bind(); await db.query("SELECT public.rpc_support_checkout_state($1,'cancelled',$2)", [id, code]);
    await apply(); expect((await summary()).needsReconciliation).toBe(true);
    await expect(db.query("SELECT public.rpc_support_checkout_state($1,'cancelled',$2)", [id, code])).rejects.toThrow("support_already_paid");
  });
  it("publishes only the chosen fields, keeping anonymous contributions in the total", async () => {
    await begin([undefined, undefined, "Privé", undefined, false, false]); await bind(); await apply();
    const publicData = await summary();
    expect(publicData).toMatchObject({ collectedCents: 1000, contributions: [{ pseudonym: "Anonyme", amountCents: null }] });
    expect(JSON.stringify(publicData)).not.toContain(token); expect(JSON.stringify(publicData)).not.toContain(code); expect(JSON.stringify(publicData)).not.toContain("Privé");
  });
  it("records fees and moderation in an audit log without changing the collection", async () => {
    await begin(); await bind(); await apply();
    await db.query("SELECT public.rpc_support_admin('fees',$1,$2,'admin')", [id, { feesCents: 31, reference: "VIVA-2026-11" }]);
    await db.query("SELECT public.rpc_support_admin('visibility',$1,$2,'admin')", [id, { hidden: true }]);
    expect(await summary()).toMatchObject({ collectedCents: 1000, contributions: [{ pseudonym: "Anonyme", amountCents: null }] });
    expect((await db.query("SELECT * FROM public.support_admin_audit")).rows).toHaveLength(2);
    await expect(db.query("SELECT public.rpc_support_admin('fees',$1,$2,'admin')", [id, { feesCents: null, reference: "" }])).rejects.toThrow("support_invalid");
  });
  it("keeps private tables read-only for service and inaccessible to browser roles", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      for (const table of ["support_campaigns", "support_contributions", "support_reversals", "support_admin_audit"]) {
        const rights = (await db.query<{ can_read: boolean; can_write: boolean }>("SELECT has_table_privilege($1,$2,'SELECT') can_read,has_table_privilege($1,$2,'INSERT,UPDATE,DELETE') can_write", [role, `public.${table}`])).rows[0];
        expect(rights.can_write).toBe(false); expect(rights.can_read).toBe(role === "service_role" && table !== "support_admin_audit");
      }
      expect((await db.query<{ allowed: boolean }>("SELECT has_function_privilege($1,'public.rpc_support_apply_transaction(uuid,text,uuid,text,integer,text,text,uuid)','EXECUTE') allowed", [role])).rows[0].allowed).toBe(role === "service_role");
    }
    await db.exec("SET ROLE service_role"); await begin(); await bind(); await apply();
    await expect(db.query("DELETE FROM public.support_contributions")).rejects.toThrow();
  });
});
