import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ from: mocks.from }) }));

import { getProducerSettlementSources, recordProducerPayment, saveProducerRate, voidProducerPayment } from "./producer-settlements-backend";

type Result = { data: unknown; error: { code: string; message: string } | null };
const ok = (data: unknown): Result => ({ data, error: null });
const duplicate: Result = { data: null, error: { code: "23505", message: "duplicate" } };
const input = { id: "11111111-1111-4111-8111-111111111111", producerId: "producer-1", producerName: "Ferme 1",
  salesMonth: "2026-09", amountCents: 12500, paidOn: "2026-10-03", reference: "VIR-1", note: "Septembre" };
const stored = { id: input.id, producer_id: input.producerId, producer_name: input.producerName,
  sales_from_month: "2026-09-01", sales_month: "2026-09-01", amount_cents: input.amountCents, paid_on: input.paidOn, reference: input.reference,
  note: input.note, created_at: "2026-10-03T10:00:00.000Z", voided_at: null, void_reason: null };

function query(result: Result) {
  const promise = Promise.resolve(result);
  const chain = { select: vi.fn(), insert: vi.fn(), update: vi.fn(), upsert: vi.fn(), eq: vi.fn(), is: vi.fn(),
    in: vi.fn(), neq: vi.fn(), order: vi.fn(), range: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(), then: promise.then.bind(promise) };
  for (const key of ["select", "insert", "update", "upsert", "eq", "is", "in", "neq", "order", "range", "limit", "maybeSingle"] as const) {
    chain[key].mockReturnValue(chain);
  }
  return chain;
}

function database(responses: Record<string, Result[]>) {
  const calls: Array<{ table: string; chain: ReturnType<typeof query> }> = [];
  mocks.from.mockImplementation((table: string) => {
    const result = responses[table]?.shift();
    if (!result) throw new Error(`Unexpected query on ${table}`);
    const chain = query(result);
    calls.push({ table, chain });
    return chain;
  });
  return calls;
}

beforeEach(() => vi.clearAllMocks());

describe("producer settlements persistence", () => {
  it("accepts an identical retry without overwriting the existing payment", async () => {
    const calls = database({ producers: [ok({ id: "producer-1" })], producer_settlement_payments: [duplicate, ok(stored)] });
    await expect(recordProducerPayment(input)).resolves.toBeUndefined();
    const insert = calls[1].chain.insert;
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ amount_cents: 12500, sales_month: "2026-09-01" }));
    for (const { chain } of calls) { expect(chain.update).not.toHaveBeenCalled(); expect(chain.upsert).not.toHaveBeenCalled(); }
  });

  it.each([
    ["producer_id", "other"], ["producer_name", "Other name"], ["sales_from_month", "2026-08-01"], ["sales_month", "2026-08-01"],
    ["amount_cents", 12501], ["paid_on", "2026-10-02"], ["reference", "other"], ["note", "other"],
  ])("rejects a reused payment id with a different %s", async (key, value) => {
    database({ producers: [ok({ id: "producer-1" })], producer_settlement_payments: [duplicate, ok({ ...stored, [key]: value })] });
    await expect(recordProducerPayment(input)).rejects.toMatchObject({ status: 409 });
  });

  it("does not revive a voided payment on retry", async () => {
    database({ producers: [ok({ id: "producer-1" })], producer_settlement_payments: [duplicate, ok({ ...stored, voided_at: stored.created_at, void_reason: "Erreur" })] });
    await expect(recordProducerPayment(input)).rejects.toMatchObject({ status: 409 });
  });

  it("keeps a payment retry possible after catalog deletion", async () => {
    database({ producers: [ok(null)], order_items: [ok([])],
      producer_settlement_payments: [ok([{ id: input.id }]), duplicate, ok(stored)] });
    await expect(recordProducerPayment(input)).resolves.toBeUndefined();
  });

  it("rejects a forged producer before inserting a payment", async () => {
    const calls = database({ producers: [ok(null)], order_items: [ok([])], producer_settlement_payments: [ok([])] });
    await expect(recordProducerPayment(input)).rejects.toMatchObject({ status: 404 });
    for (const { chain } of calls) expect(chain.insert).not.toHaveBeenCalled();
  });

  it("keeps variant rates specific to an existing catalog or historical variant", async () => {
    const calls = database({ products: [ok({ id: "flower", producer_id: "producer-1", variant_options: [{ id: "5g" }] })],
      order_items: [ok([])] });
    await expect(saveProducerRate({ producerId: "producer-1", productId: "flower::forged", effectiveMonth: "2026-09",
      mode: "unit", rate: 3, gramsPerUnit: null })).rejects.toThrow("pas associé");
    for (const { chain } of calls) expect(chain.upsert).not.toHaveBeenCalled();
  });

  it("returns all payment pages and preserves unknown historical HT and weights", async () => {
    const payments = Array.from({ length: 1001 }, (_, index) => ({ ...stored, id: `payment-${index}` }));
    database({ orders: [ok([{ id: "order-1", created_at: stored.created_at, payment_state: "paid", status: "paid", archived_at: null }])],
      producers: [ok([])], producer_settlement_rates: [ok([])], producer_settlement_payments: [ok(payments.slice(0, 1000)), ok(payments.slice(1000))],
      order_items: [ok([{ id: 1, order_id: "order-1", product_id: "deleted", name: "Ancien produit", quantity: 1, line_total: 12,
        line_total_ht: null, vat_rate: 20, producer_unit_weight_grams: null, producer_attribution: "unknown" }])] });
    const sources = await getProducerSettlementSources();
    expect(sources.payments).toHaveLength(1001);
    expect(sources.sales[0]).toMatchObject({ attribution: "unknown", producerId: null, lineTotalHt: null, unitWeightGrams: null });
  });

  it("reports a missing migration explicitly", async () => {
    database({ orders: [ok([])], producers: [ok([])], producer_settlement_payments: [ok([])],
      producer_settlement_rates: [{ data: null, error: { code: "PGRST205", message: "missing table" } }] });
    await expect(getProducerSettlementSources()).rejects.toMatchObject({ status: 503 });
  });

  it("voids only the audit fields and safely accepts the same void retry", async () => {
    const calls = database({ producer_settlement_payments: [ok([]), ok({ voided_at: stored.created_at, void_reason: "Erreur" })] });
    await expect(voidProducerPayment(input.id, "Erreur")).resolves.toBeUndefined();
    expect(calls[0].chain.update).toHaveBeenCalledWith({ voided_at: expect.any(String), void_reason: "Erreur" });
    expect(calls[0].chain.is).toHaveBeenCalledWith("voided_at", null);
  });
});
