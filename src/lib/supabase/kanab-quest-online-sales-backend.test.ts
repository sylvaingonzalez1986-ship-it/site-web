import { beforeEach, describe, expect, it, vi } from "vitest";
import { isKqOnlineSalesPage } from "../kanab-quest-online-sales";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
import { getKqOnlineSalesHistory, KqOnlineSalesQueryError, parseKqOnlineSalesQuery } from "./kanab-quest-online-sales-backend";

const owner = "11111111-1111-4111-8111-111111111111";
const receiptId = "22222222-2222-4222-8222-222222222222";
const soldAt = "2026-10-28T10:00:00.123456+00:00";
const query = { limit: 50, cursor: null };
const token = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const cursor = { soldAt, source: "flower", id: receiptId };
const flower = () => ({ ...cursor, name: "Rosin de Bretagne", code: null, route: "rosin-selection", quantity: 1, formatGrams: 5,
  revenueCents: 4000, netPayoutCents: 0, feesCents: 100, costCents: null, satisfaction: 82.456789 });
const merch = () => ({ id: receiptId, source: "merch", soldAt, name: null, code: "tshirt", route: null,
  quantity: 1, formatGrams: null, revenueCents: 2800, netPayoutCents: 2100, feesCents: 70, costCents: 1100, satisfaction: null });
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: { version: 1, sales: [flower(), merch()], nextCursor: null }, error: null }); });

describe("online sales history query", () => {
  it("defaults to a bounded page and ignores supplied ownership", () => {
    expect(parseKqOnlineSalesQuery(new URLSearchParams("userId=victim"))).toEqual(query);
    expect(parseKqOnlineSalesQuery(new URLSearchParams("limit=100"))).toEqual({ limit: 100, cursor: null });
  });
  it("retains microsecond timestamps and the stream discriminator", () => {
    expect(parseKqOnlineSalesQuery(new URLSearchParams({ limit: "25", cursor: token({ version: 1, ...cursor }) })))
      .toEqual({ limit: 25, cursor });
  });
  it.each(["limit=0", "limit=101", "limit=1.5", "limit=-1", "limit=1e2", "cursor=", "cursor=not-json", "cursor=%25"])("rejects invalid query %s", input => {
    expect(() => parseKqOnlineSalesQuery(new URLSearchParams(input))).toThrow(KqOnlineSalesQueryError);
  });
  it.each([{}, { version: 2, ...cursor }, { version: 1, ...cursor, id: "unsafe" }, { version: 1, ...cursor, source: "other" },
    { version: 1, ...cursor, soldAt: "infinity" }, { version: 1, ...cursor, soldAt: "2026-02-30T00:00:00Z" }])("rejects malformed cursor contents", value => {
    expect(() => parseKqOnlineSalesQuery(new URLSearchParams({ cursor: token(value) }))).toThrow(KqOnlineSalesQueryError);
  });
});

describe("online sales history backend", () => {
  it("reads only the owner's receipt RPC and preserves recorded sale amounts", async () => {
    const page = await getKqOnlineSalesHistory(owner, query);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_online_sales_history", {
      p_user_id: owner, p_limit: 50, p_before_at: null, p_before_source: null, p_before_id: null,
    });
    expect(page.nextCursor).toBeNull();
    expect(page.receipts).toMatchObject([
      { id: `flower:${receiptId}`, kind: "flower", name: "Rosin de Bretagne", quantity: 1, formatGrams: 5, route: "rosin-selection", revenueCents: 4000, netPayoutCents: 0, costCents: null },
      { id: `merch:${receiptId}`, kind: "merch", name: "T-shirt", revenueCents: 2800, netPayoutCents: 2100, costCents: 1100 },
    ]);
    expect(isKqOnlineSalesPage(page)).toBe(true);
  });
  it("round-trips the exact last-row cursor without losing timestamp precision", async () => {
    rpc.mockResolvedValueOnce({ data: { version: 1, sales: [flower()], nextCursor: cursor }, error: null });
    const page = await getKqOnlineSalesHistory(owner, { ...query, limit: 1 });
    const next = parseKqOnlineSalesQuery(new URLSearchParams({ limit: "1", cursor: page.nextCursor! }));
    expect(next).toEqual({ limit: 1, cursor });
    rpc.mockResolvedValueOnce({ data: { version: 1, sales: [], nextCursor: null }, error: null });
    await getKqOnlineSalesHistory(owner, next);
    expect(rpc).toHaveBeenLastCalledWith("rpc_kq_online_sales_history", {
      p_user_id: owner, p_limit: 1, p_before_at: soldAt, p_before_source: "flower", p_before_id: receiptId,
    });
  });
  it("does not query invalid ownership or an unbounded page", async () => {
    await expect(getKqOnlineSalesHistory("invalid", query)).rejects.toThrow(KqOnlineSalesQueryError);
    await expect(getKqOnlineSalesHistory(owner, { ...query, limit: 101 })).rejects.toThrow(KqOnlineSalesQueryError);
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    null, {}, { version: 1, sales: [], nextCursor: cursor },
    { version: 1, sales: [flower(), flower()], nextCursor: null },
    { version: 1, sales: [{ ...flower(), netPayoutCents: undefined }], nextCursor: null },
    { version: 1, sales: [{ ...merch(), code: "missing" }], nextCursor: null },
    { version: 1, sales: [{ ...flower(), revenueCents: Number.MAX_SAFE_INTEGER + 1 }], nextCursor: null },
  ])("fails closed on incomplete or malformed history", async data => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(getKqOnlineSalesHistory(owner, query)).rejects.toThrow("[supabase:online-sales]");
  });
  it("never presents an unavailable migration as an empty history", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function not found" } });
    await expect(getKqOnlineSalesHistory(owner, query)).rejects.toThrow("[supabase:online-sales]");
  });
  it("rejects overfull responses and cursors belonging to another last row", async () => {
    await expect(getKqOnlineSalesHistory(owner, { limit: 1, cursor: null })).rejects.toThrow("[supabase:online-sales]");
    rpc.mockResolvedValue({ data: { version: 1, sales: [flower()], nextCursor: { ...cursor, source: "merch" } }, error: null });
    await expect(getKqOnlineSalesHistory(owner, { limit: 1, cursor: null })).rejects.toThrow("[supabase:online-sales]");
  });
});

describe("client sales page boundary", () => {
  it("accepts explicit unknown values in local historical receipts without inventing zeroes", async () => {
    const page = await getKqOnlineSalesHistory(owner, query);
    page.receipts[0].netPayoutCents = null;
    expect(isKqOnlineSalesPage(page)).toBe(true);
    expect(isKqOnlineSalesPage({ ...page, receipts: [{ ...page.receipts[0], netPayoutCents: undefined }] })).toBe(false);
    expect(isKqOnlineSalesPage({ ...page, receipts: [page.receipts[0], page.receipts[0]] })).toBe(false);
    expect(isKqOnlineSalesPage({ ...page, nextCursor: "" })).toBe(false);
  });
});
