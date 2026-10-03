import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentCustomerSessionByBackend,
  getKqPlayerCollectionSnapshot,
  getKqPlayerBuddieRotation,
  getKqPlayerOwnedBuddies,
  getKqPlayerHeritageSnapshot,
  getKqPlayerCoreSnapshot,
  getKqEquipmentRoutePlan,
  syncKqOrderCashRewards,
  syncContestBundleRewards,
} = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  getKqPlayerCollectionSnapshot: vi.fn(),
  getKqPlayerBuddieRotation: vi.fn(),
  getKqPlayerOwnedBuddies: vi.fn(),
  getKqPlayerHeritageSnapshot: vi.fn(),
  getKqPlayerCoreSnapshot: vi.fn(),
  getKqEquipmentRoutePlan: vi.fn(),
  syncKqOrderCashRewards: vi.fn(),
  syncContestBundleRewards: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({
  getKqPlayerCollectionSnapshot,
  getKqPlayerBuddieRotation,
  getKqPlayerOwnedBuddies,
  getKqPlayerHeritageSnapshot,
  getKqPlayerCoreSnapshot,
}));
vi.mock("@/lib/supabase/kanab-quest-equipment-backend", () => ({ getKqEquipmentRoutePlan }));
vi.mock("@/lib/supabase/kanab-quest-order-cash-backend", () => ({ syncKqOrderCashRewards }));
vi.mock("@/lib/supabase/contest-bundle-rewards-backend", () => ({ syncContestBundleRewards }));

import { GET } from "@/app/api/arena/placard/bootstrap/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const rewardSynchronizations = [
  { reward: "order cash", synchronize: syncKqOrderCashRewards, warning: "Order cash reward synchronization temporarily unavailable." },
  { reward: "contest bundle", synchronize: syncContestBundleRewards, warning: "Contest bundle reward synchronization temporarily unavailable." },
];

