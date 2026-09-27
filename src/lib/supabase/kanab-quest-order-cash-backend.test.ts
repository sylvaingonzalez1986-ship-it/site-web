import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));
import { getKqOrderCashRewards, syncKqOrderCashRewards } from "./kanab-quest-order-cash-backend";
const user = "11111111-1111-4111-8111-111111111111";
const receipt = { orderId: "order-1", productsAmountCents: 5000, cashCents: 50_000,
  grantedAt: "2026-09-27T12:00:00Z", ruleVersion: "order-cash-v1" };
const rewards = { available: true, gameEurosPerEuro: 10, startsAt: "2026-09-27T00:00:00Z", receipts: [receipt] };

describe("order game cash backend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.mockReturnValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: rewards, error: null });
  });
  it("reads only the session customer's frozen receipts", async () => {
    await expect(getKqOrderCashRewards(user)).resolves.toEqual(rewards);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_get_order_cash_rewards", { p_user_id: user });
  });
  it("syncs using only a customer ID, with no caller supplied amounts", async () => {
    await expect(syncKqOrderCashRewards(user)).resolves.toEqual(rewards);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_sync_order_cash_rewards", { p_user_id: user });
  });
  it("allows only configuration in the guest preview", async () => {
    await expect(getKqOrderCashRewards()).rejects.toThrow("indisponible");
    mocks.rpc.mockResolvedValue({ data: { ...rewards, receipts: [] }, error: null });
    await expect(getKqOrderCashRewards()).resolves.toMatchObject({ available: true, receipts: [] });
    expect(mocks.rpc).toHaveBeenLastCalledWith("rpc_kq_get_order_cash_rewards", { p_user_id: null });
  });
  it.each(["PGRST202", "42883"])("disables the preview before migration (%s)", code => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "missing" } });
    return expect(getKqOrderCashRewards()).resolves.toEqual({ available: false, gameEurosPerEuro: 0, startsAt: null, receipts: [] });
  });
  it("does not hide a permission error as an undeployed feature", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "private" } });
    await expect(getKqOrderCashRewards()).rejects.toThrow("Bonus de commande indisponible.");
  });
  it.each([null, {}, { ...rewards, gameEurosPerEuro: -1 }, { ...rewards, startsAt: null },
    { ...rewards, receipts: [receipt, receipt] },
    ...[NaN, -1, 0.5, 2_147_483_648].map(cashCents => ({ ...rewards, receipts: [{ ...receipt, cashCents }] })),
  ])("rejects malformed authoritative data %#", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(getKqOrderCashRewards(user)).rejects.toThrow("indisponible");
  });
  it("preserves frozen zero receipts and historical rates", async () => {
    const data = { ...rewards, receipts: [{ ...receipt, productsAmountCents: 0, cashCents: 0 },
      { ...receipt, orderId: "previous-rate", cashCents: 25_000, ruleVersion: "previous-rule" }] };
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(getKqOrderCashRewards(user)).resolves.toEqual(data);
  });
  it("rejects invalid customer IDs before database access", async () => {
    await expect(syncKqOrderCashRewards("forged-id")).rejects.toThrow("indisponible");
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
