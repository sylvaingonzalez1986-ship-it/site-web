import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), market: vi.fn(), energy: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("./kanab-quest-market-backend", () => ({ getKqMarketSnapshot: mocks.market }));
vi.mock("./kanab-quest-energy-backend", () => ({ getKqEnergySummary: mocks.energy }));
import { getKqCommerceSnapshot, handleKqCommerceAction } from "./kanab-quest-commerce-backend";
import { createKqBusinessPreview } from "../kanab-quest-business";
const user = "11111111-1111-4111-8111-111111111111", flower = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: { rawFlowerIds: [flower], cashCents: 8500, stocks: [], business: createKqBusinessPreview(Date.parse("2026-09-21T12:00:00Z")) }, error: null });
  mocks.market.mockResolvedValue({ lots: [{ flowerId: flower, status: "ready" }] });
  mocks.energy.mockResolvedValue({ outstandingCents: 200 });
});
describe("commerce cost boundaries", () => {
  it("opens the account once and only previews raw lots when browsing", async () => {
    const result = await getKqCommerceSnapshot(user);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.market).toHaveBeenCalledWith(user, [flower], { previewOnly: true });
    expect(result.cashCents).toBe(8500);
    expect(result.rawLots).toHaveLength(1);
  });
  it("does not load raw lots for the computer shop", async () => {
    await getKqCommerceSnapshot(user, true);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.market).not.toHaveBeenCalled();
  });
  it("still authors a fresh stored quote before a prepare command", async () => {
    await handleKqCommerceAction(user, { action: "prepare", flowerId: flower, route: "raw", expectedCostCents: 0, requestKey: user });
    expect(mocks.market).toHaveBeenCalledWith(user, [flower]);
    expect(mocks.market.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_commerce_command", expect.objectContaining({ p_user_id: user, p_action: "prepare" }));
  });
});
