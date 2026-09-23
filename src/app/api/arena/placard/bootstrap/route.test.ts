import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentCustomerSessionByBackend,
  getKqPlayerCollectionSnapshot,
  getKqPlayerBuddieRotation,
  getKqPlayerOwnedBuddies,
  getKqPlayerHeritageSnapshot,
  getKqPlayerCoreSnapshot,
  getKqEquipmentRoutePlan,
} = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  getKqPlayerCollectionSnapshot: vi.fn(),
  getKqPlayerBuddieRotation: vi.fn(),
  getKqPlayerOwnedBuddies: vi.fn(),
  getKqPlayerHeritageSnapshot: vi.fn(),
  getKqPlayerCoreSnapshot: vi.fn(),
  getKqEquipmentRoutePlan: vi.fn(),
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

import { GET } from "@/app/api/arena/placard/bootstrap/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "dddddddd-dddd-dddd-dddd-dddddddddddd";

describe("GET /api/arena/placard/bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKqPlayerBuddieRotation.mockResolvedValue({ requiredDistinctBuddies: 5, recentBuddieCodes: ["HH2026-003"] });
    process.env.KQ_PLAYER_API_LIVE = "true";
    getCurrentCustomerSessionByBackend.mockResolvedValue({ customerId });
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
  afterAll(() => {
    if (previousFlag === undefined) delete process.env.KQ_PLAYER_API_LIVE;
    else process.env.KQ_PLAYER_API_LIVE = previousFlag;
  });

  it("stays hidden until player launch", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await GET()).status).toBe(404);
    expect(getKqPlayerCollectionSnapshot).not.toHaveBeenCalled();
  });

  it("loads collection and game session in one authenticated request", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
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