describe("GET /api/arena/placard/bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKqPlayerBuddieRotation.mockResolvedValue({ requiredDistinctBuddies: 5, recentBuddieCodes: ["HH2026-003"] });
    process.env.KQ_PLAYER_API_LIVE = "true";
    getCurrentCustomerSessionByBackend.mockResolvedValue({ customerId });
    syncKqOrderCashRewards.mockResolvedValue({ available: true, receipts: [] });
    syncContestBundleRewards.mockResolvedValue({ available: true, receipts: [] });
    getKqPlayerCollectionSnapshot.mockResolvedValue({ inventory: { "BOTTE-001": 1 } });
    getKqPlayerOwnedBuddies.mockResolvedValue([{
      code: "HH2026-003",
      name: "Buddie test",
      rarity: "common",
      cardNumber: 3,
      imageUrl: "/cards/buddie-test.webp",
      ownedCopies: 1,
    }]);
    getKqPlayerHeritageSnapshot.mockResolvedValue({
      collectionActive: false,
      fragmentBalance: 0,
      cards: [],
    });
    getKqPlayerCoreSnapshot.mockResolvedValue({ activeRun: null, flowers: [], battles: [], progress: null });
    getKqEquipmentRoutePlan.mockResolvedValue({ route: "rosin-signature", equipmentCode: "PRESS-20T" });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => {
    if (previousFlag === undefined) delete process.env.KQ_PLAYER_API_LIVE;
    else process.env.KQ_PLAYER_API_LIVE = previousFlag;
  });

  it("stays hidden until player launch", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await GET()).status).toBe(404);
    expect(getKqPlayerCollectionSnapshot).not.toHaveBeenCalled();
    expect(syncKqOrderCashRewards).not.toHaveBeenCalled();
    expect(syncContestBundleRewards).not.toHaveBeenCalled();
  });

  it("does not synchronize rewards without an authenticated customer", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(syncKqOrderCashRewards).not.toHaveBeenCalled();
    expect(syncContestBundleRewards).not.toHaveBeenCalled();
    expect(getKqPlayerCollectionSnapshot).not.toHaveBeenCalled();
  });

  it.each(rewardSynchronizations)("waits for $reward reconciliation before loading any game snapshot", async ({ synchronize }) => {
    let resolveSync!: () => void;
    synchronize.mockReturnValue(new Promise<void>((resolve) => { resolveSync = resolve; }));
    const response = GET();
    await vi.waitFor(() => expect(synchronize).toHaveBeenCalledExactlyOnceWith(customerId));
    for (const snapshot of [getKqPlayerCollectionSnapshot, getKqPlayerOwnedBuddies,
      getKqPlayerHeritageSnapshot, getKqPlayerCoreSnapshot, getKqEquipmentRoutePlan,
      getKqPlayerBuddieRotation]) expect(snapshot).not.toHaveBeenCalled();
    resolveSync();
    expect((await response).status).toBe(200);
    expect(syncKqOrderCashRewards).toHaveBeenCalledExactlyOnceWith(customerId);
    expect(syncContestBundleRewards).toHaveBeenCalledExactlyOnceWith(customerId);
    expect(getKqPlayerCoreSnapshot).toHaveBeenCalledWith(customerId);
  });

  it.each(rewardSynchronizations)("isolates a $reward synchronization failure without disclosing private details", async ({ synchronize, warning: expectedWarning }) => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    synchronize.mockRejectedValue(new Error("private reward detail"));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(syncKqOrderCashRewards).toHaveBeenCalledExactlyOnceWith(customerId);
    expect(syncContestBundleRewards).toHaveBeenCalledExactlyOnceWith(customerId);
    expect(getKqPlayerCoreSnapshot).toHaveBeenCalledWith(customerId);
    expect(JSON.stringify(await response.json())).not.toContain("private reward detail");
    expect(warning).toHaveBeenCalledExactlyOnceWith(expectedWarning);
  });

  it("keeps the game available when both reward synchronizations fail", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    syncKqOrderCashRewards.mockRejectedValue(new Error("private cash detail"));
    syncContestBundleRewards.mockRejectedValue(new Error("private contest detail"));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(syncKqOrderCashRewards).toHaveBeenCalledExactlyOnceWith(customerId);
    expect(syncContestBundleRewards).toHaveBeenCalledExactlyOnceWith(customerId);
    expect(getKqPlayerCoreSnapshot).toHaveBeenCalledWith(customerId);
    const payload = await response.json();
    expect(JSON.stringify(payload)).not.toContain("private cash detail");
    expect(JSON.stringify(payload)).not.toContain("private contest detail");
    expect(payload.warnings).toEqual([]);
    expect(warning.mock.calls).toEqual(rewardSynchronizations.map(({ warning: message }) => [message]));
  });

  it("loads collection and game session in one authenticated request", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(syncKqOrderCashRewards).toHaveBeenCalledExactlyOnceWith(customerId);
    expect(syncContestBundleRewards).toHaveBeenCalledExactlyOnceWith(customerId);
    expect(getKqPlayerCollectionSnapshot).toHaveBeenCalledWith(customerId);
    expect(getKqPlayerOwnedBuddies).toHaveBeenCalledWith(customerId);
    expect(getKqPlayerHeritageSnapshot).toHaveBeenCalledWith(customerId);
    expect(getKqPlayerCoreSnapshot).toHaveBeenCalledWith(customerId);
    expect(getKqEquipmentRoutePlan).toHaveBeenCalledWith(customerId);
    expect(getCurrentCustomerSessionByBackend).toHaveBeenCalledWith("identity");
    expect(await response.json()).toMatchObject({
      buddieRotation: { requiredDistinctBuddies: 5, recentBuddieCodes: ["HH2026-003"] },
      collection: { inventory: { "BOTTE-001": 1 } },
      ownedBuddieCodes: ["HH2026-003"],
      ownedBuddies: [{ code: "HH2026-003", imageUrl: "/cards/buddie-test.webp", ownedCopies: 1 }],
      routePlan: { route: "rosin-signature", equipmentCode: "PRESS-20T" },
      playerSession: { activeRun: null, flowers: [], battles: [], progress: null },
      warnings: [],
    });
  });

  it("keeps the core game available when optional Heritages fail", async () => {
    getKqPlayerHeritageSnapshot.mockRejectedValue(new Error("private detail"));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      heritage: null,
      warnings: ["Héritages momentanément indisponibles."],
    });
  });

  it("keeps the game available when the saved route goal cannot be loaded", async () => {
    getKqEquipmentRoutePlan.mockRejectedValue(new Error("private detail"));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      routePlan: null,
      warnings: ["Objectif de filière momentanément indisponible."],
    });
  });

  it("keeps an active culture available but reports unknown rotation when its read fails", async () => {
    getKqPlayerBuddieRotation.mockRejectedValue(new Error("private rotation detail"));
    getKqPlayerCoreSnapshot.mockResolvedValue({ activeRun: { runId: "current" }, flowers: [], battles: [], progress: null });
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(getKqPlayerBuddieRotation).toHaveBeenCalledWith(customerId);
    expect(payload.buddieRotation).toBeNull();
    expect(payload.playerSession).toMatchObject({ activeRun: { runId: "current" }, buddieRotation: null });
    expect(payload.warnings).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toContain("private rotation detail");
  });

  it("fails closed when the physical collection cannot be verified", async () => {
    getKqPlayerCollectionSnapshot.mockRejectedValue(new Error("private table"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private table");
  });
});
