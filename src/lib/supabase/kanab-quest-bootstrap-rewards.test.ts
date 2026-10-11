import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), cash: vi.fn(), bundle: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("./kanab-quest-order-cash-backend", () => ({ syncKqOrderCashRewards: mocks.cash }));
vi.mock("./contest-bundle-rewards-backend", () => ({ syncContestBundleRewards: mocks.bundle }));
import { reconcileKqBootstrapRewards } from "./kanab-quest-bootstrap-rewards";
const user = "11111111-1111-4111-8111-111111111111";
beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });
describe("bootstrap reward repair", () => {
  it("uses separate minimal RPC transactions instead of fetching reward histories", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });
    await reconcileKqBootstrapRewards(user);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "rpc_kq_sync_bootstrap_reward", { p_user_id: user, p_kind: "cash" });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "rpc_kq_sync_bootstrap_reward", { p_user_id: user, p_kind: "bundle" });
    expect(mocks.cash).not.toHaveBeenCalled(); expect(mocks.bundle).not.toHaveBeenCalled();
  });
  it("preserves repair before its migration is installed", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "PGRST202" } });
    await reconcileKqBootstrapRewards(user);
    expect(mocks.cash).toHaveBeenCalledWith(user); expect(mocks.bundle).toHaveBeenCalledWith(user);
  });
  it("reports a failed category without skipping the next repair or leaking database details", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.rpc.mockRejectedValueOnce(new Error("private")).mockResolvedValueOnce({ data: { ok: true }, error: null });
    await reconcileKqBootstrapRewards(user);
    expect(warn).toHaveBeenCalledExactlyOnceWith("Order cash reward synchronization temporarily unavailable.");
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "rpc_kq_sync_bootstrap_reward", { p_user_id: user, p_kind: "bundle" });
  });
  it("warns independently for returned database errors and failed repairs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.rpc.mockResolvedValueOnce({ error: { code: "XX000", message: "private" } })
      .mockResolvedValueOnce({ data: { ok: false }, error: null });
    await reconcileKqBootstrapRewards(user);
    expect(warn).toHaveBeenNthCalledWith(1, "Order cash reward synchronization temporarily unavailable.");
    expect(warn).toHaveBeenNthCalledWith(2, "Contest bundle reward synchronization temporarily unavailable.");
  });
  it("rejects a forged owner before making any RPC", async () => {
    mocks.rpc.mockClear();
    await expect(reconcileKqBootstrapRewards("forged")).rejects.toThrow("Compte");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
