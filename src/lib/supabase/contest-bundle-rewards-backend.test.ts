import { beforeEach, describe, expect, it, vi } from "vitest";
import { getContestBundleRewards, syncContestBundleRewards } from "./contest-bundle-rewards-backend";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));
const user = "11111111-1111-4111-8111-111111111111";
const receipt = { orderId: "ORDER-1", grantedAt: "2026-10-02T12:00:00Z", card: { id: user, code: "EPIC-1", name: "Épique", imageUrl: "/card.webp", rarity: "epic" }, buddiesPacks: 3, bottePacks: 5, requiredProductIds: ["flower-1"] };
const progress = { flowers: [{ productId: "flower-1", purchasedGrams: 3, complete: true }], completedCount: 1, requiredCount: 1, eligible: true, rewarded: true, grantedAt: receipt.grantedAt };
const rewards = { available: true, startsAt: "2026-10-02T00:00:00Z", minGrams: 3, buddiesPacks: 3, bottePacks: 5, flowers: [{ productId: "flower-1", title: "Fleur 1", unitWeightGrams: 1 }], progress, receipts: [receipt] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: rewards, error: null });
});

describe("contest bundle reward backend", () => {
  it("uses the session identity and no client-supplied quantities or rewards", async () => {
    expect(await syncContestBundleRewards(user)).toEqual(rewards);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_sync_contest_bundle_rewards", { p_user_id: user });
  });
  it("reads the customer's persisted receipt", async () => {
    expect(await getContestBundleRewards(user)).toEqual(rewards);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_get_contest_bundle_rewards", { p_user_id: user });
  });
  it("never exposes a receipt through a guest preview", async () => {
    await expect(getContestBundleRewards()).rejects.toThrow("indisponible");
    mocks.rpc.mockResolvedValue({ data: { ...rewards, progress: null, receipts: [] }, error: null });
    expect((await getContestBundleRewards()).receipts).toEqual([]);
  });
  it("does not expose customer purchase quantities in an anonymous preview", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...rewards, receipts: [] }, error: null });
    await expect(getContestBundleRewards()).rejects.toThrow("indisponible");
  });
  it("returns an authenticated partial checklist without granting rewards during a read", async () => {
    const partial = { ...rewards, receipts: [], progress: { ...progress,
      flowers: [{ productId: "flower-1", purchasedGrams: 2.9, complete: false }], completedCount: 0,
      eligible: false, rewarded: false, grantedAt: null } };
    mocks.rpc.mockResolvedValue({ data: partial, error: null });
    expect(await getContestBundleRewards(user)).toEqual(partial);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_get_contest_bundle_rewards", { p_user_id: user });
  });
  it("allows a completed checklist awaiting attribution", async () => {
    const pending = { ...rewards, receipts: [], progress: { ...progress, rewarded: false, grantedAt: null } };
    mocks.rpc.mockResolvedValue({ data: pending, error: null });
    expect((await getContestBundleRewards(user)).progress).toMatchObject({ eligible: true, rewarded: false });
  });
  it("preserves a previously earned gift when the current catalogue is unavailable", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...rewards, available: false, flowers: [],
      progress: { ...progress, flowers: [], completedCount: 0, requiredCount: 0, eligible: false } }, error: null });
    const result = await getContestBundleRewards(user);
    expect(result.available).toBe(false);
    expect(result.receipts).toEqual([receipt]);
  });
  it.each(["PGRST202", "42883"])("hides the promotion before migration (%s)", async (code) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code } });
    expect(await getContestBundleRewards()).toMatchObject({ available: false, receipts: [], flowers: [] });
  });
  it("fails closed for missing permissions instead of promising a reward", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "secret details" } });
    await expect(getContestBundleRewards(user)).rejects.toThrow("Bonus fleurs concours indisponible.");
  });
  it.each([
    null, {}, { ...rewards, flowers: [] }, { ...rewards, minGrams: 4 }, { ...rewards, minGrams: 5 }, { ...rewards, buddiesPacks: 30 },
    { ...rewards, receipts: [receipt, receipt] }, { ...rewards, flowers: [rewards.flowers[0], rewards.flowers[0]] },
    { ...rewards, flowers: [{ ...rewards.flowers[0], unitWeightGrams: -1 }] },
    { ...rewards, receipts: [{ ...receipt, card: { ...receipt.card, rarity: "gold" } }] },
    { ...rewards, receipts: [{ ...receipt, requiredProductIds: [] }] },
    { ...rewards, progress: undefined }, { ...rewards, progress: null },
    { ...rewards, progress: { ...progress, flowers: [] } },
    { ...rewards, progress: { ...progress, completedCount: 0 } },
    { ...rewards, progress: { ...progress, requiredCount: 99 } },
    { ...rewards, progress: { ...progress, eligible: false } },
    { ...rewards, progress: { ...progress, rewarded: false, grantedAt: null } },
    { ...rewards, progress: { ...progress, grantedAt: null } },
    { ...rewards, progress: { ...progress, flowers: [{ productId: "other", purchasedGrams: 3, complete: true }] } },
    { ...rewards, progress: { ...progress, flowers: [{ productId: "flower-1", purchasedGrams: Infinity, complete: true }] } },
    { ...rewards, progress: { ...progress, flowers: [{ productId: "flower-1", purchasedGrams: -1, complete: false }] } },
    { ...rewards, progress: { ...progress, flowers: [{ productId: "flower-1", purchasedGrams: 2.9, complete: true }] } },
  ])("rejects malformed authoritative data %#", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(getContestBundleRewards(user)).rejects.toThrow("indisponible");
  });
  it("refuses an invalid identity before database access", async () => {
    await expect(syncContestBundleRewards("attacker")).rejects.toThrow("indisponible");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
