import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentCustomerSessionByBackend,
  getKqPlayerCollectionSnapshot,
  getKqPlayerOwnedBuddieCodes,
  getKqPlayerHeritageSnapshot,
} = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  getKqPlayerCollectionSnapshot: vi.fn(),
  getKqPlayerOwnedBuddieCodes: vi.fn(),
  getKqPlayerHeritageSnapshot: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({
  getKqPlayerCollectionSnapshot,
  getKqPlayerOwnedBuddieCodes,
  getKqPlayerHeritageSnapshot,
}));

import { GET } from "@/app/api/arena/placard/bootstrap/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "dddddddd-dddd-dddd-dddd-dddddddddddd";

describe("GET /api/arena/placard/bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KQ_PLAYER_API_LIVE = "true";
    getCurrentCustomerSessionByBackend.mockResolvedValue({ customerId });
    getKqPlayerCollectionSnapshot.mockResolvedValue({ inventory: { "BOTTE-001": 1 } });
    getKqPlayerOwnedBuddieCodes.mockResolvedValue(["HH2026-003"]);
    getKqPlayerHeritageSnapshot.mockResolvedValue({
      collectionActive: false,
      fragmentBalance: 0,
      cards: [],
    });
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

  it("loads the three collection views for one authenticated customer", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(getKqPlayerCollectionSnapshot).toHaveBeenCalledWith(customerId);
    expect(getKqPlayerOwnedBuddieCodes).toHaveBeenCalledWith(customerId);
    expect(getKqPlayerHeritageSnapshot).toHaveBeenCalledWith(customerId);
    expect(await response.json()).toMatchObject({
      collection: { inventory: { "BOTTE-001": 1 } },
      ownedBuddieCodes: ["HH2026-003"],
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

  it("fails closed when the physical collection cannot be verified", async () => {
    getKqPlayerCollectionSnapshot.mockRejectedValue(new Error("private table"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private table");
  });
});
